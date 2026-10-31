import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkAdminArtifacts, checkAdminBuild } from '../tools/check-admin-build.mjs';
import { themeModeBootstrap } from '../apps/studio/lib/theme-mode.mjs';

const tokens = ':root { --sg-text: #eeeeee; } :root.light { --sg-text: #111111; }';
const fixture = () => ({
  html: '<html class="dark"><head><script src="saved-mode.js"></script><link rel="stylesheet" href="controls.css"><link rel="stylesheet" href="palette.css"></head>',
  assets: new Map([['saved-mode.js', themeModeBootstrap], ['controls.css', '.button { display: flex; }'], ['palette.css', tokens]]),
  tokens,
});

test('compiled CSS can be renamed, combined, reformatted and placed in layers', () => {
  checkAdminArtifacts(fixture());
  const built = fixture();
  built.html = built.html.replace('<link rel="stylesheet" href="controls.css"><link rel="stylesheet" href="palette.css">', '<link rel="stylesheet" href="merged.css">');
  built.assets = new Map([['saved-mode.js', themeModeBootstrap], ['merged.css', `@layer base {${tokens}} .button{display:flex}`]]);
  checkAdminArtifacts(built);
});

test('missing, empty, malformed or uncompiled linked CSS fails build validation', () => {
  for (const key of ['palette.css', 'controls.css']) for (const css of ['', undefined, '.button {', '@import "missing.css";', '@apply flex;', '@tailwind utilities;']) {
    const built = fixture(); built.assets.set(key, css);
    assert.throws(() => checkAdminArtifacts(built));
  }
  const splitError = fixture();
  splitError.assets.set('controls.css', '.button {');
  splitError.assets.set('palette.css', 'display:flex; }' + tokens);
  assert.throws(() => checkAdminArtifacts(splitError), 'each linked stylesheet must parse on its own');
});

test('missing or overridden theme tokens fail build validation', () => {
  for (const css of ['.button{}', tokens + ':root.light { --sg-text: red; }']) {
    const built = fixture(); built.assets.set('palette.css', css);
    assert.throws(() => checkAdminArtifacts(built), /reaches linked CSS/);
  }
});

test('theme bootstrap must be present, current, synchronous and before CSS', () => {
  const built = fixture();
  const script = '<script src="saved-mode.js"></script>';
  for (const html of [built.html.replace(script, ''), built.html.replace(script, '') + script, built.html + script,
    built.html.replace('<script ', '<script defer '), built.html.replace('<script ', '<script async '),
    built.html.replace('<script ', '<script type="module" ')]) assert.throws(() => checkAdminArtifacts({ ...built, html }));
  built.assets.set('saved-mode.js', '/* stale */');
  assert.throws(() => checkAdminArtifacts(built), /saved theme/);
});
test('stylesheets must resolve and OS theme changes must not override saved mode', () => {
  for (const name of ['controls.css', 'palette.css']) {
    const built = fixture(); built.html = built.html.replace(name, 'missing.css');
    assert.throws(() => checkAdminArtifacts(built), /missing or empty/);
  }
  const built = fixture(); built.assets.set('palette.css', tokens + '@media(prefers-color-scheme:light){:root{color:white}}');
  assert.throws(() => checkAdminArtifacts(built), /saved choice/);
});

test('the build follows document links and rejects missing artifacts and paths outside its directory', () => {
  const directory = mkdtempSync(join(tmpdir(), 'admin-build-check-'));
  try {
    assert.throws(() => checkAdminBuild(directory), /ENOENT/);
    const built = fixture();
    built.assets.set('palette.css', readFileSync(new URL('../packages/ui/tokens.css', import.meta.url), 'utf8'));
    writeFileSync(join(directory, 'index.html'), built.html);
    for (const [file, text] of built.assets) if (file !== 'saved-mode.js') writeFileSync(join(directory, file), text);
    assert.throws(() => checkAdminBuild(directory), /saved-mode\.js/);
    writeFileSync(join(directory, 'saved-mode.js'), themeModeBootstrap);
    checkAdminBuild(directory);
    for (const href of ['missing.css', '../outside.css', '..%2foutside.css', 'https://elsewhere.invalid/palette.css']) {
      writeFileSync(join(directory, 'index.html'), built.html.replace('palette.css', href));
      assert.throws(() => checkAdminBuild(directory), /ENOENT|outside the build/);
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
