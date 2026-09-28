// Recheck authoritative ownership and round both before paid generation and
// before publishing. A disconnected/model-stale request must never start GPU work.
export async function completeChatWithSpeech({ request, status, owner, readOwner, readStatus, signal, decide, service, onProgress = () => {}, onDecision = () => {} }) {
  const fresh = async () => {
    if (signal?.aborted) throw Object.assign(new Error('chat_cancelled'), { statusCode: 499 });
    if (!owner || readOwner() !== owner) throw Object.assign(new Error('stale_chat_session'), { statusCode: 401 });
    await readStatus();
    if (signal?.aborted) throw Object.assign(new Error('chat_cancelled'), { statusCode: 499 });
    if (!owner || readOwner() !== owner) throw Object.assign(new Error('stale_chat_session'), { statusCode: 401 });
  };
  await fresh();
  onProgress('text');
  let decision = await decide(request, status);
  await fresh();
  if (decision.kind === 'generatedText') onDecision(decision.exactText);
  if (service && status.dealerId === 'astrid' && decision.kind === 'generatedText') {
    const speechPackage = await service.generate({ requestId: request.requestId, text: decision.exactText, dealerId: status.dealerId, owner, signal, onProgress, beforeCostly: fresh });
    await fresh();
    decision = { ...decision, visualMode: 'generated-lipsync-preview', speechPackage };
  }
  onProgress('ready');
  return decision;
}
