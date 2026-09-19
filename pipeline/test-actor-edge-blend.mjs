import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseEdgeParams,setEdgeParams,edgeParams,EDGE_DEFAULTS,EDGE_LIMITS,edgeBlendGLSL} from '../web/public/actor-edge-blend.mjs';

const dir=path.dirname(fileURLToPath(import.meta.url));
const read=file=>fs.readFileSync(path.resolve(dir,'../web/public',file),'utf8');

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

test('the blend shader softens alpha and wraps colour without blurring RGB, and both compositors use it',()=>{
  for(const name of ['edgeErode','edgeFeather','edgeWrap','sceneTex','sceneRect','wrapColour','feltColour','feltFromV','sceneReady'])assert.ok(edgeBlendGLSL.includes(name),name);
  assert.ok(edgeBlendGLSL.includes('min(actor.a,soft)'),'feather never grows the cleaned silhouette');
  assert.ok(edgeBlendGLSL.includes('mix(rgb,behind,edgeWrap*(1.0-soft))'),'light wrap scales with the outer band only');
  assert.ok(!/rgbAt\(uv\+/.test(edgeBlendGLSL),'RGB is sampled only at the pixel itself');
  for(const file of ['actor-compositor.mjs','performance-player.mjs']){
    const src=read(file);
    assert.ok(src.includes('${edgeBlendGLSL}')&&src.includes('blendEdge(v,cleanActor(v))')&&src.includes('edgeUniforms()')&&src.includes('sceneSampler.update('),file);
  }
});
