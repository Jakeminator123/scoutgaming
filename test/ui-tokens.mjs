import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';
import { applyThemeMode, readThemeMode, themeModeBootstrap } from '../apps/studio/lib/theme-mode.mjs';

// Measure real kit components after the production CSS cascade; token names and
// colour syntax are implementation details. Keyboard focus is covered by the
// existing css-focus-ring and admin-chart-focus browser suites.
const browserModule = process.env.CROUPIER_BROWSER_FIXTURE_MODULE;
const admin = fileURLToPath(new URL('../apps/studio/client/admin/', import.meta.url));
const require = createRequire(new URL('../apps/studio/client/package.json', import.meta.url));

test('rendered Admin text keeps WCAG AA contrast (4.5:1) on its actual surfaces in both themes', { skip: !browserModule }, async () => {
  const { build } = require('esbuild'), postcss = require('postcss'), tailwind = require('@tailwindcss/postcss');
  const globals = resolve(admin, 'app/globals.css');
  const css = (await postcss([tailwind({ base: admin })]).process(await readFile(globals, 'utf8'), { from: globals })).css;
  const { outputFiles } = await build({ stdin: { resolveDir: admin, loader: 'tsx', contents: `
    import {createRoot} from 'react-dom/client';
    import {Card,CardDescription,Button,Kbd,Badge} from './components/ui/kit';
    import {Field,Input} from './components/ui/form';
    import {Table,TableHeader,TableBody,TableRow,TableHead,TableCell} from './components/ui/table';
    createRoot(document.getElementById('root')).render(<Card title="Material" aside="Senast sparat">
      <CardDescription>Välj material för ditt bord.</CardDescription>
      <Field label="Namn" hint="Visas i Admin" error="Ange ett unikt namn"><Input defaultValue="Bord ett"/></Field>
      <Kbd>Enter</Kbd>
      {['primary','secondary','ghost','danger','link'].map(variant=><Button key={variant} variant={variant}>{variant}</Button>)}
      {['live','warn','info','danger'].map(tone=><Badge key={tone} tone={tone}>{tone}</Badge>)}
      <Table label="Material"><TableHeader><TableRow><TableHead>Namn</TableHead></TableRow></TableHeader>
        <TableBody><TableRow data-state="selected"><TableCell>Valt material</TableCell></TableRow></TableBody></Table>
    </Card>);
  ` }, bundle: true, write: false, jsx: 'automatic', format: 'iife', platform: 'browser',
    alias: { react: resolve(admin, '../node_modules/react'), 'react-dom': resolve(admin, '../node_modules/react-dom') },
    define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent' });
  const { chromium } = await import(pathToFileURL(browserModule).href);
  const browser = await chromium.launch({ headless: true, ...(process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL ? { channel: process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL } : {}) });
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/theme.css') return route.fulfill({ contentType: 'text/css', body: css });
      if (url.pathname === '/fixture.js') return route.fulfill({ contentType: 'text/javascript', body: outputFiles[0].text });
      return route.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><html class="' + url.searchParams.get('mode') + '"><head><link rel="stylesheet" href="/theme.css"></head><body class="preview-admin"><div id="root"></div><script src="/fixture.js"></script></body></html>' });
    });
    for (const mode of ['dark', 'light']) {
      await page.goto('https://text-contrast.fixture.invalid/?mode=' + mode);
      await page.getByRole('textbox', { name: 'Namn' }).waitFor();
      const samples = await page.locator('#root').evaluate(root => {
        // Canvas converts every supported CSS colour syntax to sRGB, including
        // alpha. Composite translucent surfaces over their rendered ancestors.
        const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
        const rgba = color => {
          context.clearRect(0, 0, 1, 1); context.fillStyle = color; context.fillRect(0, 0, 1, 1);
          const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
          return [r, g, b, a / 255];
        };
        const over = (fg, bg) => {
          const alpha = fg[3] + bg[3] * (1 - fg[3]);
          return alpha ? [...fg.slice(0, 3).map((value, index) => (value * fg[3] + bg[index] * bg[3] * (1 - fg[3])) / alpha), alpha] : [0, 0, 0, 0];
        };
        const luminance = rgb => rgb.map(value => {
          const c = value / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
        }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
        const measure = (element, text) => {
          let foreground = rgba(getComputedStyle(element).color), background = [0, 0, 0, 0];
          for (let node = element; node; node = node.parentElement) {
            const css = getComputedStyle(node), fill = rgba(css.backgroundColor);
            foreground = over(foreground, fill); background = over(background, fill);
            foreground[3] *= Number(css.opacity); background[3] *= Number(css.opacity);
          }
          foreground = over(foreground, [255, 255, 255, 1]).slice(0, 3);
          background = over(background, [255, 255, 255, 1]).slice(0, 3);
          const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
          return { text, ratio: (light + .05) / (dark + .05) };
        };
        const samples = [], walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const node = walker.currentNode;
          if (node.textContent.trim() && node.parentElement.checkVisibility()) samples.push(measure(node.parentElement, node.textContent.trim()));
        }
        for (const input of root.querySelectorAll('input')) samples.push(measure(input, input.value));
        return samples;
      });
      assert.ok(samples.length > 0, mode + ': rendered text was measured');
      for (const { text, ratio } of samples) assert.ok(ratio >= 4.5, `${mode}: ${text} is ${ratio.toFixed(2)}:1`);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
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
