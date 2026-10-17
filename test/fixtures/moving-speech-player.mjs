import { playGeneratedSpeech } from '../../web/public/generated-speech-player.mjs';

export async function run(speech) {
  const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 240; document.body.append(canvas);
  let layer, first = 0;
  const receipts = [], frames = [];
  await playGeneratedSpeech(speech, { exactText: speech.exactText, dealerId: speech.dealerId, requestId: speech.requestId,
    prepareRendering: async () => {}, setMovingSpeechLayer: value => { layer = value; },
    renderFrame: (base, presented) => {
      const source = layer?.paint(base, presented) ?? base, context = canvas.getContext('2d', { willReadFrequently: true });
      context.clearRect(0, 0, 320, 240); context.drawImage(source, 0, 0);
      const pixel = (x, y) => [...context.getImageData(x, y, 1, 1).data];
      frames.push({ time: presented?.audioTimeSeconds, body: pixel(0, 0), mouth: pixel(20, 30), patched: source !== base });
      return true;
    }, onFirstFrame: () => first++, onReceipt: receipt => receipts.push(receipt),
  });
  return { receipts, frames, first, closed: layer === null };
}
