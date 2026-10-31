import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { applyThemeMode, readThemeMode, themeModeBootstrap } from '../apps/studio/lib/theme-mode.mjs';

// Source tests need no build: contrast, saved mode and blocked storage.
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tokensPath = resolve(repo, 'packages/ui/tokens.css'), tokensCss = readFileSync(tokensPath, 'utf8');
const { parse } = createRequire(new URL('../apps/studio/client/package.json', import.meta.url))('postcss');
const tokens = parse(tokensCss);
const declarations = selector => {
  const values = [];
  tokens.walkRules(rule => {
    if (!rule.selectors.includes(selector)) return;
    rule.each(node => { if (node.type === 'decl' && node.prop.startsWith('--sg-')) values.push([node.prop, node.value]); });
  });
  return values;
};
const dark = declarations(':root'), light = declarations(':root.light');
const palette = mode => new Map([...dark, ...(mode === 'light' ? light : [])]);

function luminance(hex) {
  assert.match(hex, /^#[0-9a-f]{6}$/i, `${hex} is an opaque colour`);
  const [r, g, b] = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
    .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return r * .2126 + g * .7152 + b * .0722;
}
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };

test('text keeps WCAG AA contrast (4.5:1) on every surface in both modes', () => {
  for (const mode of ['dark', 'light']) {
    const colours = palette(mode);
    const pairs = [
      ...['--sg-text', '--sg-muted', '--sg-accent-text', '--sg-danger-text']
        .flatMap(text => ['--sg-bg', '--sg-surface', '--sg-surface-2', '--sg-field'].map(surface => [text, surface])),
      ['--sg-side-text', '--sg-side'], ['--sg-side-muted', '--sg-side'], ['--sg-on-accent', '--sg-lime'],
    ];
    for (const [text, surface] of pairs) {
      const ratio = contrast(colours.get(text), colours.get(surface));
      assert.ok(ratio >= 4.5, `${mode}: ${text} on ${surface} is ${ratio.toFixed(2)}:1`);
    }
  }
});

test('the mark (selected tab edge, focus ring) keeps 3:1 against every surface in both modes (WCAG 1.4.11)', () => {
  for (const mode of ['dark', 'light']) {
    const colours = palette(mode);
    for (const surface of ['--sg-bg', '--sg-surface', '--sg-surface-2', '--sg-field', '--sg-hover']) {
      const ratio = contrast(colours.get('--sg-mark'), colours.get(surface));
      assert.ok(ratio >= 3, `${mode}: --sg-mark on ${surface} is ${ratio.toFixed(2)}:1`);
    }
  }
});

function fakeDocument(initial = []) {
  const classes = new Set(initial);
  return { documentElement: { classList: {
    add: (...names) => names.forEach(name => classes.add(name)),
    remove: (...names) => names.forEach(name => classes.delete(name)),
    contains: name => classes.has(name),
  } }, classes };
}

test('the start script sets exactly one mode class: light only when that choice is saved', () => {
  const cases = [['light', ['light']], ['dark', ['dark']], [null, ['dark']], ['system', ['dark']], [Error('blocked'), ['dark']]];
  for (const [saved, expected] of cases) {
    const document = fakeDocument(['dark', 'sg-font']);
    const localStorage = { getItem: key => { if (saved instanceof Error) throw saved; return key === 'sg-theme' ? saved : null; } };
    runInNewContext(themeModeBootstrap, { document, localStorage });
    assert.deepEqual([...document.classes].filter(name => name !== 'sg-font').sort(), expected, String(saved));
    assert.ok(document.classes.has('sg-font'), 'other classes on <html> stay');
  }
});

function fakeStorage(entries, { blockWrites = false } = {}) {
  const map = new Map(Object.entries(entries));
  const write = fn => (...args) => { if (blockWrites) throw Error('blocked'); fn(...args); };
  return { map, getItem: key => map.has(key) ? map.get(key) : null,
    setItem: write((key, value) => map.set(key, String(value))), removeItem: write(key => map.delete(key)) };
}

test('the start script moves the old portal choice to sg-theme once and removes the old key', () => {
  const cases = [
    // [stored before, mode, stored after]
    [{ 'sg-partner-theme': 'light' }, 'light', { 'sg-theme': 'light' }],
    [{ 'sg-partner-theme': 'dark' }, 'dark', {}],
    [{ 'sg-theme': 'dark', 'sg-partner-theme': 'light' }, 'dark', { 'sg-theme': 'dark' }],
    [{ 'sg-theme': 'light', 'sg-partner-theme': 'dark' }, 'light', { 'sg-theme': 'light' }],
    [{ 'sg-theme': 'light' }, 'light', { 'sg-theme': 'light' }],
  ];
  for (const [before, mode, after] of cases) {
    const document = fakeDocument(['dark']), localStorage = fakeStorage(before);
    runInNewContext(themeModeBootstrap, { document, localStorage });
    assert.deepEqual([...document.classes], [mode], JSON.stringify(before));
    assert.deepEqual(Object.fromEntries(localStorage.map), after, JSON.stringify(before));
  }
  const document = fakeDocument(['dark']);
  runInNewContext(themeModeBootstrap, { document, localStorage: fakeStorage({ 'sg-partner-theme': 'light' }, { blockWrites: true }) });
  assert.deepEqual([...document.classes], ['light'], 'a blocked write still shows the moved choice');
});

test('a change applies at once, is saved under sg-theme and survives blocked storage', () => {
  const document = fakeDocument(['dark']), saved = [];
  assert.equal(applyThemeMode('light', { document, storage: { setItem: (key, value) => saved.push([key, value]) } }), 'light');
  assert.equal(readThemeMode(document), 'light');
  assert.deepEqual(saved, [['sg-theme', 'light']]);
  assert.equal(applyThemeMode('sepia', { document, storage: { setItem() { throw Error('blocked'); } } }), 'dark');
  assert.equal(readThemeMode(document), 'dark');
  assert.deepEqual([...document.classes], ['dark']);
});
