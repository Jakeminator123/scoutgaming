import test from 'node:test';
import assert from 'node:assert/strict';
import {CHANGED_MESSAGE, measureUnmeasured, refreshStaleDraft, resolveBlocker} from '../client/admin/lib/auto-steps.mjs';

function recorder(responses) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    calls.push({url:String(url), method:init.method ?? 'GET', body:init.body ? JSON.parse(init.body) : null});
    const next = responses.shift();
    if (!next) throw new Error('oväntat anrop ' + url);
    return {ok:next.status >= 200 && next.status < 300, status:next.status, json:async () => next.body};
  };
  return {calls, fetch};
}
const clip = (id, patch = {}) => ({id, label:id, available:true, revision:'r-' + id, sha256:id.padEnd(64, 'a').slice(0, 64).replace(/[^a-f0-9]/g, 'a'),
  contentType:'video/mp4', classification:{dealerId:'paow', archived:false}, ...patch});
const measured = id => ({status:200, body:{media:{id, revision:'r2-' + id, mediaTiming:{frames:10}}}});
const preview = blockers => ({ok:true, operatorId:'north', roomId:'north-a', revisions:{package:8}, candidate:{dealerId:'paow'}, live:null, blockers});
const measurement = {area:'speech', code:'studio_room_game_material_unavailable', materialReason:'native_material_measurement_missing'};
const pending = {area:'roomChoices', code:'studio_room_choices_draft_pending', draftRevision:3};
const appearance = patch => ({operatorId:'north', packageRevision:8, lanes:[], adjustable:[], branding:{}, canConfigure:true, history:[], rooms:[], ...patch});
const draft = (revision, base) => ({draft:{revision, basePackageRevision:base, branding:{dealer:'paow', roomOverrides:{'north-a':{table:'green'}}}}, draftRevision:revision});

test('native_material_measurement_missing measures every unmeasured clip of the dealer, in order, once', async () => {
  const videos = [clip('c1'), clip('c2', {mediaTiming:{frames:4}}), clip('c3', {classification:{dealerId:'other', archived:false}}), clip('c4')];
  const {calls, fetch} = recorder([{status:200, body:{videos}}, measured('c1'), measured('c4')]);
  const result = await resolveBlocker({release:preview([measurement]), deps:{fetch}});
  assert.deepEqual(result, {handled:true, done:['native_material_measurement_missing']});
  assert.deepEqual(calls.map(call => call.method + ' ' + call.url), ['GET /studio/api/videos',
    'POST /studio/api/videos/measure-timing', 'POST /studio/api/videos/measure-timing']);
  assert.deepEqual(calls.slice(1).map(call => [call.body.id, call.body.expectedRevision]), [['c1', 'r-c1'], ['c4', 'r-c4']]);
});

test('studio_room_choices_draft_pending saves the same draft again on the new package revision', async () => {
  const {calls, fetch} = recorder([{status:200, body:{administration:{operators:[{id:'north', slug:'north-casino'}]}}},
    {status:200, body:appearance(draft(3, 7))}, {status:200, body:appearance(draft(4, 8))}]);
  const result = await resolveBlocker({release:preview([pending]), deps:{fetch}});
  assert.deepEqual(result, {handled:true, done:['studio_room_choices_draft_pending']});
  const posts = calls.filter(call => call.method === 'POST');
  assert.equal(posts.length, 1);
  assert.equal(posts[0].url, '/studio/api/partner/branding?operator=north-casino');
  assert.deepEqual(posts[0].body, {action:'save-draft', expectedDraftRevision:3, expectedPackageRevision:8,
    branding:{dealer:'paow', roomOverrides:{'north-a':{table:'green'}}}});
});

test('a 409 in any step stops with the message and makes no further call', async () => {
  const videos = [clip('c1'), clip('c2'), clip('c3')];
  const measure = recorder([{status:409, body:{code:'studio_conflict'}}]);
  assert.deepEqual(await measureUnmeasured({dealerId:'paow', clips:videos, fetch:measure.fetch}), {handled:false, message:CHANGED_MESSAGE});
  assert.equal(measure.calls.length, 1);

  const save = recorder([{status:200, body:appearance(draft(3, 7))}, {status:409, body:null}]);
  assert.deepEqual(await refreshStaleDraft({operatorId:'north', operatorSlug:'north-casino', revision:8, fetch:save.fetch}), {handled:false, message:CHANGED_MESSAGE});
  assert.equal(save.calls.length, 2);

  // Två hinder: 409 i det första stoppar det andra.
  const both = recorder([{status:200, body:{videos}}, {status:409, body:null}]);
  const result = await resolveBlocker({release:preview([measurement, pending]), deps:{fetch:both.fetch, operatorSlug:'north-casino'}});
  assert.equal(result.handled, false);
  assert.equal(result.message, CHANGED_MESSAGE);
  assert.equal(both.calls.length, 2);
});

test('other blockers are not automatic and get their sentence; a moved package is a change, never a discard', async () => {
  const none = recorder([]);
  const result = await resolveBlocker({release:preview([{area:'settings', code:'studio_room_game_config_missing'}]), deps:{fetch:none.fetch}});
  assert.equal(result.handled, false);
  assert.match(result.message, /^Spelbordet saknar spelinställningar/);
  assert.equal(none.calls.length, 0);
  const moved = recorder([{status:200, body:appearance({...draft(3, 7), packageRevision:9})}]);
  assert.deepEqual(await refreshStaleDraft({operatorId:'north', operatorSlug:'north-casino', revision:8, fetch:moved.fetch}), {handled:false, message:CHANGED_MESSAGE});
  assert.equal(moved.calls.length, 1);
});
