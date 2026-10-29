import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {blockerView,runBlockerAction,BLOCKER_CODES,MATERIAL_REASONS} from './blocker-view.mjs';

const RAW = /[a-z]+_[a-z_]+/;
const ctx = {roomId:'north-a', operatorId:'north', dealerId:'paow', dealerName:'PAOW', compositionId:'lane-1', language:'sv'};
// Driftskoder har ingen knapp: inget i Admin åtgärdar dem.
const NO_ACTION = new Set(['studio_release_unchanged','studio_presentation_runtime_update_required','studio_room_config_storage_missing',
  'studio_media_registry_unavailable','studio_room_not_found']);

test('every blocker code is one Swedish line with a button to the right place and never shows the code', () => {
  for (const code of BLOCKER_CODES) {
    const view = blockerView(code, ctx);
    assert.ok(view.title && view.text, code);
    assert.doesNotMatch(view.title + ' ' + view.text + ' ' + (view.action?.label ?? ''), RAW, code);
    assert.match(view.text, /^[A-ZÅÄÖ].*\.$/, code);
    if (NO_ACTION.has(code)) assert.equal(view.action, null, code);
    else assert.ok(view.action?.label && (view.action.href?.startsWith('/admin/') || view.action.run), code);
    assert.equal(view.detail, code, 'the code is kept for Detaljer only');
  }
  assert.equal(blockerView('studio_release_unchanged').tone, 'info', 'nothing to publish is not an error');
  assert.deepEqual(blockerView('studio_room_choices_draft_pending', ctx).action, {label:'Öppna Utseende', href:'/admin/rooms/north-a?flik=utseende'});
  assert.equal(blockerView('studio_presentation_shared_dealer_conflict', ctx).action.href, '/admin/companies/north?flik=tilldelning');
  assert.equal(blockerView('studio_presentation_room_environment_required', ctx).action.href, '/admin/scenes?tab=mallar&composition=lane-1');
  for (const unknown of ['studio_secret_detail', '__proto__', undefined]) {
    const view = blockerView(unknown, ctx);
    assert.equal(view.text, 'Något hindrar publiceringen.');assert.equal(view.action, null);
  }
});

test('every material reason the server may send becomes one of a few texts with a button', () => {
  const source = readFileSync(new URL('../../../lib/room-game-config-api.mjs', import.meta.url), 'utf8');
  const server = [...source.slice(source.indexOf('const materialReasons'), source.indexOf('// Den fasta listan')).matchAll(/'(native_material_[a-z_0-9]+)'/g)].map(match => match[1]);
  assert.ok(server.length >= 20);
  for (const reason of server) assert.ok(MATERIAL_REASONS.includes(reason), reason);
  const texts = new Set(server.map(reason => blockerView('studio_room_game_material_unavailable', {...ctx, materialReason:reason}).text.replace(/:.*$/, ':')));
  assert.ok(texts.size <= 6, [...texts].join(' | '));
  assert.deepEqual(blockerView('studio_room_game_material_unavailable', {...ctx, materialReason:'native_material_measurement_missing'}).action,
    {label:'Mät omätta klipp', href:'/admin/dealers/paow?flik=klipp', run:'measure'});
  assert.equal(blockerView('native_material_speech_unbound', ctx).text, 'En replik saknar godkänt tal på svenska.');
  assert.equal(blockerView('native_material_idle_missing', ctx).text, 'PAOW saknar klipp för ett fack.');
  assert.equal(blockerView('native_material_size_mismatch', ctx).text, 'Ett klipp är tekniskt fel: storleken stämmer inte.');
});

test('the measure button reads the clip registry and measures each unmeasured clip of the dealers once', async () => {
  const sha = 'c'.repeat(64), clip = (id, dealerId, extra = {}) => ({id, revision:'r1', sha256:sha, contentType:'video/mp4', classification:{dealerId}, ...extra});
  const calls = [], answers = [{videos:[clip('a', 'paow'), clip('b', 'paow', {mediaTiming:{frames:1}}), clip('c', 'dragan'), clip('d', 'other')]},
    {media:{id:'a', revision:'r2', mediaTiming:{frames:3}}}, {media:{id:'c', revision:'r2', mediaTiming:{frames:4}}}];
  const fetchImpl = async (url, init) => { calls.push(init.method + ' ' + url + (init.body ? ' ' + JSON.parse(init.body).id : '')); return {ok:true, status:200, json:async () => answers.shift()}; };
  const result = await runBlockerAction({label:'Mät omätta klipp', href:null, run:'measure'}, {dealerIds:['paow', 'dragan', 'paow'], fetchImpl});
  assert.deepEqual(calls, ['GET /studio/api/videos', 'POST /studio/api/videos/measure-timing a', 'POST /studio/api/videos/measure-timing c']);
  assert.deepEqual([result.ok, result.measured], [true, 2]);
  assert.equal((await runBlockerAction({label:'x', href:'/admin/x'}, {dealerIds:['paow'], fetchImpl})).ok, false, 'a link is not an action');
  assert.equal((await runBlockerAction({label:'x', href:null, run:'measure'}, {dealerIds:[], fetchImpl})).ok, false);
});
