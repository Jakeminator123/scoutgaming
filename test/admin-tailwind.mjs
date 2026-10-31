import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkAdminArtifacts, checkAdminBuild } from '../tools/check-admin-build.mjs';
import { themeModeBootstrap } from '../apps/studio/lib/theme-mode.mjs';

const tokens = ':root { --sg-text: #eeeeee; } :root.light { --sg-text: #111111; }';
const outlines = ['.outline-none', '.focus-visible\\:outline-none'].map(selector =>
  `${selector} { outline-style: none; &:not(.\\#) { outline: 2px solid transparent; outline-offset: 2px; } }`).join('\n');
const fixture = () => ({
  html: '<html class="dark"><head><script src="/admin/_assets/admin/theme-mode.js"></script><link rel="stylesheet" href="/admin/_assets/admin/app.css"><link rel="stylesheet" href="/admin/_assets/admin/theme.css"></head>',
  theme: tokens + outlines, app: '.button { display: flex; }', bootstrap: themeModeBootstrap, tokens,
});

test('compiled CSS remains valid after cosmetic formatting and layer changes', () => {
  checkAdminArtifacts(fixture());
  const built = fixture(); built.theme = `@layer utilities { ${built.theme} }`;
  checkAdminArtifacts(built);
});

test('flattened and nested focus selectors preserve the same accessible outline', () => {
  const declarations = 'outline: 2px solid transparent; outline-offset: 2px;';
  for (const variant of [':focus-visible', '']) {
    const nested = `.outline-none { &:not(.\\#) { ${declarations} } }
      .focus-visible\\:outline-none { &${variant} { &:not(.\\#) { ${declarations} } } }`;
    const flat = `.outline-none:not(.\\#) { ${declarations} }
      .focus-visible\\:outline-none${variant}:not(.\\#) { ${declarations} }`;
    for (const theme of [nested, flat]) checkAdminArtifacts({ ...fixture(), theme: tokens + theme });
    assert.throws(() => checkAdminArtifacts({ ...fixture(), theme: tokens + flat.replaceAll('2px solid transparent', 'none') }), /focus/);
  }
});

test('missing, empty or uncompiled CSS fails build validation', () => {
  for (const key of ['theme', 'app']) for (const css of ['', undefined, '@import "missing.css";', '@apply flex;', '@tailwind utilities;']) {
    assert.throws(() => checkAdminArtifacts({ ...fixture(), [key]: css }));
  }
});

test('missing or overridden theme tokens fail build validation', () => {
  for (const theme of [outlines, fixture().theme + ':root.light { --sg-text: red; }']) {
    assert.throws(() => checkAdminArtifacts({ ...fixture(), theme }), /reaches theme.css/);
  }
});

test('theme bootstrap must be present, current, synchronous and before CSS', () => {
  const built = fixture();
  const script = '<script src="/admin/_assets/admin/theme-mode.js"></script>';
  for (const html of [built.html.replace(script, ''), built.html.replace(script, '') + script,
    built.html.replace('<script ', '<script defer '), built.html.replace('<script ', '<script async '),
    built.html.replace('<script ', '<script type="module" ')]) assert.throws(() => checkAdminArtifacts({ ...built, html }));
  assert.throws(() => checkAdminArtifacts({ ...built, bootstrap: '/* stale */' }), /saved theme/);
});

test('both stylesheets must be linked and OS theme changes must not override saved mode', () => {
  for (const name of ['app.css', 'theme.css']) assert.throws(() => checkAdminArtifacts({ ...fixture(), html: fixture().html.replace(name, 'missing.css') }), /is linked/);
  assert.throws(() => checkAdminArtifacts({ ...fixture(), theme: fixture().theme + '@media(prefers-color-scheme:light){:root{color:white}}' }), /saved choice/);
});

test('loss of forced-colours focus or its specificity fails build validation', () => {
  for (const theme of [tokens, fixture().theme.replaceAll('2px solid transparent', 'none'),
    fixture().theme.replaceAll('&:not(.\\#)', '&')]) assert.throws(() => checkAdminArtifacts({ ...fixture(), theme }), /focus/);
});

test('an absent build or a missing artifact fails instead of skipping', () => {
  const directory = mkdtempSync(join(tmpdir(), 'admin-build-check-'));
  try {
    assert.throws(() => checkAdminBuild(directory), /ENOENT/);
    const built = fixture();
    for (const [file, key] of [['index.html', 'html'], ['theme.css', 'theme'], ['app.css', 'app']]) writeFileSync(join(directory, file), built[key]);
    assert.throws(() => checkAdminBuild(directory), /theme-mode\.js/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
