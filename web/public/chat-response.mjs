// A generated-text preview is provisional until the final decision arrives.
// Media and the authoritative result arrive after the ownership/round recheck.
export const CHAT_STAGES = Object.freeze({
  text: 'Astrid tänker…', voice: 'Skapar rösten…',
  'video-submit': 'Skickar rösten till läppsynk…',
  'video-queue': 'Väntar på video-GPU…', 'video-render': 'Skapar läppsynk…',
  media: 'Förbereder uppspelning…', ready: 'Svar klart · väntar på ledigt bord',
});

export async function readChatResponse(response, onProgress = () => {}, onPreview = () => {}) {
  if (!response.ok || !response.headers.get('content-type')?.includes('application/x-ndjson')) {
    const value = await response.json();
    if (!response.ok) throw new Error(value.error || 'chat_unavailable');
    return value;
  }
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let buffer = '', size = 0, decision, previewText;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 128 * 1024) throw new Error('invalid_chat_response');
      buffer += decoder.decode(value, { stream: true });
      let newline;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const frame = JSON.parse(buffer.slice(0, newline)); buffer = buffer.slice(newline + 1);
        if (decision) throw new Error('invalid_chat_response');
        if (frame.type === 'error') throw new Error(frame.error || 'chat_unavailable');
        if (frame.type === 'result') {
          if (previewText !== undefined && (frame.decision?.kind !== 'generatedText' || frame.decision.exactText !== previewText)) throw new Error('invalid_chat_response');
          decision = frame.decision;
        }
        else if (frame.type === 'preview' && previewText === undefined && typeof frame.exactText === 'string'
          && frame.exactText.length > 0 && frame.exactText.length <= 500 && frame.exactText === frame.exactText.trim()
          && !/[\u0000-\u001f\u007f-\u009f]/.test(frame.exactText)) {
          previewText = frame.exactText; onPreview(previewText);
        }
        else if (frame.type === 'progress' && Object.hasOwn(CHAT_STAGES, frame.stage)
          && Number.isSafeInteger(frame.elapsedMs) && frame.elapsedMs >= 0
          && (frame.metrics === undefined || (frame.stage === 'media' && frame.metrics && typeof frame.metrics === 'object'
            && !Array.isArray(frame.metrics) && Object.keys(frame.metrics).every(key => ['videoBytes', 'runpodDelayMs', 'runpodExecutionMs'].includes(key)
              && Number.isSafeInteger(frame.metrics[key]) && frame.metrics[key] >= 0)))) onProgress(frame);
        else throw new Error('invalid_chat_response');
      }
    }
    if (buffer.trim() || !decision) throw new Error('incomplete_chat_response');
    return decision;
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

export function chatFailureMessage(reason = '') {
  if (reason === 'generated_speech_daily_budget_exhausted') return 'Dagens budget för läppsynk är nådd. Nya röstsvar blir tillgängliga nästa dag.';
  if (reason === 'hidden') return 'Uppspelningen avbröts när du bytte flik.';
  if (reason === 'muted') return 'Slå på ljudet för att höra Astrids svar.';
  if (/stale|^stale:/.test(reason)) return 'Bordet eller profilen ändrades. Skicka frågan igen.';
  if (/busy/.test(reason)) return 'Rösttjänsten är upptagen. Försök igen strax.';
  if (/timeout/.test(reason)) return 'Svaret tog för lång tid. Försök igen.';
  if (/generated_speech/.test(reason)) return 'Rösten eller läppsynken kunde inte skapas. Försök igen.';
  return 'Svaret kunde inte slutföras. Försök igen.';
}
