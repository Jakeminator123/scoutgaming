import { createMovingSpeechFrameLayer } from '../../packages/presentation/runtime/moving-speech-frame-layer.mjs';

export async function run({ plan, encoded, meta, presented }) {
  const body = document.createElement('canvas'); body.width = body.videoWidth = 320; body.height = body.videoHeight = 240;
  body.getContext('2d').fillStyle = 'blue'; body.getContext('2d').fillRect(0, 0, 320, 240);
  const results = [];
  for (let play = 0; play < 2; play++) {
    const layer = await createMovingSpeechFrameLayer({ plan, document });
    await layer.push(meta, Uint8Array.from(encoded));
    const painted = layer.paint(body, presented), context = painted.getContext('2d');
    const red = [...context.getImageData(20, 40, 1, 1).data], blue = [...context.getImageData(45, 40, 1, 1).data];
    const mismatch = layer.paint(body, { ...presented, frame: presented.frame + 1 }) === body;
    layer.close(); results.push({ red, blue, mismatch, closed: layer.paint(body, presented) === body });
  }
  return results;
}
