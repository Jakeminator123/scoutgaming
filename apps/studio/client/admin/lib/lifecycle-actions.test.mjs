import test from 'node:test';
import assert from 'node:assert/strict';
import { addDealer, createEmptyProject } from '../../../../../packages/presentation/contracts/studio-model.mjs';
import { clipArchivePlan, clipDeletePlan, dealerArchivePlan, dealerDeletePlan, dealerRestorePlan } from './lifecycle-actions.mjs';

const a = '11111111-1111-4111-8111-111111111111', b = '22222222-2222-4222-8222-222222222222', sha256 = 'a'.repeat(64);
function fixture() {
  const project = addDealer(createEmptyProject(), 'paow-v2', 'PAOW');
  const video = { id: a, label: 'Vila 1', sha256, revision: 'studio.clip.1', available: true, integrity: 'verified',
    classification: { label: 'Vila 1', dealerId: 'paow-v2', eventId: 'idle.ready', kind: 'idle', role: 'standard', situation: '', notes: '' } };
  return { project, video, inventory: { videos: [video, { ...video, id: b, label: 'Vila 2', classification: { ...video.classification, label: 'Vila 2' } }] } };
}

test('archiving one unused clip is a single reversible step that names the clip and the archive', () => {
  const f = fixture(), plan = clipArchivePlan({ ...f, dealerId: 'paow-v2', ids: [a] });
  assert.equal(plan.title, 'Radera Vila 1?');
  assert.match(plan.summary, /flyttas till arkivet/); assert.match(plan.summary, /kan återställas/);
  assert.deepEqual(plan.items, ['Används inte i något sparat val.']);
  assert.equal(plan.confirmLabel, 'Radera'); assert.equal(plan.error, ''); assert.equal(plan.blocker, '');
});
test('a used clip shows its exact uses, offers no confirm button and tells the user how to free it', () => {
  const f = fixture(); f.project.lines.find(row => row.dealerId === 'paow-v2').variants[0].videoGenerationId = a;
  const plan = clipArchivePlan({ ...f, dealerId: 'paow-v2', ids: [a] });
  assert.equal(plan.blocker, 'studio_media_in_use'); assert.equal(plan.confirmLabel, undefined); assert.equal(plan.cancelLabel, 'Behåll');
  assert.equal(plan.items.length, 1); assert.match(plan.items[0], /^Används: /);
  assert.match(plan.error, /behöver mediafilen/); assert.match(plan.error, /Koppla loss klippet/);
});
test('batch archive lists every clip and states that the server stops the batch at the first refusal', () => {
  const f = fixture(), plan = clipArchivePlan({ ...f, dealerId: 'paow-v2', ids: [a, b] });
  assert.equal(plan.title, 'Radera 2 klipp?');
  assert.deepEqual(plan.items.slice(0, 2), ['Vila 1', 'Vila 2']); assert.match(plan.items.at(-1), /ett i taget/);
  const restore = clipArchivePlan({ ...f, dealerId: 'paow-v2', ids: [a], archived: false });
  assert.equal(restore.blocker, 'studio_conflict', 'an active clip cannot be restored'); assert.equal(restore.confirmLabel, undefined);
});
test('permanent clip deletion needs the server verdict; a refusal keeps the clip and explains the wait', () => {
  const { video } = fixture();
  const pending = clipDeletePlan({ video });
  assert.equal(pending.confirmLabel, undefined); assert.equal(pending.error, '');
  const allowed = clipDeletePlan({ video, eligibility: { allowed: true } });
  assert.equal(allowed.title, 'Radera Vila 1 permanent?'); assert.equal(allowed.confirmLabel, 'Radera permanent'); assert.match(allowed.summary, /inte att ångra/);
  const denied = clipDeletePlan({ video, eligibility: { allowed: false, reason: 'studio_media_upload_grant_active', retryAfterMs: 61_000 } });
  assert.equal(denied.confirmLabel, undefined); assert.equal(denied.cancelLabel, 'Behåll i arkivet');
  assert.match(denied.error, /uppladdningstillåtelse/); assert.match(denied.error, /om cirka 2 minuter/); assert.match(denied.summary, /ligger kvar i arkivet/);
  assert.doesNotMatch(clipDeletePlan({ video, eligibility: { allowed: false, reason: 'studio_media_published' } }).error, /Försök igen/);
});
test('dealer archive lists clips, compositions, rooms and companies from the server impact', () => {
  const impact = { dealerId: 'paow-v2', token: 'b'.repeat(64), mediaCount: 3, speechEnabled: true, compositions: [{ id: 'c', label: 'Standard' }], rooms: [{ id: 'r', name: 'Rum 1', operatorId: 'o' }], operators: [{ id: 'o', name: 'Nordic' }] };
  const plan = dealerArchivePlan({ label: 'PAOW', impact });
  assert.equal(plan.title, 'Ta bort PAOW?'); assert.equal(plan.confirmLabel, 'Flytta till papperskorgen');
  assert.deepEqual(plan.items, ['3 klipp följer med till papperskorgen', 'Sammansättning: Standard arkiveras', 'Rum: Rum 1 kopplas loss och avpubliceras', 'Spelbolag: Nordic får ett ändrat paket', 'AI-tal stängs av']);
  assert.match(plan.summary, /Källfiler och publiceringshistorik bevaras/);
  assert.deepEqual(dealerArchivePlan({ label: 'PAOW' }).items, [], 'no consequences are invented before the server answered');
  assert.deepEqual(dealerRestorePlan({ label: 'PAOW', compositions: [{ id: 'c', label: 'Standard' }] }).items, ['Sparade sammansättningar (1)', 'Sammansättning: Standard']);
});
test('permanent dealer deletion requires the file acknowledgement only when files are deleted', () => {
  const allowed = dealerDeletePlan({ label: 'PAOW', mediaCount: 2, eligibility: { allowed: true, count: 5 } });
  assert.equal(allowed.requiresAcknowledgement, true); assert.match(allowed.items[0], /^5 filer raderas/); assert.equal(allowed.confirmLabel, 'Radera permanent');
  const empty = dealerDeletePlan({ label: 'PAOW', mediaCount: 0, eligibility: { allowed: true } });
  assert.equal(empty.requiresAcknowledgement, false); assert.match(empty.items[0], /Inga egna filer/);
  const resume = dealerDeletePlan({ label: 'PAOW', mediaCount: 1, eligibility: { allowed: true }, pending: true });
  assert.equal(resume.title, 'Slutför raderingen av PAOW?'); assert.equal(resume.confirmLabel, 'Slutför radering');
  const denied = dealerDeletePlan({ label: 'PAOW', mediaCount: 1, eligibility: { allowed: false, reason: 'studio_dealer_published' } });
  assert.equal(denied.confirmLabel, undefined); assert.equal(denied.requiresAcknowledgement, false); assert.equal(denied.cancelLabel, 'Behåll i papperskorgen'); assert.match(denied.error, /publicerat bolagspaket/);
});
