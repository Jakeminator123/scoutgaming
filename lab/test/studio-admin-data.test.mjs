import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudioAdminData } from '../lib/studio-admin-data.mjs';

const scope = { environment: 'fixture', workspaceId: 'croupier' };
function fixture() {
  const state = { document: { revision: 'studio-original', value: { rooms: [{ id: 'one', state: 'preview' }], tiers: { classic: 'vera' }, tournaments: [] } }, writes: [], reads: [], rows: [] };
  const db = { prepare(sql) {
    state.reads.push(sql);
    return { all: async () => state.rows, get: async () => ({ id: 7, username: 'someone', n: 1 }),
      run: async (...args) => { state.writes.push({ sql, args }); return { changes: 1 }; } };
  }, transaction: work => work() };
  const repository = { readDocument: async () => structuredClone(state.document), async saveDocument(kind, options) {
    state.writes.push({ kind, options });
    if (state.document.revision !== options.expectedRevision) throw Object.assign(Error('Conflict'), { statusCode: 409 });
    state.document = { revision: 'studio-new', value: options.value }; return state.document;
  } };
  const data = createStudioAdminData({ db, boDb: db, repository, scope });
  const context = body => ({ body, actor: { user: 'operator', role: 'superadmin' }, scope });
  const call = (method, action, body) => data.handlers.get(`${method} /studio/api/admin/${action}`)(context(body));
  return { state, data, call, context };
}
test('configuration reads are saved revision only; missing data never seeds', async () => {
  const f = fixture(); assert.equal((await f.call('GET','config')).revision, 'studio-original');
  f.state.document = null;
  await assert.rejects(f.call('GET','config'), error => error.statusCode === 503);
  assert.deepEqual(f.state.writes, []);
});
test('room edit uses server actor and exact CAS; stale, spoofed and invalid edits do not save', async () => {
  const f = fixture();
  for (const body of [{ id: 'one', state: 'live', expectedRevision: 'stale' }, { id: 'one', state: 'anything', expectedRevision: 'studio-original' }, { id: 'one', state: 'live', expectedRevision: 'studio-original', actor: 'attacker' }]) {
    await assert.rejects(f.call('POST','room',body));
  }
  assert.equal(f.state.writes.length, 0);
  assert.deepEqual(await f.call('POST','room',{ id: 'one', state: 'live', expectedRevision: 'studio-original' }), { ok: true, revision: 'studio-new' });
  assert.equal(f.state.writes[0].options.actor, 'operator');
  assert.equal(f.state.writes[0].options.value.rooms[0].state, 'live');
});
test('pit and tournament do not accept arbitrary config/body fields or synthetic authority', async () => {
  const f = fixture();
  await assert.rejects(f.call('POST','pitboss',{ payout10x: true, streak5: true, randomWalkMin: 0, expectedRevision: 'studio-original' }));
  await f.call('POST','pitboss',{ payout10x: true, streak5: false, randomWalkMin: 45, expectedRevision: 'studio-original' });
  await f.call('POST','tournament',{ name: 'Test', format: '20 rounds', buyin: 0, pool: 1000, cap: 10, starts: 'Tonight', expectedRevision: 'studio-new' });
  assert.equal(f.state.document.value.tournaments[0].state, 'draft');
  assert.equal(f.state.document.value.tournaments[0].entries, 0);
});
test('partner metadata does not select credentials and incomplete runtime actions are absent', async () => {
  const f = fixture(); f.state.rows = [{ id: 'x', scopes: '["launch"]', name: 'Partner' }];
  assert.deepEqual((await f.call('GET','apikeys')).keys[0].scopes, ['launch']);
  assert.ok(!/\b(?:key|secret)\b/.test(f.state.reads.at(-1)));
  for (const action of ['players/status','apikeys/revoke','apikeys/credit','speech-qa','tier']) {
    assert.equal(f.data.handlers.has(`POST /studio/api/admin/${action}`), false);
  }
});
test('self change, invalid role and wrong server scope are denied before mutation', async () => {
  const f = fixture();
  await assert.rejects(f.call('POST','users/remove',{ username: 'Operator' }));
  await assert.rejects(f.call('POST','users/role',{ username: 'someone', role: 'player' }));
  await assert.rejects(f.data.handlers.get('GET /studio/api/admin/users')({ ...f.context(), scope: { ...scope, workspaceId: 'other' } }));
  assert.equal(f.state.writes.length, 0);
  await f.call('POST','users/role',{ username: 'someone', role: 'reader' });
  assert.ok(f.state.writes.some(write => write.sql.startsWith('DELETE FROM lab_sessions')));
});
