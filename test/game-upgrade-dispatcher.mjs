import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createGameUpgradeDispatcher} from '../services/game/game-upgrade-dispatcher.mjs';
const settled=()=>new Promise(resolve=>setImmediate(resolve));
function setup() {
  const server=new EventEmitter(),router=createGameUpgradeDispatcher(server),hits=[];
  const socket=()=>Object.assign(new EventEmitter(),{destroyed:false,bytesWritten:0,reply:'',
    end(value,done){this.reply+=value;this.bytesWritten+=Buffer.byteLength(value);done?.();},
    destroy(){if(!this.destroyed){this.destroyed=true;this.emit('close');}}});
  const emit=(url,s=socket())=>{server.emit('upgrade',{url},s,Buffer.from('head'));return s;};
  return {server,router,hits,socket,emit};
}
test('one actual dispatcher invokes exactly the selected owner irrespective of its return',async()=>{
  const {server,router,hits,emit}=setup();
  for(const name of ['room','speech','moving'])router.port(name).on('upgrade',(req,s,head)=>{hits.push([name,req.url,head.toString()]);return name==='room'?true:undefined;});
  for(const url of ['/shared-room/room-a','/speech-stream','/lipsync-worker','/moving-speech-stream','/lipsync-moving/worker-a'])emit(url);
  assert.equal(server.listenerCount('upgrade'),1);
  assert.deepEqual(hits.map(x=>x[0]),['room','speech','speech','moving','moving']);
  assert.ok(hits.every(x=>x[2]==='head'));
  server.emit('close');
});
test('raw path/query reaches the owner unchanged for its strict validation',()=>{
  const {router,hits,emit,server}=setup();
  router.port('room').on('upgrade',req=>hits.push(req.url));
  emit('/shared-room/room-a?actor=forged');emit('/shared-room/room-a#fragment');emit('/shared-room');
  assert.deepEqual(hits,['/shared-room/room-a?actor=forged','/shared-room/room-a#fragment','/shared-room']);
  for(const raw of ['/shared-room-other/room-a','https://evil/shared-room/a','/unknown'])assert.match(emit(raw).reply,/404 Rejected/);
  server.emit('close');
});
test('absent owners are rejected and cannot enter another registered service',()=>{
  const {router,hits,emit,server}=setup();router.port('speech').on('upgrade',()=>hits.push('speech'));
  assert.match(emit('/shared-room/a').reply,/404/);assert.match(emit('/moving-speech-stream').reply,/404/);assert.deepEqual(hits,[]);
  server.emit('close');
});
test('registration and removal preserve exact handler identity and service chaining',()=>{
  const {router,emit,server}=setup(),port=router.port('room'),owner=()=>{};
  assert.equal(port,router.port('room'));assert.equal(port.on('upgrade',owner),port);
  assert.throws(()=>port.on('upgrade',()=>{}));assert.throws(()=>router.port('unknown'));
  assert.throws(()=>port.on('connection',owner));
  assert.equal(port.off('upgrade',()=>{}),port);assert.equal(emit('/shared-room/a').reply,'');
  port.off('upgrade',owner);assert.match(emit('/shared-room/a').reply,/404/);server.emit('close');
});
test('sync throws and async failures reject once before a handshake',async()=>{
  for(const handler of [()=>{throw Error('PRIVATE_ERROR_DETAIL');},()=>Promise.reject(Error('PRIVATE_ERROR_DETAIL'))]){
    const {router,emit,server}=setup();router.port('room').on('upgrade',handler);
    const socket=emit('/shared-room/a');await settled();
    assert.match(socket.reply,/503 Rejected/);assert.equal(socket.reply.includes('PRIVATE_ERROR_DETAIL'),false);assert.equal(socket.reply.match(/HTTP\/1.1/g).length,1);assert.equal(socket.destroyed,true);
    server.emit('close');
  }
});
test('a failure after an owner wrote data destroys without appending a second HTTP status',async()=>{
  const {router,emit,server}=setup();router.port('room').on('upgrade',(_req,socket)=>{socket.end('HTTP/1.1 101 Switching Protocols\r\n\r\n');return Promise.reject(Error('after101'));});
  const socket=emit('/shared-room/a');await settled();assert.equal(socket.reply.match(/HTTP\/1.1/g).length,1);assert.equal(socket.destroyed,true);server.emit('close');
});
test('closing denies admissions while graceful-shutdown observer remains attached',()=>{
  const {server,router,emit}=setup();let observed=0;
  const observer=()=>observed++;server.on('upgrade',observer);
  router.port('room').on('upgrade',()=>{throw Error('must not run');});router.close();router.close();
  assert.match(emit('/shared-room/a').reply,/503/);assert.equal(observed,1);
  assert.throws(()=>router.port('room').on('upgrade',()=>{}));server.emit('close');
  assert.equal(server.listenerCount('upgrade'),1);assert.equal(server.listeners('upgrade')[0],observer);
});
