import test from 'node:test';
import assert from 'node:assert/strict';
import { appendActivity, safeActivityData, decisionAttribution, eventSummary, ACTIVITY_LIMIT } from '../lib/activity-log.mjs';

test('diagnostics redact nested authentication and bound memory without modifying source', () => {
  const raw = { authorization: 'sensitive', event: { type: 'deal', card: { r: '9', s: '♥' }, secret: 'sensitive' }, list: Array(100).fill('x') };
  const safe = safeActivityData(raw);
  assert.equal(safe.authorization, '[dolt]'); assert.equal(safe.event.secret, '[dolt]');
  assert.equal(safe.list.length, 41); assert.equal(raw.event.secret, 'sensitive');
  assert.deepEqual(safe.list.at(-1), { $logTruncation: { kind: 'array', shown: 40, total: 100, omitted: 60 } });
  let entries = [];
  for (let i = 0; i < 180; i++) entries = appendActivity(entries, { id: String(i), data: raw });
  assert.equal(entries.length, ACTIVITY_LIMIT); assert.equal(entries[0].id, '30');
});

test('capped arrays and objects disclose exact omitted counts without altering input', () => {
  const event = { type: 'deal', box: 3, card: { r: '9', s: 'H' } };
  const events = Array.from({ length: 43 }, (_, index) => ({ ...event, sequence: index }));
  const object = Object.fromEntries(Array.from({ length: 65 }, (_, index) => [`field${index}`, index]));
  const safe = safeActivityData({ events, object });
  assert.deepEqual(safe.events.slice(0, 40), events.slice(0, 40));
  assert.deepEqual(safe.events[40], { $logTruncation: { kind: 'array', shown: 40, total: 43, omitted: 3 } });
  assert.deepEqual(safe.object.$logTruncation, { kind: 'object', shown: 60, total: 65, omitted: 5 });
  assert.equal(Object.keys(safe.object).length, 61); assert.equal(safe.object.field59, 59); assert.equal(safe.object.field60, undefined);
  assert.equal(events.length, 43); assert.equal(Object.keys(object).length, 65); assert.equal(object.$logTruncation, undefined);
  const exact = safeActivityData({ events: events.slice(0, 40), object: Object.fromEntries(Object.entries(object).slice(0, 60)) });
  assert.equal(exact.events.length, 40); assert.equal(Object.keys(exact.object).length, 60); assert.equal(exact.object.$logTruncation, undefined);
});

test('shadow and fallback never attribute selected playback to the model', () => {
  assert.match(decisionAttribution('active', 'accepted', 'responded'), /förslag.*kontroll/);
  assert.match(decisionAttribution('shadow', 'shadow_only', 'responded'), /standardval/);
  assert.match(decisionAttribution('active', 'no_advice', 'openclaw_timeout'), /reservval/);
  assert.equal(decisionAttribution('random', 'local_random'), 'Lokal presentationsslump');
});

test('seat display preserves protocol index and does not invent player identity or variant', () => {
  assert.equal(eventSummary({ type: 'deal', card: { r: '9', s: '♥' }, to: 'box', box: 3, handIndex: 0 }), 'deal · 9♥ · spelarsida · plats 4 (box 3) · handIndex 0');
  assert.equal(eventSummary({ type: 'deal', faceDown: true, card: { r: 'K', s: 's' } }), 'deal · dolt kort');
  assert.equal(eventSummary({ type: 'idle' }), 'idle');
});
