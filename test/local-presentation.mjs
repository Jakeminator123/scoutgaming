import { presentationPublicModules, presentationPublicSource } from '../packages/presentation/public-modules.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once, EventEmitter, getEventListeners } from 'node:events';
import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';
import { createPresentationApi as buildPresentationApi, presentationInput } from '../services/game/presentation-api.mjs';
import { addDealer, createSeedProject as historicalProject } from '../packages/presentation/contracts/studio-model.mjs';
import { playLocalFilm } from '../services/game/public/local-film-player.mjs';
import { createPresentationStartup } from '../services/game/public/presentation-startup.mjs';
import {MAX_RECORDED_SPEECH_SECONDS} from '../packages/presentation/contracts/recorded-speech.mjs';
import { createLocalPresentation } from '../services/game/public/local-presentation.mjs';
import { createSharedRoomPresentationPorts } from '../services/game/public/shared-room-presentation.mjs';
import { loadVideoRegistry as readVideoRegistry } from '../apps/studio/lib/video-registry.mjs';
import { videoIdFromSha256 } from '../packages/studio-registry/server/video-manifest.mjs';
import { selectPresentation } from '../services/game/presentation-selection.mjs';
import { createProjectStore } from '../apps/studio/lib/project-store.mjs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {fileURLToPath} from 'node:url';
const fixtureArchive=fileURLToPath(new URL('../media/dealers/astrid/runtime/presentation',import.meta.url));
// Archived media is explicitly injected test data, never an automatic runtime source.
async function loadVideoRegistry(options={}) {
  const registry=await readVideoRegistry({archiveDir:options.env?.LAB_VIDEO_ARCHIVE??fixtureArchive,...options});
  for(const video of registry.videos)if(video.eventId==='idle.ready'&&!video.classification)video.classification={dealerId:video.dealer,eventId:'idle.ready',kind:'idle',role:video.role==='standard'?'standard':'alternative',situation:'',label:video.fileName,notes:'',playback:'once'};
  return registry;
}
function createSeedProject(){
  const project=historicalProject();
  project.dealerIdlePolicies=[{dealerId:'astrid',policy:structuredClone(project.idlePolicy)}];
  return project;
}
function createPresentationApi(options={}){
 const registryOptions={env:options.env??{},archiveDir:options.env?.LAB_VIDEO_ARCHIVE??fixtureArchive};
 return buildPresentationApi({registryOptions,registryLoader:()=>loadVideoRegistry(registryOptions),...options});
}


test('local server dispatch serves GET/HEAD for the complete browser import graph without broadening web paths', async(t) => {
  // Exercise the production dispatch condition as well as the module handler:
  // calling the handler alone missed the dealer-identity alias regression.
  const serverSource = await readFile(new URL('../services/game/server.mjs', import.meta.url), 'utf8');
  const guard = serverSource.match(/^  if \((pathname\.startsWith\('\/api\/presentation\/'\).*?)\) \{\r?$/m)?.[1];
  assert.ok(guard, 'production presentation dispatch must be identifiable');
  const dispatches = pathname => new Function('pathname', 'presentationPublicSource', 'return Boolean(' + guard + ')')(pathname, presentationPublicSource);
  const handler = createPresentationApi({ env:{}, store:{load:async()=>assert.fail('public modules must not load private policy')} });
  const publicEntry = new Map([
    ['/local-presentation.mjs', '../services/game/public/local-presentation.mjs'],
    ['/dealer-identity.mjs', '../packages/presentation/contracts/dealer-identity.mjs'],
    ['/recorded-speech.mjs', '../packages/presentation/contracts/recorded-speech.mjs'],
  ]);
  const server = createServer(async(req,res) => {
    const pathname = new URL(req.url, 'http://local').pathname;
    if (dispatches(pathname) && await handler(req,res,pathname,null)) return;
    if (publicEntry.has(pathname) && req.method === 'GET') {
      res.writeHead(200, {'Content-Type':'text/javascript'});
      res.end(await readFile(new URL(publicEntry.get(pathname), import.meta.url))); return;
    }
    res.writeHead(404);res.end();
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>{server.closeAllConnections();server.close();});
  const origin = 'http://127.0.0.1:' + server.address().port;
  const pending = ['/local-presentation.mjs', ...presentationPublicModules.flatMap(row => row.paths)], visited = new Set();
  while(pending.length) {
    const path = pending.shift();if(visited.has(path))continue;visited.add(path);
    const response = await fetch(origin+path);
    assert.equal(response.status,200,path);
    const body = await response.text();
    assert.match(response.headers.get('content-type'),path.endsWith('.json')?/application\/json/:/text\/javascript/,path);
    if (presentationPublicSource(path)) {
      assert.equal(body, await readFile(new URL('../'+presentationPublicSource(path), import.meta.url), 'utf8'), path+' canonical source bytes');
      const head = await fetch(origin+path, {method:'HEAD'});
      assert.equal(head.status,200,path);
      assert.equal(await head.text(),'',path);
      for (const header of ['content-type','cache-control','content-length']) {
        assert.equal(head.headers.get(header),response.headers.get(header),`${path} ${header}`);
      }
      assert.equal(head.headers.get('content-length'),String(Buffer.byteLength(body)),path);
    }
    if(path.endsWith('.json')){assert.equal(JSON.parse(body).schemaVersion,1);continue;}
    for(const imported of body.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) {
      assert.match(imported[1],/^\.{1,2}\//,'browser imports must stay relative');
      pending.push(new URL(imported[1],origin+path).pathname);
    }
  }
  for(const path of ['/packages/presentation/runtime/live-idle.mjs','/packages/presentation/runtime/idle-policy.mjs',
    '/packages/presentation/contracts/dealer-identity.mjs','/packages/presentation/contracts/policies/idle-policy.seed.json',
    '/web/public/dealer-identity.mjs','/lab/policies/idle-policy.seed.json',
    '/packages/presentation/contracts/game-lane-id.mjs','/packages/navigation/game-entry.mjs'])assert.ok(visited.has(path),path);
  for (const name of ['dealer-framing','composition-settings','speech-package','astrid-voice-profile']) {
    const alias = await fetch(origin+'/'+name+'.mjs');
    const canonical = await fetch(origin+'/packages/presentation/contracts/'+name+'.mjs');
    assert.equal(alias.status,200);assert.equal(canonical.status,200);
    assert.equal(await alias.text(),await canonical.text(),name);
  }
  for(const name of ['live-idle','idle-policy']) {
    const legacy = await fetch(origin+'/presentation-runtime/'+name+'.mjs');
    assert.equal(legacy.status,200);
    assert.equal(await legacy.text(),await (await fetch(origin+'/packages/presentation/runtime/'+name+'.mjs')).text());
  }
  for(const path of ['/web/server.mjs','/web/public/app.mjs','/web/public/dealer-identity.mjs/extra',
    '/web/public/dealer-identity.mjs.bak','/packages/presentation/runtime/selection.mjs',
    '/packages/navigation/server/platform-routing.mjs','/apps/web/lib/platform-routing.mjs',
    '/packages/navigation/game-entry.mjs/extra','/packages/navigation/game-entry.mjs.bak','/game-entry.mjs',
    '/packages/presentation/contracts/presentation-room.mjs', '/packages/presentation/contracts/operator-lifecycle-key.mjs',
    '/packages/presentation/server/generated-speech-runtime.mjs', '/packages/presentation/server/generated-speech-service.mjs',
    '/packages/presentation/server/generated-speech-provider.mjs', '/packages/presentation/server/speech-journal-lease.mjs',
    '/packages/presentation/contracts/speech-journal-constants.mjs',
    '/packages/presentation/server/registered-dealer-idle.mjs', '/packages/studio-registry/server/repository.mjs',
    '/packages/presentation/contracts/game-lane-id.mjs/extra', '/packages/presentation/contracts/game-lane-id.mjs.bak',
    '/packages/presentation/runtime/live-idle.mjs/extra','/packages/presentation/runtime/idle-policy.mjs.bak',
    '/packages/presentation/contracts/studio-model.mjs','/packages/presentation/contracts/video-intake.mjs',
    '/packages/presentation/contracts/policies/project.seed.json','/packages/presentation/contracts/schemas/video.schema.json',
    '/packages/presentation/server/registered-idle-rules.mjs','/packages/presentation/server/selection.mjs',
    '/packages/presentation/contracts/dealer-identity.d.mts','/packages/presentation/contracts/dealer-identity.mjs/extra',
    '/presentation-runtime/registered-idle-rules.mjs','/dealer-identity.mjs.bak']) {
    assert.equal(dispatches(path),false,path);
    assert.equal((await fetch(origin+path)).status,404,path);
    const head = await fetch(origin+path, {method:'HEAD'});
    assert.equal(head.status,404,path);
    assert.equal(await head.text(),'',path);
  }
});

const source = { type: 'deal', to: 'box', box: 3, handIndex: 1, shoeDraw: 7, faceDown: false, card: { r: 'A', s: '♠' }, clip: { action: 'deal-centre' } };
// Per-player committed receipts, answered only for the query the presentation API issues.
const nativeReceipts = rows => ({ prepare: sql => {
  assert.match(sql, /^SELECT version, payload FROM native_presentations WHERE player_id=\?$/);
  return { get: async playerId => rows.has(playerId) ? { ...rows.get(playerId) } : undefined };
} });
test('retired playback context cannot expose a player session or load presentation state', async () => {
  const handler = buildPresentationApi({ store:{ load:() => assert.fail('unknown route must not load state') },
    nativeP6PlaybackContext:() => assert.fail('retired constructor input cannot expose ownership') });
  for (const playerId of [null, 'fixture-player']) {
    for (const method of ['GET', 'POST']) {
      const req = Readable.from([]); req.method = method; req.url = '/api/presentation/native-p6-playback-context'; req.headers = {};
      const res = { writeHead(status) { this.status = status; }, end(raw) { this.body = JSON.parse(raw); } };
      assert.equal(await handler(req, res, req.url, playerId), true);
      assert.equal(res.status, playerId ? 404 : 401);
      assert.equal(Object.hasOwn(res.body, 'actorSha256'), false);
    }
  }
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
test('Nora with empty positional clips can test every committed destination without borrowing Astrid video', async () => {
  const project = addDealer(createSeedProject(), 'nora', 'Nora'), inventory = await loadVideoRegistry();
  const events = Array.from({ length: 7 }, (_, box) => ({ ...source, box, shoeDraw: box + 1, clip: { action: box < 2 ? 'deal-left' : box < 5 ? 'deal-centre' : 'deal-right' } }));
  for (const faceDown of [false, true]) events.push({ type: 'deal', to: 'dealer', box: null, handIndex: null, shoeDraw: events.length + 1, faceDown, card: faceDown ? null : { r: 'Q', s: '♥' }, clip: { action: 'deal-dealer' } });
  const handler = createPresentationApi({ db: { prepare: () => ({ get: async () => ({ version: 2, payload: JSON.stringify(events) }) }) },
    env: {}, store: { load: async () => project }, registryLoader: async () => inventory });
  for (const event of events) {
    const response = await presentationFixtureRequest(handler, 'nora-fixture', { dealerId: 'nora', version: 2, mode: 'off', event: { ...event, card: { r: 'K', s: '♦' } } });
    assert.equal(response.status, 200); assert.equal(response.body.video, null); assert.equal(response.body.standard, null);
    assert.equal(response.body.decision.media.reason, 'position_clip_missing');
    assert.deepEqual(response.body.decision.sourceEvent, event, 'missing media cannot change committed or hidden cards');
  }
});

test('an explicitly unavailable Nora positional baseline is skipped; available deals and other events keep their behavior', async () => {
  for (const [event, eventId, kind, situation, available] of [
    [source, 'deal.player.centre', 'action', 'box3', false],
    [source, 'deal.player.centre', 'action', 'box3', true],
    [{ type: 'speak', line: 'goodluck' }, 'speak.goodluck', 'speech', 'goodluck', false],
  ]) {
    const project = addDealer(createSeedProject(), 'nora', 'Nora');
    const id = '00000000-0000-4000-8000-000000000003';
    const baseline = project.lines.find(line => line.dealerId === 'nora' && line.eventId === eventId).variants[0];
    baseline.videoGenerationId = id;
    const video = { id, dealer: 'nora', fileName: 'nora-own-baseline.mp4', sha256: 'b'.repeat(64), available,
      classification: { dealerId: 'nora', eventId, kind, role: 'standard', situation, playback: 'once', label: 'Nora', notes: '' } };
    const inventory = { videos: [video], families: [] };
    const handler = createPresentationApi({ db: { prepare: () => ({ get: async () => ({ version: 2, payload: JSON.stringify([event]) }) }) },
      env: {}, store: { load: async () => project }, registryLoader: async () => inventory });
    const response = await presentationFixtureRequest(handler, 'nora-fixture', { dealerId: 'nora', version: 2, mode: 'off', event });
    assert.equal(response.status, 200, JSON.stringify(response.body)); assert.deepEqual(response.body.decision.sourceEvent, event);
    if (event.type === 'deal' && !available) {
      assert.equal(response.body.videoGenerationId, null); assert.equal(response.body.video, null); assert.equal(response.body.standard, null);
      assert.equal(response.body.decision.media.reason, 'position_clip_missing'); assert.equal(response.body.decision.media.situation, 'box3');
      assert.equal(response.body.trace.some(step => step.stage === 'media-family' && step.status === 'skipped'), true);
    } else {
      assert.equal(response.body.videoGenerationId, id); assert.equal(response.body.video.id, id);
      assert.equal(response.body.decision.media, null, 'this fix cannot change available positions or unrelated legacy event receipts');
    }
  }
});

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
  const receipts = new Map([['qa', { version: 2, payload: JSON.stringify([source]) }]]), db = nativeReceipts(receipts);
  const handler = createPresentationApi({ db, env: {}, store: { load: async () => createSeedProject() } });
  const server = createServer(async (req, res) => { if (!await handler(req, res, new URL(req.url, 'http://local').pathname, req.headers['x-fixture-player'] ?? 'qa')) { res.writeHead(404); res.end(); } });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
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
  receipts.set('qa', { ...receipts.get('qa'), payload: JSON.stringify([source, reveal]) });
  assert.equal((await choose({ event: reveal, version: 1 })).status, 409);
  assert.equal((await choose({ event: reveal }, { 'x-fixture-player': 'somebody-else' })).status, 409);
  const flip = await (await choose({ event: { ...reveal, card: { r: 'A', s: '♥' } } })).json();
  assert.equal(flip.video.fileName, 'deal_flip.mp4'); assert.deepEqual(flip.decision.sourceEvent.card, reveal.card);
  const media = await fetch(origin + result.video.src, { headers: { range: 'bytes=0-15' } });
  assert.equal(media.status, 206); assert.equal((await media.arrayBuffer()).byteLength, 16);
  assert.equal(media.headers.get('cache-control'), 'private, no-cache, must-revalidate');
  const unchanged = await fetch(origin + result.video.src, { headers: { 'if-none-match': media.headers.get('etag') } });
  assert.equal(unchanged.status, 304);
  assert.equal((await unchanged.arrayBuffer()).byteLength, 0);
  assert.equal(unchanged.headers.get('cache-control'), 'private, no-cache, must-revalidate');
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

test('explicit test archive feeds the same exact product and library media', async t => {
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

  const db = nativeReceipts(new Map([['archive-qa', { version: 2, payload: JSON.stringify([source]) }]]));
  const handler = createPresentationApi({ db, env, store: { load: async () => createSeedProject() } });
  const server = createServer(async (req, res) => { await handler(req, res, new URL(req.url, 'http://local').pathname, 'archive-qa'); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
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
  project.dealers = project.dealers.filter(row => row.id === 'astrid');
  project.lines = project.lines.filter(row => row.dealerId === 'astrid');
  const registry = await loadVideoRegistry();
  const family = registry.families.find(row => row.situation === 'box0');
  const variant = registry.videos.find(row => family.variantIds.includes(row.id) && row.available);
  assert.ok(variant, 'The current Astrid manifest has a real first-box variant.');
  project.mediaPolicy = [{ familyId: family.id, variants: [{ videoId: variant.id, priority: 10, triggerIds: [], selection: { model: false, random: false, rules: false }, frequencyPercent: 100 }] }];
  let saved = await store.save(project, project.revision), calls = 0;
  const committed = { ...source, box: 0, clip: { action: 'deal-left' } };
  const db = nativeReceipts(new Map([['frequency-qa', { version: 2, payload: JSON.stringify([committed]) }]]));
  const handler = createPresentationApi({ db, env: {}, store, select: (body, options) => {
    calls++;
    return selectPresentation(body, { ...options, random: () => 0.1, fetchImpl: () => assert.fail('Deal frequency must not call a model') });
  } });
  const server = createServer(async (req, res) => { await handler(req, res, '/api/presentation/select', 'frequency-qa'); });
  t.after(async () => { server.closeAllConnections(); server.close(); await rm(directory, { recursive: true, force: true }); });
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
  constructor() { super(); this.style = {}; this.ended = false; this.paused = true; this.playCalls = 0; this.currentTime = 0; this.playbackRate = 1; this.videoWidth = 1080; this.videoHeight = 1920; this.frames = new Map(); this.serial = 0; }
  requestVideoFrameCallback(fn) { this.frames.set(++this.serial, fn); return this.serial; }
  cancelVideoFrameCallback(id) { this.frames.delete(id); }
  play() { this.playCalls++; this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; this.emit('pause'); }
  load() {}
  removeAttribute() {}
  remove() { this.removed = true; }
  emit(type) { this.dispatchEvent(new Event(type)); }
  frame(time = 1) { const callbacks = [...this.frames.values()]; this.frames.clear(); for (const callback of callbacks) callback(0, { mediaTime: time }); }
}
function filmFixture(t) {
  const original = globalThis.document, originalWindow = globalThis.window;
  const media = [], buttons = [];
  const page = globalThis.document = Object.assign(new EventTarget(), { hidden: false,
    body: {append: button => buttons.push(button)},
    createElement: name => {
      if (name === 'button') return {style:{},setAttribute(){},remove(){this.removed=true;}};
      const video = new Video(); media.push(video); return video;
    } });
  const view = globalThis.window = new EventTarget();
  t.after(() => { globalThis.document = original; globalThis.window = originalWindow; });
  return { media, buttons, page, view, host: { append() {} } };
}

test('mobile recovery starts the same blocked video directly in the user gesture', async t => {
  const {page,buttons,host} = filmFixture(t), owner = new AbortController(), receipts = [];
  const video = page.createElement('video'); let gesture = false;
  video.play = () => {
    video.playCalls++;
    if (video.playCalls === 1) return Promise.reject(new DOMException('Blocked', 'NotAllowedError'));
    assert.equal(gesture, true, 'play is called synchronously by the button');
    video.paused = false; return Promise.resolve();
  };
  const result = playLocalFilm({host,video,src:'blob:verified',signal:owner.signal,onReceipt:r=>receipts.push(r.state)});
  void result.catch(()=>{}); t.after(()=>owner.abort());
  await Promise.resolve(); await Promise.resolve();
  assert.notEqual(video.removed,true); assert.equal(buttons.length,1);
  assert.equal(video.src,'blob:verified'); assert.equal(video.muted,true);
  gesture=true; buttons[0].onclick(); gesture=false;
  assert.equal(video.playCalls,2);
  video.emit('playing'); assert.equal(receipts.includes('presented'),false);
  video.frame(); assert.equal(receipts.includes('presented'),true);
  video.ended=true; video.emit('ended'); await result;
  assert.equal(buttons[0].removed,true);
});

test('mobile gesture wait outlasts the page timeout without exposing reload or an unpresented scene', async t => {
  const {page,buttons,host} = filmFixture(t), owner = new AbortController();
  t.mock.timers.enable({apis:['setTimeout']});
  const reloadButtons = [], status = {hidden:false,textContent:'loading',setAttribute(){},append:button=>reloadButtons.push(button)};
  page.documentElement={dataset:{}}; page.querySelector=()=>status;
  const startup=createPresentationStartup({document:page,dealerId:'dragan'});
  t.after(()=>{startup.close();owner.abort();});
  const video=page.createElement('video'); let gesture=false;
  video.play=()=>{
    video.playCalls++;
    if(video.playCalls===1)return Promise.reject(new DOMException('Blocked','NotAllowedError'));
    assert.equal(gesture,true,'the real play call stays in the trusted click');
    video.paused=false;return Promise.resolve();
  };
  const result=playLocalFilm({host,video,src:'blob:verified',signal:owner.signal,
    onGestureWait:waiting=>startup.waitForGesture('dragan',waiting),
    onReceipt:event=>{if(event.state==='presented')startup.ready('dragan');}});
  void result.catch(()=>{});
  await Promise.resolve();await Promise.resolve();
  t.mock.timers.tick(31000);
  assert.equal(startup.state,'pending','awaiting a tap is not a page load failure');
  assert.equal(reloadButtons.length,0);assert.equal(status.hidden,false);
  assert.equal(video.src,'blob:verified');assert.notEqual(video.removed,true);
  gesture=true;buttons[0].onclick();gesture=false;
  video.emit('playing');
  assert.equal(startup.state,'pending','playing without a frame still hides the scene');
  video.frame();assert.equal(startup.state,'ready');assert.equal(status.hidden,true);
  video.ended=true;video.emit('ended');await result;
});

test('mobile recovery releases the blocked video, waiting signal and button on cancellation, deadline or decoding error', async t => {
  const {page,buttons,host} = filmFixture(t);
  t.mock.timers.enable({apis:['setTimeout']});
  for (const ending of ['abort','deadline','decode']) {
    const owner = new AbortController(), video=page.createElement('video'),waiting=[];
    video.play=()=>{video.playCalls++;return Promise.reject(new DOMException('Blocked','NotAllowedError'));};
    const result=playLocalFilm({host,video,src:'blob:verified',signal:owner.signal,onGestureWait:value=>waiting.push(value)});
    void result.catch(()=>{}); t.after(()=>owner.abort());
    await Promise.resolve(); await Promise.resolve();
    const button=buttons.at(-1); assert.ok(button);assert.deepEqual(waiting,[true]);
    if(ending==='abort') owner.abort();
    else if(ending==='decode')video.emit('error');
    else {
      t.mock.timers.tick(60000);button.onclick();await Promise.resolve();await Promise.resolve();
      assert.deepEqual(waiting,[true,false,true],'a denied second gesture re-enters waiting');
      t.mock.timers.tick((MAX_RECORDED_SPEECH_SECONDS+8)*1000-60001);
      assert.notEqual(video.removed,true);
      t.mock.timers.tick(1);
    }
    await assert.rejects(result,ending==='abort'?{name:'AbortError'}:ending==='decode'?/decoded/:/playback limit/);
    assert.equal(video.removed,true); assert.equal(button.removed,true);assert.equal(waiting.at(-1),false);
    const plays=video.playCalls;
    button.onclick(); assert.equal(video.playCalls,plays,'a stale gesture cannot resume the closed owner');
  }
});

test('mobile recovery retains the verified cache lease and rejects changed bytes before playback', async t => {
  const {page,buttons,host}=filmFixture(t), owner=new AbortController(), revoked=[],waiting=[];
  const {PerformancePlayer}=await import('../services/game/public/performance-player.mjs');
  const {createVerifiedVideoBuffer}=await import('../services/game/public/verified-video-buffer.mjs');
  const exact=text=>({src:'/'+text,sha256:createHash('sha256').update(text).digest('hex')});
  const cache=createVerifiedVideoBuffer({budget:3,fetchImpl:async src=>new Response(src.slice(1)),
    createUrl:()=>`blob:${crypto.randomUUID()}`,revokeUrl:url=>revoked.push(url)});
  t.after(()=>{owner.abort();cache.close();});
  const warm=await cache.acquire(exact('aaa'));warm.release();
  const player=Object.assign(Object.create(PerformancePlayer.prototype),{localBuffer:cache});
  const video=page.createElement('video');
  video.play=()=>{video.playCalls++;return Promise.reject(new DOMException('Blocked','NotAllowedError'));};
  const pending=player.playLocalClip({media:exact('aaa')},{host,video,signal:owner.signal,onGestureWait:value=>waiting.push(value)});
  void pending.catch(()=>{});
  await Promise.resolve();await Promise.resolve();await Promise.resolve();await Promise.resolve();
  assert.equal(buttons.length,1);assert.equal(video.src,warm.src);assert.deepEqual(waiting,[true]);
  const other=await cache.acquire(exact('bbb'));other.release();
  assert.equal(revoked.includes(warm.src),false,'the blocked video still owns its verified URL');
  owner.abort();await assert.rejects(pending,{name:'AbortError'});assert.deepEqual(waiting,[true,false]);
  const next=await cache.acquire(exact('bbb'));next.release();
  assert.equal(revoked.includes(warm.src),true,'cancellation released the pinned URL');
  await assert.rejects(player.playLocalClip({media:{...exact('ccc'),src:'/bad'}},{host,video,onGestureWait:value=>waiting.push(value)}),/changed since review/);
  assert.equal(video.playCalls,1,'changed bytes cannot reach playback or gesture recovery');
  assert.deepEqual(waiting,[true,false],'unverified bytes cannot pause the startup watchdog');
});
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
test('failed dealer keying never exposes the raw video or publishes a presented receipt',async t=>{
  const {media,host}=filmFixture(t),receipts=[];
  const result=playLocalFilm({host,src:'/green-source',renderFrame:()=>false,onReceipt:r=>receipts.push(r.state)});
  media[0].emit('playing');media[0].frame(0);
  await assert.rejects(result,/background removal unavailable/);
  assert.equal(media[0].style.visibility,'hidden');assert.equal(receipts.includes('presented'),false);
});
test('an ended event with no presented picture fails with bounded-retry diagnostics, never frame proof', async t => {
  const { media, host } = filmFixture(t), receipts = [];
  const result = playLocalFilm({ host, src: '/broken', onReceipt: row => receipts.push(row) });
  Object.assign(media[0], {readyState:4,currentTime:5,duration:5});
  media[0].emit('playing'); media[0].ended = true; media[0].emit('ended');
  await assert.rejects(result, {message:'Film ended without a presented frame',code:'local_film_no_presented_frame'});
  assert.deepEqual(receipts.map(row=>row.state), ['start','error']);
  assert.deepEqual(receipts.at(-1).playback, {started:true,presented:false,ended:true,readyState:4,paused:false,seeking:false,networkState:undefined,mediaTime:5,duration:5,visibility:'visible'});
  assert.equal(receipts.at(-1).code, 'local_film_no_presented_frame');
});

test('incomplete media lifecycle is not classified as a retryable missing first frame', async t => {
  const { media, host } = filmFixture(t);
  const unstarted = playLocalFilm({host,src:'/unstarted'}); media[0].ended = true; media[0].emit('ended');
  await assert.rejects(unstarted, {code:'local_film_incomplete'});
  const unfinished = playLocalFilm({host,src:'/unfinished'}); media[1].emit('playing'); media[1].emit('ended');
  await assert.rejects(unfinished, {code:'local_film_incomplete'});
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

test('a browser-paused film resumes its current frame without changing speech or completing a queued card', async t => {
  const { media, host } = filmFixture(t), owner = new AbortController(), receipts = [], times = [];
  t.after(() => owner.abort());
  const result = playLocalFilm({ host, src: '/exact-deal', signal: owner.signal, muted: false,
    onReceipt: row => receipts.push(row.state), onFrame: time => times.push(time) });
  const video = media[0]; video.emit('playing'); video.frame(.75);
  video.currentTime = .75; video.playbackRate = 1.25; video.pause();
  assert.equal(video.playCalls, 2); assert.equal(video.currentTime, .75);
  assert.equal(video.playbackRate, 1.25); assert.equal(video.muted, false);
  assert.deepEqual(receipts, ['start', 'presented']); assert.deepEqual(times, [.75]);
  video.emit('playing'); video.frame(1.25); video.ended = true; video.emit('ended');
  await result;
  assert.deepEqual(times, [.75, 1.25]); assert.deepEqual(receipts, ['start', 'presented', 'end']);
});

test('valid 120-second recorded speech passes the old 60-second cutoff while playback remains bounded', async t => {
  const {media,host} = filmFixture(t);
  t.mock.timers.enable({apis:['setTimeout']});
  const completed = playLocalFilm({host,src:'/maximum-recorded-speech',muted:false});
  const video = media[0]; video.emit('playing'); video.frame();
  for (let second = 4; second <= MAX_RECORDED_SPEECH_SECONDS; second += 4) {
    t.mock.timers.tick(4000); video.currentTime = second; video.emit('timeupdate');
    assert.notEqual(video.removed,true, `valid progress at ${second}s`);
  }
  video.ended = true; video.emit('ended'); await completed;
  assert.equal(video.muted,false);

  const oversized = playLocalFilm({host,src:'/over-limit-recorded-speech'});
  const long = media.at(-1); long.emit('playing'); long.frame();
  for (let second = 4; second < MAX_RECORDED_SPEECH_SECONDS + 8; second += 4) {
    t.mock.timers.tick(4000); long.currentTime = second; long.emit('timeupdate');
  }
  t.mock.timers.tick(4000);
  await assert.rejects(oversized,/exceeded playback limit/);
  assert.equal(long.removed,true);
});

test('loading, healthy and hidden films are not restarted by recovery events', async t => {
  const { media, host, page, view } = filmFixture(t), owner = new AbortController();
  t.after(() => owner.abort());
  const result = playLocalFilm({ host, src: '/exact-idle', signal: owner.signal });
  const video = media[0]; video.pause(); page.dispatchEvent(new Event('pointerdown'));
  view.dispatchEvent(new Event('focus')); assert.equal(video.playCalls, 1);
  video.paused = false; video.emit('playing'); video.frame();
  page.dispatchEvent(new Event('keydown')); view.dispatchEvent(new Event('focus'));
  assert.equal(video.playCalls, 1);
  page.hidden = true; video.pause(); page.dispatchEvent(new Event('visibilitychange'));
  view.dispatchEvent(new Event('focus')); assert.equal(video.playCalls, 1);
  owner.abort(); await assert.rejects(result, { name: 'AbortError' });
  page.hidden = false; page.dispatchEvent(new Event('visibilitychange'));
  assert.equal(video.playCalls, 1, 'returning to a cancelled film cannot resume its old owner');
});

test('simultaneous pause, focus and input recovery share one pending play request', async t => {
  const { media, host, page, view } = filmFixture(t), owner = new AbortController();
  t.after(() => owner.abort());
  const result = playLocalFilm({ host, src: '/exact-deal', signal: owner.signal });
  const video = media[0]; video.emit('playing'); video.frame();
  let resumed;
  video.play = () => { video.playCalls++; return new Promise(resolve => { resumed = resolve; }); };
  video.pause(); view.dispatchEvent(new Event('focus'));
  page.dispatchEvent(new Event('pointerdown')); page.dispatchEvent(new Event('keydown'));
  assert.equal(video.playCalls, 2);
  video.paused = false; resumed(); await Promise.resolve();
  video.ended = true; video.emit('ended'); await result;
});

test('missed ended events use actual media completion and retain the presented-frame requirement', async t => {
  const { media, host, view } = filmFixture(t);
  for (const presented of [true, false]) {
    const receipts = [], result = playLocalFilm({ host, src: '/exact-end', onReceipt: row => receipts.push(row.state) });
    const video = media.at(-1); video.emit('playing'); if (presented) video.frame();
    video.ended = true; video.paused = true; view.dispatchEvent(new Event('focus'));
    if (presented) { await result; assert.deepEqual(receipts, ['start', 'presented', 'end']); }
    else { await assert.rejects(result, /without a presented frame/); assert.deepEqual(receipts, ['start', 'error']); }
    assert.equal(video.playCalls, 1, 'an ended film must not replay from the beginning');
    assert.equal(video.removed, true);
  }
});

test('the film watchdog accepts a missed end but still rejects media that has actually stalled', async t => {
  const { media, host } = filmFixture(t);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  for (const ended of [true, false]) {
    const result = playLocalFilm({ host, src: '/no-end-event' });
    const video = media.at(-1); video.emit('playing'); video.frame(); video.ended = ended;
    t.mock.timers.tick(8000);
    if (ended) await result;
    else await assert.rejects(result, /playback stalled/);
    assert.equal(video.playCalls, 1); assert.equal(video.removed, true);
  }
});

test('unchanged timeupdate and playing events cannot hide a visible unpaused film stall', async t => {
  const { media, host } = filmFixture(t), receipts = [];
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const result = playLocalFilm({host,src:'/stalled-idle',onReceipt:row=>receipts.push(row)});
  const video = media[0]; Object.assign(video,{readyState:4,networkState:1,duration:5,seeking:false});
  video.emit('playing'); video.currentTime=1; video.frame(1); video.emit('timeupdate');
  t.mock.timers.tick(4000); video.emit('timeupdate'); video.emit('playing');
  t.mock.timers.tick(4000);
  assert.equal(video.removed,true,'the unchanged media clock must trip the watchdog');
  await assert.rejects(result,{code:'local_film_stalled'});
  assert.deepEqual(receipts.map(row=>row.state),['start','presented','error']);
  assert.equal(receipts.at(-1).playback.mediaTime,1);
  assert.equal(receipts.at(-1).playback.paused,false);
  assert.equal(receipts.at(-1).playback.visibility,'visible');
  assert.equal(video.playCalls,1); assert.equal(video.removed,true);
});

test('denied speech recovery reports failure without muting or replaying silently', async t => {
  const { media, host, view } = filmFixture(t), receipts = [];
  const result = playLocalFilm({ host, src: '/exact-speech', muted: false, onReceipt: row => receipts.push(row.state) });
  const video = media[0]; video.emit('playing'); video.frame();
  video.play = async () => { video.playCalls++; throw new DOMException('Audio blocked', 'NotAllowedError'); };
  video.paused = true; view.dispatchEvent(new Event('focus'));
  await assert.rejects(result, { name: 'NotAllowedError' });
  assert.equal(video.muted, false); assert.equal(video.playCalls, 2);
  assert.deepEqual(receipts, ['start', 'presented', 'error']);
});

test('cancelled pending recovery cannot affect a replacement and all film listeners are released', async t => {
  const { media, host, page, view } = filmFixture(t), owner = new AbortController(), receipts = [];
  const first = playLocalFilm({ host, src: '/old', signal: owner.signal, muted: false, onReceipt: row => receipts.push(row.state) });
  const old = media[0]; old.emit('playing'); old.frame(); let rejectResume;
  old.play = () => { old.playCalls++; return new Promise((resolve, reject) => { rejectResume = reject; }); };
  old.pause(); owner.abort(); await assert.rejects(first, { name: 'AbortError' });
  for (const event of ['playing', 'timeupdate', 'ended', 'error', 'pause']) assert.equal(getEventListeners(old, event).length, 0);
  for (const event of ['visibilitychange', 'pointerdown', 'keydown']) assert.equal(getEventListeners(page, event).length, 0);
  assert.equal(getEventListeners(view, 'focus').length, 0);
  const nextReceipts = [], second = playLocalFilm({ host, src: '/replacement', muted: false, onReceipt: row => nextReceipts.push(row.state) });
  rejectResume(new DOMException('Old playback interrupted', 'AbortError')); await Promise.resolve();
  old.emit('playing'); old.ended = true; old.emit('ended');
  assert.deepEqual(receipts, ['start', 'presented', 'interrupted']); assert.deepEqual(nextReceipts, []);
  const next = media[1]; assert.equal(next.muted, false); assert.equal(next.playCalls, 1);
  next.emit('playing'); next.frame(); next.ended = true; next.emit('ended'); await second;
  page.dispatchEvent(new Event('pointerdown')); view.dispatchEvent(new Event('focus'));
  assert.equal(old.playCalls, 2); assert.equal(next.playCalls, 1);
  for (const event of ['playing', 'timeupdate', 'ended', 'error', 'pause']) assert.equal(getEventListeners(next, event).length, 0);
  for (const event of ['visibilitychange', 'pointerdown', 'keydown']) assert.equal(getEventListeners(page, event).length, 0);
  assert.equal(getEventListeners(view, 'focus').length, 0);
});

async function controllerFixture(t, {dealerId = 'astrid', ownIdle = null, composition = null, missingPosition = false, entry = null, configStatus = 200, idlePolicy = null, customInventory = null, defaultMode = 'off', selectedVideo = null, standardVideo = null, transitions = null, openclaw = null, filmedMaterial = null, prepared = null, onGestureWait = () => {}, idlePhase = () => 'bets'} = {}) {
  const originalDocument = globalThis.document, originalFetch = globalThis.fetch;
  const inventory = customInventory ?? await loadVideoRegistry(), jobs = [], receipts = [], elements = [], requests = [];
  const element = () => { const value = { style: {}, dataset: {}, appended: [], setAttribute() {}, append(...nodes) { value.appended.push(...nodes); }, remove() {}, getContext: () => ({ drawImage() {} }) }; elements.push(value); return value; };
  const visibilityHandlers = new Set();
  globalThis.document = { hidden: false, createElement: element,
    addEventListener(type, handler) { if(type==='visibilitychange')visibilityHandlers.add(handler); },
    removeEventListener(type, handler) { if(type==='visibilitychange')visibilityHandlers.delete(handler); } };
  const selected = selectedVideo ?? inventory.videos.find(video => video.fileName === 'deal_pos4.mp4');
  globalThis.fetch = async (url,options={}) => { requests.push({url,options}); const configRequest=new URL(url,'https://game.invalid').pathname==='/api/presentation/config';return new Response(JSON.stringify(configRequest ? { inventory, idlePolicy: idlePolicy ?? createSeedProject().idlePolicy, defaultMode, ...(openclaw ? { openclaw } : {}), ...(filmedMaterial ? {filmedMaterial} : {}), projectRevision: 'studio-config-fixture', configurationSource: 'lab/project.json', dealerIdle: {[dealerId]: ownIdle} }
    : { video: missingPosition ? null : selected, standard: standardVideo ?? selected, transitions, projectRevision: 'studio-selection-fixture', configurationSource: 'lab/project.json', decision: { requestId: 'selection-fixture', sourceEvent: source, media: { familyId: missingPosition ? null : selected.familyId, ...(missingPosition ? { reason: 'position_clip_missing', situation: 'box3' } : {}) } } }), { status:configRequest?configStatus:200,headers: { 'content-type': 'application/json' } }); };
  let proofs = 0, busy = 0, tableVersion = 2;
  const player = { playLocalClip(take, options) { return new Promise((resolve, reject) => {
    const job = { take, options, resolve, reject }; jobs.push(job);
    options.signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')), { once: true });
  }); }, ...(prepared ? { prepareLocalClip(take) { prepared.push(take); } } : {}) };
  const controller = await createLocalPresentation({ player, host: element(), dealerId, composition, entry, version: () => tableVersion,
    receipt: value => receipts.push(value), onIdle: () => proofs++, onBusy() {busy++;}, onGestureWait, idlePhase, muted: () => false });
  t.after(() => { controller.close(); globalThis.document = originalDocument; globalThis.fetch = originalFetch; });
  return { controller, jobs, receipts, requests, elements, setVersion(value){tableVersion=value;}, setHidden(value){globalThis.document.hidden=value;for(const handler of visibilityHandlers)handler();}, setConfigStatus(value){configStatus=value;}, setMissingPosition(value) { missingPosition = value; }, status: elements.find(value => value.className === 'local-presentation-status'), get proofs() { return proofs; }, get busy() {return busy;} };
}

test('the local presenter exposes a detached frozen planning material',async t=>{
  const filmedMaterial={revision:'native-film-v2-'+'c'.repeat(64),film:{transitions:{toShoe:null,fromShoe:null}}};
  const current=await controllerFixture(t,{filmedMaterial});
  const exposed=current.controller.filmedMaterial;assert.deepEqual(exposed,filmedMaterial);
  exposed.film.transitions.toShoe={id:'changed'};
  assert.equal(current.controller.filmedMaterial.film.transitions.toShoe,null);
});

test('legacy local configuration has no frozen v2 planning material',async t=>{
  const legacy=await controllerFixture(t);assert.equal(legacy.controller.filmedMaterial,null);
});

test('pose rotation keeps a clasped clip through speech readiness and 2D actions, then exits before the standard pose', async t => {
  const ids=[1,2,3].map(n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`),familyId='paow/idle.ready/ready';
  const policy={schemaVersion:1,familyId,base:[{videoId:ids[0],durationMs:1625,weight:100}],
    variants:ids.slice(1).map(videoId=>({videoId,durationMs:1625,use:'rotation',automatic:null})),
    rotation:{clips:ids.map((videoId,i)=>({videoId,phase:i?'bets':'any',from:i===2?'clasped':'rest',to:i===1?'clasped':'rest',weight:20,head:false,calm:true}))}};
  const videos=ids.map((id,i)=>({id,dealer:'paow',familyId,available:true,role:i?'variant':'standard',fileName:id+'.mp4',sha256:String(i).repeat(64)}));
  const inventory={videos,families:[{id:familyId,dealerId:'paow',playbackType:'idle-pool',standardIds:[ids[0]],variantIds:ids.slice(1)}]};
  let phase='bets';const f=await controllerFixture(t,{dealerId:'paow',ownIdle:videos[0],idlePolicy:policy,customInventory:inventory,missingPosition:true,idlePhase:()=>phase});
  const tick=()=>new Promise(resolve=>setImmediate(resolve));
  f.controller.start();await tick();const base=f.jobs.at(-1);base.options.onReceipt({state:'presented'});base.resolve();await tick();
  const entry=f.jobs.at(-1);assert.equal(entry.take.media.sha256,videos[1].sha256);
  entry.options.onReceipt({state:'presented'});entry.options.onFrame(.5);
  f.controller.state({ready:true});assert.equal(entry.options.signal.aborted,false);
  f.controller.state({action:true});assert.equal(entry.options.signal.aborted,true);
  await f.controller.present(source);await tick();const resumed=f.jobs.at(-1);
  assert.equal(resumed.take.media.sha256,entry.take.media.sha256);assert.equal(resumed.options.startOffset,.5);
  f.controller.state({action:false});await tick();const resumedAgain=f.jobs.at(-1);assert.equal(resumedAgain.options.startOffset,.5);
  resumedAgain.options.onReceipt({state:'presented'});phase='decide';resumedAgain.resolve();await tick();
  const exit=f.jobs.at(-1);assert.equal(exit.take.media.sha256,videos[2].sha256);const proofs=f.proofs;
  exit.options.onReceipt({state:'presented'});assert.equal(f.proofs,proofs);exit.resolve();await tick();
  const standard=f.jobs.at(-1);assert.equal(standard.take.media.sha256,videos[0].sha256);standard.options.onReceipt({state:'presented'});assert.equal(f.proofs,proofs+1);
});

test('only the current presentation owner can notify a gesture wait and stopping releases it', async t => {
  const waiting=[];
  const f=await controllerFixture(t,{dealerId:'dragan',ownIdle:{id:'bound',fileName:'idle.mp4',sha256:'a'.repeat(64)},onGestureWait:value=>waiting.push(value)});
  f.controller.start();await new Promise(resolve=>setImmediate(resolve));
  const first=f.jobs[0].options;
  assert.equal(typeof first.onGestureWait,'function');
  first.onGestureWait(true);first.onGestureWait(true);assert.deepEqual(waiting,[true]);
  f.controller.state({speech:true});assert.deepEqual(waiting,[true,false]);
  first.onGestureWait(true);first.onGestureWait(false);assert.deepEqual(waiting,[true,false]);
  f.controller.state({speech:false});await new Promise(resolve=>setImmediate(resolve));
  const second=f.jobs[1].options;
  second.onGestureWait(true);assert.deepEqual(waiting,[true,false,true]);
  first.onGestureWait(false);assert.deepEqual(waiting,[true,false,true],'old cleanup cannot release a new video');
  f.setVersion(3);second.onGestureWait(false);second.onGestureWait(true);
  assert.deepEqual(waiting,[true,false,true],'a stale table version cannot report new wait state');
  f.controller.close();assert.deepEqual(waiting,[true,false,true,false]);
  second.onGestureWait(true);second.onGestureWait(false);assert.deepEqual(waiting,[true,false,true,false]);
});

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

test('shoe transitions surround the card film, keep action ownership and never drive card frames', async t => {
  const before={id:'to',sha256:'1'.repeat(64),fileName:'to.mp4'},after={id:'from',sha256:'2'.repeat(64),fileName:'from.mp4'};
  const {controller,jobs,receipts}=await controllerFixture(t,{transitions:{before,after}});
  controller.state({action:true});
  const selections=[],frames=[];
  const result=controller.present(source,{onSelected:video=>selections.push(video.id),onFrame:time=>frames.push(time)});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(jobs[0].take.media.sha256,before.sha256);assert.deepEqual(selections,[]);assert.equal(jobs[0].options.onFrame,undefined);
  controller.state({speech:false});assert.equal(jobs[0].options.signal.aborted,false);
  jobs[0].options.onReceipt({state:'end'});jobs[0].resolve();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(selections.length,1);jobs[1].options.onFrame(.4);assert.deepEqual(frames,[.4]);
  jobs[1].resolve();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(jobs[2].take.media.sha256,after.sha256);assert.equal(jobs[2].options.onFrame,undefined);
  controller.state({ready:true});assert.equal(jobs[2].options.signal.aborted,false);
  jobs[2].options.onReceipt({state:'end'});jobs[2].resolve();assert.equal(await result,true);
  assert.deepEqual(receipts.filter(row=>row.event==='transition').map(row=>row.direction),['to-shoe','from-shoe']);
});

test('cancelling the entry transition cannot start a stale card film',async t=>{
  const {controller,jobs}=await controllerFixture(t,{transitions:{before:{id:'to',sha256:'1'.repeat(64),fileName:'to.mp4'}}});
  const abort=new AbortController(),selected=[];
  const result=controller.present(source,{signal:abort.signal,onSelected:video=>selected.push(video)});
  await new Promise(resolve=>setImmediate(resolve));abort.abort();
  assert.equal(await result,false);assert.equal(jobs.length,1);assert.deepEqual(selected,[]);
});

test('a missing exact position skips every video, keeps the committed card and does not report a playback error', async t => {
  const { controller, jobs, receipts, status, setMissingPosition } = await controllerFixture(t, { missingPosition: true });
  const selected = [], presented = [];
  assert.equal(await controller.present(source, { onSelected: (...args) => selected.push(args), onPresented: () => presented.push(true) }), false);
  assert.equal(jobs.length, 0, 'even a supplied standard must not replace a missing positional clip');
  assert.deepEqual(selected, []); assert.deepEqual(presented, []); assert.equal(status.textContent, '');
  const deal = receipts.filter(row => row.event === 'deal');
  assert.deepEqual(deal.map(row => row.state), ['selected', 'skipped']);
  assert.equal(deal[1].reason, 'position_clip_missing'); assert.equal(deal[1].situation, 'box3');
  assert.equal(deal[1].projectRevision, 'studio-selection-fixture'); assert.equal(deal[1].requestId, 'selection-fixture');
  assert.deepEqual(deal[1].sourceEvent, source);
  setMissingPosition(false);
  const next = controller.present({ ...source, box: 4, shoeDraw: 8 });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(jobs.length, 1, 'a skipped position must not block the next recorded event');
  jobs[0].resolve({ completed: true }); assert.equal(await next, true);
});

test('a published room follows the composition clip modes per phase and has no player-side mode control', async t => {
  const entry = { operator: 'north', roomId: 'room-astrid', packageRevision: 4 };
  const modes = { idle: 'rules', deal: 'random', reveal: 'off', speak: 'active', probe: 'off' };
  const f = await controllerFixture(t, { entry, openclaw: modes });
  assert.equal(f.receipts[0].mode, 'rules'); assert.equal(f.receipts[0].modeSource, 'composition');
  const host = f.elements.find(el => el.appended.some(child => child.className === 'local-presentation-status'));
  assert.equal(host.appended.some(child => child.className === 'local-presentation-mode'), false, 'the published player has no clip-mode control');
  const result = f.controller.present(source); await new Promise(resolve => setImmediate(resolve));
  const select = f.requests.find(row => new URL(row.url, 'https://game.invalid').pathname === '/api/presentation/select');
  assert.equal(JSON.parse(select.options.body).mode, 'random', 'deal selection uses the composition deal mode');
  assert.deepEqual(JSON.parse(select.options.body).presentationContext, { operatorSlug: 'north', roomId: 'room-astrid', packageRevision: 4, dealerId: 'astrid' });
  f.jobs[0].options.onReceipt({ state: 'start' }); f.jobs[0].options.onReceipt({ state: 'presented' }); f.jobs[0].options.onReceipt({ state: 'end' });
  f.jobs[0].resolve({ completed: true }); assert.equal(await result, true);
  assert.equal(f.receipts.find(row => row.event === 'deal' && row.state === 'selected').mode, 'random');
});

test('Studio rehearsal without a published room keeps its local clip-mode control', async t => {
  const local = await controllerFixture(t, { defaultMode: 'off' });
  const localHost = local.elements.find(el => el.appended.some(child => child.className === 'local-presentation-status'));
  assert.equal(localHost.appended.some(child => child.className === 'local-presentation-mode'), true);
  assert.equal(local.receipts[0].modeSource, undefined);
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
test('a power-save interruption retries the same base loop instead of blacklisting it, also after the tab was hidden', async t => {
  // Production 2026-10-19 16:51, 18:21 and 18:30 UTC: Chrome rejected the
  // video-only idle play() while the tab was hidden; the base loop was then
  // blacklisted, the dealer had no idle and generated speech waited forever.
  const fixture = await controllerFixture(t); const { controller, jobs, status } = fixture;
  const powerSave = () => new DOMException('The play() request was interrupted because video-only background media was paused to save power. https://goo.gl/LdLk22', 'AbortError');
  controller.start(); assert.equal(jobs.length, 1);
  jobs[0].reject(powerSave()); await new Promise(resolve => setImmediate(resolve));
  assert.match(status.textContent, /paused to save power/);
  assert.equal(jobs.length, 1, 'the retry is delayed, never an immediate tight loop');
  await new Promise(resolve => setTimeout(resolve, 800));
  assert.equal(jobs.length, 2, 'the same base loop is filmed again');
  assert.equal(jobs[1].take.media.src, jobs[0].take.media.src);
  // Interrupted again, and the tab is hidden before the retry fires: nothing
  // plays while hidden; becoming visible resumes the same loop.
  jobs[1].reject(powerSave()); await new Promise(resolve => setImmediate(resolve));
  fixture.setHidden(true); await new Promise(resolve => setTimeout(resolve, 800));
  assert.equal(jobs.length, 2);
  // A generated reply becomes ready while hidden: the gate needs a standard
  // base frame, which the speech-ready selection makes deterministic.
  controller.state({ ready: true }); assert.equal(jobs.length, 2);
  fixture.setHidden(false); await new Promise(resolve => setImmediate(resolve));
  assert.equal(jobs.length, 3);
  jobs[2].options.onReceipt({ state: 'start' }); jobs[2].options.onReceipt({ state: 'presented' });
  assert.equal(fixture.proofs, 1, 'the resumed standard base frame opens the speech gate'); assert.equal(status.textContent, '');
  // A genuinely broken clip still follows the ordinary failure path.
  jobs[2].reject(new Error('idle unavailable')); await new Promise(resolve => setImmediate(resolve));
  assert.equal(status.textContent, 'Idle: idle unavailable');
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

test('unassigned result speech and placebets skip silently without leaving a card fallback badge on idle', async t => {
  const f=await controllerFixture(t),original=globalThis.fetch;
  let reason;
  globalThis.fetch=async(url,options)=>url==='/api/presentation/select'?Response.json({video:null,standard:null,
    projectRevision:'speech-fixture',decision:{requestId:'speech-selection',sourceEvent:JSON.parse(options.body).event,
      ...(reason?{media:{familyId:null,reason}}:{})}}):original(url,options);
  for(reason of [undefined,'no_exact_video_2d','frozen_clip_missing']){
    for(const line of ['win','placebets']){
      f.controller.state({speech:true});
      assert.equal(await f.controller.present({type:'speak',line}),false);
      assert.equal(f.status.textContent,'');
      const skipped=f.receipts.at(-1);assert.equal(skipped.state,'skipped');assert.equal(skipped.renderer,'none');
      assert.equal(skipped.reason,reason??'speech_clip_missing');assert.equal(skipped.sourceEvent.line,line);
      f.controller.state({speech:false});
      f.jobs.at(-1).options.onReceipt({state:'presented'});
      assert.equal(f.status.textContent,'');
    }
  }
  assert.equal(f.receipts.some(row=>row.event==='speech'&&row.renderer==='2d'),false);
});

test('blocked recorded speech remains a visible review error and cannot masquerade as an optional missing line', async t => {
  const f=await controllerFixture(t),original=globalThis.fetch;
  globalThis.fetch=async(url,options)=>url==='/api/presentation/select'?Response.json({video:null,standard:null,
    decision:{requestId:'blocked-speech',sourceEvent:{type:'speak',line:'win'},media:{reason:'recorded_speech_unavailable'}}}):original(url,options);
  f.controller.state({speech:true});assert.equal(await f.controller.present({type:'speak',line:'win'}),false);
  assert.match(f.status.textContent,/Tal:.*granskning eller identitet/);assert.doesNotMatch(f.status.textContent,/2D-reserv/);
  const error=f.receipts.at(-1);assert.equal(error.renderer,'none');assert.notEqual(error.state,'skipped');assert.equal(error.requestId,'blocked-speech');
  const warning=f.status.textContent;f.controller.state({speech:false});f.jobs.at(-1).options.onReceipt({state:'presented'});
  assert.equal(f.status.textContent,warning,'idle must not silently clear an actual review failure');
});

test('a speech playback failure keeps its error and correlation without claiming a 2D card fallback', async t => {
  const f=await controllerFixture(t);f.controller.state({speech:true});
  const playing=f.controller.present({type:'speak',line:'win'});await new Promise(resolve=>setImmediate(resolve));
  f.jobs[0].reject(new Error('Audio/video unavailable'));assert.equal(await playing,false);
  assert.equal(f.status.textContent,'Tal: Audio/video unavailable');
  const failed=f.receipts.at(-1);assert.equal(failed.renderer,'none');assert.notEqual(failed.state,'skipped');assert.equal(failed.requestId,'selection-fixture');
});

test('a shared media download cancelled by the old owner does not poison the new owner', async t => {
  const { PerformancePlayer } = await import('../services/game/public/performance-player.mjs');
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

test('Nora repeats only her exact configured silent idle, and stale frames cannot reopen the gate', async t => {
  const ownIdle = {id:'nora-bound-idle',fileName:'nora-idle.mp4',sha256:'b'.repeat(64),src:'/api/presentation/videos/nora-bound-idle',
    compositing:{mode:'green-screen',threshold:.23,softness:.15,despill:0}};
  const compositionCalls=[];
  const composition={prepareClip:async key=>compositionCalls.push(key),renderFrame:()=>true,hold(){}};
  const fixture=await controllerFixture(t,{dealerId:'nora',ownIdle,composition});
  fixture.controller.start();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(fixture.jobs.length,1);assert.equal(fixture.jobs[0].take.media.src,ownIdle.src);
  assert.equal(fixture.jobs[0].options.muted,true);assert.equal(fixture.proofs,0);
  fixture.jobs[0].options.onReceipt({state:'presented'});assert.equal(fixture.proofs,1);
  fixture.jobs[0].resolve();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(fixture.jobs.length,2);assert.equal(fixture.jobs[1].take.media.src,ownIdle.src);
  assert.equal(fixture.jobs[1].options.muted,true);assert.deepEqual(compositionCalls,[ownIdle.compositing,ownIdle.compositing]);
  fixture.controller.state({action:true});assert.equal(fixture.jobs[1].options.signal.aborted,true);
  fixture.jobs[1].options.onReceipt({state:'presented'});assert.equal(fixture.proofs,1);
});

test('holding a keyed idle never copies raw green pixels into the fallback still canvas',async t=>{
  let held=0;
  const composition={prepareClip:async()=>{},renderFrame:()=>true,hold(){held++;}};
  const f=await controllerFixture(t,{dealerId:'nora',ownIdle:{id:'own',fileName:'own.mp4',sha256:'a'.repeat(64)},composition});
  const still=f.elements.find(row=>row.className==='local-presentation-film local-presentation-still');
  still.getContext=()=>({drawImage(){assert.fail('raw source copied behind the compositor');}});
  f.controller.start();await new Promise(resolve=>setImmediate(resolve));
  f.jobs[0].options.hold({videoWidth:1080,videoHeight:1920});assert.equal(held,1);
});
test('Nora without a saved exact idle never borrows Astrid media',async t=>{
  const missing=await controllerFixture(t,{dealerId:'nora'});missing.controller.start();
  assert.equal(missing.jobs.length,0);assert.match(missing.status.textContent,/saknar en publicerad grundloop/);
});

test('Nora never spins on an idle failure',async t=>{
  const failed=await controllerFixture(t,{dealerId:'nora',ownIdle:{id:'own',fileName:'own.mp4',sha256:'a'.repeat(64)}});
  failed.controller.start();assert.equal(failed.jobs.length,1);
  failed.jobs[0].reject(new Error('own idle unavailable'));await new Promise(resolve=>setImmediate(resolve));
  assert.equal(failed.jobs.length,1);assert.equal(failed.status.textContent,'Idle: own idle unavailable');
});


const missingIdleFrame = () => Object.assign(new Error('Film ended without a presented frame'), {code:'local_film_no_presented_frame'});
const stalledIdle = () => Object.assign(new Error('Film playback stalled'), {code:'local_film_stalled'});
const idleRetryFixture = t => controllerFixture(t,{dealerId:'dragan',ownIdle:{id:'dragan-bound-idle',fileName:'breath.mp4',sha256:'b'.repeat(64),src:'/api/presentation/videos/dragan-bound-idle'}});
const flushIdle = () => new Promise(resolve=>setImmediate(resolve));

test('a stalled own idle retries the exact clip once; frames and state changes cannot replenish its budget',async t=>{
  const f=await idleRetryFixture(t);t.mock.timers.enable({apis:['setTimeout']});
  f.controller.start();await flushIdle();f.jobs[0].options.onReceipt({state:'presented'});
  const busyBefore=f.busy;f.jobs[0].reject(stalledIdle());await flushIdle();
  assert.equal(f.busy,busyBefore+1,'a stalled loop revokes its ready gate');
  t.mock.timers.tick(500);await flushIdle();assert.equal(f.jobs.length,2);
  assert.deepEqual(f.jobs[1].take,f.jobs[0].take);assert.equal(f.jobs[1].options.muted,true);
  f.jobs[1].options.onReceipt({state:'presented'});assert.equal(f.status.textContent,'');
  f.jobs[1].reject(stalledIdle());await flushIdle();
  for(const patch of [{},{action:true},{action:false},{speech:true},{speech:false}])f.controller.state(patch);
  f.setHidden(true);f.setHidden(false);f.controller.start();
  t.mock.timers.tick(10000);await flushIdle();
  assert.equal(f.jobs.length,2);assert.equal(f.proofs,2);assert.match(f.status.textContent,/stalled/);
});

test('only a fully completed own idle restores the stall retry budget',async t=>{
  const f=await idleRetryFixture(t);t.mock.timers.enable({apis:['setTimeout']});
  f.controller.start();await flushIdle();f.jobs[0].reject(stalledIdle());await flushIdle();
  t.mock.timers.tick(500);await flushIdle();f.jobs[1].options.onReceipt({state:'presented'});
  f.jobs[1].resolve({completed:true});await flushIdle();assert.equal(f.jobs.length,3);
  f.jobs[2].reject(stalledIdle());await flushIdle();t.mock.timers.tick(500);await flushIdle();
  assert.equal(f.jobs.length,4);assert.deepEqual(f.jobs[3].take,f.jobs[0].take);
});

for(const kind of ['deal','speech'])test('a stalled '+kind+' never replays a different standard film or claims completion',async t=>{
  const f=await controllerFixture(t,{standardVideo:{id:'other-standard',fileName:'other.mp4',sha256:'a'.repeat(64)}});
  t.mock.timers.enable({apis:['setTimeout']});
  f.controller.state(kind==='speech'?{speech:true}:{action:true});
  let completed=0;const result=f.controller.present(kind==='speech'?{type:'speak',line:'win'}:source,{onPresented:()=>completed++});
  await flushIdle();f.jobs[0].reject(stalledIdle());await flushIdle();
  assert.equal(f.jobs.length,1);assert.equal(await result,false);assert.equal(completed,0);
  t.mock.timers.tick(10000);await flushIdle();assert.equal(f.jobs.length,1);
  assert.equal(f.receipts.some(row=>row.state==='end'),false);
});

test('own idle retries the exact clip once and only a new owner frame clears the warning and opens speech',async t=>{
  const f=await idleRetryFixture(t);t.mock.timers.enable({apis:['setTimeout']});
  f.controller.start();await flushIdle();f.jobs[0].reject(missingIdleFrame());await flushIdle();
  assert.match(f.status.textContent,/without a presented frame/);assert.equal(f.proofs,0);
  t.mock.timers.tick(499);await flushIdle();assert.equal(f.jobs.length,1);
  t.mock.timers.tick(1);await flushIdle();assert.equal(f.jobs.length,2);
  assert.deepEqual(f.jobs[1].take,f.jobs[0].take);
  f.jobs[0].options.onReceipt({state:'presented'});f.jobs[1].options.onReceipt({state:'start'});
  assert.match(f.status.textContent,/without a presented frame/);assert.equal(f.proofs,0);
  f.jobs[1].options.onReceipt({state:'presented'});assert.equal(f.status.textContent,'');assert.equal(f.proofs,1);
  f.jobs[1].resolve();await flushIdle();assert.equal(f.jobs.length,3);
  f.jobs[2].reject(missingIdleFrame());await flushIdle();t.mock.timers.tick(500);await flushIdle();
  assert.equal(f.jobs.length,4,'A truly recovered loop has a fresh retry budget.');
});

test('own idle stops after a second missing frame and does not spin or open speech',async t=>{
  const f=await idleRetryFixture(t);t.mock.timers.enable({apis:['setTimeout']});
  f.controller.start();await flushIdle();f.jobs[0].reject(missingIdleFrame());await flushIdle();
  t.mock.timers.tick(500);await flushIdle();f.jobs[1].reject(missingIdleFrame());await flushIdle();
  t.mock.timers.tick(10000);await flushIdle();
  assert.equal(f.jobs.length,2);assert.equal(f.proofs,0);assert.match(f.status.textContent,/without a presented frame/);
});

for(const failure of [missingIdleFrame,stalledIdle])test('own idle recovery rechecks the frozen package on '+failure().code,async t=>{
  const f=await controllerFixture(t,{dealerId:'dragan',ownIdle:{id:'bound',fileName:'breath.mp4',sha256:'b'.repeat(64)},entry:{operator:'swedish-games',roomId:'dragan-room',packageRevision:3}});
  t.mock.timers.enable({apis:['setTimeout']});
  f.controller.start();await flushIdle();f.jobs[0].reject(failure());await flushIdle();
  f.setConfigStatus(409);t.mock.timers.tick(500);await flushIdle();
  assert.equal(f.jobs.length,1);assert.equal(f.proofs,0);assert.match(f.status.textContent,/Ladda om spelet/);
  const requests=f.requests.length;t.mock.timers.tick(10000);await flushIdle();
  assert.equal(f.requests.length,requests);assert.equal(f.jobs.length,1);
});

for(const failure of [missingIdleFrame,stalledIdle])for(const boundary of ['action','speech','hidden','close'])test('pending '+failure().code+' recovery is cancelled by '+boundary,async t=>{
  const f=await idleRetryFixture(t);t.mock.timers.enable({apis:['setTimeout']});
  f.controller.start();await flushIdle();f.jobs[0].reject(failure());await flushIdle();
  if(boundary==='hidden')f.setHidden(true);
  else if(boundary==='close')f.controller.close();
  else f.controller.state({[boundary]:true});
  t.mock.timers.tick(10000);await flushIdle();f.jobs[0].options.onReceipt({state:'presented'});
  assert.equal(f.jobs.length,1);assert.equal(f.proofs,0);
});

test('composed output follows every presented source frame before the receipt without changing card time',async t=>{
  const {media,host}=filmFixture(t),owner=new AbortController(),events=[];
  const result=playLocalFilm({host,src:'/own-exact',signal:owner.signal,
    renderFrame:(source,metadata)=>{assert.equal(source,media[0]);events.push(['picture',metadata.mediaTime]);return true;},
    onFrame:time=>events.push(['card',time]),onReceipt:row=>events.push(['receipt',row.state])});
  media[0].emit('playing');media[0].frame(0);media[0].frame(31/24);
  assert.equal(media[0].style.visibility,'hidden');
  assert.deepEqual(events,[['receipt','start'],['picture',0],['receipt','presented'],['card',0],['picture',31/24],['card',31/24]]);
  owner.abort();await assert.rejects(result,{name:'AbortError'});assert.equal(media[0].frames.size,0);
});

test('published Linnea repeats her frozen silent idle, checks the exact package before cached playback and stops on 409',async t=>{
  const ownIdle={id:'linnea-frozen',fileName:'Linneas Grundloop',sha256:'c'.repeat(64),src:'/api/presentation/registered-idle/north/room-linnea/7/linnea',compositing:{mode:'green-screen',threshold:.23,softness:.15,despill:0}};
  const f=await controllerFixture(t,{dealerId:'linnea',ownIdle,entry:{operator:'north',roomId:'room-linnea',packageRevision:7}});
  f.controller.start();await new Promise(resolve=>setImmediate(resolve));assert.equal(f.jobs.length,1);
  assert.deepEqual(f.jobs[0].take.media,{src:ownIdle.src,sha256:ownIdle.sha256});assert.equal(f.jobs[0].options.muted,true);
  f.jobs[0].options.onReceipt({state:'presented'});f.jobs[0].resolve({completed:true});await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.jobs.length,2);assert.equal(f.jobs[1].options.muted,true);assert.equal(f.proofs,1);
  for(const request of f.requests){const url=new URL(request.url,'https://game.invalid');assert.equal(url.pathname,'/api/presentation/config');assert.deepEqual(Object.fromEntries(url.searchParams),{operatorSlug:'north',roomId:'room-linnea',packageRevision:'7',dealerId:'linnea'});assert.equal(request.options.cache,'no-store');}
  assert.equal(f.requests.length,3,'configuration plus two distinct per-play authority reads');
  f.setConfigStatus(409);f.jobs[1].resolve({completed:true});await new Promise(resolve=>setImmediate(resolve));assert.equal(f.jobs.length,2);
  assert.match(f.status.textContent,/Ladda om spelet/);const reload=f.elements.find(element=>element.textContent==='Ladda om');assert.equal(typeof reload.onclick,'function');
  const before=f.requests.length;assert.equal(await f.controller.present(source),false);f.controller.start();f.controller.state({action:false});await new Promise(resolve=>setImmediate(resolve));assert.equal(f.requests.length,before);assert.equal(f.jobs.length,2);
});

test('Linnea with empty exact positions forwards only her package context and keeps the committed card in 2D',async t=>{
  const f=await controllerFixture(t,{dealerId:'linnea',entry:{operator:'north',roomId:'room-linnea',packageRevision:7},missingPosition:true});
  assert.equal(await f.controller.present(source),false);assert.equal(f.jobs.length,0);
  const payload=JSON.parse(f.requests.find(request=>request.url==='/api/presentation/select').options.body);
  assert.deepEqual(payload.presentationContext,{operatorSlug:'north',roomId:'room-linnea',packageRevision:7,dealerId:'linnea'});
  assert.deepEqual(payload.event,source);assert.equal(payload.context,undefined);
  assert.equal(f.receipts.find(receipt=>receipt.state==='skipped').renderer,'2d');assert.equal(f.receipts.some(receipt=>receipt.state==='end'),false);
});

test('a separately saved Linnea skips each empty exact position and preserves server-owned hidden and visible cards',async()=>{
  const project=addDealer(createSeedProject(),'linnea','Linnea'),inventory=await loadVideoRegistry();
  const events=Array.from({length:7},(_,box)=>({...source,box,shoeDraw:box+1,clip:{action:box<2?'deal-left':box<5?'deal-centre':'deal-right'}}));
  for(const faceDown of [false,true])events.push({type:'deal',to:'dealer',box:null,handIndex:null,shoeDraw:events.length+1,faceDown,card:faceDown?null:{r:'Q',s:'♥'},clip:{action:'deal-dealer'}});
  const handler=createPresentationApi({db:{prepare:()=>({get:async()=>({version:2,payload:JSON.stringify(events)})})},env:{},store:{load:async()=>project},registryLoader:async()=>inventory});
  for(const event of events){const response=await presentationFixtureRequest(handler,'linnea-fixture',{dealerId:'linnea',version:2,mode:'off',event:{...event,card:{r:'A',s:'♣'}}});assert.equal(response.status,200,JSON.stringify(response.body));assert.equal(response.body.video,null);assert.equal(response.body.standard,null);assert.equal(response.body.decision.media.reason,'position_clip_missing');assert.deepEqual(response.body.decision.sourceEvent,event);}
});

test('a stale committed card does not claim a package change, while an exact package conflict latches until reload',async t=>{
  const f=await controllerFixture(t,{dealerId:'linnea',entry:{operator:'north',roomId:'room-linnea',packageRevision:7}}),fetchConfig=globalThis.fetch;
  let code=null,requests=0;
  globalThis.fetch=async(url,options)=>url==='/api/presentation/select'?(requests++,Response.json({error:'Stale presentation',...(code?{code}: {})},{status:409})):fetchConfig(url,options);
  assert.equal(await f.controller.present(source),false);assert.match(f.status.textContent,/2D-reserv/);assert.doesNotMatch(f.status.textContent,/paketet har ändrats/);
  code='studio_presentation_idle_package_changed';assert.equal(await f.controller.present(source),false);assert.match(f.status.textContent,/Ladda om spelet/);
  assert.equal(await f.controller.present(source),false);assert.equal(requests,2);
});

test('frozen event selection uses only the published own-dealer snapshot and committed card, with exact scoped URLs', async () => {
  const project = addDealer(createSeedProject(), 'linnea', 'Linnea');
  for (const line of project.lines) for (const variant of line.variants) variant.videoGenerationId = null;
  const id='00000000-0000-4000-8000-000000000093';
  project.lines.find(row=>row.dealerId==='linnea'&&row.eventId==='deal.player.centre').variants[0].videoGenerationId=id;
  const record={id,dealer:'linnea',fileName:'own-box3.mp4',sha256:'e'.repeat(64),available:true,
    classification:{dealerId:'linnea',eventId:'deal.player.centre',kind:'action',role:'standard',situation:'box3',playback:'once',label:'Linnea box3',notes:''}};
  const context={operatorSlug:'north',roomId:'room-linnea',packageRevision:9,dealerId:'linnea'};
  const frozen={project,inventory:{videos:[record],families:[]},projectRevision:'frozen-events',configurationSource:'operator-package-v3',
    lane:{openclaw:{idle:'off',deal:'random',reveal:'off',speak:'off',probe:'off'}}};
  let reads=0;const selectedModes=[];
  const handler=createPresentationApi({env:{},db:{prepare:()=>({get:async()=>({version:2,payload:JSON.stringify([source])})})},
    store:{load:async()=>{throw Error('live Studio must not be read');}},registryLoader:async()=>{throw Error('live inventory must not be read');},
    select:async(body,options)=>{selectedModes.push(body.mode);return selectPresentation(body,options);},
    frozenDealerContext:{resolve:async supplied=>{assert.deepEqual(supplied,context);reads++;return frozen;},
      publicVideo:(_frozen,mediaId)=>mediaId===id?{id,sha256:record.sha256,fileName:record.fileName,src:'/api/presentation/registered-video/north/room-linnea/9/linnea/'+id}:null}});
  const response=await presentationFixtureRequest(handler,'isolated-player',{dealerId:'linnea',version:2,mode:'off',
    event:{...source,card:{r:'K',s:'♦'}},presentationContext:context});
  assert.equal(response.status,200,JSON.stringify(response.body));
  assert.deepEqual(response.body.decision.sourceEvent,source);
  assert.equal(response.body.video.id,id);assert.equal(response.body.standard.id,id);
  assert.match(response.body.video.src,/registered-video\/north\/room-linnea\/9\/linnea\//);
  assert.equal(response.body.configurationSource,'operator-package-v3');assert.equal(reads,2);
  assert.deepEqual(selectedModes,['random','off'],'the saved composition deal mode overrides the request mode, with the exact standard as fallback');
  const absent=await presentationFixtureRequest(handler,'isolated-player',{dealerId:'linnea',version:2,mode:'off',
    event:{type:'speak',line:'goodluck'},presentationContext:context});
  assert.equal(absent.status,200);assert.equal(absent.body.video,null);assert.equal(absent.body.standard,null);
  assert.equal(absent.body.decision.media.reason,'frozen_clip_missing');
});

test('published selection modes come from the composition lane and fail closed without one', async () => {
  const { publishedSelectionMode } = await import('../services/game/shared-room-presentation-selection.mjs');
  const lane = { openclaw: { idle: 'rules', deal: 'random', reveal: 'off', speak: 'active', probe: 'off' } };
  assert.equal(publishedSelectionMode(lane, { type: 'deal' }, 'active'), 'random');
  assert.equal(publishedSelectionMode(lane, { type: 'speak' }, 'off'), 'active');
  assert.equal(publishedSelectionMode(lane, { type: 'reveal' }, 'active'), 'off');
  assert.equal(publishedSelectionMode(lane, { type: 'turn' }, 'active'), 'rules', 'turn and settle are idle conditions');
  assert.equal(publishedSelectionMode({ openclaw: { deal: 'bogus' } }, { type: 'deal' }, 'active'), 'active', 'the caller decides the fallback');
  assert.equal(publishedSelectionMode({ openclaw: { deal: 'bogus' } }, { type: 'deal' }), 'off');
  assert.equal(publishedSelectionMode(undefined, { type: 'deal' }), 'off');
  assert.equal(publishedSelectionMode(null, { type: 'idle' }), 'off');
});

test('idle advice for a published room is refused when the composition keeps OpenClaw off for idle', async () => {
  const project = addDealer(directorProject(), 'linnea', 'Linnea');
  const context = { operatorSlug: 'north', roomId: 'room-linnea', packageRevision: 7, dealerId: 'linnea' };
  let advised = 0;
  const handler = createPresentationApi({ env: {}, store: { load: async () => { throw Error('live Studio must not be read'); } },
    registryLoader: async () => { advised++; return { videos: [], families: [] }; },
    frozenDealerContext: { resolve: async () => ({ project, inventory: { videos: [], families: [] }, idleInventory: { videos: [], families: [] }, context,
      projectRevision: 'frozen-idle', configurationSource: 'operator-package-v3', lane: { openclaw: { idle: 'off', deal: 'active', reveal: 'off', speak: 'off', probe: 'off' } } }), publicVideo: () => null } });
  const response = await presentationFixtureRequest(handler, 'fixture', { requestId: 'advice-1', dealerId: 'linnea', mode: 'active', version: 2, project: {},
    sourceRef: {}, observedChat: {}, presentationContext: context }, '/api/presentation/idle-advice');
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.deepEqual(response.body, { videoId: null, provider: 'idle_openclaw_off', projectRevision: 'frozen-idle' });
  assert.equal(advised, 0, 'no adviser or registry work for a room that keeps OpenClaw off');
});

test('an own dealer with only idle resumes that same film behind a missing card-position animation', async t=>{
  const ownIdle={id:'own-idle',fileName:'Linnea',sha256:'f'.repeat(64),src:'/frozen-idle'};
  const f=await controllerFixture(t,{dealerId:'linnea',ownIdle,missingPosition:true});
  f.controller.start();assert.equal(f.jobs.length,1);
  f.controller.state({action:true});assert.equal(f.jobs[0].options.signal.aborted,true);
  assert.equal(await f.controller.present(source),false);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.jobs.length,2);assert.equal(f.jobs[1].take.media.src,ownIdle.src);assert.equal(f.jobs[1].options.muted,true);
  f.jobs[1].resolve();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.jobs.length,3,'own idle continues even while the 2D card action is in progress');
  f.controller.state({action:false});await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.jobs[2].options.signal.aborted,true);
  assert.equal(f.jobs[3].take.media.src,ownIdle.src);
});

test('published own idle policy uses the same automatic scheduler, returns to base and interrupts on a game action', async t => {
  let now=0;t.mock.method(performance,'now',()=>now);
  const base='00000000-0000-4000-8000-000000000081', alt='00000000-0000-4000-8000-000000000082', familyId='linnea/idle.ready/ready';
  const idlePolicy={schemaVersion:1,familyId,base:[{videoId:base,weight:100,durationMs:1000}],
    variants:[{videoId:alt,durationMs:1000,use:'automatic',automatic:{averageEveryMs:5000,jitterMs:0,cooldownMs:5000,maxPerMinute:12}}]};
  const videos=[base,alt].map((id,i)=>({id,dealer:'linnea',familyId,role:i?'variant':'standard',available:true,fileName:id+'.mp4',sha256:(i?'b':'a').repeat(64),src:'/frozen/'+id}));
  const customInventory={videos,families:[{id:familyId,dealerId:'linnea',playbackType:'idle-pool',standardIds:[base],variantIds:[alt]}]};
  const green={mode:'green-screen',threshold:.23,softness:.15,despill:0},alpha={mode:'alpha'},compositionCalls=[];
  for(const video of videos)video.classification={compositing:green};videos[0].compositing=alpha;
  const f=await controllerFixture(t,{dealerId:'linnea',ownIdle:videos[0],idlePolicy,customInventory,
    composition:{prepareClip:async value=>compositionCalls.push(value),hold(){},renderFrame(){return true;}}});
  f.controller.start();await new Promise(resolve=>setImmediate(resolve));assert.equal(f.jobs[0].take.media.src,videos[0].src);
  f.jobs[0].options.onReceipt({state:'start'});f.jobs[0].options.onReceipt({state:'presented'});
  now=6000;f.jobs[0].resolve();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.jobs[1].take.media.src,videos[1].src);
  f.jobs[1].options.onReceipt({state:'start'});f.jobs[1].options.onReceipt({state:'presented'});
  f.jobs[1].resolve();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.jobs[2].take.media.src,videos[0].src);
  assert.deepEqual(compositionCalls,[alpha,green,alpha],'raw local metadata and frozen top-level settings share the compositor');
  f.controller.state({action:true});assert.equal(f.jobs[2].options.signal.aborted,true);
});

test('own OpenClaw idle advice forwards the exact package context and plays only an offered frozen variant',async t=>{
  const base='00000000-0000-4000-8000-000000000083',alt='00000000-0000-4000-8000-000000000084',familyId='linnea/idle.ready/ready';
  const idlePolicy={schemaVersion:1,familyId,base:[{videoId:base,weight:100,durationMs:1000}],
    variants:[{videoId:alt,durationMs:1000,use:'openclaw',automatic:null}]};
  const videos=[base,alt].map((id,i)=>({id,dealer:'linnea',familyId,role:i?'variant':'standard',available:true,fileName:id+'.mp4',sha256:(i?'d':'c').repeat(64),src:'/frozen/'+id}));
  const customInventory={videos,families:[{id:familyId,dealerId:'linnea',playbackType:'idle-pool',standardIds:[base],variantIds:[alt]}]};
  // A published room takes OpenClaw idle advice from the composition's saved idle mode, never from a client default.
  const f=await controllerFixture(t,{dealerId:'linnea',ownIdle:videos[0],idlePolicy,customInventory,defaultMode:'off',
    openclaw:{idle:'active',deal:'off',reveal:'off',speak:'off',probe:'off'},
    entry:{operator:'north',roomId:'room-linnea',packageRevision:7}});
  const original=globalThis.fetch;let adviceBody;
  globalThis.fetch=async(url,options)=>url==='/api/presentation/idle-advice'
    ? (adviceBody=JSON.parse(options.body),Response.json({videoId:alt})):original(url,options);
  f.controller.start();await new Promise(resolve=>setImmediate(resolve));
  f.jobs[0].options.onReceipt({state:'start'});f.jobs[0].options.onReceipt({state:'presented'});
  await f.controller.observeChat('Hej Linnea');
  assert.deepEqual(adviceBody.presentationContext,{operatorSlug:'north',roomId:'room-linnea',packageRevision:7,dealerId:'linnea'});
  f.jobs[0].resolve();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.jobs[1].take.media.src,videos[1].src);assert.equal(f.jobs[1].options.muted,true);
});

test('published own idle policy stops and offers reload after the package changes',async t=>{
  const id='00000000-0000-4000-8000-000000000093',familyId='linnea/idle.ready/ready';
  const idlePolicy={schemaVersion:1,familyId,base:[{videoId:id,weight:100,durationMs:1000}],variants:[]};
  const ownIdle={id,dealer:'linnea',familyId,role:'standard',available:true,fileName:id+'.mp4',sha256:'c'.repeat(64),src:'/frozen/'+id};
  const customInventory={videos:[ownIdle],families:[{id:familyId,dealerId:'linnea',playbackType:'idle-pool',standardIds:[id],variantIds:[]}]};
  const f=await controllerFixture(t,{dealerId:'linnea',ownIdle,idlePolicy,customInventory,entry:{operator:'north',roomId:'room-linnea',packageRevision:7}});
  f.controller.start();await new Promise(resolve=>setImmediate(resolve));assert.equal(f.jobs.length,1);
  f.jobs[0].options.onReceipt({state:'start'});f.jobs[0].options.onReceipt({state:'presented'});
  f.setConfigStatus(409);f.jobs[0].resolve();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.jobs.length,1);assert.match(f.status.textContent,/Ladda om spelet/);
  const before=f.requests.length;f.controller.start();f.controller.state({action:false});
  assert.equal(await f.controller.present(source),false);await new Promise(resolve=>setImmediate(resolve));assert.equal(f.requests.length,before);
});

test('own idle advice binds cached decisions and director rereads to each current frozen room',async()=>{
  const project=addDealer(createSeedProject(),'linnea','Linnea'),at=new Date().toISOString();
  const base='00000000-0000-4000-8000-000000000094',alt='00000000-0000-4000-8000-000000000095',familyId='linnea/idle.ready/ready';
  project.lines.find(line=>line.dealerId==='linnea'&&line.eventId==='idle.ready').variants[0].videoGenerationId=base;
  project.dealerIdlePolicies=[{dealerId:'linnea',policy:{schemaVersion:1,familyId,base:[{videoId:base,weight:100,durationMs:1000}],variants:[{videoId:alt,durationMs:1000,use:'openclaw',automatic:null}]}}];
  const idleInventory={videos:[base,alt].map((id,i)=>({id,dealer:'linnea',familyId,role:i?'variant':'standard',available:true,fileName:id+'.webm',sha256:'a'.repeat(64)})),
    families:[{id:familyId,dealerId:'linnea',eventId:'idle.ready',situation:'ready',playbackType:'idle-pool',standardIds:[base],variantIds:[alt]}]};
  let calls=0,reads=0,revoked=false;
  const handler=createPresentationApi({env:{CROUPIER_PRESENTATION_DIRECTOR_URL:'https://own-qa.invalid',CROUPIER_PRESENTATION_DIRECTOR_TOKEN:'fixture-token'},
    store:{load:async()=>{throw Error('live project must not be read');}},registryLoader:async()=>{throw Error('live registry must not be read');},
    frozenDealerContext:{resolve:async context=>{reads++;if(revoked)throw Object.assign(Error('republished'),{statusCode:409,code:'studio_presentation_idle_package_changed'});
      return {project:structuredClone(project),context,idleInventory,configurationSource:'operator-package-v3',lane:{openclaw:{idle:'active',deal:'off',reveal:'off',speak:'off',probe:'off'}}};}},
    directorFetchFactory:async context=>{
      assert.deepEqual(await context.readProject(),context.project);
      const owned=async (_url,options)=>{calls++;const projected=JSON.parse(options.body);
        return Response.json({advice:{requestId:projected.input.requestId,catalogRevision:projected.catalog.revision,variantId:null},
          provider:{status:'responded',contextContractVersion:2,observedChatMessages:projected.input.context.observedChat.messages.length}});};
      owned.cacheScope='e'.repeat(64);return owned;
    }});
  const payload={requestId:'same-frozen-advice',dealerId:'linnea',mode:'active',
    sourceRef:{kind:'renderer-idle',channel:'same-channel',revision:1,messageId:'same-message',at},
    observedChat:{source:'native-observation',before:at,messages:[{role:'user',text:'Hello',at}]}};
  const request=room=>presentationFixtureRequest(handler,'one',{...payload,presentationContext:{operatorSlug:'north',roomId:room,packageRevision:7,dealerId:'linnea'}},'/api/presentation/idle-advice');
  assert.equal((await request('room-one')).body.provider,'responded');
  assert.equal((await request('room-two')).body.provider,'responded');assert.equal(calls,2);
  assert.equal((await request('room-one')).status,200);assert.equal(calls,2);assert.equal(reads,6);
  revoked=true;assert.equal((await request('room-one')).status,409);assert.equal(calls,2);
});

test('frozen events use owned Director transport and revalidate the package after selection',async()=>{
  const project=addDealer(directorProject(),'linnea','Linnea');
  const context={operatorSlug:'north',roomId:'room-linnea',packageRevision:7,dealerId:'linnea'};
  const owned=async()=>Response.json({});
  for(const phase of ['valid','revoked-owner','republished']){
    let valid=true,selected=0,readbacks=0;
    const handler=createPresentationApi({env:{},db:{prepare:()=>({get:async()=>({version:2,payload:JSON.stringify([source])})})},
      store:{load:async()=>assert.fail('live policy forbidden')},registryLoader:async()=>assert.fail('live media forbidden'),
      frozenDealerContext:{resolve:async supplied=>{assert.deepEqual(supplied,context);
        if(!valid)throw Object.assign(Error('package changed'),{statusCode:409,code:'studio_presentation_idle_package_changed'});
        return {project,inventory:{videos:[],families:[]},context,projectRevision:'frozen',configurationSource:'operator-package-v3'};},publicVideo:()=>null},
      directorFetchFactory:async args=>{assert.equal(args.playerId,'fixture');assert.equal(args.signal.aborted,false);
        if(phase==='revoked-owner')throw Object.assign(Error('owner revoked'),{statusCode:401});
        assert.deepEqual(await args.readProject(),project);readbacks++;return owned;},
      select:async(body,options)=>{selected++;assert.equal(options.fetchImpl,owned);assert.deepEqual(body.sourceEvent,source);
        if(phase==='republished')valid=false;
        return {videoGenerationId:null,decision:{requestId:body.requestId,sourceEvent:body.sourceEvent}};}});
    const response=await presentationFixtureRequest(handler,'fixture',{dealerId:'linnea',mode:'active',version:2,event:source,presentationContext:context});
    assert.equal(response.status,phase==='valid'?200:phase==='revoked-owner'?401:409);
    assert.equal(selected,phase==='revoked-owner'?0:1);assert.equal(readbacks,phase==='revoked-owner'?0:1);
  }
});

test('a frozen event rechecks package authority even when its video could be cached',async t=>{
  const f=await controllerFixture(t,{dealerId:'linnea',entry:{operator:'north',roomId:'room-linnea',packageRevision:7}});
  f.setConfigStatus(409);
  assert.equal(await f.controller.present(source),false);assert.equal(f.jobs.length,0);
  assert.match(f.status.textContent,/Ladda om spelet/);
});

test('configuration requires explicit identity and each dealer uses only its saved idle policy',async()=>{
  const project=addDealer(createSeedProject(),'linnea','Linnea'),id='00000000-0000-4000-8000-000000000096';
  project.lines.find(row=>row.dealerId==='linnea'&&row.eventId==='idle.ready').variants[0].videoGenerationId=id;
  const policy={schemaVersion:1,familyId:'linnea/idle.ready/ready',base:[{videoId:id,weight:100,durationMs:1000}],variants:[]};
  project.dealerIdlePolicies=[{dealerId:'linnea',policy}];
  const inventory={families:[],videos:[{id,dealer:'linnea',available:true,sha256:'c'.repeat(64),fileName:id+'.mp4',
    classification:{dealerId:'linnea',eventId:'idle.ready',kind:'idle',role:'standard',situation:'',playback:'once',label:'Grundloop',notes:''}}]};
  const handler=createPresentationApi({env:{},store:{load:async()=>project},registryLoader:async()=>inventory});
  async function get(query){
    const req=Readable.from([]);req.method='GET';req.url='/api/presentation/config'+query;req.headers={};
    const res={writeHead(status){this.status=status;},end(raw){this.body=JSON.parse(raw);}};
    await handler(req,res,'/api/presentation/config','fixture');return res;
  }
  const own=await get('?dealerId=linnea');assert.equal(own.status,200);assert.deepEqual(own.body.idlePolicy,policy);
  assert.equal(own.body.idleInventory.families[0].dealerId,'linnea');assert.equal(own.body.idleInventory.videos[0].id,id);
  assert.equal((await get('')).status,400);
  const astridLine=project.lines.find(row=>row.dealerId==='astrid'&&row.eventId==='idle.ready');
  astridLine.variants.find(row=>row.id===astridLine.baselineVariantId).videoGenerationId=project.idlePolicy.base[0].videoId;
  assert.deepEqual((await get('?dealerId=astrid')).body.idlePolicy,project.idlePolicy,'Astrid exposes its saved global policy');
  assert.equal((await get('?dealerId=unknown')).status,400);
  assert.equal((await get('?dealerId=linnea&dealerId=linnea')).status,400);
});

test('saved idle rules cross the API with committed event and exact package ownership',async()=>{
  const project=addDealer(directorProject(),'linnea','Linnea'),base='00000000-0000-4000-8000-000000000097',alt='00000000-0000-4000-8000-000000000098';
  const line=project.lines.find(row=>row.dealerId==='linnea'&&row.eventId==='idle.ready');
  line.variants[0].videoGenerationId=base;
  line.variants.push({...structuredClone(line.variants[0]),id:'linnea.idle.ready.rule',videoGenerationId:alt,priority:50,triggerIds:['fixture.box3'],selection:{rules:true,model:false,random:false}});
  project.triggers.push({id:'fixture.box3',label:'Plats tre',category:'deterministic',path:'event.box',op:'eq',value:3});
  project.dealerIdlePolicies=[{dealerId:'linnea',policy:{schemaVersion:1,familyId:'linnea/idle.ready/ready',base:[{videoId:base,weight:100,durationMs:1000}],variants:[{videoId:alt,durationMs:1000,use:'rules',automatic:null}]}}];
  const inventory={families:[],videos:[base,alt].map((id,i)=>({id,dealer:'linnea',available:true,sha256:'a'.repeat(64),fileName:id+'.mp4',
    classification:{dealerId:'linnea',eventId:'idle.ready',kind:'idle',role:i?'alternative':'standard',situation:'',label:'Egen',notes:''}}))};
  const context={operatorSlug:'north',roomId:'room-linnea',packageRevision:7,dealerId:'linnea'};
  let published=source;
  const handler=createPresentationApi({env:{},db:{prepare:()=>({get:async()=>({version:2,payload:JSON.stringify([source])})})},
    frozenDealerContext:{resolve:async()=>({project,inventory,context,configurationSource:'operator-package-v3',lane:{openclaw:{idle:'rules',deal:'off',reveal:'off',speak:'off',probe:'off'}}}),publicVideo:()=>null}});
  const response=await presentationFixtureRequest(handler,'fixture',{dealerId:'linnea',mode:'rules',version:2,event:source,presentationContext:context});
  assert.equal(response.status,200,JSON.stringify(response.body));assert.equal(response.body.idleRule.videoId,alt);
  assert.equal(response.body.idleRule.requestId,response.body.decision.requestId);assert.equal(response.body.idleRule.version,2);
  assert.deepEqual(response.body.idleRule.presentationContext,context);
  assert.ok(Date.parse(response.body.idleRule.expiresAt)>Date.now());
  for(const frozen of [false,true])for(const type of ['turn','settle']){
    published=type==='turn'?{type,box:3,handIndex:1,legalActions:['stand']}
      :{type,dealerTotal:19,dealerBlackjack:false,hands:[{box:3,outcome:'win'}]};
    Object.assign(project.triggers.find(row=>row.id==='fixture.box3'),type==='turn'
      ?{path:'event.box',op:'eq',value:3}:{path:'event.hands.outcome',op:'includes',value:'win'});
    const api=createPresentationApi({env:{},store:{load:async()=>project},registryLoader:async()=>inventory,
      db:{prepare:()=>({get:async()=>({version:2,payload:JSON.stringify([published])})})},
      ...(frozen?{frozenDealerContext:{resolve:async()=>({project,inventory,context,configurationSource:'operator-package-v3',lane:{openclaw:{idle:'rules',deal:'off',reveal:'off',speak:'off',probe:'off'}}}),publicVideo:()=>null}}:{})});
    const body={dealerId:'linnea',mode:'rules',version:2,event:{...published,dealerTotal:99,hands:[{box:3,outcome:'lose'}]},...(frozen?{presentationContext:context}:{})};
    const observed=await presentationFixtureRequest(api,'fixture',body);
    assert.equal(observed.status,200,JSON.stringify(observed.body));assert.equal(observed.body.idleRule.videoId,alt);
    assert.deepEqual(observed.body.decision.sourceEvent,published,'client cannot change the public turn or result');
    assert.equal(observed.body.video,null,'the event is not a second media destination');
    assert.equal((await presentationFixtureRequest(api,'fixture',{...body,version:1})).status,409);
    assert.equal((await presentationFixtureRequest(api,'fixture',{...body,event:{type:type==='turn'?'settle':'turn',box:3,handIndex:1}})).status,409);
  }
});

for(const eventType of ['deal','turn','settle']) for(const cancel of [false,true,'next-round']) for(const collected of [false,true]) for(const delayed of [false,true]) test('own idle rule waits for action and base boundary; '+eventType+' cancelled='+cancel+' collected='+collected+' delayed='+delayed,async t=>{
    const base='00000000-0000-4000-8000-000000000097',alt='00000000-0000-4000-8000-000000000098',familyId='linnea/idle.ready/ready';
    const policy={schemaVersion:1,familyId,base:[{videoId:base,weight:100,durationMs:1000}],variants:[{videoId:alt,durationMs:1000,use:'rules',automatic:null}]};
    const videos=[base,alt].map((id,i)=>({id,dealer:'linnea',available:true,role:i?'variant':'standard',familyId,fileName:id+'.mp4',sha256:'c'.repeat(64),src:'/frozen/'+id}));
    const inventory={videos,families:[{id:familyId,dealerId:'linnea',eventId:'idle.ready',situation:'ready',playbackType:'idle-pool',standardIds:[base],variantIds:[alt]}]};
    const f=await controllerFixture(t,{dealerId:'linnea',ownIdle:videos[0],idlePolicy:policy,customInventory:inventory,missingPosition:true});
    const original=globalThis.fetch;let release,observing;
    const responseReady=delayed&&eventType!=='deal'?new Promise(resolve=>{release=resolve;}):Promise.resolve();
    globalThis.fetch=async(url,options)=>{
      const response=await original(url,options);if(url!=='/api/presentation/select')return response;
      const result=await response.json(),body=JSON.parse(options.body);await responseReady;
      return Response.json({...result,idleRule:{videoId:alt,requestId:result.decision.requestId,mode:'rules',version:body.version,presentationContext:null,expiresAt:new Date(Date.now()+30000).toISOString()}});
    };
    const control=f.elements.find(row=>row.className==='local-presentation-mode');control.value='rules';control.onchange();
    f.controller.state({action:true});
    if(eventType==='deal')assert.equal(await f.controller.present(source),false);
    else {
      const events=[{type:eventType,box:3,handIndex:0}];
      observing=f.controller.observeEvents(events);
      if(!delayed){await observing;const requests=f.requests.length;await f.controller.observeEvents(events);assert.equal(f.requests.length,requests,'one observation per committed event');}
    }
    if(collected){
      if(eventType==='settle'){f.controller.state({action:false});f.controller.state({action:true});}
      f.controller.state({action:true,command:'collect'});f.setVersion(3);
      await f.controller.observeEvents([{type:'speak',line:'placebets'},{type:'idle'}],{command:'collect',previousVersion:2});
    }
    if(cancel===true){control.value='off';control.onchange();}
    if(cancel==='next-round'){f.controller.state({action:true,command:'start'});f.setVersion(4);}
    release?.();await observing;
    f.controller.state({action:false});await new Promise(resolve=>setImmediate(resolve));
    const current=f.jobs.at(-1);assert.equal(current.take.media.src,videos[0].src);
    current.options.onReceipt({state:'start'});current.options.onReceipt({state:'presented'});current.resolve();
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(f.jobs.at(-1).take.media.src,videos[cancel||collected&&eventType!=='settle'||!collected&&eventType==='settle'?0:1].src);
    f.controller.close();globalThis.fetch=original;
});


test('film selection binds card tracking only after clip framing is prepared', async t => {
  const order=[];let release;
  const ready=new Promise(resolve=>{release=resolve;});
  const composition={prepareClip:async()=>{order.push('preparing');await ready;order.push('prepared');},renderFrame:()=>true,hold(){}};
  const f=await controllerFixture(t,{composition});
  const playing=f.controller.present(source,{onSelected:()=>order.push('selected')});
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(order,['preparing']);assert.equal(f.jobs.length,0);
  release();await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(order,['preparing','prepared','selected']);assert.equal(f.jobs.length,1);
  f.jobs[0].resolve();assert.equal(await playing,true);
});

test('cancelled clip preparation cannot select a track or start media', async t => {
  let release,selected=0;const ready=new Promise(resolve=>{release=resolve;});
  const composition={prepareClip:async()=>ready,renderFrame:()=>true,hold(){}};
  const f=await controllerFixture(t,{composition}),abort=new AbortController();
  const playing=f.controller.present(source,{signal:abort.signal,onSelected:()=>selected++});
  await new Promise(resolve=>setImmediate(resolve));abort.abort();release();
  assert.equal(await playing,false);assert.equal(selected,0);assert.equal(f.jobs.length,0);
});

test('new unreviewed speech metadata never reaches the live media player', async t => {
  const f=await controllerFixture(t,{selectedVideo:{id:'unreviewed',sha256:'a'.repeat(64),recordedSpeech:{review:{status:'pending'}}}});
  assert.equal(await f.controller.present({type:'speak',line:'goodluck'}),false);
  assert.equal(f.jobs.length,0);assert.match(f.status.textContent,/granskning eller identitet/);
});


for(const late of ['response','json'])test('aborted rule observation cannot offer stale idle after '+late,async t=>{
  const base='00000000-0000-4000-8000-000000000097',alt='00000000-0000-4000-8000-000000000098',familyId='linnea/idle.ready/ready';
  const policy={schemaVersion:1,familyId,base:[{videoId:base,weight:100,durationMs:1000}],variants:[{videoId:alt,durationMs:1000,use:'rules',automatic:null}]};
  const videos=[base,alt].map((id,i)=>({id,dealer:'linnea',available:true,role:i?'variant':'standard',familyId,fileName:id+'.mp4',sha256:'c'.repeat(64),src:'/frozen/'+id}));
  const inventory={videos,families:[{id:familyId,dealerId:'linnea',eventId:'idle.ready',situation:'ready',playbackType:'idle-pool',standardIds:[base],variantIds:[alt]}]};
  const f=await controllerFixture(t,{dealerId:'linnea',ownIdle:videos[0],idlePolicy:policy,customInventory:inventory,missingPosition:true});
  const original=globalThis.fetch,connection=new AbortController();let release,entered;
  const gate=new Promise(resolve=>{release=resolve;}),started=new Promise(resolve=>{entered=resolve;});
  globalThis.fetch=async(url,options)=>{
    const response=await original(url,options);if(url!=='/api/presentation/select')return response;
    assert.equal(options.signal,connection.signal);
    const result=await response.json(),body=JSON.parse(options.body);
    const value={...result,idleRule:{videoId:alt,requestId:result.decision.requestId,mode:'rules',version:body.version,presentationContext:null,expiresAt:new Date(Date.now()+30000).toISOString()}};
    if(late==='response'){entered();await gate;return Response.json(value);}
    return{ok:true,json:async()=>{entered();await gate;return value;}};
  };
  const control=f.elements.find(row=>row.className==='local-presentation-mode');control.value='rules';control.onchange();
  f.controller.state({action:true});const observing=f.controller.observeEvents([{type:'turn',box:3,handIndex:0}],{signal:connection.signal});
  await started;connection.abort();release();await observing;f.controller.state({action:false});await new Promise(resolve=>setImmediate(resolve));
  const current=f.jobs.at(-1);current.options.onReceipt({state:'start'});current.options.onReceipt({state:'presented'});current.resolve();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.jobs.at(-1).take.media.src,videos[0].src,'cancelled optional rule never replaces the saved baseline');
  f.controller.close();globalThis.fetch=original;
});


test('shared media progress covers long before and after transitions without moving the main card cursor',async t=>{
  const before={id:'to-long',sha256:'1'.repeat(64),fileName:'to-long.mp4'},after={id:'from-long',sha256:'2'.repeat(64),fileName:'from-long.mp4'};
  let ports;t.after(()=>ports?.close());
  const f=await controllerFixture(t,{transitions:{before,after}});t.mock.timers.enable({apis:['setTimeout','Date'],now:1000});
  const progress=[],frames=[],selections=[];
  const media={...f.controller,present:(event,options)=>f.controller.present(event,{...options,onProgress:value=>{progress.push(value);options.onProgress?.(value);}})};
  const cards={restore(){},sync(){},clear(){},show(){},reveal(){},close(){},begin(video){selections.push(video.id);return 1;},frame(_token,time){frames.push(time);},finish(){}};
  ports=createSharedRoomPresentationPorts({media,cards,clock:Date.now});
  const connection=new AbortController(),state={roomId:'long-transitions',roundId:'round-a',round:null,presentationVer:1,players:[],me:{id:'alice'},serverNow:1000};
  ports.restoreSnapshot(state,{signal:connection.signal});ports.restoreSnapshot({...state,presentationVer:2},{signal:connection.signal});
  const jobStart=f.jobs.length; // Snapshot restoration may have started an idle that present() cancels.
  const result=ports.present({roomId:state.roomId,ver:2,talkId:'long-transition-plan',kind:'plan',endAt:300000,events:[source]},{signal:connection.signal});result.catch(()=>{});
  await new Promise(resolve=>setImmediate(resolve));
  for(let second=5;second<=45;second+=5){t.mock.timers.tick(5000);f.jobs[jobStart].options.onFrame?.(second);await new Promise(resolve=>setImmediate(resolve));assert.equal(f.jobs[jobStart].options.signal.aborted,false,'a progressing before transition stays live');}
  assert.deepEqual(selections,[]);assert.deepEqual(frames,[]);f.jobs[jobStart].resolve();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.jobs.length,jobStart+2);f.jobs[jobStart+1].options.onFrame(.4);assert.deepEqual(frames,[.4]);assert.equal(selections.length,1);
  f.jobs[jobStart+1].resolve();await new Promise(resolve=>setImmediate(resolve));assert.equal(f.jobs.length,jobStart+3);
  for(let second=5;second<=45;second+=5){t.mock.timers.tick(5000);f.jobs[jobStart+2].options.onFrame?.(second);await new Promise(resolve=>setImmediate(resolve));assert.equal(f.jobs[jobStart+2].options.signal.aborted,false,'a progressing after transition stays live');}
  assert.deepEqual(frames,[.4]);assert.equal(selections.length,1);f.jobs[jobStart+2].resolve();await result;
  assert.deepEqual([...new Set(progress.map(row=>row.clip))],[1,2,3]);
  for(const clip of [1,2,3])assert.deepEqual(progress.filter(row=>row.clip===clip&&row.phase!=='frame').map(row=>row.phase),['prepare','play','complete']);
});


test('repeated frozen transition frames cannot renew shared playback liveness or reach the card film',async t=>{
  const before={id:'frozen-before',sha256:'1'.repeat(64),fileName:'frozen-before.mp4'};
  let ports;t.after(()=>ports?.close());
  const f=await controllerFixture(t,{transitions:{before}});t.mock.timers.enable({apis:['setTimeout','Date'],now:1000});
  const cards=Object.fromEntries(['restore','sync','clear','show','reveal','close'].map(key=>[key,()=>{}]));
  ports=createSharedRoomPresentationPorts({media:f.controller,cards,clock:Date.now});
  const signal=new AbortController().signal,state={roomId:'frozen-transition',roundId:'round-a',round:null,presentationVer:1,players:[],me:{id:'alice'},serverNow:1000};
  ports.restoreSnapshot(state,{signal});ports.restoreSnapshot({...state,presentationVer:2},{signal});
  const jobStart=f.jobs.length;
  const pending=assert.rejects(ports.present({roomId:state.roomId,ver:2,talkId:'frozen-plan',kind:'plan',endAt:300000,events:[source]},{signal}),error=>error.rendererTimeout===true);
  await new Promise(resolve=>setImmediate(resolve));f.jobs[jobStart].options.onFrame(0);
  for(let i=0;i<5;i++){t.mock.timers.tick(5000);f.jobs[jobStart].options.onFrame(0);await new Promise(resolve=>setImmediate(resolve));assert.equal(f.jobs.length,jobStart+1);}
  t.mock.timers.tick(5000);await pending;assert.equal(f.jobs[jobStart].options.signal.aborted,true);assert.equal(f.jobs.length,jobStart+1);
});


// Kevin's timed playback in the film player (K public/app.js:180-246 @ 5aa7ed10).
test('a timed film hands over on its last frames and holds the frame instead of waiting for ended', async t => {
  const { media, host } = filmFixture(t); const receipts = []; let held = 0, complete = false;
  const finished = playLocalFilm({ host, src: '/timed', handoverAt: 2.6875, onReceipt: r => receipts.push(r), hold() { held++; } }).then(() => { complete = true; });
  const video = media[0]; video.emit('playing'); video.frame(0); video.frame(2.6); await Promise.resolve();
  assert.equal(complete, false); assert.equal(video.frames.size, 1, 'frames keep coming for the handover without onFrame');
  video.frame(2.6875); await finished;
  assert.deepEqual(receipts.map(r => [r.state, r.handover ?? false]), [['start', false], ['presented', false], ['end', true]]);
  assert.equal(held, 1); assert.equal(video.removed, true); assert.equal(video.ended, false);
});

test('a step reached late seeks into phase before play, plays at the fitted rate and follows the table clock', async t => {
  const { media, host } = filmFixture(t); let clock = 0;
  const result = playLocalFilm({ host, src: '/late', startOffset: .4, playbackRate: 1.25, clockTime: () => clock, onFrame() {} });
  const video = media[0];
  assert.equal(video.playbackRate, 1.25); assert.equal(video.currentTime, 0, 'no metadata yet: the seek waits for it');
  video.duration = 2.75; video.emit('loadedmetadata'); assert.equal(video.currentTime, .4);
  video.emit('playing'); clock = .5; video.frame(.4); assert.equal(video.currentTime, .4, 'drift under 0.4 s is left alone');
  clock = 1.5; video.frame(.6); assert.equal(video.currentTime, 1.5, 'catches up after buffering (K app.js:184)');
  clock = 2.74; video.frame(2.5); assert.equal(video.currentTime, 1.5, 'a 0.24 s drift is tolerated');
  clock = 3; video.frame(2.6); const outcome = await result;
  assert.deepEqual(outcome, { completed: true }); assert.equal(video.ended, false, 'the step ended on the table clock, not on the media');
  const prepared = new Video(); prepared.readyState = 1; prepared.duration = 1; const capped = [];
  const second = playLocalFilm({ host, src: '/capped', video: prepared, startOffset: 5, onReceipt: r => capped.push(r.state) });
  assert.ok(Math.abs(prepared.currentTime - .96) < 1e-9, 'never into the last 0.04 s (K video-preloader.js:19)');
  prepared.emit('playing'); prepared.frame(.97); prepared.ended = true; prepared.emit('ended'); await second;
  assert.deepEqual(capped, ['start', 'presented', 'end']);
  const plain = playLocalFilm({ host, src: '/plain', onReceipt() {} }); const untouched = media.at(-1);
  assert.equal(untouched.playbackRate, 1); assert.equal(untouched.currentTime, 0); assert.equal(untouched.frames.size, 1);
  untouched.emit('playing'); untouched.frame(); assert.equal(untouched.frames.size, 0, 'without timing the frame loop still stops after the first frame');
  untouched.ended = true; untouched.emit('ended'); await plain;
});

test('shared step timing reaches the exact take only: shoe clips play whole and the fallback standard is untimed', async t => {
  const before={id:'to',sha256:'1'.repeat(64),fileName:'to.mp4'},clockTime=()=>0;
  const withShoe=await controllerFixture(t,{transitions:{before}});
  const first=withShoe.controller.present(source,{startOffset:.4,handoverAt:2.6,playbackRate:1.2,clockTime});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(withShoe.jobs[0].take.media.sha256,before.sha256);
  for(const key of ['startOffset','handoverAt','playbackRate','clockTime'])assert.equal(withShoe.jobs[0].options[key],undefined,`${key} is not for the shoe clip`);
  withShoe.jobs[0].options.onReceipt({state:'end'});withShoe.jobs[0].resolve();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(withShoe.jobs[1].options.handoverAt,2.6);assert.equal(withShoe.jobs[1].options.playbackRate,1.2);
  assert.equal(withShoe.jobs[1].options.startOffset,undefined,'a shoe clip already played before the take: no seek into it');assert.equal(withShoe.jobs[1].options.clockTime,undefined);
  withShoe.jobs[1].resolve();assert.equal(await first,true);
});

test('shared step timing is dropped for the fallback standard, which has its own length', async t => {
  const clockTime=()=>0,inventory=await loadVideoRegistry(),standard=inventory.videos.find(video=>video.fileName==='deal_pos1.mp4');
  const plain=await controllerFixture(t,{standardVideo:standard});
  const second=plain.controller.present(source,{startOffset:.4,handoverAt:2.6,clockTime});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(plain.jobs[0].options.startOffset,.4);assert.equal(plain.jobs[0].options.handoverAt,2.6);assert.equal(plain.jobs[0].options.clockTime,clockTime);
  assert.equal(plain.jobs[0].options.playbackRate,undefined);
  plain.jobs[0].reject(new Error('decode'));await new Promise(resolve=>setImmediate(resolve));
  assert.equal(plain.jobs[1].take.media.sha256,standard.sha256);
  for(const key of ['startOffset','handoverAt','clockTime'])assert.equal(plain.jobs[1].options[key],undefined,`the fallback standard has its own length: no ${key}`);
  plain.jobs[1].resolve();assert.equal(await second,true);
});

test('the lookahead prepares a planned step exact take instead of the family standard', async t => {
  const inventory=await loadVideoRegistry(),prepared=[];
  const exact=inventory.videos.find(video=>video.fileName==='deal_pos1.mp4'),standard=inventory.videos.find(video=>video.fileName==='deal_pos4.mp4');
  assert.notEqual(exact.sha256,standard.sha256);
  const {controller}=await controllerFixture(t,{prepared});
  controller.prepareSequence([{...source,filmedTake:{profileId:'profile',takeKey:'4:i',sha256:exact.sha256}}]);
  assert.deepEqual(prepared.map(take=>take.media),[{src:`/api/presentation/videos/${exact.id}`,sha256:exact.sha256}]);
  controller.prepareSequence([source]);
  assert.deepEqual(prepared.map(take=>take.media.sha256),[exact.sha256,standard.sha256],'without a planned take the family standard is prepared as before');
  controller.prepareSequence([{...source,filmedTake:{sha256:'0'.repeat(64)}}]);
  assert.deepEqual(prepared.map(take=>take.media.sha256),[exact.sha256,standard.sha256,standard.sha256],'a take outside the inventory falls back to the standard');
});
