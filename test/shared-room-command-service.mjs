import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as turn } from 'node:timers/promises';
import { createSharedRoomService } from '../services/game/shared-room-service.mjs';
import { runPostgresTransactionOwner } from '../packages/storage/server/postgres-transaction-context.mjs';
import { EventEmitter } from 'node:events';
import { createPostgresTableRuntime } from '../services/game/games/blackjack/table/postgres-runtime.mjs';
import { createMemoryTableStore } from './fixtures/blackjack-table-memory-store.mjs';
import { deterministicRandom } from './fixtures/blackjack-deterministic-random.mjs';

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function fixture(t, hooks = {}) {
  const trace = [], hinted = [], actorsHinted = [], state = { writes: 0, active: false };
  const binding = Object.freeze({ actorId: 'alice', sessionId: 'player-' + 'a'.repeat(64), roomId: 'room-a',
    operatorId: 'operator-a', packageRevision: 1, expiresAt: Date.now() + 60000 });
  let runtimeOptions, running = false;
  const snapshot = () => ({ contract: 'blackjack-table/1', roomId: 'room-a', version: state.writes,
    presentationVer: hooks.presentationVer ?? 0, configVersion: 'config-a', windowId: 'window-a', me: { id: 'alice', privateToken: 'omit' },
    audit: [{secret: 'omit'}] });
  const repository = { async sharedTransaction(work, options) {
    assert.deepEqual(options, {serialize:true}); assert.equal(state.active, false);
    const before = state.writes; state.active = true; trace.push('begin');
    try { const value = await work(); await hooks.commit?.(); trace.push('commit'); return value; }
    catch (error) { state.writes = before; trace.push('rollback'); throw error; }
    finally { state.active = false; }
  } };
  const service = createSharedRoomService({ pool: { connect() { assert.fail('unexpected SQL checkout'); }, query() {} },
    walletMode: 'demo', origin: 'https://player.invalid', engineOrigin: 'https://engine.invalid', repository,
    auth: {}, commandAuth: {}, scope: {environment:'test',workspaceId:'workspace-a'} }, {
    createAccess: () => ({
      async authorize() { trace.push('initial-binding'); return binding; },
      async revalidateLocked(actual, {signal}) {
        assert.equal(state.active, true); assert.equal(actual, binding); trace.push('locked-auth');
        await hooks.authority?.(signal); signal.throwIfAborted();
        if (hooks.denied) throw Object.assign(new Error('revoked'), {statusCode:403});
        return actual;
      },
    }),
    createReceiver: () => ({ async assertInstalled() {}, async current() { return null; }, async currentLocked() { return null; }, async sink() { return 'applied'; } }),
    createRuntime(options) {
      runtimeOptions = options;
      return { async start() { running = true; }, async stop() { running = false; }, withLockedRead() { assert.fail('Unexpected direct reader'); },
        health: () => ({running, failed:false, rooms:hooks.roomFaults??[]}), roomHealth: room => (hooks.roomFaults??[]).find(fault => fault.roomId===room) ?? null,
        coordinator: { async command(context, input) {
          assert.equal(state.active, true); assert.equal(input.roomId, 'room-a');
          trace.push('table-locks');
          await options.authorizeCommand({rooms:{read:async()=>({presentationVer:0})}}, {...context,roomId:input.roomId,commandId:input.commandId,lockedPlayers:hooks.actors??['alice']});
          trace.push('receipt-read');
          if (!hooks.replay) state.writes++;
          const result = input.op === 'pause' ? {op:'pause',pausedUntil:900000,rooms:hooks.rooms??[]} : {op:'refill',version:state.writes,ledgerId:'never-public'};
          return {result,replay:hooks.replay===true,snapshot:hooks.noRoom ? null : hooks.badSnapshot ? {...snapshot(),me:{id:'bob'}} : snapshot()};
        } },
      };
    },
    createPresentationAccess: ports => ({ async withSharedCommittedReceipt(args,select) {
      assert.equal(typeof ports.withLockedRead,'function'); assert.equal(typeof ports.readPresentationLocked,'function');
      return hooks.presentation(args,select);
    } }),
    createChannel: () => ({ emitCommitted(room) { assert.equal(state.active, false); trace.push('hint'); hinted.push(room); },
      emitActorsCommitted(actors,options) { assert.equal(state.active,false); actorsHinted.push({actors:[...actors],...options}); }, close() {} }),
    createUpgrade: () => ({ handleUpgrade() {}, close() {} }),
  });
  t.after(() => service.close());
  const request = signal => new Request('https://player.invalid/api/shared-room/room-a/command',
    {method:'POST',signal,headers:{origin:'https://player.invalid','content-type':'application/json'},body:'{}'});
  const command = (signal, extra = {}) => service.command(request(signal), {roomId:'room-a',
    input:{roomId:'room-a',op:'refill',commandId:'refill-1',...extra}});
  return {service,state,trace,hinted,actorsHinted,binding,command,options:()=>runtimeOptions};
}

test('shared command authorizes after locks and before receipts, projects inside the outer transaction, and hints only after commit', async t => {
  const h=fixture(t); await h.service.start(); const result=await h.command();
  assert.deepEqual(h.trace,['initial-binding','begin','table-locks','locked-auth','receipt-read','commit','hint']);
  assert.equal(h.state.writes,1); assert.equal(result.replay,false);
  assert.deepEqual(result.result,{op:'refill',version:1});
  assert.equal(result.snapshot.me.id,'alice');
  assert.equal(Object.hasOwn(result.snapshot.me,'privateToken'),false);
  assert.equal(Object.hasOwn(result.snapshot,'audit'),false);
  assert.deepEqual(h.actorsHinted,[{actors:['alice'],exceptRoom:'room-a'}]);
});

test('actor hints use all locked players and wait for outer COMMIT; rollback and replay publish none',async t=>{
  const entered=deferred(),release=deferred();
  const h=fixture(t,{actors:['alice','bob'],commit:async()=>{entered.resolve();await release.promise;}});await h.service.start();
  const pending=h.command();await entered.promise;assert.deepEqual(h.actorsHinted,[]);assert.deepEqual(h.hinted,[]);
  release.resolve();await pending;assert.deepEqual(h.actorsHinted,[{actors:['alice','bob'],exceptRoom:'room-a'}]);
  const failure=new Error('COMMIT failed'),bad=fixture(t,{commit:()=>{throw failure;}});await bad.service.start();
  await assert.rejects(bad.command(),error=>error===failure);assert.equal(bad.state.writes,0);assert.deepEqual(bad.actorsHinted,[]);assert.deepEqual(bad.hinted,[]);
  const replay=fixture(t,{replay:true});await replay.service.start();await replay.command();assert.deepEqual(replay.actorsHinted,[]);
});

test('service cannot mistake a nested transaction return for the outer COMMIT',async t=>{
  const h=fixture(t);await h.service.start();const owner={closed:false,failed:null};
  await assert.rejects(runPostgresTransactionOwner(owner,()=>h.command()),/must own the outer unit/);
  assert.deepEqual(h.trace,[]);assert.equal(h.state.writes,0);assert.deepEqual(h.actorsHinted,[]);
});

test('forged authority cannot bypass the private admission token or execute outside the service transaction', async t => {
  const h=fixture(t); await h.service.start();
  await assert.rejects(h.options().authorizeCommand({}, {actorId:'alice',roomId:'room-a',
    authority:{binding:h.binding,signal:new AbortController().signal}}), {statusCode:503});
  assert.equal(h.state.writes,0); assert.deepEqual(h.trace,[]);
});

test('revoked authority denies even receipt replay before reading receipt or mutating state', async t => {
  const h=fixture(t,{denied:true,replay:true}); await h.service.start();
  await assert.rejects(h.command(),{statusCode:403});
  assert.deepEqual(h.trace,['initial-binding','begin','table-locks','locked-auth','rollback']);
  assert.equal(h.state.writes,0);
});

test('a mismatched snapshot rolls back the command instead of disclosing another player or committing a broken result', async t => {
  const h=fixture(t,{badSnapshot:true}); await h.service.start();
  await assert.rejects(h.command(),{code:'shared_room_unavailable',statusCode:503});
  assert.equal(h.state.writes,0); assert.equal(h.trace.at(-1),'rollback');
  assert.equal(h.trace.includes('hint'),false);
});

test('unknown identity fields and mismatched input room are denied before authorizing or touching storage', async t => {
  const h=fixture(t); await h.service.start();
  await assert.rejects(h.command(undefined,{actorId:'bob'}),{code:'shared_room_invalid_command'});
  await assert.rejects(h.command(undefined,{roomId:'room-b'}),{code:'shared_room_invalid_command'});
  assert.equal(h.state.writes,0); assert.deepEqual(h.trace,[]);
});

test('shutdown rejects and drains an awaiting command without committing it or returning a successful reply', async t => {
  const entered=deferred(), release=deferred();
  const h=fixture(t,{authority:async()=>{entered.resolve();await release.promise;}});
  await h.service.start();
  const pending=h.command(), rejected=assert.rejects(pending,error=>error?.name==='AbortError');
  await entered.promise;
  let stopped=false; const closing=h.service.close().then(()=>{stopped=true;});
  await turn(); assert.equal(stopped,false);
  release.resolve(); await rejected; await closing;
  assert.equal(stopped,true); assert.equal(h.state.writes,0); assert.equal(h.trace.at(-1),'rollback');
});


test('a command that advances presentation waits for receiver notification instead of hinting an inconsistent frame', async t => {
  const h=fixture(t,{presentationVer:1}); await h.service.start();
  const result=await h.command();
  assert.equal(result.snapshot.presentationVer,1); assert.equal(h.state.writes,1);
  assert.equal(h.trace.at(-1),'commit'); assert.equal(h.trace.includes('hint'),false);
});

test('pause before the first join commits with a null snapshot instead of being rolled back by projection', async t => {
  const h=fixture(t,{noRoom:true}); await h.service.start();
  const result=await h.command(undefined,{op:'pause'});
  assert.equal(result.snapshot,null); assert.equal(result.result.op,'pause');
  assert.equal(h.state.writes,1); assert.equal(h.trace.at(-1),'commit');
});

test('global pause privately notifies all server-selected affected rooms only after commit', async t => {
  const h=fixture(t,{rooms:['room-a','room-b']});await h.service.start();
  const result=await h.command(undefined,{op:'pause'});
  assert.deepEqual(h.hinted,['room-a','room-b']);
  assert.equal(Object.hasOwn(result.result,'rooms'),false);
  assert.ok(h.trace.indexOf('commit')<h.trace.indexOf('hint'));
});

test('shared presentation service forwards authenticated request and lifecycle signal to its composed read port',async t=>{
  let calls=0;
  const h=fixture(t,{presentation:async(args,select)=>{
    calls++; assert.equal(args.playerId,'alice'); assert.equal(args.request.headers.get('cookie'),'fixture=opaque');
    assert.equal(args.signal.aborted,false); return select({sourceEvent:{type:'speak',line:'placebets'}},{signal:args.signal});
  }});
  const request=new Request('https://player.invalid/api/presentation/select',{method:'POST',headers:{cookie:'fixture=opaque'}});
  await assert.rejects(h.service.withSharedCommittedReceipt({request,playerId:'alice',body:{}},()=>({})),{statusCode:503});
  assert.equal(calls,0);await h.service.start();
  const result=await h.service.withSharedCommittedReceipt({request,playerId:'alice',body:{}},async(capture,{signal})=>{
    signal.throwIfAborted(); assert.equal(capture.sourceEvent.line,'placebets');return {video:null};
  });
  assert.deepEqual(result,{video:null});assert.equal(calls,1);assert.equal(h.service.health().inFlight,false);
});

test('shutdown aborts and drains a shared presentation selection and refuses late success',async t=>{
  const entered=deferred(),release=deferred();let signal;
  const h=fixture(t,{presentation:async(args)=>{signal=args.signal;entered.resolve();await release.promise;args.signal.throwIfAborted();return {video:null};}});
  await h.service.start();
  const request=new Request('https://player.invalid/api/presentation/select',{method:'POST'});
  const pending=h.service.withSharedCommittedReceipt({request,playerId:'alice',body:{}},()=>({}));
  const rejected=assert.rejects(pending,error=>error?.name==='AbortError');await entered.promise;
  assert.equal(h.service.health().inFlight,true);let done=false;
  const closing=h.service.close().then(()=>{done=true;});await turn();assert.equal(done,false);assert.equal(signal.aborted,true);
  release.resolve();await rejected;await closing;assert.equal(done,true);assert.equal(h.service.health().inFlight,false);
});

// Real service, coordinator, scheduler and read channel; only persistence/auth,
// the presentation receiver and websocket carrier are isolated fixture ports.
// This is no PostgreSQL, publication-policy or real media acceptance.
async function walletFixture(t,{betMs=20000}={}) {
  const store=createMemoryTableStore(),revoked=new Set(),reads=[];let at=100000,n=0,runtime;
  store.assertInstalled=async()=>{};store.test.fund('alice',100);store.test.fund('bob',100);store.test.publish('wallet-config',{betMs});
  const origin='https://wallet.invalid';
  const valid=b=>!revoked.has(`${b.actorId}:${b.roomId}`);
  const service=createSharedRoomService({pool:{connect(){assert.fail('memory fixture must not use SQL');},query(){}},
    walletMode:'demo',origin,engineOrigin:origin,scope:{environment:'test',workspaceId:'wallet'},
    clock:{now:()=>at},random:deterministicRandom('wallet-fanout'),
    repository:{async sharedTransaction(work){return work();}}}, {
    createAccess:()=>({
      async authorize(req,{roomId}) {const b={actorId:req.headers.get('cookie'),roomId,sessionId:'session-'+req.headers.get('cookie'),
        operatorId:'operator-a',packageRevision:1,expiresAt:Date.now()+60000};if(!valid(b))throw Object.assign(Error('revoked'),{statusCode:403});return b;},
      async revalidate(b) {reads.push([b.actorId,b.roomId]);return valid(b)?b:null;},
      async revalidateLocked(b) {if(!valid(b))throw Object.assign(Error('revoked'),{statusCode:403});return b;},
    }),
    createReceiver:()=>({async assertInstalled(){},async sink(){return 'applied';},async current(roomId){
      const room=await store.read.room(roomId);return room?{roomId,ver:room.presentationVer,talkId:'talk-'+room.presentationVer,
        auditSeq:room.presentationVer,kind:null,status:'legacy',events:[],lines:[]}:null;
    }}),
    createRuntime:options=>(runtime=createPostgresTableRuntime(options,{createStore:()=>store,setTimer:()=>({unref(){}}),clearTimer(){}})),
    createUpgrade:options=>({handleUpgrade:async(req,socket)=>(await options.channel.prepare(req)).attach(socket),close(){}}),
  });
  t.after(()=>service.close());await service.start();
  class Socket extends EventEmitter {
    readyState=1;bufferedAmount=0;frames=[];closed=[];
    send(value,done){this.frames.push(JSON.parse(value));done?.();}
    close(code,reason){this.readyState=3;this.closed.push({code,reason});this.emit('close');}
  }
  const request=(room,actor='alice')=>new Request(`${origin}/shared-room/${room}`,{headers:{origin,cookie:actor}});
  return {store,service,revoked,reads,get runtime(){return runtime;},get at(){return at;},set at(value){at=value;},
    async attach(room,actor='alice'){const socket=new Socket();await service.handleUpgrade(request(room,actor),socket);return socket;},
    send(op,extra={},actor='alice',roomId='room-a'){return service.command(request(roomId,actor),{roomId,input:{roomId,op,commandId:`wallet-${++n}`,...extra}});},
    async join(){const s=await runtime.coordinator.snapshot('room-a','alice');return this.send('join',{seats:[0],seatGens:{0:s?.seatGen[0]??0},memberGen:s?.me.memberGen??0});},
    async bet(chip=25){const s=await runtime.coordinator.snapshot('room-a','alice');return this.send('bet',{windowId:s.windowId,seat:0,field:'main',chip});},
  };
}
async function walletUntil(check){for(let i=0;i<200;i++){if(check())return;await turn();}assert.fail('wallet refresh did not arrive');}
const lastAvailable=socket=>socket.frames.at(-1)?.snapshot.me.available;

test('real command reserve/refill in A refreshes inactive bootstrap B for the same actor only',async t=>{
  const h=await walletFixture(t);await h.join();
  const a=await h.attach('room-a'),b=await h.attach('room-b'),other=await h.attach('room-b','bob');
  await walletUntil(()=>a.frames.length&&b.frames.length&&other.frames.length);
  assert.equal(b.frames[0].snapshot.unopened,true);assert.equal(b.frames[0].snapshot.me.active,false);
  await h.bet();await walletUntil(()=>lastAvailable(a)===75&&lastAvailable(b)===75);
  assert.equal(h.store.test.balance('alice'),100,'the bet reserves rather than debits');assert.equal(other.frames.length,1);
  await h.send('refill');await walletUntil(()=>lastAvailable(b)===1075);
  assert.equal(h.store.test.balance('alice'),1100);assert.equal(other.frames.length,1);
  assert.ok(b.frames.every(f=>f.roomId==='room-b'&&f.snapshot.me.id==='alice'&&f.presentation===null));
});

test('real payout tick refreshes actor B even when no socket observes source room A',async t=>{
  const h=await walletFixture(t);await h.join();await h.bet();
  h.store.test.mutateRoom('room-a',r=>{const ranks=['10','9','10','7','10'];r.game.shoe.cards.splice(-ranks.length,ranks.length,
    ...ranks.map((r,i)=>({r,s:['♠','♦','♥','♣'][i%4],serial:900+i})).reverse());});
  const b=await h.attach('room-b');await walletUntil(()=>lastAvailable(b)===75);
  let s=await h.runtime.coordinator.snapshot('room-a','alice');h.at=s.deadline;await h.runtime.pump();
  s=await h.runtime.coordinator.snapshot('room-a','alice');assert.equal(s.phase,'round');h.at=s.plan.turnAt;
  await h.send('act',{action:'stand',roundId:s.roundId,turnSeq:s.turnSeq,box:0,handIndex:s.round.active});
  s=await h.runtime.coordinator.snapshot('room-a','alice');h.at=s.plan.endAt;await h.runtime.pump();
  await walletUntil(()=>lastAvailable(b)===125);assert.equal(h.store.test.balance('alice'),125);
  assert.ok(h.store.test.ledger().some(row=>row.kind==='payout'&&row.amountCents===5000));
});

test('reservation release tick without outbox refreshes B; revoked B receives no wallet data',async t=>{
  const h=await walletFixture(t,{betMs:300000});await h.join();await h.bet();
  const b=await h.attach('room-b');await walletUntil(()=>lastAvailable(b)===75);
  const outbox=h.store.test.outbox().length;h.at+=120000;
  const result=await h.runtime.pump();assert.ok(result.ticks.some(row=>row.kind==='seat.release'&&row.outcome==='applied'));
  assert.equal(h.store.test.outbox().length,outbox);await walletUntil(()=>lastAvailable(b)===100);
  await h.join();await h.bet();await walletUntil(()=>lastAvailable(b)===75);
  h.revoked.add('alice:room-b');const frames=b.frames.length;
  await h.send('refill');await walletUntil(()=>b.closed.length===1);assert.equal(b.closed[0].code,1008);assert.equal(b.frames.length,frames);
});

test('an isolated room fault keeps the service ready; only a blocked room refuses commands before any transaction', async t => {
  const fault = { roomId: 'room-a', failures: 1, blocked: false, since: 10, lastErrorAt: 10, retryAt: 260, error: 'private detail' };
  const h = fixture(t, { roomFaults: [fault] }); await h.service.start();
  const health = h.service.health();
  assert.equal(health.ready, true); assert.equal(health.failed, false);
  assert.deepEqual(health.rooms, [{ roomId: 'room-a', failures: 1, blocked: false, since: 10, lastErrorAt: 10, retryAt: 260 }]);
  assert.doesNotMatch(JSON.stringify(health), /private detail/);
  await h.command(); assert.equal(h.state.writes, 1, 'a first failure does not close the room');
  fault.failures = 3; fault.blocked = true;
  await assert.rejects(h.command(undefined, { commandId: 'refill-2' }), { statusCode: 503, code: 'shared_room_unavailable' });
  assert.equal(h.state.writes, 1); assert.equal(h.trace.filter(step => step === 'begin').length, 1);
  assert.equal(h.service.health().ready, true, 'one blocked room never closes readiness for the other rooms');
});
