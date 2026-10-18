import test from 'node:test';
import assert from 'node:assert/strict';
import { createFrozenDealerContextReader, createFrozenDealerPresentationContext } from '../packages/presentation/server/frozen-dealer-presentation.mjs';

import { createPresentationApi } from '../services/game/presentation-api.mjs';
import { Writable } from 'node:stream';
import {canonicalStudioJson} from '../packages/studio-registry/server/document-contract.mjs';
import { operatorRow, packageRow } from './fixtures/operator-package-sql.mjs';

const id = '00000000-0000-4000-8000-000000000001', sha256 = 'a'.repeat(64);
const clone = value => structuredClone(value);
const input = { operatorSlug: 'north', roomId: 'room-julia', packageRevision: 7, dealerId: 'julia' };
function fixture(dealerId = 'julia') {
  const label = dealerId[0].toUpperCase() + dealerId.slice(1);
  const idle = { id, sha256, size: 1024, contentType: 'video/mp4',
    pathname: `croupier/media/dealers/${dealerId}/review/uploads/${id}/${sha256}.mp4`,
    classification: { dealerId, eventId: 'idle.ready', kind: 'idle', role: 'alternative',
      situation: '', label: `${label} Grundloop`, notes: 'Frozen baseline',
      compositing: { mode: 'green-screen', threshold: .23, softness: .15, despill: 0 } } };
  const presentation = { schemaVersion: 2, projectRevision: 'published-project', assets: [],
    lanes: [{ id: 'vip-presentation', dealers: [dealerId], layers: { dealer: { allowed: [dealerId], default: dealerId } } }],
    registeredDealers: [{ id: dealerId, label, idle }] };
  const saved = { operator: { id: 'north-id', slug: 'north', status: 'active' },
    package: { operatorId: 'north-id', revision: 7, lanes: ['vip-presentation'], tables: [`room-${dealerId}`], frozen: presentation },
    administration: { rooms: [{ schemaVersion: 2, id: `room-${dealerId}`, name: `${label} room`, operatorId: 'north-id',
      presentationLaneId: 'vip-presentation', gameLaneId: `portrait-${dealerId}`, state: 'live' }],
      gameLanes: [{ schemaVersion: 1, id: `portrait-${dealerId}`, label, dealer: dealerId, renderer: 'portrait-video', mediaCollection: `${dealerId}-presentation` }] } };
  const reads = [], served = [];
  const service = createFrozenDealerPresentationContext({
    readCurrentContext: async slug => { reads.push(slug); return clone(saved); },
    readPresentation: pack => clone(pack.frozen),
    privateMedia: async (record, request) => { served.push({ record: clone(record), method: request.method, range: request.headers.get('range') });
      return new Response(request.method === 'HEAD' ? null : 'frozen-fixture', { status: request.headers.has('range') ? 206 : 200,
        headers: { ETag: `"sha256-${record.sha256}"`, 'Content-Type': record.contentType } }); },
  });
  return { saved, presentation, idle, service, reads, served };
}
const status = value => error => error.statusCode === value;
const mediaUrl = value => `https://game.example.invalid/api/presentation/registered-idle/${value.operatorSlug}/${value.roomId}/${value.packageRevision}/${value.dealerId}`;

for (const dealerId of ['vera', 'mei', 'amira', 'johanna']) test(`${dealerId} cannot activate an otherwise valid historical frozen package`, async () => {
  const f = fixture(dealerId), before = clone(f.saved), context = { ...input, dealerId, roomId: `room-${dealerId}` };
  await assert.rejects(f.service.configuration(context), error => error.statusCode === 400 && error.code === 'studio_presentation_idle_context_invalid');
  assert.equal((await f.service.response(new Request(mediaUrl(context)))).status, 400);
  assert.equal(f.reads.length, 0); assert.equal(f.served.length, 0);
  assert.deepEqual(f.saved, before, 'historical package remains intact');
});

test('roulette room identity cannot authorize the blackjack playback configuration or bytes',async()=>{
  const f=fixture(); f.saved.administration.rooms[0].game='roulette';
  await assert.rejects(f.service.configuration(input),status(404));
  assert.equal((await f.service.response(new Request(mediaUrl(input)))).status,404);
  assert.equal(f.served.length,0);
});

test('Julia receives only her frozen public descriptor, display label and exact revision URL', async () => {
  const f = fixture(), configuration = await f.service.configuration(input);
  assert.equal(configuration.configurationSource, 'operator-package-v2');
  assert.equal(configuration.projectRevision, 'published-project');
  assert.deepEqual(configuration.dealer, { id: 'julia', label: 'Julia' });
  assert.equal(configuration.dealerIdle.julia.id, id); assert.equal(configuration.dealerIdle.julia.sha256, sha256);
  assert.equal(configuration.dealerIdle.julia.src, new URL(mediaUrl(input)).pathname);
  assert.deepEqual(configuration.dealerIdle.julia.compositing, f.idle.classification.compositing);
  assert.equal(JSON.stringify(configuration).includes('pathname'), false);
  assert.equal(JSON.stringify(configuration).includes('Frozen baseline'), false);
  assert.deepEqual(f.reads, ['north']); assert.equal(f.served.length, 0);
});

test('actual GET/HEAD media transport uses the frozen storage tuple and keeps Range, without latest registry', async () => {
  const f = fixture(), before = clone(f.saved);
  const get = await f.service.response(new Request(mediaUrl(input), { headers: { Range: 'bytes=0-15' } }));
  assert.equal(get.status, 206); assert.equal(await get.text(), 'frozen-fixture');
  const head = await f.service.response(new Request(mediaUrl(input), { method: 'HEAD' }));
  assert.equal(head.status, 200); assert.equal(await head.text(), '');
  assert.deepEqual(f.served[0], { record: { provider: 'vercel-blob', pathname: f.idle.pathname, sha256, size: 1024, contentType: 'video/mp4' }, method: 'GET', range: 'bytes=0-15' });
  assert.deepEqual(f.saved, before); assert.equal(f.reads.length, 2);
});

test('current package revision is re-read for every request and an old tab gets 409 before provider I/O', async () => {
  const f = fixture(); await f.service.configuration(input);
  f.saved.package.revision = 8;
  const response = await f.service.response(new Request(mediaUrl(input)));
  assert.equal(response.status, 409); assert.deepEqual(await response.json(), { error: 'studio_presentation_idle_package_changed' });
  await assert.rejects(f.service.configuration(input), status(409));
  assert.equal(f.reads.length, 3); assert.equal(f.served.length, 0);
});

test('foreign operator, room ownership, revoked membership and nonlive rooms cannot serve idle', async () => {
  for (const change of [
    f => { f.saved.operator.slug = 'other'; },
    f => { f.saved.operator.status = 'suspended'; },
    f => { f.saved.administration.rooms[0].operatorId = 'other-id'; },
    f => { f.saved.administration.rooms[0].state = 'preview'; },
    f => { f.saved.package.tables = []; },
    f => { f.saved.package.lanes = []; },
    f => { f.saved.administration.rooms = []; },
  ]) {
    const f = fixture(); change(f);
    assert.equal((await f.service.response(new Request(mediaUrl(input)))).status, 404);
    assert.equal(f.served.length, 0);
  }
});

test('a frozen allowed dealer still requires her exact portrait game lane, never an original indexed route', async () => {
  for (const change of [
    f => { f.saved.administration.gameLanes[0].dealer = 'nora'; f.saved.administration.gameLanes[0].mediaCollection = 'nora-presentation'; },
    f => { f.saved.administration.gameLanes[0].renderer = 'indexed-video'; f.saved.administration.gameLanes[0].mediaCollection = 'legacy-dealers'; },
    f => { f.saved.administration.gameLanes = []; },
    f => { f.saved.administration.gameLanes.push(clone(f.saved.administration.gameLanes[0])); },
  ]) {
    const f = fixture(); change(f);
    assert.equal((await f.service.response(new Request(mediaUrl(input)))).status, 404);
    assert.equal(f.served.length, 0);
  }
});

test('empty frozen idle is unavailable without another dealer or latest baseline replacement', async () => {
  const f = fixture(); f.presentation.registeredDealers[0].idle = null;
  await assert.rejects(f.service.configuration(input),error=>error.statusCode===404);
  assert.equal((await f.service.response(new Request(mediaUrl(input)))).status, 404);
  assert.equal(f.served.length, 0);
});

test('invalid frozen hash/owner and v1 packages fail closed before private media', async () => {
  for (const change of [
    f => { f.idle.sha256 = 'b'.repeat(64); },
    f => { f.idle.classification.dealerId = 'nora'; },
    f => { f.presentation.registeredDealers = []; },
    f => { f.presentation.schemaVersion = 1; },
  ]) {
    const f = fixture(); change(f);
    const response = await f.service.response(new Request(mediaUrl(input)));
    assert.ok([409, 503].includes(response.status)); assert.equal(f.served.length, 0);
  }
});

test('transport rejects extra/duplicate query, path traversal, unknown IDs and unsupported methods', async () => {
  const f = fixture();
  for (const suffix of ['?dealerId=nora', '?x=1&x=2', '/extra']) {
    assert.equal((await f.service.response(new Request(mediaUrl(input) + suffix))).status, 400);
  }
  for (const dealerId of ['astrid', 'constructor', 'unregistered']) {
    const response = await f.service.response(new Request(mediaUrl({ ...input, dealerId })));
    assert.ok([400, 404].includes(response.status));
  }
  assert.equal((await f.service.response(new Request(mediaUrl(input), { method: 'POST' }))).status, 405);
  assert.equal(await f.service.response(new Request('https://game.example.invalid/api/other')), null);
  assert.equal(f.served.length, 0);
});

test('context is snapshotted before await and failures expose fixed errors without storage details', async () => {
  const f = fixture(), mutable = { ...input }; let resume;
  const reader = new Promise(resolve => { resume = resolve; });
  const service = createFrozenDealerPresentationContext({ readCurrentContext: () => reader,
    readPresentation: pack => pack.frozen, privateMedia: () => { throw Error('PRIVATE storage credential'); } });
  const pending = service.configuration(mutable); mutable.dealerId = 'nora'; resume(clone(f.saved));
  assert.equal((await pending).dealer.id, 'julia');
  const response = await service.response(new Request(mediaUrl(input)));
  assert.equal(response.status, 503); assert.equal((await response.text()).includes('PRIVATE'), false);
  await assert.rejects(service.configuration({ ...input, pathname: f.idle.pathname }), status(400));
});

function apiFixture(f){let liveReads=0;const project=()=>{liveReads++;throw Error('Latest registry must not be read after publish');};
  const source={type:'deal',shoeDraw:5,to:'player',box:3,faceDown:false,card:{r:'K',s:'♦'}};
  const handler=createPresentationApi({env:{},frozenDealerContext:f.service,store:{load:project},registryLoader:project,
    select:project,directorFetchFactory:project,db:{prepare:()=>({get:async()=>({version:2,payload:JSON.stringify([source])})})}});
  async function invoke(url,{playerId='fixture',method='GET',body=null,headers={}}={}){
    let content='';const res=new Writable({write(chunk,encoding,callback){content+=chunk.toString();callback();}});
    res.writeHead=(status,headers)=>{res.status=status;res.headers=headers;};const done=new Promise((resolve,reject)=>{res.on('finish',resolve);res.on('error',reject);});
    const req={method,url,headers,async *[Symbol.asyncIterator](){if(body)yield JSON.stringify(body);}};
    await handler(req,res,new URL(url,'https://game.invalid').pathname,playerId);await done;
    return {status:res.status,headers:res.headers,body:content};
  }
  return {invoke,source,get liveReads(){return liveReads;}};
}

test('authenticated API config and actual streamed frozen media use exact context and never load latest Studio media',async()=>{
  const f=fixture(),api=apiFixture(f),query=new URLSearchParams({...input,packageRevision:String(input.packageRevision)});
  assert.equal((await api.invoke('/api/presentation/config?'+query,{playerId:null})).status,401);assert.equal(f.reads.length,0);
  const config=await api.invoke('/api/presentation/config?'+query);assert.equal(config.status,200);assert.equal(JSON.parse(config.body).dealer.label,'Julia');
  const path=new URL(mediaUrl(input)).pathname;
  const streamed=await api.invoke(path,{headers:{range:'bytes=0-15'}});assert.equal(streamed.status,206);assert.equal(streamed.body,'frozen-fixture');
  assert.equal((await api.invoke(path,{method:'HEAD'})).body,'');
  for(const suffix of ['&dealerId=nora','&unexpected=x','&roomId=room-other'])assert.equal((await api.invoke('/api/presentation/config?'+query+suffix)).status,400);
  f.saved.package.revision=8;assert.equal((await api.invoke(path)).status,409);assert.equal((await api.invoke('/api/presentation/config?'+query)).status,409);
  assert.equal(api.liveReads,0);assert.equal(f.served.length,2);
});

test('published Julia skips nonfrozen speech/deal despite newly edited live media and projects only committed server cards',async()=>{
  const f=fixture(),api=apiFixture(f);
  for(const event of [{...api.source,card:{r:'A',s:'♣'}},{type:'speak',line:'goodluck'}]){
    const response=await api.invoke('/api/presentation/select',{method:'POST',body:{dealerId:'julia',mode:'active',version:2,event,presentationContext:input}});
    assert.equal(response.status,200);const selected=JSON.parse(response.body);assert.equal(selected.video,null);assert.equal(selected.standard,null);
    assert.equal(selected.projectRevision,'published-project');assert.equal(selected.configurationSource,'operator-package-v2');
    assert.equal(selected.decision.media.reason,event.type==='deal'?'position_clip_missing':'frozen_clip_missing');
    if(event.type==='deal')assert.deepEqual(selected.decision.sourceEvent,api.source);
  }
  assert.equal(api.liveReads,0);assert.equal(f.served.length,0);
  const forged=await api.invoke('/api/presentation/select',{method:'POST',body:{dealerId:'julia',mode:'off',version:2,event:{...api.source,shoeDraw:99},presentationContext:input}});assert.equal(forged.status,409);
  f.saved.package.revision=8;const stale=await api.invoke('/api/presentation/select',{method:'POST',body:{dealerId:'julia',mode:'off',version:2,event:api.source,presentationContext:input}});assert.equal(stale.status,409);assert.equal(JSON.parse(stale.body).code,'studio_presentation_idle_package_changed');assert.equal(api.liveReads,0);
});

function readerFixture({badAdmin=false,modernAdmin=false,commitRollback=false,withHistory=false,changedFrozen=false}={}){
  const scope={environment:'test',workspaceId:'croupier'},f=fixture(),trace=[];
  const admin={...f.saved.administration,gameLane:'portrait-julia',tiers:{classic:'vera',high:'astrid',vip:'amira'},pitboss:{payout10x:true,streak5:true,randomWalkMin:45},tournaments:[]};
  if(modernAdmin)for(const key of ['tiers','pitboss','tournaments'])delete admin[key];
  const live={operator:operatorRow(scope,'north-id','north'),package:packageRow(scope,'north-id',7,['vip-presentation']),admin};
  if(withHistory)live.package.branding=canonicalStudioJson({_scoutPresentation:{sha256:'same',data:'frozen'},color:'#445566'});
  const previous=withHistory?{...clone(live.package),package_revision:6,branding:canonicalStudioJson({_scoutPresentation:{sha256:changedFrozen?'other':'same',data:'frozen'},color:'#112233'})}:null;
  let active=false,snapshot=null,releases=0;
  const pool={async connect(){return {async query(text,values){trace.push({text,values});
    if(text.startsWith('BEGIN')){assert.equal(active,false);active=true;snapshot=clone(live);return {rows:[],command:'BEGIN'};}
    if(text.startsWith('SET LOCAL'))return {rows:[]};
    if(text==='COMMIT'||text==='ROLLBACK'){active=false;return {rows:[],command:commitRollback&&text==='COMMIT'?'ROLLBACK':text};}
    assert.equal(active,true);assert.deepEqual(values.slice(0,2),['test','croupier']);
    if(text.includes('operator-by-slug')){live.package.package_revision=8;live.admin.rooms[0].state='preview';return {rows:[snapshot.operator]};}
    if(text.includes('current-package'))return {rows:[snapshot.package]};
    if(text.includes('package-by-revision')){assert.deepEqual(values,['test','croupier','north-id',6]);return {rows:previous?[previous]:[]};}
    if(text.includes('frozen-dealer:administration'))return {rows:[{value:badAdmin?{...snapshot.admin,tiers:{classic:'vera',high:'astrid',vip:'foreign'}}:snapshot.admin}]};throw Error('Unexpected SQL');
  },release(){releases++;}};}};
  return {scope,pool,trace,live,get active(){return active;},get releases(){return releases;}};
}

test('uncached SQL context reader uses one scoped read-only snapshot and releases before frozen provider access',async()=>{
  const f=readerFixture(),reader=createFrozenDealerContextReader(f),saved=await reader('north');
  assert.equal(saved.package.revision,7);assert.equal(saved.administration.rooms[0].state,'live');assert.equal(f.live.package.package_revision,8);
  assert.equal(f.trace[0].text,'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');assert.equal(f.trace.at(-1).text,'COMMIT');assert.equal(f.active,false);assert.equal(f.releases,1);
  assert.equal((await reader('north')).package.revision,8);assert.equal(f.releases,2);
  const before=f.trace.length;assert.deepEqual(await reader('invalid/slash'),{operator:null,package:null});assert.equal(f.trace.length,before);
});

test('reader rolls back invalid administration and never treats a COMMIT rollback as an authorized snapshot',async()=>{
  for(const options of [{badAdmin:true},{commitRollback:true}]){const f=readerFixture(options),reader=createFrozenDealerContextReader(f);await assert.rejects(reader('north'));assert.equal(f.active,false);assert.equal(f.releases,1);assert.equal(f.trace.at(-1).text,options.badAdmin?'ROLLBACK':'COMMIT');}
});

test('frozen context reader accepts modern administration without restoring historical settings',async()=>{
  const f=readerFixture({modernAdmin:true}),reader=createFrozenDealerContextReader(f),saved=await reader('north');
  assert.equal(saved.package.revision,7);assert.equal(saved.administration.rooms[0].state,'live');
  for(const key of ['tiers','pitboss','tournaments'])assert.equal(Object.hasOwn(saved.administration,key),false);
  assert.equal(f.trace.at(-1).text,'COMMIT');assert.equal(f.active,false);assert.equal(f.releases,1);
});

test('administrative portrait drift cannot serve an allowed neighbour instead of the frozen default dealer',async()=>{
  const f=fixture();f.presentation.lanes[0].dealers.push('nora');f.presentation.lanes[0].layers.dealer.allowed.push('nora');f.presentation.lanes[0].layers.dealer.default='nora';
  f.presentation.registeredDealers.push({id:'nora',label:'Nora',idle:null});
  await assert.rejects(f.service.configuration(input),status(404));assert.equal((await f.service.response(new Request(mediaUrl(input)))).status,404);assert.equal(f.served.length,0);
});


test('branding history preserves a round only while exact frozen media and current ownership remain published',async()=>{
  const {sameFrozenPackage}=await import('../packages/presentation/server/frozen-dealer-presentation.mjs');
  const previous={operatorId:'north',revision:7,lanes:['lane'],games:['blackjack'],tables:['room'],branding:{color:'#112233',_scoutPresentation:{sha256:'same',data:'immutable'}}};
  const current={...structuredClone(previous),revision:8,branding:{color:'#445566',_scoutPresentation:{sha256:'same',data:'immutable'}}};
  assert.equal(sameFrozenPackage(current,previous),true);
  for(const patch of [{operatorId:'south'},{revision:7},{branding:{color:'#ffffff'}},{branding:{_scoutPresentation:{sha256:'other',data:'new'}}},{tables:[]},{lanes:['other']},{games:[]}])assert.equal(sameFrozenPackage({...current,...patch},previous),false);
  assert.equal(sameFrozenPackage(current,null),false);
  assert.equal(sameFrozenPackage(previous,current),false);
});


test('SQL reader pins same-presentation branding history inside its fresh scope snapshot',async()=>{
  const f=readerFixture({withHistory:true}),reader=createFrozenDealerContextReader(f),saved=await reader('north',6);
  assert.equal(saved.package.revision,6);assert.equal(saved.package.branding.color,'#112233');
  assert.equal(saved.administration.rooms[0].state,'live');assert.equal(f.active,false);assert.equal(f.releases,1);
  assert.ok(f.trace.some(row=>row.text.includes('package-by-revision')));
});
test('SQL reader never substitutes old N1 presentation or unavailable revision',async()=>{
  for(const options of [{withHistory:true,changedFrozen:true},{withHistory:false}]){
    const f=readerFixture(options),reader=createFrozenDealerContextReader(f),saved=await reader('north',6);
    assert.equal(saved.package.revision,7);assert.equal(f.active,false);assert.equal(f.releases,1);
  }
});
