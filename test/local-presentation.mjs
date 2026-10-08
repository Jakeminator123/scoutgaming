import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once, EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { createPresentationApi, presentationInput } from '../web/presentation-api.mjs';
import { createNativeP6OwnedPlaybackContextReader } from '../web/native-p6-qa-hook.mjs';
import { createSeedProject } from '../lab/lib/studio-model.mjs';
import { playLocalFilm } from '../web/public/local-film-player.mjs';
import { createLocalPresentation } from '../web/public/local-presentation.mjs';
import { loadVideoRegistry } from '../lab/lib/video-registry.mjs';
import { videoIdFromSha256 } from '../lab/lib/lab-video-manifest.mjs';
import { selectPresentation } from '../presentation-runtime/selection.mjs';
import { createProjectStore } from '../lab/lib/project-store.mjs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const source = { type: 'deal', to: 'box', box: 3, handIndex: 1, shoeDraw: 7, faceDown: false, card: { r: 'A', s: '♠' }, clip: { action: 'deal-centre' } };
test('native playback context is default off, cookie-owned read-only and refuses substituted policy/owner/round',async()=>{
  const hash=v=>createHash('sha256').update(v).digest('hex'),playerId='isolated-playback-fixture',owner='player-fixture-owner';
  const project=createSeedProject(),reader=createNativeP6OwnedPlaybackContextReader({ownLinkedPlayerSha256:hash(playerId),now:()=>1000});
  for(const race of [null,'owner','policy','round']){
    let reads=0;
    const args={playerId,owner,project,readOwner:async()=>race==='owner'?'revoked-owner':owner,
      readProject:async()=>race==='policy'?{...project,revision:'changed-policy'}:structuredClone(project),
      readStatus:async()=>({dealerId:'astrid',sessionRevision:hash(owner),roundRevision:race==='round'&&reads++?'2':'1'})};
    if(race)await assert.rejects(reader(args),{code:'native_p6_qa_playback_state_changed'});
    else{const result=await reader(args);assert.equal(result.actorSha256,hash(playerId));assert.equal(result.ownerSessionSha256,hash(owner));
      assert.equal(result.sessionRevision,hash(owner));assert.equal(result.roundRevision,'1');assert.equal(result.observedAtMs,1000);
      assert.equal(Object.keys(result).length,6);assert.match(result.policySha256,/^[a-f0-9]{64}$/);}
  }
  await assert.rejects(reader({playerId:'foreign-fixture',owner,project,readOwner:async()=>owner,
    readProject:async()=>project,readStatus:async()=>({dealerId:'astrid',sessionRevision:hash(owner),roundRevision:'1'})}),
    {code:'native_p6_qa_playback_actual_callbacks_required'});
  let loads=0,callbacks=0;
  const make=enabled=>createPresentationApi({env:{},store:{load:async()=>{loads++;return structuredClone(project);}},
    ...(enabled?{nativeP6PlaybackContext:async({req,playerId:id,project:current,readProject})=>{
      callbacks++;if(req.headers.cookie!=='player_session=fixture')throw Object.assign(Error('cookie_required'),{statusCode:401});
      return reader({playerId:id,owner,project:current,readProject,readOwner:async()=>owner,
        readStatus:async()=>({dealerId:'astrid',sessionRevision:hash(owner),roundRevision:'1'})});}}:{})});
  async function get(handler,{method='GET',query='',cookie='player_session=fixture',id=playerId}={}){
    const req=Readable.from([]);req.method=method;req.url='/api/presentation/native-p6-playback-context'+query;req.headers={cookie};
    let status,body,headers;const res={writeHead:(s,h)=>{status=s;headers=h;},end:raw=>{body=JSON.parse(raw);}};
    await handler(req,res,'/api/presentation/native-p6-playback-context',id);return{status,body,headers};
  }
  assert.equal((await get(make(false))).status,404);assert.equal(loads,0);assert.equal(callbacks,0);
  const handler=make(true),ok=await get(handler);assert.equal(ok.status,200);assert.equal(ok.body.actorSha256,hash(playerId));
  assert.equal(ok.headers['Cache-Control'],'private, no-store');
  for(const [input,status]of [[{method:'POST'},405],[{query:'?actorSha256=foreign'},400],[{id:null},401],[{cookie:''},401],[{id:'foreign-fixture'},503]])
    assert.equal((await get(handler,input)).status,status);
});
test('isolated HTTP playback context reads only cookie-owned current state and never accepts body owner fields',async(t)=>{
  const playerId='http-playback-fixture',owner='player-http-owner',hash=v=>createHash('sha256').update(v).digest('hex');
  const saved=createSeedProject(),reader=createNativeP6OwnedPlaybackContextReader({ownLinkedPlayerSha256:hash(playerId)});
  let policy=saved,revoked=false;
  const handler=createPresentationApi({env:{},store:{load:async()=>structuredClone(policy)},
    nativeP6PlaybackContext:async({req,playerId:authenticated,project,readProject})=>{
      if(revoked||req.headers.cookie!=='player_session=isolated-http-cookie')throw Object.assign(Error('cookie_required'),{statusCode:401});
      return reader({playerId:authenticated,owner,project,readProject,readOwner:async()=>owner,
        readStatus:async()=>({dealerId:'astrid',sessionRevision:hash(owner),roundRevision:'7'})});
    }});
  const server=createServer(async(req,res)=>{await handler(req,res,new URL(req.url,'http://local').pathname,
    req.headers.cookie==='player_session=isolated-http-cookie'?playerId:null);});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>{server.closeAllConnections();server.close();});
  const path=`http://127.0.0.1:${server.address().port}/api/presentation/native-p6-playback-context`;
  const first=await fetch(path,{headers:{cookie:'player_session=isolated-http-cookie'}}),context=await first.json();
  assert.equal(first.status,200);assert.equal(context.actorSha256,hash(playerId));assert.equal(context.sessionRevision,hash(owner));
  assert.equal(context.roundRevision,'7');assert.equal(context.actorSha256.includes(playerId),false);
  policy={...saved,revision:'fixture-policy-changed'};
  const current=await (await fetch(path,{headers:{cookie:'player_session=isolated-http-cookie'}})).json();
  assert.notEqual(current.policySha256,context.policySha256);
  assert.equal((await fetch(path)).status,401);
  assert.equal((await fetch(path+'?ownerSessionSha256=foreign',{headers:{cookie:'player_session=isolated-http-cookie'}})).status,400);
  assert.equal((await fetch(path,{method:'POST',headers:{cookie:'player_session=isolated-http-cookie'},body:'{"actorSha256":"foreign"}'})).status,405);
  revoked=true;assert.equal((await fetch(path,{headers:{cookie:'player_session=isolated-http-cookie'}})).status,401);
});
async function presentationFixtureRequest(handler, playerId, payload, path = '/api/presentation/select') {
  const req = Readable.from([JSON.stringify(payload)]);req.method = 'POST';req.headers = {};
  const res = new EventEmitter();res.writableEnded = false;
  res.writeHead = status => { res.status = status; };
  res.end = raw => { res.body = JSON.parse(raw);res.writableEnded = true; };
  await handler(req,res,path,playerId);return res;
}
const directorProject = () => {
  const project = createSeedProject();
  for (const line of project.lines) for (const variant of line.variants) variant.videoGenerationId = null;
  return project;
};
test('owned Director factory is per authenticated request and receives saved policy and committed card projection', async () => {
  let saved = directorProject(),calls = 0;const transports = [],contexts = [];
  const db = { prepare: () => ({ get: async () => ({ version:2,payload:JSON.stringify([source]) }) }) };
  const handler = createPresentationApi({ db,env:{CROUPIER_PRESENTATION_DIRECTOR_URL:'https://own-qa.invalid',CROUPIER_PRESENTATION_DIRECTOR_TOKEN:'fixture-token'},
    store:{load:async()=>structuredClone(saved)},registryLoader:async()=>({families:[],videos:[]}),
    directorFetchFactory:async context=>{
      contexts.push(context);const owner = context.playerId;
      return async (url,options)=>{calls++;await Promise.resolve();
        assert.equal(url.pathname,'/api/studio/advice');
        const projected = JSON.parse(options.body);transports.push({owner,projected});
        assert.deepEqual(projected.input.event.card,source.card);
        assert.equal(projected.catalog.revision.includes('forged-browser'),false);
        assert.deepEqual(await context.readProject(),context.project);
        return Response.json({advice:null,provider:{status:'responded'}});
      };
    } });
  const payload={dealerId:'astrid',version:2,mode:'active',event:{...source,card:{r:'K',s:'♥'}},
    project:{revision:'forged-browser'},context:{injected:'browser context'}};
  const first = await Promise.all(['one','two'].map(player=>presentationFixtureRequest(handler,player,payload)));
  assert.deepEqual(first.map(r=>r.status),[200,200]);assert.equal(calls,2);
  assert.deepEqual(transports.map(t=>t.owner).sort(),['one','two']);
  assert.notEqual(contexts[0].req,contexts[1].req);assert.notEqual(contexts[0].signal,contexts[1].signal);
  const repeat=await presentationFixtureRequest(handler,'one',payload);
  assert.equal(repeat.status,200);assert.equal(calls,3,'Owned HTTP closure cannot be reused from presentation cache.');
});
test('revoked owners and changed saved policy can deny request-local Director before dispatch', async () => {
  for(const race of ['owner','policy']){
    let saved=directorProject(),owner='initial',dispatches=0;
    const handler=createPresentationApi({db:{prepare:()=>({get:async()=>({version:2,payload:JSON.stringify([source])})})},
      env:{CROUPIER_PRESENTATION_DIRECTOR_URL:'https://own-qa.invalid',CROUPIER_PRESENTATION_DIRECTOR_TOKEN:'fixture-token'},
      store:{load:async()=>structuredClone(saved)},registryLoader:async()=>({families:[],videos:[]}),
      directorFetchFactory:async ({project,readProject,signal})=>{
        const boundOwner=owner;
        queueMicrotask(()=>{if(race==='owner')owner='revoked';else saved={...saved,revision:'new-policy-revision'};});
        return async()=>{
          assert.equal(signal.aborted,false);
          if(owner!==boundOwner||JSON.stringify(await readProject())!==JSON.stringify(project))throw Error('fixture admission denied');
          dispatches++;return Response.json({advice:null,provider:{status:'responded'}});
        };
      }});
    const response=await presentationFixtureRequest(handler,'one',{dealerId:'astrid',version:2,mode:'active',event:source});
    assert.equal(response.status,200);assert.equal(response.body.provider,'remote_unavailable_baseline');assert.equal(dispatches,0);
  }
});
test('idle API forwards owner/policy scope and revalidates revoked owners before cached reply', async()=>{
  const project=createSeedProject(),inventory=await loadVideoRegistry(),at=new Date().toISOString();
  let revoked=false,calls=0;
  const handler=createPresentationApi({env:{CROUPIER_PRESENTATION_DIRECTOR_URL:'https://own-qa.invalid',CROUPIER_PRESENTATION_DIRECTOR_TOKEN:'fixture-token'},
    store:{load:async()=>structuredClone(project)},registryLoader:async()=>inventory,
    directorFetchFactory:async ({playerId})=>{
      if(revoked)throw Object.assign(Error('fixture revoked owner'),{statusCode:401});
      const owned=async (_url,options)=>{
        calls++;const projected=JSON.parse(options.body);
        return Response.json({advice:{requestId:projected.input.requestId,catalogRevision:projected.catalog.revision,variantId:null},
          provider:{status:'responded',contextContractVersion:2,observedChatMessages:projected.input.context.observedChat.messages.length}});
      };
      owned.cacheScope=createHash('sha256').update(JSON.stringify([playerId,project])).digest('hex');return owned;
    }});
  const payload={requestId:'identical-browser-id',dealerId:'astrid',mode:'active',
    sourceRef:{kind:'renderer-idle',channel:'identical-channel',revision:1,messageId:'identical-message',at},
    observedChat:{source:'native-observation',before:at,messages:[{role:'user',text:'Hello',at}]}};
  const path='/api/presentation/idle-advice';
  const replies=await Promise.all(['one','two'].map(player=>presentationFixtureRequest(handler,player,payload,path)));
  assert.deepEqual(replies.map(r=>r.body.provider),['responded','responded']);assert.equal(calls,2);
  assert.equal((await presentationFixtureRequest(handler,'one',payload,path)).status,200);assert.equal(calls,2);
  revoked=true;assert.equal((await presentationFixtureRequest(handler,'one',payload,path)).status,401);assert.equal(calls,2);
});
test('a browser can identify a deal but cannot change its card, hand or hidden state', () => {
  assert.deepEqual(presentationInput({ ...source, card: { r: 'K', s: '♥' }, handIndex: 0 }, [source]), source);
  const hole = { ...source, to: 'dealer', box: null, faceDown: true, card: { r: 'Q', s: '♠' } };
  assert.equal(presentationInput(hole, [hole]).card, null);
  assert.throws(() => presentationInput({ ...source, box: 2 }, [source]), /committed/);
  assert.throws(() => presentationInput({ ...source, shoeDraw: 8 }, [source]), /committed/);
  const reveal = { type: 'reveal', to: 'dealer', shoeDraw: 9, card: { r: 'Q', s: '♠' } };
  assert.throws(() => presentationInput(reveal, [hole]), /committed/);
  assert.deepEqual(presentationInput({ ...reveal, card: { r: 'A', s: '♥' } }, [reveal]), reveal);
});

test('native endpoint selects the same exact family, deduplicates requests and rejects another player or revision', async t => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE native_presentations (player_id TEXT, version INTEGER, payload TEXT)');
  db.prepare('INSERT INTO native_presentations VALUES (?,?,?)').run('qa', 2, JSON.stringify([source]));
  const handler = createPresentationApi({ db, env: {}, store: { load: async () => createSeedProject() } });
  const server = createServer(async (req, res) => { if (!await handler(req, res, new URL(req.url, 'http://local').pathname, req.headers['x-fixture-player'] ?? 'qa')) { res.writeHead(404); res.end(); } });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); db.close(); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const choose = (patch = {}, headers = {}) => fetch(`${origin}/api/presentation/select`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ dealerId: 'astrid', version: 2, mode: 'off', event: { ...source, card: { r: 'K', s: '♥' } }, ...patch }) });
  const response = await choose(); assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.owner, 'web'); assert.equal(result.video.fileName, 'deal_pos4.mp4');
  assert.equal(result.projectRevision, createSeedProject().revision);
  assert.equal(result.configurationSource, 'lab/project.json');
  assert.equal(result.decision.sourceEvent.card.r, 'A'); assert.equal(result.decision.sourceEvent.handIndex, 1);
  assert.deepEqual(await (await choose()).json(), result);
  assert.equal((await choose({ version: 1 })).status, 409);
  assert.equal((await choose({}, { 'x-fixture-player': 'somebody-else' })).status, 409);
  const reveal = { type: 'reveal', to: 'dealer', shoeDraw: 9, card: { r: 'Q', s: '♠' } };
  assert.equal((await choose({ event: reveal })).status, 409);
  db.prepare('UPDATE native_presentations SET payload=? WHERE player_id=?').run(JSON.stringify([source, reveal]), 'qa');
  assert.equal((await choose({ event: reveal, version: 1 })).status, 409);
  assert.equal((await choose({ event: reveal }, { 'x-fixture-player': 'somebody-else' })).status, 409);
  const flip = await (await choose({ event: { ...reveal, card: { r: 'A', s: '♥' } } })).json();
  assert.equal(flip.video.fileName, 'deal_flip.mp4'); assert.deepEqual(flip.decision.sourceEvent.card, reveal.card);
  const media = await fetch(origin + result.video.src, { headers: { range: 'bytes=0-15' } });
  assert.equal(media.status, 206); assert.equal((await media.arrayBuffer()).byteLength, 16);
  assert.equal(media.headers.get('cache-control'), 'private, no-store');
  const missing = await choose({ event: { type: 'speak', line: 'unknownline' } });
  assert.equal(missing.status, 200); assert.equal((await missing.json()).video, null);
  const at = new Date().toISOString();
  const idle = await fetch(`${origin}/api/presentation/idle-advice`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
    requestId: 'native-idle-fixture', dealerId: 'astrid', mode: 'active', project: { untrusted: 'must use saved project instead' },
    sourceRef: { kind: 'renderer-idle', channel: 'native-qa-channel', revision: 2, messageId: 'native-qa-message', at },
    observedChat: { source: 'native-observation', before: at, messages: [{ role: 'user', text: 'Hello Astrid', at }] },
  }) });
  assert.equal(idle.status, 200); const advice = await idle.json();
  assert.equal(advice.videoId, null); assert.equal(advice.provider, 'openclaw_not_configured');
  assert.equal(advice.projectRevision, createSeedProject().revision);
  assert.equal(advice.configurationSource, 'lab/project.json');
});

test('product selection and Lab inventory use the same configured Astrid archive', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'croupier-shared-archive-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const archiveDir = join(directory, 'archive'), media = Buffer.from('configured-archive-video-fixture');
  const manifest = JSON.parse(await readFile(new URL('../media/dealers/astrid/runtime/presentation/lab-video-manifest.json', import.meta.url)));
  const relativePath = 'deal/deal_pos4/deal_pos4.mp4';
  const entry = manifest.items.find(item => item.relativePath === relativePath);
  assert.ok(entry);
  const oldId = entry.id;
  entry.sha256 = createHash('sha256').update(media).digest('hex');
  entry.id = videoIdFromSha256(entry.sha256);
  entry.size = media.length;
  const family = manifest.families.find(item => item.id === entry.familyId);
  family.standardIds = family.standardIds.map(item => item === oldId ? entry.id : item);
  const target = join(archiveDir, ...relativePath.split('/'));
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, media);
  await writeFile(join(archiveDir, 'lab-video-manifest.json'), JSON.stringify(manifest));
  const env = { LAB_VIDEO_ARCHIVE: archiveDir };
  const inventory = await loadVideoRegistry({ env, repositoryRoot: directory, uploadDir: join(directory, 'studio', 'videos') });
  assert.equal(inventory.videos.find(video => video.id === entry.id)?.available, true);

  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE native_presentations (player_id TEXT, version INTEGER, payload TEXT)');
  db.prepare('INSERT INTO native_presentations VALUES (?,?,?)').run('archive-qa', 2, JSON.stringify([source]));
  const handler = createPresentationApi({ db, env, store: { load: async () => createSeedProject() } });
  const server = createServer(async (req, res) => { await handler(req, res, new URL(req.url, 'http://local').pathname, 'archive-qa'); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); db.close(); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(`${origin}/api/presentation/select`, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ dealerId: 'astrid', version: 2, mode: 'off', event: source }) });
  assert.equal(response.status, 200);
  const choice = await response.json();
  assert.equal(choice.video.id, entry.id);
  const clip = await fetch(origin + choice.video.src, { headers: { range: 'bytes=0-8' } });
  assert.equal(clip.status, 206);
  assert.deepEqual(Buffer.from(await clip.arrayBuffer()), media.subarray(0, 9));
});

test('native player reads saved deal frequencies, caches retries and picks up an edited percentage without a restart', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'croupier-deal-frequency-'));
  const store = createProjectStore(directory), project = createSeedProject();
  const registry = await loadVideoRegistry();
  const family = registry.families.find(row => row.situation === 'box0');
  const variant = registry.videos.find(row => family.variantIds.includes(row.id) && row.available);
  assert.ok(variant, 'The current Astrid manifest has a real first-box variant.');
  project.mediaPolicy = [{ familyId: family.id, variants: [{ videoId: variant.id, priority: 10, triggerIds: [], selection: { model: false, random: false, rules: false }, frequencyPercent: 100 }] }];
  let saved = await store.save(project, project.revision), calls = 0;
  const db = new DatabaseSync(':memory:');
  const committed = { ...source, box: 0, clip: { action: 'deal-left' } };
  db.exec('CREATE TABLE native_presentations (player_id TEXT, version INTEGER, payload TEXT)');
  db.prepare('INSERT INTO native_presentations VALUES (?,?,?)').run('frequency-qa', 2, JSON.stringify([committed]));
  const handler = createPresentationApi({ db, env: {}, store, select: (body, options) => {
    calls++;
    return selectPresentation(body, { ...options, random: () => 0.1, fetchImpl: () => assert.fail('Deal frequency must not call a model') });
  } });
  const server = createServer(async (req, res) => { await handler(req, res, '/api/presentation/select', 'frequency-qa'); });
  t.after(async () => { server.closeAllConnections(); server.close(); db.close(); await rm(directory, { recursive: true, force: true }); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const choose = async () => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/presentation/select`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dealerId: 'astrid', version: 2, mode: 'active', event: { ...committed, card: { r: '2', s: '♥' } } }),
    });
    assert.equal(response.status, 200); return response.json();
  };
  const first = await choose();
  assert.equal(first.video.id, variant.id); assert.equal(first.decision.reason, 'local_deal_frequency');
  assert.deepEqual(first.decision.sourceEvent.card, source.card, 'Published server cards remain authoritative.');
  assert.deepEqual(await choose(), first); assert.equal(calls, 1);
  saved.mediaPolicy[0].variants[0].frequencyPercent = 0;
  saved = await store.save(saved, saved.revision);
  const afterSave = await choose();
  assert.equal(afterSave.video.id, family.standardIds[0]); assert.equal(afterSave.projectRevision, saved.revision); assert.equal(calls, 2);
});

class Video extends EventTarget {
  constructor() { super(); this.style = {}; this.ended = false; this.videoWidth = 1080; this.videoHeight = 1920; this.frames = new Map(); this.serial = 0; }
  requestVideoFrameCallback(fn) { this.frames.set(++this.serial, fn); return this.serial; }
  cancelVideoFrameCallback(id) { this.frames.delete(id); }
  play() { return Promise.resolve(); }
  pause() { this.paused = true; }
  load() {}
  removeAttribute() {}
  remove() { this.removed = true; }
  emit(type) { this.dispatchEvent(new Event(type)); }
  frame(time = 1) { const callbacks = [...this.frames.values()]; this.frames.clear(); for (const callback of callbacks) callback(0, { mediaTime: time }); }
}
function filmFixture(t) {
  const original = globalThis.document;
  const media = [];
  globalThis.document = { createElement: () => { const video = new Video(); media.push(video); return video; } };
  t.after(() => { globalThis.document = original; });
  return { media, host: { append() {} } };
}
test('a selected or playing film is not completed until a real presented frame and ended event', async t => {
  const { media, host } = filmFixture(t); const receipts = []; let complete = false;
  const finished = playLocalFilm({ host, src: '/fixture.mp4', onReceipt: r => receipts.push(r), hold() {} }).then(() => { complete = true; });
  const video = media[0]; video.emit('playing'); await Promise.resolve(); assert.equal(complete, false);
  video.frame(); await Promise.resolve(); assert.equal(complete, false);
  video.ended = true; video.emit('ended'); await finished;
  assert.deepEqual(receipts.map(r => r.state), ['start', 'presented', 'end']); assert.equal(video.removed, true);
});
test('interruption cleans the old film and delayed callbacks cannot complete a new owner', async t => {
  const { media, host } = filmFixture(t); const controller = new AbortController(), receipts = [];
  const first = playLocalFilm({ host, src: '/one', signal: controller.signal, onReceipt: r => receipts.push(r) });
  const oldFrame = [...media[0].frames.values()][0]; media[0].emit('playing'); controller.abort();
  await assert.rejects(first, { name: 'AbortError' });
  const secondReceipts = [], second = playLocalFilm({ host, src: '/two', onReceipt: r => secondReceipts.push(r) });
  oldFrame(); media[0].ended = true; media[0].emit('ended');
  assert.deepEqual(receipts.map(r => r.state), ['start', 'interrupted']); assert.deepEqual(secondReceipts, []);
  media[1].emit('playing'); media[1].frame(); media[1].ended = true; media[1].emit('ended'); await second;
});
test('an ended event with no presented picture remains a failure', async t => {
  const { media, host } = filmFixture(t);
  const result = playLocalFilm({ host, src: '/broken' }); media[0].emit('playing'); media[0].ended = true; media[0].emit('ended');
  await assert.rejects(result, /without a presented frame/);
});

test('card motion receives each presented media frame and stops at cancellation', async t => {
  const { media, host } = filmFixture(t), controller = new AbortController(), times = [], receipts = [];
  const result = playLocalFilm({ host, src: '/frames', signal: controller.signal, onFrame: time => times.push(time), onReceipt: r => receipts.push(r.state) });
  const video = media[0]; video.emit('playing'); video.frame(0); video.frame(31/24); video.frame(32/24);
  const stale = [...video.frames.values()][0]; controller.abort();
  await assert.rejects(result, { name: 'AbortError' }); stale(0, { mediaTime: 5 });
  assert.deepEqual(times, [0, 31/24, 32/24]);
  assert.deepEqual(receipts, ['start', 'presented', 'interrupted']); assert.equal(video.frames.size, 0);
});

async function controllerFixture(t) {
  const originalDocument = globalThis.document, originalFetch = globalThis.fetch;
  const inventory = await loadVideoRegistry(), jobs = [], receipts = [], elements = [];
  const element = () => { const value = { style: {}, dataset: {}, setAttribute() {}, append() {}, remove() {}, getContext: () => ({ drawImage() {} }) }; elements.push(value); return value; };
  globalThis.document = { hidden: false, createElement: element, addEventListener() {}, removeEventListener() {} };
  const selected = inventory.videos.find(video => video.fileName === 'deal_pos4.mp4');
  globalThis.fetch = async url => new Response(JSON.stringify(url.endsWith('/config') ? { inventory, idlePolicy: createSeedProject().idlePolicy, projectRevision: 'studio-config-fixture', configurationSource: 'lab/project.json' }
    : { video: selected, standard: selected, projectRevision: 'studio-selection-fixture', configurationSource: 'lab/project.json', decision: { requestId: 'selection-fixture', sourceEvent: source, media: { familyId: selected.familyId } } }), { headers: { 'content-type': 'application/json' } });
  let proofs = 0;
  const player = { playLocalClip(take, options) { return new Promise((resolve, reject) => {
    const job = { take, options, resolve, reject }; jobs.push(job);
    options.signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')), { once: true });
  }); } };
  const controller = await createLocalPresentation({ player, host: element(), dealerId: 'astrid', version: () => 2,
    receipt: value => receipts.push(value), onIdle: () => proofs++, onBusy() {}, muted: () => false });
  t.after(() => { controller.close(); globalThis.document = originalDocument; globalThis.fetch = originalFetch; });
  return { controller, jobs, receipts, status: elements.find(value => value.className === 'local-presentation-status'), get proofs() { return proofs; } };
}

test('native configuration and actual film receipts preserve their saved project revision and selection id', async t => {
  const { controller, jobs, receipts } = await controllerFixture(t);
  assert.equal(receipts[0].event, 'configuration'); assert.equal(receipts[0].mode, 'off');
  assert.equal(receipts[0].projectRevision, 'studio-config-fixture');
  const result = controller.present(source); await new Promise(resolve => setImmediate(resolve));
  jobs[0].options.onReceipt({ state: 'start' }); jobs[0].options.onReceipt({ state: 'presented' }); jobs[0].options.onReceipt({ state: 'end' });
  jobs[0].resolve({ completed: true }); assert.equal(await result, true);
  const deal = receipts.filter(row => row.event === 'deal');
  assert.deepEqual(deal.map(row => row.state), ['selected', 'start', 'presented', 'end']);
  for (const row of deal) {
    assert.equal(row.projectRevision, 'studio-selection-fixture'); assert.equal(row.configurationSource, 'lab/project.json');
    assert.equal(row.requestId, 'selection-fixture');
  }
});

test('a film error keeps the selection correlation when reporting a 2D fallback, never an end receipt', async t => {
  const { controller, jobs, receipts } = await controllerFixture(t);
  const result = controller.present(source); await new Promise(resolve => setImmediate(resolve));
  jobs[0].reject(new Error('fixture film unavailable')); assert.equal(await result, false);
  const fallback = receipts.find(row => row.state === 'fallback');
  assert.equal(fallback.renderer, '2d'); assert.equal(fallback.requestId, 'selection-fixture');
  assert.equal(fallback.projectRevision, 'studio-selection-fixture'); assert.ok(fallback.familyId);
  assert.equal(receipts.some(row => row.event === 'deal' && row.state === 'end'), false);
});

test('selection exposes server event and frames cannot outlive the action owner', async t => {
  const { controller, jobs } = await controllerFixture(t), selected = [], frames = [];
  const result = controller.present({ ...source, card: { r: 'K', s: '♦' } }, {
    onSelected: (video, event) => selected.push({ video, event }), onFrame: time => frames.push(time),
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(selected[0].event, source);
  jobs[0].options.onFrame(1); controller.state({ action: true }); jobs[0].options.onFrame(2);
  assert.equal(await result, false); assert.deepEqual(frames, [1]);
});
test('deal interrupts idle; neither selection nor a stale idle frame opens the speech gate', async t => {
  const fixture = await controllerFixture(t); const { controller, jobs } = fixture;
  controller.start(); assert.equal(jobs.length, 1); assert.equal(fixture.proofs, 0);
  jobs[0].options.onReceipt({ state: 'start' }); assert.equal(fixture.proofs, 0);
  controller.state({ action: true }); assert.equal(jobs[0].options.signal.aborted, true);
  jobs[0].options.onReceipt({ state: 'presented' }); assert.equal(fixture.proofs, 0);
  const deal = controller.present(source); await new Promise(resolve => setImmediate(resolve));
  assert.equal(jobs.length, 2);
  controller.state({ speech: false }); // Late cleanup from interrupted chat.
  assert.equal(jobs[1].options.signal.aborted, false);
  controller.state({ ready: true }); // Generation finishes while the card is moving.
  assert.equal(jobs[1].options.signal.aborted, false);
  assert.equal(fixture.proofs, 0);
  jobs[1].resolve({ completed: true }); assert.equal(await deal, true);
  controller.state({ action: false }); assert.equal(jobs.length, 3); assert.equal(fixture.proofs, 0);
  jobs[2].options.onReceipt({ state: 'presented' }); assert.equal(fixture.proofs, 1);
});
test('an idle warning survives selection and start, then clears on the current presented frame', async t => {
  const { controller, jobs, status } = await controllerFixture(t);
  controller.start(); jobs[0].reject(new Error('Film ended without a presented frame'));
  await new Promise(resolve => setImmediate(resolve));
  const warning = 'Idle: Film ended without a presented frame';
  assert.equal(jobs.length, 2); assert.equal(status.textContent, warning);
  jobs[1].options.onReceipt({ state: 'start' }); assert.equal(status.textContent, warning);
  jobs[1].options.onReceipt({ state: 'presented' }); assert.equal(status.textContent, '');
});

test('stale idle frames cannot clear a warning across ownership changes or closure', async t => {
  const { controller, jobs, status } = await controllerFixture(t);
  controller.start(); jobs[0].reject(new Error('idle unavailable'));
  await new Promise(resolve => setImmediate(resolve));
  const warning = status.textContent, stale = jobs[1].options.onReceipt;
  controller.state({ action: true }); stale({ state: 'presented' });
  assert.equal(status.textContent, warning);
  controller.state({ action: false });
  const current = jobs[2].options.onReceipt;
  stale({ state: 'presented' }); assert.equal(status.textContent, warning);
  controller.close(); current({ state: 'presented' }); assert.equal(status.textContent, warning);
});

test('a recovered idle frame preserves a newer action error on the shared status surface', async t => {
  const { controller, jobs, status } = await controllerFixture(t);
  controller.start(); jobs[0].reject(new Error('idle unavailable'));
  await new Promise(resolve => setImmediate(resolve));
  controller.state({ action: true });
  const action = controller.present(source); await new Promise(resolve => setImmediate(resolve));
  jobs[2].reject(new Error('Action clip unavailable')); assert.equal(await action, false);
  const warning = 'Action clip unavailable · 2D-reserv'; assert.equal(status.textContent, warning);
  controller.state({ action: false });
  jobs[3].options.onReceipt({ state: 'presented' }); assert.equal(status.textContent, warning);
});

test('a shared media download cancelled by the old owner does not poison the new owner', async t => {
  const { PerformancePlayer } = await import('../web/public/performance-player.mjs');
  const previousFetch = globalThis.fetch;
  const bytes = new TextEncoder().encode('shared local MP4 fixture');
  const sha256 = Buffer.from(await crypto.subtle.digest('SHA-256', bytes)).toString('hex');
  let fetches = 0;
  globalThis.fetch = async (url, { signal }) => {
    if (++fetches === 1) return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
    return new Response(bytes);
  };
  const player = Object.create(PerformancePlayer.prototype); player.assets = new Map();
  t.after(() => { globalThis.fetch = previousFetch; for (const url of player.assets.values()) URL.revokeObjectURL(url); });
  const take = { media: { sha256, src: '/fixture.mp4' } }, old = new AbortController(), next = new AbortController();
  const first = player.source(take, old.signal), second = player.source(take, next.signal);
  old.abort(); await assert.rejects(first, { name: 'AbortError' });
  const url = await second; assert.match(url, /^blob:/); assert.equal(fetches, 2);
  assert.equal(await player.source(take, next.signal), url); assert.equal(fetches, 2);
});

test('a newer ownership change discards a late selection before it can start a film', async t => {
  const { controller, jobs } = await controllerFixture(t);
  let respond;
  globalThis.fetch = () => new Promise(resolve => { respond = resolve; });
  controller.state({ action: true });
  const pending = controller.present(source);
  controller.state({ action: false }); // New renderer boundary while selection is pending.
  const count = jobs.length;
  respond(new Response(JSON.stringify({ video: { id: 'old' }, decision: {} })));
  assert.equal(await pending, false); assert.equal(jobs.length, count);
});

test('a bank without speech or idle rests on its still, reports that still as standard idle and skips game speech without a 2D fallback', async t => {
  const originalDocument = globalThis.document, originalFetch = globalThis.fetch, originalImage = globalThis.Image;
  const draws = [], images = [], receipts = [], jobs = [], requests = [], elements = [];
  let idles = 0;
  const element = () => { const value = { style: {}, dataset: {}, setAttribute() {}, append() {}, remove() {}, getContext: () => ({ drawImage: image => draws.push(image) }) }; elements.push(value); return value; };
  globalThis.document = { hidden: false, createElement: element, addEventListener() {}, removeEventListener() {} };
  globalThis.Image = class { constructor() { images.push(this); } };
  const video = { id: '0a0a0a0a-0a0a-0a0a-0a0a-0a0a0a0a0a0a', sha256: '0a'.repeat(32), fileName: 'deal_pos4.mp4', available: true, familyId: 'paow/deal.player.centre/box3', role: 'standard' };
  const inventory = { videos: [video], summary: {}, families: [{ id: video.familyId, dealerId: 'paow', eventId: 'deal.player.centre', situation: 'box3', playbackType: 'once', standardIds: [video.id], variantIds: [] }] };
  globalThis.fetch = async (url, options) => { requests.push(url); return new Response(JSON.stringify(url.endsWith('/config')
    ? { inventory, idlePolicy: createSeedProject().idlePolicy, projectRevision: 'paow-config', configurationSource: 'lab/project.json' }
    : { video, standard: video, projectRevision: 'paow-selection', configurationSource: 'lab/project.json', decision: { requestId: 'paow-request', sourceEvent: JSON.parse(options.body).event, media: { familyId: video.familyId } } })); };
  const player = { prepareLocalClip() {}, playLocalClip(take, options) { return new Promise((resolve, reject) => { jobs.push({ take, options, resolve });
    options.signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')), { once: true }); }); } };
  const controller = await createLocalPresentation({ player, host: element(), dealerId: 'paow', version: () => 3,
    receipt: value => receipts.push(value), onIdle: () => idles++, onBusy() {}, muted: () => false });
  t.after(() => { controller.close(); globalThis.document = originalDocument; globalThis.fetch = originalFetch; globalThis.Image = originalImage; });
  const still = elements.find(value => value.className === 'local-presentation-film local-presentation-still');
  const status = elements.find(value => value.className === 'local-presentation-status');
  assert.equal(images.length, 1); assert.equal(images[0].src, '/dealers/paow/rest.png');
  controller.start(); assert.equal(idles, 0, 'no standard idle before the rest still is on screen');
  Object.assign(images[0], { naturalWidth: 1080, naturalHeight: 1920 }); images[0].onload();
  assert.deepEqual([still.width, still.height, draws.length, draws[0]], [1080, 1920, 1, images[0]]);
  assert.equal(idles, 1, 'the drawn rest still is the standard idle the speech gate waits for');
  controller.start(); assert.equal(jobs.length, 0, 'no idle film for a dealer without an idle pool'); assert.equal(idles, 2);
  const deal = { type: 'deal', to: 'box', box: 3, shoeDraw: 7 };
  controller.prepareSequence([{ type: 'speak', line: 'goodluck' }, deal]);
  assert.equal(await controller.present({ type: 'speak', line: 'goodluck' }), false);
  assert.equal(requests.some(url => url.endsWith('/select')), false);
  assert.equal(status.textContent ?? '', '');
  assert.deepEqual(receipts.filter(row => row.event === 'speech').map(row => [row.state, row.renderer, row.sourceEvent.line]), [['skipped', 'none', 'goodluck']]);
  controller.state({ action: true }); assert.equal(idles, 2);
  const played = controller.present(deal); await new Promise(resolve => setImmediate(resolve));
  assert.equal(jobs.length, 1); assert.equal(jobs[0].take.media.sha256, video.sha256);
  jobs[0].options.hold({ videoWidth: 1080, videoHeight: 1920, ended: true }); jobs[0].resolve({ completed: true }); assert.equal(await played, true);
  images[0].onload(); assert.equal(draws.length, 2, 'a held film frame is never replaced by a late rest still');
  assert.equal(idles, 2, 'no standard idle while the action still owns the dealer');
  controller.state({ action: false }); assert.equal(idles, 3, 'the held last frame is the rest pose once the action ends');
  assert.equal(draws.length, 2);
  controller.state({ speech: true }); assert.equal(idles, 3);
  controller.state({ speech: false }); assert.equal(idles, 4, 'standard idle returns after speech ends');
  controller.state({ action: true });
  const interrupted = controller.present(deal); await new Promise(resolve => setImmediate(resolve));
  jobs[1].options.hold({ videoWidth: 1080, videoHeight: 1920, ended: false }); controller.state({ action: false });
  assert.equal(await interrupted, false);
  assert.deepEqual([idles, draws.length, draws.at(-1)], [5, 4, images[0]], 'an interrupted frame is replaced by the rest still before idle is reported');
  globalThis.document.hidden = true; controller.state({}); assert.equal(idles, 5, 'a hidden page reports no idle');
});
