import test from 'node:test';
import assert from 'node:assert/strict';
import { ROOM_PRESETS, roomFor, createVoiceRoom } from '../public/voice-room.js';

test('Paow, Dragge and Mårten play in the casino (Kevin 14 Oct, furthest distance); Astrid stays "studio"; ?voice= tries one', () => {
  for (const d of ['paow', 'dragge', 'marten']) assert.equal(roomFor(d), 'space');
  for (const d of ['astrid', 'astrid2']) assert.equal(roomFor(d), 'studio');
  assert.equal(roomFor('astrid2', '?voice=space'), 'space');
  assert.equal(roomFor('paow', '?voice=studio'), 'studio');
  assert.equal(roomFor('astrid', '?voice=bathroom'), 'studio');
  assert.deepEqual(Object.keys(ROOM_PRESETS), ['studio', 'space']);
});

test('the casino under the voice: Paow, Dragge and Mårten keep it (1), Astrid dips to 0.32 as before', () => {
  for (const d of ['paow', 'dragge', 'marten']) assert.equal(createVoiceRoom(d, { search: '' }).duck, 1);
  assert.equal(createVoiceRoom('astrid2', { search: '' }).duck, 0.32);
});

test('studio leaves the elements exactly as today: no crossOrigin, no context, no routing', () => {
  let made = 0;
  const room = createVoiceRoom('astrid', { search: '', createContext: () => { made++; return {}; } });
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
