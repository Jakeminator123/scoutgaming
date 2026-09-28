// Test-process preload: paid hosts are intercepted, all other external hosts
// are rejected. Only local HTTP fixtures may receive actual requests.
const original = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(String(input));
  if (url.href === 'https://api.cartesia.ai/tts/bytes') {
    process.stdout.write('FIXTURE_TTS_STARTED\n');
    let timer, count = 0, streamController;
    const abort = () => { clearInterval(timer); try { streamController.error(new Error('fixture cancelled')); } catch {} };
    const body = new ReadableStream({
      start(controller) {
        streamController = controller;
        controller.enqueue(new Uint8Array(4800));
        timer = setInterval(() => {
          if (++count === 10) { clearInterval(timer); init.signal?.removeEventListener('abort', abort); controller.close(); }
          else controller.enqueue(new Uint8Array(4800));
        }, 100);
        init.signal?.addEventListener('abort', abort, { once: true });
      },
      cancel() { clearInterval(timer); init.signal?.removeEventListener('abort', abort); },
    });
    return new Response(body, { headers: { 'content-type': 'audio/pcm' } });
  }
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw Error('External requests forbidden in speech fixture');
  return original(input, init);
};
