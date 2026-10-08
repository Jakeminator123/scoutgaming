import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSeedProject, normalizeProject, validateProject } from '../lib/studio-model.mjs';
import { createLegacyProject } from './fixtures/legacy-project.mjs';
import { retireDemoExamples } from '../lib/retire-demo-examples.mjs';
import { prepareProject } from '../start.mjs';

test('new defaults retain every event and dealer, with no demo triggers or unused assets', () => {
  const fresh = createSeedProject(), old = createLegacyProject();
  // The saved four-dealer project gains Dragge and Paow only through normalization.
  assert.deepEqual(fresh.events, old.events); assert.deepEqual(fresh.dealers.slice(0, 4), old.dealers);
  assert.equal(fresh.triggers.length, 0); assert.equal(fresh.lines.length, 96);
  assert.ok(fresh.lines.every(line => line.variants.length === 1 && line.variants[0].id === line.baselineVariantId));
  assert.ok(fresh.assets.every(asset => fresh.lines.some(line => line.variants.some(row => row.assetId === asset.id))));
  const cleaned = retireDemoExamples(normalizeProject(old)); validateProject(cleaned);
  for (const key of ['assets', 'triggers', 'lines']) assert.deepEqual(cleaned[key], fresh[key]);
  assert.deepEqual(retireDemoExamples(cleaned), cleaned);
});

test('migration preserves edited variants, edited dependencies and media-policy trigger references', () => {
  for (const edit of ['variant', 'asset', 'trigger', 'media']) {
    const project = createLegacyProject();
    const line = project.lines.find(line => line.variants.some(v => v.triggerIds.length));
    const variant = line.variants.find(v => v.triggerIds.length), trigger = project.triggers.find(row => row.id === variant.triggerIds[0]);
    if (edit === 'variant') variant.label = 'My own choice';
    if (edit === 'asset') project.assets.find(row => row.id === variant.assetId).label = 'My asset';
    if (edit === 'trigger') trigger.label = 'My condition';
    if (edit === 'media') project.mediaPolicy = [{ familyId: 'astrid/speak.other/greeting', variants: [{ videoId: '11111111-1111-1111-1111-111111111111', priority: 1, selection: { rules: true, model: false, random: false }, triggerIds: [trigger.id] }] }];
    const before = structuredClone(project), migrated = retireDemoExamples(project);
    validateProject(migrated); assert.deepEqual(project, before);
    assert.ok(migrated.triggers.some(row => row.id === trigger.id));
    if (edit !== 'media') assert.deepEqual(migrated.lines.find(row => row.id === line.id).variants.find(row => row.id === variant.id), variant);
  }
});

test('launcher keeps a complete pre-migration revision and migration is not repeated', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'croupier-demo-migration-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const old = createLegacyProject(); await writeFile(join(directory, 'project.json'), JSON.stringify(old));
  await prepareProject(directory);
  const history = await readdir(join(directory, 'history'));
  // History holds the loaded revision: the saved document plus the dealers normalization adds in memory.
  assert.equal(history.length, 1); assert.deepEqual(JSON.parse(await readFile(join(directory, 'history', history[0]), 'utf8')),
    normalizeProject(structuredClone(old), { allowIncompatibleAnimations: true, preserveMissingLanes: true }));
  const saved = await readFile(join(directory, 'project.json'), 'utf8');
  await prepareProject(directory); assert.equal(await readFile(join(directory, 'project.json'), 'utf8'), saved);
});
