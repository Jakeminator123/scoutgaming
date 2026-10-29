import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BLOCKER_FALLBACK, blockerText, blockerView} from '../client/admin/lib/blocker-text.mjs';
import {roomReleaseBlocker} from '../client/admin/lib/room-release.mjs';

// Den fasta listan av materialskäl, läst ur källan så att ett nytt skäl utan text fäller provet.
const source = readFileSync(new URL('../lib/room-game-config-api.mjs', import.meta.url), 'utf8');
const materialReasons = [...source.match(/const materialReasons=new Set\(\[([\s\S]*?)\]\)/)[1].matchAll(/'([a-z0-9_]+)'/g)].map(match => match[1]);
const codes = ['studio_room_game_config_missing', 'studio_room_choices_draft_pending', 'studio_room_config_storage_missing', 'studio_presentation_required',
  'studio_presentation_room_environment_required', 'presentation_room_environment_required', 'studio_presentation_runtime_update_required',
  'presentation_package_too_large', 'presentation_lane_incompatible', 'presentation_package_conflict'];

function sentence(view, label) {
  assert.match(view.text, /^[A-ZÅÄÖ]/, label);
  assert.match(view.text, /[.!]$/, label);
  assert.doesNotMatch(view.text, /_|studio_|native_|presentation_/, label);
  assert.ok(typeof view.linkLabel === 'string' && view.linkLabel.length > 0 && !view.linkLabel.includes('_'), label + ': åtgärd saknas');
  if (view.href !== null) assert.match(view.href, /^\/admin\//, label);
}

test('every material reason becomes one Swedish sentence and an action, with and without context', () => {
  assert.ok(materialReasons.length >= 23, 'listan lästes inte ur källan');
  for (const materialReason of materialReasons) {
    for (const blocker of [{area:'speech', code:'studio_room_game_material_unavailable', materialReason}, materialReason]) {
      sentence(blockerText(blocker), materialReason);
      const view = blockerText(blocker, {roomId:'north-a', dealerId:'paow', dealerName:'PAOW'});
      sentence(view, materialReason);
      assert.match(view.text, /^Spelbordet kan inte publiceras än: PAOW /);
      assert.ok(view.href || /^Publicera /.test(view.linkLabel), materialReason + ': länken saknas när dealer och spelbord är kända');
      assert.match(view.title, new RegExp(materialReason), 'koden finns kvar i title');
    }
  }
  const other = blockerText({area:'rooms', code:'studio_room_game_material_unavailable', materialReason:'native_material_take_unrecognized', roomId:'north-b'},
    {rooms:[{id:'north-b', name:'Norr B'}]});
  sentence(other, 'rooms');
  assert.equal(other.href, '/admin/rooms/north-b?flik=spel');
  assert.equal(blockerText('native_material_take_unrecognized', {dealerId:'paow', dealerName:'PAOW'}).href, '/admin/dealers/paow?flik=tal');
});

test('every publication and presentation code becomes one sentence and an action', () => {
  for (const code of codes) {
    sentence(blockerText({area:'settings', code}), code);
    sentence(blockerText(code, {roomId:'north-a'}), code);
  }
  assert.equal(blockerText('studio_room_choices_draft_pending', {roomId:'north-a'}).href, '/admin/rooms/north-a?flik=utseende');
});

test('an unknown code never reaches the user, also through the old roomReleaseBlocker default branch', () => {
  for (const blocker of [{code:'studio_something_new'}, {code:'studio_release_invalid', reason:'studio_unknown_reason'}, null, 'weird_code']) {
    const view = blockerView(blocker, {roomId:'north-a'}, roomReleaseBlocker);
    sentence(view, JSON.stringify(blocker));
    assert.equal(view.text, BLOCKER_FALLBACK);
  }
  assert.equal(blockerView({code:'studio_something_new'}, {}, roomReleaseBlocker).title, 'studio_something_new');
  // Kända texter utanför tabellen går igenom oförändrade.
  const known = blockerView({code:'studio_release_invalid', reason:'studio_dealer_idle_required'}, {dealerId:'paow'}, roomReleaseBlocker);
  assert.equal(known.text, 'Dealern saknar sparad vila.');
  assert.equal(known.href, '/admin/dealers/paow?flik=klipp');
});
