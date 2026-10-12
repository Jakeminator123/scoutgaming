import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, relative, dirname, join, sep } from 'node:path';
import { resolveMediaPath } from '../../../tools/media-layout.mjs';

const repo = fileURLToPath(new URL('../../../', import.meta.url));
const publicRoot = join(repo, 'web', 'public');
const previewRoot = 'frontend-preview';
const textExtensions = new Set(['.mjs', '.js', '.css', '.json']);
const styles = [
  'styles.css', 'calibration.css', 'environment.css', 'auth-modal.css',
  'local-presentation.css', 'rigged-review.css', 'astrid-voice-shell.css',
  'astrid-voice-control.css', 'blackjack-entry.css',
];

function outputName(source) {
  if (source === resolveMediaPath('web/public/speech-media.json', {repositoryRoot: repo})) return 'speech-media.json';
  const path = relative(repo, source).split(sep).join('/');
  if (path.startsWith('web/public/')) return path.slice('web/public/'.length);
  if (path.startsWith('presentation-runtime/') || path === 'lab/policies/idle-policy.seed.json') return path;
  throw Error(`Frontend import utanför tillåten textyta: ${path}`);
}

function moduleImports(source) {
  const imports = [];
  for (const pattern of [
    /^\s*(?:import|export)\s+(?:[\w\s{},*$]+?\s+from\s*)?['"]([^'"]+)['"]/gm,
    /^\s*(?:import|export)[^'"\n]*?\bfrom\s*['"]([^'"]+)['"]/gm,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]) for (const match of source.matchAll(pattern)) imports.push(match[1]);
  return imports;
}

async function writePreview(output) {
  const queue = [join(publicRoot, 'app.mjs'), join(publicRoot, 'blackjack-entry.mjs'),
    join(publicRoot, 'astrid-camera-audio-worklet.mjs')];
  const seen = new Set();
  for (const style of styles) queue.push(join(publicRoot, style));
  queue.push(resolveMediaPath('web/public/speech-media.json', {repositoryRoot: repo}));
  while (queue.length) {
    const sourcePath = resolve(queue.shift());
    if (seen.has(sourcePath)) continue;
    seen.add(sourcePath);
    const name = outputName(sourcePath);
    const ext = name.slice(name.lastIndexOf('.'));
    if (!textExtensions.has(ext)) throw Error(`Frontend import är inte text: ${name}`);
    let content = await readFile(sourcePath, 'utf8');
    if (name === 'blackjack-entry.mjs') {
      const previous = "const destination = '/play';";
      if (!content.includes(previous)) throw Error('Inloggningens interna destination har ändrats.');
      content = content.replace(previous, "const destination = '/frontend-preview/game/?dealer=astrid&presentation=local';");
    }
    if (name === 'auth-modal.mjs') {
      const previous = "const playerLoginPath = '/blackjack';";
      if (!content.includes(previous)) throw Error('Spelarens interna inloggningslänk har ändrats.');
      content = content.replace(previous, "const playerLoginPath = '/frontend-preview/blackjack/';");
    }
    const target = join(fileURLToPath(output), name);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
    // The shared idle runtime imports the same browser-safe identity module
    // from its repository path; retain that exact alias in static builds.
    if (name === 'dealer-identity.mjs') {
      const alias = join(fileURLToPath(output), 'web/public/dealer-identity.mjs');
      await mkdir(dirname(alias), { recursive: true });
      await writeFile(alias, content);
    }
    if (ext === '.mjs' || ext === '.js') {
      for (const specifier of moduleImports(content)) {
        if (!specifier.startsWith('.')) throw Error(`Oväntad extern modulimport i ${name}: ${specifier}`);
        queue.push(fileURLToPath(new URL(specifier, pathToFileURL(sourcePath))));
      }
    }
  }
  for (const [page, sourceName] of [['blackjack', 'blackjack-entry.html'], ['game', 'index.html']]) {
    const html = await readFile(join(publicRoot, sourceName), 'utf8');
    const target = join(fileURLToPath(output), previewRoot, page, 'index.html');
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, html);
  }
}

export function blackjackUrl(value, { local = false } = {}) {
  let url;
  try { url = new URL(value); } catch { throw Error('Ange CROUPIER_GAME_ORIGIN som spelserverns exakta HTTPS-origin.'); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.origin !== value || url.username || url.password || url.search || url.hash || url.pathname !== '/'
    || (local ? !(loopback && url.protocol === 'http:') : url.protocol !== 'https:' || loopback)) {
    throw Error('CROUPIER_GAME_ORIGIN måste vara en exakt HTTPS-origin; --local tillåter endast lokal HTTP.');
  }
  return `${url.origin}/blackjack`;
}
export async function build({ origin = process.env.CROUPIER_GAME_ORIGIN, local = false, frontendPreview = false, output = new URL('./dist/', import.meta.url) } = {}) {
  const href = blackjackUrl(origin, { local });
  const source = await readFile(new URL('../../../ops/vercel-entry/index.html', import.meta.url), 'utf8');
  await mkdir(output, { recursive: true });
  await writeFile(new URL('index.html', output), source.replace('{{BLACKJACK_URL}}', href));
  await copyFile(new URL('../../../web/public/blackjack-entry.css', import.meta.url), new URL('style.css', output));
  if (frontendPreview) await writePreview(output);
  console.log('Statisk ingång byggd. Ingen deployment utförd.');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.some(arg => !['--local', '--frontend-preview'].includes(arg))) throw Error('Använd node apps/croupier-frontend/tools/player-ui-build.mjs [--local] [--frontend-preview].');
    await build({ local: args.includes('--local'), frontendPreview: args.includes('--frontend-preview') });
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
