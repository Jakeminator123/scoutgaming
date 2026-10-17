import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createPlayerPasswordCommand } from '../packages/storage/server/player-administration.mjs';
import { createStudioGameCommandApi } from '../web/studio-game-commands.mjs';
import { studioCommandSignature } from '../apps/studio/lib/studio-game-authority.mjs';

const scope = { environment: 'fixture', workspaceId: 'croupier' }, secret = 's'.repeat(40);
const publicOrigin = 'https://public.example.invalid', at = 1_800_000_000_000;
function fixture(executeCommand) {
  let state = { nonces: new Map(), balance: 0 }, tail = Promise.resolve(), executions = 0, failExecution = false;
  let session = { user: 'operator', role: 'superadmin', scope }, authorizations = 0, changeOnSecond;
  let clock=at, onAuthorize=()=>{};
  const boDb = { transaction(work) {
    const pending = tail.then(async () => {
      const before = structuredClone(state);
      try { return await work(); } catch (error) { state = before; throw error; }
    }); tail = pending.catch(() => {}); return pending;
  }, prepare(sql) { return { async run(key, value) {
    if (sql.startsWith('INSERT INTO meta')) { if (state.nonces.has(key)) return {changes: 0}; state.nonces.set(key, value); return {changes: 1}; }
    if (sql.startsWith('DELETE FROM meta')) {for(const [nonce,stamp] of state.nonces)if(Number(stamp)<key)state.nonces.delete(nonce);return {changes:0};}
    throw Error('Unhandled SQL');
  } }; } };
  const api = createStudioGameCommandApi({ scope, secret, publicOrigin, boDb, now: () => clock,
    authorize: async () => { authorizations++;await onAuthorize(authorizations); return authorizations === 2 && changeOnSecond ? changeOnSecond : session; },
    execute: async ({action, body, actor}) => { executions++; assert.equal(actor.user, 'operator');
      if(executeCommand) return executeCommand({action,body,actor});
      state.balance += body.amount;
      if (failExecution) throw Error('PRIVATE CONNECTION'); return {ok: true, balance: state.balance}; } });
  const command = { action: 'apikeys/credit', body: {id: 'partner', playerId: 'player', amount: 100}, actor: {user: 'operator', role: 'superadmin'}, scope,
    commandId: 'd6339fa6-f202-47bb-9308-3f81440d1394' };
  const request = (changes = {}, headers = {}, timestamp = at, rawOverride) => {
    const raw = rawOverride ?? JSON.stringify({...command, ...changes});
    return new Request(`${publicOrigin}/api/studio-game/command`, {method: 'POST', headers: {origin: publicOrigin, 'content-type': 'application/json',
      'x-croupier-studio-timestamp': String(timestamp), 'x-croupier-studio-signature': studioCommandSignature(secret, String(timestamp), raw), ...headers}, body: raw});
  };
  return {api, request, get state(){return state;}, get executions(){return executions;}, set session(value){session=value;},
    boDb,set clock(value){clock=value;},set onAuthorize(value){onAuthorize=value;},
    set changeOnSecond(value){changeOnSecond=value;}, set failExecution(value){failExecution=value;}};
}
test('signed Render command atomically credits once under concurrent replay', async () => {
  const f = fixture(), results = await Promise.all([f.api(f.request()), f.api(f.request())]);
  assert.deepEqual(results.map(row => row.status).sort(), [200,409]);
  const success = await results.find(row => row.ok).json(); assert.deepEqual(success.scope, scope); assert.equal(success.authority, 'render');
  assert.equal(f.state.balance,100); assert.equal(f.executions,1); assert.equal(f.state.nonces.size,1);
});

test('delayed signed body cannot replay a credit after nonce expiry and cleanup',async()=>{
 const f=fixture();assert.equal((await f.api(f.request())).status,200);
 const base=f.request(),raw=await base.text();let release;
 const body=new ReadableStream({start(controller){release=()=>{controller.enqueue(new TextEncoder().encode(raw));controller.close();};}});
 const delayed=f.api(new Request(base.url,{method:'POST',headers:base.headers,body,duplex:'half'}));
 await new Promise(resolve=>setImmediate(resolve));
 f.clock=at+70000;
 assert.equal((await f.api(f.request({commandId:'55c9d3f1-4aa3-4487-9b51-e7e09bcd5343'}, {},at+70000))).status,200);
 assert.equal(f.state.nonces.size,1);
 release();assert.equal((await delayed).status,403);
 assert.equal(f.executions,2);assert.equal(f.state.balance,200);
});
test('signature expiry during authorization or while waiting for the product lock rejects before mutation',async()=>{
 for(const stage of [1,2]) {
  const f=fixture();f.onAuthorize=count=>{if(count===stage)f.clock=at+30001;};
  assert.equal((await f.api(f.request())).status,403);assert.equal(f.executions,0);assert.equal(f.state.nonces.size,0);
 }
 const f=fixture();let unlock,entered;
 const ready=new Promise(resolve=>{entered=resolve;});
 const blocking=f.boDb.transaction(()=>new Promise(resolve=>{unlock=resolve;entered();}));
 await ready;const pending=f.api(f.request());await new Promise(resolve=>setImmediate(resolve));
 f.clock=at+30001;unlock();await blocking;
 assert.equal((await pending).status,403);assert.equal(f.executions,0);assert.equal(f.state.nonces.size,0);
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


test('signed player password command waits for cancellation and cannot replay after acceptance',async()=>{
  const body={playerId:'player',password:randomBytes(24).toString('base64url'),reason:'disposable fixture password change'};
  let release,entered,updates=0,settled=false;
  const ready=new Promise(resolve=>{entered=resolve;});
  const command=createPlayerPasswordCommand({administration:{async setPassword(request){
    assert.deepEqual(request,{...body,actor:'operator'});updates++;return{id:body.playerId,changed:true};
  }},cancelRuntime:async id=>{assert.equal(id,body.playerId);entered();await new Promise(resolve=>{release=resolve;});}});
  const f=fixture(command);f.session={user:'operator',role:'admin',scope};
  const changes={action:'players/password',body,actor:{user:'operator',role:'admin'}};
  const pending=f.api(f.request(changes)).then(response=>{settled=true;return response;});
  await ready;await new Promise(resolve=>setImmediate(resolve));
  assert.equal(settled,false);assert.equal(updates,1);assert.equal(f.state.nonces.size,1);
  release();assert.equal((await pending).status,200);
  assert.equal((await f.api(f.request(changes))).status,409);assert.equal(updates,1);assert.equal(f.state.balance,0);

  const failed=fixture(createPlayerPasswordCommand({administration:{async setPassword(){return{id:body.playerId,changed:true};}},
    cancelRuntime:async()=>{throw Error('PRIVATE CANCEL FAILURE');}}));
  failed.session={user:'operator',role:'admin',scope};
  const rejection=await failed.api(failed.request(changes));assert.equal(rejection.status,503);
  assert.equal((await rejection.text()).includes('PRIVATE'),false);assert.equal(failed.state.nonces.size,0);
});
