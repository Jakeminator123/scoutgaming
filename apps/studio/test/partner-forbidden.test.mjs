import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { partnerForbiddenText } from '../lib/partner-words.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');

// app/forbidden.tsx is what Next renders with HTTP 403 (experimental.authInterrupts).
// It has no data: the address names the view and its permission, nothing else.
test('the 403 page names the view and permission from the address and links back to the company portal', () => {
  const team = partnerForbiddenText('/partner/johns-spelbolag/team');
  assert.equal(team.title, 'Åtkomst nekad (403)');
  assert.match(team.body, /^Sidan Team kräver behörigheten team\.read/); assert.match(team.body, /inte medlem i bolaget/);
  assert.deepEqual([team.link, team.linkText], ['/partner/johns-spelbolag', 'Till Partnerportalen']);
  assert.match(partnerForbiddenText('/studio/partner/johns-spelbolag/reports').body, /Sidan Ekonomi kräver behörigheten reports\.read/);
  assert.match(partnerForbiddenText('/partner/johns-spelbolag/transactions').body, /Ekonomi.*reports\.read/, 'Kevins gamla adress namnger den nya vyn');
  assert.match(partnerForbiddenText('/partner/johns-spelbolag/players', 'en').body, /^The page Players requires the permission players\.read/);
  assert.match(partnerForbiddenText('/partner/johns-spelbolag').body, /Sidan Översikt kräver behörigheten overview\.read/);
  for (const pathname of ['/partner', '/admin/rooms', '', undefined, '/partner/not a slug']) {
    const text = partnerForbiddenText(pathname);
    assert.equal(text.body, 'Kontot får inte öppna den här sidan. Be bolagets administratör eller Scoutgaming om åtkomst.', String(pathname));
    assert.equal(text.link, '/partner');
  }
  assert.doesNotMatch(JSON.stringify(partnerForbiddenText('/partner/x/team')), /shared_table_audit|operator_memberships/);
});

test('app/forbidden.tsx renders the text as an alert with the portal link and nothing else', () => {
  const url = new URL('../app/forbidden.tsx', import.meta.url);
  const { code } = transformSync(readFileSync(url, 'utf8'), { filename: 'forbidden.tsx',
    jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
  const module = { exports: {} }, localRequire = createRequire(url);
  vm.runInNewContext(code, { module, exports: module.exports, require: name => name === 'react' ? React : name === 'react/jsx-runtime' ? require('react/jsx-runtime') : localRequire(name) }, { filename: 'forbidden.tsx' });
  const html = renderToStaticMarkup(React.createElement(module.exports.default));
  assert.match(html, /role="alert"/); assert.match(html, />403</); assert.match(html, /Åtkomst nekad \(403\)/);
  assert.match(html, /href="\/partner"[^>]*>Till Partnerportalen</, 'before hydration the address is unknown, so the link is the portal root');
  assert.doesNotMatch(html, /<script|http/);
});
