import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import manifest from '../../emil/dealklipp-v1/lab-video-manifest.json' with { type: 'json' };
import { createSeedProject } from '../lib/studio-model.mjs';
import { buildOperatorCatalog } from '../lib/operator-catalog.mjs';
import { studioChat } from '../lib/studio-server.mjs';
import { prepareDecision, validateCatalog } from '../../open-claw/lab/src/engine.mjs';
import { createLabServer } from '../../open-claw/lab/src/server.mjs';
import { readSettings } from '../../open-claw/lab/src/settings.mjs';

const inventory = () => ({ families: structuredClone(manifest.families), videos: manifest.items.map(item => ({ ...item, fileName: item.relativePath.split('/').at(-1), available: true, previewUrl: `/api/videos/${item.id}` })) });
const message = { dealerId: 'astrid', message: 'Vilka videor och varianter finns?', conversationId: 'operator-manifest-fixture' };
const settings = { remoteUrl: 'https://fixture.invalid', remoteToken: 'fixture-only-token' };
const familyNode = (catalog, id) => catalog.events.find(node => node.label.startsWith(id + ' ·'));

test('operator catalog describes every exact real family, not the saved seed demos', () => {
  const project = createSeedProject(), before = structuredClone(project), registry = inventory();
  const catalog = buildOperatorCatalog(project, registry, 'astrid');
  assert.deepEqual(validateCatalog(catalog), { valid: true, errors: [] }, 'wire format stays accepted by existing relays');
  for (const family of registry.families) {
    const node = familyNode(catalog, family.id);
    assert.ok(node, family.id);
    assert.equal(node.variants.length, family.standardIds.length + family.variantIds.length);
    assert.equal(prepareDecision(catalog, { event: node.exampleEvent, mode: 'active' }).node.id, node.id);
  }
  for (let box = 0; box < 7; box++) {
    const node = catalog.events.find(node => node.match.box === box);
    assert.equal(node.exampleEvent.box, box);
    assert.ok(node.label.includes(`deal/deal_pos${box + 1}`));
    assert.ok(node.variants[0].label.startsWith(`deal_pos${box + 1}.mp4`));
  }
  const goodluck = familyNode(catalog, 'astrid/speak.goodluck/goodluck');
  assert.equal(goodluck.variants.length, 1);
  assert.equal(goodluck.variants[0].label, 'goodluck.mp4 · standard');
  for (const id of ['greeting', 'placebets', 'blackjack', 'win', 'lose']) {
    const node = familyNode(catalog, `astrid/speak.other/${id}`);
    assert.equal(node.exampleEvent.line, id);
    assert.ok(node.variants[0].label.startsWith(id + '.mp4'));
  }
  assert.ok(catalog.events.filter(node => !node.id.startsWith('operator.')).every(node => node.variants.length === 1 && node.variants[0].label.includes('2D-reserv')));
  assert.doesNotMatch(JSON.stringify(catalog), /Välkommen tillbaka|Rodnande tack|Lekfull dubbelvink|contextual|playful|relativePath|previewUrl|sha256/);
  assert.deepEqual(project, before, 'chat projection never migrates or saves the operator project');
});

test('idle inventory preserves two weighted bases and the real six one-shot uses', () => {
  const catalog = buildOperatorCatalog(createSeedProject(), inventory(), 'astrid');
  const node = familyNode(catalog, 'astrid/idle.ready/ready');
  assert.equal(node.variants.length, 8);
  const labels = node.variants.map(variant => variant.label).join('\n');
  assert.match(labels, /90 % grundvikt/);
  assert.match(labels, /10 % grundvikt/);
  assert.match(labels, /automatisk 25±5 s; paus 15 s; max 3\/min/);
  assert.match(labels, /OpenClaw \(idlepolicy\)/);
  assert.equal(node.variants.filter(variant => variant.label.endsWith(' · manuell')).length, 4);
});

test('real alternatives remain visible with explicit selection flags and matching triggers', () => {
  const project = createSeedProject(), registry = inventory();
  const family = registry.families.find(family => family.situation === 'goodluck');
  const id = '11111111-1111-1111-1111-111111111111';
  family.variantIds.push(id);
  registry.videos.push({ id, familyId: family.id, role: 'variant', available: true, fileName: 'goodluck_smile.mp4' });
  let catalog = buildOperatorCatalog(project, registry, 'astrid');
  assert.equal(familyNode(catalog, family.id).variants[1].label, 'goodluck_smile.mp4 · manuell');
  project.mediaPolicy = [{ familyId: family.id, variants: [{ videoId: id, selection: { rules: true, model: true, random: false }, priority: 27, triggerIds: [project.triggers[0].id] }] }];
  catalog = buildOperatorCatalog(project, registry, 'astrid');
  const variant = familyNode(catalog, family.id).variants[1];
  assert.equal(variant.label, 'goodluck_smile.mp4 · regler+OpenClaw');
  assert.equal(variant.priority, 27);
  const { path, op, value } = project.triggers[0];
  assert.deepEqual(variant.when.all, [{ path, op, value }]);
  assert.deepEqual(validateCatalog(catalog), { valid: true, errors: [] });
  registry.videos.at(-1).available = false;
  assert.match(familyNode(buildOperatorCatalog(project, registry, 'astrid'), family.id).variants[1].label, /otillgänglig/);
  registry.videos.at(-1).fileName = 'very-long-name-'.repeat(15) + '.mp4';
  const longLabel = familyNode(buildOperatorCatalog(project, registry, 'astrid'), family.id).variants[1].label;
  assert.equal(longLabel.length, 120);
  assert.match(longLabel, /otillgänglig; regler\+OpenClaw$/);
});

test('missing media is marked as fallback and never replaced by legacy demos or another family', () => {
  const registry = inventory();
  registry.videos.find(video => video.fileName === 'goodluck.mp4').available = false;
  const catalog = buildOperatorCatalog(createSeedProject(), registry, 'astrid');
  const node = familyNode(catalog, 'astrid/speak.goodluck/goodluck');
  assert.equal(node.variants.length, 1);
  assert.match(node.variants[0].label, /Ingen tillgänglig standardvideo · 2D-reserv/);
  assert.deepEqual(validateCatalog(catalog), { valid: true, errors: [] });
});

test('other dealers retain explicitly labelled legacy catalog without borrowing Astrid files', () => {
  for (const dealer of ['vera', 'amira', 'mei']) {
    const catalog = buildOperatorCatalog(createSeedProject(), inventory(), dealer);
    assert.deepEqual(validateCatalog(catalog), { valid: true, errors: [] });
    assert.equal(catalog.events.length, 16);
    assert.ok(catalog.events.flatMap(node => node.variants).every(variant => variant.label.includes('2D-prov')));
    assert.ok(!JSON.stringify(catalog).includes('deal_pos'));
  }
});

test('studio chat sends the current inventory through the existing authenticated remote contract', async () => {
  const registry = inventory(), project = createSeedProject(), before = structuredClone(project);
  let captured;
  const result = await studioChat(message, { settings, project, videoRegistry: registry, fetchImpl: async (url, options) => {
    captured = JSON.parse(options.body);
    assert.equal(String(url), 'https://fixture.invalid/api/studio/chat');
    assert.equal(options.headers.Authorization, 'Bearer fixture-only-token');
    assert.equal(options.redirect, 'error');
    assert.deepEqual(validateCatalog(captured.catalog), { valid: true, errors: [] });
    assert.doesNotThrow(() => prepareDecision(captured.catalog, captured.input));
    return Response.json({ reply: 'En standardvideo, inga varianter.', provider: { status: 'responded' } });
  } });
  assert.equal(result.reply, 'En standardvideo, inga varianter.');
  assert.match(captured.catalog.revision, /^operator-saved-/);
  assert.equal(familyNode(captured.catalog, 'astrid/speak.goodluck/goodluck').variants.length, 1);
  assert.deepEqual(project, before);
  assert.ok(!JSON.stringify(captured).includes('fixture-only-token'));
});

test('explicit unsaved draft is validated and scoped without being saved or replaced by stored project', async () => {
  const saved = createSeedProject(), draft = structuredClone(saved), registry = inventory();
  draft.idlePolicy.base[0].weight = 80; draft.idlePolicy.base[1].weight = 20;
  let captured;
  await studioChat({ ...message, project: draft }, { project: saved, videoRegistry: registry, settings, fetchImpl: async (_url, options) => {
    captured = JSON.parse(options.body);
    return Response.json({ reply: 'Utkast.', provider: { status: 'responded' } });
  } });
  assert.match(captured.catalog.revision, /^operator-draft-/);
  assert.match(captured.catalog.sourceNote, /osparat utkast/);
  assert.ok(familyNode(captured.catalog, 'astrid/idle.ready/ready').variants.some(variant => variant.label.includes('80 %')));
  assert.equal(saved.idlePolicy.base[0].weight, 90);
  await assert.rejects(studioChat({ ...message, project: { ...draft, privateShoe: ['SECRET'] } }, { settings, fetchImpl: () => assert.fail('Invalid draft must not reach a model') }), /okänt fält/);
});

test('catalog revision changes for manifest availability and idle selection, not only saved project revision', () => {
  const project = createSeedProject(), registry = inventory();
  const baseline = buildOperatorCatalog(project, registry, 'astrid').revision;
  registry.videos[0].available = false;
  assert.notEqual(buildOperatorCatalog(project, registry, 'astrid').revision, baseline);
  registry.videos[0].available = true;
  project.idlePolicy.base[0].weight = 80; project.idlePolicy.base[1].weight = 20;
  assert.notEqual(buildOperatorCatalog(project, registry, 'astrid').revision, baseline);
});

test('actual authenticated relay passes manifest inventory to the tool-less operator, not product speech', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'croupier-operator-catalog-'));
  const runtime = readSettings({ envFiles: [], env: { LAB_DATA_DIR: directory, LAB_API_TOKEN: 'fixture-relay-token',
    OPENCLAW_BASE_URL: 'http://127.0.0.1:18789', OPENCLAWAPI_KEY: 'fixture-gateway-key' } });
  let modelBody;
  const { server, store } = await createLabServer({ settings: () => runtime, fetchImpl: async (_url, options) => {
    modelBody = JSON.parse(options.body);
    return Response.json({ choices: [{ message: { content: 'Goodluck har en standardfil och inga varianter.' } }] });
  } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await rm(directory, { recursive: true, force: true }); });
  const before = await store.load();
  const reply = await studioChat(message, { project: createSeedProject(), videoRegistry: inventory(),
    settings: { remoteUrl: `http://127.0.0.1:${server.address().port}`, remoteToken: 'fixture-relay-token' } });
  assert.equal(reply.provider.status, 'responded');
  assert.equal(modelBody.model, 'openclaw/croupier-chat');
  assert.equal(modelBody.tool_choice, 'none');
  const payload = JSON.parse(modelBody.messages[1].content);
  assert.equal(familyNode(payload.catalog, 'astrid/speak.goodluck/goodluck').variants.length, 1);
  assert.equal(payload.catalog.events.filter(node => node.label.includes(' · deal/deal_pos')).length, 8);
  assert.match(modelBody.messages[0].content, /shadow asks for advice but still plays baseline/);
  assert.match(modelBody.messages[0].content, /Chat cannot modify the catalog/);
  assert.match(modelBody.messages[0].content, /croupier-speech handles player replies/);
  assert.doesNotMatch(JSON.stringify(payload), /fixture-relay-token|fixture-gateway-key|exampleEvent|privateShoe|playerId/);
  assert.deepEqual(await store.load(), before, 'operator advice never overwrites the deployed catalog');
});
