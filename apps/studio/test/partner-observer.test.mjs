import test from 'node:test';
import assert from 'node:assert/strict';
import { createPartnerObserver, partnerEnvironment } from '../lib/partner-observer.mjs';

// The partner reference (/api/inputs/reference) reads these settings. The
// observer only reports their status; it never opens a connection.
const env = { BETTALOTTO_PARTNER_KEY_ID: `ck_live_${'K'.repeat(24)}`, BETTALOTTO_PARTNER_SECRET: `cs_${'S'.repeat(43)}`, BETTALOTTO_PARTNER_PLAYER_ID: 'fixture-player' };

test('unconfigured status discloses only missing names', () => {
  const status = createPartnerObserver({ env: {} }).status();
  assert.equal(status.configured, false);
  assert.deepEqual(status.missing, Object.keys(env));
  assert.equal(status.endpoint, 'https://bettalotto.se/api/v1/events');
  assert.equal(status.scope, 'events or play'); assert.equal(status.replay, false);
});

test('configured status never contains the configured credentials', () => {
  const text = JSON.stringify(createPartnerObserver({ env }).status());
  assert.equal(JSON.parse(text).configured, true);
  for (const value of Object.values(env)) assert.ok(!text.includes(value));
});

test('placeholder, wrong-service and malformed credentials cannot claim configuration', () => {
  for (const [name, values] of [
    ['BETTALOTTO_PARTNER_KEY_ID', ['abc', 'ck_live_short', `ck_live_${'K'.repeat(23)}`, `ck_live_${'K'.repeat(25)}`, ` ${env.BETTALOTTO_PARTNER_KEY_ID}`, 'backoffice-row-uuid']],
    ['BETTALOTTO_PARTNER_SECRET', ['abc', 'cs_short', `gen_${'a'.repeat(48)}`, `cs_${'S'.repeat(42)}`, `cs_${'S'.repeat(44)}`, `${env.BETTALOTTO_PARTNER_SECRET}\n`]],
  ]) for (const value of values) {
    const status = createPartnerObserver({ env: { ...env, [name]: value } }).status();
    assert.equal(status.configured, false);
    assert.deepEqual(status.missing, []);
    assert.deepEqual(status.invalid, [name]);
    assert.ok(!JSON.stringify(status).includes(value));
  }
  const legacy = { LAB_PARTNER_KEY_ID: 'key', LAB_PARTNER_SECRET: 'secret', LAB_PARTNER_PLAYER_ID: 'player' };
  const status = createPartnerObserver({ env: legacy }).status();
  assert.equal(status.configured, false);
  assert.deepEqual(status.invalid, ['BETTALOTTO_PARTNER_KEY_ID', 'BETTALOTTO_PARTNER_SECRET']);
});

test('legacy lab names remain fallback-only and diagnostics always name Bettalotto settings', () => {
  const legacy = Object.fromEntries(Object.entries(env).map(([name, value]) => [name.replace('BETTALOTTO_PARTNER_', 'LAB_PARTNER_'), value]));
  assert.equal(createPartnerObserver({ env: legacy }).status().configured, true);
  const blankCanonical = createPartnerObserver({ env: { ...legacy, BETTALOTTO_PARTNER_KEY_ID: '' } }).status();
  assert.equal(blankCanonical.configured, false);
  assert.deepEqual(blankCanonical.missing, ['BETTALOTTO_PARTNER_KEY_ID']);
  assert.equal(createPartnerObserver({ env: { ...legacy, LAB_PARTNER_BASE_URL: 'https://evil.test', BETTALOTTO_PARTNER_BASE_URL: 'https://bettalotto.se' } }).status().configured, true);
  const invalidCanonical = createPartnerObserver({ env: { ...legacy, LAB_PARTNER_BASE_URL: 'https://bettalotto.se', BETTALOTTO_PARTNER_BASE_URL: 'https://evil.test' } }).status();
  assert.deepEqual(invalidCanonical.invalid, ['BETTALOTTO_PARTNER_BASE_URL']);
  // The partner reference signs with the key partnerEnvironment returns.
  const canonicalKey = `ck_live_${'C'.repeat(24)}`;
  assert.equal(partnerEnvironment({ ...legacy, ...env, BETTALOTTO_PARTNER_KEY_ID: canonicalKey }).BETTALOTTO_PARTNER_KEY_ID, canonicalKey);
  const unsupportedAlias = createPartnerObserver({ env: { BETTALOTTO_API: 'ambiguous-fixture-value' } }).status();
  assert.deepEqual(unsupportedAlias.missing, Object.keys(env));
});

test('URL allowlist rejects redirects, credentials, paths, lookalikes and arbitrary targets', () => {
  for (const value of ['http://bettalotto.se', 'https://bettalotto.se:444', 'https://bettalotto.se.evil.test', 'https://169.254.169.254', 'file:///etc/passwd', 'https://name:secret@bettalotto.se', 'https://bettalotto.se/other', 'https://bettalotto.se/?token=hidden', 'https://bettalotto.se/#private']) {
    const status = createPartnerObserver({ env: { ...env, BETTALOTTO_PARTNER_BASE_URL: value } }).status();
    assert.equal(status.configured, false, value); assert.equal(status.endpoint, null); assert.deepEqual(status.invalid, ['BETTALOTTO_PARTNER_BASE_URL']);
    assert.ok(!JSON.stringify(status).includes(value));
  }
  for (const value of ['http://localhost:4199', 'http://127.0.0.1:4199', 'https://[::1]:4199']) {
    assert.equal(createPartnerObserver({ env: { ...env, BETTALOTTO_PARTNER_BASE_URL: value } }).status().endpoint, `${value}/api/v1/events`);
  }
});

test('a cloud game origin must exactly match the operator configured HTTPS origin', () => {
  const gameOrigin = 'https://astrid.example.com';
  const cloudEnv = { ...env, BETTALOTTO_PARTNER_BASE_URL: gameOrigin, CROUPIER_GAME_ORIGIN: gameOrigin };
  const status = createPartnerObserver({ env: cloudEnv }).status();
  assert.equal(status.configured, true);
  assert.equal(status.endpoint, `${gameOrigin}/api/v1/events`);

  for (const [base, approved] of [
    [gameOrigin, undefined], [gameOrigin, 'https://other.example.com'],
    ['http://astrid.example.com', 'http://astrid.example.com'],
    ['https://astrid.example.com:444', 'https://astrid.example.com:444'],
    ['https://127.0.0.2', 'https://127.0.0.2'],
    ['https://astrid.local', 'https://astrid.local'],
    ['https://name:secret@astrid.example.com', 'https://name:secret@astrid.example.com'],
    ['https://astrid.example.com/path', 'https://astrid.example.com/path'],
  ]) {
    const status = createPartnerObserver({ env: { ...env, BETTALOTTO_PARTNER_BASE_URL: base,
      ...(approved === undefined ? {} : { CROUPIER_GAME_ORIGIN: approved }) } }).status();
    assert.equal(status.configured, false, `${base} / ${approved}`);
    assert.deepEqual(status.invalid, ['BETTALOTTO_PARTNER_BASE_URL']);
  }
});
