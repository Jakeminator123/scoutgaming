import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');
const sourceUrl = new URL('../components/partner-login.tsx', import.meta.url);

function loadPartnerLogin() {
  const output = transformSync(readFileSync(sourceUrl, 'utf8'), {
    filename: fileURLToPath(sourceUrl),
    jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } },
    module: { type: 'commonjs' },
  });
  const module = { exports: {} };
  vm.runInNewContext(output.code, {
    module, exports: module.exports,
    require: name => {
      if (name.endsWith('.module.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
      return require(name);
    },
  });
  return module.exports;
}

const { PartnerLogin, internalLoginHref } = loadPartnerLogin();

test('internal administrators are sent to the N1 login with a return to /partner', () => {
  assert.equal(internalLoginHref('/studio/api/partner'), '/studio/login?returnTo=%2Fpartner');
  assert.equal(internalLoginHref('/api/partner'), '/login?returnTo=%2Fpartner');
  for (const authBase of ['/studio/api/partner', '/api/partner']) {
    const html = renderToStaticMarkup(React.createElement(PartnerLogin, { authBase }));
    assert.ok(html.includes(`href="${internalLoginHref(authBase).replace(/&/g, '&amp;')}"`), html);
    assert.match(html, /Logga in som intern administratör/);
    assert.ok(html.includes(`action="${authBase}/login"`), 'the operator form still posts to the partner login');
  }
});

test('the failed-login notice stays generic and does not reveal the account role', () => {
  const source = readFileSync(sourceUrl, 'utf8');
  const notice = source.match(/status === 401 \|\| status === 400\) return '([^']+)'/);
  assert.ok(notice, 'the 401/400 notice is defined');
  assert.match(notice[1], /^Inloggningen kunde inte verifieras\./);
  assert.doesNotMatch(notice[1], /\b(admin\w*|roll|role)\b/i);
});
