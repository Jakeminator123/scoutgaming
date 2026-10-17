import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createPartnerObserver } from '../lib/partner-observer.mjs';

const LOCAL = 'http://127.0.0.1:4188';
const env = { BETTALOTTO_PARTNER_KEY_ID: `ck_live_${'K'.repeat(24)}`, BETTALOTTO_PARTNER_SECRET: `cs_${'S'.repeat(43)}`, BETTALOTTO_PARTNER_PLAYER_ID: 'fixture-player' };
const request = (path = '/api/inputs/events', options) => new Request(`${LOCAL}${path}`, options);
const upstream = text => new Response(text, { headers: { 'Content-Type': 'text/event-stream' } });
const round = { type: 'round', op: 'start', requestId: 'round-1', version: 3, phase: 'decisions', balance: 42,
  events: [{ type: 'deal', to: 'box', box: 3, handIndex: 0, card: { r: '9', s: 'H' }, faceDown: false, shoeDraw: 17, clip: { action: 'deal-centre', prefer: 'astrid-centre-*', fallback: 'slide' } }] };
const wire = (data = round) => `id: 123\nevent: round\ndata: ${JSON.stringify(data)}\n\n`;
const entries = text => text.trim().split('\n\n').filter(Boolean).map(frame => ({ event: frame.split('\n')[0].slice(7), ...JSON.parse(frame.split('\n').find(line => line.startsWith('data: ')).slice(6)) }));

test('status and unconfigured stream disclose only missing names and never connect', async () => {
  let calls = 0;
  const observer = createPartnerObserver({ env: {}, fetchImpl() { calls++; throw new Error('must not connect'); } });
  const status = await (await observer.endpoint(request('/api/inputs'))).json();
  assert.equal(status.configured, false);
  assert.deepEqual(status.missing, Object.keys(env));
  assert.equal(status.endpoint, 'https://bettalotto.se/api/v1/events');
  assert.equal(status.scope, 'events or play'); assert.equal(status.replay, false);
  assert.equal((await observer.endpoint(request())).status, 503);
  assert.equal(calls, 0);
});

test('configured status is safe and cannot be used to select credentials or destination', async () => {
  let calls = 0;
  const observer = createPartnerObserver({ env, fetchImpl() { calls++; } });
  const response = await observer.endpoint(request('/api/inputs'));
  const text = await response.text();
  assert.equal(JSON.parse(text).configured, true);
  for (const value of Object.values(env)) assert.ok(!text.includes(value));
  for (const path of ['/api/inputs?url=https://evil.test', '/api/inputs/events?key=evil']) assert.equal((await observer.endpoint(request(path))).status, 400);
  assert.equal((await observer.endpoint(request('/api/inputs/events', { method: 'POST' }))).status, 405);
  assert.equal(calls, 0);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('placeholder, wrong-service and malformed credentials cannot claim configuration or connect', async () => {
  let calls = 0;
  for (const [name, values] of [
    ['BETTALOTTO_PARTNER_KEY_ID', ['abc', 'ck_live_short', `ck_live_${'K'.repeat(23)}`, `ck_live_${'K'.repeat(25)}`, ` ${env.BETTALOTTO_PARTNER_KEY_ID}`, 'backoffice-row-uuid']],
    ['BETTALOTTO_PARTNER_SECRET', ['abc', 'cs_short', `gen_${'a'.repeat(48)}`, `cs_${'S'.repeat(42)}`, `cs_${'S'.repeat(44)}`, `${env.BETTALOTTO_PARTNER_SECRET}\n`]],
  ]) for (const value of values) {
    const observer = createPartnerObserver({ env: { ...env, [name]: value }, fetchImpl() { calls++; } });
    const status = observer.status();
    assert.equal(status.configured, false);
    assert.deepEqual(status.missing, []);
    assert.deepEqual(status.invalid, [name]);
    assert.ok(!JSON.stringify(status).includes(value));
    assert.equal((await observer.endpoint(request())).status, 503);
  }
  const legacy = { LAB_PARTNER_KEY_ID: 'key', LAB_PARTNER_SECRET: 'secret', LAB_PARTNER_PLAYER_ID: 'player' };
  const status = createPartnerObserver({ env: legacy }).status();
  assert.equal(status.configured, false);
  assert.deepEqual(status.invalid, ['BETTALOTTO_PARTNER_KEY_ID', 'BETTALOTTO_PARTNER_SECRET']);
  assert.equal(calls, 0);
});

test('legacy lab names remain fallback-only and diagnostics always name Bettalotto settings', async () => {
  const legacy = Object.fromEntries(Object.entries(env).map(([name, value]) => [name.replace('BETTALOTTO_PARTNER_', 'LAB_PARTNER_'), value]));
  assert.equal(createPartnerObserver({ env: legacy }).status().configured, true);
  const blankCanonical = createPartnerObserver({ env: { ...legacy, BETTALOTTO_PARTNER_KEY_ID: '' } }).status();
  assert.equal(blankCanonical.configured, false);
  assert.deepEqual(blankCanonical.missing, ['BETTALOTTO_PARTNER_KEY_ID']);
  assert.equal(createPartnerObserver({ env: { ...legacy, LAB_PARTNER_BASE_URL: 'https://evil.test', BETTALOTTO_PARTNER_BASE_URL: 'https://bettalotto.se' } }).status().configured, true);
  const invalidCanonical = createPartnerObserver({ env: { ...legacy, LAB_PARTNER_BASE_URL: 'https://bettalotto.se', BETTALOTTO_PARTNER_BASE_URL: 'https://evil.test' } }).status();
  assert.deepEqual(invalidCanonical.invalid, ['BETTALOTTO_PARTNER_BASE_URL']);
  let actualKey;
  const canonicalKey = `ck_live_${'C'.repeat(24)}`;
  const observer = createPartnerObserver({ env: { ...legacy, ...env, BETTALOTTO_PARTNER_KEY_ID: canonicalKey }, fetchImpl: async url => {
    actualKey = url.searchParams.get('key'); return upstream('');
  } });
  await (await observer.endpoint(request())).text();
  assert.equal(actualKey, canonicalKey);
  const unsupportedAlias = createPartnerObserver({ env: { BETTALOTTO_API: 'ambiguous-fixture-value' } }).status();
  assert.deepEqual(unsupportedAlias.missing, Object.keys(env));
});

test('foreign origin and host never open an upstream connection', async () => {
  const observer = createPartnerObserver({ env, fetchImpl() { throw new Error('must not connect'); } });
  for (const headers of [{ Origin: 'https://evil.test' }, { Host: 'evil.test' }, { 'Sec-Fetch-Site': 'cross-site' }]) {
    assert.equal((await observer.endpoint(request('/api/inputs/events', { headers }))).status, 403);
  }
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

test('a cloud game origin must exactly match the operator configured HTTPS origin', async () => {
  const gameOrigin = 'https://astrid.example.com';
  const cloudEnv = { ...env, BETTALOTTO_PARTNER_BASE_URL: gameOrigin, CROUPIER_GAME_ORIGIN: gameOrigin };
  let fetched;
  const observer = createPartnerObserver({ env: cloudEnv, fetchImpl: async url => {
    fetched = url; return upstream(wire());
  } });
  assert.equal(observer.status().configured, true);
  await (await observer.endpoint(request())).text();
  assert.equal(fetched.origin, gameOrigin);
  assert.equal(fetched.pathname, '/api/v1/events');
  assert.equal(fetched.searchParams.get('playerId'), env.BETTALOTTO_PARTNER_PLAYER_ID);

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

test('events use the exact Partner HMAC query and read-only transport contract', async () => {
  let observed;
  const timestamp = 1800000000000;
  const observer = createPartnerObserver({ env, now: () => timestamp, fetchImpl: async (url, options) => {
    observed = { url, options }; return upstream(wire());
  } });
  const response = await observer.endpoint(request());
  const messages = entries(await response.text());
  const { url, options } = observed;
  assert.equal(url.origin, 'https://bettalotto.se'); assert.equal(url.pathname, '/api/v1/events');
  assert.equal(url.searchParams.get('playerId'), env.BETTALOTTO_PARTNER_PLAYER_ID);
  assert.equal(url.searchParams.get('key'), env.BETTALOTTO_PARTNER_KEY_ID);
  assert.equal(url.searchParams.get('ts'), '1800000000');
  assert.equal(url.searchParams.get('sig'), createHmac('sha256', env.BETTALOTTO_PARTNER_SECRET).update(`1800000000.GET./api/v1/events.${env.BETTALOTTO_PARTNER_PLAYER_ID}`).digest('hex'));
  assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'error'); assert.equal(options.cache, 'no-store'); assert.equal(options.credentials, 'omit');
  assert.equal(options.headers['Last-Event-ID'], undefined);
  assert.equal(response.headers.get('cache-control'), 'no-store, no-transform');
  assert.equal(messages[0].data.state, 'connecting'); assert.equal(messages[1].data.state, 'connected');
  const input = messages.find(entry => entry.event === 'input');
  assert.equal(input.source, 'partner'); assert.equal(input.kind, 'round'); assert.equal(input.upstreamId, '123'); assert.deepEqual(input.data, round);
  assert.equal(messages.at(-1).data.state, 'disconnected'); assert.equal(messages.at(-1).data.reason, 'upstream-closed');
  assert.ok(messages.filter(entry => entry.event === 'status').every(entry => entry.data.gap === true && entry.data.replay === false));
});

test('SSE comments, hello, UTF-8, multiline data and split CRLF do not fabricate rounds', async () => {
  const text = `: ping\r\nevent: hello\r\ndata: {"playerId":"fixture-player"}\r\n\r\n${wire({ ...round, requestId: 'runda-å' }).replaceAll('\n', '\r\n').replace('data: {', 'data: {\r\ndata: ')}`;
  const bytes = new TextEncoder().encode(text);
  const body = new ReadableStream({ start(controller) { for (const byte of bytes) controller.enqueue(new Uint8Array([byte])); controller.close(); } });
  const observer = createPartnerObserver({ env, fetchImpl: async () => new Response(body, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8' } }) });
  const messages = entries(await (await observer.endpoint(request())).text());
  const inputs = messages.filter(entry => entry.event === 'input');
  assert.equal(inputs.length, 1); assert.equal(inputs[0].data.requestId, 'runda-å');
});

test('upstream errors and redirects never expose signed URL or remote response body', async () => {
  for (const fetchImpl of [async url => { throw new Error(`private ${url}`); }, async () => new Response('secret upstream body', { status: 401 }), async () => new Response('redirect body', { status: 302, headers: { Location: 'https://evil.test' } }), async () => new Response('not SSE')]) {
    const observer = createPartnerObserver({ env, fetchImpl });
    const text = await (await observer.endpoint(request())).text();
    assert.ok(entries(text).some(entry => entry.data.state === 'error'));
    assert.doesNotMatch(text, /fixture-only-secret|ck_live_test_fixture|fixture-player|secret upstream|redirect body|https:\/\/evil|sig=/);
  }
});

test('invalid and unknown upstream payloads are explicit gaps without input or unknown fields', async () => {
  const observer = createPartnerObserver({ env, fetchImpl: async () => upstream(`event: round\ndata: not-json\n\nevent: chat\ndata: {}\n\n${wire({ ...round, key: 'must-not-leak' })}`) });
  const text = await (await observer.endpoint(request())).text();
  const messages = entries(text);
  assert.equal(messages.filter(entry => entry.event === 'input').length, 1);
  assert.ok(messages.some(entry => entry.data.reason === 'invalid-round'));
  assert.ok(messages.some(entry => entry.data.reason === 'unsupported-upstream-event'));
  assert.ok(!text.includes('must-not-leak'));
});

test('oversized frame is bounded and cancels upstream', async () => {
  let cancelled = false;
  const body = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(`event: round\ndata: ${'x'.repeat(70 * 1024)}`)); }, cancel() { cancelled = true; } });
  const observer = createPartnerObserver({ env, fetchImpl: async () => new Response(body, { headers: { 'Content-Type': 'text/event-stream' } }) });
  const messages = entries(await (await observer.endpoint(request())).text());
  assert.equal(messages.filter(entry => entry.event === 'input').length, 0);
  assert.equal(messages.at(-1).data.reason, 'payload-limit'); assert.equal(cancelled, true);
});

test('browser disconnect cancels upstream and frees the bounded connection slot', async () => {
  let cancelled = 0;
  const observer = createPartnerObserver({ env, maxConnections: 1, fetchImpl: async () => new Response(new ReadableStream({ cancel() { cancelled++; } }), { headers: { 'Content-Type': 'text/event-stream' } }) });
  const first = await observer.endpoint(request());
  assert.equal((await observer.endpoint(request())).status, 429);
  await first.body.cancel();
  const next = await observer.endpoint(request()); assert.equal(next.status, 200); await next.body.cancel();
  assert.equal(cancelled, 2);
});

test('request abort closes the response and cancels upstream', async () => {
  let cancelled = false;
  const abort = new AbortController();
  const observer = createPartnerObserver({ env, fetchImpl: async () => new Response(new ReadableStream({ cancel() { cancelled = true; } }), { headers: { 'Content-Type': 'text/event-stream' } }) });
  const response = await observer.endpoint(request('/api/inputs/events', { signal: abort.signal }));
  abort.abort();
  await response.text();
  assert.equal(cancelled, true);
});

test('observer never resumes or replays on another browser connection', async () => {
  const calls = [];
  const observer = createPartnerObserver({ env, fetchImpl: async (url, options) => { calls.push(options); return upstream(wire()); } });
  for (let attempt = 0; attempt < 2; attempt++) {
    const messages = entries(await (await observer.endpoint(request('/api/inputs/events', { headers: { 'Last-Event-ID': '123' } }))).text());
    assert.equal(messages[0].data.reason, 'observation-starts-now'); assert.equal(messages[0].data.gap, true);
  }
  assert.equal(calls.length, 2);
  assert.ok(calls.every(options => !Object.hasOwn(options.headers, 'Last-Event-ID')));
});

test('connection timeout, idle timeout and session cap terminate with explicit gap reasons', async () => {
  for (const reason of ['connect-timeout', 'upstream-timeout', 'session-limit']) {
    const options = { env, connectTimeoutMs: 1000, idleTimeoutMs: 1000, maxDurationMs: 1000 };
    if (reason === 'connect-timeout') options.connectTimeoutMs = 10;
    if (reason === 'upstream-timeout') options.idleTimeoutMs = 10;
    if (reason === 'session-limit') options.maxDurationMs = 10;
    options.fetchImpl = reason === 'connect-timeout'
      ? async (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }))
      : async () => new Response(new ReadableStream(), { headers: { 'Content-Type': 'text/event-stream' } });
    const observer = createPartnerObserver(options);
    // Keep the test process alive while the observer's deliberately unref'd
    // production cleanup timers expire.
    const keepAlive = setTimeout(() => {}, 1000);
    try {
      const messages = entries(await (await observer.endpoint(request())).text());
      assert.equal(messages.at(-1).data.reason, reason);
      assert.equal(messages.at(-1).data.gap, true);
    } finally { clearTimeout(keepAlive); }
  }
});
