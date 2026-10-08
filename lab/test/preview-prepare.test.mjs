import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { previewBuildDirectory } from '../lib/preview-files.mjs';
import { preparePreview } from '../tools/prepare-preview.mjs';

const lab = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(lab, '..');
const previewRoot = join(repo, 'test-videoeditor/preview');
const webRoot = join(repo, 'test-videoeditor/program/web');

async function removeTemp(path) {
  assert.ok(resolve(path).startsWith(resolve(tmpdir())));
  await rm(path, { recursive: true, force: true });
}

test('reviewed preview media is hashed into the private build directory with relative paths', async () => {
  assert.match(previewBuildDirectory.replaceAll('\\', '/'), /\/lab\/preview-build$/);
  const output = await mkdtemp(join(tmpdir(), 'croupier-preview-'));
  const sourcePreview = await readFile(join(previewRoot, 'site/preview.js'));
  try {
    const result = await preparePreview({ previewRoot, webRoot, output });
    assert.equal(result.mediaFiles > 0, true);
    const catalog = JSON.parse(await readFile(join(output, 'catalog.json'), 'utf8'));
    assert.equal(catalog.lanes.length, 2);
    const seen = new Set();
    for (const lane of catalog.lanes) {
      assert.equal(Object.keys(lane.dealer.variants).length, 1);
      const variant = lane.dealer.variants[lane.scene.variant];
      assert.equal(variant.settings.width, 720);
      for (const role of ['clips', 'posters']) for (const record of Object.values(variant[role])) seen.add(record.src);
    }
    for (const asset of catalog.assets) seen.add(asset.src);
    assert.equal(seen.size, result.mediaFiles);
    const hashes = JSON.parse(await readFile(join(output, 'media-hashes.json'), 'utf8'));
    for (const name of await readdir(join(output, 'media'))) {
      const digest = createHash('sha256').update(await readFile(join(output, 'media', name))).digest('hex');
      assert.equal(digest, hashes[name], name);
    }
    const names = await readdir(output);
    assert.ok(names.includes('player.js') && names.includes('geometry.js') && names.includes('compositor.js'));
    assert.equal(await readFile(join(output, 'player.js'), 'utf8'), await readFile(join(webRoot, 'player.js'), 'utf8'));
    const html = await readFile(join(output, 'index.html'), 'utf8');
    const script = await readFile(join(output, 'preview.js'), 'utf8');
    assert.match(html, /href="preview\.css"/);
    assert.match(html, /src="preview\.js"/);
    assert.match(script, /new URL\('\.\/', import\.meta\.url\)/);
    assert.match(script, /new URL\('catalog\.json', import\.meta\.url\)/);
    assert.doesNotMatch(html + script, /\/test/);
    assert.match(script, /from '\.\/player\.js'/);
    assert.equal(existsSync(join(lab, 'public', 'preview')), false);
    assert.doesNotMatch(JSON.stringify(catalog), /C:\\|source_sha256|X-Studio-Token|\.env|imports\//);
    assert.deepEqual(await readFile(join(previewRoot, 'site/preview.js')), sourcePreview);
    const firstHtml = await readFile(join(output, 'index.html'));
    await preparePreview({ previewRoot, webRoot, output });
    assert.deepEqual(await readFile(join(output, 'index.html')), firstHtml);
  } finally {
    await removeTemp(output);
  }
});

test('a manipulated preview file fails the hash check before anything is published', async () => {
  const root = await mkdtemp(join(tmpdir(), 'croupier-preview-bad-'));
  const brokenPreview = join(root, 'preview');
  const output = join(root, 'out');
  try {
    await cp(previewRoot, brokenPreview, { recursive: true });
    const mediaDir = join(brokenPreview, 'site/media');
    const name = (await readdir(mediaDir)).find(file => file.endsWith('.mp4'));
    assert.ok(name);
    const original = await readFile(join(previewRoot, 'site/media', name));
    const target = join(mediaDir, name);
    const bytes = await readFile(target);
    bytes[0] ^= 0xff;
    await writeFile(target, bytes);
    await assert.rejects(
      preparePreview({ previewRoot: brokenPreview, webRoot, output }),
      error => error instanceof Error && error.message === `Hashen för ${name} stämmer inte med media-hashes.json.`,
    );
    assert.equal(existsSync(output), false);
    assert.deepEqual(await readFile(join(previewRoot, 'site/media', name)), original);
  } finally {
    await removeTemp(root);
  }
});
