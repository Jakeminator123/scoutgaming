import test from 'node:test';
import assert from 'node:assert/strict';
import { getEventListeners } from 'node:events';
import { combineAbortSignals } from '../services/game/public/abort-signals.mjs';

test('the first owner or timeout abort wins and all source listeners are removed', () => {
  for (const source of ['owner','timeout']) {
    const owner=new AbortController(), timeout=new AbortController();
    const inputs={owner,timeout}, reason=new DOMException(source,source==='owner'?'AbortError':'TimeoutError');
    const signal=combineAbortSignals([undefined,owner.signal,timeout.signal,owner.signal]);
    assert.equal(getEventListeners(owner.signal,'abort').length,1);
    inputs[source].abort(reason);
    assert.equal(signal.aborted,true); assert.equal(signal.reason,reason);
    assert.equal(getEventListeners(owner.signal,'abort').length,0);
    assert.equal(getEventListeners(timeout.signal,'abort').length,0);
    owner.abort(); timeout.abort(); assert.equal(signal.reason,reason);
  }
});

test('already aborted sources abort immediately without retaining earlier listeners', () => {
  const before=new AbortController(), stopped=new AbortController(), after=new AbortController();
  stopped.abort(new DOMException('Closed','AbortError'));
  const signal=combineAbortSignals([before.signal,stopped.signal,after.signal]);
  assert.equal(signal.reason,stopped.signal.reason);
  for(const owner of [before,stopped,after])assert.equal(getEventListeners(owner.signal,'abort').length,0);
  assert.equal(combineAbortSignals([]).aborted,false);
});
