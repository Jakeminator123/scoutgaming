import test from 'node:test';
import assert from 'node:assert/strict';
import {QA_PUBLIC_ORIGIN, TRANSPORT_SENTINEL} from '../qa-stream-transport-preload.mjs';
import {runUnpaidWssGate, mainUnpaidWssGate} from '../qa-stream-transport-client.mjs';

const credentials = {username: 'private-fixture-operator', password: 'private-fixture-password'};
const ownerCookie = 'bo_jwt=private_owner.fixture', foreignCookie = 'bo_jwt=private_foreign.fixture';
const descriptor = attempt => ({kind: 'generated-speech-stream', url: '/speech-stream', ticket: `private_ticket.${attempt}`});
const transport = {accepted: true, upgradeStatus: 101, workerRoundTrip: true, bytes: TRANSPORT_SENTINEL.length,
  sha256: 'a'.repeat(64), terminalCode: 1000, syntheticTransport: true, actualPlayback: false};

function scenario({role = 'admin', verify, foreignResponse = false} = {}) {
  const requests = [], sockets = [];
  let logins = 0, prepares = 0;
  const fetchImpl = async (url, init) => {
    assert.equal(new URL(url).origin, QA_PUBLIC_ORIGIN);
    assert.equal(init.redirect, 'error'); assert.equal(init.headers.Origin, QA_PUBLIC_ORIGIN);
    assert.equal(init.headers['Sec-Fetch-Site'], 'same-origin');
    requests.push({path: new URL(url).pathname, method: init.method, cookie: init.headers.Cookie,
      body: init.body && JSON.parse(init.body)});
    if (foreignResponse) return {url: 'https://scoutgaming.tech/studio/api/auth/login', redirected: false};
    if (url.endsWith('/login')) {
      assert.deepEqual(JSON.parse(init.body), {user: credentials.username, pass: credentials.password});
      return Response.json({ok: true, role}, {headers: {'Set-Cookie': `${++logins === 1 ? ownerCookie : foreignCookie}; Path=/; HttpOnly; Secure; SameSite=Lax`}});
    }
    if (init.method === 'POST') {
      assert.equal(init.headers.Cookie, ownerCookie);
      return Response.json({attempt: ++prepares, decision: {speechStream: descriptor(prepares)}});
    }
    return Response.json({enabled: true, attempts: 0, maxAttempts: 3, pending: 0, relay: {busy: 0, pending: 0}});
  };
  const verifyTransport = async input => {
    sockets.push(input);
    if (verify) return verify(input, sockets.length);
    if (sockets.length === 1) return transport;
    throw Object.assign(Error(`Unsafe upstream text: ${input.cookie} ${input.descriptor.ticket}`), {gate: 'client_upgrade', accepted: false, statusCode: 401});
  };
  return {fetchImpl, verifyTransport, wait: async ms => {assert.ok(ms >= 1000);}, requests, sockets};
}

test('live gate uses real endpoint contract and separate fresh tickets to prove replay and cookie binding', async () => {
  const fixture = scenario();
  const result = await runUnpaidWssGate({credentials, ...fixture});
  assert.equal(result.accepted, true); assert.equal(result.actualPlayback, false);
  assert.equal(result.completed.find(item => item.gate === 'owner_stream').upgradeStatus, 101);
  assert.deepEqual(result.completed.filter(item => item.denied).map(item => [item.gate, item.statusCode]),
    [['ticket_replay', 401], ['foreign_session_ticket', 401]]);
  assert.equal(fixture.sockets[0].cookie, ownerCookie);
  assert.equal(fixture.sockets[1].cookie, ownerCookie);
  assert.equal(fixture.sockets[1].descriptor, fixture.sockets[0].descriptor);
  assert.equal(fixture.sockets[2].cookie, foreignCookie);
  assert.notEqual(fixture.sockets[2].descriptor.ticket, fixture.sockets[0].descriptor.ticket);
  assert.deepEqual(fixture.requests.filter(item => item.path.endsWith('/speech-qa') && item.method === 'POST').map(item => item.body), [{turn: 1}, {turn: 2}]);
  assert.equal(fixture.requests.filter(item => item.method === 'DELETE').length, 2);
  for (const secret of [credentials.username, credentials.password, ownerCookie, foreignCookie, ...fixture.sockets.map(item => item.descriptor.ticket)]) assert.ok(!JSON.stringify(result).includes(secret));
});

test('unavailable upgrade is never accepted as replay protection and owner stream is cleaned up', async () => {
  const fixture = scenario({verify: async (_input, attempt) => {
    if (attempt === 1) return transport;
    throw Object.assign(Error(credentials.password), {gate: 'client_upgrade', accepted: false, statusCode: 503});
  }});
  await assert.rejects(runUnpaidWssGate({credentials, ...fixture}), error => {
    assert.equal(error.gate, 'ticket_replay'); assert.equal(error.statusCode, 503);
    assert.equal(error.transportGate, 'client_upgrade'); assert.equal(error.failure, 'expected_upgrade_401');
    assert.ok(!JSON.stringify(error).includes(credentials.password)); return true;
  });
  assert.equal(fixture.requests.filter(item => item.method === 'DELETE').length, 1);
});

test('an accepted foreign session fails the security gate and cancels its owned preparation', async () => {
  const fixture = scenario({verify: async (_input, attempt) => {
    if (attempt === 2) throw Object.assign(Error('Rejected'), {gate: 'client_upgrade', accepted: false, statusCode: 401});
    return transport;
  }});
  await assert.rejects(runUnpaidWssGate({credentials, ...fixture}), error => error.gate === 'foreign_session_ticket' && error.failure === 'unauthorized_stream_accepted');
  assert.equal(fixture.requests.filter(item => item.method === 'DELETE').length, 2);
});

test('live flag, current operator role and canonical response origin are required before any socket', async () => {
  await assert.rejects(mainUnpaidWssGate([]), error => error.gate === 'explicit_live_flag_required');
  for (const [options, gate] of [[{role: 'reader'}, 'owner_login_current_role'], [{foreignResponse: true}, 'owner_login']]) {
    const fixture = scenario(options);
    await assert.rejects(runUnpaidWssGate({credentials, ...fixture}), error => error.gate === gate);
    assert.equal(fixture.sockets.length, 0);
    assert.equal(fixture.requests.some(item => item.method === 'DELETE'), false);
  }
});
