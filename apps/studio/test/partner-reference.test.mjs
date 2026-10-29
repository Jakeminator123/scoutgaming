import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createPartnerReference } from '../lib/partner-reference.mjs';
import { createPartnerTrace, appendPartnerTrace, exportPartnerTrace, TRACE_RECORD_LIMIT, TRACE_BYTE_LIMIT } from '../lib/partner-trace.mjs';

const LOCAL = 'http://127.0.0.1:4188/api/inputs/reference';
const ORIGIN = 'https://bettalotto.se';
const env = { BETTALOTTO_PARTNER_KEY_ID: `ck_live_${'K'.repeat(24)}`, BETTALOTTO_PARTNER_SECRET: `cs_${'S'.repeat(43)}`, BETTALOTTO_PARTNER_PLAYER_ID: 'reference-fixture' };
const request = action => new Request(LOCAL, action ? { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:4188' }, body: JSON.stringify({ action }) } : undefined);
const service = fetchImpl => createPartnerReference({ env, token: () => 'generation-fixture', fetchImpl, now: () => 123456000 });

test('initial status never contacts an upstream and exposes neither credential pair nor generations token', async () => {
  const api = service(() => { throw Error('unexpected network'); });
  const response = await api.endpoint(request());
  const raw = await response.text(), status = JSON.parse(raw);
  assert.equal(status.configured, true); assert.equal(status.playerId, 'reference-fixture');
  assert.equal(status.mappingConfigured, true);
  for (const secret of [env.BETTALOTTO_PARTNER_KEY_ID, env.BETTALOTTO_PARTNER_SECRET, 'generation-fixture']) assert.ok(!raw.includes(secret));
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('ping and launch sign fixed endpoints and launch always uses the observer player identity', async () => {
  const calls = [];
  const api = service(async (url, options) => {
    calls.push({ url, options });
    const path = new URL(url).pathname;
    assert.equal(options.headers['X-Signature'], createHmac('sha256', env.BETTALOTTO_PARTNER_SECRET).update(`123456.POST.${path}.${options.body}`).digest('hex'));
    assert.equal(options.redirect, 'error');
    return Response.json(path.endsWith('ping') ? { ok: true, key: 'private-name', scopes: ['launch', 'events'] } : { url: `${ORIGIN}/game?dealer=astrid&launch=fixture-token`, expiresIn: 21600 });
  });
  const ping = await (await api.endpoint(request('verify'))).json();
  assert.deepEqual(ping.scopes, ['launch', 'events']); assert.equal(ping.key, undefined);
  assert.equal((await api.endpoint(request('launch'))).status, 200);
  assert.deepEqual(calls.map(call => call.url), [`${ORIGIN}/api/v1/ping`, `${ORIGIN}/api/v1/launch`]);
  assert.deepEqual(JSON.parse(calls[1].options.body), { playerId: env.BETTALOTTO_PARTNER_PLAYER_ID });
});

test('unreadable generations configuration does not block Partner access or launch', async () => {
  const api = createPartnerReference({ env, token: () => { throw new Error('private path'); }, fetchImpl: async url => Response.json(String(url).endsWith('/ping') ? { ok: true, scopes: ['launch', 'events'] } : { url: `${ORIGIN}/game?launch=fixture-token` }) });
  const status = await (await api.endpoint(request())).json();
  assert.equal(status.configured, true); assert.equal(status.mappingConfigured, false);
  assert.match(status.mappingError, /kunde inte läsas/);
  assert.equal((await api.endpoint(request('verify'))).status, 200);
  assert.equal((await api.endpoint(request('launch'))).status, 200);
  assert.ok((await api.endpoint(request('mapping'))).status >= 400);
});

test('explicit staged-base launch keeps Partner identity and token but removes incompatible presentation overrides', async () => {
  const supplied = `${ORIGIN}/game?launch=fixture-token&dealer=vera&performance=staged&motion=smooth60&scene=rigged-review&joins=off&continuity=review#old`;
  const api = service(async (url, options) => {
    assert.equal(url, `${ORIGIN}/api/v1/launch`);
    assert.deepEqual(JSON.parse(options.body), { playerId: env.BETTALOTTO_PARTNER_PLAYER_ID });
    return Response.json({ url: supplied, expiresIn: 60 });
  });
  const ordinary = await (await api.endpoint(request('launch'))).json();
  assert.equal(ordinary.url, supplied); assert.equal(ordinary.presentationMode, 'partner-default');
  const staged = await (await api.endpoint(request('launch-staged-base'))).json();
  const url = new URL(staged.url);
  assert.equal(url.origin, ORIGIN); assert.equal(url.pathname, '/game'); assert.equal(url.hash, '');
  assert.deepEqual([...url.searchParams], [['launch', 'fixture-token'], ['dealer', 'astrid'], ['performance', 'staged']]);
  assert.equal(staged.expiresIn, 60); assert.equal(staged.presentationMode, 'astrid-staged-base');
});

test('Partner launch always uses the canonical /game start and preserves the server-owned launch identity', async () => {
  // The canonical entry is fixed; no variable selects another path.
  const gamePath = '/game';
  {
    const supplied = `${ORIGIN}${gamePath}?dealer=vera&launch=fixture-token&presentation=original&motion=smooth60#view`;
    const api = createPartnerReference({env,fetchImpl:async()=>Response.json({url:supplied,expiresIn:60})});
    const ordinary = await api.endpoint(request('launch'));
    assert.equal(ordinary.status,200);assert.equal((await ordinary.json()).url,supplied);
    const staged = await api.endpoint(request('launch-staged-base'));
    assert.equal(staged.status,200);
    const url = new URL((await staged.json()).url);
    assert.equal(url.origin,ORIGIN);assert.equal(url.pathname,gamePath);assert.equal(url.hash,'');
    assert.deepEqual([...url.searchParams],[['launch','fixture-token'],['dealer','astrid'],['performance','staged']]);
  }
});

test('canonical Partner launch rejects retired game paths, wrong origins and non-game destinations', async () => {
  for (const url of [`${ORIGIN}/?launch=token`,`${ORIGIN}/play/blackjack?launch=token`,`${ORIGIN}/blackjack/?launch=token`,`${ORIGIN}/game/?launch=token`,
    `${ORIGIN}/player-login?launch=token`,`${ORIGIN}/studio?launch=token`,'https://other.test/blackjack?launch=token']) {
    const api = createPartnerReference({env:{...env,},fetchImpl:async()=>Response.json({url})});
    for (const action of ['launch','launch-staged-base']) {
      const response = await api.endpoint(request(action));
      assert.equal(response.status,502);assert.ok(!(await response.text()).includes(url));
    }
  }
});

test('client-supplied identity/destination, foreign origins, query settings and unsupported methods are rejected before network access', async () => {
  let calls = 0; const api = service(() => { calls++; });
  const body = value => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
  for (const req of [
    new Request(LOCAL, body({ action: 'launch', playerId: 'another-player' })),
    new Request(LOCAL, body({ action: 'table' })),
    new Request(LOCAL + '?url=https://other.test'),
    new Request(LOCAL, { ...body({ action: 'launch' }), headers: { 'Content-Type': 'application/json', Origin: 'https://other.test' } }),
    new Request(LOCAL, { method: 'DELETE' }),
  ]) assert.ok((await api.endpoint(req)).status >= 400);
  assert.equal(calls, 0);
});

test('launch responses cannot redirect to another origin or unrelated endpoint', async () => {
  for (const url of ['https://other.test/?launch=token', `${ORIGIN}/api/delete?launch=token`, `${ORIGIN}/`, 'javascript:alert(1)', `https://name:password@bettalotto.se/?launch=token`]) {
    for (const action of ['launch', 'launch-staged-base']) {
      const response = await service(async () => Response.json({ url })).endpoint(request(action));
      assert.equal(response.status, 502);
      assert.ok(!(await response.text()).includes(url));
    }
  }
});

test('mapping uses only the separate bearer token and redacts nested credentials and signed URL queries', async () => {
  const api = service(async (url, options) => {
    assert.equal(url, `${ORIGIN}/api/v1/generations/mapping`);
    assert.deepEqual(options.headers, { Authorization: 'Bearer generation-fixture' });
    return Response.json({ revision: null, dealers: { astrid: { engine: [{ file: 'clip.h264', audioDelayMs: 463 }], secret: 'hidden' } }, backofficePicks: { astrid: { src: 'https://bettalotto.se/file.mp4?sig=private&key=private' } }, rawToken: 'ignored' });
  });
  const response = await api.endpoint(request('mapping'));
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.actualPlayback, false);
  assert.equal(data.mapping.revision, null);
  assert.equal(data.mapping.dealers.astrid.secret, '[dolt]');
  assert.equal(data.mapping.backofficePicks.astrid.src, 'https://bettalotto.se/file.mp4');
  assert.equal(data.mapping.rawToken, undefined);
});

test('upstream failures, redirects and oversized JSON produce bounded generic errors', async () => {
  for (const fetchImpl of [
    async () => new Response('private detail', { status: 403 }),
    async () => { throw Error('secret in URL'); },
    async () => new Response('x'.repeat(2 * 1024 * 1024 + 1)),
    async () => Response.json({ ok: true, scopes: 'not-an-array' }),
  ]) {
    const response = await service(fetchImpl).endpoint(request('verify'));
    assert.equal(response.status, 502); assert.doesNotMatch(await response.text(), /private detail|secret in URL/);
  }
});

test('malformed mapping summaries are rejected before reaching the interface', async () => {
  for (const value of [{ dealers: { astrid: null } }, { dealers: { astrid: [] } }, { dealers: {}, notes: {} }, { dealers: {}, notes: [null] }, { dealers: {}, revision: {} }]) {
    assert.equal((await service(async () => Response.json(value)).endpoint(request('mapping'))).status, 502);
  }
});

test('protocol preserves more than forty instructions and connection gaps without inventing video playback', () => {
  let trace = createPartnerTrace();
  const round = { kind: 'round', data: { requestId: 'r1', events: Array.from({ length: 65 }, (_, i) => ({ type: 'deal', shoeDraw: i, box: 3 })) } };
  trace = appendPartnerTrace(trace, round);
  trace = appendPartnerTrace(trace, { kind: 'status', data: { state: 'disconnected', gap: true } });
  const output = exportPartnerTrace(trace, { access: { token: 'hidden' }, exportedAt: 'fixture' });
  assert.equal(output.records[0].data.events.length, 65);
  assert.equal(output.records[1].data.gap, true);
  assert.equal(output.evidence.actualVideoPlaybackCaptured, false);
  assert.equal(output.access.token, '[dolt]');
  assert.equal(output.limits.reached, false);
  assert.equal(round.data.events.length, 65);
});

test('protocol stops with an explicit limit and never silently drops earlier rounds or emits partial arrays', () => {
  let trace = createPartnerTrace();
  for (let i = 0; i <= TRACE_RECORD_LIMIT; i++) trace = appendPartnerTrace(trace, { kind: 'round', index: i });
  assert.equal(trace.limited, true); assert.equal(trace.records.length, TRACE_RECORD_LIMIT);
  assert.equal(trace.records[0].index, 0);
  assert.equal(appendPartnerTrace(trace, { kind: 'round' }), trace);
  const huge = appendPartnerTrace(createPartnerTrace(), { data: 'x'.repeat(TRACE_BYTE_LIMIT) });
  assert.equal(huge.limited, true); assert.equal(huge.records.length, 0);
});
