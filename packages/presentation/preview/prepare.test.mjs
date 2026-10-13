import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, readdir, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {isLanePreview, prepareLanePreview} from './prepare.mjs';

test('production, main and other branches never publish this experiment', async () => {
  for (const env of [{}, {VERCEL_ENV:'production',VERCEL_GIT_COMMIT_REF:'test-video-jakob'},
    {VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'main'}, {VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'other'}]) {
    assert.equal(isLanePreview(env), false);
    assert.deepEqual(await prepareLanePreview({env}), {enabled:false});
  }
});

test('the requested branch gets only reviewed playback media and shared player code', async () => {
  const output = await mkdtemp(join(tmpdir(), 'croupier-lane-preview-'));
  try {
    const result = await prepareLanePreview({output, env:{VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'test-video-jakob'}});
    assert.equal(result.enabled, true);
    const dest = join(output, 'public/test');
    const catalog = JSON.parse(await readFile(join(dest,'catalog.json'),'utf8'));
    assert.deepEqual(catalog.lanes.map(lane=>lane.name),['Dragge']);
    assert.equal(catalog.assets.length,3);
    const seen = new Set();
    for (const lane of catalog.lanes) {
      assert.equal(Object.keys(lane.dealer.variants).length,1);
      const variant=lane.dealer.variants[lane.scene.variant];
      assert.equal(variant.settings.width,720);
      for (const role of ['clips','posters']) for (const record of Object.values(variant[role])) seen.add(record.src);
    }
    for (const asset of catalog.assets) seen.add(asset.src);
    assert.equal(seen.size,result.mediaFiles);
    const names=await readdir(dest);
    assert.ok(names.includes('geometry.js'));
    assert.ok(!names.includes('editing') && !names.includes('lane.json'));
    assert.doesNotMatch(JSON.stringify(catalog), /C:\\|source_sha256|X-Studio-Token|\.env|imports\//);
  } finally {
    assert.ok(resolve(output).startsWith(resolve(tmpdir()) + '\\') || resolve(output).startsWith(resolve(tmpdir()) + '/'));
    await rm(output,{recursive:true,force:true});
  }
});
