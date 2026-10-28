import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createSeedProject as createBaseProject , addDealer} from '../../../packages/presentation/contracts/studio-model.mjs';
import { labUrl } from '../lib/lab-url.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');

function loadTs(fileUrl, overrides = {}) {
  const source = readFileSync(fileUrl, 'utf8');
  const output = transformSync(source, { filename: fileURLToPath(fileUrl), jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
  const module = { exports: {} };
  const localRequire = createRequire(fileUrl);
  vm.runInNewContext(output.code, {
    module, exports: module.exports, structuredClone, URL, URLSearchParams,
    window: new Proxy({}, { get: (_target, key) => globalThis.window?.[key] }),
    require: name => {
      if (Object.hasOwn(overrides, name)) return overrides[name];
      if (name.endsWith('.module.css') || name.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
      if (name.startsWith('./') || name.startsWith('../')) {
        for (const suffix of ['', '.tsx', '.ts', '.mjs', '.js']) {
          const candidate = new URL(name + suffix, fileUrl);
          const path = fileURLToPath(candidate);
          if (!existsSync(path)) continue;
          if (path.endsWith('.mjs') || path.endsWith('.js') || path.endsWith('.json')) return localRequire(path);
          return loadTs(pathToFileURL(path), overrides);
        }
      }
      return localRequire(name);
    },
  }, { filename: fileURLToPath(fileUrl) });
  return module.exports;
}

const project = createSeedProject();
const props = {
  initialProject: project,
  initialVideos: { videos: [] },
  initialStatus: { configured: true, message: 'Konfigurerat' },
  standaloneVoicePreviewAvailable: true,
  initialDealerId: 'astrid',
};

test('chat panel receives the studio session props and opens the room with a full page load', () => {
  let panel;
  function GatewayPanel(next) { panel = next; return React.createElement('div', { id: 'gateway-stub' }); }
  const { ControlOpenClawChat } = loadTs(new URL('./control-openclaw-chat.tsx', import.meta.url), {
    './gateway-panel': { GatewayPanel },
  });
  const hidden = renderToStaticMarkup(React.createElement(ControlOpenClawChat, { ...props, standaloneVoicePreviewAvailable: false, initialDealerId: 'elin' }));
  assert.match(hidden, /id="gateway-stub"/);
  assert.equal(panel.standaloneVoicePreviewAvailable, false);
  assert.equal(panel.status, props.initialStatus);
  assert.equal(panel.mode, 'off');
  assert.equal(panel.dealerId, 'elin');
  assert.equal(panel.dirty, false);
  assert.equal(typeof panel.onModeChange, 'function');
  panel.onModeChange('rules');
  assert.equal(panel.dirty, false);
  const assigned = [];
  const previous = globalThis.window;
  globalThis.window = { location: { assign: path => assigned.push(path) },dispatchEvent:()=>true };
  try { panel.onPlayerChat(); }
  finally {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  }
  // Without a selected table the rehearsal opens the table list, carrying the dealer.
  assert.deepEqual(assigned, [labUrl('/admin/companies?tab=spelbord&dealer=elin')]);
});

// Explicit active dealers used by this isolated component fixture.
function createSeedProject(){return addDealer(addDealer(createBaseProject(),'elin','Elin'),'saga','Saga');}

test('retired or unknown dealer cannot open the chat panel and preserves context for explicit active selection', () => {
  const before = structuredClone(project);
  const { ControlOpenClawChat } = loadTs(new URL('./control-openclaw-chat.tsx', import.meta.url), {
    'next/navigation': { usePathname: () => '/admin/openclaw', useSearchParams: () => new URLSearchParams('composition=shared&operator=north&table=room-a') },
    './gateway-panel': { GatewayPanel: () => assert.fail('inactive dealer must never enter chat') },
    './studio-session': { useStudioSession: () => assert.fail('inactive dealer must never start a session') },
  });
  for (const initialDealerId of ['vera', 'mei', 'amira', 'johanna', 'unknown']) {
    const html = renderToStaticMarkup(React.createElement(ControlOpenClawChat, { ...props, initialDealerId }));
    assert.match(html, /<h2>Välj dealer<\/h2>/);
    assert.match(html, /dealer=astrid&amp;composition=shared&amp;operator=north&amp;table=room-a/);
    assert.ok(!html.includes('dealer=' + initialDealerId));
  }
  assert.deepEqual(project, before);
});
