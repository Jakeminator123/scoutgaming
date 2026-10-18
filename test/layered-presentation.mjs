import test from 'node:test';
import assert from 'node:assert/strict';
import { createLayeredPresentationWithRuntime, layeredUnavailableText } from '../services/game/public/layered-presentation.mjs';

function fakeDom() {
  const host = {
    children: [],
    append(node) { this.children.push(node); },
    prepend(node) { this.children.unshift(node); },
  };
  globalThis.document = {
    createElement(tag) {
      return {
        tag,
        className: '',
        textContent: '',
        children: [],
        attributes: {},
        dataset: {},
        setAttribute(name, value) { this.attributes[name] = value; },
        append(...nodes) { this.children.push(...nodes); },
        prepend(...nodes) { this.children.unshift(...nodes); },
        addEventListener() {},
        remove() {},
      };
    },
  };
  return host;
}

function fakeRuntime() {
  class StudioPlayer {
    constructor() { this.listeners = new Map(); this.running = false; }
    async setScene() {}
    async setDealer() {}
    async setAssets() {}
    addEventListener(type, fn) { this.listeners.set(type, fn); }
    removeEventListener(type) { this.listeners.delete(type); }
    stop() { this.running = false; }
    enqueueDeal() {
      this.listeners.get('card-landed')?.({ detail: { source: 'rehearsal' } });
      this.listeners.get('queue-idle')?.({ detail: { source: 'rehearsal' } });
    }
    destroy() {}
  }
  const attachScoutGamingBridge = (_player, { onReceipt, onUnsupported }) => ({
    consume({ presentation }) {
      const unsupported = [];
      let accepted = 0;
      for (const event of presentation) {
        if (event.type === 'speak') {
          const issue = { type: 'speak', message: 'unsupported', event };
          unsupported.push(issue);
          onUnsupported(issue);
          continue;
        }
        accepted += 1;
        onReceipt({ type: event.type === 'deal' ? 'card-landed' : 'queue-idle' });
      }
      return { accepted, duplicates: 0, unsupported };
    },
    detach() {},
  });
  return [{ StudioPlayer }, { attachScoutGamingBridge }];
}

const manifest = {
  scene: { background: 'bg-1' },
  dealer: { active_variant: 'v1', clips: { deal_pos1: { id: 'deal_pos1', role: 'deal', target: '1' } }, variants: { v1: { clips: {}, posters: {} } } },
  variant: 'v1',
  assets: [{ id: 'bg-1', role: 'background', src: '/layer-packs/paow/media/bg.webp' }],
};

test('layered presentation mounts canvas and consumes deal receipts', async () => {
  const host = fakeDom();
  const receipts = [];
  const presentation = await createLayeredPresentationWithRuntime({
    host,
    dealerId: 'paow',
    receipt: event => receipts.push(event),
    loadRuntime: async () => fakeRuntime(),
    readManifest: async () => manifest,
  });
  const result = presentation.consume({ roundId: 'r1', presentation: [{ type: 'deal', to: 'box', box: 0, card: { r: 'A', s: 'S' }, shoeDraw: 1 }] });
  assert.equal(result.accepted, 1);
  assert.equal(host.children[0].tag, 'canvas');
  assert.equal(receipts.some(event => event.event === 'card-landed'), true);
});

test('unsupported speak is logged and not thrown', async () => {
  const host = fakeDom();
  const receipts = [];
  const presentation = await createLayeredPresentationWithRuntime({
    host,
    dealerId: 'paow',
    receipt: event => receipts.push(event),
    loadRuntime: async () => fakeRuntime(),
    readManifest: async () => manifest,
  });
  const result = presentation.consume({ roundId: 'r2', presentation: [{ type: 'speak', line: 'goodluck' }] });
  assert.equal(result.accepted, 0);
  assert.equal(result.unsupported.length, 1);
  assert.equal(receipts.some(event => event.event === 'layered-unsupported' && event.type === 'speak'), true);
});

test('missing pack is reported as unavailable text', async () => {
  const host = fakeDom();
  await assert.rejects(() => createLayeredPresentationWithRuntime({
    host,
    dealerId: 'paow',
    loadRuntime: async () => fakeRuntime(),
    readManifest: async () => { throw new Error('layer_pack_unavailable'); },
  }));
  assert.equal(layeredUnavailableText(new Error('layer_pack_unavailable')), 'Lagerpaket saknas');
});
