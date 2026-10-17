import test from 'node:test';
import assert from 'node:assert/strict';
import { OBSERVED_STEP_STORAGE_KEY, saveObservedStep, takeObservedStep } from '../lib/observed-step-store.mjs';

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: key => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, String(value)); },
    removeItem: key => { data.delete(key); },
  };
}

const step = { eventId: 'speak.goodluck', presentationIndex: 2, label: 'Lycka till', blocked: false };

test('observed step is saved, read once and then deleted', () => {
  globalThis.sessionStorage = memoryStorage();
  assert.equal(takeObservedStep(), null);
  saveObservedStep(step);
  assert.equal(globalThis.sessionStorage.getItem(OBSERVED_STEP_STORAGE_KEY)?.includes('speak.goodluck'), true);
  assert.deepEqual(takeObservedStep(), step);
  assert.equal(takeObservedStep(), null);
  assert.equal(globalThis.sessionStorage.getItem(OBSERVED_STEP_STORAGE_KEY), null);
});

test('missing and corrupt observed-step storage becomes null and never throws', () => {
  const previous = globalThis.sessionStorage;
  try {
    delete globalThis.sessionStorage;
    assert.equal(takeObservedStep(), null);
    assert.doesNotThrow(() => saveObservedStep(step));
    const store = memoryStorage();
    globalThis.sessionStorage = store;
    for (const raw of ['{', 'null', '"text"', '[]', '4', 'true']) {
      store.setItem(OBSERVED_STEP_STORAGE_KEY, raw);
      assert.equal(takeObservedStep(), null);
      assert.equal(store.getItem(OBSERVED_STEP_STORAGE_KEY), null);
    }
    store.getItem = () => { throw new Error('blocked'); };
    assert.equal(takeObservedStep(), null);
    globalThis.sessionStorage = { getItem() { return '{"eventId":"idle.ready"}'; }, setItem() { throw new Error('quota'); }, removeItem() { throw new Error('blocked'); } };
    assert.doesNotThrow(() => saveObservedStep(step));
    assert.deepEqual(takeObservedStep(), { eventId: 'idle.ready' });
    assert.equal(saveObservedStep(null), undefined);
    assert.equal(saveObservedStep(['not', 'a', 'step']), undefined);
  } finally {
    if (previous === undefined) delete globalThis.sessionStorage;
    else globalThis.sessionStorage = previous;
  }
});
