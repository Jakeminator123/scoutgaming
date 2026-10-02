import test from 'node:test';
import assert from 'node:assert/strict';
import { OPENCLAW_DASHBOARD_URL, openClawDashboardUrl } from '../lib/openclaw-dashboard.mjs';

test('missing status uses only the documented native dashboard', () => {
  assert.equal(openClawDashboardUrl(), OPENCLAW_DASHBOARD_URL);
  assert.equal(openClawDashboardUrl(OPENCLAW_DASHBOARD_URL), OPENCLAW_DASHBOARD_URL);
});

test('explicit invalid configuration fails closed', () => {
  for (const value of [null, '', false, {}, 'not a url', 'http://croupier-lab-director.onrender.com/openclaw/', 'https://other.onrender.com/openclaw/']) {
    assert.equal(openClawDashboardUrl(value), null);
  }
});

test('credentials, query tokens and fragments cannot reach the link', () => {
  for (const value of [OPENCLAW_DASHBOARD_URL + '?token=secret', OPENCLAW_DASHBOARD_URL + '#secret', OPENCLAW_DASHBOARD_URL.replace('https://', 'https://user:password@'), OPENCLAW_DASHBOARD_URL.replace('https://', 'https://user@')]) {
    assert.equal(openClawDashboardUrl(value), null);
  }
});

test('path normalization and encoded tricks cannot change the pinned route', () => {
  for (const path of ['/openclaw', '/openclaw//', '/%6fpenclaw/', '/x/../openclaw/', '/openclaw/%2e%2e/', '/openclaw/%2f', '/openclaw/?', '/openclaw/#']) {
    assert.equal(openClawDashboardUrl('https://croupier-lab-director.onrender.com' + path), null);
  }
});
