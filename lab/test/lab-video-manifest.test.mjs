import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MEDIA_FAMILY_DEFINITIONS,
  readLabVideoManifest,
  validateLabVideoManifest,
  videoIdFromSha256,
} from '../lib/lab-video-manifest.mjs';
import { buildLabVideoManifest, manifestJson } from '../../pipeline/build-lab-video-manifest.mjs';

const repositoryManifest = fileURLToPath(new URL('../../emil/dealklipp-v1/lab-video-manifest.json', import.meta.url));

async function fixture(t, { variant = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'croupier-manifest-v2-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const legacy = [];
  for (const definition of MEDIA_FAMILY_DEFINITIONS) {
    for (const relativePath of definition.standardPaths) {
      const bytes = Buffer.from(`standard:${relativePath}`);
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      legacy.push({ id: videoIdFromSha256(sha256), size: bytes.length, sha256, relativePath: `legacy/${legacy.length}.mp4` });
      const path = join(root, ...relativePath.split('/'));
      await mkdir(dirname(path), { recursive: true }); await writeFile(path, bytes);
    }
    const variantDirectory = join(root, ...definition.variantDirectory.split('/'));
    await mkdir(variantDirectory, { recursive: true }); await writeFile(join(variantDirectory, '.gitkeep'), '');
  }
  if (variant) {
    const path = join(root, 'idle/variant/idle_insulted_f73_s301.mp4');
    await writeFile(path, Buffer.from('one-shot-idle-variant'));
  }
  await writeFile(join(root, 'lab-video-manifest.json'), JSON.stringify({ schemaVersion: 1, source: 'legacy', items: legacy }));
  return { root, legacy };
}

test('checked-in manifest has 26 exact families, 33 hash-stable items and the locked idle roles', async () => {
  const manifest = await readLabVideoManifest(repositoryManifest);
  assert.equal(manifest.families.length, 26);
  assert.equal(manifest.items.length, 33);
  assert.equal(new Set(manifest.items.map(item => item.relativePath)).size, 33);
  for (const item of manifest.items) {
    assert.equal(item.id, videoIdFromSha256(item.sha256));
    assert.doesNotMatch(item.relativePath, /\.gitkeep$/);
  }
  const idle = manifest.families.find(family => family.id === 'astrid/idle.ready/ready');
  assert.equal(idle.standardIds.length, 2);
  assert.equal(idle.variantIds.length, 6);
  assert.deepEqual(
    idle.variantIds.map(id => manifest.items.find(item => item.id === id).relativePath).sort(),
    [
      'idle/variant/idle_blink_f73_s303.mp4',
      'idle/variant/idle_cheek_f73_s301.mp4',
      'idle/variant/idle_glance_f73_s301.mp4',
      'idle/variant/idle_insulted_f73_s301.mp4',
      'idle/variant/idle_smile.mp4',
      'idle/variant/idle_yawn.mp4',
    ],
  );
});

test('generator preserves legacy IDs by SHA, accepts empty variant folders and ignores gitkeep', async t => {
  const { root, legacy } = await fixture(t);
  const manifest = await buildLabVideoManifest({ root });
  assert.equal(manifest.items.length, 27);
  assert.ok(manifest.families.every(family => family.variantIds.length === 0));
  assert.deepEqual(new Set(manifest.items.map(item => item.id)), new Set(legacy.map(item => item.id)));
  assert.doesNotMatch(manifestJson(manifest), /gitkeep/);
  assert.equal(manifestJson(manifest), manifestJson(await buildLabVideoManifest({ root })), 'generation must be deterministic');
});

test('generator registers an allowed deep variant as inactive structural media only', async t => {
  const { root } = await fixture(t, { variant: true });
  const manifest = await buildLabVideoManifest({ root });
  const idle = manifest.families.find(family => family.id === 'astrid/idle.ready/ready');
  assert.equal(idle.variantIds.length, 1);
  const item = manifest.items.find(row => row.id === idle.variantIds[0]);
  assert.equal(item.role, 'variant');
  assert.equal(item.relativePath, 'idle/variant/idle_insulted_f73_s301.mp4');
  assert.equal(Object.hasOwn(item, 'selection'), false);
});

test('unexpected MP4 roots and traversal paths are rejected', async t => {
  const { root } = await fixture(t);
  await writeFile(join(root, 'rogue.mp4'), Buffer.from('rogue'));
  await assert.rejects(buildLabVideoManifest({ root }), /outside the allowed media roots/);
  const manifest = await readLabVideoManifest(repositoryManifest);
  const escaped = structuredClone(manifest); escaped.items[0].relativePath = '../outside.mp4';
  assert.throws(() => validateLabVideoManifest(escaped), /outside the allowed media roots/);
});

test('duplicate paths, IDs, hashes and exact family identities are rejected', async () => {
  const manifest = await readLabVideoManifest(repositoryManifest);
  const duplicatePath = structuredClone(manifest); duplicatePath.items[1].relativePath = duplicatePath.items[0].relativePath;
  assert.throws(() => validateLabVideoManifest(duplicatePath));
  const duplicateId = structuredClone(manifest); duplicateId.items[1].id = duplicateId.items[0].id;
  assert.throws(() => validateLabVideoManifest(duplicateId));
  const duplicateHash = structuredClone(manifest); duplicateHash.items[1].sha256 = duplicateHash.items[0].sha256;
  assert.throws(() => validateLabVideoManifest(duplicateHash));
  const duplicateFamily = structuredClone(manifest); duplicateFamily.families[1].id = duplicateFamily.families[0].id;
  assert.throws(() => validateLabVideoManifest(duplicateFamily));
});

test('symlinks inside the media bank are rejected before hashing', async t => {
  const { root } = await fixture(t);
  const outside = join(dirname(root), `${Date.now()}-outside.mp4`);
  await writeFile(outside, Buffer.from('outside'));
  t.after(() => rm(outside, { force: true }));
  const link = join(root, 'idle/variant/linked.mp4');
  try { await symlink(outside, link, 'file'); }
  catch (error) { if (['EPERM', 'EACCES'].includes(error.code)) { t.skip('Symlink creation is unavailable'); return; } throw error; }
  await assert.rejects(buildLabVideoManifest({ root }), /Symlinks are not allowed/);
});

test('schema file is valid JSON and describes strict v2 roots', async () => {
  const schema = JSON.parse(await readFile(new URL('../schemas/lab-video-manifest.schema.json', import.meta.url), 'utf8'));
  assert.equal(schema.properties.schemaVersion.const, 2);
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.$defs.item.additionalProperties, false);
  assert.match(JSON.stringify(schema.$defs.item.properties.relativePath), /deal_pos/);
});
