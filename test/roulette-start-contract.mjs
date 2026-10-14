import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRouletteStartBinding,validateFrozenRouletteStart} from '../web/public/roulette-start-contract.mjs';

const binding=()=>({videoId:'30000000-0000-4000-8000-000000000001',tableDesignId:'roulette-anna-v1',durationMs:10042,wheelImpulseMs:2500,ballReleaseMs:4200,foregroundPolygons:[[[0,0],[1,0],[1,1]]]});
const record=()=>({id:binding().videoId,contentType:'video/webm',classification:{dealerId:'anna-jonsson',game:'roulette',eventId:'roulette.wheel-start',action:'wheel-start',situation:'wheel-start',kind:'action',playback:'once',compositing:{mode:'alpha'},startPose:'VILA',endPose:'VILA',framing:{scale:1,x:0,y:0}}});
const frozen=()=>{const {videoId,...profile}=binding();return {clip:record(),...profile};};

test('roulette start is explicit, design-bound, once-only and independent of idle framing',()=>{
  assert.deepEqual(validateRouletteStartBinding(binding()),binding());
  assert.deepEqual(validateFrozenRouletteStart(frozen(),'anna-jonsson',value=>value),frozen());
  const value=binding();for(const change of [v=>v.videoId='wheel.webm',v=>v.durationMs=NaN,v=>v.durationMs=0,v=>v.durationMs=60001,v=>v.wheelImpulseMs=-1,v=>v.ballReleaseMs=v.durationMs,v=>v.ballReleaseMs=v.wheelImpulseMs-1,v=>v.wheelImpulseMs=.5,v=>v.tableDesignId='blackjack-green-felt',v=>v.tableDesignId='unknown',v=>v.approved=true,v=>v.foregroundPolygons=[[[0,0],[2,0],[1,1]]]]) {
    const copy=structuredClone(value);change(copy);assert.throws(()=>validateRouletteStartBinding(copy));
  }
  let invoked=false;const accessor={...value};Object.defineProperty(accessor,'videoId',{enumerable:true,get(){invoked=true;return value.videoId;}});
  assert.throws(()=>validateRouletteStartBinding(accessor));assert.equal(invoked,false);
});

test('start refuses another game, person, idle action, unverified pose, loop, opaque media or missing framing',()=>{
  for(const change of [v=>v.clip.contentType='video/mp4',v=>v.clip.classification.game='blackjack',v=>v.clip.classification.dealerId='nora',
    v=>v.clip.classification.eventId='roulette.idle',v=>v.clip.classification.action='breathing',v=>v.clip.classification.kind='idle',
    v=>v.clip.classification.startPose='unverified',v=>v.clip.classification.endPose='WHEEL',v=>v.clip.classification.playback='loop',
    v=>delete v.clip.classification.playback,v=>v.clip.classification.archived=true,v=>v.clip.classification.compositing={mode:'opaque'},
    v=>delete v.clip.classification.framing,v=>v.clip.classification.framing.x=99]) {
    const value=frozen();change(value);assert.throws(()=>validateFrozenRouletteStart(value,'anna-jonsson',row=>row));
  }
});
