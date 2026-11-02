import assert from 'node:assert/strict';
import test from 'node:test';
import {parseEdgeParams,edgeParams,edgeUniforms,updateEdgeUniforms,EDGE_DEFAULTS,EDGE_LIMITS} from '../../../services/game/public/actor-edge-blend.mjs';

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

test('edge colours follow the rear rail without allocating or sampling a canvas',t=>{
  const previous=new Map(['document','getComputedStyle'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  t.after(()=>{for(const [key,descriptor] of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}});
  let rear='300px',bounds={y:100,height:400};
  globalThis.document={documentElement:{}};
  globalThis.getComputedStyle=element=>{assert.equal(element,document.documentElement);return {getPropertyValue:name=>{assert.equal(name,'--performance-rear');return rear;}};};
  const uniforms=edgeUniforms(),element={getBoundingClientRect:()=>bounds};
  updateEdgeUniforms(uniforms,element);
  assert.equal(uniforms.feltFromV.value,.5);
  assert.deepEqual([uniforms.edgeErode.value,uniforms.edgeFeather.value,uniforms.edgeWrap.value],
    [edgeParams.erode,edgeParams.feather,edgeParams.wrap]);
  assert.deepEqual(uniforms.wrapColour.value.toArray(),[.13,.11,.08]);
  assert.deepEqual(uniforms.feltColour.value.toArray(),[.12,.40,.33]);
  bounds={y:0,height:600};updateEdgeUniforms(uniforms,element);
  assert.equal(uniforms.feltFromV.value,.5);
  rear='';updateEdgeUniforms(uniforms,element);assert.equal(uniforms.feltFromV.value,0);
  rear='300px';bounds={y:100,height:0};updateEdgeUniforms(uniforms,element);assert.equal(uniforms.feltFromV.value,0);
});
