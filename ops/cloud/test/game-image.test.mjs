import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

// Dockerfile.game copies an explicit allowlist instead of the repository root.
// This test keeps that list honest: every module and file the game server or
// the cloud launcher statically resolves must be inside a copied path, and
// every bare package import must be installed by one of the two lockfiles.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const dockerfile = readFileSync(resolve(root, 'ops/cloud/Dockerfile.game'), 'utf8');
const copied = dockerfile.split('\n').filter(line => line.startsWith('COPY '))
  .flatMap(line => line.trim().split(/\s+/).slice(1, -1)).map(source => source.replace(/\/$/, ''));
const manifests = ['services/game', 'services/astrid-gpu-worker/gateway'];
const entries = ['ops/cloud/container-entry.mjs', 'ops/cloud/start.mjs', 'services/game/server.mjs'];
const SPECIFIER = /(?:import\s*(?:[^'"]*?from\s*)?|export\s+[^'"]*?from\s*|import\s*\(\s*)['"]([^'"]+)['"]/g;
const FILE_URL = /new URL\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*,\s*import\.meta\.url\s*\)/g;

function closure() {
  const files = new Set(), assets = new Set(), bare = [];
  const queue = entries.map(path => resolve(root, path));
  while (queue.length) {
    const file = queue.pop();
    if (files.has(file)) continue;
    assert.ok(existsSync(file), `missing module ${relative(root, file)}`);
    files.add(file);
    const source = readFileSync(file, 'utf8');
    for (const [, specifier] of source.matchAll(SPECIFIER)) {
      if (specifier.startsWith('node:')) continue;
      if (specifier.startsWith('.')) {
        let target = resolve(dirname(file), specifier);
        if (!existsSync(target) && existsSync(`${target}.mjs`)) target += '.mjs';
        if (existsSync(target) && statSync(target).isDirectory()) continue;
        queue.push(target);
      } else bare.push({ specifier, importer: relative(root, file).split(sep).join('/') });
    }
    // Directory anchors such as new URL('.', import.meta.url) are not copied files.
    for (const [, relativePath] of source.matchAll(FILE_URL)) if (/\.[a-z0-9]+$/i.test(relativePath)) assets.add(resolve(dirname(file), relativePath));
  }
  const toPosix = file => relative(root, file).split(sep).join('/');
  return { files: [...files].map(toPosix).sort(), assets: [...assets].map(toPosix).sort(), bare };
}
const inside = path => copied.some(source => path === source || path.startsWith(`${source}/`));

test('every statically resolved module and SQL/asset file of the game runtime is copied by Dockerfile.game', () => {
  const { files, assets } = closure();
  assert.ok(files.length > 200, 'closure must cover the game server, not only the launcher');
  const outside = [...files, ...assets].filter(path => !inside(path));
  assert.deepEqual(outside, [], 'add the paths to Dockerfile.game COPY or remove the import');
  assert.deepEqual(files.filter(path => path.startsWith('apps/')), [], 'the game image never carries Studio or web application code');
  for (const asset of assets) assert.ok(existsSync(resolve(root, asset)), `missing file ${asset}`);
});

test('bare package imports resolve from the two locked installations that Dockerfile.game performs', () => {
  const dependencies = Object.fromEntries(manifests.map(directory => [directory,
    Object.keys(JSON.parse(readFileSync(resolve(root, directory, 'package.json'), 'utf8')).dependencies ?? {})]));
  for (const { specifier, importer } of closure().bare) {
    const name = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
    const owner = manifests.find(directory => importer.startsWith(`${directory}/`));
    assert.ok(owner, `${importer} imports ${name} outside services/game or the speech relay; Node would not find a node_modules for it in the image`);
    assert.ok(dependencies[owner].includes(name), `${name} is not a locked dependency of ${owner}`);
  }
});

test('Dockerfile.game includes the game launcher and excludes Studio dependencies and builds', () => {
  const instructions = dockerfile.split('\n').filter(line => line && !line.startsWith('#')).join('\n');
  assert.doesNotMatch(instructions, /apps\/|next build|npm --prefix apps/);
  assert.ok(copied.includes('ops/cloud') && copied.includes('services/game') && copied.includes('services/astrid-gpu-worker/gateway'));
  assert.ok(copied.every(source => !source.startsWith('/') && !source.includes('..')));
  assert.match(dockerfile, /CMD \["node", "ops\/cloud\/container-entry\.mjs"\]/);
});
