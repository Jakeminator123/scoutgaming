import test from 'node:test';
import assert from 'node:assert/strict';
import {createGameAudio} from '../public/game-audio.js';

test('audio needs a gesture, ducks under speech, cancels on mute and pauses in a hidden tab',()=>{
 const saved=new Map(),events={},contexts=[];
 const original=Object.fromEntries(['document','Audio','localStorage','window'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 class FakeAudio {volume=1;paused=true;play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}}
 class Context {state='running';currentTime=0;sampleRate=1000;destination={};sounds=0;
  constructor(){contexts.push(this);}addEventListener(){}removeEventListener(){}close(){this.state='closed';return Promise.resolve();}resume(){this.state='running';return Promise.resolve();}
  node(){const p=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});return{connect(n){return n||this},disconnect(){},gain:p(),frequency:p(),Q:p(),threshold:p(),knee:p(),ratio:p(),attack:p(),release:p(),start:()=>this.sounds++,stop(){}};}
  createBuffer(ch,len){return{getChannelData:()=>new Float32Array(len)}}createBufferSource(){return this.node()}createBiquadFilter(){return this.node()}createGain(){return this.node()}createOscillator(){return this.node()}createDynamicsCompressor(){this.compressors=(this.compressors||0)+1;return this.node()}
 }
 try{
 globalThis.document={hidden:false,body:{append(){}},addEventListener:(n,fn)=>events[n]=fn};globalThis.Audio=FakeAudio;globalThis.window={AudioContext:Context};globalThis.localStorage={getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)};
 const a=createGameAudio();a.play('chip');assert.equal(contexts.length,0);assert.equal(a.ambience.paused,true);
 a.unlock();assert.equal(a.ambience.paused,false);a.play('chip');assert.equal(contexts[0].sounds,3);
 a.speech(true);assert.equal(a.ambience.volume,.32*.32);a.speech(false);assert.equal(a.ambience.volume,.32);
 a.set('enabled',false);assert.equal(contexts[0].state,'closed');assert.equal(a.ambience.paused,true);a.play('win');assert.equal(contexts[0].sounds,3);
 a.set('enabled',true);assert.equal(contexts.length,2);assert.equal(contexts[1].sounds,0);
 document.hidden=true;events.visibilitychange();assert.equal(a.ambience.paused,true);assert.equal(contexts[1].state,'closed');
 document.hidden=false;events.visibilitychange();assert.equal(a.ambience.paused,false);assert.equal(contexts[2].sounds,0);
 a.set('ambience',.05);assert.equal(JSON.parse(saved.get('astrid.audio')).ambience,.05);
 }finally{for(const [k,v] of Object.entries(original)){if(v===undefined)delete globalThis[k];else Object.defineProperty(globalThis,k,v);}}
});

test('effects share one softened output bus per context (#3: sharp/noisy mix)',()=>{
 const contexts=[],original=Object.fromEntries(['document','Audio','localStorage','window'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const shelves=[];
 class Context {state='running';currentTime=0;sampleRate=1000;destination={};compressors=0;constructor(){contexts.push(this);}
  p(){return{value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}}}
  node(){return{connect(n){return n||this},disconnect(){},gain:this.p(),frequency:this.p(),Q:this.p(),threshold:this.p(),knee:this.p(),ratio:this.p(),attack:this.p(),release:this.p(),start(){},stop(){}};}
  createBuffer(ch,len){return{getChannelData:()=>new Float32Array(len)}}createBufferSource(){return this.node()}createGain(){return this.node()}createOscillator(){return this.node()}
  createBiquadFilter(){const n=this.node();shelves.push(n);return n}createDynamicsCompressor(){this.compressors++;return this.node()}
  addEventListener(){}removeEventListener(){}resume(){return Promise.resolve()}close(){this.state='closed';return Promise.resolve()}}
 try{
  globalThis.document={hidden:false,body:{append(){}},addEventListener(){}};globalThis.Audio=class{volume=1;paused=true;play(){this.paused=false;return Promise.resolve()}pause(){this.paused=true}};
  globalThis.window={AudioContext:Context};globalThis.localStorage={getItem:()=>null,setItem(){}};
  const a=createGameAudio();a.unlock();
  for(const s of ['chip','pickup','land','gather','stand','timer','win','bigwin'])a.play(s);
  assert.equal(contexts[0].compressors,0);   // no compressor: Web Audio's make-up gain measured louder and hissier
  assert.equal(shelves.filter(n=>n.type==='highshelf').length,1);
  const shelf=shelves.find(n=>n.type==='highshelf');assert.ok(shelf.gain.value<0);
  a.set('enabled',false);a.set('enabled',true);a.unlock();a.play('chip');
  assert.equal(contexts.at(-1).compressors,0);
 }finally{for(const [k,v] of Object.entries(original)){if(v===undefined)delete globalThis[k];else Object.defineProperty(globalThis,k,v);}}
});
