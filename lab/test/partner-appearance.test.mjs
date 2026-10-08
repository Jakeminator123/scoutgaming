import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TABLE_COLOR_BRANDING_KEY } from '../lib/partner-branding-api.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');
const fileUrl = new URL('../components/partner-appearance.tsx', import.meta.url);
const compiled = transformSync(readFileSync(fileUrl, 'utf8'), {
  filename: fileURLToPath(fileUrl),
  jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } },
  module: { type: 'commonjs' },
});
const module = { exports: {} };
const localRequire = createRequire(fileUrl);
vm.runInNewContext(compiled.code, {
  module,
  exports: module.exports,
  require: name => name.endsWith('.module.css') || name.endsWith('.css')
    ? { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) }
    : localRequire(name),
}, { filename: fileURLToPath(fileUrl) });

test('appearance renders a disabled lane field and exactly one lime save button', () => {
  const html = renderToStaticMarkup(React.createElement(module.exports.PartnerAppearance, {
    apiBase: '/studio/api/partner',
    operatorSlug: 'demo-north',
    initial: {
      operatorId: 'operator-demo-north',
      packageRevision: 4,
      lanes: ['mobile-phone'],
      branding: { [TABLE_COLOR_BRANDING_KEY]: '#112233', name: 'North' },
      adjustable: ['table.color'],
    },
  }));
  assert.match(html, /Tillåts inte av lanen/);
  assert.equal((html.match(/sg-btn-primary/g) || []).length, 1);
  assert.match(html, /class="sg-btn sg-btn-primary"/);
  assert.match(html, /Spara utseende/);
  assert.equal((html.match(/<button\b/g) || []).length, 1);
  assert.match(html, /type="color"/);
  assert.match(html, /#112233/);
  assert.match(html, /Revision 4/);
  assert.match(html, /mobile-phone/);
  assert.match(html, /disabled=""/);
});
