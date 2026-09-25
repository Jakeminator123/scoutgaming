// Progress contains stage names and elapsed time only. Text/media arrive once,
// after the server has rechecked ownership and the current round.
export const CHAT_STAGES = Object.freeze({
  text: 'Astrid tänker…', voice: 'Skapar rösten…',
  'video-submit': 'Skickar rösten till läppsynk…',
  'video-queue': 'Väntar på läppsynk…', 'video-render': 'Skapar läppsynk…',
  media: 'Förbereder uppspelning…', ready: 'Svar klart · väntar på ledigt bord',
});

export async function readChatResponse(response, onProgress = () => {}) {
  if (!response.ok || !response.headers.get('content-type')?.includes('application/x-ndjson')) {
    const value = await response.json();
    if (!response.ok) throw new Error(value.error || 'chat_unavailable');
    return value;
  }
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let buffer = '', size = 0, decision;
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
        if (frame.type === 'result') decision = frame.decision;
        else if (frame.type === 'progress' && Object.hasOwn(CHAT_STAGES, frame.stage)
          && Number.isSafeInteger(frame.elapsedMs) && frame.elapsedMs >= 0) onProgress(frame);
        else throw new Error('invalid_chat_response');
      }
    }
    if (buffer.trim() || !decision) throw new Error('incomplete_chat_response');
    return decision;
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

export function chatFailureMessage(reason = '') {
  if (reason === 'hidden') return 'Uppspelningen avbröts när du bytte flik.';
  if (reason === 'muted') return 'Slå på ljudet för att höra Astrids svar.';
  if (/stale|^stale:/.test(reason)) return 'Bordet eller profilen ändrades. Skicka frågan igen.';
  if (/busy/.test(reason)) return 'Rösttjänsten är upptagen. Försök igen strax.';
  if (/timeout/.test(reason)) return 'Svaret tog för lång tid. Försök igen.';
  if (/generated_speech/.test(reason)) return 'Rösten eller läppsynken kunde inte skapas. Försök igen.';
  return 'Svaret kunde inte slutföras. Försök igen.';
}
