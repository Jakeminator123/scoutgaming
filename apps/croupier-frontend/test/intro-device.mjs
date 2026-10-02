import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const source = require('typescript').transpileModule(
  readFileSync(new URL('../lib/intro-device.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: require('typescript').ModuleKind.CommonJS } },
).outputText;
const actual = { exports: {} };
vm.runInThisContext('(function(exports){' + source + '\n})')(actual.exports);
const { isDesktopIntroDevice, observeDesktopIntro } = actual.exports;
const pc = { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140 Safari/537.36', platform: 'Win32', maxTouchPoints: 0 };

test('computers retain the intro, including touchscreen laptops', () => {
  for (const nav of [pc, { ...pc, maxTouchPoints: 10 },
    { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', maxTouchPoints: 0 },
    { userAgent: 'Mozilla/5.0 (X11; Linux x86_64)', platform: 'Linux x86_64', maxTouchPoints: 0 }]) {
    assert.equal(isDesktopIntroDevice(nav), true);
  }
});

test('phones and tablets stay excluded, including iPad desktop mode and mobile client hints', () => {
  for (const nav of [
    { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Mobile/15E148', platform: 'iPhone', maxTouchPoints: 5 },
    { userAgent: 'Mozilla/5.0 (Linux; Android 15) Chrome/140', platform: 'Linux armv8l', maxTouchPoints: 5 },
    { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', maxTouchPoints: 5 },
    { ...pc, userAgentData: { mobile: true } },
    { userAgent: '', platform: '', maxTouchPoints: 0 },
  ]) assert.equal(isDesktopIntroDevice(nav), false);
});

function harness({ nav = pc, scrollY = 0, hidden = false, motion = true } = {}) {
  const saved = Object.fromEntries(['window', 'document', 'navigator'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const win = new EventTarget(), doc = new EventTarget(), media = new EventTarget();
  // A narrow desktop window must not become a phone.
  win.innerWidth = 700; win.scrollY = scrollY; doc.hidden = hidden; media.matches = motion;
  win.matchMedia = () => media;
  for (const [key, value] of Object.entries({ window: win, document: doc, navigator: nav })) {
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  const changes = [], stop = observeDesktopIntro(value => changes.push(value));
  return { win, doc, media, changes, stop,
    event(target, name) { target.dispatchEvent(new Event(name)); },
    restore() { stop(); for (const [key, descriptor] of Object.entries(saved)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    } },
  };
}

test('desktop arrival enables playback regardless of window width; mobile never enables it', () => {
  for (const nav of [pc, { ...pc, userAgentData: { mobile: true } }]) {
    const h = harness({ nav });
    try { assert.deepEqual(h.changes, [nav === pc]); }
    finally { h.restore(); }
  }
});

test('restored scroll, hidden arrival and reduced motion never schedule a late intro', () => {
  for (const settings of [{ scrollY: 200 }, { hidden: true }, { motion: false }]) {
    const h = harness(settings);
    try {
      h.win.scrollY = 0; h.doc.hidden = false; h.media.matches = true;
      h.event(h.win, 'pageshow'); h.event(h.doc, 'visibilitychange'); h.event(h.media, 'change');
      assert.deepEqual(h.changes, [false]);
    } finally { h.restore(); }
  }
});

test('browsing, hiding or changing motion cancels playback and cannot re-open the overlay', () => {
  for (const action of ['wheel', 'touchstart', 'scroll', 'pagehide', 'hidden', 'motion']) {
    const h = harness();
    try {
      if (action === 'hidden') { h.doc.hidden = true; h.event(h.doc, 'visibilitychange'); }
      else if (action === 'motion') { h.media.matches = false; h.event(h.media, 'change'); }
      else { if (action === 'scroll') h.win.scrollY = 50; h.event(h.win, action); }
      h.doc.hidden = false; h.media.matches = true; h.win.scrollY = 0;
      h.event(h.win, 'pageshow'); h.event(h.media, 'change');
      assert.deepEqual(h.changes, [true, false], action);
      h.stop(); h.event(h.win, 'wheel');
      assert.deepEqual(h.changes, [true, false], 'unmount removes admission listeners');
    } finally { h.restore(); }
  }
});
