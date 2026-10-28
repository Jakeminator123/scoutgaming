import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createSeedProject } from '../../../packages/presentation/contracts/studio-model.mjs';
import { mediaExampleEvent } from '../../../packages/presentation/runtime/media-family-policy.mjs';
import { validateVideoMetadata, validateVideoCompositing } from '../../../packages/presentation/contracts/video-intake.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');
function load(file, mocks = {}, hookReact = React) {
  const url = new URL(file, import.meta.url);
  const localRequire = createRequire(url);
  const source = readFileSync(url, 'utf8');
  const output = transformSync(source, { filename: fileURLToPath(url), jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
  const module = { exports: {} };
  vm.runInNewContext(output.code, {
    module, exports: module.exports, structuredClone, URL, URLSearchParams, AbortController,
    window: { location: { hash: '', search: '' } }, crypto: { randomUUID: () => 'test-run' },
    require: name => {
      if (name === 'react') return hookReact;
      if (name in mocks) return mocks[name];
      if (name.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
      if (name.startsWith('.')) {
        for (const suffix of ['', '.tsx', '.ts', '.mjs', '.js']) {
          const candidate = new URL(name + suffix, url); const path = fileURLToPath(candidate);
          if (!existsSync(path)) continue;
          return /\.(mjs|js|json)$/.test(path) ? localRequire(path) : load(pathToFileURL(path), mocks, hookReact);
        }
      }
      return localRequire(name);
    },
  });
  return module.exports;
}
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
}
function hooks() {
  const states = [], refs = [], effects = []; let stateIndex = 0, refIndex = 0;
  const react = { ...React, useEffect: effect => effects.push(effect), useMemo: fn => fn(), useCallback: fn => fn,
    useRef(initial) { const index = refIndex++; return refs[index] ??= { current: initial }; },
    useState(initial) { const index = stateIndex++; if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial; return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }]; },
  };
  return { react, states, refs, effects, render(component, props) { stateIndex = refIndex = 0; return component(props); } };
}
test('position preview changes only the destination; consecutive card slots, cards and exact speech survive', () => {
  const project = createSeedProject(); const before = structuredClone(project);
  for (const definition of project.events.filter(row => row.sourceType === 'deal')) {
    for (const handIndex of [0, 1, 2, 31]) {
      const card = { rank: 'K', suit: 'hearts' };
      const source = { ...definition, exampleEvent: { ...definition.exampleEvent, handIndex, card } };
      for (const situation of definition.id === 'deal.dealer' ? ['dealer-up', 'dealer-hole'] : ['box0', 'box1', 'box2', 'box3', 'box4', 'box5', 'box6']) {
        const event = mediaExampleEvent(source, situation);
        assert.equal(event.handIndex, handIndex);
        assert.deepEqual(event.card, situation === 'dealer-hole' ? null : card);
      }
    }
  }
  const speech = project.events.find(row => row.id === 'speak.other');
  assert.equal(mediaExampleEvent(speech, 'greeting').line, 'greeting');
  assert.deepEqual(project, before);
});

test('dealer backgrounds are always keyed with bounded controls and retain the exact event and situation', () => {
  const { VideoCompositingFields, VideoMetadataFields } = load('./video-metadata-fields.tsx');
  const values = []; let tree = VideoCompositingFields({ value: { mode: 'opaque' }, onChange: value => values.push(value) });
  assert.deepEqual(nodes(tree,node=>node.type==='option').map(node=>node.props.value),['green-screen','alpha'],'only keying or source alpha; no baked background retention');
  assert.match(renderToStaticMarkup(tree),/Äldre bakgrundsinställning behöver uppdateras/);
  nodes(tree, node => node.type === 'input')[0].props.onChange({ target: { valueAsNumber: .23 } });
  assert.equal(validateVideoCompositing(values[0]).mode, 'green-screen');
  tree = VideoCompositingFields({ value: values[0], onChange: value => values.push(value) });
  const inputs = nodes(tree, node => node.type === 'input');
  inputs[0].props.onChange({ target: { valueAsNumber: 1.7 } }); assert.equal(values.at(-1).threshold, 1);
  inputs[1].props.onChange({ target: { valueAsNumber: -1 } }); assert.equal(values.at(-1).softness, 0.001);
  const metadata = { label: 'Min rörelse', dealerId: 'astrid', eventId: 'deal.player.left', kind: 'action', role: 'alternative', situation: 'box1', playback: 'once', notes: '' };
  tree = VideoMetadataFields({ project: createSeedProject(), value: metadata, onChange: value => values.push(value) });
  nodes(tree, node => typeof node.type === 'function' && node.type.name === 'VideoCompositingFields')[0].props.onChange({ mode: 'green-screen', threshold: 0.4, softness: 0.2, despill: 0.1 });
  assert.equal(validateVideoMetadata(values.at(-1)).situation, 'box1'); assert.equal(values.at(-1).eventId, metadata.eventId);
});



test('display naming is separate from file identity and situation URL survives variant changes', () => {
  const { studioHref, selectionHref } = load('./studio-types.ts');
  assert.equal(studioHref('/admin/videos', { dealerId: 'nora', eventId: 'deal.dealer', situation: 'dealer-hole' }), "/admin/clips?dealer=nora&event=deal.dealer&situation=dealer-hole");
  assert.match(selectionHref('/admin/events', '?dealer=astrid&event=deal.player.left&situation=box1', 'astrid', 'deal.player.left', 'same-variant'), /situation=box1/);
  assert.doesNotMatch(selectionHref('/admin/events', '?dealer=astrid&event=deal.player.left&situation=box1', 'astrid', 'deal.dealer'), /situation=/);
});


test('Probe selection stays in Admin and preserves room context under either mount', () => {
  const { selectionHref } = load('./studio-types.ts');
  const previous = process.env.NEXT_PUBLIC_LAB_BASE_PATH;
  try {
    for (const basePath of ['', '/studio']) {
      process.env.NEXT_PUBLIC_LAB_BASE_PATH = basePath;
      const href = selectionHref(basePath + '/admin/probe', '?dealer=astrid&event=idle.ready&operator=north&table=room-1&lane=portrait&token=private', 'saga', 'idle.ready');
      assert.equal(href, "/admin/clips?panel=room&dealer=saga&event=idle.ready&composition=portrait&operator=north&table=room-1");
    }
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_LAB_BASE_PATH; else process.env.NEXT_PUBLIC_LAB_BASE_PATH = previous;
  }
});
