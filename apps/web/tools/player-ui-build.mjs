import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, relative, dirname, join, sep } from 'node:path';
import { resolveMediaPath } from '../../../tools/media-layout.mjs';
import { presentationPublicModules, presentationPublicSource } from '../../../packages/presentation/public-modules.mjs';

const repo = fileURLToPath(new URL('../../../', import.meta.url));
const publicRoot = join(repo, 'services', 'game', 'public');
const previewRoot = 'frontend-preview';
const textExtensions = new Set(['.mjs', '.js', '.css', '.json']);
const styles = [
  'styles.css', 'calibration.css', 'environment.css', 'auth-modal.css',
  'local-presentation.css', 'blackjack-entry.css',
];

function canonicalSource(candidate) {
  const normalized = resolve(candidate);
  const rel = relative(repo, normalized).split(sep).join('/');
  const source = presentationPublicSource('/' + rel);
  return source ? realpathSync(resolve(repo, source)) : normalized;
}

function outputName(source) {
  if (source === resolveMediaPath('web/public/speech-media.json', {repositoryRoot: repo})) return 'speech-media.json';
  const path = relative(repo, source).split(sep).join('/');
  if (path.startsWith('services/game/public/')) return path.slice('services/game/public/'.length);
  if (presentationPublicModules.some(row => row.source === path)) return path;
  throw Error(`Frontend import utanför tillåten textyta: ${path}`);
}

function browserCopy(source, content, name) {
  for (const specifier of new Set(moduleImports(content))) {
    if (!specifier.startsWith('.')) throw Error(`Oväntad extern modulimport i ${name}: ${specifier}`);
    const target = outputName(canonicalSource(fileURLToPath(new URL(specifier, pathToFileURL(source)))));
    let next = relative(dirname(name), target).split(sep).join('/');
    if (!next.startsWith('.')) next = './' + next;
    content = content.replaceAll("'" + specifier + "'", "'" + next + "'")
      .replaceAll('"' + specifier + '"', '"' + next + '"');
  }
  return content;
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
  const queue = [join(publicRoot, 'app.mjs'), join(publicRoot, 'shared-room-app.mjs'), join(publicRoot, 'blackjack-entry.mjs'),
    // Middleware serves every exact public registry URL, including modules not
    // currently imported by the player entry. Reuse the same alias/import walk.
    ...presentationPublicModules.map(({source}) => join(repo, source))];
  const seen = new Set();
  for (const style of styles) queue.push(join(publicRoot, style));
  queue.push(resolveMediaPath('web/public/speech-media.json', {repositoryRoot: repo}));
  while (queue.length) {
    const sourcePath = canonicalSource(queue.shift());
    if (seen.has(sourcePath)) continue;
    seen.add(sourcePath);
    const name = outputName(sourcePath);
    const ext = name.slice(name.lastIndexOf('.'));
    if (!textExtensions.has(ext)) throw Error(`Frontend import är inte text: ${name}`);
    let content = await readFile(sourcePath, 'utf8');
    if (name === 'blackjack-entry.mjs') {
      const previous = "const destination = '/lobby';";
      if (!content.includes(previous)) throw Error('Inloggningens interna destination har ändrats.');
      content = content.replace(previous, "const destination = '/frontend-preview/game/?dealer=astrid&presentation=local';");
    }
    if (name === 'auth-modal.mjs') {
      const previous = "const playerLoginPath = '/blackjack';";
      if (!content.includes(previous)) throw Error('Spelarens interna inloggningslänk har ändrats.');
      content = content.replace(previous, "const playerLoginPath = '/frontend-preview/blackjack/';");
    }
    const sourceName = relative(repo, sourcePath).split(sep).join('/');
    const publicSource = presentationPublicModules.find(row => row.source === sourceName);
    const names = publicSource ? publicSource.paths.map(url => url.slice(1)) : [name];
    for (const copy of names) {
      const target = join(fileURLToPath(output), copy);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, ext === '.mjs' || ext === '.js' ? browserCopy(sourcePath, content, copy) : content);
    }
    if (ext === '.mjs' || ext === '.js') {
      for (const specifier of moduleImports(content)) {
        if (!specifier.startsWith('.')) throw Error(`Oväntad extern modulimport i ${name}: ${specifier}`);
        queue.push(canonicalSource(fileURLToPath(new URL(specifier, pathToFileURL(sourcePath)))));
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
  const source = await readFile(new URL('./player-ui-landing.html', import.meta.url), 'utf8');
  await mkdir(output, { recursive: true });
  await writeFile(new URL('index.html', output), source.replace('{{BLACKJACK_URL}}', href));
  await copyFile(new URL('../../../services/game/public/blackjack-entry.css', import.meta.url), new URL('style.css', output));
  if (frontendPreview) await writePreview(output);
  console.log('Statisk ingång byggd. Ingen deployment utförd.');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.some(arg => !['--local', '--frontend-preview'].includes(arg))) throw Error('Använd node apps/web/tools/player-ui-build.mjs [--local] [--frontend-preview].');
    await build({ local: args.includes('--local'), frontendPreview: args.includes('--frontend-preview') });
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
