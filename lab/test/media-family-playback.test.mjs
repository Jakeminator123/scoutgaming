import test from 'node:test';
import assert from 'node:assert/strict';
import manifest from '../../emil/dealklipp-v1/lab-video-manifest.json' with { type: 'json' };
import { createSeedProject, validateProject } from '../lib/studio-model.mjs';
import { simulateStudio } from '../lib/studio-server.mjs';
import { mediaLineForEvent, mediaVideoForEvent, validateMediaPolicy, mediaSituationForEvent } from '../lib/media-family-policy.mjs';
import { createPresentationDirector } from '../lib/presentation-director.mjs';
import { presentationDecisionResponse } from '../lib/presentation-decision-http.mjs';

const inventory = () => ({ families: structuredClone(manifest.families), videos: manifest.items.map(item => ({ ...item, fileName: item.relativePath.split('/').at(-1), available: true, previewUrl: `/api/videos/${item.id}` })) });
const settings = { baseUrl: '', gatewayKey: '', adviceTimeoutMs: 50 };
const noFetch = () => assert.fail('Standard/rules preview must not contact a provider');
const body = (eventId, event, patch = {}) => ({ project: createSeedProject(), dealerId: 'astrid', eventId, sourceEvent: event, mode: 'off', context: {}, ...patch });
const options = videoRegistry => ({ videoRegistry, settings, fetchImpl: noFetch });
const deal = box => ({ type: 'deal', to: 'box', box, handIndex: 2, faceDown: false, card: { r: '5', s: '♠' }, shoeDraw: 19, clip: { action: box < 2 ? 'deal-left' : box < 5 ? 'deal-centre' : 'deal-right' } });
const group = box => `deal.player.${box < 2 ? 'left' : box < 5 ? 'centre' : 'right'}`;

test('ambiguous dealer visibility never resolves a hole or upcard video', () => {
  for (const faceDown of [undefined, null, 'false', 0]) assert.equal(mediaSituationForEvent('deal.dealer', { type: 'deal', to: 'dealer', faceDown }), null);
  assert.equal(mediaSituationForEvent('deal.dealer', { type: 'deal', to: 'dealer', faceDown: true }), 'dealer-hole');
  assert.equal(mediaSituationForEvent('deal.dealer', { type: 'deal', to: 'dealer', faceDown: false }), 'dealer-up');
});

test('real manifest selects all seven positional MP4s and preserves public card/hand data through HTTP', async () => {
  const registry = inventory();
  const decide = createPresentationDirector({ decide: input => simulateStudio(input, options(registry)) });
  for (let box = 0; box < 7; box++) {
    const input = body(group(box), deal(box), { requestId: `native-box-${box}`, sourceRef: { kind: 'observed', channel: 'fixture', presentationIndex: box, version: 1 } });
    const response = await presentationDecisionResponse(new Request('http://localhost:4188/api/presentation/decision', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:4188' }, body: JSON.stringify(input) }), decide);
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.decision.media.fileName, `deal_pos${box + 1}.mp4`);
    assert.deepEqual(result.decision.sourceEvent, input.sourceEvent);
    assert.equal(result.eligible.length, 1, 'old 2D demo variants must not reach the director');
    const clientVideo = mediaVideoForEvent(registry, 'astrid', group(box), result.decision.sourceEvent, result.videoGenerationId);
    assert.equal(clientVideo.fileName, `deal_pos${box + 1}.mp4`);
    assert.equal(result.decision.director.playbackConfirmed, false, 'selection is not a playback receipt');
  }
});

test('empty variant folders never call a model, even in active or shadow mode', async () => {
  for (const mode of ['active', 'shadow']) {
    const result = await simulateStudio(body(group(2), deal(2), { mode }), {
      videoRegistry: inventory(), settings: { remoteUrl: 'https://unused.invalid', remoteToken: 'fixture' }, fetchImpl: noFetch,
    });
    assert.equal(result.provider, 'only_standard_no_model');
    assert.equal(result.decision.media.fileName, 'deal_pos3.mp4');
  }
});

test('manual preview and native decisions use the same exact replik and do not mutate saved project', async () => {
  const registry = inventory(), project = createSeedProject(), before = structuredClone(project);
  for (const line of ['goodluck', 'win', 'lose', 'blackjack', 'chatter1']) {
    const eventId = line === 'goodluck' ? 'speak.goodluck' : 'speak.other';
    const event = { type: 'speak', line, blocking: true };
    const preview = mediaLineForEvent(project, registry, 'astrid', eventId, event);
    assert.equal(preview.line.variants.length, 1);
    const result = await simulateStudio(body(eventId, event, { project }), options(registry));
    assert.equal(result.videoGenerationId, preview.line.variants[0].videoGenerationId);
    assert.equal(result.decision.media.fileName, `${line}.mp4`);
  }
  assert.deepEqual(project, before);
});

test('missing exact media cannot borrow another box, original default, upcard or sentence', async () => {
  const registry = inventory();
  registry.videos.find(video => video.fileName === 'deal_pos3.mp4').available = false;
  for (const [id, event] of [[group(2), deal(2)], ['deal.dealer', { type: 'deal', to: 'dealer', box: null, handIndex: null, faceDown: true, clip: { action: 'deal-dealer' } }], ['speak.other', { type: 'speak', line: 'not_recorded' }]]) {
    const result = await simulateStudio(body(id, event), options(registry));
    assert.equal(result.videoGenerationId, null);
    assert.equal(result.decision.media.reason, 'no_exact_video_2d');
    assert.equal(result.eligible.length, 1);
  }
  assert.equal(mediaVideoForEvent(registry, 'astrid', group(2), deal(2), registry.videos.find(v => v.fileName === 'deal_pos4.mp4').id), null);
});

test('folder variants need explicit per-family permission before rules, random or OpenClaw can choose', async () => {
  const registry = inventory(), project = createSeedProject();
  const family = registry.families.find(row => row.situation === 'box2');
  const id = '11111111-1111-1111-1111-111111111111';
  family.variantIds = [id];
  registry.videos.push({ id, familyId: family.id, role: 'variant', fileName: 'deal_pos3_smile.mp4', available: true, previewUrl: `/api/videos/${id}` });
  const input = body(group(2), deal(2), { project, mode: 'rules' });
  assert.equal((await simulateStudio(input, options(registry))).eligible.length, 1);
  project.mediaPolicy = [{ familyId: family.id, variants: [{ videoId: id, priority: 20, triggerIds: [], selection: { rules: true, model: true, random: true } }] }];
  assert.equal(validateProject(project), project);
  assert.equal((await simulateStudio(input, options(registry))).videoGenerationId, id);
  const seen = [];
  const result = await simulateStudio({ ...input, mode: 'active' }, { videoRegistry: registry, settings: { ...settings, baseUrl: 'http://localhost:18789', gatewayKey: 'fixture' }, fetchImpl: async (_url, init) => {
    const opportunity = JSON.parse(JSON.parse(init.body).messages[1].content); seen.push(opportunity);
    return Response.json({ choices: [{ message: { content: JSON.stringify({ requestId: opportunity.requestId, catalogRevision: opportunity.catalogRevision, variantId: opportunity.candidates.find(v => v.variantId.includes(id)).variantId }) } }] });
  } });
  assert.equal(result.videoGenerationId, id);
  assert.deepEqual(seen[0].event.card, deal(2).card);
  const neighbour = await simulateStudio(body(group(3), deal(3), { project, mode: 'rules' }), options(registry));
  assert.equal(neighbour.decision.media.fileName, 'deal_pos4.mp4');
  registry.videos.find(video => video.id === id).available = false;
  assert.equal((await simulateStudio(input, options(registry))).decision.media.fileName, 'deal_pos3.mp4');
});

test('media policy rejects unknown triggers, duplicate entries and more than four variants', () => {
  const variant = { videoId: '11111111-1111-1111-1111-111111111111', priority: 10, triggerIds: [], selection: { rules: false, model: false, random: false } };
  const row = { familyId: 'astrid/deal.player.left/box0', variants: [variant] };
  assert.throws(() => validateMediaPolicy([row, row]));
  assert.throws(() => validateMediaPolicy([{ ...row, variants: [variant, variant] }]));
  assert.throws(() => validateMediaPolicy([{ ...row, variants: [{ ...variant, triggerIds: ['unknown'] }] }]));
  assert.throws(() => validateMediaPolicy([{ ...row, variants: Array(5).fill(variant) }]));
});

test('other dealers keep their independent shared original-player path', () => {
  const project = createSeedProject();
  for (const dealer of ['vera', 'amira', 'mei']) {
    const view = mediaLineForEvent(project, inventory(), dealer, 'speak.goodluck', { type: 'speak', line: 'goodluck' });
    assert.equal(view.managed, false);
    assert.equal(view.line, project.lines.find(row => row.dealerId === dealer && row.eventId === 'speak.goodluck'));
  }
});
