import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {resolveRoomGameMaterial} from '../packages/presentation/server/room-game-material.mjs';
import {withPackagePresentation} from '../packages/presentation/server/presentation-package.mjs';
import {defaultPresentationLane} from '../packages/presentation/contracts/studio-model.mjs';
import {recordedSpeechIdentity} from '../packages/presentation/contracts/recorded-speech.mjs';
import {runtimeCatalogRevision} from '../packages/studio-registry/server/runtime-catalog.mjs';
import {cloudPresentationFixture} from '../apps/studio/test/fixtures/cloud-presentation.mjs';
import {readRuntimeCatalogFixture} from './fixtures/runtime-media-catalog.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
const speechId='80000000-0000-4000-8000-000000000001';
const unavailable=error=>error.code==='studio_room_game_material_unavailable'&&error.statusCode===422;
function fixture(language='sv',stillSource=null) {
  const cloud=cloudPresentationFixture({lanes:[defaultPresentationLane('linnea')]}),presentation=cloud.presentation;
  const idle=presentation.registeredDealers[0].idle,videoSha256=hash('isolated speech bytes');
  const speech={schemaVersion:1,dealerId:'linnea',lineId:'goodluck',takeId:'goodluck_1',language,exactText:'Fixture only.',
    videoSha256,audioSha256:hash('audio'),indexSha256:hash('index'),fps:24,frameCount:48,audioDelayMs:0,
    entryPose:'VILA',exitPose:'VILA',calibrationRevision:'fixture-1',recording:{status:'pending'},review:{status:'pending'}};
  const identity=recordedSpeechIdentity(speech),proof={by:'fixture-reviewer',at:'2026-10-22T00:00:00.000Z',identity};
  speech.recording={status:'verified-recording',...structuredClone(proof)};speech.review={status:'approved',...structuredClone(proof)};
  const record={id:speechId,sha256:videoSha256,size:4096,contentType:'video/mp4',
    pathname:`croupier/media/dealers/linnea/review/uploads/${speechId}/${videoSha256}.mp4`,
    classification:{dealerId:'linnea',eventId:'speak.goodluck',kind:'speech',role:'standard',situation:'goodluck',label:'Fixture',notes:'',recordedSpeech:speech}};
  const line=presentation.playback.lines.find(row=>row.eventId==='speak.goodluck');line.variants[0].videoGenerationId=speechId;
  presentation.playback.media.push(record);
  const room={schemaVersion:2,id:'room-fixture',name:'Fixture',operatorId:'north',presentationLaneId:'mobile-phone',gameLaneId:'fixture-lane',state:'live'};
  const pack={operatorId:'north',revision:7,tables:[room.id],games:['blackjack'],lanes:[room.presentationLaneId],branding:withPackagePresentation({},presentation)};
  const catalog=readRuntimeCatalogFixture(),timingText=JSON.stringify({frames:{flip:{'-':48},1:{'-':24}}});
  const catalogue=[],entries=[];
  const add=(source,logicalPath,mediaId=null,speechBinding=null,text=null)=>{
    const id=mediaId??'80000000-0000-4000-8000-000000000002',ext=text!==null?'json':['still','keyed-still'].includes(source.source)?'png':'mp4';
    catalog.layout.files.push({path:logicalPath,legacyPath:source.path,sha256:source.sha256,size:source.bytes,access:'private'});
    catalog.blobIndex.files.push({logicalPath,access:'private',sha256:source.sha256,size:source.bytes,
      storage:{provider:'vercel-blob',pathname:`croupier/media/game/runtime/j08-fixture/${id}/${source.sha256}.${ext}`,
        sha256:source.sha256,size:source.bytes,contentType:{json:'application/json',png:'image/png',mp4:'video/mp4'}[ext]}});
    if(text!==null)catalog.legacy.entries['media/'+logicalPath]=text;
    catalogue.push(source);entries.push({source:structuredClone(source),logicalPath,mediaId,speech:speechBinding});
  };
  add({dealer:'dragge',source:'idle-tagning',slot:'idle.ready',variant:'bas',language:'',path:'media/dealers/dragge/idle.mp4',bytes:idle.size,sha256:idle.sha256},'game/runtime/j08-idle.mp4',idle.id);
  add({dealer:'dragge',source:'replik',slot:'speak.goodluck',variant:'',language,path:`media/dealers/dragge/repliker/${language}/goodluck_1.mp4`,bytes:record.size,sha256:record.sha256},'game/runtime/j08-speech.mp4',record.id,{lineId:'goodluck',takeId:'goodluck_1'});
  add({dealer:'dragge',source:'data-beroende',slot:'',variant:'',language:'',path:'media/dealers/dragge/v2/meta.json',bytes:Buffer.byteLength(timingText),sha256:hash(timingText)},'game/runtime/j08-meta.json',null,null,timingText);
  if(stillSource)add({dealer:'dragge',source:stillSource,slot:'idle.ready',variant:'',language:'',path:'media/dealers/dragge/v2/vila.png',bytes:64,sha256:hash('isolated PNG bytes')},'game/runtime/j08-still.png');
  const input={package:pack,room,language,catalogue,capturedCatalog:{revision:runtimeCatalogRevision(catalog),value:catalog},
    identityMap:{operatorId:'north',packageRevision:7,roomId:room.id,presentationLaneId:room.presentationLaneId,dealerId:'linnea',sourceDealer:'dragge',entries}};
  const planned={ok:true,contract:'k04-material-revision/1',dealer:'dragge',language,leadMs:3580,cardMs:1080,revision:hash('reviewed producer revision'),
    media:catalogue.map(row=>[row.path,row.bytes,row.sha256]),timing:{source:catalogue[2].path,sourceSha256:catalogue[2].sha256}};
  let called=0;
  input.planningRevision=args=>{
    called++;assert.equal(args.dealer,'dragge');assert.equal(args.language,language);
    for(const source of catalogue)assert.equal(args.observed.get(source.path),source.sha256);
    assert.equal(args.documents.get(catalogue[2].path).toString('utf8'),timingText);
    return structuredClone(planned);
  };
  return {input,planned,presentation,called:()=>called,republish(){pack.branding=withPackagePresentation({},presentation);},recapture(){input.capturedCatalog.revision=runtimeCatalogRevision(catalog);}};
}

test('explicit frozen binding translates registered identities and exact timing bytes without mutating sources',()=>{
  for(const language of ['sv','en']) {
    const f=fixture(language),before=structuredClone({...f.input,planningRevision:null});
    const result=resolveRoomGameMaterial(f.input);
    assert.equal(result.dealerId,'linnea');assert.equal(result.language,language);assert.equal(result.leadMs,3580);assert.equal(result.cardMs,1080);
    assert.match(result.revision,/^[a-f0-9]{64}$/);assert.equal(result.media.length,2);assert.ok(result.media.some(row=>row.id===speechId));
    assert.deepEqual({...f.input,planningRevision:null},before);assert.equal(f.called(),1);
    assert.deepEqual(resolveRoomGameMaterial(f.input),result);
    f.planned.revision=hash('new producer revision');assert.notEqual(resolveRoomGameMaterial(f.input).revision,result.revision);
    const producer=f.input.planningRevision;
    f.input.planningRevision=args=>{const value=producer(args);args.catalogue[0].bytes++;value.media[0][1]++;return value;};
    assert.throws(()=>resolveRoomGameMaterial(f.input),unavailable);
  }
});
test('room override binds the explicit imported bank instead of the different template dealer',()=>{
  const f=fixture(),alternate=cloudPresentationFixture({lanes:[defaultPresentationLane('nora')]}).presentation;
  const lane=f.presentation.lanes[0];lane.dealers=['linnea','nora'];
  lane.layers.dealer.allowed=[...lane.dealers];lane.layers.dealer.default='nora';
  f.presentation.registeredDealers.push(...alternate.registeredDealers);
  f.presentation.playback.lines.push(...alternate.playback.lines);
  f.presentation.playback.media.push(...alternate.playback.media);
  f.republish();
  assert.throws(()=>resolveRoomGameMaterial(f.input),unavailable);
  f.input.package.branding.roomOverrides={[f.input.room.id]:{dealer:'linnea'}};
  const selected=resolveRoomGameMaterial(f.input);assert.equal(selected.dealerId,'linnea');
  f.input.package.branding.roomOverrides['another-room']={dealer:'nora'};
  assert.deepEqual(resolveRoomGameMaterial(f.input),selected);
  f.input.package.branding.roomOverrides[f.input.room.id].dealer='foreign';
  assert.throws(()=>resolveRoomGameMaterial(f.input),unavailable);
});

test('missing producer, mapping or exact operator/package/room/dealer context refuses before planning',()=>{
  for(const change of [f=>delete f.input.planningRevision,f=>delete f.input.identityMap,f=>f.input.identityMap.packageRevision++,
    f=>f.input.identityMap.roomId='other',f=>f.input.identityMap.presentationLaneId='other',f=>f.input.identityMap.operatorId='other',
    f=>f.input.identityMap.dealerId='nora',f=>f.input.package.tables=[],f=>f.input.room.state='preview',f=>f.input.room.game='roulette',
    f=>f.input.language='de']) {
    const f=fixture();change(f);assert.throws(()=>resolveRoomGameMaterial(f.input),unavailable);assert.equal(f.called(),0);
  }
});
test('catalogue claims, aliases, wrong variants and fabricated observed values cannot replace captured identities',()=>{
  for(const change of [f=>f.input.identityMap.entries[0].logicalPath='game/runtime/missing.mp4',
    f=>{f.input.catalogue[0].sha256='a'.repeat(64);f.input.identityMap.entries[0].source.sha256='a'.repeat(64);},
    f=>f.input.identityMap.entries[0].source.variant='u',f=>f.input.identityMap.entries[0].mediaId='unbound',
    f=>f.input.identityMap.entries.push(structuredClone(f.input.identityMap.entries[0])),
    f=>f.input.catalogue.push(structuredClone(f.input.catalogue[0])),
    f=>f.input.identityMap.entries[1].speech.takeId='goodluck_2',f=>f.input.identityMap.entries[1].speech.lineId='win',
    f=>f.input.identityMap.entries[1].speech=null]) {
    const f=fixture();change(f);assert.throws(()=>resolveRoomGameMaterial(f.input),unavailable);assert.equal(f.called(),0);
  }
  const corrupt=fixture();corrupt.input.capturedCatalog.value.blobIndex.files.at(-1).sha256='a'.repeat(64);
  assert.throws(()=>resolveRoomGameMaterial(corrupt.input),error=>error.code==='studio_runtime_catalog_invalid');assert.equal(corrupt.called(),0);
});
test('unapproved or different-language speech never acquires publication rights from matching video bytes',()=>{
  for(const change of [f=>f.presentation.playback.media.at(-1).classification.recordedSpeech.review={status:'pending'},
    f=>{const s=f.presentation.playback.media.at(-1).classification.recordedSpeech;s.language='en';s.recording.identity.language='en';s.review.identity.language='en';},
    f=>delete f.presentation.playback.media.at(-1).classification.recordedSpeech]) {
    const f=fixture();change(f);f.republish();assert.throws(()=>resolveRoomGameMaterial(f.input),unavailable);assert.equal(f.called(),0);
  }
});
test('producer refusals, incomplete media and missing or substituted timing text remain unavailable',()=>{
  for(const change of [f=>f.input.planningRevision=()=>({ok:false,reason:'media_set_not_verified'}),
    f=>f.planned.media.pop(),f=>f.planned.media.push(f.planned.media[0]),f=>f.planned.media[0][2]='a'.repeat(64),
    f=>f.planned.dealer='other',f=>f.planned.language='en',f=>f.planned.revision='not-a-revision',
    f=>f.planned.cardMs=0,f=>f.planned.leadMs=60001,f=>f.planned.timing.source='absent',
    f=>f.planned.timing.sourceSha256='a'.repeat(64)]) {
    const f=fixture();change(f);assert.throws(()=>resolveRoomGameMaterial(f.input),error=>error.statusCode===422);
  }
  const f=fixture();delete f.input.capturedCatalog.value.legacy.entries['media/game/runtime/j08-meta.json'];f.recapture();
  assert.throws(()=>resolveRoomGameMaterial(f.input),error=>error.code==='studio_runtime_catalog_invalid');assert.equal(f.called(),0);
});

test('catalogue-bound PNG stills preserve exact package and material revision without a video identity',()=>{
  for(const source of ['still','keyed-still'])for(const language of ['en','sv']) {
    const f=fixture(language,source),before=structuredClone({...f.input,planningRevision:null});
    const result=resolveRoomGameMaterial(f.input);
    assert.equal(result.media.length,2);assert.equal(f.called(),1);
    assert.deepEqual({...f.input,planningRevision:null},before);
    assert.deepEqual(resolveRoomGameMaterial(f.input),result);
    const entry=f.input.identityMap.entries.at(-1),catalog=f.input.capturedCatalog.value;
    const layout=catalog.layout.files.find(row=>row.path===entry.logicalPath),blob=catalog.blobIndex.files.find(row=>row.logicalPath===entry.logicalPath);
    const nextHash=hash('different isolated PNG bytes');
    f.input.catalogue.at(-1).sha256=entry.source.sha256=layout.sha256=blob.sha256=blob.storage.sha256=nextHash;
    blob.storage.pathname=blob.storage.pathname.replace(/[a-f0-9]{64}\.png$/,nextHash+'.png');
    f.planned.media.at(-1)[2]=nextHash;f.recapture();
    assert.notEqual(resolveRoomGameMaterial(f.input).revision,result.revision);
  }
});

test('PNG still binding refuses fabricated identity, wrong source/path/type and stale captured revision',()=>{
  const changes=[
    f=>f.input.identityMap.entries.at(-1).mediaId=speechId,
    f=>f.input.identityMap.entries.at(-1).speech={lineId:'goodluck',takeId:'goodluck_1'},
    f=>f.input.identityMap.entries.at(-1).logicalPath='game/runtime/missing.png',
    f=>f.input.identityMap.entries.at(-1).source.sha256='a'.repeat(64),
    f=>f.input.identityMap.entries.at(-1).source.bytes++,
    f=>{f.input.catalogue.at(-1).sha256=f.input.identityMap.entries.at(-1).source.sha256='a'.repeat(64);},
    f=>{f.input.catalogue.at(-1).bytes++;f.input.identityMap.entries.at(-1).source.bytes++;},
    f=>f.input.identityMap.entries.at(-1).source.source='data-beroende',
    f=>f.input.identityMap.entries.at(-1).source.path='media/dealers/other/vila.png',
    f=>f.input.identityMap.packageRevision++,
    f=>f.input.identityMap.roomId='other',
    f=>f.input.identityMap.operatorId='other',
    f=>f.input.identityMap.dealerId='other',
    f=>f.input.capturedCatalog.revision='a'.repeat(64),
    f=>{const blob=f.input.capturedCatalog.value.blobIndex.files.at(-1);blob.storage.contentType='video/mp4';blob.storage.pathname=blob.storage.pathname.replace(/\.png$/,'.mp4');f.recapture();},
    f=>{f.input.catalogue.at(-1).path=f.input.identityMap.entries.at(-1).source.path='media/dealers/dragge/v2/vila.mp4';},
    f=>{const entry=f.input.identityMap.entries.at(-1),catalog=f.input.capturedCatalog.value;
      catalog.layout.files.find(row=>row.path===entry.logicalPath).path='game/runtime/j08-still.mp4';
      catalog.blobIndex.files.find(row=>row.logicalPath===entry.logicalPath).logicalPath='game/runtime/j08-still.mp4';entry.logicalPath='game/runtime/j08-still.mp4';f.recapture();},
  ];
  for(const change of changes) {
    const f=fixture('sv','keyed-still');change(f);
    assert.throws(()=>resolveRoomGameMaterial(f.input),error=>unavailable(error)||error.code==='studio_runtime_catalog_invalid');assert.equal(f.called(),0);
  }
  const f=fixture('sv','keyed-still');f.planned.media.pop();
  assert.throws(()=>resolveRoomGameMaterial(f.input),unavailable);
});
