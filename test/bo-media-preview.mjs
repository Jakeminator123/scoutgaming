import assert from 'node:assert/strict';
import test from 'node:test';
import { createSinglePreviewController } from '../web/public/bo/media-preview.mjs';

function preview(src) {
  const listeners = new Map();
  return {
    src, currentTime: 7, pauses: 0, loads: 0, removed: [],
    addEventListener(type, listener) { listeners.set(type, [...(listeners.get(type) ?? []), listener]); },
    emit(type) { for (const listener of listeners.get(type) ?? []) listener(); },
    pause() { this.pauses++; },
    load() { this.loads++; },
    removeAttribute(name) { this.removed.push(name); if (name === 'src') this.src = ''; },
  };
}

const root = previews => ({ querySelectorAll: selector => selector === '[data-bo-preview]' ? previews : [] });

test('starting a catalogue preview pauses and rewinds the previous preview', () => {
  const controller = createSinglePreviewController();
  const first = preview('/first.mp4'), second = preview('/second.mp4');
  controller.bind(root([first, second]));
  first.emit('play'); second.emit('play');
  assert.equal(first.pauses, 1);
  assert.equal(first.currentTime, 0);
  assert.equal(second.pauses, 0);
  assert.equal(second.currentTime, 7);
});

test('redraw or page close releases visible and previously active media', () => {
  const controller = createSinglePreviewController();
  const old = preview('/old.mp4'), visible = preview('/visible.mp3');
  controller.bind(root([old])); old.emit('play');
  controller.release(root([visible]));
  for (const media of [old, visible]) {
    assert.equal(media.pauses, 1);
    assert.equal(media.currentTime, 0);
    assert.deepEqual(media.removed, ['src']);
    assert.equal(media.loads, 1);
    assert.equal(media.src, '');
  }
});

test('binding the same preview twice does not install competing play handlers', () => {
  const controller = createSinglePreviewController();
  const first = preview('/first.mp4'), second = preview('/second.mp4');
  const scope = root([first, second]);
  controller.bind(scope); controller.bind(scope);
  first.emit('play'); second.emit('play');
  assert.equal(first.pauses, 1);
});
