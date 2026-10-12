import { createLegacyProject as createSeedProject } from './fixtures/legacy-project.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import schema from '../schemas/studio.schema.json' with { type: 'json' };
import seedDocument from '../policies/project.seed.json' with { type: 'json' };
import {
  validateProject, buildRuntimeCatalog, addVariant, removeVariant,
  removeTrigger, renameEvent, renameLine, DEALER_IDS, SOURCE_TYPES, allowedPathDescriptors,
  StudioValidationError, isAssetCompatible, createSeedProject as createStudioSeed,
  normalizeProject, defaultPresentationLane, createEmptyProject, addDealer
} from '../lib/studio-model.mjs';
import { PROBE_MODELS } from '../lib/probe-policy.mjs';
import { validateCatalog, prepareDecision, finalizeDecision } from '../../open-claw/lab/src/engine.mjs';

test('legacy projects retain blackjack, four dealers, sixteen locked nodes and 64 editable lines', () => {
  const p = createSeedProject();
  assert.equal(validateProject(p), p);
  assert.equal(p.gameId, 'blackjack');
  assert.deepEqual(p.dealers.map(d => d.id), DEALER_IDS);
  assert.equal(p.events.length, 16);
  assert.deepEqual([...new Set(p.events.map(e => e.sourceType))].sort(), [...SOURCE_TYPES].sort());
  assert.equal(p.lines.length, 64);
  assert.ok(p.lines.every(line => line.variants.length === 4));
  assert.equal(p.assets.length, 64);
  assert.equal(p.idlePolicy.base.length, 2);
  assert.equal(p.idlePolicy.variants.length, 13);
  assert.equal(schema.properties.events.minItems, p.events.length);
  assert.equal(schema.$defs.idlePolicy.properties.variants.maxItems, 30);
  assert.equal(schema.$defs.variant.properties.videoGenerationId.oneOf[0].type, 'null');
});

test('seed clones are isolated and JSON round-trips', () => {
  const first = createSeedProject(); first.events[0].label = 'Mitt namn';
  const second = createSeedProject();
  assert.notEqual(second.events[0].label, first.events[0].label);
  assert.deepEqual(validateProject(JSON.parse(JSON.stringify(first))), first);
});

test('JSON schema agrees with model variant limits and allowed predicate fields/values', () => {
  assert.equal(schema.$defs.line.properties.variants.minItems, 1);
  assert.equal(schema.$defs.line.properties.variants.maxItems, 5);
  assert.equal(schema.$defs.variant.properties.triggerIds.maxItems, 16);
  assert.equal(schema.properties.triggers.maxItems, 128);
  assert.equal(schema.properties.lines.minItems, 0);
  assert.equal(schema.properties.lines.maxItems, 512);
  assert.equal(schema.$defs.trigger.oneOf.length, allowedPathDescriptors.length);
  for (const descriptor of allowedPathDescriptors) {
    const entry = schema.$defs.trigger.oneOf.find(item => item.properties.path.const === descriptor.path);
    assert.ok(entry, descriptor.path);
    assert.equal(entry.properties.category.const, descriptor.category);
    assert.deepEqual(entry.properties.op.enum, descriptor.operators);
    const comparisons = entry.allOf[0];
    assert.equal(comparisons.then.properties.value.type, 'boolean');
    const membership = comparisons.else.then.properties.value;
    assert.equal(membership.maxItems, 32);
    const scalar = comparisons.else.else.properties.value;
    assert.deepEqual(membership.items, scalar);
    if (descriptor.values) assert.deepEqual(scalar.enum, descriptor.values);
    if (descriptor.kind === 'number') {
      assert.equal(scalar.type, 'integer');
      assert.equal(scalar.minimum, descriptor.min);
      assert.equal(scalar.maximum, descriptor.max);
    }
  }
});

test('labels can be edited without changing source IDs or source matches', () => {
  const p = createSeedProject();
  const renamed = renameEvent(p, p.events[0].id, 'Min hälsning');
  const withLine = renameLine(renamed, 'astrid', p.events[0].id, 'Astrids standardlinje');
  assert.equal(withLine.events[0].label, 'Min hälsning');
  assert.equal(withLine.lines[0].label, 'Astrids standardlinje');
  assert.deepEqual(withLine.events[0].match, p.events[0].match);
  assert.equal(withLine.events[0].id, p.events[0].id);
  assert.notEqual(p.events[0].label, withLine.events[0].label);
});

test('source IDs, match rules, examples, source types and ordered fallback cannot be edited', () => {
  for (const change of [
    p => { p.events[0].id = 'fake.event'; },
    p => { p.events[0].sourceType = 'pickup'; },
    p => { p.events[0].match = { line: 'placebets' }; },
    p => { p.events[0].exampleEvent.futureCard = 'A'; },
    p => { [p.events[0], p.events[3]] = [p.events[3], p.events[0]]; }
  ]) {
    const p = createSeedProject(); change(p);
    assert.throws(() => validateProject(p), /källkontrakt|eventordning/);
  }
});

test('unknown project fields and future/private predicates are rejected', () => {
  for (const field of ['context.futureCards', 'event.rng', 'event.shoe', 'context.wallet', '__proto__.polluted']) {
    const p = createSeedProject(); p.triggers[0].path = field;
    assert.throws(() => validateProject(p), /fältet är inte tillåtet/);
  }
  const p = createSeedProject(); p.playerDatabase = {};
  assert.throws(() => validateProject(p), /okänt fält playerDatabase/);
});

test('trigger value, operator and category are bounded by the selected field', () => {
  for (const change of [
    p => { p.triggers[0].op = 'eval'; },
    p => { p.triggers[0].value = 'yes'; },
    p => { p.triggers[0].category = 'deterministic'; },
    p => { p.triggers.find(t => t.id === 'recent-losses').value = -1; },
    p => { p.triggers.find(t => t.id === 'warm-mood').value = 'addicted'; }
  ]) {
    const p = createSeedProject(); change(p);
    assert.throws(() => validateProject(p), StudioValidationError);
  }
  assert.ok(allowedPathDescriptors.some(d => d.path === 'context.temperament.mood'));
});

test('duplicate event, dealer, trigger, asset, variant and line IDs are rejected', () => {
  for (const change of [
    p => { p.events[1] = structuredClone(p.events[0]); },
    p => { p.dealers[1].id = p.dealers[0].id; },
    p => { p.triggers[1].id = p.triggers[0].id; },
    p => { p.assets[1].id = p.assets[0].id; },
    p => { p.lines[0].variants[1].id = p.lines[0].variants[0].id; },
    p => { p.lines[1] = structuredClone(p.lines[0]); }
  ]) {
    const p = createSeedProject(); change(p);
    assert.throws(() => validateProject(p), /dubblerat ID/);
  }
});

test('missing and conditional baseline variants are rejected', () => {
  const p = createSeedProject(), first = p.lines[0];
  assert.throws(() => removeVariant(p, first.dealerId, first.eventId, first.baselineVariantId), /standardvarianten får inte tas bort/);
  first.variants.shift();
  assert.throws(() => validateProject(p), /standardvarianten måste finnas/);
  const conditional = createSeedProject(); conditional.lines[0].variants[0].triggerIds = ['chat-praise'];
  assert.throws(() => validateProject(conditional), /ovillkorlig/);
  const replaced = createSeedProject(); replaced.lines[0].baselineVariantId = replaced.lines[0].variants[1].id;
  assert.throws(() => validateProject(replaced), /stabila ID/);
});

test('unknown references and missing dealer/event lines fail before saving', () => {
  for (const change of [
    p => { p.lines[0].variants[1].triggerIds = ['missing-trigger']; },
    p => { p.lines[0].variants[1].assetId = 'missing-asset'; },
    p => { p.lines[0].dealerId = 'unknown'; },
    p => { p.lines[0].eventId = 'unknown'; },
    p => { p.lines.pop(); }
  ]) {
    const p = createSeedProject(); change(p);
    assert.throws(() => validateProject(p), StudioValidationError);
  }
});

test('alternatives can be added and removed, at most four plus permanent baseline', () => {
  let p = createSeedProject(); const line = p.lines[0];
  for (let n = line.variants.length; n < 5; n++) p = addVariant(p, line.dealerId, line.eventId, `Alternativ ${n}`);
  assert.equal(p.lines[0].variants.length, 5);
  assert.throws(() => addVariant(p, line.dealerId, line.eventId), /högst fyra/);
  const removedId = p.lines[0].variants[2].id;
  p = removeVariant(p, line.dealerId, line.eventId, removedId);
  assert.equal(p.lines[0].variants.length, 4);
  assert.equal(p.lines[0].baselineVariantId, line.baselineVariantId);
  assert.ok(!p.lines[0].variants.some(v => v.id === removedId));
});

test('referenced triggers cannot be removed until explicitly detached from every dealer', () => {
  const p = createSeedProject();
  assert.throws(() => removeTrigger(p, 'returning-player'), /Koppla först bort den uttryckligen/);
  assert.ok(p.triggers.some(t => t.id === 'returning-player'));
  for (const line of p.lines) for (const variant of line.variants) variant.triggerIds = variant.triggerIds.filter(id => id !== 'returning-player');
  const removed = removeTrigger(p, 'returning-player');
  assert.ok(!removed.triggers.some(t => t.id === 'returning-player'));
  assert.ok(removed.lines.every(line => line.variants.every(v => !v.triggerIds.includes('returning-player'))));
  validateProject(removed);
  const detached = createSeedProject();
  for (const line of detached.lines) for (const variant of line.variants) variant.triggerIds = variant.triggerIds.filter(id => id !== 'warm-mood');
  const unused = removeTrigger(detached, 'warm-mood');
  assert.ok(!unused.triggers.some(t => t.id === 'warm-mood'));
});

test('video links are generation IDs only and never change runtime source events', () => {
  const p = createSeedProject(); p.lines[0].variants[1].videoGenerationId = 'generation-123';
  validateProject(p);
  const catalog = buildRuntimeCatalog(p, 'astrid');
  assert.equal(catalog.events[0].variants[1].videoGenerationId, undefined);
  assert.deepEqual(catalog.events[0].exampleEvent, p.events[0].exampleEvent);
  for (const path of ['C:/Videos/test.mp4', '../../secret.txt', 'https://unknown.invalid/file.mp4']) {
    p.lines[0].variants[1].videoGenerationId = path;
    assert.throws(() => validateProject(p), /generationId/);
  }
});

test('all dealer catalogues round-trip through the real legacy engine', () => {
  const p = createSeedProject();
  for (const dealerId of DEALER_IDS) {
    const catalog = buildRuntimeCatalog(p, dealerId);
    assert.deepEqual(validateCatalog(catalog), { valid: true, errors: [] });
    for (const event of p.events) {
      const prepared = prepareDecision(catalog, { requestId: `${dealerId}.${event.id}`, event: event.exampleEvent });
      assert.equal(prepared.node.id, event.id);
      assert.ok(prepared.baseline.id.startsWith(`${dealerId}.`));
      const result = finalizeDecision(prepared, null, 'off');
      assert.equal(result.selected.id, prepared.baseline.id);
      assert.deepEqual(result.event, event.exampleEvent);
    }
  }
});

test('social and deterministic predicates survive conversion; other dealer advice cannot cross over', () => {
  const p = createSeedProject(), catalog = buildRuntimeCatalog(p, 'astrid');
  const prepared = prepareDecision(catalog, { requestId: 'conversion-test', event: p.events[0].exampleEvent, mode: 'active', context: { playerHistory: { returning: true, preferredLanguage: 'de' } } });
  assert.equal(prepared.eligible.length, 2);
  const contextual = prepared.eligible.find(v => v.id.endsWith('.contextual'));
  const accepted = finalizeDecision(prepared, { requestId: prepared.requestId, catalogRevision: p.revision, variantId: contextual.id }, 'active');
  assert.equal(accepted.gate.accepted, true);
  const wrongDealer = finalizeDecision(prepared, { requestId: prepared.requestId, catalogRevision: p.revision, variantId: contextual.id.replace('astrid.', 'vera.') }, 'active');
  assert.equal(wrongDealer.gate.reason, 'ineligible_variant');
});

test('temperament is an explicit croupier mood predicate, not inferred player emotion', () => {
  const p = createSeedProject(); p.lines[0].variants[1].triggerIds = ['warm-mood'];
  const catalog = buildRuntimeCatalog(p, 'astrid');
  assert.deepEqual(catalog.events[0].variants[1].when.all, [{ path: 'context.temperament.mood', op: 'eq', value: 'warm' }]);
  assert.deepEqual(validateCatalog(catalog), { valid: true, errors: [] });
  const warm = prepareDecision(catalog, { requestId: 'mood-warm', event: p.events[0].exampleEvent, context: { temperament: { mood: 'warm' } } });
  assert.equal(warm.eligible.length, 2);
  assert.equal(warm.context.temperament.mood, 'warm');
  const calm = prepareDecision(catalog, { requestId: 'mood-calm', event: p.events[0].exampleEvent, context: { temperament: { mood: 'calm' } } });
  assert.equal(calm.eligible.length, 1);
  assert.equal(p.triggers.find(t => t.id === 'warm-mood').category, 'temperament');
  p.triggers.find(t => t.id === 'warm-mood').path = 'context.player.emotion';
  assert.throws(() => validateProject(p), /fältet är inte tillåtet/);
});

test('synthetic new variants preserve source contracts and do not invent video bindings', () => {
  const p = createSeedProject();
  for (const line of p.lines) {
    assert.equal(line.variants[0].triggerIds.length, 0);
    assert.ok(line.variants.every(v => v.videoGenerationId === null));
    assert.deepEqual(line.variants[2].triggerIds, ['chat-praise', 'warm-mood']);
    assert.deepEqual(line.variants[3].triggerIds, ['playful-mood', 'recent-wins']);
  }
});

test('old two-variant projects stay valid; no auto-expansion or label replacement', () => {
  const p = createSeedProject();
  p.lines.forEach(line => { line.variants = line.variants.slice(0, 2); });
  p.assets = p.assets.filter(asset => !/\.motion[34]$/.test(asset.id));
  p.events[0].label = 'Mitt sparade namn';
  const before = structuredClone(p);
  assert.deepEqual(validateProject(p), before);
  assert.equal(p.lines[0].variants.length, 2);
});

test('old projects without idle policy remain readable while edited policies are validated', () => {
  const legacy = createSeedProject(); delete legacy.idlePolicy;
  assert.equal(validateProject(legacy), legacy);
  const invalid = createSeedProject(); invalid.idlePolicy.base[0].weight = 80;
  assert.throws(() => validateProject(invalid), /idlePolicy.*summera till 100/);
});

test('empty startup and saved projects without compositions never choose a dealer', () => {
  assert.equal(schema.properties.schemaVersion.const, 1);
  assert.equal(schema.required.includes('lanes'), false);
  assert.equal(schema.required.includes('clipLabels'), false);
  assert.deepEqual(schema.$defs.openClawMode.enum, ['off', 'rules', 'random', 'shadow', 'active']);
  assert.deepEqual(schema.$defs.laneBackground.properties.mode.enum, ['baked', 'image', 'video']);
  assert.equal(schema.$defs.lane.required.includes('probe'), false);
  assert.equal(schema.$defs.lane.required.includes('idle'), false);
  assert.equal(schema.$defs.laneBackground.required.includes('zones'), false);
  assert.equal(schema.$defs.laneTable.required.includes('colors'), false);
  assert.equal(schema.$defs.laneBackground.properties.zones.maxItems, 32);
  assert.equal(schema.$defs.laneBackground.properties.zones.items.pattern, '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$');
  assert.equal(schema.$defs.laneTable.properties.colors.maxItems, 16);
  assert.equal(schema.$defs.laneTable.properties.colors.items.pattern, '^#[0-9a-f]{6}$');
  assert.deepEqual(schema.$defs.laneProbe.required, ['mode']);
  assert.deepEqual(schema.$defs.laneProbe.properties.mode.enum, ['off', 'shadow', 'active']);
  assert.deepEqual(schema.$defs.laneProbe.properties.model.enum, PROBE_MODELS.map(model => model.id));
  assert.equal(Object.hasOwn(schema.$defs.laneIdle, 'required'), false);
  assert.equal(schema.$defs.laneIdle.properties.frequencyPercent.minimum, 0);
  assert.equal(schema.$defs.laneIdle.properties.frequencyPercent.maximum, 100);
  assert.equal(schema.$defs.laneIdle.properties.variants.maxItems, 32);
  for (const key of Object.keys(seedDocument)) assert.ok(schema.properties[key], key);
  assert.equal(Object.hasOwn(seedDocument, 'lanes'), false);
  const raw = structuredClone(seedDocument);
  assert.equal(validateProject(raw), raw);
  assert.equal(Object.hasOwn(raw, 'lanes'), false);
  const seeded = createStudioSeed();
  assert.equal(validateProject(seeded), seeded);
  assert.equal(seeded.schemaVersion, 1);
  assert.deepEqual(seeded.lanes, []);
  const legacy = createSeedProject();
  assert.equal(Object.hasOwn(legacy, 'lanes'), false);
  const before = structuredClone(legacy);
  assert.equal(validateProject(legacy), legacy);
  assert.deepEqual(legacy, before);
  const normalized = normalizeProject(structuredClone(legacy));
  assert.deepEqual(normalized.lanes, []);
  assert.equal(normalized.schemaVersion, 1);
  const emptied = structuredClone(legacy);
  emptied.lanes = [];
  assert.deepEqual(normalizeProject(emptied).lanes, []);
  assert.equal(validateProject(emptied).lanes.length, 0);
});

test('invalid lane id, unknown dealer, allowed outside dealers, duplicate ids and unknown openclaw mode are rejected', () => {
  const base = () => normalizeProject({...structuredClone(createSeedProject()), lanes:[defaultPresentationLane('astrid')]});
  const invalidId = base();
  invalidId.lanes[0].id = 'original';
  assert.throws(() => validateProject(invalidId), /lane-id/);
  const unknownDealer = base();
  unknownDealer.lanes[0].dealers = ['nope'];
  assert.throws(() => validateProject(unknownDealer), /okänd dealer/);
  const outside = base();
  outside.lanes[0].layers.dealer.allowed = ['vera'];
  assert.throws(() => validateProject(outside), /lane\.dealers/);
  const duplicate = base();
  duplicate.lanes.push(structuredClone(duplicate.lanes[0]));
  assert.throws(() => validateProject(duplicate), /dubblerat ID/);
  const mode = base();
  mode.lanes[0].openclaw.probe = 'auto';
  assert.throws(() => validateProject(mode), /okänt läge/);
  const labels = base();
  labels.clipLabels = { '11111111-1111-4111-8111-111111111111': 'Min tagning' };
  assert.equal(validateProject(labels).clipLabels['11111111-1111-4111-8111-111111111111'], 'Min tagning');
  labels.clipLabels['11111111-1111-4111-8111-111111111111'] = 'x'.repeat(81);
  assert.throws(() => validateProject(labels), /clipLabels/);
});

test('lab assets cannot reverse a published deal or replace a reveal', () => {
  for (const eventId of ['deal.player.left', 'reveal.dealer', 'speak.goodluck', 'settle.win', 'idle.ready']) {
    const p = createSeedProject();
    const line = p.lines.find(line => line.dealerId === 'astrid' && line.eventId === eventId);
    const event = p.events.find(event => event.id === eventId);
    const wrongAsset = p.assets.find(asset => asset.id === 'deal.player.right.standard');
    assert.equal(isAssetCompatible(event, wrongAsset), false);
    line.variants[0].assetId = wrongAsset.id;
    assert.throws(() => validateProject(p), /delningsriktning eller kortvändning/);
  }
});

test('composition construction requires an explicit dealer and normalization preserves saved choices',()=>{
  for(const dealer of [undefined,null,'','Not a dealer',42]) assert.throws(()=>defaultPresentationLane(dealer),StudioValidationError);
  const project=createStudioSeed(),lane=defaultPresentationLane('vera');
  assert.deepEqual(lane.dealers,['vera']);assert.equal(lane.layers.dealer.default,'vera');assert.deepEqual(lane.layers.dealer.allowed,['vera']);
  project.lanes=[lane];const before=structuredClone(project);
  assert.equal(normalizeProject(project),project);assert.deepEqual(project,before);
});
test('a fresh installation has no dealer, composition or borrowed idle and can register its first dealer',()=>{
  const project=createEmptyProject();
  assert.deepEqual(project.dealers,[]);assert.deepEqual(project.lines,[]);assert.deepEqual(project.lanes,[]);assert.equal(Object.hasOwn(project,'idlePolicy'),false);
  assert.equal(schema.properties.dealers.minItems,0);assert.equal(schema.properties.lines.minItems,0);
  assert.equal(validateProject(project),project);
  const registered=addDealer(project,'johanna','Johanna');
  assert.deepEqual(registered.dealers,[{id:'johanna',label:'Johanna'}]);assert.equal(registered.lines.length,project.events.length);
  assert.ok(registered.lines.every(line=>line.dealerId==='johanna'&&line.variants.every(variant=>variant.videoGenerationId===null)));
  registered.lanes=[defaultPresentationLane('johanna')];assert.equal(validateProject(registered),registered);
  assert.deepEqual(project.dealers,[]);assert.deepEqual(createEmptyProject().lanes,[]);
});
test('normalization preserves historical policy and explicit bindings without expanding legacy situations',()=>{
  const project=createStudioSeed();
  project.legacyClipPolicy=[{dealerId:'vera',part:'idle',clipId:'vera:legacy/idle'},
    {dealerId:'vera',part:'box3',clipId:'vera:legacy/box3'},
    {dealerId:'amira',part:'think',clipId:'amira:legacy/think'}];
  project.lines.find(row=>row.dealerId==='amira'&&row.eventId==='idle.ready').variants[0].videoGenerationId='11111111-1111-4111-8111-111111111111';
  const before=structuredClone(project);
  assert.equal(normalizeProject(project),project);assert.deepEqual(project,before);
  const {lanes,...missingLanes}=structuredClone(project), normalized=normalizeProject(missingLanes);
  assert.deepEqual(normalized,{...before,lanes:[]});assert.equal(Object.hasOwn(missingLanes,'lanes'),false);
});

test('new retired dealers and compositions are refused while historical Amira remains readable without loss',()=>{
  const empty=createEmptyProject();
  assert.throws(()=>addDealer(empty,'amira','Amira'),StudioValidationError);
  assert.throws(()=>defaultPresentationLane('amira'),StudioValidationError);
  assert.deepEqual(empty.dealers,[]);assert.deepEqual(empty.lines,[]);
  const saved=createStudioSeed(), historical=defaultPresentationLane('astrid');
  historical.dealers=['amira'];historical.layers.dealer={enabled:true,default:'amira',allowed:['amira']};
  saved.lanes=[historical];const before=structuredClone(saved);
  assert.equal(normalizeProject(saved),saved);assert.deepEqual(saved,before);
  assert.ok(saved.dealers.some(row=>row.id==='amira'));assert.ok(saved.lines.some(row=>row.dealerId==='amira'));
});