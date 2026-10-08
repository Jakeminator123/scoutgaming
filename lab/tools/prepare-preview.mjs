import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { previewBuildDirectory } from '../lib/preview-files.mjs';

const labRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(labRoot, '..');
const webModules = ['player.js', 'compositor.js', 'bridge.js', 'geometry.js', 'lanes.js'];

const htmlRewrites = [
  ['href="/test/preview.css"', 'href="preview.css"'],
  ['src="/test/preview.js"', 'src="preview.js"'],
  ['href="/test"', 'href="./"'],
];
const scriptRewrites = [
  ["new URL('/test/', location.origin)", "new URL('./', import.meta.url)"],
  ["fetch('/test/catalog.json')", "fetch(new URL('catalog.json', import.meta.url))"],
];

export async function preparePreview({
  previewRoot = join(repoRoot, 'test-videoeditor/preview'),
  webRoot = join(repoRoot, 'test-videoeditor/program/web'),
  output = previewBuildDirectory,
} = {}) {
  await rm(join(labRoot, 'public', 'preview'), { recursive: true, force: true });
  const site = join(previewRoot, 'site');
  const mediaDir = join(site, 'media');
  const hashes = JSON.parse(await readFile(join(site, 'media-hashes.json'), 'utf8'));
  if (!hashes || typeof hashes !== 'object' || Array.isArray(hashes)) {
    throw new Error('media-hashes.json måste vara ett objekt med filnamn och sha256.');
  }
  let files;
  try {
    files = (await readdir(mediaDir)).sort();
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error('Förhandsvisningens media-mapp saknas.');
    throw error;
  }
  const expected = Object.keys(hashes).sort();
  if (JSON.stringify(files) !== JSON.stringify(expected)) {
    throw new Error('Filerna i preview/site/media stämmer inte med media-hashes.json.');
  }
  for (const name of files) {
    if (!/^[a-f0-9]{64}\.(mp4|webp|png)$/.test(name)) throw new Error('Endast granskade förhandsmedier publiceras: ' + name);
    const digest = createHash('sha256').update(await readFile(join(mediaDir, name))).digest('hex');
    if (digest !== hashes[name]) throw new Error(`Hashen för ${name} stämmer inte med media-hashes.json.`);
  }
  await mkdir(output, { recursive: true });
  await cp(site, output, { recursive: true });
  for (const filename of webModules) {
    try {
      await cp(join(webRoot, filename), join(output, filename));
    } catch (error) {
      if (error.code === 'ENOENT') throw new Error('Webbmodulen saknas: ' + filename);
      throw error;
    }
  }
  await adaptLabPaths(output);
  await assertLocalImports(output, 'preview.js');
  return { mediaFiles: files.length, output };
}

async function adaptLabPaths(output) {
  const htmlPath = join(output, 'index.html');
  const jsPath = join(output, 'preview.js');
  let html = await readFile(htmlPath, 'utf8');
  let js = await readFile(jsPath, 'utf8');
  html = applyRewrites(html, htmlRewrites, 'index.html');
  js = applyRewrites(js, scriptRewrites, 'preview.js');
  if (html.includes('/test') || js.includes('/test')) {
    throw new Error('Absoluta /test-sökvägar finns kvar i labbkopian. Sidan skulle missa basePath.');
  }
  await writeFile(htmlPath, html);
  await writeFile(jsPath, js);
}

function applyRewrites(source, pairs, filename) {
  let next = source;
  for (const [from, to] of pairs) {
    if (!next.includes(from)) throw new Error(`Förhandsvisningens ${filename} saknar sökvägen ${from}. Lab-anpassningen avbröts.`);
    next = next.replaceAll(from, to);
  }
  return next;
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
      if (error.code === 'ENOENT') throw new Error(`Förhandsvisningen importerar ${name}, men filen kopierades inte.`);
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
    console.log(`Förhandsvisning klar: ${result.mediaFiles} mediefiler.`);
  }).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
