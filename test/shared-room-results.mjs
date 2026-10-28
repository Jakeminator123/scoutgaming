import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedRoomResultPending as pending } from '../services/game/public/shared-room-results.mjs';
import { createSharedRoomController } from '../services/game/public/shared-room-controller.mjs';

const settled = (at = 1000) => ({ contract:'blackjack-table/1', roomId:'result-room', version:1, presentationVer:1,
  configVersion:'config-1', windowId:'window-1', phase:'settled', roundId:'round-1', turnSeq:1,
  owners:['alice',null,null,null,null,null,null], seatGen:[1,0,0,0,0,0,0],
  bets:Array.from({length:7},() => ({main:0,pp:0,tp:0})), players:[], serverNow:at,
  deadline:null, actionDeadline:null, plan:{endAt:at+100}, round:null,
  settings:{configVersion:'config-1',language:'sv',limits:{min:1,max:100,sideMax:10},chips:[1,5],refill:1000},
  me:{id:'alice',memberGen:1,seats:[0],available:1010,pausedUntil:0,lastSettlement:{roundId:'round-1',returned:20}} });

test('result waits for both server plan end and presentation completion', () => {
  const snapshot = settled();
  assert.equal(pending({snapshot,serverNow:1099}),true);
  assert.equal(pending({snapshot,serverNow:1100}),false);
  assert.equal(pending({snapshot,serverNow:1200,presenting:true}),true);
  assert.equal(pending({snapshot,serverNow:1200,presenting:false}),false);
  assert.equal(snapshot.me.available,1010,'display gating never alters the server balance');
});

test('sending, offline and lack of next authority do not hide an already completed result', () => {
  assert.equal(pending({snapshot:settled(),serverNow:1200,busy:true,connected:false,can:{next:false}}),false);
});

test('previous settlement, absent plan and reconnect after plan end need no replay or extra delay', () => {
  assert.equal(pending({}),false);
  assert.equal(pending({snapshot:{...settled(),phase:'bets'},presenting:true}),false);
  assert.equal(pending({snapshot:{...settled(),phase:'round'},presenting:true}),false);
  assert.equal(pending({snapshot:{...settled(),plan:null}}),false);
  assert.equal(pending({snapshot:settled(),serverNow:5000}),false);
});

test('invalid presentation timestamps fail closed instead of revealing a fresh result', () => {
  for (const endAt of [NaN,Infinity,'1100']) assert.equal(pending({snapshot:{...settled(),plan:{endAt}},serverNow:1200}),true);
  assert.equal(pending({snapshot:settled(),serverNow:NaN}),true);
});

test('real controller exposes presentation separately from command busy and redraws on completion', async t => {
  let model, finish, clock = 1000;
  const calls = [], commands = {state:'idle',send:async intent => {calls.push(intent);return {status:'ok',result:{op:intent.op,version:2}};},stop(){}};
  const view = {bind(){},render(value){model=value;},close(){}};
  const presentation = {restoreSnapshot(){},present:() => new Promise(resolve => {finish=resolve;}),close(){finish?.();}};
  const controller = createSharedRoomController({roomId:'result-room',commands,view,presentation,now:() => clock});
  t.after(() => controller.stop());
  await controller.restoreSnapshot(settled());
  assert.equal(pending(model),true);
  const playing = controller.present({});
  assert.equal(model.presenting,true);
  clock = 1200; controller.focusSeat(0);
  assert.equal(pending(model),true,'server end alone does not hide a still-running presentation');
  assert.equal(model.can.next,false);
  finish(); await playing;
  assert.equal(model.presenting,false); assert.equal(pending(model),false); assert.equal(model.can.next,true);
  await controller.dispatch('next');
  assert.equal(model.busy,true,'waiting for the authoritative websocket');
  assert.equal(model.presenting,false); assert.equal(pending(model),false,'no result flicker while sending next');
  assert.deepEqual(calls,[{op:'next',roundId:'round-1'}]);
});

test('existing controller timer reveals result at end without a new snapshot or a second clock', {timeout:2000}, async t => {
  let model, completed;
  const done = new Promise(resolve => {completed=resolve;});
  const controller = createSharedRoomController({roomId:'result-room',commands:{state:'idle',stop(){}},
    view:{bind(){},render(value){model=value;if(value.can.next)completed();},close(){}},
    presentation:{restoreSnapshot(){},present(){},close(){}}});
  t.after(() => controller.stop());
  await controller.restoreSnapshot(settled(Date.now()));
  assert.equal(pending(model),true);
  await done;
  assert.equal(pending(model),false); assert.equal(model.presenting,false);
});
