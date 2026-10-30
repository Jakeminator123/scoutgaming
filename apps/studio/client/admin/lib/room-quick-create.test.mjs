import test from 'node:test';
import assert from 'node:assert/strict';
import {addDealer,createEmptyProject,defaultPresentationLane} from '../../../../../packages/presentation/contracts/studio-model.mjs';
import {presentationCapabilitiesForVersion} from '../../../../../packages/presentation/capability-contract.mjs';
import {defaultLanguage,planEnvironment,quickCreateDefaults,roomName,runQuickCreate,stopView} from './room-quick-create.mjs';

const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const keys = () => { let n = 0; return () => uuid(++n); };
const lane = (id, dealerId, extra = {}) => { const row = defaultPresentationLane(dealerId); row.id = id; row.label = id; return {...row, ...extra}; };
function workspace() {
  let project = addDealer(addDealer(addDealer(createEmptyProject(), 'paow', 'Paow'), 'dragan', 'Dragan'), 'astrid', 'Astrid');
  const shared = lane('dragan-delad', 'dragan'); shared.dealers = ['dragan', 'astrid']; shared.layers.dealer.allowed = ['dragan', 'astrid'];
  project = {...project, revision:'p1', lanes:[lane('paow-bord', 'paow'), lane('dragan-gammal', 'dragan'), shared]};
  const room = (id, compositionId, extra = {}) => ({id, name:id, operatorId:'north', game:'blackjack', compositionId, laneId:'g', state:'live', published:true, playable:true,
    dealerIds:[], dealers:[], dealerSource:'published', playUrl:null, ...extra});
  const catalog = {source:'registered', readAt:'', administration:{revisions:{project:'p1', administration:'a1'},
    operators:[{id:'north', name:'North', slug:'north', status:'active', archivedAt:null, packageRevision:1}],
    rooms:[room('Dragan Blackjack 1', 'dragan-gammal'), room('Paow Blackjack 1', 'paow-bord'), room('old', 'dragan-gammal', {state:'archived'}), room('other', 'paow-bord', {operatorId:'south'})],
    dealers:[], compositions:project.lanes.map(row => ({id:row.id, name:row.label, dealerIds:row.layers.dealer.allowed, defaultDealerId:row.layers.dealer.default}))}};
  return {catalog, project, inventory:{videos:[]}};
}

test('standardval per fält: senast använda dealer med hela klippbanken, annars PAOW, annars första kompletta', async () => {
  const w = workspace(), base = {...w, operatorId:'north'};
  const picked = quickCreateDefaults({...base, isComplete:id => id === 'paow'});
  assert.deepEqual(picked, {game:'blackjack', dealerId:'paow', laneId:'paow-bord', language:'en', limitPreset:'prive', name:'Paow Blackjack 2'});
  // Senaste spelbordet hos bolaget har Paow; Dragan senast före det.
  w.catalog.administration.rooms.push(w.catalog.administration.rooms.shift());
  const last = quickCreateDefaults({...base, isComplete:() => true});
  assert.equal(last.dealerId, 'dragan'); assert.equal(last.laneId, 'dragan-gammal', 'miljön bolaget senast använde med dealern');
  assert.equal(last.name, 'Dragan Blackjack 2', 'N räknar bolagets öppna spelbord med samma dealer och hoppar över ett namn som finns');
  assert.equal(quickCreateDefaults({...base, isComplete:id => id === 'paow'}).dealerId, 'paow', 'ofullständig senaste dealer ger PAOW');
  const noPaow = {...w, project:{...w.project, dealers:w.project.dealers.filter(row => row.id !== 'paow')}};
  noPaow.catalog = structuredClone(w.catalog); noPaow.catalog.administration.rooms = [];
  const first = quickCreateDefaults({...noPaow, operatorId:'north', isComplete:id => id === 'astrid'});
  assert.equal(first.dealerId, 'astrid'); assert.equal(first.laneId, '', 'ingen miljö har Astrid som standard: kedjan skapar en');
  // Standardvalet kräver hela klippbanken: PAOW utan den förväljs inte, och utan komplett dealer förväljs ingen.
  assert.equal(quickCreateDefaults({...base, isComplete:id => id === 'astrid'}).dealerId, 'astrid', 'ofullständig PAOW förväljs inte');
  const none = quickCreateDefaults({...base, isComplete:() => false});
  assert.deepEqual([none.dealerId, none.name], ['', ''], 'ingen komplett dealer: inget förval (dialogen visar QUICK_CREATE_NO_DEALER)');
  assert.equal(roomName({catalog:w.catalog, operatorId:'north', dealerId:'paow', dealerLabel:'Paow', game:'roulette'}), 'Paow Roulette 1');
  const read = [];
  const gameClient = {read:async context => { read.push(context.roomId); return {published:{gameConfig:{language:'sv', limitPreset:'high'}}, draft:null}; }};
  assert.equal(await defaultLanguage({catalog:w.catalog, operatorId:'north'}, {gameClient}), 'sv');
  assert.deepEqual(read, ['Dragan Blackjack 1'], 'bolagets senaste publicerade blackjackbord');
  assert.equal(await defaultLanguage({catalog:w.catalog, operatorId:'south-utan-bord'}, {gameClient}), 'en');
  assert.equal(await defaultLanguage({catalog:w.catalog, operatorId:'north'}, {gameClient:{read:async () => { throw Error('nere'); }}}), 'en');
});

test('miljösteget: fast används, olåst låses, delad kopieras, saknad skapas, flera bakgrunder utan standard stannar', () => {
  const w = workspace(), base = {catalog:w.catalog, project:w.project, newKey:keys()};
  assert.deepEqual(planEnvironment({...base, dealerId:'paow', laneId:'paow-bord'}), {action:'use', laneId:'paow-bord', project:null});
  const locked = planEnvironment({...base, dealerId:'dragan', laneId:'dragan-delad'});
  assert.equal(locked.action, 'lock'); assert.deepEqual(locked.project.lanes.find(row => row.id === 'dragan-delad').layers.dealer.allowed, ['dragan']);
  assert.deepEqual(w.project.lanes[2].layers.dealer.allowed, ['dragan', 'astrid'], 'projektet ändras inte på plats');
  base.catalog.administration.rooms.push({...base.catalog.administration.rooms[0], compositionId:'dragan-delad', operatorId:'south'});
  const copied = planEnvironment({...base, dealerId:'dragan', laneId:'dragan-delad', roomLabel:'Dragan Blackjack 2'});
  assert.equal(copied.action, 'copy'); assert.equal(copied.laneId, 'dragan-delad-dragan-blackj-00000000-0000-4000-8000-000000000001');
  assert.equal(copied.project.lanes.length, 4); assert.deepEqual(copied.project.lanes[2], w.project.lanes[2], 'andra spelbords miljö rörs inte');
  const created = planEnvironment({...base, dealerId:'astrid', laneId:''});
  assert.equal(created.action, 'create'); assert.equal(created.project.lanes.at(-1).layers.dealer.default, 'astrid'); assert.equal(created.project.lanes.at(-1).label, 'Astrid standard');
  const image = structuredClone(w.project); image.lanes[0].layers.background = {enabled:true, mode:'image', default:null, allowed:['a', 'b']};
  assert.deepEqual(planEnvironment({...base, project:image, dealerId:'paow', laneId:'paow-bord'}), {stop:'environment_choice', laneId:'paow-bord'});
  assert.equal(planEnvironment({...base, dealerId:'paow', laneId:'dragan-gammal'}).stop, 'environment_dealer');
  // Ett annat bolags tilldelning räknas som delad även utan spelbord; bolagets egen gör det inte.
  const assigned = workspace(), lanes = {...assigned, newKey:keys()};
  assigned.catalog.administration.operators.push({id:'south', name:'South', slug:'south', status:'active', archivedAt:null, packageRevision:3, packageLanes:['dragan-delad']});
  assert.equal(planEnvironment({...lanes, dealerId:'dragan', laneId:'dragan-delad', operatorId:'north'}).action, 'copy', 'south har miljön i sin tilldelning');
  assert.equal(planEnvironment({...lanes, dealerId:'dragan', laneId:'dragan-delad', operatorId:'south'}).action, 'lock', 'bara bolagets egen tilldelning');
});

const capabilities = presentationCapabilitiesForVersion(15);
const ROOM = 'room-' + uuid(99);
function server(w, overrides = {}) {
  const calls = [], bodies = [];
  let project = w.project;
  const routes = {
    'GET /admin/_data/catalog':() => ({...w.catalog, administration:{...w.catalog.administration, revisions:{project:project.revision, administration:'a1'}}}),
    'GET /studio/api/project':() => ({project}),
    'GET /studio/api/videos':() => w.inventory,
    'PUT /studio/api/project':body => { project = {...body.project, revision:'p2'}; return {project}; },
    'POST /studio/api/videos/measure-timing':body => ({media:{id:body.id, revision:'r2', mediaTiming:{ok:true}}}),
    'GET /api/admin/presentation-room':(_, url) => ({ok:true, operator:{id:'north', slug:'north', name:'North'}, presentationLaneId:url.searchParams.get('presentationLaneId'),
      projectRevision:project.revision, administrationRevision:'a1', packageRevision:1, ready:true, reason:null, capabilities, rooms:[]}),
    'POST /api/admin/presentation-room':body => createdRoom(body),
    ...overrides,
  };
  const fetchImpl = async (path, init = {}) => {
    const url = new URL(path, 'https://studio.invalid'), key = (init.method ?? 'GET') + ' ' + url.pathname, body = init.body ? JSON.parse(init.body) : null;
    calls.push(key + (body?.action ? ' ' + body.action : '')); bodies.push(body);
    const value = routes[key]?.(body, url);
    if (value instanceof Response) return value;
    return value === undefined ? new Response('{}', {status:404}) : Response.json(value);
  };
  return {fetchImpl, calls, bodies};
}
// Servern publicerar spelbordet, tilldelningen och spelinställningarna i en paketversion (presentation-room-api.mjs gameConfig).
const createdRoom = (body, duplicate = false) => ({ok:true, duplicate, room:{schemaVersion:2, id:ROOM, name:body.name, operatorId:'north', presentationLaneId:body.presentationLaneId, gameLaneId:'room-lane-x', state:'live',
  ...(body.game ? {game:body.game} : {})}, administrationRevision:'a2', packageRevision:2, playUrl:`/play/${body.game ?? 'blackjack'}?operator=north&table=${ROOM}`,
  ...(body.gameConfig ? {published:{configVersion:'v1', packageRevision:2, gameConfig:body.gameConfig, betMs:20000, actionMs:15000}} : {})});
const refused = (status, code, extra = {}) => () => Response.json({error:code, code, ...extra}, {status});
const posts = s => s.calls.map((call, index) => call === 'POST /api/admin/presentation-room' ? s.bodies[index] : null).filter(Boolean);
const puts = s => s.calls.filter(call => call === 'PUT /studio/api/project').length;
const operator = {id:'north', slug:'north', name:'North'};
const choice = {game:'blackjack', dealerId:'dragan', laneId:'dragan-delad', language:'sv', limitPreset:'prive', name:'Dragan Blackjack 2'};

test('kedjan: lås miljön → mät omätta klipp → spelbord, tilldelning och spelinställningar i en POST', async () => {
  const w = workspace();
  w.inventory.videos = [{id:'v1', label:'Giv 1', available:true, integrity:'verified', previewUrl:'', revision:'r1', sha256:'a'.repeat(64), contentType:'video/mp4', classification:{dealerId:'dragan', archived:false}}];
  const s = server(w), steps = [];
  const result = await runQuickCreate(choice, {operator, fetchImpl:s.fetchImpl, newKey:keys(), onStep:(id, status, text) => steps.push(`${id}:${status}`)});
  assert.equal(result.ok, true, result.text); assert.equal(result.playUrl, `/play/blackjack?operator=north&table=${ROOM}`);
  assert.deepEqual(s.calls, ['GET /admin/_data/catalog', 'GET /studio/api/project', 'GET /studio/api/videos', 'PUT /studio/api/project', 'POST /studio/api/videos/measure-timing',
    'GET /api/admin/presentation-room', 'POST /api/admin/presentation-room']);
  assert.deepEqual(posts(s)[0].gameConfig, {language:'sv', limitPreset:'prive'}, 'spelinställningarna i samma begäran');
  assert.deepEqual(steps.filter(row => row.endsWith(':done')), ['miljo:done', 'matning:done', 'spelbord:done']);
  const roulette = server(w), plain = await runQuickCreate({...choice, game:'roulette', name:'Dragan Roulette 1'}, {operator, fetchImpl:roulette.fetchImpl, newKey:keys()});
  assert.equal(plain.ok, true, plain.text); assert.equal(Object.hasOwn(posts(roulette)[0], 'gameConfig'), false, 'roulette har inga spelinställningar');
});

test('kedjan stannar med en mening och rätt knapp; bara ett osäkert svar försöks igen med samma nyckel', async () => {
  const w = workspace();
  // Ett öppet utseendeutkast stoppar inte längre: servern för det vidare till den nya paketversionen (plan L3 PR 3).
  const drafted = await runQuickCreate(choice, {operator:{...operator, appearanceDraft:true}, fetchImpl:server(w).fetchImpl, newKey:keys()});
  assert.equal(drafted.ok, true, drafted.text);
  const material = server(w, {'POST /api/admin/presentation-room':refused(422, 'studio_room_game_material_unavailable', {materialReason:'native_material_speech_slot_missing'})});
  const stopped = await runQuickCreate(choice, {operator, fetchImpl:material.fetchImpl, newKey:keys()});
  assert.deepEqual([stopped.ok, stopped.step, stopped.href, stopped.label], [false, 'spelbord', '/admin/dealers/dragan?flik=tal', 'Öppna Röst och tal']);
  const reasonless = server(w, {'POST /api/admin/presentation-room':refused(422, 'studio_room_game_material_unavailable')});
  assert.equal((await runQuickCreate(choice, {operator, fetchImpl:reasonless.fetchImpl, newKey:keys()})).href, '/admin/dealers/dragan?flik=klipp');
  const shared = server(w, {'GET /api/admin/presentation-room':(_, url) => ({ok:true, operator:{id:'north', slug:'north', name:'North'}, presentationLaneId:url.searchParams.get('presentationLaneId'),
    projectRevision:'p2', administrationRevision:'a1', packageRevision:1, ready:false, reason:'presentation_package_conflict', conflictCode:'presentation_shared_dealer_conflict', capabilities, rooms:[]})});
  const conflict = await runQuickCreate(choice, {operator, fetchImpl:shared.fetchImpl, newKey:keys()});
  assert.deepEqual([conflict.step, conflict.href, conflict.label], ['spelbord', '/admin/companies/north?flik=tilldelning', 'Öppna tilldelningen']);
  let lost = true;
  const flaky = server(w, {'POST /api/admin/presentation-room':body => { if (lost) { lost = false; return new Response('{}', {status:502}); } return createdRoom(body, true); }});
  const memo = {}, newKey = keys();
  const first = await runQuickCreate(choice, {operator, fetchImpl:flaky.fetchImpl, memo, newKey});
  assert.deepEqual([first.step, first.action, first.label, memo.uncertain], ['spelbord', 'retry', 'Försök igen', true]);
  const again = await runQuickCreate(choice, {operator, fetchImpl:flaky.fetchImpl, memo, newKey});
  assert.equal(again.ok, true, again.text);
  const [a, b] = posts(flaky);
  assert.equal(a.idempotencyKey, b.idempotencyKey, 'samma idempotensnyckel'); assert.deepEqual(a.gameConfig, b.gameConfig, 'samma spelinställningar');
  assert.equal(puts(flaky), 1, 'den låsta miljön används igen, inget nytt sparas');
  assert.deepEqual(stopView('native_material_measurement_missing', {dealerId:'paow'}), {text:'Klippen saknar aktuell tidsmätning.', href:'/admin/dealers/paow?flik=klipp', label:'Mät omätta klipp'});
  // Spärrarna har sin text i blocker-view.mjs; miljön öppnas under Miljöer.
  assert.deepEqual(stopView('presentation_lane_incompatible', {laneId:'dragan-delad'}), {text:'Miljön saknar en spelbar dealer eller bakgrund.', href:'/admin/scenes?tab=miljoer&composition=dragan-delad', label:'Öppna miljön'});
  assert.deepEqual(stopView('conflict'), {text:'Någon annan sparade just. Läs in igen.', action:'reload', label:'Läs in igen'});
});

test('efter ett stopp (material eller konflikt, även efter Läs in igen) används samma miljö: ingen ny kopia, ny nyckel', async () => {
  const w = workspace();
  w.catalog.administration.rooms.push({...w.catalog.administration.rooms[0], id:'s2', compositionId:'dragan-delad', operatorId:'south'});
  let english = true;
  const s = server(w, {'POST /api/admin/presentation-room':body => body.gameConfig.language === 'en' && english
    ? Response.json({error:'studio_room_game_material_unavailable', code:'studio_room_game_material_unavailable', materialReason:'native_material_speech_slot_missing'}, {status:422}) : createdRoom(body)});
  const memo = {}, newKey = keys();
  const first = await runQuickCreate({...choice, language:'en'}, {operator, fetchImpl:s.fetchImpl, memo, newKey});
  assert.equal(first.step, 'spelbord'); assert.ok(memo.laneId?.startsWith('dragan-delad-'), 'miljön kopierades'); assert.equal(memo.uncertain, false);
  // Dialogen behåller minnet när språket ändras (change) och vid Läs in igen.
  const second = await runQuickCreate({...choice, language:'sv'}, {operator, fetchImpl:s.fetchImpl, memo, newKey});
  assert.equal(second.ok, true, second.text);
  assert.equal(puts(s), 1, 'en kopia, inte två');
  const [a, b] = posts(s);
  assert.equal(a.presentationLaneId, b.presentationLaneId, 'samma miljö'); assert.notEqual(a.idempotencyKey, b.idempotencyKey, 'bekräftat nej: ny nyckel');
  assert.equal(s.calls.filter(call => call === 'POST /studio/api/videos/measure-timing').length, 0);
  const busy = server(w, {'POST /api/admin/presentation-room':() => new Response('{}', {status:409})});
  const conflictMemo = {};
  const stale = await runQuickCreate(choice, {operator, fetchImpl:busy.fetchImpl, memo:conflictMemo, newKey:keys()});
  assert.deepEqual([stale.step, stale.action], ['spelbord', 'reload']);
  await runQuickCreate(choice, {operator, fetchImpl:busy.fetchImpl, memo:conflictMemo, newKey:keys()});
  assert.equal(puts(busy), 1, 'Läs in igen och nytt försök: samma kopia');
  const [c, d] = posts(busy); assert.equal(c.presentationLaneId, d.presentationLaneId);
  assert.notEqual(c.idempotencyKey, d.idempotencyKey, 'en bekräftad konflikt skapade inget: ny nyckel, även med samma val');
});

test('en publicerad miljö med annan bakgrund kopieras en gång; ett klipp som inte kan mätas stoppar före spelbordet', async () => {
  const w = workspace();
  let conflicts = 0;
  const s = server(w, {'GET /api/admin/presentation-room':(_, url) => {
    const laneId = url.searchParams.get('presentationLaneId'), conflict = laneId === 'dragan-gammal';
    if (conflict) conflicts++;
    return {ok:true, operator:{id:'north', slug:'north', name:'North'}, presentationLaneId:laneId, projectRevision:'p2', administrationRevision:'a1', packageRevision:1,
      ready:!conflict, reason:conflict ? 'presentation_package_conflict' : null, conflictCode:conflict ? 'presentation_room_environment_conflict' : null, capabilities, rooms:[]};
  }});
  const result = await runQuickCreate({...choice, laneId:'dragan-gammal'}, {operator, fetchImpl:s.fetchImpl, newKey:keys()});
  assert.equal(result.ok, true, result.text); assert.equal(conflicts, 1);
  const [post] = posts(s);
  assert.ok(post.presentationLaneId.startsWith('dragan-gammal-'), 'spelbordet får kopian'); assert.equal(puts(s), 1, 'den fasta miljön används, och vid konflikten kopieras den');
  w.inventory.videos = [{id:'v1', label:'Giv 1', available:true, integrity:'verified', previewUrl:'', revision:'r1', sha256:'a'.repeat(64), contentType:'video/mp4', classification:{dealerId:'dragan', archived:false}}];
  const broken = server(w, {'POST /studio/api/videos/measure-timing':() => Response.json({error:'Mätningen misslyckades.'}, {status:422})});
  const stopped = await runQuickCreate(choice, {operator, fetchImpl:broken.fetchImpl, newKey:keys()});
  assert.deepEqual([stopped.ok, stopped.step, stopped.href], [false, 'matning', '/admin/dealers/dragan?flik=klipp']); assert.match(stopped.text, /Giv 1/);
  assert.equal(posts(broken).length, 0, 'inget spelbord skapas när mätningen stannar');
});
