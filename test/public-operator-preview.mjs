import test from 'node:test';
import assert from 'node:assert/strict';
import {addDealer,createEmptyProject,defaultPresentationLane} from '../lab/lib/studio-model.mjs';
import {captureFrozenPresentation} from '../web/storage/frozen-presentation-capture.mjs';
import {withPackagePresentation,readPackagePresentation} from '../web/storage/presentation-package.mjs';
import {defaultCompositionSettings} from '../web/public/composition-settings.mjs';
import {layerAssetPath} from '../web/presentation-layers.mjs';
import {createPublicOperatorPreview} from '../web/public-operator-preview.mjs';
import {previewMediaPath,validatePublicOperatorPreview} from '../web/public/operator-preview-contract.mjs';
import {createPortraitRoomEntryFixture} from './fixtures/portrait-room-entry.mjs';
import {materialSource} from '../web/public/material-catalog.mjs';

const context={operatorSlug:'north',roomId:'room-north',packageRevision:7,dealerId:'johanna'};
const descriptor='/api/operators/north/rooms/room-north/preview?dealer=johanna&revision=7';
const clone=structuredClone;
function asset(role,n) {
  const row={schemaVersion:1,id:'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),role,label:role+' '+n,
    sha256:'a'.repeat(64),size:128,contentType:'image/png',width:720,height:1280};
  return {...row,pathname:layerAssetPath(row)};
}
function fixture({schemaVersion=3,compositing=true}={}) {
  const project=[['johanna','Johanna'],['nora','Nora'],['astrid','Astrid']].reduce((value,[id,label])=>addDealer(value,id,label),createEmptyProject());
  const lane=defaultPresentationLane('johanna');lane.id='north-presentation';lane.label='Published scene';project.lanes=[lane];
  lane.dealers=['johanna','nora','astrid'];lane.layers.dealer={enabled:true,default:'johanna',allowed:[...lane.dealers]};
  lane.composition=defaultCompositionSettings();
  project.layerAssets=[asset('background',1),asset('background',2),asset('table',3),asset('table',4)];
  lane.layers.background={enabled:true,mode:'image',default:project.layerAssets[0].id,allowed:project.layerAssets.slice(0,2).map(row=>row.id)};
  lane.layers.table={enabled:true,default:project.layerAssets[2].id,allowed:[project.layerAssets[2].id],colors:[]};
  const mediaRows=lane.dealers.map((dealerId,index)=>{
    const id='10000000-0000-4000-8000-'+String(index+1).padStart(12,'0'),sha256=String(index+1).repeat(64);
    const format=compositing==='alpha'?'webm':'mp4';
    project.lines.find(row=>row.dealerId===dealerId&&row.eventId==='idle.ready').variants[0].videoGenerationId=id;
    return {id,sha256,size:4096,contentType:'video/'+format,pathname:'croupier/media/dealers/'+dealerId+'/review/uploads/'+id+'/'+sha256+'.'+format,
      classification:{dealerId,eventId:'idle.ready',kind:'idle',role:'standard',situation:'',label:dealerId,notes:'SECRET_DRAFT_NOTES',playback:'once',
        ...(compositing?{compositing:compositing==='alpha'?{mode:'alpha'}:{mode:'green-screen',threshold:.2,softness:.1,despill:0}}:{})},revision:'media-'+dealerId};
  });
  const inventory={videos:mediaRows.map(record=>({id:record.id,sha256:record.sha256,bytes:record.size,dealer:record.classification.dealerId,
    available:true,classification:record.classification,kind:'idle',playback:'once'})),families:[],summary:{readable:true,snapshotReadable:true}};
  let presentation=captureFrozenPresentation({snapshot:{projectDocument:{kind:'project',revision:project.revision,value:project},
    administrationDocument:{kind:'administration',revision:'admin-snapshot',value:{rooms:[]}},mediaRows},inventory,
    selectedLaneIds:[lane.id],requiredIdleDealerIds:lane.dealers}).presentation;
  if(schemaVersion===2){presentation=clone(presentation);presentation.schemaVersion=2;delete presentation.playback;}
  const room={schemaVersion:2,id:context.roomId,name:'North room',operatorId:'north-id',presentationLaneId:lane.id,gameLaneId:'portrait-johanna',state:'live'};
  const saved={operator:{id:'north-id',slug:'north',name:'North',status:'active',secret:'NEVER_PUBLIC'},
    administration:{gameLane:room.gameLaneId,gameLanes:[{schemaVersion:1,id:room.gameLaneId,label:'Room',
      renderer:'portrait-video',dealer:'johanna',mediaCollection:'johanna-presentation'}],rooms:[room]},
    package:{operatorId:'north-id',revision:7,lanes:[lane.id],games:['blackjack'],tables:[room.id],branding:withPackagePresentation({},presentation)}};
  const reads=[],served=[];
  const api=createPublicOperatorPreview({readCurrentContext:async slug=>{reads.push(slug);return clone(saved);},
    privateMedia:async(record,request)=>{
      served.push({record:clone(record),method:request.method,range:request.headers.get('range')});
      const headers={ETag:'"sha256-'+record.sha256+'"','Content-Type':record.contentType,'Cache-Control':'public, max-age=86400',
        'Accept-Ranges':'bytes','Content-Range':'bytes 0-15/'+record.size,'X-Private-Path':record.pathname};
      if(request.headers.get('if-none-match')===headers.ETag)return new Response(null,{status:304,headers});
      if(request.headers.get('range')==='bytes=999999-')return new Response('PRIVATE_PROVIDER_ERROR',{status:416,headers});
      return new Response(request.method==='HEAD'?null:'published-media',{status:request.headers.has('range')?206:200,headers});
    }});
  const rewrite=change=>{const frozen=readPackagePresentation(saved.package);change(frozen);saved.package.branding=withPackagePresentation({},frozen);};
  return {api,saved,reads,served,project,mediaRows,room,presentation,rewrite};
}
const request=(f,path=descriptor,init)=>f.api.handle(new Request('https://www.example.test'+path,init));
const body=async f=>{const response=await request(f);assert.equal(response.status,200);return response.json();};

test('historical roulette packages hide incompatible tables in descriptors and byte routes',async()=>{
  const f=fixture();f.saved.administration.rooms[0].game='roulette';f.saved.package.games=['roulette'];
  const before=clone(f.saved),value=await body(f);
  assert.deepEqual(value.media.tables,[]);assert.equal(value.media.backgrounds.length,2);
  assert.equal((await request(f,previewMediaPath(context,'table',f.project.layerAssets[2].id))).status,404);
  assert.equal(f.served.length,0);assert.deepEqual(f.saved,before);
});

test('roulette never exposes the same persons blackjack idle or its media route',async()=>{
  const f=fixture();f.saved.administration.rooms[0].game='roulette';f.saved.package.games=['roulette'];
  f.rewrite(pack=>{for(const asset of pack.assets)if(asset.role==='table')asset.game='roulette';});
  const value=await body(f);
  assert.equal(value.media.dealer,null);
  assert.equal(value.media.backgrounds.length,2);
  const result=await request(f,previewMediaPath(context,'dealer',f.mediaRows[0].id));
  assert.equal(result.status,404);assert.equal(f.served.length,0);
});

test('v2/v3 published descriptor selects one frozen dealer and only allowed layers without private records',async()=>{
  for(const schemaVersion of [2,3]) {
    const f=fixture({schemaVersion}),before=clone(f.saved),value=await body(f);
    assert.deepEqual(validatePublicOperatorPreview(value,context),value);
    assert.equal(value.dealer.label,'Johanna');assert.equal(value.independentLayers,true);
    assert.deepEqual(value.settings,defaultCompositionSettings());
    assert.equal(value.media.dealer.src,previewMediaPath(context,'dealer',f.mediaRows[0].id));
    assert.deepEqual(value.media.dealer.compositing,f.mediaRows[0].classification.compositing);
    assert.equal(value.media.tables.length,1);assert.equal(value.media.backgrounds.length,2);
    assert.doesNotMatch(JSON.stringify(value),/pathname|sha256|SECRET|NEVER_PUBLIC|classification|revision.*media|blob|projectRevision/);
    assert.deepEqual(f.reads,['north']);assert.equal(f.served.length,0);assert.deepEqual(f.saved,before);
  }
});
test('frozen alpha survives the public descriptor and immutable byte route without weakening game isolation',async()=>{
  for(const schemaVersion of [2,3]) {
    const f=fixture({schemaVersion,compositing:'alpha'}),before=clone(f.saved),value=await body(f);
    assert.deepEqual(value.media.dealer.compositing,{mode:'alpha'});
    assert.equal(value.media.dealer.contentType,'video/webm');
    assert.deepEqual(validatePublicOperatorPreview(value,context),value);
    const response=await request(f,value.media.dealer.src);
    assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'video/webm');
    assert.deepEqual(f.saved,before);
    f.saved.administration.rooms[0].game='roulette';f.saved.package.games=['roulette'];
    assert.equal((await body(f)).media.dealer,null);
    assert.equal((await request(f,value.media.dealer.src)).status,404);
    assert.equal(f.served.length,1,'roulette cannot fetch even an alpha blackjack idle');
  }
});

test('preview labels match canonical supplied material while byte paths remain publication-scoped',async()=>{
  const f=fixture(),{kind,...signature}=materialSource('studio-teal','video');
  f.rewrite(pack=>{const asset=pack.assets[0];Object.assign(asset,signature);asset.pathname=layerAssetPath(asset);});
  const before=clone(f.saved),value=await body(f);
  assert.equal(value.media.backgrounds[0].label,'Studio · turkos');
  assert.equal(value.media.backgrounds[0].contentType,'video/mp4');
  assert.equal(value.media.backgrounds[0].src,previewMediaPath(context,'background',f.project.layerAssets[0].id));
  assert.equal(value.media.backgrounds.length,2);assert.equal(value.media.backgrounds[1].label,'background 2');
  assert.deepEqual(f.saved,before);
});

test('GET/HEAD forward Range and exact immutable storage tuple; every media read is fresh and uncached',async()=>{
  const f=fixture(),value=await body(f);
  for(const src of [value.media.dealer.src,value.media.tables[0].src,value.media.backgrounds[0].src]) {
    const response=await request(f,src,{headers:{range:'bytes=0-15'}});
    assert.equal(response.status,206);assert.equal(await response.text(),'published-media');
    assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.headers.has('x-private-path'),false);
    assert.equal(response.headers.get('accept-ranges'),'bytes');
    const head=await request(f,src,{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
  }
  assert.equal(f.reads.length,7);assert.equal(f.served.length,6);
  assert.deepEqual(f.served[0],{record:{provider:'vercel-blob',pathname:f.mediaRows[0].pathname,sha256:f.mediaRows[0].sha256,size:4096,contentType:'video/mp4'},method:'GET',range:'bytes=0-15'});
  const head=await request(f,descriptor,{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');assert.equal(f.served.length,6);
});
test('stale revision and withdrawn room/operator/package are rejected before Blob I/O, even conditional requests',async()=>{
  const changes=[
    [409,f=>f.saved.package.revision++],[404,f=>f.saved.operator.status='suspended'],
    [404,f=>f.saved.administration.rooms[0].state='preview'],[404,f=>f.saved.administration.rooms[0].operatorId='foreign'],
    [404,f=>f.saved.package.tables=[]],[404,f=>f.saved.package.games=[]],[404,f=>f.saved.administration.rooms=[]],
    [404,f=>f.saved.package=null],[404,f=>f.saved.operator=null],
  ];
  for(const [status,change] of changes) {
    const f=fixture(),value=await body(f);change(f);
    assert.equal((await request(f)).status,status);
    const response=await request(f,value.media.dealer.src,{headers:{'if-none-match':'"sha256-'+f.mediaRows[0].sha256+'"',range:'bytes=0-15'}});
    assert.equal(response.status,status);assert.equal(f.served.length,0);assert.equal(response.headers.get('cache-control'),'private, no-store');
  }
});
test('room, dealer, role, foreign media and unpublished layer cannot be substituted',async()=>{
  const f=fixture(),value=await body(f);
  for(const path of [
    descriptor.replace('room-north','room-foreign'),descriptor.replace('dealer=johanna','dealer=foreign'),
    value.media.dealer.src.replace(f.mediaRows[0].id,f.mediaRows[1].id),
    previewMediaPath(context,'table',f.project.layerAssets[3].id),
    previewMediaPath(context,'table',f.project.layerAssets[0].id),
    previewMediaPath(context,'background',f.project.layerAssets[2].id),
  ])assert.equal((await request(f,path)).status,404,path);
  assert.equal(f.served.length,0);
});
test('layer withdrawal from selected frozen lane is effective before descriptor and byte response',async()=>{
  const f=fixture(),value=await body(f);
  f.rewrite(pack=>{pack.lanes[0].layers.table.allowed=[];pack.lanes[0].layers.table.default=null;pack.assets=pack.assets.filter(row=>row.role!=='table');});
  const next=await body(f);assert.equal(next.media.tables.length,0);
  assert.equal((await request(f,value.media.tables[0].src)).status,404);assert.equal(f.served.length,0);
});
test('historical missing or opaque keying retains only its expressly allowed independent layers',async()=>{
  for(const opaque of [false,true]) {
    const f=fixture({compositing:false});
    // Historical package decoding remains supported; the new-capture API is
    // intentionally not used to publish opaque metadata.
    if(opaque)f.rewrite(pack=>{
      for(const row of [...pack.registeredDealers.map(dealer=>dealer.idle),...pack.playback.media])row.classification.compositing={mode:'opaque'};
    });
    const before=clone(f.saved),value=await body(f);
    assert.equal(value.independentLayers,true);assert.deepEqual(value.settings,defaultCompositionSettings());
    assert.equal(value.media.dealer.compositing,undefined,'the preview applies its mandatory legacy keying default');
    assert.equal(value.media.tables.length,1);assert.equal(value.media.backgrounds.length,2);
    assert.equal((await request(f,previewMediaPath(context,'table',f.project.layerAssets[2].id))).status,200);
    assert.equal((await request(f,previewMediaPath(context,'table',f.project.layerAssets[3].id))).status,404);
    assert.deepEqual(f.saved,before);
  }
});
test('historical full-frame and baked flags preserve layer grants without admitting unpublished media',async()=>{
  const f=fixture();f.rewrite(pack=>{delete pack.lanes[0].composition;pack.lanes[0].layers.background.mode='baked';});
  const before=clone(f.saved),value=await body(f);
  assert.equal(value.independentLayers,true);assert.deepEqual(value.settings,defaultCompositionSettings());
  assert.equal(value.media.tables.length,1);assert.equal(value.media.backgrounds.length,2);
  for(const asset of [...value.media.tables,...value.media.backgrounds])assert.equal((await request(f,asset.src)).status,200);
  assert.equal((await request(f,previewMediaPath(context,'table',f.project.layerAssets[3].id))).status,404);
  assert.deepEqual(f.saved,before);
});
test('former dealer names require own published media and retired Amira remains rejected',async()=>{
  const f=fixture(),response=await request(f,descriptor.replace('dealer=johanna','dealer=astrid'));
  assert.equal(response.status,200);const value=await response.json();
  assert.equal(value.dealer.id,'astrid');assert.equal(value.media.dealer.src,previewMediaPath({...context,dealerId:'astrid'},'dealer',f.mediaRows[2].id));assert.equal(f.served.length,0);
  const original=await request(f,descriptor.replace('dealer=johanna','dealer=amira'));
  assert.equal(original.status,400);assert.deepEqual(await original.json(),{error:'invalid_preview_request'});
  const unpublished=await request(f,descriptor.replace('dealer=johanna','dealer=vera'));assert.equal(unpublished.status,404);assert.equal(f.served.length,0);
  const legacy=createPortraitRoomEntryFixture({dealer:'amira'});
  const api=createPublicOperatorPreview({readCurrentContext:async()=>({operator:{id:legacy.room.operatorId,slug:'sg-test',status:'active'},package:legacy.pack,administration:legacy.administration}),privateMedia:()=>assert.fail('retired dealer never reaches private media')});
  const old=await api.handle(new Request('https://example.test/api/operators/sg-test/rooms/'+legacy.room.id+'/preview?dealer=amira&revision=7'));
  assert.equal(old.status,400);assert.deepEqual(await old.json(),{error:'invalid_preview_request'});
});
test('strict request grammar rejects duplicate/extra queries, malformed ids and methods before snapshots',async()=>{
  const f=fixture();
  for(const path of [descriptor+'&dealer=johanna',descriptor+'&extra=1',descriptor.replace('&revision=7',''),descriptor.replace('revision=7','revision=01'),
    descriptor.replace('revision=7','revision=9007199254740992'),descriptor.replace('dealer=johanna','dealer=../private'),descriptor.replace('/north/','/%6eorth/'),
    descriptor.replace('/room-north/','/room_1/'),previewMediaPath(context,'dealer',f.mediaRows[0].id)+'?x=1']) {
    assert.equal((await request(f,path)).status,400,path);
  }
  const post=await request(f,descriptor,{method:'POST'});assert.equal(post.status,405);assert.equal(post.headers.get('allow'),'GET, HEAD');
  assert.equal(f.reads.length,0);assert.equal(f.served.length,0);
  assert.equal(await request(f,'/api/operators/north/rooms'),null);
});
test('underlying failures and integrity mismatch expose no provider body, secrets or redirected URLs',async()=>{
  const f=fixture();
  const make=privateMedia=>({api:createPublicOperatorPreview({readCurrentContext:async()=>clone(f.saved),privateMedia})});
  const src=previewMediaPath(context,'dealer',f.mediaRows[0].id);
  for(const privateMedia of [
    ()=>{throw Error('SECRET_BLOB_TOKEN');},
    ()=>new Response('SECRET_BLOB_RESPONSE',{status:500}),
    ()=>new Response(null,{status:302,headers:{Location:'https://private.example/token'}}),
  ]) {
    const response=await request(make(privateMedia),src);assert.equal(response.status,503);
    assert.doesNotMatch(await response.text(),/SECRET|private.example/);assert.equal(response.headers.has('location'),false);
  }
  const mismatch=await request(make(()=>new Response('wrong bytes',{headers:{ETag:'"wrong"'}})),src);
  assert.equal(mismatch.status,409);
  const unavailable=await request({api:createPublicOperatorPreview()});assert.equal(unavailable.status,503);
});
test('authorized conditional and unsatisfiable Range responses retain safe semantics',async()=>{
  const f=fixture(),src=previewMediaPath(context,'dealer',f.mediaRows[0].id);
  const cached=await request(f,src,{headers:{'if-none-match':'"sha256-'+f.mediaRows[0].sha256+'"'}});
  assert.equal(cached.status,304);assert.equal(await cached.text(),'');assert.equal(cached.headers.get('cache-control'),'private, no-store');
  const invalid=await request(f,src,{headers:{range:'bytes=999999-'}});
  assert.equal(invalid.status,416);assert.equal(await invalid.text(),'');assert.equal(invalid.headers.has('content-length'),false);
  assert.equal(f.reads.length,2);
});
test('client contract rejects foreign URLs, contexts, extra fields and hidden storage data',async()=>{
  const value=await body(fixture());
  for(const change of [
    row=>row.secret='private',row=>row.media.dealer.pathname='private',row=>row.media.dealer.compositing.softness=0,
    row=>row.media.dealer.src='https://private.example/video',
    row=>row.media.dealer.src=row.media.dealer.src.replace('/north/','/other/'),
    row=>row.media.tables[0].src=row.media.tables[0].src.replace('/table/','/background/'),
    row=>row.media.backgrounds.push(clone(row.media.backgrounds[0])),
    row=>row.settings.token='private',row=>row.independentLayers=false,
  ]){const row=clone(value);change(row);assert.throws(()=>validatePublicOperatorPreview(row,context));}
  assert.throws(()=>validatePublicOperatorPreview(value,{...context,packageRevision:8}));
});

test('v2 portrait anchor and v3 published dealer change never authorize a foreign registered baseline',async()=>{
  const old=fixture({schemaVersion:2});
  assert.equal((await request(old,descriptor.replace('dealer=johanna','dealer=nora'))).status,404);
  const f=fixture(),value=await body(f);
  // Keep the immutable package valid while changing the actual game room to an
  // incompatible renderer. A browser retaining media URLs must fail closed.
  f.saved.administration.gameLanes[0].renderer='indexed-video';
  f.saved.administration.gameLanes[0].mediaCollection='legacy-dealers';
  const response=await request(f,value.media.dealer.src);
  assert.ok([404,503].includes(response.status));assert.equal(f.served.length,0);
});
