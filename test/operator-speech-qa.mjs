import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createServer } from 'node:http';
import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { createOperatorSpeechQa, isRetiredBackofficePost } from '../services/game/operator-speech-qa.mjs';

const ORIGIN = 'https://game.example.test';
const PATH = '/api/bo/speech-qa';
const COOKIE = 'bo_jwt=header.one.signature';
const OTHER = 'bo_jwt=header.two.signature';
async function fixture(t, { gated = true, lifetime = 60000 } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'croupier-operator-qa-'));
  const gatePath = join(directory, 'operator-qa.json');
  let clock = Date.now(), role = 'admin', revoked = false, model, prepare, relay = { workers: 1, busy: 0, available: 1, pending: 0 };
  const gate = { id: randomUUID(), createdAt: clock, expiresAt: clock + lifetime };
  const seen = [], cancelled = [], controllers = [];
  let modelCalls = 0, closed = 0, lease = null;
  const stream = {
    status: () => ({ ...relay, secret: 'must-never-leak' }),
    acquireExclusive(owner) {
      if (lease) throw Object.assign(Error('busy'), { code: 'generated_speech_stream_busy', statusCode: 429 });
      const current = { owner }; lease = current;
      return () => { if (lease === current) lease = null; };
    },
    complete(owner) { if (lease?.owner === owner) lease = null; },
    prepare: async input => {
      seen.push(input);
      await input.beforeCostly();
      if (prepare) return prepare(input);
      return { kind: 'generated-speech-stream', requestId: input.requestId, exactText: input.text, ticket: 'fixture-ticket' };
    },
    cancelOwner: owner => cancelled.push(owner), close: () => { closed++; },
  };
  const claims = { sub: 'operator', role: 'admin', source_stamp: 'current-stamp', auth_epoch: 1, exp: Math.floor(clock / 1000) + 3600 };
  const options = { directory, origin: ORIGIN, now: () => clock,
    authenticate: req => !revoked && [COOKIE, OTHER].includes(req.headers.cookie) ? { ...claims, role } : null,
    service: () => stream,
    decide: async (request, status, signal, ownedContext) => {
      modelCalls++;
      if (model) return model(request, status, signal, ownedContext);
      return { kind: 'generatedText', exactText: 'Mamma bakar bullar medan pappa brygger kaffe.',
        requestId: request.requestId, dealerId: status.dealerId, sessionRevision: status.sessionRevision, roundRevision: status.roundRevision };
    },
  };
  const saveGate = async value => writeFile(gatePath, JSON.stringify(value), { mode: 0o600 });
  if (gated) await saveGate(gate);
  const construct = () => { const value = createOperatorSpeechQa(options); controllers.push(value); return value; };
  const controller = construct();
  function request(method = 'POST', changes = {}) {
    const req = Readable.from([JSON.stringify({ turn: 1 })]);
    Object.assign(req, { method, url: PATH, aborted: false,
      headers: { host: new URL(ORIGIN).host, cookie: COOKIE, origin: ORIGIN, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' }, ...changes });
    return req;
  }
  async function call(method = 'POST', { qa = controller, headers = {}, value = { turn: 1 }, url = PATH, pathname = PATH } = {}) {
    const req = request(method, { url }); req.headers = { ...req.headers, ...headers };
    const body = Readable.from(method === 'POST' ? [typeof value === 'string' ? value : JSON.stringify(value)] : []);
    Object.assign(body, { method: req.method, url: req.url, headers: req.headers, aborted: false });
    const res = new EventEmitter();
    Object.assign(res, { destroyed: false, writableEnded: false, code: null, headers: null, data: null,
      writeHead(code, responseHeaders) { this.code = code; this.headers = responseHeaders; },
      end(data) { this.writableEnded = true; this.data = data ? JSON.parse(data) : null; this.emit('close'); },
    });
    const handled = await qa.handle(body, res, pathname);
    return { handled, ...res, req: body };
  }
  t.after(async () => {
    revoked = false; role = 'admin';
    for (const qa of controllers) {
      await call('DELETE', { qa }); await call('DELETE', { qa, headers: { cookie: OTHER } });
    }
    assert.equal(closed, 0, 'QA never closes shared product service');
    assert.equal(dirname(directory), resolve(tmpdir())); assert.match(basename(directory), /^croupier-operator-qa-/);
    await rm(directory, { recursive: true, force: true });
  });
  return { directory, gatePath, gate, saveGate, controller, construct, call, request, seen, cancelled, options, stream,
    get modelCalls() { return modelCalls; }, get clock() { return clock; }, setTime: value => { clock = value; },
    setRole: value => { role = value; }, revoke: () => { revoked = true; },
    setModel: value => { model = value; }, setPrepare: value => { prepare = value; }, setRelay: value => { relay = value; } };
}

test('default off; GET never reserves, invokes a model or starts the shared service', async t => {
  const f = await fixture(t, { gated: false });
  const get = await f.call('GET');
  assert.equal(get.code, 200); assert.equal(get.data.enabled, false); assert.equal(get.data.attempts, 0);
  assert.equal((await f.call()).code, 503);
  assert.equal(f.modelCalls, 0); assert.equal(f.seen.length, 0); assert.deepEqual(await readdir(f.directory), []);
  assert.equal((await f.call('GET', { pathname: '/api/bo/unrelated' })).handled, false);
});

test('native policy retires legacy BO posts but dispatches exact speech QA through its protected HTTP handler', async t => {
  const f = await fixture(t);
  const server = createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://local').pathname;
    if (isRetiredBackofficePost({ studioPolicyActive: true, method: req.method, pathname })) {
      res.writeHead(410, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end('{"error":"legacy_administration_retired"}'); return;
    }
    if (await f.controller.handle(req, res, pathname)) return;
    res.writeHead(404, { 'Cache-Control': 'no-store' }); res.end();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { if (server.listening) await new Promise(resolve => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const protectedResponse = await fetch(base + PATH, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"turn":1}',
  });
  assert.equal(protectedResponse.status, 403);
  assert.notEqual(protectedResponse.status, 410);
  const retiredResponse = await fetch(base + '/api/bo/legacy-action', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
  });
  assert.equal(retiredResponse.status, 410);
  assert.equal(f.modelCalls, 0);
  assert.equal(f.seen.length, 0, 'protected rejection cannot reserve or reach a provider');
});

test('model receives the actual ephemeral owner and live gate callbacks through a trusted context',async t=>{
  const f=await fixture(t);let received;
  f.setModel(async(request,status,signal,owned)=>{
    received=owned;assert.ok(Object.isFrozen(owned));assert.match(owned.playerId,/^operator-qa-/);
    assert.ok(owned.owner.includes(f.gate.id));assert.equal(owned.operatorCampaignId,f.gate.id);assert.equal(owned.operatorAttempt,1);
    assert.equal(await owned.readOwner(),owned.owner);assert.deepEqual(await owned.readStatus(),status);assert.equal(signal.aborted,false);
    return{kind:'generatedText',exactText:'Mamma bakar bullar medan pappa brygger kaffe.',requestId:request.requestId,
      dealerId:status.dealerId,sessionRevision:status.sessionRevision,roundRevision:status.roundRevision};
  });
  assert.equal((await f.call()).code,200);assert.equal(f.seen[0].playerId,received.playerId);assert.equal(f.seen[0].owner,received.owner);
  f.revoke();await assert.rejects(received.readOwner(),/operator_speech_qa_auth_required/);
  await assert.rejects(received.readStatus(),/operator_speech_qa_/);
});

test('auth, role, origin, exact route and bounded JSON reject before reservation', async t => {
  const f = await fixture(t);
  for (const role of ['reader', 'staff']) { f.setRole(role); assert.equal((await f.call()).code, 403); }
  f.setRole('admin');
  for (const headers of [{ cookie: '' }, { cookie: `${COOKIE}; ${COOKIE}` }, { origin: 'https://evil.example' },
    { origin: undefined }, { host: 'other.example.test' }, { 'sec-fetch-site': 'cross-site' }, { 'sec-fetch-site': 'same-site' }]) {
    assert.equal((await f.call('POST', { headers })).code, 403);
  }
  assert.equal((await f.call('POST', { url: `${PATH}?extra=1` })).code, 403);
  assert.equal((await f.call('PUT')).code, 405);
  assert.equal((await f.call('POST', { headers: { 'content-type': 'text/plain' } })).code, 415);
  for (const value of [{ turn: 3 }, { turn: 1, text: 'injected' }, { turn: '1' }, '{']) assert.equal((await f.call('POST', { value })).code, 400);
  assert.equal((await f.call('POST', { value: 'x'.repeat(129) })).code, 413);
  assert.equal(f.modelCalls, 0); assert.equal(f.seen.length, 0);
  assert.deepEqual(await readdir(f.directory), ['operator-qa.json']);
});

test('malformed, future, expired or overlong gates are inactive and cannot pay', async t => {
  const f = await fixture(t);
  for (const value of [{ ...f.gate, id: '../../invalid' }, { ...f.gate, extra: true },
    { ...f.gate, createdAt: f.clock + 1 }, { ...f.gate, expiresAt: f.clock },
    { ...f.gate, expiresAt: f.clock + 1800001 }]) {
    await f.saveGate(value);
    assert.equal((await f.call('GET')).data.enabled, false); assert.equal((await f.call()).code, 503);
  }
  await writeFile(f.gatePath, '{');
  assert.equal((await f.call('GET')).data.enabled, false); assert.equal(f.modelCalls, 0);
});

test('symlink gate is rejected without following it or reserving', async t => {
  const f = await fixture(t, { gated: false }), target = join(f.directory, 'private-target.json');
  await writeFile(target, JSON.stringify(f.gate), { mode: 0o600 });
  try { await symlink(target, f.gatePath, 'file'); }
  catch (error) { if (process.platform === 'win32' && error.code === 'EPERM') { t.skip('Windows user cannot create file symlinks'); return; } throw error; }
  assert.equal((await f.call('GET')).data.enabled, false); assert.equal((await f.call()).code, 503);
  assert.equal(f.modelCalls, 0);
});

test('two fixed questions use synthetic context and exact shared service; HTTP end preserves owner', async t => {
  const f = await fixture(t), prompts = [];
  f.setModel(async (request, status, signal) => {
    prompts.push(request.message);
    assert.deepEqual(request.history, []); assert.equal(status.dealerId, 'astrid'); assert.equal(status.round, null);
    assert.deepEqual(status.policy, { generatedText: true, recordedLines: [], silence: false, mediaFamilies: [] });
    assert.equal(status.roundPhase, 'idle'); assert.equal(status.playerId, undefined); assert.equal(status.balance, undefined);
    assert.equal(signal.aborted, false);
    return { kind: 'generatedText', exactText: 'Mamma och pappa bakar blåbärspaj.', requestId: request.requestId, dealerId: 'astrid' };
  });
  const first = await f.call(); f.stream.complete(f.seen[0].owner);
  const second = await f.call('POST', { value: { turn: 2 } });
  assert.equal(first.code, 200); assert.equal(second.code, 200); assert.equal(second.data.attempt, 2);
  assert.equal(f.modelCalls, 2); assert.equal(f.seen.length, 2); assert.notEqual(prompts[0], prompts[1]);
  for (const prompt of prompts) assert.ok(prompt.split(' ').length >= 12 && prompt.split(' ').length <= 18);
  for (const input of f.seen) {
    assert.equal(input.signal.aborted, false);
    assert.equal(await f.controller.resolveOwner(first.req, input.playerId), input.owner);
    await input.beforeCostly();
  }
  const get = await f.call('GET');
  assert.equal(get.data.attempts, 2); assert.equal(get.data.expiresAt, f.gate.expiresAt);
  assert.deepEqual(get.data.relay, { workers: 1, busy: 0, available: 1, pending: 0 });
  const serialized = JSON.stringify(get.data);
  for (const forbidden of ['header', 'signature', 'must-never-leak', f.gate.id]) assert.equal(serialized.includes(forbidden), false);
  assert.ok(Object.keys(first.data.timings).includes('text_wait_ms'));
  assert.ok((await readdir(f.directory)).every(name => name === 'operator-qa.json' || /^operator-qa-.*\.(?:campaign|attempt-[12])\.json$/.test(name)));
});

test('WS ownership is tied to exact current BO session, not just account or QA prefix', async t => {
  const f = await fixture(t), post = await f.call(), input = f.seen[0];
  assert.equal(post.code, 200); assert.equal(f.controller.ownsIdentity(input.playerId), true);
  assert.equal(await f.controller.resolveOwner(f.request('GET', { headers: { cookie: OTHER } }), input.playerId), null);
  assert.equal(await f.controller.resolveOwner(f.request(), 'operator-qa-unknown'), null);
  assert.equal(f.controller.ownsIdentity('real-player-id'), false);
  f.revoke();
  assert.equal(await f.controller.resolveOwner(post.req, input.playerId), null);
  await assert.rejects(input.beforeCostly());
});

test('gate expiry and gate replacement invalidate an already prepared stream before TTS/WS', async t => {
  for (const mode of ['expiry', 'replacement', 'removed']) {
    const f = await fixture(t); const result = await f.call(), input = f.seen[0];
    if (mode === 'expiry') f.setTime(f.gate.expiresAt);
    if (mode === 'replacement') await f.saveGate({ ...f.gate, id: randomUUID() });
    if (mode === 'removed') await rm(f.gatePath);
    assert.equal(await f.controller.resolveOwner(result.req, input.playerId), null);
    await assert.rejects(input.beforeCostly()); assert.equal(input.signal.aborted, true);
    assert.ok(f.cancelled.includes(input.owner));
  }
});

test('expiry timer cancels QA even without another request', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = await fixture(t);
  assert.equal((await f.call()).code, 200);
  assert.equal(f.seen[0].signal.aborted, false);
  f.setTime(f.gate.expiresAt);
  t.mock.timers.tick(f.gate.expiresAt - f.gate.createdAt);
  assert.equal(f.seen[0].signal.aborted, true);
  assert.deepEqual(f.cancelled, [f.seen[0].owner]);
});

test('gate/auth changes during model await never reach stream preparation', async t => {
  for (const mode of ['expiry', 'auth', 'replacement']) {
    const f = await fixture(t);
    f.setModel(async () => {
      if (mode === 'expiry') f.setTime(f.gate.expiresAt);
      if (mode === 'auth') f.revoke();
      if (mode === 'replacement') await f.saveGate({ ...f.gate, id: randomUUID() });
      return { kind: 'generatedText', exactText: 'Never paid.' };
    });
    assert.notEqual((await f.call()).code, 200); assert.equal(f.modelCalls, 1); assert.equal(f.seen.length, 0);
    assert.ok((await readdir(f.directory)).some(name => name.endsWith('.attempt-1.json')));
  }
});

test('three persistent reservations survive restarts and include failed provider attempts', async t => {
  const f = await fixture(t);
  f.setPrepare(async () => { throw Object.assign(Error('private provider body'), { code: 'generated_speech_session_provider_not_found', statusCode: 503 }); });
  for (let attempt = 1; attempt <= 3; attempt++) {
    const qa = f.construct(), result = await f.call('POST', { qa });
    assert.equal(result.code, 503); assert.equal(result.data.attempt, attempt);
    assert.equal(result.data.error, 'generated_speech_session_provider_not_found');
    assert.equal(JSON.stringify(result.data).includes('private'), false);
  }
  const again = f.construct();
  assert.equal((await f.call('GET', { qa: again })).data.attempts, 3);
  assert.equal((await f.call('POST', { qa: again })).code, 429);
  assert.equal(f.modelCalls, 3); assert.equal(f.seen.length, 3);
  assert.equal((await readdir(f.directory)).filter(name => name.includes('.attempt-')).length, 3);
});

test('same campaign cannot be extended or reset by editing gate timestamps', async t => {
  const f = await fixture(t); assert.equal((await f.call()).code, 200);
  await f.saveGate({ ...f.gate, expiresAt: f.gate.expiresAt + 1000 });
  assert.equal((await f.call('GET')).data.enabled, false); assert.equal((await f.call()).code, 503);
  assert.equal(f.modelCalls, 1);
});

test('malformed persistent reservation fails closed without another model call', async t => {
  const f = await fixture(t); await f.call();
  const name = (await readdir(f.directory)).find(value => value.endsWith('.attempt-1.json'));
  await writeFile(join(f.directory, name), '{');
  assert.equal((await f.call('POST', { qa: f.construct() })).code, 503); assert.equal(f.modelCalls, 1);
});

test('parallel POSTs including a second controller cannot enter a second model/prepare', async t => {
  const f = await fixture(t); let release, entered;
  const started = new Promise(resolve => { entered = resolve; });
  const held = new Promise(resolve => { release = resolve; });
  f.setModel(async () => { entered(); await held; return { kind: 'generatedText', exactText: 'One reply.' }; });
  const first = f.call(); await started;
  try {
    assert.equal((await f.call()).code, 409);
    assert.equal((await f.call('POST', { qa: f.construct() })).code, 409);
    assert.equal(f.modelCalls, 1);
  } finally { release(); }
  assert.equal((await first).code, 200); assert.equal(f.seen.length, 1);
});

test('busy product relay is never cancelled or replaced to admit QA', async t => {
  const f = await fixture(t);
  for (const relay of [{ workers: 1, busy: 1, available: 0, pending: 0 }, { workers: 1, busy: 0, available: 1, pending: 1 }]) {
    f.setRelay(relay); assert.equal((await f.call()).code, 409);
  }
  assert.equal(f.modelCalls, 0); assert.equal(f.seen.length, 0); assert.deepEqual(f.cancelled, []);
  assert.deepEqual(await readdir(f.directory), ['operator-qa.json']);
});

test('DELETE only cancels the requesting BO session QA and preserves attempt files', async t => {
  const f = await fixture(t); await f.call(); f.stream.complete(f.seen[0].owner);
  await f.call('POST', { headers: { cookie: OTHER } });
  const [first, other] = f.seen;
  assert.equal((await f.call('DELETE', { headers: { origin: 'https://evil.example' } })).code, 403);
  assert.deepEqual(f.cancelled, []);
  const result = await f.call('DELETE'); assert.equal(result.code, 200);
  assert.equal(first.signal.aborted, true); assert.equal(other.signal.aborted, false);
  assert.deepEqual(f.cancelled, [first.owner]); assert.equal(result.data.attempts, 2);
  assert.equal(await f.controller.resolveOwner(f.request('GET', { headers: { cookie: OTHER } }), other.playerId), other.owner);
  const records = await readdir(f.directory); assert.equal(records.filter(name => name.includes('.attempt-')).length, 2);
  for (const name of records) assert.equal((await readFile(join(f.directory, name), 'utf8')).includes('header.one.signature'), false);
});

test('DELETE during an awaited model prevents later prepare and keeps the failed reservation', async t => {
  const f = await fixture(t); let release, entered;
  const started = new Promise(resolve => { entered = resolve; });
  const held = new Promise(resolve => { release = resolve; });
  f.setModel(async (_request, _status, signal) => {
    entered(); await held; assert.equal(signal.aborted, true);
    return { kind: 'generatedText', exactText: 'Do not prepare.' };
  });
  const pending = f.call(); await started;
  try { assert.equal((await f.call('DELETE')).code, 200); } finally { release(); }
  assert.notEqual((await pending).code, 200); assert.equal(f.seen.length, 0);
  assert.equal((await f.call('GET')).data.attempts, 1);
});

test('an abandoned campaign lock fails closed and does not spend another attempt', async t => {
  const f = await fixture(t);
  await writeFile(join(f.directory, `operator-qa-${f.gate.id}.lock`), '', { mode: 0o600 });
  assert.equal((await f.call()).code, 409); assert.equal(f.modelCalls, 0);
  assert.equal((await f.call('GET')).data.attempts, 0);
});

test('shared-service lease is acquired before model work and released on model failure', async t => {
  const f = await fixture(t);
  const held = f.stream.acquireExclusive('product');
  const blocked = await f.call();
  assert.equal(blocked.code, 429); assert.equal(blocked.data.attempt, 1); assert.equal(f.modelCalls, 0);
  held();
  f.setModel(async () => { throw Error('private failure'); });
  assert.equal((await f.call()).code, 502);
  const next = f.stream.acquireExclusive('product'); next();
  assert.equal((await f.call('GET')).data.attempts, 2);
});
