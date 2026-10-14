import test from 'node:test';
import assert from 'node:assert/strict';
import { ROOM_PRESETS, roomFor, createVoiceRoom } from '../public/voice-room.js';

test('Paow plays in the casino (Kevin 14 Oct, sample 3); every other dealer stays "studio"; ?voice= tries one', () => {
  assert.equal(roomFor('paow'), 'space');
  for (const d of ['dragge', 'astrid', 'astrid2', 'marten']) assert.equal(roomFor(d), 'studio');
  assert.equal(roomFor('dragge', '?voice=space'), 'space');
  assert.equal(roomFor('paow', '?voice=studio'), 'studio');
  assert.equal(roomFor('dragge', '?voice=bathroom'), 'studio');
  assert.deepEqual(Object.keys(ROOM_PRESETS), ['studio', 'space']);
});

test('the casino under the voice: Paow keeps it (1), the others dip to 0.32 as before', () => {
  assert.equal(createVoiceRoom('paow', { search: '' }).duck, 1);
  assert.equal(createVoiceRoom('dragge', { search: '' }).duck, 0.32);
});

test('studio leaves the elements exactly as today: no crossOrigin, no context, no routing', () => {
  let made = 0;
  const room = createVoiceRoom('dragge', { search: '', createContext: () => { made++; return {}; } });
  const el = { crossOrigin: null };
  room.prepare(el); room.unlock([el]);
  assert.equal(el.crossOrigin, null); assert.equal(made, 0); assert.equal(room.active, false); assert.equal(room.attach(el), false);
});

test('a room asks CDN media for CORS before the first src, and never binds to a context that is not running', () => {
  const room = createVoiceRoom('dragge', { search: '?voice=space', createContext: () => { throw new Error('no audio'); } });
  const el = { crossOrigin: null };
  room.prepare(el); assert.equal(el.crossOrigin, 'anonymous');
  room.unlock([el]);                       // the context cannot be made: the element plays on as it is
  assert.equal(room.attach(el), false);
});
