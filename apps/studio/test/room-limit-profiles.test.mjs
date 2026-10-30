import test from 'node:test';
import assert from 'node:assert/strict';
import {ROOM_LIMIT_PRESETS} from '../../../packages/presentation/contracts/room-game-config.mjs';
import * as profilesModule from '../lib/room-limit-profiles.mjs';

const {roomLimitProfiles,roomLimitProfileNote}=profilesModule;

test('the three bet profiles carry the engine numbers, and only stakes: no place name or picture', () => {
  const profiles = roomLimitProfiles();
  assert.deepEqual(profiles.map(row => [row.id, row.label]), [['casual', 'Casual'], ['prive', 'Privé'], ['high', 'High']]);
  for (const row of profiles) {
    const preset = ROOM_LIMIT_PRESETS[row.id];
    assert.deepEqual([row.min, row.max, row.sideMax, row.chips, row.refill], [preset.min, preset.max, preset.sideMax, [...preset.chips], preset.refill]);
    assert.deepEqual(Object.keys(row).filter(key => ['place', 'image', 'alt'].includes(key)), [], 'a profile is stakes only; the picture is the miljöbild');
  }
  assert.equal(profiles[1].stakes, `${(5).toLocaleString('sv-SE')}–${(2000).toLocaleString('sv-SE')}`);
  assert.match(roomLimitProfileNote, /Samma spel och regler/);
  assert.equal('roomLimitProfileImage' in profilesModule, false);
});
