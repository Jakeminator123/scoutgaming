import assert from 'node:assert/strict';
import { setTimeout as pause } from 'node:timers/promises';
import { createAstridCameraControl } from '../../services/game/public/astrid-camera-control.mjs';
import { encodeCameraWav } from '../../services/game/public/astrid-camera-audio.mjs';

export async function until(check) {
  for (let attempt = 0; attempt < 300; attempt++) {
    if (check()) return;
    await pause(5);
  }
  assert.fail('microphone integration did not settle');
}

class Element {
  constructor(tag) {
    this.tag = tag; this.children = []; this.hidden = false; this.textContent = '';
    this.attributes = {}; this.listeners = new Map(); this.style = {};
  }
  append(...nodes) { this.children.push(...nodes); }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, listener) { this.listeners.set(name, listener); }
  pause() {}
  play() { return Promise.resolve(); }
  showModal() { this.open = true; }
  close() { this.open = false; }
}
const nodes = root => [root, ...root.children.flatMap(nodes)];

// Only devices and DOM are synthetic. The real controller owns consent, VAD,
// WAV upload, transcript forwarding, identity checks and its cleanup timers.
export function microphoneControl({ identity, fetchImpl, send, presentationContext }) {
  const previous = Object.fromEntries(['document', 'window'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const listeners = new Map();
  globalThis.document = { hidden: false, createElement: tag => new Element(tag),
    addEventListener: (name, listener) => listeners.set(name, listener) };
  globalThis.window = { addEventListener: (name, listener) => listeners.set(name, listener) };
  const root = new Element('div'), tracks = [], recorders = [], sent = [];
  let playback = false;
  const control = createAstridCameraControl({ container: root, identity, dealerName: 'Dragan', wakeNames: ['Dragan'],
    presentationContext, fetchImpl,
    mediaDevices: { async getUserMedia(constraints) {
      assert.equal(constraints.video, false);
      const track = { stopped: false, stop() { this.stopped = true; }, addEventListener() {} };
      tracks.push(track); return { getTracks: () => [track], getAudioTracks: () => [track] };
    } },
    AudioContextClass: class {}, AudioWorkletNodeClass: class {},
    createRecorder: async options => {
      const recorder = { options, active: false, stopped: false,
        activate() { this.active = true; return true; },
        stop(discard) {
          this.stopped = true;
          return discard ? null : encodeCameraWav([new Int16Array(16000).fill(1000)], 16000);
        } };
      recorders.push(recorder); return recorder;
    },
    send: async value => { sent.push(value); return send(value); },
    getPlaybackEnabled: () => playback,
    onPlaybackEnable: () => { playback = true; control.refreshPlayback(); },
  });
  const find = text => nodes(root).find(node => node.textContent === text);
  const click = node => { assert.ok(node, 'expected microphone control'); node.onclick({ preventDefault() {} }); };
  const record = nodes(root).find(node => node.tag === 'button' && node.attributes['aria-label'] === 'Enable voice listening');
  const status = () => nodes(root).find(node => node.attributes.role === 'status').textContent;
  return {
    control, tracks, sent,
    async recordTurn() {
      await until(() => status().startsWith('Voice off.'));
      click(record); click(find('Record one message'));
      await until(() => recorders.at(-1)?.active && status().startsWith('Recording audio.'));
      for (const [speaking, at] of [[true, 100], [true, 200], [false, 300], [false, 1450]]) {
        recorders.at(-1).options.onSample({ speaking, at, rms: speaking ? .1 : 0 });
      }
    },
    restore() {
      control.stop();
      for (const [name, descriptor] of Object.entries(previous)) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name];
      }
    },
  };
}
