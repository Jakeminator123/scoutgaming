import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { brandingApiBase, PartnerAppearanceLoader } from '../components/partner-appearance-loader.mjs';

test('branding api base sits beside the partner snapshot action', () => {
  assert.equal(brandingApiBase('/studio/api/partner/snapshot'), '/studio/api/partner');
  assert.equal(brandingApiBase('/api/partner/snapshot'), '/api/partner');
  assert.equal(brandingApiBase('/studio/api/partner-preview'), '/studio/api/partner-preview');
  assert.equal(brandingApiBase(undefined), '');
});

test('loader renders a status line on the server and no lime before the first read', () => {
  const html = renderToStaticMarkup(React.createElement(PartnerAppearanceLoader, {
    apiBase: '/studio/api/partner/snapshot', operatorSlug: 'demo-north',
  }));
  assert.match(html, /Hämtar utseende/);
  assert.doesNotMatch(html, /sg-btn-primary|Spara utseende/);
});
