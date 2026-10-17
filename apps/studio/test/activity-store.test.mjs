import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTIVITY_STORAGE_KEY, ACTIVITY_STORAGE_LIMIT, loadActivities, saveActivities } from '../lib/activity-store.mjs';
import { ACTIVITY_LIMIT } from '../lib/activity-log.mjs';

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: key => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, String(value)); },
    removeItem: key => { data.delete(key); },
  };
}

test('activity store keeps the visible log limit and drops the oldest entries', () => {
  assert.equal(ACTIVITY_STORAGE_LIMIT, ACTIVITY_LIMIT);
  globalThis.sessionStorage = memoryStorage();
  assert.deepEqual(loadActivities(), []);
  const entries = Array.from({ length: ACTIVITY_LIMIT + 5 }, (_, index) => ({ id: String(index) }));
  saveActivities(entries);
  const loaded = loadActivities();
  assert.equal(loaded.length, ACTIVITY_LIMIT);
  assert.equal(loaded[0].id, '5');
  assert.equal(loaded.at(-1).id, String(ACTIVITY_LIMIT + 4));
  assert.equal(JSON.parse(globalThis.sessionStorage.getItem(ACTIVITY_STORAGE_KEY)).length, ACTIVITY_LIMIT);
});

test('missing and corrupt activity storage becomes an empty list and never throws', () => {
  const previous = globalThis.sessionStorage;
  try {
    delete globalThis.sessionStorage;
    assert.deepEqual(loadActivities(), []);
    assert.doesNotThrow(() => saveActivities([{ id: '1' }]));
    const store = memoryStorage();
    globalThis.sessionStorage = store;
    for (const raw of ['{', 'null', '"text"', '{"no":"array"}']) {
      store.setItem(ACTIVITY_STORAGE_KEY, raw);
      assert.deepEqual(loadActivities(), []);
    }
    store.getItem = () => { throw new Error('blocked'); };
    assert.deepEqual(loadActivities(), []);
    globalThis.sessionStorage = { getItem() { return '[{}]'; }, setItem() { throw new Error('quota'); } };
    assert.doesNotThrow(() => saveActivities([{ id: '1' }]));
    assert.deepEqual(loadActivities(), [{}]);
  } finally {
    if (previous === undefined) delete globalThis.sessionStorage;
    else globalThis.sessionStorage = previous;
  }
});
