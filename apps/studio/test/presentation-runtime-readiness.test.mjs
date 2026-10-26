import {createHash} from 'node:crypto';
import {nativeRoomMaterialFixture,measuredFixtureRecord} from '../../../test/fixtures/native-room-game-material.mjs';
import {filmedPresentationFixture} from '../../../test/fixtures/filmed-presentation.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { wrapNativePresentationRepository, presentationPackageRequiresV30, PRESENTATION_RUNTIME_UPDATE_REQUIRED as CODE } from '../lib/presentation-runtime-readiness.mjs';
import { createNativePresentationMutationTransaction, nativeStudioErrorResponse } from '../lib/studio-native-runtime.mjs';
import { StudioStorageError } from '../../../packages/studio-registry/server/document-contract.mjs';
import {createStudioRepository} from '../../../packages/studio-registry/server/document-repository.mjs';
import {createStudioMemoryPool} from '../../../test/fixtures/studio-memory-pool.mjs';
import {presentationCapabilitiesForVersion} from '../../../packages/presentation/capability-contract.mjs';
import {cloudPresentationFixture} from './fixtures/cloud-presentation.mjs';
import {defaultPresentationLane,createSeedProject} from '../../../packages/presentation/contracts/studio-model.mjs';
import {defaultCompositionSettings,defaultBlackjackTableGeometry,defaultBlackjackAutoScale} from '../../../packages/presentation/contracts/composition-settings.mjs';
import {layerAssetPath,validatePresentationPackage} from '../../../packages/presentation/contracts/presentation-layers.mjs';
import {encodePresentationPackage} from '../../../packages/presentation/server/presentation-package.mjs';
import {extendedDealerMediaFeatures} from '../../../packages/presentation/contracts/dealer-media-features.mjs';

const env = { CROUPIER_BACKEND_ORIGIN: 'https://render.example.invalid' };
const capability = { schemaVersion: 1, registeredDealerIds: ['nora'], compositing: 'per-clip' };
const dealers = ['vera', 'astrid', 'amira', 'mei'];
const project = () => ({ dealers: [...dealers, 'nora'].map(id => ({ id })), lanes: [] });
const blocked = error => error instanceof StudioStorageError && error.code === CODE && error.statusCode === 503 && error.message === CODE;
const invalidPackage=error=>error.message==='studio_invalid_presentation'&&error.statusCode===422;

test('embedded AV metadata negotiates v30 before registering or classifying, even while pending or invalid',async()=>{
  for(const recordedSpeech of [
    {schemaVersion:2,sourceKind:'embedded-mp4-av',review:{status:'pending'}},
    {schemaVersion:2},
    {schemaVersion:1,sourceKind:'embedded-mp4-av'},
  ])for(const operation of ['register','classify']){
    const metadata={dealerId:'astrid',recordedSpeech};
    const f=fixture({fetcher:async(_url,{headers})=>Response.json(presentationCapabilitiesForVersion(Math.min(Number(headers['X-Presentation-Capability-Version']),29)))});
    const write=()=>operation==='register'?f.wrapped.registerMedia({classification:metadata}):f.wrapped.classifyMedia('id',{metadata});
    await assert.rejects(write,blocked);
    assert.equal(f.writes.length,0);
    assert.equal(f.fetches.length,1);
    assert.equal(f.fetches[0][1].headers['X-Presentation-Capability-Version'],'30');
  }
});

test('a v29 measurement context cannot gain embedded AV permission or issue a nested preflight',async()=>{
  const record=measuredFixtureRecord({id:'20000000-0000-4000-8000-000000000001',sha256:'a'.repeat(64),size:4096,
    classification:{dealerId:'astrid',recordedSpeech:recordedSpeech()}});
  const descriptor={metadata:record.classification,mediaTiming:record.mediaTiming};
  const metadata={dealerId:'astrid',recordedSpeech:{schemaVersion:2,sourceKind:'embedded-mp4-av'}};
  const f=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(29))});
  await f.wrapped.withMutationContext(async()=>{
    await assert.rejects(f.wrapped.withMutationContext(()=>assert.fail('no nested embedded AV permission'),{metadata}),blocked);
    await assert.rejects(f.wrapped.registerMedia({classification:metadata}),blocked);
    await assert.rejects(f.wrapped.classifyMedia('id',{metadata}),blocked);
  },descriptor);
  assert.equal(f.writes.length,0);assert.equal(f.fetches.length,1);
  assert.equal(f.fetches[0][1].headers['X-Presentation-Capability-Version'],'29');
});
test('anchor presence gates active, archived and frozen geometry on v21 before any write',async()=>{
  for(const layout of ['mobile','desktop'])for(const anchors of [undefined,null,{}, {cards:{target:'scene',rect:{x:0,y:0,width:1,height:1}}}]){
    const lane={composition:{blackjackTables:[{[layout]:{anchors}}]}};
    for(const descriptor of [{kind:'project',value:{lanes:[lane]}},{kind:'project',value:{dealerTrash:[{compositions:[lane]}]}}])for(const version of [20,21]){
      const f=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(version))});let begun=0;
      f.repository.transaction=async work=>{begun++;return work(f.repository);};
      const work=()=>f.wrapped.transaction(repo=>repo.saveDocument(descriptor.kind,{value:descriptor.value}),{presentationMutation:descriptor});
      if(version===20)await assert.rejects(work,blocked);else await work();
      assert.equal(f.fetches[0][1].headers['X-Presentation-Capability-Version'],'21');assert.equal(begun,version===21?1:0);
    }
  }
  const value=frozenPackage(value=>{
    const id='30000000-0000-4000-8000-000000000001',sha256='d'.repeat(64),contentType='image/png';
    value.assets.push({schemaVersion:1,id,sha256,contentType,size:4096,width:720,height:1280,role:'table',label:'Table',pathname:layerAssetPath({id,sha256,contentType,role:'table'})});
    Object.assign(value.lanes[0].layers.table,{enabled:true,allowed:[id],default:id});
    const board=defaultBlackjackTableGeometry(id);board.desktop.anchors={cards:{target:'scene',rect:{x:.1,y:.2,width:.4,height:.5}}};
    value.lanes[0].composition={...defaultCompositionSettings(),blackjackTables:[board]};
  });
  let version=21;const f=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(version))});
  const work=()=>f.wrapped.saveDocument('presentation-package',{value});await work();version=20;await assert.rejects(work,blocked);assert.equal(f.writes.length,1);
});
test('a declared VILA/REDO pose chain on a blackjack clip gates media writes on v22, not on the roulette v12 feature',async()=>{
  const chained={label:'Plats 1',dealerId:'dragan',eventId:'deal.player.left',kind:'action',role:'alternative',situation:'box0',notes:'',playback:'once',startPose:'VILA',endPose:'REDO'};
  const plain={...chained};delete plain.startPose;delete plain.endPose;
  assert.deepEqual(extendedDealerMediaFeatures(chained),{recordedSpeech:false,recordedEmbeddedAv:false,mediaAlpha:false,rouletteMedia:false,clipPoses:true});
  assert.deepEqual(extendedDealerMediaFeatures(plain),{recordedSpeech:false,recordedEmbeddedAv:false,mediaAlpha:false,rouletteMedia:false,clipPoses:false});
  assert.deepEqual(extendedDealerMediaFeatures({eventId:'roulette.reference',game:'roulette',action:'reference',startPose:'VILA',endPose:'VILA'}),{recordedSpeech:false,recordedEmbeddedAv:false,mediaAlpha:false,rouletteMedia:true,clipPoses:false});
  for(const version of [21,22]){
    const f=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(version))});
    const work=()=>f.wrapped.registerMedia({id:'40000000-0000-4000-8000-000000000001',classification:chained});
    if(version===21)await assert.rejects(work,blocked);else await work();
    assert.equal(f.fetches[0][1].headers['X-Presentation-Capability-Version'],'22');
  }
  // A verified v21 transaction cannot acquire the v22 permission for a chained clip inside it.
  const f=fixture({fetcher:async(_url,init)=>Response.json(presentationCapabilitiesForVersion(Number(init.headers['X-Presentation-Capability-Version']??2)))});
  await f.wrapped.withMutationContext(async()=>{await assert.rejects(f.wrapped.registerMedia({classification:chained}),blocked);},{metadata:plain});
  assert.equal(f.writes.length,0);
});
test('J08 room drafts in the administration document gate every write on v23, even when empty',async()=>{
  for(const value of [{rooms:[],roomGameConfigs:[]},{rooms:[],roomGameConfigs:[{roomId:'room-1'}]}])for(const version of [22,23]){
    const f=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(version))});
    const work=()=>f.wrapped.saveDocument('administration',{value});
    if(version===22)await assert.rejects(work,blocked);else await work();
    assert.equal(f.fetches[0][1].headers['X-Presentation-Capability-Version'],'23');assert.equal(f.writes.length,version===23?1:0);
  }
  const plain=fixture();await plain.wrapped.saveDocument('administration',{value:{rooms:[]}});
  assert.equal(plain.fetches.length,0,'an administration document without drafts keeps its earlier requirement');
  const f=fixture({fetcher:async(_url,init)=>Response.json(presentationCapabilitiesForVersion(Number(init.headers['X-Presentation-Capability-Version']??2)))});
  const rooms={kind:'administration',value:{rooms:[{schemaVersion:2}]}},drafts={kind:'administration',value:{roomGameConfigs:[]}};
  // A context verified without the draft field cannot acquire it while SQL is active.
  await f.wrapped.withMutationContext(async()=>{await assert.rejects(f.wrapped.saveDocument('administration',{value:{rooms:[{schemaVersion:2}],roomGameConfigs:[]}}),blocked);},rooms);
  await f.wrapped.withMutationContext(async()=>{await f.wrapped.saveDocument('administration',{value:{rooms:[{schemaVersion:2}],roomGameConfigs:[]}});},[rooms,drafts]);
  assert.equal(f.writes.length,1);assert.equal(f.fetches.at(-1)[1].headers['X-Presentation-Capability-Version'],'23');
});
test('a preflight without anchors cannot acquire them inside its transaction',async()=>{
  const plain={kind:'project',value:{lanes:[{composition:{blackjackTables:[]}}]}};
  const anchored={lanes:[{composition:{blackjackTables:[{desktop:{anchors:{}}}]}}]};
  const f=fixture({fetcher:async(_url,{headers})=>Response.json(presentationCapabilitiesForVersion(Number(headers['X-Presentation-Capability-Version'])))});
  await assert.rejects(()=>f.wrapped.transaction(repo=>repo.saveDocument('project',{value:anchored}),{fixture:true,presentationMutation:plain}),blocked);
  assert.equal(f.writes.length,0);assert.equal(f.fetches.length,1);
});
test('lifecycle plus saved anchor data performs one v21 preflight and preserves its transaction permission',async()=>{
  const value={lanes:[{composition:{blackjackTables:[{desktop:{anchors:{cards:{target:'scene',rect:{x:0,y:0,width:1,height:1}}}}}]}}]};
  for(const kind of ['material-trash','resource-lifecycle','dealer-archive']){
    const f=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(21))});
    await f.wrapped.transaction(repo=>repo.withMutationContext(inner=>inner.saveDocument('project',{value}),{kind:'project',value}),{fixture:true,presentationMutation:[{kind,value:{}},{kind:'project',value}]});
    assert.equal(f.writes.length,1);assert.equal(f.fetches.length,1);assert.equal(f.fetches[0][1].headers['X-Presentation-Capability-Version'],'21');
  }
});
function frozenPackage(edit=()=>{}, {schemaVersion=3,dealerId='astrid'}={}) {
  const {presentation:value}=cloudPresentationFixture({lanes:[defaultPresentationLane(dealerId)]});
  if(schemaVersion===2){value.schemaVersion=2;delete value.playback;}
  edit(value);
  // These older feature boundaries must stay valid and below the new Brotli/v18 boundary.
  assert.equal(encodePresentationPackage(value).encoding,'gzip-base64url');
  return value;
}
function frozenMedia(metadata={},contentType='video/mp4',n=2) {
  const id=`20000000-0000-4000-8000-${String(n).padStart(12,'0')}`,sha256='a'.repeat(64),extension=contentType.split('/')[1];
  const classification={dealerId:'astrid',eventId:'deal.dealer',kind:'action',role:'alternative',situation:'dealer-up',label:'Fixture media',notes:'',playback:'once',compositing:{mode:'opaque'},...metadata};
  return {id,sha256,size:4096,contentType,pathname:`croupier/media/dealers/astrid/review/uploads/${id}/${sha256}.${extension}`,classification};
}
function bindFrozenMedia(value,media,eventId=media.classification.eventId) {
  const line=value.playback.lines.find(row=>row.dealerId==='astrid'&&row.eventId===eventId);
  line.variants.find(row=>row.id===line.baselineVariantId).videoGenerationId=media.id;
  value.playback.media.push(media);
}
function recordedSpeech() {
  return {schemaVersion:1,dealerId:'astrid',lineId:'goodluck',takeId:'goodluck_1',language:'sv',exactText:'En inspelad testreplik.',
    videoSha256:'a'.repeat(64),audioSha256:'b'.repeat(64),indexSha256:'c'.repeat(64),fps:24,frameCount:72,audioDelayMs:0,
    entryPose:'VILA',exitPose:'VILA',calibrationRevision:'fixture-v1',recording:{status:'pending'},review:{status:'pending'}};
}
function embeddedRecordedSpeech({approved=true,verified=true}={}) {
  const identity={sourceKind:'embedded-mp4-av',dealerId:'astrid',lineId:'goodluck',takeId:'goodluck_1',
    language:'sv',exactText:'En inspelad testreplik.',videoSha256:'a'.repeat(64),fps:24,frameCount:72,
    videoTrackId:1,audioTrackId:2,entryPose:'VILA',exitPose:'VILA'};
  const proof=status=>({status,by:'fixture-reviewer',at:'2026-10-26T00:00:00.000Z',identity:structuredClone(identity)});
  return {schemaVersion:2,...identity,source:verified?proof('verified-embedded-av'):{status:'pending'},review:approved?proof('approved'):{status:'pending'}};
}
function embeddedFrozenPackage() {
  return frozenPackage(value=>bindFrozenMedia(value,measuredFixtureRecord(frozenMedia({eventId:'speak.goodluck',kind:'speech',
    situation:'goodluck',recordedSpeech:embeddedRecordedSpeech()}),{frames:72,fps:24,audioEndUs:3_000_000})));
}
function rouletteMedia(action='breathing',n=3) {
  return frozenMedia({eventId:action==='breathing'?'roulette.idle':'roulette.wheel-start',kind:action==='breathing'?'idle':'action',situation:action,
    game:'roulette',action,startPose:'VILA',endPose:'VILA',compositing:{mode:'alpha'},framing:{scale:1,x:0,y:0}},'video/webm',n);
}
function frozenRoulette(start=false) {
  return frozenPackage(value=>{
    const dealer=value.registeredDealers[0];dealer.rouletteIdle={base:rouletteMedia(),variants:[]};
    if(start)dealer.rouletteStart={clip:rouletteMedia('wheel-start',4),tableDesignId:'roulette-anna-v1',durationMs:2000,wheelImpulseMs:500,ballReleaseMs:1000};
  });
}
function fixture({ config = env, fetcher = async () => Response.json(capability), storedMedia = [] } = {}) {
  const writes = [], fetches = [];
  const media=new Map(storedMedia.map(row=>[row.id,structuredClone(row)]));
  const repository = {
    marker: 'original',
    async saveDocument(...args) { assert.equal(this, repository); writes.push(['saveDocument', ...args]); return 'document-result'; },
    async registerMedia(...args) { assert.equal(this, repository); writes.push(['registerMedia', ...args]); return 'register-result'; },
    async saveMediaTiming(...args) { assert.equal(this, repository); writes.push(['saveMediaTiming',...args]); return 'timing-result'; },
    async getMedia(id) { assert.equal(this,repository); return structuredClone(media.get(id)??null); },
    async classifyMedia(...args) { assert.equal(this, repository); writes.push(['classifyMedia', ...args]); return 'classify-result'; },
    transaction(work, options) { assert.equal(this, repository); assert.equal(options?.fixture, true); return work(repository); },
    readDocument: async () => 'read-result',
  };
  const wrapped = wrapNativePresentationRepository(repository, { env: config, fetchImpl: async (...args) => {
    fetches.push(args); return fetcher(...args);
  } });
  return { repository, wrapped, writes, fetches };
}
const writesForNewFeatures = [
  repo => repo.saveDocument('project', { value: project(), actor: 'trusted' }),
  repo => repo.saveDocument('project', { value: { dealers: dealers.map(id => ({ id })), lanes: [{ composition: {} }] } }),
  repo => repo.saveDocument('administration', { value: { gameLanes: [{ dealer: 'nora' }] } }),
  repo => repo.registerMedia({ classification: { dealerId: 'nora' } }, { actor: 'trusted' }),
  repo => repo.registerMedia({ classification: { dealerId: 'astrid', compositing: { mode: 'opaque' } } }),
  repo => repo.classifyMedia('id', { metadata: { dealerId: 'nora' } }),
  repo => repo.classifyMedia('id', { metadata: { dealerId: 'astrid', compositing: { mode: 'green-screen' } } }),
];

test('exact speech slot standards require v20 before saving, publishing or archiving and before SQL begins', async () => {
  const media = frozenMedia({ eventId: 'speak.other', situation: 'greeting', kind: 'speech',
    recordedSpeech: { ...recordedSpeech(), lineId: 'greeting', takeId: 'greeting_1' } }, 'video/mp4', 25);
  const frozen = frozenPackage(value => {
    const line = value.playback.lines.find(row => row.dealerId === 'astrid' && row.eventId === 'speak.other');
    const baseline = line.variants.find(row => row.id === line.baselineVariantId);
    line.variants.push({ ...structuredClone(baseline), id: 'astrid.speak.other.slot-greeting', priority: 0, triggerIds: [],
      videoGenerationId: media.id, selection: { rules: false, model: false, random: false } });
    value.playback.media.push(media);
  });
  const line = frozen.playback.lines.find(row => row.eventId === 'speak.other');
  const descriptors = [{ kind: 'project', value: { lines: [line] } },
    { kind: 'project', value: { dealerTrash: [{ lines: [line] }] } },
    { kind: 'dealer-archive', value: { dealerTrash: [{ lines: [line] }] } },
    { kind: 'presentation-package', value: frozen }];
  for (const descriptor of descriptors) for (const version of [19, 20]) {
    const f = fixture({ fetcher: async () => Response.json(presentationCapabilitiesForVersion(version)) }); let begun = 0;
    f.repository.transaction = async work => { begun++; return work(f.repository); };
    const save = () => f.wrapped.transaction(repo => repo.saveDocument(descriptor.kind, { value: descriptor.value }), { presentationMutation: descriptor });
    if (version === 19) { await assert.rejects(save, blocked); assert.equal(begun, 0); assert.equal(f.writes.length, 0); }
    else { await save(); assert.equal(begun, 1); assert.equal(f.writes.length, 1); }
    assert.equal(f.fetches.length, 1);
    assert.equal(f.fetches[0][1].headers['X-Presentation-Capability-Version'], '20');
  }
});

test('an older mutation descriptor cannot gain slot-write permission inside SQL or issue a nested preflight', async () => {
  const f = fixture({ fetcher: async () => Response.json(presentationCapabilitiesForVersion(19)) });
  const value = { lines: [{ eventId: 'speak.other', variants: [{ id: 'dragan.speak.other.slot-greeting' }] }] };
  await assert.rejects(f.wrapped.withMutationContext(repo => repo.saveDocument('project', { value }), { kind: 'resource-lifecycle', value: {} }), blocked);
  assert.equal(f.writes.length, 0); assert.equal(f.fetches.length, 1);
  assert.equal(f.fetches[0][1].headers['X-Presentation-Capability-Version'], '19');
});

test('lifecycle plus the saved project discovered before SQL can preserve exact slots with one v20 preflight', async () => {
  // createStudioNativeRuntime.mutationTransaction supplies these complete
  // descriptors by reading presentationDocuments before entering either lock.
  const value = { lines: [{ eventId: 'speak.other', variants: [{ id: 'dragan.speak.other.slot-greeting' }] }] };
  for (const kind of ['material-trash', 'resource-lifecycle', 'dealer-archive']) for (const version of [19, 20]) {
    const f = fixture({ fetcher: async () => Response.json(presentationCapabilitiesForVersion(version)) }); let begun = 0;
    f.repository.transaction = async work => { begun++; return work(f.repository); };
    const lifecycle = { kind, value: {} }, descriptors = [lifecycle, { kind: 'project', value }];
    const work = () => f.wrapped.transaction(repo => repo.withMutationContext(inner => inner.saveDocument('project', { value }), lifecycle), { presentationMutation: descriptors });
    if (version === 19) { await assert.rejects(work, blocked); assert.equal(begun, 0); assert.equal(f.writes.length, 0); }
    else { await work(); assert.equal(begun, 1); assert.equal(f.writes.length, 1); }
    assert.equal(f.fetches.length, 1); assert.equal(f.fetches[0][1].headers['X-Presentation-Capability-Version'], '20');
  }
});

test('more than five filmed deal variants require v17, while explicit archive operations also require v19',async()=>{
  for(const eventId of ['deal.player.left','deal.player.centre','deal.player.right','deal.dealer']){
    const line={dealerId:'astrid',eventId,variants:Array.from({length:6},(_,i)=>({id:`fixture-${i}`}))};
    const frozen=frozenPackage(value=>{
      const target=value.playback.lines.find(row=>row.eventId===eventId),baseline=target.variants.find(row=>row.id===target.baselineVariantId);
      target.variants=Array.from({length:6},(_,i)=>({...structuredClone(baseline),id:i?baseline.id+'-'+i:baseline.id}));
    });
    const descriptors=[{kind:'project',value:{lines:[line]}},{kind:'project',value:{dealerTrash:[{lines:[line]}]}},
      {kind:'dealer-archive',value:{dealerTrash:[{lines:[line]}]}},{kind:'presentation-package',value:frozen}];
    for(const descriptor of descriptors){const required=descriptor.kind==='dealer-archive'?19:17;for(const version of [required-1,required]){
      const f=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(version))});let begun=0;
      f.repository.transaction=async work=>{begun++;return work(f.repository);};
      const work=()=>f.wrapped.transaction(repo=>repo.saveDocument(descriptor.kind,{value:descriptor.value}),{presentationMutation:descriptor});
      if(version<required)await assert.rejects(work,blocked);else await work();
      assert.equal(begun,version===required?1:0);assert.equal(f.writes.length,version===required?1:0);
      assert.equal(f.fetches.length,1);assert.equal(f.fetches[0][1].headers['X-Presentation-Capability-Version'],String(required));
    }}
  }
});

test('five deal variants retain legacy readiness; v17 speech and larger deal rows grant only declared features',async()=>{
  const small={dealerId:'astrid',eventId:'deal.dealer',variants:Array.from({length:5},()=>({}))};
  const old=fixture();await old.wrapped.saveDocument('project',{value:{lines:[small]}});assert.equal(old.fetches.length,0);
  const large={kind:'project',value:{lines:[{...small,variants:[...small.variants,{}]}]}};
  const speech={metadata:{dealerId:'astrid',recordedSpeech:{schemaVersion:1}}};
  for(const [declared,undeclared]of [[speech,large],[large,speech]]){
    const f=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(17))});
    await f.wrapped.withMutationContext(async()=>{
      await assert.rejects(f.wrapped.withMutationContext(()=>assert.fail('no widening'),undeclared),blocked);
    },declared);
    assert.equal(f.fetches.length,1);assert.equal(f.writes.length,0);
  }
  const f=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(17))});
  await f.wrapped.withMutationContext(async()=>{
    await f.wrapped.saveDocument(large.kind,{value:large.value});await f.wrapped.registerMedia({classification:speech.metadata});
  },[large,speech]);
  assert.equal(f.fetches.length,1);assert.equal(f.writes.length,2);
});

test('recorded speech requires exact v17 before register or classify, even for an invalid present optional field',async()=>{
  for(const recordedSpeech of [{schemaVersion:1},null,undefined])for(const version of [16,17])for(const operation of ['register','classify']){
    const metadata={dealerId:'astrid',recordedSpeech},f=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(version))});
    const write=()=>operation==='register'?f.wrapped.registerMedia({classification:metadata}):f.wrapped.classifyMedia('id',{metadata});
    if(version===16)await assert.rejects(write,blocked);else await write();
    assert.equal(f.writes.length,version===17?1:0);assert.equal(f.fetches[0][1].headers['X-Presentation-Capability-Version'],'17');
  }
});

test('frozen media retains the recorded speech readiness requirement before SQL',async()=>{
  for(const version of [16,17]){
    const value=frozenPackage(value=>bindFrozenMedia(value,frozenMedia({eventId:'speak.goodluck',kind:'speech',situation:'goodluck',recordedSpeech:recordedSpeech()})));
    const f=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(version))});let begun=0;
    f.repository.transaction=async work=>{begun++;return work(f.repository);};
    const work=()=>f.wrapped.transaction(repo=>repo.saveDocument('presentation-package',{value}),{presentationMutation:{kind:'presentation-package',value}});
    if(version===16)await assert.rejects(work,blocked);else await work();
    assert.equal(begun,version===17?1:0);assert.equal(f.writes.length,version===17?1:0);
    assert.equal(f.fetches.length,1);assert.equal(f.fetches[0][1].headers['X-Presentation-Capability-Version'],'17');
  }
});

test('recorded speech cannot be stored in a frozen idle slot before HTTP or SQL',async()=>{
  const value=frozenPackage();value.registeredDealers[0].idle.classification.recordedSpeech=recordedSpeech();
  const f=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(17))});let begun=0;
  f.repository.transaction=async work=>{begun++;return work(f.repository);};
  await assert.rejects(f.wrapped.transaction(()=>assert.fail('invalid idle must not enter SQL'),{presentationMutation:{kind:'presentation-package',value}}),invalidPackage);
  assert.equal(begun,0);assert.equal(f.fetches.length,0);assert.equal(f.writes.length,0);
});

test('v17 combines declared speech and geometry but never widens a running mutation context',async()=>{
  const speech={metadata:{dealerId:'astrid',recordedSpeech:{schemaVersion:1}}};
  const geometry={kind:'project',value:{lanes:[{composition:{blackjackTables:[]}}]}};
  const f=fixture({fetcher:async(_url,init)=>Response.json(presentationCapabilitiesForVersion(Number(init.headers['X-Presentation-Capability-Version'])))});
  await f.wrapped.withMutationContext(async()=>{
    await f.wrapped.registerMedia({classification:speech.metadata});
    await f.wrapped.classifyMedia('id',{metadata:speech.metadata});
    await f.wrapped.saveDocument(geometry.kind,{value:geometry.value});
  },[speech,geometry]);
  assert.equal(f.fetches.length,1);assert.equal(f.fetches[0][1].headers['X-Presentation-Capability-Version'],'17');assert.equal(f.writes.length,3);
  for(const [declared,undeclared]of [[geometry,speech],[speech,geometry]]){
    const limited=fixture({fetcher:async(_url,init)=>Response.json(presentationCapabilitiesForVersion(Number(init.headers['X-Presentation-Capability-Version'])))});
    await limited.wrapped.withMutationContext(async()=>{
      await assert.rejects(limited.wrapped.withMutationContext(()=>assert.fail('no feature widening'),undeclared),blocked);
      const write=undeclared.metadata?limited.wrapped.registerMedia({classification:undeclared.metadata}):limited.wrapped.saveDocument(undeclared.kind,{value:undeclared.value});
      await assert.rejects(write,blocked);
    },declared);
    assert.equal(limited.fetches.length,1);assert.equal(limited.writes.length,0);
  }
});

test('table geometry requires v16 before saving active, archived or frozen data, including an empty optional field',async()=>{
  for(const descriptor of [
    {kind:'project',value:{lanes:[{composition:{blackjackTables:[]}}]}},
    {kind:'project',value:{dealerTrash:[{compositions:[{composition:{blackjackTables:[]}}]}]}},
    {kind:'presentation-package',value:frozenPackage(value=>{value.lanes[0].composition={...defaultCompositionSettings(),blackjackTables:[]};})},
  ])for(const version of [15,16]){
    const f=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(version))});
    const work=()=>f.wrapped.withMutationContext(()=>f.wrapped.saveDocument(descriptor.kind,{value:descriptor.value}),descriptor);
    if(version===15)await assert.rejects(work,blocked);else await work();
    assert.equal(f.fetches[0][1].headers['X-Presentation-Capability-Version'],'16');assert.equal(f.writes.length,version===16?1:0);
  }
  const direct=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(15))});
  await assert.rejects(direct.wrapped.saveDocument('project',{value:{lanes:[{composition:{blackjackTables:[]}}]}}),blocked);
  assert.equal(direct.writes.length,0);
  const f=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(15))});
  await f.wrapped.withMutationContext(async()=>{
    await assert.rejects(f.wrapped.saveDocument('project',{value:{lanes:[{composition:{blackjackTables:[]}}]}}),blocked);
  },{kind:'project',value:{dealers:[{id:'astrid',rouletteIdle:{}}]}});
  assert.equal(f.fetches.length,1);assert.equal(f.writes.length,0);
});

test('betMode presence requires v19 for both active and archived layouts before SQL, even when invalid',async()=>{
  for(const layout of ['mobile','desktop'])for(const betMode of ['under-cards',undefined,null,'manual']){
    const lane={composition:{blackjackTables:[{[layout]:{betMode}}]}};
    for(const value of [{lanes:[lane]},{dealerTrash:[{compositions:[lane]}]}])for(const version of [18,19]){
      const descriptor={kind:'project',value},f=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(version))});let begun=0;
      f.repository.transaction=async work=>{begun++;return work(f.repository);};
      const work=()=>f.wrapped.transaction(repo=>repo.saveDocument('project',{value}),{presentationMutation:descriptor});
      if(version===18)await assert.rejects(work,blocked);else await work();
      assert.equal(f.fetches[0][1].headers['X-Presentation-Capability-Version'],'19');
      assert.equal(begun,version===19?1:0);assert.equal(f.writes.length,version===19?1:0);
    }
  }
});

test('complete frozen table bet modes require v19 and cannot survive a runtime rollback',async()=>{
  for(const layout of ['mobile','desktop']){
    const value=frozenPackage(value=>{
      const id='30000000-0000-4000-8000-000000000001',sha256='d'.repeat(64),contentType='image/png';
      const asset={schemaVersion:1,id,sha256,contentType,size:4096,width:720,height:1280,role:'table',label:'Table fixture',pathname:layerAssetPath({id,sha256,contentType,role:'table'})};
      value.assets.push(asset);Object.assign(value.lanes[0].layers.table,{enabled:true,allowed:[id],default:id});
      const board=defaultBlackjackTableGeometry(id);board[layout].betMode='under-cards';
      value.lanes[0].composition={...defaultCompositionSettings(),blackjackTables:[board]};
    });
    let version=19,begun=0;const f=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(version))});
    f.repository.transaction=async work=>{begun++;return work(f.repository);};
    const work=()=>f.wrapped.transaction(repo=>repo.saveDocument('presentation-package',{value}),{presentationMutation:{kind:'presentation-package',value}});
    await work();version=18;await assert.rejects(work,blocked);
    assert.equal(begun,1);assert.equal(f.writes.length,1);assert.equal(f.fetches.length,2);
    assert.ok(f.fetches.every(row=>row[1].headers['X-Presentation-Capability-Version']==='19'));
  }
});

test('table geometry permission cannot acquire betMode after SQL begins',async()=>{
  const manual={kind:'project',value:{lanes:[{composition:{blackjackTables:[]}}]}};
  const automatic={kind:'project',value:{lanes:[{composition:{blackjackTables:[{mobile:{betMode:'under-cards'}}]}}]}};
  const f=fixture({fetcher:async(_url,{headers})=>Response.json(presentationCapabilitiesForVersion(Number(headers['X-Presentation-Capability-Version'])))});
  let begun=0;f.repository.transaction=async work=>{begun++;return work(f.repository);};
  await assert.rejects(()=>f.wrapped.transaction(repo=>repo.saveDocument('project',{value:automatic.value}),{presentationMutation:manual}),blocked);
  assert.equal(begun,1);assert.equal(f.writes.length,0);assert.equal(f.fetches.length,1);
  assert.equal(f.fetches[0][1].headers['X-Presentation-Capability-Version'],'16');
  await f.wrapped.transaction(repo=>repo.saveDocument('project',{value:automatic.value}),{presentationMutation:automatic});
  assert.equal(f.writes.length,1);assert.equal(f.fetches.length,2);assert.equal(f.fetches[1][1].headers['X-Presentation-Capability-Version'],'19');
});

test('wheel-start needs v15 for active/archived bindings and frozen publication; idle cannot widen inside SQL',async()=>{
  for(const descriptor of [
    {kind:'project',value:{dealers:[{id:'astrid',rouletteStart:{videoId:'fixture'}}]}},
    {kind:'project',value:{dealerTrash:[{dealer:{id:'astrid',rouletteStart:{videoId:'fixture'}}}]}},
    {kind:'presentation-package',value:frozenRoulette(true)},
  ])for(const version of [14,15]) {
    const f=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(version))});
    const work=()=>f.wrapped.withMutationContext(()=>f.wrapped.saveDocument(descriptor.kind,{value:descriptor.value}),descriptor);
    if(version===14)await assert.rejects(work,blocked);else await work();
    assert.equal(f.fetches[0][1].headers['X-Presentation-Capability-Version'],'15');assert.equal(f.writes.length,version===15?1:0);
  }
  const f=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(15))});
  await f.wrapped.withMutationContext(async()=>{
    await assert.rejects(f.wrapped.saveDocument('project',{value:{dealers:[{id:'astrid',rouletteStart:{}}]}}),blocked);
  },{kind:'project',value:{dealers:[{id:'astrid',rouletteIdle:{}}]}});
  assert.equal(f.fetches.length,1);assert.equal(f.writes.length,0);
});

test('explicit roulette idle requires v15 before project save or frozen publication including archived dealers',async()=>{
  const binding={videoId:'20000000-0000-4000-8000-000000000001',variantVideoIds:[]};
  for(const descriptor of [
    {kind:'project',value:{dealers:[{id:'astrid',rouletteIdle:binding}]}},
    {kind:'project',value:{dealerTrash:[{dealer:{id:'astrid',rouletteIdle:binding}}]}},
    {kind:'presentation-package',value:frozenRoulette()},
  ])for(const version of [13,14,15]) {
    const f=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(version))});
    const work=()=>f.wrapped.withMutationContext(()=>f.wrapped.saveDocument(descriptor.kind,{value:descriptor.value}),descriptor);
    if(version!==15)await assert.rejects(work,blocked);else await work();
    assert.equal(f.fetches[0][1].headers['X-Presentation-Capability-Version'],'15');assert.equal(f.writes.length,version===15?1:0);
  }
  const f=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(13))});
  await f.wrapped.withMutationContext(async()=>{
    await assert.rejects(f.wrapped.saveDocument('project',{value:{dealers:[{id:'astrid',rouletteIdle:binding}]}}),blocked);
  },{kind:'project',value:{layerAssets:[{game:'roulette'}]}});
  assert.equal(f.fetches.length,1);assert.equal(f.writes.length,0);
});

test('archived dealer categories require the shipped v14 contract including empty categories',async()=>{
  for(const dealerSets of [[],[{id:'dragan.one'}]]) {
    const value={...project(),dealerTrash:[{schemaVersion:2,dealerSets}]};
    const old=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(13))});
    await assert.rejects(old.wrapped.saveDocument('project',{value}),blocked);assert.equal(old.writes.length,0);
    const current=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(14))});
    await current.wrapped.saveDocument('project',{value});assert.equal(current.writes.length,1);
    assert.equal(current.fetches[0][1].headers['X-Presentation-Capability-Version'],'14');
  }
});

test('v15 permits a combined roulette and retained-category mutation without implicit transaction feature grants',async()=>{
  const category={kind:'project',value:{dealerTrash:[{schemaVersion:2,dealerSets:[]}]}};
  const idle={kind:'project',value:{dealers:[{id:'astrid',rouletteIdle:{}}]}};
  const start={kind:'project',value:{dealers:[{id:'astrid',rouletteStart:{}}]}};
  for(const version of [14,15]) {
    const f=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(version))});
    const work=()=>f.wrapped.withMutationContext(async()=>{
      for(const descriptor of [category,idle,start])await f.wrapped.saveDocument(descriptor.kind,{value:descriptor.value});
    },[category,idle,start]);
    if(version===14)await assert.rejects(work,blocked);else await work();
    assert.equal(f.fetches[0][1].headers['X-Presentation-Capability-Version'],'15');assert.equal(f.writes.length,version===15?3:0);
  }
  for(const [declared,undeclared,version] of [[category,idle,14],[idle,category,15],[start,idle,15]]) {
    const f=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(version))});
    await f.wrapped.withMutationContext(async()=>{
      await assert.rejects(f.wrapped.saveDocument(undeclared.kind,{value:undeclared.value}),blocked);
    },declared);
    assert.equal(f.fetches.length,1);assert.equal(f.writes.length,0);
  }
});

const extendedMedia=[
  {dealerId:'astrid',compositing:{mode:'alpha'}},
  {dealerId:'astrid',mediaType:'image'},
  {dealerId:'astrid',eventId:'roulette.wheel-start',game:'roulette',action:'wheel-start',startPose:'VILA',endPose:'WHEEL',compositing:{mode:'green-screen'}},
  ...['game','action'].map(key=>({dealerId:'astrid',[key]:'unverified'})),
  // Pose fields on a roulette-marked record stay roulette media (v12).
  {dealerId:'astrid',game:'roulette',startPose:'unverified'},{dealerId:'astrid',action:'reference',endPose:'unverified'},
];

test('archived dealer categories require v14 before any write, including empty categories',async()=>{
  for(const dealerSets of [[],[{id:'dragan.one'}]]){
    const value={...project(),dealerTrash:[{schemaVersion:2,dealerSets}]};
    const old=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(13))});
    await assert.rejects(old.wrapped.saveDocument('project',{value}),blocked);assert.equal(old.writes.length,0);
    const current=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(14))});
    await current.wrapped.saveDocument('project',{value});assert.equal(current.writes.length,1);
    assert.equal(current.fetches[0][1].headers['X-Presentation-Capability-Version'],'14');
  }
});

test('game-tagged table projects, trash and frozen packages require exact v13',async()=>{
  const frozen=frozenPackage(value=>{
    const table={schemaVersion:1,id:'30000000-0000-4000-8000-000000000001',role:'table',game:'roulette',label:'Fixture table',sha256:'d'.repeat(64),size:4096,contentType:'image/png',width:1920,height:1080};
    value.assets.push({...table,pathname:layerAssetPath(table)});value.lanes[0].layers.table={enabled:true,default:table.id,allowed:[table.id]};
  });
  for(const descriptor of [
    {kind:'project',value:{layerAssets:[{role:'table',game:'roulette'}]}},
    {kind:'project',value:{layerAssetTrash:[{asset:{role:'table',game:'blackjack'}}]}},
    {kind:'presentation-package',value:frozen},
  ])for(const version of [12,13]){
    const f=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(version))});
    const write=()=>f.wrapped.saveDocument(descriptor.kind,{value:descriptor.value});
    if(version===13)await write();else await assert.rejects(write(),blocked);
    assert.equal(f.writes.length,version===13?1:0);assert.equal(f.fetches[0][1].headers['X-Presentation-Capability-Version'],'13');
  }
});

test('a legacy transaction cannot introduce a table game after SQL begins',async()=>{
  const f=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(12))});
  await f.wrapped.withMutationContext(async()=>{
    await assert.rejects(f.wrapped.saveDocument('project',{value:{layerAssets:[{role:'table',game:'roulette'}]}}),blocked);
  },{metadata:{dealerId:'astrid',game:'roulette'}});
  assert.equal(f.fetches.length,1);assert.equal(f.writes.length,0);
});
test('alpha, PNG and every new roulette record field require exact v12 before register/classify',async()=>{
  for(const metadata of extendedMedia)for(const version of [2,11,12])for(const operation of ['register','classify']){
    const f=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(version))});
    const write=()=>operation==='register'?f.wrapped.registerMedia({classification:metadata}):f.wrapped.classifyMedia('id',{metadata});
    if(version===12){await write();assert.equal(f.writes.length,1);}else{await assert.rejects(write(),blocked);assert.equal(f.writes.length,0);}
    assert.equal(f.fetches[0][1].headers['X-Presentation-Capability-Version'],'12');
  }
});
test('legacy verified transaction cannot inherit alpha or roulette permissions after SQL begins',async()=>{
  for(const metadata of extendedMedia){
    const f=fixture({fetcher:async(_url,init)=>Response.json(presentationCapabilitiesForVersion(Number(init.headers['X-Presentation-Capability-Version']??2)))});
    await f.wrapped.withMutationContext(async()=>{
      await assert.rejects(f.wrapped.registerMedia({classification:metadata}),blocked);
      await assert.rejects(f.wrapped.classifyMedia('id',{metadata}),blocked);
    },{metadata:{dealerId:'astrid',compositing:{mode:'green-screen'}}});
    assert.equal(f.fetches.length,1);assert.equal(f.writes.length,0);
  }
  const metadata={dealerId:'astrid',compositing:{mode:'alpha'}};
  const f=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(12))});
  await f.wrapped.withMutationContext(()=>f.wrapped.registerMedia({classification:metadata}),{metadata});
  assert.equal(f.fetches.length,1);assert.equal(f.writes.length,1);
});
test('frozen alpha media require v12 even when the package format itself is older',async()=>{
  for(const location of ['idle','playback'])for(const version of [11,12]){
    const value=frozenPackage(value=>{
      const media=frozenMedia({compositing:{mode:'alpha'},...(location==='idle'?{eventId:'idle.ready',kind:'idle',situation:''}:{})},'video/webm');
      if(location==='idle')value.registeredDealers[0].idle=media;else bindFrozenMedia(value,media);
    },{schemaVersion:location==='idle'?2:3});
    const f=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(version))});
    if(version===12)await f.wrapped.saveDocument('presentation-package',{value});else await assert.rejects(f.wrapped.saveDocument('presentation-package',{value}),blocked);
    assert.equal(f.writes.length,version===12?1:0);assert.equal(f.fetches[0][1].headers['X-Presentation-Capability-Version'],'12');
  }
});

test('PNG references and roulette actions cannot enter frozen blackjack idle or playback before HTTP or SQL',async()=>{
  const png=frozenMedia({eventId:'roulette.reference',kind:'idle',situation:'VILA',mediaType:'image',game:'roulette',action:'reference',startPose:'VILA',endPose:'VILA',compositing:{mode:'alpha'}},'image/png');
  for(const media of [png,rouletteMedia('wheel-start')])for(const location of ['idle','playback']){
    const value=frozenPackage();
    if(location==='idle')value.registeredDealers[0].idle=structuredClone(media);else bindFrozenMedia(value,structuredClone(media),'deal.dealer');
    const f=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(17))});let begun=0;
    f.repository.transaction=async work=>{begun++;return work(f.repository);};
    await assert.rejects(f.wrapped.transaction(()=>assert.fail('invalid placement must not enter SQL'),{presentationMutation:{kind:'presentation-package',value}}),invalidPackage);
    assert.equal(begun,0);assert.equal(f.fetches.length,0);assert.equal(f.writes.length,0);
  }
});

test('authoring sets, including an empty explicit field, require exact v10 before any SQL mutation', async () => {
  for (const dealerSets of [[], [{ id: 'paow3', name: 'PAOW3', dealerId: 'paow-v2', clipIds: [], archived: true }]]) {
    for (const version of [9, 10]) {
      const input = fixture({ fetcher: async () => Response.json(presentationCapabilitiesForVersion(version)) });
      const descriptor = { kind: 'project', value: { dealers: [], lanes: [], dealerSets } };
      let begun = 0;
      input.repository.transaction = async work => { begun++; return work(input.repository); };
      const write = () => input.wrapped.transaction(repo => repo.saveDocument('project', { value: descriptor.value }), { presentationMutation: descriptor });
      if (version === 9) { await assert.rejects(write(), blocked); assert.equal(begun, 0); assert.equal(input.writes.length, 0); }
      else { await write(); assert.equal(begun, 1); assert.equal(input.writes.length, 1); }
      assert.equal(input.fetches.length, 1);
      assert.equal(input.fetches[0][1].headers['X-Presentation-Capability-Version'], '10');
    }
  }
});
test('a preflight without set support cannot introduce membership after SQL begins', async () => {
  const input = fixture({ fetcher: async () => Response.json(presentationCapabilitiesForVersion(9)) });
  await input.wrapped.withMutationContext(async () => {
    await assert.rejects(input.wrapped.saveDocument('project', { value: { dealers: [], dealerSets: [] } }), blocked);
  }, { kind: 'administration', value: { rooms: [{ schemaVersion: 2, game: 'roulette' }] } });
  assert.equal(input.fetches.length, 1); assert.equal(input.writes.length, 0);
});
test('material-trash operations require v19 while stored project trash retains v11',async()=>{
 for(const descriptor of [{kind:'material-trash',value:{}},{kind:'project',value:{layerAssetTrash:[]}}]){
  const required=descriptor.kind==='material-trash'?19:11;
  for(const accepted of [false,true]){
   const f=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(accepted?required:required-1))});
   const work=()=>f.wrapped.withMutationContext(()=>f.wrapped.saveDocument('project',{value:{layerAssetTrash:[]}}),descriptor);
   if(accepted){await work();assert.equal(f.writes.length,1);}else{await assert.rejects(work,blocked);assert.equal(f.writes.length,0);}
   assert.equal(f.fetches[0][1].headers['X-Presentation-Capability-Version'],String(required));
  }
 }
});

test('combined material trash and authoring sets negotiate v11 before SQL and reject a v9-only payload',async()=>{
  for(const accepted of [false,true]){
    const input=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(accepted?11:9))});
    const value={dealers:[],lanes:[],dealerSets:[],layerAssetTrash:[]};
    let begun=0;input.repository.transaction=async work=>{begun++;return work(input.repository);};
    const write=()=>input.wrapped.transaction(repo=>repo.saveDocument('project',{value}),{presentationMutation:{kind:'project',value}});
    if(accepted){await write();assert.equal(begun,1);assert.equal(input.writes.length,1);}
    else{await assert.rejects(write,blocked);assert.equal(begun,0);assert.equal(input.writes.length,0);}
    assert.equal(input.fetches.length,1);
    assert.equal(input.fetches[0][1].headers['X-Presentation-Capability-Version'],'11');
  }
});

test('background policy in project, archived composition and frozen package requires exact v8 before writes',async()=>{
  const lane={backgroundPlayback:{schemaVersion:1,rules:[]}};
  const descriptors=[{kind:'project',value:{lanes:[lane]}},
    {kind:'project',value:{dealerTrash:[{schemaVersion:2,compositions:[lane]}]}},
    {kind:'presentation-package',value:frozenPackage(value=>{value.lanes[0].backgroundPlayback=structuredClone(lane.backgroundPlayback);})}];
  for(const descriptor of descriptors) {
    for(const version of [7,8]) {
      const input=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(version))});
      let begun=0;input.repository.transaction=async work=>{begun++;return work(input.repository);};
      const write=()=>input.wrapped.transaction(repo=>repo.saveDocument(descriptor.kind,{value:descriptor.value}),{presentationMutation:descriptor});
      if(version===7){await assert.rejects(write(),blocked);assert.equal(begun,0);assert.equal(input.writes.length,0);}
      else {await write();assert.equal(begun,1);assert.equal(input.writes.length,1);}
      assert.equal(input.fetches.length,1);assert.equal(input.fetches[0][1].headers['X-Presentation-Capability-Version'],'8');
    }
  }
});

test('an archive v19 mutation cannot add undeclared background automation after the SQL boundary',async()=>{
  const input=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(19))});
  await input.wrapped.withMutationContext(async()=>{
    await assert.rejects(input.wrapped.saveDocument('project',{value:{lanes:[{backgroundPlayback:{schemaVersion:1,rules:[]}}]}}),blocked);
  },{kind:'dealer-archive',value:{}});
  assert.equal(input.fetches.length,1);assert.equal(input.writes.length,0);
});

test('old document and media writes stay local with unchanged arguments, results and original this', async () => {
  const input = fixture({ config: {}, fetcher: () => { throw Error('must not fetch'); } });
  assert.equal(Object.isFrozen(input.wrapped), true);
  assert.equal(input.wrapped.readDocument, input.repository.readDocument);
  const options = { value: { dealers: dealers.map(id => ({ id })), lanes: [] }, actor: 'trusted' };
  assert.equal(await input.wrapped.saveDocument('project', options), 'document-result');
  assert.equal(input.writes[0][2], options);
  assert.equal(await input.wrapped.saveDocument('administration', { value: { gameLanes: [{ dealer: 'astrid' }, { dealer: 'paow' }] } }), 'document-result');
  assert.equal(await input.wrapped.saveDocument('social-policy', { value: {} }), 'document-result');
  const record = { classification: { dealerId: 'astrid' } };
  assert.equal(await input.wrapped.registerMedia(record), 'register-result');
  assert.equal(input.writes[3][1], record);
  assert.equal(await input.wrapped.classifyMedia('id', { metadata: { dealerId: 'mei' } }), 'classify-result');
  assert.equal(input.fetches.length, 0);
  assert.equal(input.writes.length, 5);
});

test('every new document and metadata feature rejects old or absent capabilities before any writer', async () => {
  for (const fetcher of [async () => new Response(null, { status: 404 }), async () => Response.json({ schemaVersion: 0 })]) {
    const input = fixture({ fetcher });
    for (const write of writesForNewFeatures) await assert.rejects(write(input.wrapped), blocked);
    assert.equal(input.writes.length, 0);
    assert.equal(input.fetches.length, writesForNewFeatures.length);
  }
});

test('exact trusted capability permits each new writer without caching readiness between writes', async () => {
  const input = fixture();
  for (const write of writesForNewFeatures) await write(input.wrapped);
  assert.equal(input.writes.length, writesForNewFeatures.length);
  assert.equal(input.fetches.length, writesForNewFeatures.length);
  for (const [url, options] of input.fetches) {
    assert.equal(url, env.CROUPIER_BACKEND_ORIGIN + '/api/presentation/capabilities');
    assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'error');
    assert.equal(options.credentials, 'omit'); assert.equal(options.cache, 'no-store');
    assert.deepEqual(options.headers, { Accept: 'application/json' });
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(options.signal.aborted, false);
  }
});

test('trusted server origin must be exact HTTPS origin and invalid preferred origin never falls back', async () => {
  for (const origin of [undefined, 'http://render.example.invalid', 'https://render.example.invalid/',
    'https://render.example.invalid/path', 'https://render.example.invalid?ready=1',
    'https://render.example.invalid#ready', 'https://user:pass@render.example.invalid']) {
    const config = origin === undefined ? {} : { CROUPIER_BACKEND_ORIGIN: origin, RENDER_EXTERNAL_URL: env.CROUPIER_BACKEND_ORIGIN };
    const input = fixture({ config });
    await assert.rejects(writesForNewFeatures[0](input.wrapped), blocked);
    assert.equal(input.fetches.length, 0); assert.equal(input.writes.length, 0);
  }
  const fallback = fixture({ config: { RENDER_EXTERNAL_URL: env.CROUPIER_BACKEND_ORIGIN } });
  await writesForNewFeatures[0](fallback.wrapped); assert.equal(fallback.writes.length, 1);
});

test('client readiness, capability and backend fields never substitute for trusted configuration', async () => {
  const input = fixture({ config: {} });
  const value = { ...project(), capabilities: capability, runtimeReady: true, CROUPIER_BACKEND_ORIGIN: env.CROUPIER_BACKEND_ORIGIN };
  await assert.rejects(input.wrapped.saveDocument('project', { value, runtimeReady: true, capability,
    env, backendOrigin: env.CROUPIER_BACKEND_ORIGIN }), blocked);
  assert.equal(input.writes.length, 0); assert.equal(input.fetches.length, 0);
});

test('capability must match all exact fields and supported dealer IDs', async () => {
  for (const body of [null, [], { ...capability, schemaVersion: 2 }, { ...capability, compositing: 'global' },
    { ...capability, registeredDealerIds: [] }, { ...capability, registeredDealerIds: ['nora', 'nora'] },
    { ...capability, registeredDealerIds: ['nora', 'eva'] }, { ...capability, ready: true }]) {
    const input = fixture({ fetcher: async () => Response.json(body) });
    await assert.rejects(writesForNewFeatures[0](input.wrapped), blocked);
    assert.equal(input.writes.length, 0);
  }
  const unsupported = fixture();
  await assert.rejects(unsupported.wrapped.saveDocument('project', { value: { dealers: [...dealers, 'eva'].map(id => ({ id })) } }), blocked);
  await assert.rejects(unsupported.wrapped.registerMedia({ classification: { dealerId: 'eva' } }), blocked);
  assert.equal(unsupported.writes.length, 0);
});

test('transport, redirects, invalid JSON, wrong MIME and bounded payload failures reveal only fixed code', async () => {
  for (const fetcher of [
    async () => { throw Error('PRIVATE transport details'); },
    async () => { throw new DOMException('PRIVATE timeout details', 'TimeoutError'); },
    async () => Response.redirect('https://other.example.invalid', 302),
    async () => new Response('{broken', { headers: { 'content-type': 'application/json' } }),
    async () => new Response(JSON.stringify(capability), { headers: { 'content-type': 'text/html' } }),
    async () => new Response(' '.repeat(1025), { headers: { 'content-type': 'application/json' } }),
    async () => new Response('{}', { headers: { 'content-type': 'application/json', 'content-length': '999999' } }),
    async () => { const response = Response.json(capability); Object.defineProperty(response, 'url', { value: 'https://other.example.invalid/api/presentation/capabilities' }); return response; },
  ]) {
    const input = fixture({ fetcher });
    await assert.rejects(writesForNewFeatures[0](input.wrapped), blocked);
    assert.equal(input.writes.length, 0);
  }
});

test('failed capability responses cancel unread bodies before rejecting the mutation', async () => {
  let cancelled = false;
  const input = fixture({ fetcher: async () => new Response(new ReadableStream({
    cancel() { cancelled = true; },
  }), { status: 404 }) });
  await assert.rejects(writesForNewFeatures[0](input.wrapped), blocked);
  assert.equal(cancelled, true); assert.equal(input.writes.length, 0);
});

test('transaction callbacks receive the gated API so policy writes cannot bypass readiness', async () => {
  const input = fixture({ fetcher: async () => new Response(null, { status: 404 }) });
  await assert.rejects(input.wrapped.transaction(async repo => {
    assert.equal(repo, input.wrapped);
    return repo.saveDocument('project', { value: project() });
  }, { fixture: true }), blocked);
  assert.equal(input.writes.length, 0); assert.equal(input.fetches.length, 0);
});

test('new input is snapshotted before the remote await so edits cannot change the persisted proposal', async () => {
  let release;
  const waiting = new Promise(resolve => { release = resolve; });
  const input = fixture({ fetcher: async () => { await waiting; return Response.json(capability); } });
  const options = { value: project(), actor: 'trusted' }, original = structuredClone(options);
  const result = input.wrapped.saveDocument('project', options);
  options.value.dealers.push({ id: 'eva' }); release();
  await result;
  assert.deepEqual(input.writes[0][2], original);
  assert.notEqual(input.writes[0][2], options);
});

test('readiness cannot be reused after Render rolls back', async () => {
  let current = capability;
  const input = fixture({ fetcher: async () => Response.json(current) });
  await writesForNewFeatures[0](input.wrapped);
  current = { schemaVersion: 0 };
  await assert.rejects(writesForNewFeatures[1](input.wrapped), blocked);
  assert.equal(input.writes.length, 1); assert.equal(input.fetches.length, 2);
});

test('fixed Native response exposes actionable code without exception or provider details', async () => {
  const error = new StudioStorageError(CODE, 503);
  error.message = 'PRIVATE backend details';
  const response = nativeStudioErrorResponse(error);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  const body = await response.json();
  assert.equal(body.code, CODE);
  assert.equal(body.error, 'Spelservern beh\u00f6ver uppdateras innan presentationen kan sparas. Ditt utkast \u00e4r kvar.');
  assert.equal(JSON.stringify(body).includes('PRIVATE'), false);
});

test('server-owned preflight completes before outer and nested SQL; undeclared features never fetch inside SQL', async () => {
  let inside = false, transactions = 0;
  const input = fixture({ fetcher: async () => {
    assert.equal(inside, false, 'capability HTTP must precede BEGIN');
    return Response.json(capability);
  } });
  input.repository.transaction = async function(work) {
    assert.equal(this, input.repository); transactions++;
    const previous = inside; inside = true;
    try { return await work(input.repository); } finally { inside = previous; }
  };
  const descriptor = { kind: 'project', value: project() };
  await input.wrapped.withMutationContext(async () => {
    inside = true;
    try {
      return await input.wrapped.transaction(repo => repo.saveDocument('project', { value: project() }),
        { presentationMutation: descriptor });
    } finally { inside = false; }
  }, descriptor);
  assert.equal(input.fetches.length, 1); assert.equal(input.writes.length, 1); assert.equal(transactions, 1);
  await assert.rejects(input.wrapped.transaction(repo => repo.registerMedia({
    classification: {dealerId:'nora',compositing:{mode:'opaque'}},
  }), {fixture:true}), blocked);
  assert.equal(input.fetches.length, 1, 'undeclared mutation cannot perform HTTP after BEGIN');
  assert.equal(input.writes.length, 1);
});

test('direct repository preflight snapshots features before BEGIN and rejection never starts SQL', async () => {
  let started = 0;
  const input = fixture({ fetcher: async () => new Response(null, {status:503}) });
  input.repository.transaction = async work => { started++; return work(input.repository); };
  await assert.rejects(input.wrapped.transaction(repo => repo.saveDocument('project',{value:project()}),
    { presentationMutation:{kind:'project',value:project()} }), blocked);
  assert.equal(started,0); assert.equal(input.writes.length,0); assert.equal(input.fetches.length,1);
});

test('verified feature permissions do not leak to another concurrent mutation', async () => {
  const input = fixture();
  let release, entered;
  const waiting = new Promise(resolve => { release = resolve; });
  const active = new Promise(resolve => { entered = resolve; });
  const first = input.wrapped.withMutationContext(async repo => {
    entered(); await waiting; return repo.saveDocument('project',{value:project()});
  }, {kind:'project',value:project()});
  await active;
  await assert.rejects(input.wrapped.transaction(repo => repo.saveDocument('project',{value:project()}),{fixture:true}),blocked);
  assert.equal(input.fetches.length,1); release(); await first;
  assert.equal(input.writes.length,1);
});

const roomV2 = { schemaVersion: 2, id: 'room-one', name: 'Room', operatorId: 'north', presentationLaneId: 'mobile-phone', gameLaneId: 'mobile-phone', state: 'live' };
const capabilityV2 = { ...capability, schemaVersion: 2, rooms: 'operator-owned-v2' };
test('v2 capability stays compatible with old presentation writes while old Render blocks new rooms before SQL', async () => {
  const input = fixture({ fetcher: async () => Response.json(capabilityV2) });
  for (const write of writesForNewFeatures) await write(input.wrapped);
  await input.wrapped.saveDocument('administration', { value: { rooms: [roomV2] } });
  assert.equal(input.writes.length, writesForNewFeatures.length + 1);
  for (const response of [capability, { ...capabilityV2, rooms: 'unknown' }, { ...capabilityV2, trusted: true }]) {
    const old = fixture({ fetcher: async () => Response.json(response) });
    await assert.rejects(old.wrapped.transaction(repo => repo.saveDocument('administration', { value: { rooms: [roomV2] } }),
      { fixture: true, presentationMutation: { kind: 'administration', value: { rooms: [roomV2] } } }), blocked);
    assert.equal(old.writes.length, 0);
  }
});
test('a room capability cannot be reused after rollback or smuggled into a weaker transaction descriptor', async () => {
  let capable = true;
  const input = fixture({ fetcher: async () => Response.json(capable ? capabilityV2 : capability) });
  const save = () => input.wrapped.saveDocument('administration', { value: { rooms: [roomV2] } });
  await save(); capable = false; await assert.rejects(save(), blocked); assert.equal(input.writes.length, 1);
  capable = true;
  await assert.rejects(input.wrapped.withMutationContext(save, { kind: 'project', value: project() }), blocked);
  assert.equal(input.writes.length, 1);
});

test('generic saved-registry dealer writes negotiate v3; the legacy Nora list grants no registry authority', async () => {
  const cap3 = { schemaVersion: 3, registeredDealerIds: ['nora'], compositing: 'per-clip', rooms: 'operator-owned-v2',
    registeredDealerMode: 'saved-registry-idle-v1', frozenDealerIdle: 'operator-package-v2' };
  const input = fixture({ fetcher: async () => Response.json(cap3) });
  const genericProject = { dealers: [...dealers, 'johanna'].map(id => ({ id })), lanes: [] };
  await input.wrapped.saveDocument('project', { value: genericProject });
  await input.wrapped.saveDocument('administration', { value: { gameLanes: [{ dealer: 'johanna', renderer: 'portrait-video' }] } });
  await input.wrapped.registerMedia({ classification: { dealerId: 'johanna' } });
  assert.equal(input.writes.length, 3);
  for (const [, options] of input.fetches) assert.equal(options.headers['X-Presentation-Capability-Version'], '3');
  for (const cap of [capability, { schemaVersion: 2, registeredDealerIds: ['nora'], compositing: 'per-clip', rooms: 'operator-owned-v2' }]) {
    const old = fixture({ fetcher: async () => Response.json(cap) });
    await assert.rejects(old.wrapped.saveDocument('project', { value: genericProject }), blocked); assert.equal(old.writes.length, 0);
  }
});

test('schema2 package format requires v3 even when no extra dealer is included; no SQL begins on downgrade', async () => {
  const descriptor = { kind: 'presentation-package', value: frozenPackage(value=>{value.registeredDealers=[];},{schemaVersion:2}) };
  let begun = 0;
  const old = fixture(); old.repository.transaction = async work => { begun++; return work(old.repository); };
  await assert.rejects(old.wrapped.transaction(async () => {}, { presentationMutation: descriptor }), blocked);
  assert.equal(begun, 0); assert.equal(old.fetches[0][1].headers['X-Presentation-Capability-Version'], '3');
  const cap3 = { schemaVersion: 3, registeredDealerIds: ['nora'], compositing: 'per-clip', rooms: 'operator-owned-v2',
    registeredDealerMode: 'saved-registry-idle-v1', frozenDealerIdle: 'operator-package-v2' };
  const modern = fixture({ fetcher: async () => Response.json(cap3) }); modern.repository.transaction = async work => { begun++; return work(modern.repository); };
  await modern.wrapped.transaction(async () => {}, { presentationMutation: descriptor }); assert.equal(begun, 1);
});

test('legacy mutation context cannot introduce generic or frozen-package features from inside SQL', async () => {
  const input = fixture();
  await input.wrapped.withMutationContext(async () => {
    await assert.rejects(input.wrapped.registerMedia({ classification: { dealerId: 'johanna' } }), blocked);
    await assert.rejects(input.wrapped.transaction(async () => {}, { presentationMutation: { kind: 'presentation-package', value: frozenPackage(value=>{value.registeredDealers=[];},{schemaVersion:2}) } }), blocked);
  }, { kind: 'project', value: project() });
  assert.equal(input.fetches.length, 1); assert.equal(input.writes.length, 0);
});

const cap4 = { schemaVersion: 4, registeredDealerIds: ['nora'], compositing: 'per-clip', rooms: 'operator-owned-v2',
  registeredDealerMode: 'saved-registry-idle-v1', frozenDealerIdle: 'operator-package-v2', frozenDealerEvents: 'operator-package-v3' };
const cap3 = { ...cap4, schemaVersion: 3 }; delete cap3.frozenDealerEvents;
test('frozen-event schema3 publication negotiates exact v4 before SQL even without an extra dealer', async () => {
  for(const dealerId of ['astrid','linnea']) {
    const descriptor={kind:'presentation-package',value:frozenPackage(()=>{},{dealerId})};
    for(const response of [capability,capabilityV2,cap3,{...cap4,frozenDealerEvents:'latest-draft'}]) {
      let begun=0;
      const input=fixture({fetcher:async()=>Response.json(response)});
      input.repository.transaction=async work=>{begun++;return work(input.repository);};
      await assert.rejects(input.wrapped.transaction(async()=>{}, {presentationMutation:descriptor}),blocked);
      assert.equal(begun,0);assert.equal(input.writes.length,0);
      assert.equal(input.fetches[0][1].headers['X-Presentation-Capability-Version'],'4');
    }
    let begun=0;
    const input=fixture({fetcher:async()=>Response.json(cap4)});
    input.repository.transaction=async work=>{begun++;return work(input.repository);};
    await input.wrapped.transaction(repo=>repo.saveDocument('presentation-package',{value:descriptor.value}), {presentationMutation:descriptor});
    assert.equal(begun,1);assert.equal(input.writes.length,1);assert.equal(input.fetches.length,1);
  }
});
test('v3 readiness cannot authorize schema3 events inside SQL and v4 readiness cannot survive rollback', async () => {
  const descriptor={kind:'presentation-package',value:frozenPackage()};
  let ready=true,begun=0;
  const input=fixture({fetcher:async(_url,options)=>Response.json(options.headers['X-Presentation-Capability-Version']==='3' ? cap3 : ready ? cap4 : cap3)});
  input.repository.transaction=async work=>{begun++;return work(input.repository);};
  await input.wrapped.withMutationContext(async()=>{
    await assert.rejects(input.wrapped.saveDocument('presentation-package',{value:descriptor.value}),blocked);
  }, {kind:'presentation-package',value:frozenPackage(value=>{value.registeredDealers=[];},{schemaVersion:2})});
  assert.equal(input.fetches.length,1);assert.equal(input.writes.length,0);
  await input.wrapped.transaction(async()=>{}, {presentationMutation:descriptor});
  assert.equal(begun,1);ready=false;
  await assert.rejects(input.wrapped.transaction(async()=>{}, {presentationMutation:descriptor}),blocked);
  assert.equal(begun,1);assert.equal(input.fetches.length,3);
});

test('resource archive writes require exact v19 before SQL and reuse verification for the complete room mutation',async()=>{
 const descriptor=[{kind:'resource-lifecycle',value:{}},{kind:'project',value:{dealers:[...dealers,'johanna'].map(id=>({id})),lanes:[]}}];
 const cap5={...cap4,schemaVersion:5,dealerLifecycle:'trash-v1'};
  const cap19=presentationCapabilitiesForVersion(19);
  for(const response of [cap4,cap5,presentationCapabilitiesForVersion(18),{...cap19,resourceLifecycle:'unsafe-delete'}]){
  let begun=0;const input=fixture({fetcher:async()=>Response.json(response)});
  input.repository.transaction=async work=>{begun++;return work(input.repository);};
  await assert.rejects(input.wrapped.transaction(async()=>{}, {presentationMutation:descriptor}),blocked);
   assert.equal(begun,0);assert.equal(input.fetches[0][1].headers['X-Presentation-Capability-Version'],'19');
 }
  let begun=0;const input=fixture({fetcher:async()=>Response.json(cap19)});
 input.repository.transaction=async work=>{begun++;return work(input.repository);};
 await input.wrapped.transaction(repo=>repo.saveDocument('administration',{value:{rooms:[{schemaVersion:2}],gameLanes:[{dealer:'johanna',renderer:'portrait-video'}]}}),{presentationMutation:descriptor});
 assert.equal(begun,1);assert.equal(input.fetches.length,1);assert.equal(input.writes.length,1);
});

test('an older verified mutation may not acquire resource lifecycle authority after SQL starts',async()=>{
 const cap5={...cap4,schemaVersion:5,dealerLifecycle:'trash-v1'};
 const input=fixture({fetcher:async()=>Response.json(cap5)});
 await input.wrapped.withMutationContext(async()=>{
  await assert.rejects(input.wrapped.withMutationContext(()=>assert.fail('must not run'),{kind:'resource-lifecycle',value:{}}),blocked);
 },{kind:'project',value:{dealers:[],dealerTrash:[]}});
 assert.equal(input.fetches.length,1);assert.equal(input.writes.length,0);
});
test('stored cascade data retains v7 while archive operations require v19 without widening resource authority',async()=>{
 for(const descriptor of [{kind:'project',value:{dealers:[],dealerTrash:[{schemaVersion:2}]}},{kind:'dealer-archive',value:{dealers:[],dealerTrash:[]}}]){
   const required=descriptor.kind==='dealer-archive'?19:7;
  let begun=0;const rejected=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(required-1))});rejected.repository.transaction=async()=>begun++;
  await assert.rejects(rejected.wrapped.transaction(async()=>{}, {presentationMutation:descriptor}),blocked);assert.equal(begun,0);assert.equal(rejected.fetches[0][1].headers['X-Presentation-Capability-Version'],String(required));
  const accepted=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(required))});accepted.repository.transaction=async work=>{begun++;return work(accepted.repository);};
  await accepted.wrapped.transaction(repo=>repo.saveDocument('project',{value:{dealers:[],dealerTrash:[]}}),{presentationMutation:descriptor});assert.equal(begun,1);assert.equal(accepted.fetches.length,1);
 }
  const input=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(19))});
 await input.wrapped.withMutationContext(async()=>{await assert.rejects(input.wrapped.withMutationContext(()=>assert.fail('no widening'),{kind:'dealer-archive',value:{}}),blocked);},{kind:'resource-lifecycle',value:{}});assert.equal(input.fetches.length,1);
});

test('v24: a table playback policy or a jittered background timer gates project writes on v24',async()=>{
  const rule={id:'living',assetId:'00000000-0000-4000-8000-000000000002',trigger:{everyMs:195000,jitterMs:74000},maxDurationMs:10000,cooldownMs:60000,maxPerMinute:1,maxSecondsPerMinute:20};
  const plainRule={...rule,trigger:{everyMs:25000}};
  for(const [lane,required] of [[{backgroundPlayback:{schemaVersion:1,rules:[rule]}},24],[{tablePlayback:{schemaVersion:1,rules:[plainRule]}},24],[{backgroundPlayback:{schemaVersion:1,rules:[plainRule]}},8]]){
    const f=fixture({fetcher:async(_url,init)=>Response.json(presentationCapabilitiesForVersion(Number(init.headers['X-Presentation-Capability-Version']??2)))});
    await f.wrapped.saveDocument('project',{value:{lanes:[lane]}});
    assert.equal(f.fetches[0][1].headers['X-Presentation-Capability-Version'],String(required));assert.equal(f.writes.length,1);
  }
  const old=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(23))});
  await assert.rejects(old.wrapped.saveDocument('project',{value:{lanes:[{tablePlayback:{schemaVersion:1,rules:[]}}]}}),blocked);
  assert.equal(old.writes.length,0,'an older runtime cannot receive a lane field it rejects');
});

test('v24: publishing a package whose lane carries tablePlayback is refused before SQL on a pre-v24 runtime',async()=>{
  const value=frozenPackage(value=>{
    const asset=(n,contentType,label)=>{const id=`30000000-0000-4000-8000-00000000000${n}`,sha256=String(n).repeat(64),role='table';
      return {schemaVersion:1,id,role,label,sha256,size:4096,contentType,pathname:layerAssetPath({id,sha256,contentType,role}),width:1920,height:1080};};
    const base=asset(1,'image/png','Bord'),clip=asset(2,'video/mp4','Levande bord');value.assets.push(base,clip);
    Object.assign(value.lanes[0].layers.table,{enabled:true,allowed:[base.id,clip.id],default:base.id});
    // No jitter: the lane field alone must require v24.
    value.lanes[0].tablePlayback={schemaVersion:1,rules:[{id:'living',assetId:clip.id,trigger:{everyMs:25000},
      maxDurationMs:10000,cooldownMs:25000,maxPerMinute:2,maxSecondsPerMinute:20}]};
  });
  assert.doesNotThrow(()=>validatePresentationPackage(value),'the fixture is a publishable package');
  const descriptor={kind:'presentation-package',value};
  for(const version of [23,24]){
    const input=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(version))});
    let begun=0;input.repository.transaction=async work=>{begun++;return work(input.repository);};
    const write=()=>input.wrapped.transaction(repo=>repo.saveDocument(descriptor.kind,{value}),{presentationMutation:descriptor});
    if(version===23){await assert.rejects(write(),blocked);assert.equal(begun,0,'no SQL transaction is opened');assert.equal(input.writes.length,0);}
    else{await write();assert.equal(begun,1);assert.equal(input.writes.length,1);}
    assert.equal(input.fetches.length,1);assert.equal(input.fetches[0][1].headers['X-Presentation-Capability-Version'],'24');
  }
});

test('v25: dealer-following autoScale gates active, archived and frozen geometry before any write',async()=>{
  for(const layout of ['mobile','desktop'])for(const autoScale of [undefined,null,{},defaultBlackjackAutoScale()]){
    const lane={composition:{blackjackTables:[{[layout]:{autoScale}}]}};
    for(const descriptor of [{kind:'project',value:{lanes:[lane]}},{kind:'project',value:{dealerTrash:[{compositions:[lane]}]}}])for(const version of [24,25]){
      const f=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(version))});let begun=0;
      f.repository.transaction=async work=>{begun++;return work(f.repository);};
      const work=()=>f.wrapped.transaction(repo=>repo.saveDocument(descriptor.kind,{value:descriptor.value}),{presentationMutation:descriptor});
      if(version===24)await assert.rejects(work,blocked);else await work();
      assert.equal(f.fetches[0][1].headers['X-Presentation-Capability-Version'],'25');assert.equal(begun,version===25?1:0);
    }
  }
  const tableId='30000000-0000-4000-8000-000000000001';
  const pack=autoScale=>frozenPackage(value=>{
    const sha256='d'.repeat(64),contentType='image/png';
    value.assets.push({schemaVersion:1,id:tableId,sha256,contentType,size:4096,width:720,height:1280,role:'table',label:'Table',pathname:layerAssetPath({id:tableId,sha256,contentType,role:'table'})});
    Object.assign(value.lanes[0].layers.table,{enabled:true,allowed:[tableId],default:tableId});
    const board=defaultBlackjackTableGeometry(tableId);if(autoScale)board.mobile.autoScale={...defaultBlackjackAutoScale(),adjust:{chips:{dx:0,dy:.01,scale:1.2}}};
    value.lanes[0].composition={...defaultCompositionSettings(),blackjackTables:[board]};
  });
  let version=25;const f=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(version))});
  const work=()=>f.wrapped.saveDocument('presentation-package',{value:pack(true)});await work();version=24;await assert.rejects(work,blocked);assert.equal(f.writes.length,1);
  // The same frozen geometry without autoScale keeps its earlier v16 requirement.
  const plain=fixture({fetcher:async(_url,init)=>Response.json(presentationCapabilitiesForVersion(Number(init.headers['X-Presentation-Capability-Version'])))});
  await plain.wrapped.saveDocument('presentation-package',{value:pack(false)});
  assert.equal(plain.fetches[0][1].headers['X-Presentation-Capability-Version'],'16');assert.equal(plain.writes.length,1);
});
test('a preflight without autoScale cannot acquire it inside its transaction',async()=>{
  const plain={kind:'project',value:{lanes:[{composition:{blackjackTables:[{desktop:{anchors:{}}}]}}]}};
  const scaled={lanes:[{composition:{blackjackTables:[{desktop:{anchors:{},autoScale:{}}}]}}]};
  const f=fixture({fetcher:async(_url,{headers})=>Response.json(presentationCapabilitiesForVersion(Number(headers['X-Presentation-Capability-Version'])))});
  await assert.rejects(()=>f.wrapped.transaction(repo=>repo.saveDocument('project',{value:scaled}),{fixture:true,presentationMutation:plain}),blocked);
  assert.equal(f.writes.length,0);assert.equal(f.fetches.length,1);assert.equal(f.fetches[0][1].headers['X-Presentation-Capability-Version'],'21');
});

test('v26 blocks saved card display on old engines before writing any active or archived layout',async()=>{
 for(const layout of ['mobile','desktop'])for(const version of [25,26]){
  const lane={composition:{blackjackTables:[{[layout]:{cardView:'table'}}]}};
  for(const descriptor of [{kind:'project',value:{lanes:[lane]}},{kind:'project',value:{dealerTrash:[{compositions:[lane]}]}}]){
   const f=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(version))});
   const work=()=>f.wrapped.saveDocument(descriptor.kind,{value:descriptor.value});
   if(version===25)await assert.rejects(work,blocked);else await work();
   assert.equal(f.fetches[0][1].headers['X-Presentation-Capability-Version'],'26');assert.equal(f.writes.length,version===26?1:0);
  }
 }
});

test('v26 checks a valid frozen card layout and cannot be acquired inside an older transaction',async()=>{
 const tableId='30000000-0000-4000-8000-000000000001';
 const value=frozenPackage(pack=>{
  const sha256='d'.repeat(64),contentType='image/png';
  pack.assets.push({schemaVersion:1,id:tableId,sha256,contentType,size:4096,width:720,height:1280,role:'table',label:'Table',pathname:layerAssetPath({id:tableId,sha256,contentType,role:'table'})});
  Object.assign(pack.lanes[0].layers.table,{enabled:true,allowed:[tableId],default:tableId});
  const board=defaultBlackjackTableGeometry(tableId);board.desktop.cardView='raised';
  pack.lanes[0].composition={...defaultCompositionSettings(),blackjackTables:[board]};
 });
 assert.doesNotThrow(()=>validatePresentationPackage(value));
 for(const version of [25,26]){const f=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(version))});const work=()=>f.wrapped.saveDocument('presentation-package',{value});if(version===25)await assert.rejects(work,blocked);else await work();assert.equal(f.writes.length,version===26?1:0);}
 const plain={kind:'project',value:{lanes:[{composition:{blackjackTables:[{desktop:{autoScale:{}}}]}}]}};
 const changed=structuredClone(plain.value);changed.lanes[0].composition.blackjackTables[0].desktop.cardView='table';
 const f=fixture({fetcher:async(_url,{headers})=>Response.json(presentationCapabilitiesForVersion(Number(headers['X-Presentation-Capability-Version'])))});
 await assert.rejects(()=>f.wrapped.transaction(repo=>repo.saveDocument('project',{value:changed}),{fixture:true,presentationMutation:plain}),blocked);assert.equal(f.writes.length,0);
});

test('v27 blocks new UI and card spread on older engines for active, archived and nested writes',async()=>{
 for(const field of ['ui','spread'])for(const layout of ['mobile','desktop']){
  const composition=field==='ui'?{[layout]:{gameUi:{}}}:{blackjackTables:[{[layout]:{fanSpread:.5}}]};
  for(const value of [{lanes:[{composition}]},{dealerTrash:[{compositions:[{composition}]}]}])for(const version of [26,27]){
   const f=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(version))});
   const work=()=>f.wrapped.saveDocument('project',{value});
   if(version===26)await assert.rejects(work,blocked);else await work();
   assert.equal(f.fetches[0][1].headers['X-Presentation-Capability-Version'],'27');assert.equal(f.writes.length,version===27?1:0);
  }
  const plain={kind:'project',value:{lanes:[{composition:{blackjackTables:[{mobile:{cardView:'table'}}]}}]}};
  const f=fixture({fetcher:async(_url,{headers})=>Response.json(presentationCapabilitiesForVersion(Number(headers['X-Presentation-Capability-Version'])))});
  await assert.rejects(()=>f.wrapped.transaction(repo=>repo.saveDocument('project',{value:{lanes:[{composition}]}}),{fixture:true,presentationMutation:plain}),blocked);
  assert.equal(f.writes.length,0);
 }
});

test('v28 rejects rotation in active and archived policies before SQL, including invalid new fields',async()=>{
  const locations=[
    policy=>({idlePolicy:policy}),
    policy=>({dealerIdlePolicies:[{dealerId:'paow',policy}]}),
    policy=>({dealerTrash:[{idlePolicy:policy}]}),
    policy=>({dealerTrash:[{globalIdlePolicy:policy}]}),
  ];
  for(const policy of [{rotation:undefined},{rotation:null},{rotation:{}},{variants:[{use:'rotation'}]}])
    for(const locate of locations)for(const kind of ['project','dealer-archive'])for(const version of [27,28]){
      const value=locate(policy),descriptor={kind,value};
      const f=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(version))});let begun=0;
      f.repository.transaction=async work=>{begun++;return work(f.repository);};
      const work=()=>f.wrapped.transaction(repo=>repo.saveDocument(kind,{value}),{presentationMutation:descriptor});
      if(version===27)await assert.rejects(work,blocked);else await work();
      assert.equal(begun,version===28?1:0);assert.equal(f.writes.length,version===28?1:0);
      assert.equal(f.fetches.length,1);assert.equal(f.fetches[0][1].headers['X-Presentation-Capability-Version'],'28');
    }
});

test('v28 requires exact rotation support for a valid frozen policy and keeps its accepted bytes',async()=>{
  const value=frozenPackage(pack=>{
    const id=pack.registeredDealers[0].idle.id;
    const extra=frozenMedia({eventId:'idle.ready',kind:'idle',situation:'',role:'alternative'},'video/mp4',29);
    pack.playback.media.push(extra);
    pack.playback.dealerIdlePolicies=[{dealerId:'astrid',policy:{
      schemaVersion:1,familyId:'astrid/idle.ready/ready',base:[{videoId:id,weight:100,durationMs:1000}],
      variants:[{videoId:extra.id,durationMs:1000,use:'rotation',automatic:null}],
      rotation:{clips:[id,extra.id].map(videoId=>({videoId,phase:'any',from:'rest',to:'rest',weight:1,head:false,calm:true}))},
    }}];
  });
  validatePresentationPackage(value);
  const before=structuredClone(value);
  for(const version of [27,28]){
    const f=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(version))});let begun=0;
    f.repository.transaction=async work=>{begun++;return work(f.repository);};
    const work=()=>f.wrapped.transaction(repo=>repo.saveDocument('presentation-package',{value}),
      {presentationMutation:{kind:'presentation-package',value}});
    if(version===27)await assert.rejects(work,blocked);else await work();
    assert.equal(begun,version===28?1:0);assert.equal(f.writes.length,version===28?1:0);
    assert.equal(f.fetches.length,1);assert.equal(f.fetches[0][1].headers['X-Presentation-Capability-Version'],'28');
    if(version===28)assert.deepEqual(f.writes[0][2].value,before);
  }
  assert.deepEqual(value,before);
});

test('rotation cannot be added after preflight and plain idle does not acquire the new requirement',async()=>{
  const plain={kind:'project',value:{dealers:[{id:'paow'}],dealerIdlePolicies:[{dealerId:'paow',policy:{variants:[{use:'manual'}]}}]}};
  const changed=structuredClone(plain.value);changed.dealerIdlePolicies[0].policy.rotation={clips:[]};
  const f=fixture({fetcher:async(_url,{headers})=>Response.json(presentationCapabilitiesForVersion(Number(headers['X-Presentation-Capability-Version'])))});
  await assert.rejects(()=>f.wrapped.transaction(repo=>repo.saveDocument('project',{value:changed}),{fixture:true,presentationMutation:plain}),blocked);
  assert.equal(f.writes.length,0);assert.equal(f.fetches.length,1);
  assert.equal(f.fetches[0][1].headers['X-Presentation-Capability-Version'],'3');
  await f.wrapped.saveDocument('project',{value:plain.value});
  assert.equal(f.writes.length,1);assert.equal(f.fetches.at(-1)[1].headers['X-Presentation-Capability-Version'],'3');
  const descriptor={kind:'project',value:changed};
  await f.wrapped.transaction(async repo=>{
    await repo.withMutationContext(inner=>inner.saveDocument('project',{value:changed}),descriptor);
  },{fixture:true,presentationMutation:descriptor});
  assert.equal(f.writes.length,2);assert.equal(f.fetches.length,3,'one HTTP preflight per outer mutation, none inside SQL');
});

test('dealer lifecycle writes preserve archived rotation and refuse a reader without v28',async()=>{
  const value={dealerTrash:[{globalIdlePolicy:{rotation:{clips:[]}}}]},calls=[];
  let version=27;
  const repository={async saveDealerLifecycle(...args){calls.push(args);return 'saved';}};
  const wrapped=wrapNativePresentationRepository(repository,{env,fetchImpl:async()=>Response.json(presentationCapabilitiesForVersion(version))});
  await assert.rejects(()=>wrapped.saveDealerLifecycle(value,{actor:'fixture'}),blocked);
  assert.equal(calls.length,0);version=28;
  assert.equal(await wrapped.saveDealerLifecycle(value,{actor:'fixture'}),'saved');
  assert.deepEqual(calls,[[value,{actor:'fixture'}]]);
});


test('v29 gates measured registration and exact measurement descriptors before SQL',async()=>{
  const record=measuredFixtureRecord({id:'20000000-0000-4000-8000-000000000001',sha256:'a'.repeat(64),size:4096,classification:{dealerId:'astrid'}});
  for(const version of [28,29]){
    let inSql=false,begun=0;
    const f=fixture({storedMedia:[record],fetcher:async()=>{assert.equal(inSql,false);return Response.json(presentationCapabilitiesForVersion(version));}});
    f.repository.transaction=async work=>{begun++;inSql=true;try{return await work(f.repository);}finally{inSql=false;}};
    const descriptor={metadata:record.classification,mediaTiming:record.mediaTiming};
    const save=()=>f.wrapped.transaction(repo=>repo.saveMediaTiming(record.id,{sha256:record.sha256,mediaTiming:record.mediaTiming,expectedRevision:'media-1',actor:'tester'}),{presentationMutation:descriptor});
    if(version===28)await assert.rejects(save,blocked);else assert.equal(await save(),'timing-result');
    assert.equal(begun,version===29?1:0);assert.equal(f.writes.length,version===29?1:0);
    assert.equal(f.fetches.length,1);assert.equal(f.fetches[0][1].headers['X-Presentation-Capability-Version'],'29');
    const register=()=>f.wrapped.registerMedia(record);
    if(version===28)await assert.rejects(register,blocked);else await register();
    assert.equal(f.fetches.at(-1)[1].headers['X-Presentation-Capability-Version'],'29');
  }
});

test('measurement writer cannot acquire permission outside or across a different active descriptor',async()=>{
  const record=measuredFixtureRecord({id:'20000000-0000-4000-8000-000000000001',sha256:'a'.repeat(64),size:4096,classification:{dealerId:'astrid'}});
  const f=fixture({storedMedia:[record],fetcher:async(_url,init)=>Response.json(presentationCapabilitiesForVersion(Number(init.headers['X-Presentation-Capability-Version']??2)))});
  const options={sha256:record.sha256,mediaTiming:record.mediaTiming,expectedRevision:'media-1',actor:'tester'};
  await assert.rejects(f.wrapped.saveMediaTiming(record.id,options),blocked);assert.equal(f.fetches.length,0);
  await f.wrapped.withMutationContext(()=>assert.rejects(f.wrapped.saveMediaTiming(record.id,options),blocked),{metadata:record.classification});
  const descriptor={metadata:record.classification,mediaTiming:record.mediaTiming};
  const other=measuredFixtureRecord({...record,id:'20000000-0000-4000-8000-000000000002'}).mediaTiming;
  await f.wrapped.withMutationContext(async()=>{
    await assert.rejects(f.wrapped.saveMediaTiming(other.mediaId,{...options,mediaTiming:other}),blocked);
    await assert.rejects(f.wrapped.saveMediaTiming(record.id,{...options,sha256:'b'.repeat(64)}),blocked);
    await assert.rejects(f.wrapped.withMutationContext(()=>assert.fail('no different receipt inside context'),{...descriptor,mediaTiming:other}),blocked);
    await f.wrapped.saveMediaTiming(record.id,options);
  },descriptor);
  assert.equal(f.writes.length,1);assert.equal(f.fetches.length,1);
  // Async-local permission cannot survive the operation that acquired it.
  await assert.rejects(f.wrapped.saveMediaTiming(record.id,options),blocked);
});

test('frozen timing and an extended envelope independently require v29',async()=>{
  const small=frozenPackage();small.playback.media.forEach(row=>measuredFixtureRecord(row));
  small.registeredDealers[0].idle=structuredClone(small.playback.media[0]);
  assert.equal(encodePresentationPackage(small,{allowExtended:true}).format,'croupier-lanes-v1');
  const extended=filmedPresentationFixture();
  extended.playback.media.filter(row=>row.classification.kind==='action').forEach((row,index)=>{
    row.classification.notes+=' '+createHash('sha256').update('codec-boundary:5:'+index).digest('hex');
  });
  assert.equal(encodePresentationPackage(extended,{allowExtended:true}).format,'croupier-lanes-v2');
  assert.equal(extended.playback.media.some(row=>Object.hasOwn(row,'mediaTiming')),false);
  for(const value of [small,extended])for(const version of [28,29]){
    const f=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(version))});let begun=0;
    f.repository.transaction=async work=>{begun++;return work(f.repository);};
    const save=()=>f.wrapped.transaction(repo=>repo.saveDocument('presentation-package',{value}),{presentationMutation:{kind:'presentation-package',value}});
    if(version===28)await assert.rejects(save,blocked);else await save();
    assert.equal(begun,version===29?1:0);assert.equal(f.fetches.length,1);
    assert.equal(f.fetches[0][1].headers['X-Presentation-Capability-Version'],'29');
  }
});

test('a complete native filmed bank passes v29 but cannot grant a measurement-write permission',async()=>{
  const {presentation,records}=nativeRoomMaterialFixture({allSpeechSlots:true,capture:false});
  const f=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(29))});
  const before=structuredClone(presentation),row=records[0];
  await f.wrapped.withMutationContext(async()=>{
    await f.wrapped.saveDocument('presentation-package',{value:presentation});
    await assert.rejects(f.wrapped.saveMediaTiming(row.id,{sha256:row.sha256,mediaTiming:row.mediaTiming}),blocked);
  },{kind:'presentation-package',value:presentation});
  assert.deepEqual(presentation,before);assert.equal(f.writes.length,1);assert.equal(f.fetches.length,1);
  assert.ok(Buffer.byteLength(JSON.stringify(presentationCapabilitiesForVersion(29)))<2048);
});


test('present but invalid measurement cannot downgrade readiness or authorize a writer',async()=>{
  for(const mediaTiming of [undefined,null,{}]){
    const f=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(28))});
    await assert.rejects(f.wrapped.withMutationContext(()=>assert.fail('not entered'),{metadata:{dealerId:'astrid'},mediaTiming}),blocked);
    assert.equal(f.fetches[0][1].headers['X-Presentation-Capability-Version'],'29');
    assert.equal(f.writes.length,0);
  }
  const record=measuredFixtureRecord({id:'20000000-0000-4000-8000-000000000001',sha256:'a'.repeat(64),size:4096,classification:{dealerId:'astrid'}});
  const descriptor={metadata:record.classification,mediaTiming:structuredClone(record.mediaTiming)};
  const f=fixture({storedMedia:[record],fetcher:async()=>{
    descriptor.mediaTiming.size++;
    return Response.json(presentationCapabilitiesForVersion(29));
  }});
  await f.wrapped.withMutationContext(async()=>{
    await assert.rejects(f.wrapped.saveMediaTiming(record.id,{sha256:record.sha256,mediaTiming:descriptor.mediaTiming}),blocked);
    await f.wrapped.saveMediaTiming(record.id,{sha256:record.sha256,mediaTiming:record.mediaTiming});
  },descriptor);
  assert.equal(f.writes.length,1,'permission uses the original immutable measurement, not a later descriptor mutation');
});


test('a detached continuation cannot retain measurement permission after its operation closes',async()=>{
  const record=measuredFixtureRecord({id:'20000000-0000-4000-8000-000000000001',sha256:'a'.repeat(64),size:4096,classification:{dealerId:'astrid'}});
  const f=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(29))});
  let release,child;
  const later=new Promise(resolve=>{release=resolve;});
  await f.wrapped.withMutationContext(async()=>{
    child=later.then(()=>f.wrapped.saveMediaTiming(record.id,{sha256:record.sha256,mediaTiming:record.mediaTiming}));
  },{metadata:record.classification,mediaTiming:record.mediaTiming});
  release();await assert.rejects(child,blocked);
  assert.equal(f.writes.length,0);assert.equal(f.fetches.length,1);
});

test('measurement checks the stored source format so a v29 descriptor cannot mint embedded AV proof',async()=>{
  const pool=createStudioMemoryPool(),repository=createStudioRepository({pool,scope:{environment:'test',workspaceId:'readiness-source-proof'}});
  await repository.initializeDocument('project',{value:createSeedProject(),actor:'fixture'});
  const record=frozenMedia({eventId:'speak.goodluck',kind:'speech',situation:'goodluck',recordedSpeech:embeddedRecordedSpeech({approved:false,verified:false})});
  const registered=(await repository.registerMedia(record,{actor:'fixture'})).media;
  const {mediaTiming}=measuredFixtureRecord(structuredClone(record),{frames:72,fps:24,audioEndUs:3_000_000});
  const metadata={...record.classification};delete metadata.recordedSpeech;
  const requests=[];let version=29;
  const wrapped=wrapNativePresentationRepository(repository,{env,fetchImpl:async(_url,{headers})=>{
    requests.push(headers['X-Presentation-Capability-Version']);return Response.json(presentationCapabilitiesForVersion(version));
  }});
  const options={sha256:record.sha256,expectedRevision:registered.revision,mediaTiming,actor:'fixture-inspector'};
  const save=descriptor=>wrapped.withMutationContext(()=>wrapped.transaction(inner=>inner.saveMediaTiming(record.id,options),{presentationMutation:descriptor}),descriptor);
  const before=pool.snapshot();
  await assert.rejects(save({metadata,mediaTiming}),blocked);
  assert.deepEqual(pool.snapshot(),before);assert.deepEqual(requests,['29']);
  assert.equal((await repository.getMedia(record.id)).classification.recordedSpeech.source.status,'pending');
  version=30;
  const saved=await save({metadata:record.classification,mediaTiming});
  assert.equal(saved.classification.recordedSpeech.source.status,'verified-embedded-av');
  assert.equal(saved.classification.recordedSpeech.source.by,'fixture-inspector');assert.deepEqual(saved.classification.recordedSpeech.review,{status:'pending'});
  assert.deepEqual(requests,['29','30'],'stored feature checks never fetch from the SQL context');
});

test('v29 measurement still permits stored v1 speech and ordinary MP4 while missing readers fail closed',async()=>{
  for(const speech of [undefined,recordedSpeech()]){
    const record=measuredFixtureRecord(frozenMedia(speech?{eventId:'speak.goodluck',kind:'speech',situation:'goodluck',recordedSpeech:speech}:{}),{frames:72,fps:24,audioEndUs:3_000_000});
    const f=fixture({storedMedia:[record],fetcher:async()=>Response.json(presentationCapabilitiesForVersion(29))});
    const descriptor={metadata:record.classification,mediaTiming:record.mediaTiming},options={sha256:record.sha256,mediaTiming:record.mediaTiming};
    assert.equal(await f.wrapped.withMutationContext(()=>f.wrapped.saveMediaTiming(record.id,options),descriptor),'timing-result');
    assert.equal(f.writes.length,1);assert.equal(f.fetches[0][1].headers['X-Presentation-Capability-Version'],'29');
    delete f.repository.getMedia;
    await assert.rejects(f.wrapped.withMutationContext(()=>f.wrapped.saveMediaTiming(record.id,options),descriptor),blocked);
    assert.equal(f.writes.length,1);
  }
});

test('measurement cannot outlive its context while the authoritative source read is pending',async()=>{
  const record=measuredFixtureRecord(frozenMedia()),f=fixture({storedMedia:[record],fetcher:async()=>Response.json(presentationCapabilitiesForVersion(29))});
  let entered,release,child;const started=new Promise(resolve=>entered=resolve),later=new Promise(resolve=>release=resolve);
  f.repository.getMedia=async()=>{entered();await later;return structuredClone(record);};
  await f.wrapped.withMutationContext(async()=>{
    child=f.wrapped.saveMediaTiming(record.id,{sha256:record.sha256,mediaTiming:record.mediaTiming});await started;
  },{metadata:record.classification,mediaTiming:record.mediaTiming});
  release();await assert.rejects(child,blocked);assert.equal(f.writes.length,0);assert.equal(f.fetches.length,1);
});

test('measurement options are detached before awaiting the stored source read',async()=>{
  const record=measuredFixtureRecord(frozenMedia()),f=fixture({storedMedia:[record],fetcher:async()=>Response.json(presentationCapabilitiesForVersion(29))});
  const options={sha256:record.sha256,mediaTiming:structuredClone(record.mediaTiming),expectedRevision:'media-1',actor:'fixture'},before=structuredClone(options);
  let entered,release;const started=new Promise(resolve=>entered=resolve),later=new Promise(resolve=>release=resolve);
  f.repository.getMedia=async()=>{entered();await later;return structuredClone(record);};
  const work=f.wrapped.withMutationContext(()=>f.wrapped.saveMediaTiming(record.id,options),{metadata:record.classification,mediaTiming:record.mediaTiming});
  await started;options.mediaTiming.video.trackId=99;options.actor='changed';release();
  assert.equal(await work,'timing-result');assert.deepEqual(f.writes[0],['saveMediaTiming',record.id,before]);assert.equal(f.fetches.length,1);
});

test('v30 permits pending embedded AV metadata without granting approval or measurement permission',async()=>{
  const metadata={dealerId:'astrid',eventId:'speak.goodluck',kind:'speech',situation:'goodluck',
    recordedSpeech:embeddedRecordedSpeech({approved:false,verified:false})},before=structuredClone(metadata);
  const f=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(30))});
  await f.wrapped.withMutationContext(async()=>{
    await f.wrapped.registerMedia({classification:metadata});
    await f.wrapped.classifyMedia('id',{metadata});
    const measured=measuredFixtureRecord({id:'20000000-0000-4000-8000-000000000001',sha256:'a'.repeat(64),size:4096,classification:metadata});
    await assert.rejects(f.wrapped.saveMediaTiming(measured.id,{sha256:measured.sha256,mediaTiming:measured.mediaTiming}),blocked);
  },{metadata});
  assert.deepEqual(metadata,before);
  assert.deepEqual(f.writes[0][1].classification,before);assert.deepEqual(f.writes[1][2].metadata,before);
  assert.equal(f.writes.length,2);assert.equal(f.fetches.length,1);
  assert.equal(f.fetches[0][1].headers['X-Presentation-Capability-Version'],'30');
});

test('frozen embedded AV requires v30 before SQL and preserves the exact published source and review',async()=>{
  const value=embeddedFrozenPackage(),before=structuredClone(value);
  assert.equal(presentationPackageRequiresV30(value),true);
  assert.equal(presentationPackageRequiresV30(frozenPackage()),false);
  const legacy=frozenPackage(value=>bindFrozenMedia(value,frozenMedia({eventId:'speak.goodluck',kind:'speech',
    situation:'goodluck',recordedSpeech:recordedSpeech()})));
  assert.equal(presentationPackageRequiresV30(legacy),false);
  for(const version of [29,30]){
    let begun=0,inSql=false;
    const f=fixture({fetcher:async()=>{assert.equal(inSql,false);return Response.json(presentationCapabilitiesForVersion(version));}});
    f.repository.transaction=async work=>{begun++;inSql=true;try{return await work(f.repository);}finally{inSql=false;}};
    const publish=()=>f.wrapped.transaction(repo=>repo.saveDocument('presentation-package',{value}),
      {presentationMutation:{kind:'presentation-package',value}});
    if(version===29)await assert.rejects(publish,blocked);
    else{await publish();assert.deepEqual(f.writes[0][2].value,before);}
    assert.equal(begun,version===30?1:0);assert.equal(f.writes.length,version===30?1:0);
    assert.equal(f.fetches.length,1);assert.equal(f.fetches[0][1].headers['X-Presentation-Capability-Version'],'30');
    assert.deepEqual(value,before);
  }
});

test('native archive and lifecycle keep frozen embedded AV gated before both mutation locks',async()=>{
  const value=embeddedFrozenPackage(),frozen={kind:'presentation-package',value};
  for(const kind of ['material-trash','resource-lifecycle','dealer-archive'])for(const version of [29,30]){
    let productLocks=0,studioLocks=0,inProduct=false,inStudio=false;
    const f=fixture({fetcher:async()=>{assert.equal(inProduct,false);assert.equal(inStudio,false);
      return Response.json(presentationCapabilitiesForVersion(version));}});
    f.repository.transaction=async work=>{studioLocks++;inStudio=true;try{return await work(f.repository);}finally{inStudio=false;}};
    const mutate=createNativePresentationMutationTransaction({repository:f.wrapped,
      boDb:{async transaction(work){productLocks++;inProduct=true;try{
        return await f.wrapped.transaction(work,{presentationMutation:frozen});
      }finally{inProduct=false;}}}});
    const write=()=>mutate(()=>f.wrapped.saveDocument('presentation-package',{value}),
      {presentationMutation:[{kind,value:{}},frozen]});
    if(version===29)await assert.rejects(write,blocked);else await write();
    assert.equal(productLocks,version===30?1:0);assert.equal(studioLocks,version===30?1:0);
    assert.equal(f.writes.length,version===30?1:0);assert.equal(f.fetches.length,1);
    assert.equal(f.fetches[0][1].headers['X-Presentation-Capability-Version'],'30');
  }
});

test('a v29 frozen measurement context cannot acquire embedded AV after either SQL boundary',async()=>{
  const measured=frozenPackage();measured.playback.media.forEach(row=>measuredFixtureRecord(row));
  measured.registeredDealers[0].idle=structuredClone(measured.playback.media[0]);
  const value=embeddedFrozenPackage(),f=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(29))});
  let begun=0;f.repository.transaction=async work=>{begun++;return work(f.repository);};
  await f.wrapped.transaction(async repo=>{
    await assert.rejects(repo.withMutationContext(()=>assert.fail('no frozen source widening'),{kind:'presentation-package',value}),blocked);
    await assert.rejects(repo.saveDocument('presentation-package',{value}),blocked);
  },{presentationMutation:{kind:'presentation-package',value:measured}});
  assert.equal(begun,1);assert.equal(f.writes.length,0);assert.equal(f.fetches.length,1);
  assert.equal(f.fetches[0][1].headers['X-Presentation-Capability-Version'],'29');
});

test('embedded AV preflight permissions are snapshotted and cannot be introduced during the remote await',async()=>{
  const metadata={dealerId:'astrid',recordedSpeech:recordedSpeech()},descriptor={metadata};
  const f=fixture({fetcher:async()=>{descriptor.metadata.recordedSpeech=embeddedRecordedSpeech({approved:false});
    return Response.json(presentationCapabilitiesForVersion(17));}});
  await f.wrapped.withMutationContext(async()=>{
    await assert.rejects(f.wrapped.registerMedia({classification:metadata}),blocked);
    await assert.rejects(f.wrapped.withMutationContext(()=>assert.fail('no edited descriptor'),descriptor),blocked);
  },descriptor);
  assert.equal(f.fetches.length,1);assert.equal(f.writes.length,0);
});
