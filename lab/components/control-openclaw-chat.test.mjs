import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createSeedProject } from '../lib/studio-model.mjs';
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

test('operator chat tab shows OpenClaw chat without a project save button', () => {
  const { ControlOpenClawChat, OpenClawTabLinks } = loadTs(new URL('./control-openclaw-chat.tsx', import.meta.url));
  const { studioHref } = loadTs(new URL('./studio-types.ts', import.meta.url));
  const html = renderToStaticMarkup(React.createElement(ControlOpenClawChat, props));
  assert.match(html, /\/\/ OPENCLAW/);
  assert.match(html, /<h1>Intern agentchatt<\/h1>/);
  assert.match(html, /class="sg-tabs"/);
  assert.match(html, /aria-current="page"/);
  assert.match(html, /aria-pressed="true"[^>]*>Chatt/);
  assert.match(html, /href="\/control\/openclaw"/);
  assert.match(html, new RegExp(`href="${studioHref('/control/openclaw', { tab: 'chat' }).replace(/[?]/g, '\\?')}"`));
  assert.match(html, /Öppna bordschatten/);
  assert.match(html, /Urvalsläge/);
  assert.match(html, /Äldre OpenClaw-rådgivare/);
  assert.match(html, /data-scout-assistant="openclaw"[^>]*>Öppna Adminroboten · OpenClaw/);
  assert.doesNotMatch(html, /<button[^>]*>[^<]*Spara projekt/);
  assert.doesNotMatch(html, /class="event-sidebar"|studio-chat-shortcuts|studio-footer|Croupier Lab/);
  const tabs = renderToStaticMarkup(React.createElement(OpenClawTabLinks, { active: 'models' }));
  assert.match(tabs, /aria-current="page"[^>]*>Agentmodeller/);
  assert.doesNotMatch(tabs, /aria-current="page"[^>]*>Chatt/);
  assert.equal(studioHref('/control/openclaw', { tab: 'chat' }), labUrl('/control/openclaw?tab=chat'));
});

test('chat panel receives the studio session props and opens playback with a full page load', () => {
  let panel;
  function GatewayPanel(next) { panel = next; return React.createElement('div', { id: 'gateway-stub' }); }
  const { ControlOpenClawChat } = loadTs(new URL('./control-openclaw-chat.tsx', import.meta.url), {
    './gateway-panel': { GatewayPanel },
  });
  const hidden = renderToStaticMarkup(React.createElement(ControlOpenClawChat, { ...props, standaloneVoicePreviewAvailable: false, initialDealerId: 'vera' }));
  assert.match(hidden, /id="gateway-stub"/);
  assert.equal(panel.standaloneVoicePreviewAvailable, false);
  assert.equal(panel.status, props.initialStatus);
  assert.equal(panel.mode, 'off');
  assert.equal(panel.dealerId, 'vera');
  assert.equal(panel.dirty, false);
  assert.equal(typeof panel.onModeChange, 'function');
  panel.onModeChange('rules');
  assert.equal(panel.dirty, false);
  const assigned = [];
  const previous = globalThis.window;
  globalThis.window = { location: { assign: path => assigned.push(path) } };
  try { panel.onPlayerChat(); }
  finally {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  }
  assert.deepEqual(assigned, [labUrl('/control/rehearsal?dealer=vera')]);
});

test('model tab keeps its own primary button and the chat link', () => {
  const { OpenClawWorkspace } = loadTs(new URL('./openclaw-workspace.tsx', import.meta.url));
  const { studioHref } = loadTs(new URL('./studio-types.ts', import.meta.url));
  const html = renderToStaticMarkup(React.createElement(OpenClawWorkspace, {}));
  assert.match(html, /<h1>OpenClaw<\/h1>/);
  assert.match(html, /aria-current="page"[^>]*>Agentmodeller/);
  assert.match(html, /Hämta aktuella val/);
  assert.match(html, new RegExp(`href="${studioHref('/control/openclaw', { tab: 'chat' }).replace(/[?]/g, '\\?')}"`));
  assert.doesNotMatch(html, /Spara projekt/);
});
