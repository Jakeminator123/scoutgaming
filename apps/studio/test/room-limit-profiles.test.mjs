import test from 'node:test';
import assert from 'node:assert/strict';
import {ROOM_LIMIT_PRESETS} from '../../../packages/presentation/contracts/room-game-config.mjs';
import {roomLimitProfiles,roomLimitProfileImage,roomLimitProfileNote} from '../lib/room-limit-profiles.mjs';

test('the three bet profiles carry the engine numbers and the lobby room illustrations', () => {
  const profiles = roomLimitProfiles();
  assert.deepEqual(profiles.map(row => [row.id, row.label, row.place]), [['casual', 'Casual', 'Studion'], ['prive', 'Privé', 'Salongen'], ['high', 'High', 'Loungen']]);
  for (const row of profiles) {
    const preset = ROOM_LIMIT_PRESETS[row.id];
    assert.deepEqual([row.min, row.max, row.sideMax, row.chips, row.refill], [preset.min, preset.max, preset.sideMax, [...preset.chips], preset.refill]);
    assert.match(row.image, /^\/admin\/_assets\/lobby\/images\/lobby\/room-(studion|salongen|loungen)\.png$/);
  }
  assert.equal(profiles[1].stakes, `${(5).toLocaleString('sv-SE')}–${(2000).toLocaleString('sv-SE')}`);
  assert.match(roomLimitProfileNote, /Samma spel och regler/);
});

test('only known profile keys resolve to an image', () => {
  assert.equal(roomLimitProfileImage('high'), '/admin/_assets/lobby/images/lobby/room-loungen.png');
  for (const value of ['__proto__', 'constructor', 'vip', '', null, undefined, 3]) assert.equal(roomLimitProfileImage(value), undefined);
});
