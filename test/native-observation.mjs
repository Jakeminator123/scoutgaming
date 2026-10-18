import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createNativeObservation } from '../services/game/public/native-observation.mjs';

const channel='cc1c94e5-4d2d-455b-a321-262fa4ea48be';
const href=origin=>`https://game.example/?labObserverOrigin=${encodeURIComponent(origin)}&labObserverChannel=${channel}&launch=private-launch`;
test('observation is explicitly opt-in and addresses only loopback or the same HTTPS origin',()=>{
  const messages=[],opener={postMessage:(...args)=>messages.push(args)};
  for(const value of ['',href('https://evil.example'),href('http://localhost.evil.example'),href('http://localhost:4188/path')]) {
    const observer=createNativeObservation({href:value,opener});
    assert.equal(observer.enabled,false);assert.equal(observer.emit('status',{state:'attached'}),false);
  }
  const observer=createNativeObservation({href:href('http://127.0.0.1:4188'),opener});
  assert.equal(observer.enabled,true);observer.emit('status',{state:'attached'});
  assert.equal(messages.length,1);assert.equal(messages[0][1],'http://127.0.0.1:4188');
  assert.equal(messages[0][0].channel,channel);assert.equal(messages[0][0].sequence,1);
  const cloud=createNativeObservation({href:href('https://game.example'),opener});
  assert.equal(cloud.enabled,true);cloud.emit('status',{state:'attached'});
  assert.equal(messages[1][1],'https://game.example');
  assert.equal(createNativeObservation({href:href('https://game.example'),opener:null}).enabled,false);
  assert.equal(createNativeObservation({href:href('http://game.example').replace('https://game.example/?','http://game.example/?'),opener}).enabled,false);
});
test('native observation keeps public correlation and hides credentials and face-down cards',()=>{
  const messages=[],observer=createNativeObservation({href:href('http://localhost:4188'),opener:{postMessage:m=>messages.push(m)}});
  observer.command({op:'start',requestId:'test-request',id:'private-player'},
    {version:4,round:{holeCard:{r:'K',s:'♥'},dealer:[{r:'A',s:'♠'}]},presentation:[{type:'deal',faceDown:true,card:{r:'K',s:'♥'}}],token:'private'},null,'astrid');
  observer.emit('chat',{text:'See https://host.example/path?token=private#secret',cookie:'private'});
  assert.equal(messages[0].payload.requestId,'test-request');
  assert.equal(messages[0].payload.presentation[0].card,null);
  assert.equal(messages[0].payload.view.round.holeCard,undefined);
  assert.equal(messages[1].payload.text,'See https://host.example/path');
  assert.equal(JSON.stringify(messages).includes('private'),false);
});
test('observer cannot throw into gameplay and refuses oversized data without consuming sequence',()=>{
  const bad=createNativeObservation({href:href('http://localhost:4188'),opener:{postMessage(){throw Error('closed');}}});
  assert.equal(bad.emit('playback',{state:'start'}),false);
  const messages=[],observer=createNativeObservation({href:href('http://localhost:4188'),opener:{postMessage:m=>messages.push(m)}});
  assert.equal(observer.emit('chat',{text:'x'.repeat(300000)}),false);
  assert.equal(observer.emit('chat',{text:'å'.repeat(140000)}),false);
  assert.equal(observer.emit('command',{}),true);assert.equal(messages[0].sequence,1);
});
test('continuous idle loops cannot fill the trace but repeated requested speech remains visible',()=>{
  const messages=[],observer=createNativeObservation({href:href('http://localhost:4188'),opener:{postMessage:m=>messages.push(m)}});
  observer.clip('idle-1/idle/idle',1,'astrid');
  observer.clip('idle-1/idle/idle',2,'astrid');
  observer.clip('idle-1/speak/goodluck',3,'astrid');
  observer.clip('idle-1/speak/goodluck',4,'astrid');
  observer.clip('idle-1/idle/idle',5,'astrid');
  assert.deepEqual(messages.map(m=>m.payload.playbackRequestId),[1,3,4,5]);
  assert.deepEqual(messages.map(m=>m.sequence),[1,2,3,4]);
});
