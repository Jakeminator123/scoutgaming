import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { previewBuildDirectory } from '../lib/preview-files.mjs';

// CompositionPreview (components/composition-preview.tsx) imports the shared
// renderer from /preview/compositor.js. These two modules are all Studio serves
// under /preview; the old standalone preview site and its media are gone.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
export const rendererModules = Object.freeze(['compositor.js', 'geometry.js']);

export async function preparePreview({
  webRoot = join(repoRoot, 'packages/presentation/compositor'),
  output = previewBuildDirectory,
} = {}) {
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  for (const filename of rendererModules) {
    try {
      await cp(join(webRoot, filename), join(output, filename));
    } catch (error) {
      if (error.code === 'ENOENT') throw new Error('Webbmodulen saknas: ' + filename);
      throw error;
    }
  }
  await assertLocalImports(output, 'compositor.js');
  return { modules: rendererModules.length, output };
}

async function assertLocalImports(output, entry) {
  const pending = [entry];
  const seen = new Set();
  while (pending.length) {
    const name = pending.pop();
    if (seen.has(name)) continue;
    seen.add(name);
    let source;
    try {
      source = await readFile(join(output, name), 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') throw new Error(`Renderaren importerar ${name}, men filen kopierades inte.`);
      throw error;
    }
    for (const match of source.matchAll(/from\s+['"](\.\/[^'"]+)['"]/g)) {
      const next = match[1].slice(2);
      if (next.includes('..') || next.includes('\\')) throw new Error(`Otillåten import i ${name}: ${match[1]}`);
      pending.push(next);
    }
  }
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invoked) {
  preparePreview().then(result => {
    console.log(`Renderarmoduler klara: ${result.modules}.`);
  }).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
