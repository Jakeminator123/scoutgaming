import test from 'node:test';
import assert from 'node:assert/strict';
import manifest from '../../emil/dealklipp-v1/lab-video-manifest.json' with { type: 'json' };
import { createSeedProject, validateProject } from '../lib/studio-model.mjs';
import { simulateStudio } from '../lib/studio-server.mjs';
import { mediaLineForEvent, mediaVideoForEvent, validateMediaPolicy, mediaSituationForEvent, upsertMediaVariantPolicy } from '../lib/media-family-policy.mjs';
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

function frequencyFixture() {
  const registry = inventory(), project = createSeedProject();
  const family = registry.families.find(row => row.situation === 'box2');
  const ids = ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'];
  family.variantIds = ids;
  for (const id of ids) registry.videos.push({ id, familyId: family.id, role: 'variant', fileName: `variant-${id}.mp4`, available: true });
  const language = project.triggers.find(trigger => trigger.path.includes('preferredLanguage'));
  project.mediaPolicy = [{ familyId: family.id, variants: ids.map((videoId, i) => ({ videoId, priority: 100 - i,
    triggerIds: language ? [language.id] : [], selection: { rules: false, model: false, random: false }, frequencyPercent: i === 0 ? 20 : 30 })) }];
  return { registry, project, family, ids };
}

test('saved deal percentages give exact shares including standard, without model calls or legacy language conditions', async () => {
  const { registry, project, ids } = frequencyFixture(), original = structuredClone(project);
  const counts = new Map();
  for (let i = 0; i < 100; i++) {
    const result = await simulateStudio(body(group(2), deal(2), { project, mode: 'active' }), { ...options(registry), random: () => (i + 0.5) / 100 });
    counts.set(result.videoGenerationId, (counts.get(result.videoGenerationId) ?? 0) + 1);
    assert.equal(result.provider, 'local_deal_frequency');
    assert.equal(result.decision.reason, 'local_deal_frequency');
    assert.deepEqual(result.decision.sourceEvent, deal(2));
  }
  assert.equal(counts.get(ids[0]), 20); assert.equal(counts.get(ids[1]), 30);
  assert.equal([...counts.values()].reduce((sum, n) => sum + n, 0), 100);
  assert.equal(counts.get(registry.families.find(family => family.situation === 'box2').standardIds[0]), 50);
  assert.deepEqual(project, original, 'Sampling must not edit the saved project.');
});

test('deal percentages have consistent boundaries and respect standard/shadow modes and exact destinations', async () => {
  const { registry, project, ids } = frequencyFixture();
  for (const mode of ['active', 'rules', 'random']) {
    for (const [random, selected] of [[0, ids[0]], [0.1999, ids[0]], [0.2, ids[1]], [0.4999, ids[1]], [0.5, null], [0.9999, null]]) {
      const result = await simulateStudio(body(group(2), deal(2), { project, mode }), { ...options(registry), random: () => random });
      assert.equal(result.decision.media.standard, selected === null);
      if (selected) assert.equal(result.videoGenerationId, selected);
    }
  }
  for (const mode of ['off', 'shadow']) {
    const result = await simulateStudio(body(group(2), deal(2), { project, mode }), { ...options(registry), random: () => 0 });
    assert.equal(result.decision.media.standard, true);
    assert.equal(result.decision.reason, mode === 'off' ? 'ai_disabled' : 'shadow_only');
  }
  const otherPlace = await simulateStudio(body(group(3), deal(3), { project, mode: 'off' }), options(registry));
  assert.equal(otherPlace.decision.media.fileName, 'deal_pos4.mp4');
});

test('missing and disabled deal variants return their own share to standard without increasing another share', async () => {
  const { registry, project, ids } = frequencyFixture();
  registry.videos.find(video => video.id === ids[0]).available = false;
  const decide = random => simulateStudio(body(group(2), deal(2), { project, mode: 'active' }), { ...options(registry), random: () => random });
  assert.equal((await decide(0.1)).decision.media.standard, true);
  assert.equal((await decide(0.2)).videoGenerationId, ids[1]);
  assert.equal((await decide(0.5)).decision.media.standard, true);
  registry.families.find(row => row.situation === 'box2').variantIds = [ids[1]];
  assert.equal((await decide(0.1)).decision.media.standard, true, 'Removed file cannot be sampled via its retained row.');
  for (const policy of project.mediaPolicy[0].variants) { policy.frequencyPercent = 0; policy.selection = { rules: true, model: true, random: true }; }
  assert.equal((await decide(0)).decision.media.standard, true, 'Zero must override old selection permissions.');
});

test('deal frequency validation rejects invalid percentages and scope; old policies still validate unchanged', () => {
  const { project } = frequencyFixture();
  const valid = project.mediaPolicy;
  for (const value of [-1, 101, 1.5, NaN, '20', null]) {
    const invalid = structuredClone(valid); invalid[0].variants[0].frequencyPercent = value;
    assert.throws(() => validateMediaPolicy(invalid, project.triggers.map(row => row.id)));
  }
  const sum = structuredClone(valid); sum[0].variants[0].frequencyPercent = 80;
  assert.throws(() => validateMediaPolicy(sum, project.triggers.map(row => row.id)), /100/);
  for (const familyId of ['vera/deal.player.centre/box2', 'astrid/speak.other/win', 'astrid/idle.ready/ready']) {
    assert.throws(() => validateMediaPolicy([{ ...valid[0], familyId }], project.triggers.map(row => row.id)));
  }
  const legacy = structuredClone(project);
  for (const row of legacy.mediaPolicy[0].variants) delete row.frequencyPercent;
  const before = structuredClone(legacy);
  assert.equal(validateProject(legacy), legacy); assert.deepEqual(legacy, before);
});

test('a later imported fifth file can replace zeroed old slots and actually play at its configured frequency', async () => {
  const { registry, project, family, ids } = frequencyFixture();
  for (const char of ['3', '4', '5']) {
    const id = `${char.repeat(8)}-${char.repeat(4)}-${char.repeat(4)}-${char.repeat(4)}-${char.repeat(12)}`;
    family.variantIds.push(id);
    registry.videos.push({ id, familyId: family.id, role: 'variant', available: true, fileName: `later-${char}.mp4` });
  }
  const zero = videoId => ({ videoId, frequencyPercent: 0, selection: { rules: true, model: true, random: true }, triggerIds: [], priority: 10 });
  project.mediaPolicy = [{ familyId: family.id, variants: family.variantIds.slice(0, 4).map(zero) }];
  const before = structuredClone(project.mediaPolicy), later = family.variantIds[4];
  project.mediaPolicy = upsertMediaVariantPolicy(project.mediaPolicy, family.id, { ...zero(later), frequencyPercent: 100 });
  assert.equal(project.mediaPolicy[0].variants.length, 1); assert.equal(before[0].variants.length, 4);
  validateProject(project);
  const picked = await simulateStudio(body(group(2), deal(2), { project, mode: 'active' }), { ...options(registry), random: () => 0.99 });
  assert.equal(picked.videoGenerationId, later);
  project.mediaPolicy = upsertMediaVariantPolicy(project.mediaPolicy, family.id, zero(later));
  assert.equal((await simulateStudio(body(group(2), deal(2), { project, mode: 'active' }), options(registry))).decision.media.standard, true);
  project.mediaPolicy = upsertMediaVariantPolicy(project.mediaPolicy, family.id, { ...zero(ids[0]), frequencyPercent: 25 });
  assert.equal(project.mediaPolicy[0].variants.length, 1);
});
