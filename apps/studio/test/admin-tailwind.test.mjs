import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Admin kör Tailwind 4 med Tailwind 3:s kaskad och mellanrum låsta (steg H, A3). Proven skyddar
// låsningen: ändras den syns det i varje Admin-sida, inte i något enskilt komponentprov.
const studio = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const app = resolve(studio, 'client/admin/app'), globals = readFileSync(resolve(app, 'globals.css'), 'utf8');

function sources(directory, pattern) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) return [];
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sources(path, pattern) : pattern.test(entry.name) ? [path] : [];
  });
}

test('the preflight and the utilities stay outside cascade layers, in Tailwind 3 order', () => {
  const imports = [...globals.matchAll(/^@import '([^']+)'([^;]*);$/gm)].map(([, path, rest]) => [path, rest.trim()]);
  assert.deepEqual(imports.map(([path]) => path),
    ['tailwindcss/theme.css', 'tailwindcss/preflight.css', './base.css', 'tailwindcss/utilities.css', 'tw-animate-css', './studio.css']);
  for (const [path, rest] of imports) {
    if (path !== 'tailwindcss/theme.css') assert.doesNotMatch(rest, /layer\(/, `${path} is not layered, so studio.css and the CSS modules compete as before`);
  }
  assert.doesNotMatch(globals, /@layer\s+(base|components|utilities)/);
});

test('every space-y and divide class in Admin has its Tailwind 3 rule', () => {
  const files = [...sources(resolve(studio, 'client/admin'), /\.tsx?$/), ...sources(resolve(studio, 'components'), /\.(?:tsx?|mjs)$/)];
  const used = new Set(files.flatMap(file => [...readFileSync(file, 'utf8').matchAll(/(?<![\w-])(space-[xy]-[\d.]+|divide-[a-z][\w-]*)(?![\w-])/g)].map(([, name]) => name)));
  assert.ok(used.has('space-y-2') && used.has('divide-y'), 'the scan finds the classes the kit uses');
  for (const name of used) {
    const escaped = name.replace(/[.]/g, '\\.');
    assert.match(globals, new RegExp(`\\.${escaped} > :not\\(\\[hidden\\]\\) ~ :not\\(\\[hidden\\]\\)`), `${name} has a Tailwind 3 sibling rule`);
    assert.match(globals, new RegExp(`:where\\([^)]*\\.${escaped}[,)]`), `${name} cancels Tailwind 4's last-child rule`);
  }
});

const built = resolve(studio, 'design-preview-build/admin/theme.css');
test('the built Admin stylesheet has no utility or base layer', { skip: !existsSync(built) && 'no Admin build' }, () => {
  const css = readFileSync(built, 'utf8');
  assert.doesNotMatch(css, /@layer\s+(base|components|utilities)\b/);
  assert.match(css, /\.space-y-2 > :not\(\[hidden\]\) ~ :not\(\[hidden\]\)/);
  assert.doesNotMatch(css, /@tailwind|@apply|@theme|@source|@custom-variant/, 'Tailwind compiled every directive');
});
