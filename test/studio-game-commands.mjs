import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudioGameCommandApi } from '../web/studio-game-commands.mjs';
import { studioCommandSignature } from '../lab/lib/studio-game-authority.mjs';

const scope = { environment: 'fixture', workspaceId: 'croupier' }, secret = 's'.repeat(40);
const publicOrigin = 'https://public.example.invalid', at = 1_800_000_000_000;
function fixture() {
  let state = { nonces: new Map(), balance: 0 }, tail = Promise.resolve(), executions = 0, failExecution = false;
  let session = { user: 'operator', role: 'superadmin', scope }, authorizations = 0, changeOnSecond;
  const boDb = { transaction(work) {
    const pending = tail.then(async () => {
      const before = structuredClone(state);
      try { return await work(); } catch (error) { state = before; throw error; }
    }); tail = pending.catch(() => {}); return pending;
  }, prepare(sql) { return { async run(key, value) {
    if (sql.startsWith('INSERT INTO meta')) { if (state.nonces.has(key)) return {changes: 0}; state.nonces.set(key, value); return {changes: 1}; }
    if (sql.startsWith('DELETE FROM meta')) return {changes: 0};
    throw Error('Unhandled SQL');
  } }; } };
  const api = createStudioGameCommandApi({ scope, secret, publicOrigin, boDb, now: () => at,
    authorize: async () => { authorizations++; return authorizations === 2 && changeOnSecond ? changeOnSecond : session; },
    execute: async ({body, actor}) => { executions++; assert.equal(actor.user, 'operator'); state.balance += body.amount;
      if (failExecution) throw Error('PRIVATE CONNECTION'); return {ok: true, balance: state.balance}; } });
  const command = { action: 'apikeys/credit', body: {id: 'partner', playerId: 'player', amount: 100}, actor: {user: 'operator', role: 'superadmin'}, scope,
    commandId: 'd6339fa6-f202-47bb-9308-3f81440d1394' };
  const request = (changes = {}, headers = {}, timestamp = at, rawOverride) => {
    const raw = rawOverride ?? JSON.stringify({...command, ...changes});
    return new Request(`${publicOrigin}/api/studio-game/command`, {method: 'POST', headers: {origin: publicOrigin, 'content-type': 'application/json',
      'x-croupier-studio-timestamp': String(timestamp), 'x-croupier-studio-signature': studioCommandSignature(secret, String(timestamp), raw), ...headers}, body: raw});
  };
  return {api, request, get state(){return state;}, get executions(){return executions;}, set session(value){session=value;},
    set changeOnSecond(value){changeOnSecond=value;}, set failExecution(value){failExecution=value;}};
}
test('signed Render command atomically credits once under concurrent replay', async () => {
  const f = fixture(), results = await Promise.all([f.api(f.request()), f.api(f.request())]);
  assert.deepEqual(results.map(row => row.status).sort(), [200,409]);
  const success = await results.find(row => row.ok).json(); assert.deepEqual(success.scope, scope); assert.equal(success.authority, 'render');
  assert.equal(f.state.balance,100); assert.equal(f.executions,1); assert.equal(f.state.nonces.size,1);
});
test('failed domain transaction rolls back nonce and wallet; retry does not retain partial credit', async () => {
  const f=fixture(); f.failExecution=true;
  const failed=await f.api(f.request()); assert.equal(failed.status,503); assert.equal((await failed.text()).includes('PRIVATE'),false);
  assert.equal(f.state.balance,0); assert.equal(f.state.nonces.size,0);
  f.failExecution=false; assert.equal((await f.api(f.request())).status,200); assert.equal(f.state.balance,100);
});
test('forged actor, scope, role and role revoked inside transaction cannot execute', async () => {
  for(const changes of [{actor:{user:'other',role:'superadmin'}},{scope:{...scope,environment:'production'}},{action:'users/remove'}, {actor:{user:'operator',role:'reader'}}]) {
    const f=fixture(); assert.equal((await f.api(f.request(changes))).status,403); assert.equal(f.executions,0);
  }
  const f=fixture(); f.changeOnSecond={user:'operator',role:'reader',scope};
  assert.equal((await f.api(f.request())).status,403); assert.equal(f.state.nonces.size,0); assert.equal(f.executions,0);
});
test('tampering, expired signature, cross origin and oversized signed body are rejected before mutation', async () => {
  for(const [headers,timestamp,raw,expected] of [
    [{'x-croupier-studio-signature':'0'.repeat(64)},at,undefined,403], [{},at-30001,undefined,403],
    [{origin:'https://evil.invalid'},at,undefined,403], [{},at,'x'.repeat(16385),413], [{},at,'null',403], [{},at,'{',400]]) {
    const f=fixture(); assert.equal((await f.api(f.request({},headers,timestamp,raw))).status,expected); assert.equal(f.executions,0);
  }
});
