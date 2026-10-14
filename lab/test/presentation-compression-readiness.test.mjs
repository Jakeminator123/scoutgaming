import test from 'node:test';
import assert from 'node:assert/strict';
import {wrapNativePresentationRepository,PRESENTATION_RUNTIME_UPDATE_REQUIRED} from '../lib/presentation-runtime-readiness.mjs';
import {presentationCapabilitiesForVersion} from '../../web/presentation-capability-contract.mjs';
import {encodePresentationPackage} from '../../web/storage/presentation-package.mjs';
import {filmedPresentationFixture} from '../../test/fixtures/filmed-presentation.mjs';

const blocked=error=>error.code===PRESENTATION_RUNTIME_UPDATE_REQUIRED&&error.statusCode===503;
const large=filmedPresentationFixture();
function compact(){
  const value=structuredClone(large),ids=new Set(value.registeredDealers.map(dealer=>dealer.idle.id));
  for(const line of value.playback.lines){
    line.variants=line.variants.slice(0,line.eventId==='deal.player.centre'?7:1);
    for(const variant of line.variants)if(variant.videoGenerationId)ids.add(variant.videoGenerationId);
  }
  value.playback.media=value.playback.media.filter(row=>ids.has(row.id));
  assert.equal(encodePresentationPackage(value).encoding,'gzip-base64url');
  return value;
}
function fixture(maxVersion=18){
  const events=[];
  const repository={
    async saveDocument(kind,{value}){events.push('write');return value;},
    async transaction(work){events.push('sql');return work(repository);},
  };
  const wrapped=wrapNativePresentationRepository(repository,{env:{CROUPIER_BACKEND_ORIGIN:'https://render.example.invalid'},
    fetchImpl:async(_url,{headers})=>{
      const requested=Number(headers['X-Presentation-Capability-Version']);events.push('http:'+requested);
      return Response.json(presentationCapabilitiesForVersion(Math.min(requested,maxVersion)));
    }});
  return {wrapped,events};
}
const publication=value=>({kind:'presentation-package',value});
const publish=(wrapped,value)=>wrapped.transaction(repo=>repo.saveDocument('presentation-package',{value}),{presentationMutation:publication(value)});

test('35-take candidate requires v18 before SQL or any write and round-trips the full value',async()=>{
  assert.equal(encodePresentationPackage(large).encoding,'br-base64url');
  const old=fixture(17);await assert.rejects(()=>publish(old.wrapped,large),blocked);assert.deepEqual(old.events,['http:18']);
  const current=fixture();assert.deepEqual(await publish(current.wrapped,large),large);assert.deepEqual(current.events,['http:18','sql','write']);
});

test('a complete gzip candidate retains v17 while malformed candidate hints never reach HTTP or SQL',async()=>{
  const current=fixture(17),small=compact();await publish(current.wrapped,small);assert.deepEqual(current.events,['http:17','sql','write']);
  for(const value of [{schemaVersion:3},null,{...small,unexpected:true}]){
    const rejected=fixture();await assert.rejects(()=>publish(rejected.wrapped,value),error=>error.statusCode===422);
    assert.deepEqual(rejected.events,[]);
  }
});

test('nested contexts cannot introduce Brotli after negotiating only the same gzip feature set',async()=>{
  const current=fixture(),small=compact();
  await assert.rejects(()=>current.wrapped.withMutationContext(()=>publish(current.wrapped,large),publication(small)),blocked);
  assert.deepEqual(current.events,['http:17']);
  const direct=fixture();
  await assert.rejects(()=>direct.wrapped.withMutationContext(()=>direct.wrapped.saveDocument('presentation-package',{value:large}),publication(small)),blocked);
  assert.deepEqual(direct.events,['http:17']);
  const admitted=fixture();await admitted.wrapped.withMutationContext(()=>publish(admitted.wrapped,large),publication(large));
  assert.deepEqual(admitted.events,['http:18','sql','write']);
});

test('a late enlargement inside SQL is rejected locally without another fetch or a write',async()=>{
  const current=fixture();
  await assert.rejects(()=>current.wrapped.transaction(repo=>repo.saveDocument('presentation-package',{value:large}),
    {presentationMutation:publication(compact())}),blocked);
  assert.deepEqual(current.events,['http:17','sql']);
});

test('explicit lifecycle operations require current table layouts and both codecs before SQL, including retained branding',async()=>{
  for(const kind of ['material-trash','resource-lifecycle','dealer-archive']){
    const descriptor={kind,value:{}};
    for(const version of [17,18]){
      const old=fixture(version);await assert.rejects(()=>old.wrapped.transaction(()=>old.events.push('package-write'),{presentationMutation:descriptor}),blocked);
      assert.deepEqual(old.events,['http:19']);
    }
    const current=fixture(19);await current.wrapped.transaction(()=>current.events.push('package-write'),{presentationMutation:descriptor});
    assert.deepEqual(current.events,['http:19','sql','package-write']);
    const nested=fixture();await assert.rejects(()=>nested.wrapped.withMutationContext(()=>nested.wrapped.transaction(()=>nested.events.push('package-write'),
      {presentationMutation:descriptor}),publication(compact())),blocked);
    assert.deepEqual(nested.events,['http:17']);
  }
});
