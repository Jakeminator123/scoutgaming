import test from 'node:test';
import assert from 'node:assert/strict';
import { presentationEvents } from '../../../services/game/partner-presentation.mjs';
import { createSeedProject } from '../../../packages/presentation/contracts/studio-model.mjs';
import { describeEventFields, formatEventValue, OUTPUT_GROUPS, presentationProfile } from '../lib/presentation-profile.mjs';

test('all existing groups have an output profile without defining extra source types', () => {
  const project = createSeedProject();
  const counts = Object.fromEntries(OUTPUT_GROUPS.map(group => [group.id, 0]));
  for (const event of project.events) counts[presentationProfile(event.sourceType).id]++;
  assert.deepEqual(counts, { idle: 1, action: 6, speech: 4, reaction: 6 });
  assert.equal(presentationProfile('chat'), null);
  assert.equal(presentationProfile('ended'), null);
});

test('inspector distinguishes absent, null, false and zero without filling missing fields', () => {
  const event = createSeedProject().events.find(event => event.id === 'deal.player.left').exampleEvent;
  const before = structuredClone(event);
  const fields = Object.fromEntries(describeEventFields(event).map(field => [field.path, field]));
  assert.equal(fields.box.value, 0);
  assert.equal(fields.faceDown.value, false);
  assert.equal(fields['clip.prefer'].present, false);
  assert.equal(formatEventValue(fields['clip.prefer'].value), 'Saknas i detta exempel');
  assert.equal(formatEventValue(null), 'null');
  assert.equal(fields.variantId, undefined);
  assert.equal(fields.durationMs, undefined);
  assert.deepEqual(event, before);
});

test('expected payload fields cover generated deal inputs without exposing hidden card ranks', () => {
  const view = { round: { phase: 'decisions', holeDraw: 3, active: 0, legalActions: ['hit', 'stand'], hands: [{ box: 0, cards: [{ r: '9', s: '♥', shoeDraw: 1 }] }], dealer: [{ r: 'A', s: '♠', shoeDraw: 2 }] } };
  const events = presentationEvents(null, view, 'start');
  const deal = events.find(event => event.type === 'deal' && event.to === 'box');
  const fields = describeEventFields(deal);
  assert.ok(fields.every(field => field.present), 'real Partner deal includes the optional-in-example clip hints');
  assert.deepEqual(fields.find(field => field.path === 'card').value, { r: '9', s: '♥' });
  const hole = events.find(event => event.type === 'deal' && event.faceDown);
  assert.equal(describeEventFields(hole).find(field => field.path === 'card').value, null);
  const malformed = { ...hole, card: { r: 'K', s: '♠' } };
  assert.equal(describeEventFields(malformed).find(field => field.path === 'card').value, null);
  assert.deepEqual(malformed.card, { r: 'K', s: '♠' }, 'inspector must not modify incoming data');
});
