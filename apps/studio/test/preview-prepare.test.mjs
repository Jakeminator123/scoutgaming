import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { previewBuildDirectory } from '../lib/preview-files.mjs';
import { preparePreview, rendererModules } from '../tools/prepare-preview.mjs';

const lab = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const webRoot = resolve(lab, '../../packages/presentation/compositor');

async function removeTemp(path) {
  assert.ok(resolve(path).startsWith(resolve(tmpdir())));
  await rm(path, { recursive: true, force: true });
}

test('the preview build holds exactly the shared renderer modules and drops stale files', async () => {
  assert.equal(previewBuildDirectory, join(lab, 'preview-build'));
  assert.ok(existsSync(join(dirname(previewBuildDirectory), 'next.config.mjs')));
  const output = await mkdtemp(join(tmpdir(), 'croupier-preview-'));
  try {
    await mkdir(join(output, 'media'), { recursive: true });
    await writeFile(join(output, 'catalog.json'), '{}');
    const result = await preparePreview({ webRoot, output });
    assert.equal(result.modules, 2);
    assert.deepEqual((await readdir(output)).sort(), [...rendererModules].sort());
    for (const name of rendererModules)
      assert.equal(await readFile(join(output, name), 'utf8'), await readFile(join(webRoot, name), 'utf8'), name);
  } finally {
    await removeTemp(output);
  }
});

test('a missing renderer module or an unlisted local import fails the build', async () => {
  const root = await mkdtemp(join(tmpdir(), 'croupier-preview-bad-'));
  try {
    const source = join(root, 'compositor');
    await mkdir(source, { recursive: true });
    await writeFile(join(source, 'compositor.js'), "import {x} from './geometry.js';\n");
    await assert.rejects(preparePreview({ webRoot: source, output: join(root, 'out') }), { message: 'Webbmodulen saknas: geometry.js' });
    await writeFile(join(source, 'geometry.js'), "import {y} from './player.js';\n");
    await assert.rejects(preparePreview({ webRoot: source, output: join(root, 'out') }), { message: 'Renderaren importerar player.js, men filen kopierades inte.' });
  } finally {
    await removeTemp(root);
  }
});
