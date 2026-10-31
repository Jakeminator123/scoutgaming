import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, 'package.json'));
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

// Load the real TS/TSX modules, preserving React's server-rendering semantics.
const modules = new Map();
function load(path) {
  const filename = [path, path + '.ts', path + '.tsx'].find(existsSync);
  if (!filename) throw Error('Missing fixture module: ' + path);
  if (modules.has(filename)) return modules.get(filename).exports;
  const module = { exports: {} };
  modules.set(filename, module);
  const source = ts.transpileModule(readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const localRequire = spec => spec.startsWith('@/') ? load(resolve(root, spec.slice(2)))
    : spec.startsWith('.') ? load(resolve(dirname(filename), spec)) : require(spec);
  vm.runInThisContext('(function(require,module,exports){' + source + '\n})', { filename })(localRequire, module, module.exports);
  return module.exports;
}

const { observeDecorativeMotion } = load(resolve(root, 'lib/decorative-motion.ts'));

function harness({ matches = true, touches = 0, hidden = false, observer = true } = {}) {
  const globals = Object.fromEntries(['window', 'document', 'navigator', 'IntersectionObserver'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const win = new EventTarget(), doc = new EventTarget(), media = new EventTarget();
  media.matches = matches; doc.hidden = hidden;
  win.matchMedia = () => media;
  let observed, callback, disconnected = false;
  class Observer {
    constructor(fn) { callback = fn; }
    observe(element) { observed = element; }
    disconnect() { disconnected = true; }
  }
  if (observer) win.IntersectionObserver = Observer;
  const nav = { maxTouchPoints: touches };
  for (const [key, value] of Object.entries({ window: win, document: doc, navigator: nav, IntersectionObserver: Observer })) {
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  const changes = [], element = {}, stop = observeDecorativeMotion(element, value => changes.push(value));
  return {
    changes, element, media, nav, doc, win, get observed() { return observed; }, get disconnected() { return disconnected; },
    visible(value) { callback?.([{ target: element, isIntersecting: value }]); },
    visibilityBatch(values) { callback?.(values.map(isIntersecting => ({ target: element, isIntersecting }))); },
    event(target, name) { target.dispatchEvent(new Event(name)); },
    stop,
    restore() { stop(); for (const [key, descriptor] of Object.entries(globals)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    } },
  };
}

test('server-rendered landing exposes lobby actions without decorative playback', () => {
  const { default: Home } = load(resolve(root, 'app/page.tsx'));
  const html = renderToStaticMarkup(React.createElement(Home));
  assert.match(html, /<h1\b[^>]*>[\s\S]*?\S[\s\S]*?<\/h1>/);
  const entries = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)]
    .filter(([,attrs,body]) => /Välj bolag|Blackjack/.test(body) || /aria-label="Välj bolag/.test(attrs));
  assert.ok(entries.length > 0, 'a lobby action remains available before hydration');
  for (const [,attrs] of entries) assert.match(attrs, /href="\/lobby"/);
  assert.doesNotMatch(html, /href="\/play"/);
  assert.doesNotMatch(html, /<video\b|<canvas\b/);
});

test('late hydration requires actual visibility before creating decorative playback', () => {
  const h = harness();
  try {
    assert.equal(h.observed, h.element);
    assert.deepEqual(h.changes, [false], 'SSR/initial mount has no decoder');
    h.event(h.win, 'pageshow'); h.event(h.win, 'resize'); h.visible(false);
    assert.deepEqual(h.changes, [false], 'restored scroll outside the decoration stays idle');
    h.visible(true);
    assert.deepEqual(h.changes, [false, true]);
    h.visible(false);
    assert.deepEqual(h.changes, [false, true, false], 'scrolling away tears down playback');
    h.visibilityBatch([true, false]);
    assert.deepEqual(h.changes, [false, true, false], 'a late entry cannot overwrite a newer exit');
    h.visibilityBatch([false, true]);
    assert.deepEqual(h.changes, [false, true, false, true], 'a newer entry can enable visible decoration');
  } finally { h.restore(); }
});

test('mobile, touch hybrids, reduced motion and missing visibility support never activate decoration', () => {
  for (const settings of [{ matches: false }, { touches: 5 }, { hidden: true }, { observer: false }]) {
    const h = harness(settings);
    try { h.visible(true); h.event(h.win, 'pageshow'); assert.deepEqual(h.changes, [false]); }
    finally { h.restore(); }
  }
});

test('desktop resize, motion preference and tab visibility release existing playback', () => {
  const h = harness();
  try {
    h.visible(true);
    h.media.matches = false; h.event(h.media, 'change');
    h.media.matches = true; h.event(h.media, 'change');
    h.doc.hidden = true; h.event(h.doc, 'visibilitychange');
    h.doc.hidden = false; h.event(h.doc, 'visibilitychange');
    assert.deepEqual(h.changes, [false, true, false, true, false, true]);
  } finally { h.restore(); }
});

test('history pagehide stops playback and pageshow rechecks current media before resuming', () => {
  const h = harness();
  try {
    h.visible(true); h.event(h.win, 'pagehide');
    h.media.matches = false; h.event(h.win, 'pageshow');
    assert.deepEqual(h.changes, [false, true, false]);
    h.media.matches = true; h.event(h.media, 'change');
    assert.deepEqual(h.changes, [false, true, false, true]);
    h.stop(); assert.equal(h.disconnected, true);
    h.media.matches = false; h.event(h.media, 'change'); h.event(h.win, 'pagehide'); h.visible(false);
    assert.deepEqual(h.changes, [false, true, false, true], 'unmount removes listeners');
  } finally { h.restore(); }
});


test('hydrated landing actions enter the public lobby', { skip: !process.env.CROUPIER_BROWSER_FIXTURE_MODULE }, async () => {
  const { build } = createRequire(new URL('../../studio/package.json', import.meta.url))('esbuild');
  const { outputFiles } = await build({ stdin: { resolveDir: root, loader: 'tsx', contents: `
    import {createRoot} from 'react-dom/client';import Home from './app/page';
    createRoot(document.getElementById('root')).render(<Home/>);
  ` }, bundle: true, write: false, jsx: 'automatic', format: 'iife', platform: 'browser',
    alias: { '@': root }, define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' }, logLevel: 'silent' });
  const { chromium } = await import(pathToFileURL(process.env.CROUPIER_BROWSER_FIXTURE_MODULE).href);
  const browser = await chromium.launch({ headless: true, ...(process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL ? { channel: process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1080 }, reducedMotion: 'no-preference' }), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/fixture.js') return route.fulfill({ contentType: 'text/javascript', body: outputFiles[0].text });
      if (url.pathname !== '/') return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><div id="root"></div><script src="/fixture.js"></script>' });
    });
    await page.goto('https://landing.fixture.invalid/');
    // Wait for the animated CTA itself, rather than another decoration's video.
    const animatedActions = page.locator('a').filter({ has: page.locator('video') });
    await animatedActions.first().waitFor({ state: 'attached', timeout: 10000 });
    for (const action of await animatedActions.all()) assert.equal(await action.getAttribute('href'), '/lobby');
    assert.deepEqual(errors, []);
    assert.equal(await page.locator('a[href="/play"]').count(), 0);
  } finally { await browser.close(); }
});
