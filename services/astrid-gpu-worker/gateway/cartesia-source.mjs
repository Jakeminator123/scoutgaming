/** Complete transcript -> streamed raw PCM. Credentials remain server-only.
 * This is not streaming LLM input; the caller supplies the exact full text.
 * API contract: https://docs.cartesia.ai/api-reference/tts/bytes
 */
export function createCartesiaSource({ apiKey, voiceId, modelId, timeoutMs = 30000 }, { fetchImpl = fetch } = {}) {
  if (![apiKey, voiceId, modelId].every(v => typeof v === 'string' && v.length > 0 && v.length <= 2048 && !/[\s\u0000-\u001f]/.test(v)) || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000) throw new Error('Invalid TTS configuration');
  return async function* pcmSource({ text, signal, beforeCostly = async () => {} }) {
    if (typeof text !== 'string' || !text.trim() || text !== text.trim() || text.length > 500 || /[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/.test(text)) throw new Error('Invalid speech text');
    const deadline = new AbortController();
    const timer = setTimeout(() => deadline.abort(), timeoutMs);
    const combined = signal ? AbortSignal.any([signal, deadline.signal]) : deadline.signal;
    let reader, carry = null, size = 0, completed = false;
    // Covers cancellation even when a custom transport leaves read() pending.
    async function read() {
      combined.throwIfAborted();
      let rejectAbort;
      const interrupted = new Promise((_, reject) => { rejectAbort = () => reject(new Error('TTS cancelled')); combined.addEventListener('abort', rejectAbort, { once: true }); });
      try { return await Promise.race([reader.read(), interrupted]); }
      finally { combined.removeEventListener('abort', rejectAbort); }
    }
    try {
      combined.throwIfAborted();
      await beforeCostly();
      combined.throwIfAborted();
      const response = await fetchImpl('https://api.cartesia.ai/tts/bytes', {
        method: 'POST', redirect: 'error', signal: combined,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}`, 'Cartesia-Version': '2026-08-14' },
        body: JSON.stringify({ transcript: text, voice: voiceId, model_id: modelId, output_format: { container: 'raw', encoding: 'pcm_s16le', sample_rate: 24000 } }),
      });
      const length = response.headers.get('content-length');
      if (!response.ok || /(?:json|text\/|mpeg|wav|flac)/i.test(response.headers.get('content-type') || '') || (length !== null && (!/^\d+$/.test(length) || Number(length) > 1200000))) {
        await response.body?.cancel(); throw new Error('Invalid TTS response');
      }
      if (!response.body?.getReader) throw new Error('Missing TTS stream');
      reader = response.body.getReader();
      for (;;) {
        const next = await read(); combined.throwIfAborted();
        if (next.done) break;
        size += next.value.byteLength;
        if (size > 1200000) throw new Error('Audio duration exceeded');
        let bytes = next.value;
        if (carry !== null) {
          const joined = new Uint8Array(bytes.byteLength + 1); joined[0] = carry; joined.set(bytes, 1); bytes = joined; carry = null;
        }
        if (bytes.byteLength % 2) { carry = bytes[bytes.byteLength - 1]; bytes = bytes.subarray(0, -1); }
        if (bytes.byteLength) yield bytes;
      }
      if (carry !== null || size < 48) throw new Error('Invalid PCM stream');
      completed = true;
    } catch {
      // Avoid exposing provider bodies, credentials or raw network errors.
      throw new Error(deadline.signal.aborted ? 'TTS timed out' : signal?.aborted ? 'TTS cancelled' : 'TTS stream failed');
    } finally {
      clearTimeout(timer);
      if (reader) {
        if (!completed) { try { await reader.cancel(); } catch {} }
        reader.releaseLock();
      }
      if (!completed) deadline.abort();
    }
  };
}
