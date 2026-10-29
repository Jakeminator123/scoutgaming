import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { applyThemeMode, readThemeMode, themeModeBootstrap } from '../lib/theme-mode.mjs';

// En tokenfil, ett lägesval: packages/ui/tokens.css är enda platsen där --sg-* får ett värde,
// och båda byggena (Next och Admin) läser den.
const studio = resolve(dirname(fileURLToPath(import.meta.url)), '..'), repo = resolve(studio, '../..');
const tokensPath = resolve(repo, 'packages/ui/tokens.css'), tokensCss = readFileSync(tokensPath, 'utf8');
const block = selector => {
  const start = tokensCss.indexOf(`\n${selector} {`);
  assert.ok(start >= 0, `${selector} finns i tokenfilen`);
  return tokensCss.slice(start, tokensCss.indexOf('\n}', start));
};
const declarations = css => [...css.matchAll(/(--sg-[\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]);
const dark = declarations(block(':root')), light = declarations(block(':root.light'));
const palette = mode => new Map([...dark, ...(mode === 'light' ? light : [])]);

function cssFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (['node_modules', 'design-preview-build', '.next', '.cache'].includes(entry.name) || entry.name.startsWith('.')) return [];
    const path = join(directory, entry.name);
    return entry.isDirectory() ? cssFiles(path) : entry.name.endsWith('.css') ? [path] : [];
  });
}

test('the token file defines each --sg-* once per mode, and light only overrides existing names', () => {
  for (const [mode, list] of [['dark', dark], ['light', light]]) {
    const names = list.map(([name]) => name);
    assert.deepEqual(names.filter((name, index) => names.indexOf(name) !== index), [], `${mode}: no token twice`);
  }
  const darkNames = new Set(dark.map(([name]) => name));
  assert.deepEqual(light.map(([name]) => name).filter(name => !darkNames.has(name)), [], 'light mode has no tokens of its own');
  assert.match(block(':root'), /color-scheme:\s*dark;/);
  assert.match(block(':root.light'), /color-scheme:\s*light;/);
  assert.doesNotMatch(tokensCss, /prefers-color-scheme/, 'the mode follows the saved choice, not the operating system');
});

test('no other stylesheet defines a token from the token file', () => {
  const names = new Set(dark.map(([name]) => name)), duplicates = [];
  for (const file of [...cssFiles(studio), ...cssFiles(resolve(repo, 'packages'))]) {
    if (file === tokensPath) continue;
    for (const [name] of declarations(readFileSync(file, 'utf8'))) {
      if (names.has(name)) duplicates.push(`${relative(repo, file)}: ${name}`);
    }
  }
  assert.deepEqual(duplicates, []);
});

test('both builds import the one token file and no stylesheet follows the operating system mode', () => {
  for (const file of ['app/scout-theme.css', 'client/admin/app/studio.css']) {
    const css = readFileSync(resolve(studio, file), 'utf8');
    const [, path] = css.match(/^@import '([^']+)';$/m) ?? [];
    assert.equal(path && resolve(studio, dirname(file), path), tokensPath, `${file} imports packages/ui/tokens.css`);
    assert.doesNotMatch(css, /prefers-color-scheme/, file);
  }
  assert.doesNotMatch(readFileSync(resolve(studio, 'client/admin/app/globals.css'), 'utf8'), /prefers-color-scheme|\.dark\s*\{/);
  for (const file of ['app/globals.css', 'app/scout-theme.css']) {
    assert.doesNotMatch(readFileSync(resolve(studio, file), 'utf8'), /data-theme/, `${file} uses the class on <html>`);
  }
});

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
    const localStorage = { getItem: () => { if (saved instanceof Error) throw saved; return saved; } };
    runInNewContext(themeModeBootstrap, { document, localStorage });
    assert.deepEqual([...document.classes].filter(name => name !== 'sg-font').sort(), expected, String(saved));
    assert.ok(document.classes.has('sg-font'), 'other classes on <html> stay');
  }
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

// Byggkontrollen kräver ett Admin-bygge (node tools/prepare-design-preview.mjs) och hoppas annars över.
const built = resolve(studio, 'design-preview-build/admin');
test('the built Admin runs the start script before its stylesheets and carries the token values',
  { skip: !existsSync(resolve(built, 'theme-mode.js')) && 'no Admin build' }, () => {
    const html = readFileSync(resolve(built, 'index.html'), 'utf8'), theme = readFileSync(resolve(built, 'theme.css'), 'utf8');
    assert.equal(readFileSync(resolve(built, 'theme-mode.js'), 'utf8').trim(), themeModeBootstrap);
    const script = html.indexOf('<script src="/admin/_assets/admin/theme-mode.js"></script>');
    assert.ok(script > 0 && script < html.indexOf('<link rel="stylesheet"'), 'the mode is set before the first stylesheet');
    assert.match(html, /<html lang="sv" class="dark">/, 'dark without JavaScript');
    assert.doesNotMatch(theme, /@import|prefers-color-scheme/);
    for (const [name, value] of [...dark, ...light]) assert.ok(theme.includes(`${name}: ${value};`), `${name} reaches theme.css`);
  });
