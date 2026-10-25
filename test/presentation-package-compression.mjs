import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gzipSync,brotliCompressSync,constants} from 'node:zlib';
import {createSeedProject,defaultPresentationLane} from '../packages/presentation/contracts/studio-model.mjs';
import {buildPresentationPackage} from '../packages/presentation/contracts/presentation-layers.mjs';
import {canonicalStudioJson} from '../packages/studio-registry/server/document-contract.mjs';
import {encodePresentationPackage,decodePresentationPackage,withPackagePresentation} from '../packages/presentation/server/presentation-package.mjs';
import {filmedPresentationFixture} from './fixtures/filmed-presentation.mjs';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const small=()=>{const project=createSeedProject();project.lanes=[defaultPresentationLane('astrid')];return buildPresentationPackage(project,[project.lanes[0].id],[]);};
const invalid=error=>error.statusCode===503;
const brotli=(bytes,mode)=>brotliCompressSync(bytes,{params:{[constants.BROTLI_PARAM_QUALITY]:11,[constants.BROTLI_PARAM_MODE]:mode}}).toString('base64url');
function boundaryPresentation(noteLength=36){
  const value=filmedPresentationFixture();
  // Deterministic synthetic source notes cross the text-mode boundary while
  // the alternative remains within it. No production publication is copied.
  value.playback.media.filter(row=>row.classification.kind==='action').forEach((row,index)=>{
    row.classification.notes+=' '+digest('codec-boundary:5:'+index).slice(0,noteLength);
  });
  return value;
}
test('old small gzip envelope remains byte-identical and decodes unchanged',()=>{
  const value=small(),bytes=Buffer.from(canonicalStudioJson(value)),expected={format:'croupier-lanes-v1',encoding:'gzip-base64url',sha256:digest(bytes),data:gzipSync(bytes).toString('base64url')};
  assert.deepEqual(encodePresentationPackage(value),expected);assert.deepEqual(decodePresentationPackage(expected),value);
});
test('35 exact filmed takes, idle, source facts and two layers fit without removing any field',()=>{
  const value=filmedPresentationFixture(),bytes=Buffer.from(canonicalStudioJson(value));
  assert.equal(value.playback.media.length,36);assert.equal(value.assets.length,2);
  assert.ok(gzipSync(bytes).toString('base64url').length>6500);
  const envelope=encodePresentationPackage(value);assert.equal(envelope.encoding,'br-base64url');assert.ok(envelope.data.length<=7400);
  assert.equal(envelope.data,brotli(bytes,constants.BROTLI_MODE_TEXT),'already valid Brotli packages retain their historical bytes');
  assert.equal(envelope.sha256,digest(bytes));assert.equal(canonicalStudioJson(decodePresentationPackage(envelope)),bytes.toString('utf8'));
  assert.ok(Buffer.byteLength(canonicalStudioJson(withPackagePresentation({name:'Fixture'},value)))<=8000);
});

test('alternate Brotli mode fits a text-overflow package without changing any frozen content',()=>{
  const value=boundaryPresentation(),before=structuredClone(value),bytes=Buffer.from(canonicalStudioJson(value));
  assert.ok(gzipSync(bytes).toString('base64url').length>6500);
  assert.ok(brotli(bytes,constants.BROTLI_MODE_TEXT).length>7400,'fixture must exercise text overflow');
  assert.ok(brotli(bytes,constants.BROTLI_MODE_FONT).length<=7400,'fixture must fit the existing decoder limit');
  const envelope=encodePresentationPackage(value),decoded=decodePresentationPackage(envelope);
  assert.equal(envelope.encoding,'br-base64url');assert.ok(envelope.data.length<=7400);assert.equal(envelope.sha256,digest(bytes));
  assert.deepEqual(decoded,value);assert.deepEqual(decoded.playback.media,before.playback.media);assert.deepEqual(decoded.assets,before.assets);
  assert.equal(canonicalStudioJson(decoded),bytes.toString('utf8'));assert.deepEqual(value,before,'encoding cannot mutate source content');
  assert.ok(Buffer.byteLength(canonicalStudioJson(withPackagePresentation({name:'Fixture'},value)))<=8000);
});

test('a package too large for both Brotli modes remains rejected without stripping content',()=>{
  const value=boundaryPresentation(64),before=structuredClone(value),bytes=Buffer.from(canonicalStudioJson(value));
  assert.ok(bytes.length<256*1024);assert.ok(gzipSync(bytes).toString('base64url').length>6500);
  for(const mode of [constants.BROTLI_MODE_TEXT,constants.BROTLI_MODE_FONT])assert.ok(brotli(bytes,mode).length>7400);
  assert.throws(()=>encodePresentationPackage(value),error=>error.statusCode===413);assert.deepEqual(value,before);
});
test('both codecs reject corruption, swapped encoding, wrong hash and oversized data',()=>{
  for(const original of [encodePresentationPackage(small()),encodePresentationPackage(filmedPresentationFixture())]){
    for(const patch of [{sha256:'0'.repeat(64)},{data:'not_valid_data'},{encoding:'unknown'},{data:original.data+'='},
      {encoding:original.encoding==='gzip-base64url'?'br-base64url':'gzip-base64url'},
      {data:'A'.repeat(original.encoding==='gzip-base64url'?6501:7401)}])assert.throws(()=>decodePresentationPackage({...original,...patch}),invalid);
  }
});
test('both codecs enforce bounded expansion, canonical JSON and full input consumption',()=>{
  for(const [encoding,compress]of [['gzip-base64url',gzipSync],['br-base64url',brotliCompressSync]]){
    const envelope=bytes=>({format:'croupier-lanes-v1',encoding,sha256:digest(bytes),data:compress(bytes).toString('base64url')});
    assert.throws(()=>decodePresentationPackage(envelope(Buffer.alloc(256*1024+1,32))),invalid);
    assert.throws(()=>decodePresentationPackage(envelope(Buffer.from(JSON.stringify(small(),null,2)))),invalid);
    const valid=envelope(Buffer.from(canonicalStudioJson(small())));
    assert.throws(()=>decodePresentationPackage({...valid,data:Buffer.concat([Buffer.from(valid.data,'base64url'),Buffer.from('trailing')]).toString('base64url')}),invalid);
  }
});
test('total branding guard stays at 8000 bytes for either encoding',()=>{
  for(const presentation of [small(),filmedPresentationFixture(),boundaryPresentation()])assert.throws(()=>withPackagePresentation({name:'x'.repeat(8000)},presentation),error=>error.statusCode===413);
});
