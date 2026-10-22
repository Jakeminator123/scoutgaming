import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as turn } from 'node:timers/promises';
import { createSharedRoomService } from '../services/game/shared-room-service.mjs';

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function fixture(t, hooks = {}) {
  const trace = [], hinted = [], state = { writes: 0, active: false };
  const binding = Object.freeze({ actorId: 'alice', sessionId: 'player-' + 'a'.repeat(64), roomId: 'room-a',
    operatorId: 'operator-a', packageRevision: 1, expiresAt: Date.now() + 60000 });
  let runtimeOptions, running = false;
  const snapshot = () => ({ contract: 'blackjack-table/1', roomId: 'room-a', version: state.writes,
    presentationVer: hooks.presentationVer ?? 0, configVersion: 'config-a', windowId: 'window-a', me: { id: 'alice', privateToken: 'omit' },
    audit: [{secret: 'omit'}] });
  const repository = { async sharedTransaction(work, options) {
    assert.deepEqual(options, {serialize:true}); assert.equal(state.active, false);
    const before = state.writes; state.active = true; trace.push('begin');
    try { const value = await work(); trace.push('commit'); return value; }
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
        health: () => ({running, failed:false}),
        coordinator: { async command(context, input) {
          assert.equal(state.active, true); assert.equal(input.roomId, 'room-a');
          trace.push('table-locks');
          await options.authorizeCommand({rooms:{read:async()=>({presentationVer:0})}}, {...context,roomId:input.roomId,commandId:input.commandId});
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
    createChannel: () => ({ emitCommitted(room) { assert.equal(state.active, false); trace.push('hint'); hinted.push(room); }, close() {} }),
    createUpgrade: () => ({ handleUpgrade() {}, close() {} }),
  });
  t.after(() => service.close());
  const request = signal => new Request('https://player.invalid/api/shared-room/room-a/command',
    {method:'POST',signal,headers:{origin:'https://player.invalid','content-type':'application/json'},body:'{}'});
  const command = (signal, extra = {}) => service.command(request(signal), {roomId:'room-a',
    input:{roomId:'room-a',op:'refill',commandId:'refill-1',...extra}});
  return {service,state,trace,hinted,binding,command,options:()=>runtimeOptions};
}

test('shared command authorizes after locks and before receipts, projects inside the outer transaction, and hints only after commit', async t => {
  const h=fixture(t); await h.service.start(); const result=await h.command();
  assert.deepEqual(h.trace,['initial-binding','begin','table-locks','locked-auth','receipt-read','commit','hint']);
  assert.equal(h.state.writes,1); assert.equal(result.replay,false);
  assert.deepEqual(result.result,{op:'refill',version:1});
  assert.equal(result.snapshot.me.id,'alice');
  assert.equal(Object.hasOwn(result.snapshot.me,'privateToken'),false);
  assert.equal(Object.hasOwn(result.snapshot,'audit'),false);
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
