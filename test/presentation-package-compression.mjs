import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gzipSync,brotliCompressSync} from 'node:zlib';
import {createSeedProject,defaultPresentationLane} from '../packages/presentation/contracts/studio-model.mjs';
import {buildPresentationPackage} from '../web/presentation-layers.mjs';
import {canonicalStudioJson} from '../web/storage/studio-contract.mjs';
import {encodePresentationPackage,decodePresentationPackage,withPackagePresentation} from '../web/storage/presentation-package.mjs';
import {filmedPresentationFixture} from './fixtures/filmed-presentation.mjs';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const small=()=>{const project=createSeedProject();project.lanes=[defaultPresentationLane('astrid')];return buildPresentationPackage(project,[project.lanes[0].id],[]);};
const invalid=error=>error.statusCode===503;
test('old small gzip envelope remains byte-identical and decodes unchanged',()=>{
  const value=small(),bytes=Buffer.from(canonicalStudioJson(value)),expected={format:'croupier-lanes-v1',encoding:'gzip-base64url',sha256:digest(bytes),data:gzipSync(bytes).toString('base64url')};
  assert.deepEqual(encodePresentationPackage(value),expected);assert.deepEqual(decodePresentationPackage(expected),value);
});
test('35 exact filmed takes, idle, source facts and two layers fit without removing any field',()=>{
  const value=filmedPresentationFixture(),bytes=Buffer.from(canonicalStudioJson(value));
  assert.equal(value.playback.media.length,36);assert.equal(value.assets.length,2);
  assert.ok(gzipSync(bytes).toString('base64url').length>6500);
  const envelope=encodePresentationPackage(value);assert.equal(envelope.encoding,'br-base64url');assert.ok(envelope.data.length<=7400);
  assert.equal(envelope.sha256,digest(bytes));assert.equal(canonicalStudioJson(decodePresentationPackage(envelope)),bytes.toString('utf8'));
  assert.ok(Buffer.byteLength(canonicalStudioJson(withPackagePresentation({name:'Fixture'},value)))<=8000);
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
  for(const presentation of [small(),filmedPresentationFixture()])assert.throws(()=>withPackagePresentation({name:'x'.repeat(8000)},presentation),error=>error.statusCode===413);
});
