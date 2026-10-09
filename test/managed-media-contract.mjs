import test from 'node:test';
import assert from 'node:assert/strict';
import {validateManagedStudioMedia} from '../web/managed-media-contract.mjs';
import {validateStudioMedia, createRetainedStudioMedia, RETAINED_BANK_VARIANTS} from '../web/storage/studio-contract.mjs';
const id='10000000-0000-4000-8000-000000000001', sha256='a'.repeat(64);
const record=()=>({id,sha256,size:4096,contentType:'video/mp4',pathname:`croupier/media/dealers/johanna/review/uploads/${id}/${sha256}.mp4`,
  classification:{dealerId:'johanna',eventId:'idle.ready',kind:'idle',role:'alternative',situation:'',label:' Johanna ',notes:' Test ',
    compositing:{mode:'green-screen',threshold:.2,softness:.1,despill:0}}});
test('portable and server normal-record validation share exact metadata and immutable path rules',()=>{
  for(const mutate of [()=>{},r=>r.classification.playback='once',r=>r.classification.compositing={mode:'opaque'}]){
    const input=record();mutate(input);
    assert.deepEqual(validateManagedStudioMedia(input),validateStudioMedia(input));
    assert.equal(validateManagedStudioMedia(input).classification.label,'Johanna');
    assert.equal(input.classification.label,' Johanna ');
  }
});
test('normal descriptor corruption is rejected equally on server and browser',()=>{
  for(const mutate of [r=>r.pathname='../file',r=>r.size=15,r=>r.sha256='A'.repeat(64),r=>r.url='https://mutable.invalid',
    r=>r.classification.dealerId='constructor',r=>r.classification.eventId='speak.other',
    r=>r.classification.playback='loop',r=>r.classification.compositing.threshold=2,r=>r.classification.role='unknown']){
    const input=record();mutate(input);
    assert.throws(()=>validateManagedStudioMedia(input),e=>e.code==='studio_invalid_media');
    assert.throws(()=>validateStudioMedia(input));
  }
});
test('accessors and non-data values cannot be invoked while decoding media descriptors',()=>{
  let called=0; const input=record();
  Object.defineProperty(input.classification,'label',{enumerable:true,get(){called++;return 'unsafe';}});
  assert.throws(()=>validateManagedStudioMedia(input)); assert.equal(called,0);
  for(const mutate of [r=>r.extra=Symbol(),r=>r.classification[Symbol('hidden')]='x',r=>r.classification.notes=NaN,
    r=>Object.setPrototypeOf(r.classification,{extra:1}),r=>Object.defineProperty(r,'hidden',{value:'x'})]){
    const next=record();mutate(next);assert.throws(()=>validateManagedStudioMedia(next));
  }
});
test('retained bank authority remains exclusively the existing server contract',()=>{
  for(const source of RETAINED_BANK_VARIANTS){
    const retained=createRetainedStudioMedia(source.id);
    assert.deepEqual(validateStudioMedia(retained),retained);
    assert.throws(()=>validateManagedStudioMedia(retained),e=>e.code==='studio_invalid_media');
  }
});

test('the complete portable package validation import graph has no Node dependency or server-contract cycle',async()=>{
  const {readFile}=await import('node:fs/promises');
  const visited=new Set();
  async function visit(url){
    if(visited.has(url.href)||url.pathname.endsWith('.json'))return;
    visited.add(url.href);const source=await readFile(url,'utf8');
    assert.doesNotMatch(source,/\b(?:Buffer|process|require)\b/,'browser validator does not depend on Node globals');
    for(const match of source.matchAll(/(?:import[\s\S]*?from|export[\s\S]*?from)\s*['"]([^'"]+)['"]/g)){
      assert.ok(match[1].startsWith('.'),'portable imports are relative data/model modules');
      assert.ok(!match[1].includes('storage/studio-contract'),'portable decoding must not create the Studio model/contract cycle');
      await visit(new URL(match[1],url));
    }
  }
  await visit(new URL('../web/presentation-layers.mjs',import.meta.url));
  assert.ok(visited.size>=4);
});
