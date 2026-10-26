import assert from 'node:assert/strict';
import test from 'node:test';
import {parseEdgeParams,setEdgeParams,edgeParams,EDGE_DEFAULTS,EDGE_LIMITS} from '../services/game/public/actor-edge-blend.mjs';

test('edge parameters parse from ?edge=erode,feather,wrap with defaults and clamps',()=>{
  assert.deepEqual(parseEdgeParams(''),EDGE_DEFAULTS);
  assert.deepEqual(parseEdgeParams('?edge=1,2,0.15'),{erode:1,feather:2,wrap:.15});
  assert.deepEqual(parseEdgeParams('?dealer=astrid&edge=0,0,0'),{erode:0,feather:0,wrap:0});
  assert.deepEqual(parseEdgeParams('?edge=2'),{...EDGE_DEFAULTS,erode:2});
  assert.deepEqual(parseEdgeParams('?edge=,3'),{...EDGE_DEFAULTS,feather:3});
  assert.deepEqual(parseEdgeParams('?edge=99,-1,5'),{erode:EDGE_LIMITS.erode[1],feather:0,wrap:EDGE_LIMITS.wrap[1]});
  assert.deepEqual(parseEdgeParams('?edge=abc,x,y'),EDGE_DEFAULTS);
  assert.equal(EDGE_DEFAULTS.erode,1);assert.equal(EDGE_DEFAULTS.feather,2);assert.equal(EDGE_DEFAULTS.wrap,.15);
});

test('live tuning clamps and updates the shared parameters',()=>{
  const before={...edgeParams};
  assert.deepEqual(setEdgeParams({wrap:'0.3',erode:'9'}),{...before,wrap:.3,erode:EDGE_LIMITS.erode[1]});
  assert.deepEqual(setEdgeParams({feather:'nope'}),{...before,wrap:.3,erode:EDGE_LIMITS.erode[1]});
  setEdgeParams(before);
});
