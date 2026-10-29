// Recheck authoritative ownership and round both before paid generation and
// before publishing. A disconnected/model-stale request must never start GPU work.
// readStatus(stage) gets 'start' (before the model), 'answer' (before the text is published)
// or 'speech' (before and during paid speech work); a caller may read more cheaply per stage.
// One solo chat reply's speech path. Without the optional still-image provider a registered
// still dealer answers text-only with a reason code, never 503.
export function selectChatSpeechStream({ dealerId, registeredSpeech, selected, acceptsSpeechStream, stillSpeechDisabled }) {
  const stream = typeof selected?.prepare === 'function' ? selected : null;
  if (registeredSpeech && !stream && stillSpeechDisabled) return { streamService: null, textOnlyReason: 'generated_speech_still_not_configured' };
  if (registeredSpeech && (!stream || acceptsSpeechStream !== true)) throw Object.assign(Error('generated_speech_stream_required'), { statusCode: 503 });
  return { streamService: (dealerId === 'astrid' || registeredSpeech) && acceptsSpeechStream === true ? stream : null, textOnlyReason: null };
}

export async function completeChatWithSpeech({ request, status, owner, playerId, readOwner, readStatus, signal, decide, service, streamService, textOnlyReason = null, onProgress = () => {}, onDecision = () => {}, onTiming = () => {} }) {
  const fresh = async (stage = 'speech') => {
    if (signal?.aborted) throw Object.assign(new Error('chat_cancelled'), { statusCode: 499 });
    if (!owner || await readOwner() !== owner) throw Object.assign(new Error('stale_chat_session'), { statusCode: 401 });
    await readStatus(stage);
    if (signal?.aborted) throw Object.assign(new Error('chat_cancelled'), { statusCode: 499 });
    if (!owner || await readOwner() !== owner) throw Object.assign(new Error('stale_chat_session'), { statusCode: 401 });
  };
  await fresh('start');
  // Voice permissions and the dealer reference are read-only. Prepare them while
  // the model answers; paid worker/TTS work still waits for an exact fresh reply.
  const warming = typeof streamService?.prewarm === 'function'
    ? Promise.resolve().then(() => streamService.prewarm({dealerId:status.dealerId,signal,beforeCostly:() => fresh()})).catch(() => {}) : null;
  onProgress('text');
  const textStarted = performance.now();
  let decision = await decide(request, status);
  onTiming('text_wait_ms', Math.round(performance.now() - textStarted));
  await fresh('answer');
  if (decision.kind === 'generatedText') onDecision(decision.exactText);
  if (streamService && decision.kind === 'generatedText') {
    onProgress('video-queue');
    await warming; await fresh();
    const speechStream = await streamService.prepare({ requestId: request.requestId, text: decision.exactText, dealerId: status.dealerId, owner, playerId, signal, beforeCostly: () => fresh(), onTiming });
    try { await fresh(); } catch (error) { streamService.cancelOwner?.(owner); throw error; }
    decision = { ...decision, visualMode: 'generated-lipsync-stream-preview', speechStream };
  } else if (service && status.dealerId === 'astrid' && decision.kind === 'generatedText') {
    const speechPackage = await service.generate({ requestId: request.requestId, text: decision.exactText, dealerId: status.dealerId, owner, signal, onProgress, beforeCostly: () => fresh() });
    await fresh();
    decision = { ...decision, visualMode: 'generated-lipsync-preview', speechPackage };
  } else if (textOnlyReason && decision.kind === 'generatedText') decision = { ...decision, speech: 'text-only', reason: textOnlyReason };
  onProgress('ready');
  return decision;
}
