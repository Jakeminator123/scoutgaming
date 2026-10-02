import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as dashboard from '../lib/openclaw-dashboard.mjs';
import * as labUrls from '../lib/lab-url.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');
function load(file, overrides = {}) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  const output = transformSync(source, { filename: file, jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
  const module = { exports: {} };
  vm.runInNewContext(output.code, { module, exports: module.exports, Request, require: name => overrides[name] ?? (name === '../lib/openclaw-dashboard.mjs' ? dashboard : name === '../lib/lab-url.mjs' ? labUrls : require(name)) });
  return module.exports;
}
const { OpenClawWorkspace } = load('./openclaw-workspace.tsx');
const render = props => renderToStaticMarkup(React.createElement(OpenClawWorkspace, props));

test('portal has native dashboard and Render links, existing auth guidance and honest status', () => {
  const html = render();
  assert.ok(html.includes(`href="${dashboard.OPENCLAW_DASHBOARD_URL}"`));
  assert.ok(html.includes(`href="${dashboard.RENDER_CONTROL_URL}"`));
  assert.match(html, /Gateway-lösenord och webbläsargodkännande/);
  assert.match(html, /inte hälsotestats här/);
  assert.doesNotMatch(html, /<iframe|<button|<select|<form/);
});

test('saved clip policy remains in Studio and reload is explained without restart controls', () => {
  const html = render();
  assert.match(html, /standardval, tillåtna alternativ och regler/);
  assert.match(html, /normalt ingen omstart av Render/);
  assert.match(html, /Ladda om spelfliken mellan händer efter ändrad idlepolicy/);
  assert.match(html, /Gateway är fortsatt privat/);
});

test('invalid explicit dashboard is not replaced with the default or reflected', () => {
  const html = render({ dashboardUrl: 'https://user:secret@bad.invalid/?token=secret' });
  assert.match(html, /role="alert"/);
  assert.doesNotMatch(html, /Öppna OpenClaw-dashboard|bad.invalid|token=secret|user:secret/);
});

test('page authorizes request before rendering and never fetches project or video state', async () => {
  const incoming = new Headers({ host: 'localhost:4188', cookie: 'existing-session' });
  let authorized = false;
  const page = load('../app/openclaw/page.tsx', {
    'next/headers': { headers: async () => incoming },
    '@/lib/ui-server': { authorizeUiPage: async request => { assert.equal(request.url, 'http://localhost:4188/openclaw'); assert.equal(request.headers.get('cookie'), 'existing-session'); authorized = true; } },
    '@/components/openclaw-workspace': { OpenClawWorkspace },
  });
  assert.equal(page.dynamic, 'force-dynamic');
  await page.default();
  assert.equal(authorized, true);
  const denied = load('../app/openclaw/page.tsx', {
    'next/headers': { headers: async () => incoming },
    '@/lib/ui-server': { authorizeUiPage: async () => { throw new Error('denied'); } },
    '@/components/openclaw-workspace': { OpenClawWorkspace },
  });
  await assert.rejects(denied.default(), /denied/);
});
