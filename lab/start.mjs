#!/usr/bin/env node
import { execFileSync, spawn } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEmptyProject, validateProject } from '../packages/presentation/contracts/studio-model.mjs';
import { startLocalComparison } from '../tools/start-local-comparison.mjs';
import { preparePreview } from './tools/prepare-preview.mjs';
import { prepareDesignPreview } from './tools/prepare-design-preview.mjs';

const offlineStreamLane = 'lissabon-stream-lane';
const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, '..');
export async function prepareProject(dataDir) {
  if(typeof dataDir!=='string'||!isAbsolute(dataDir))throw new Error('Isolerad testdata kräver en uttrycklig absolut katalog. Använd node lab/start.mjs --offline för lokal provkörning.');
  const snapshot = JSON.stringify(createEmptyProject(), null, 2) + '\n';
  validateProject(JSON.parse(snapshot));
  await mkdir(dataDir, { recursive: true });
  try { await writeFile(join(dataDir, 'project.json'), snapshot, { flag: 'wx' }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  // Existing fixture data is validated without migration, revision or history writes.
  validateProject(JSON.parse(await readFile(join(dataDir, 'project.json'), 'utf8')));
  return dataDir;
}
function openBrowser(url) {
  const [command, args] = process.platform === 'win32'
    ? ['powershell.exe', ['-NoProfile', '-Command', `Start-Process '${url}'`]]
    : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  const child = spawn(command, args, { windowsHide: true, stdio: 'ignore' });
  child.on('error', () => console.log(`Öppna ${url} i webbläsaren.`));
}
async function buildLab(session) {
  console.log('Bygger Lab…');
  const child = spawn(process.execPath, [join(root, 'lab/node_modules/next/dist/bin/next'), 'build', '--webpack'], {
    cwd: join(root, 'lab'), windowsHide: true, stdio: 'inherit', env: session.environment({ ...process.env, NEXT_TELEMETRY_DISABLED: '1' }),
  });
  try { session.trackChild(child); } catch (error) { child.kill(); throw error; }
  await new Promise((yes, no) => { child.once('error', no); child.once('exit', code => code === 0 ? yes() : no(new Error(`Labbbygget misslyckades (${code}). Kör npm --prefix lab ci om beroenden saknas.`))); });
}
export const publishedProductUrl = 'https://www.scoutgaming.tech/lobby';
// Presence checks only: these files do not identify the source revision of a build.
export const localBuildFiles = Object.freeze([
  '.next/BUILD_ID', '.next/required-server-files.json', '.next/routes-manifest.json', '.next/server/app-paths-manifest.json',
  ...['index.html', 'preview.js', 'preview.css', 'catalog.json', 'player.js', 'compositor.js', 'bridge.js', 'geometry.js', 'lanes.js'].map(file => `preview-build/${file}`),
  ...['admin', 'lobby', 'public-lobby'].flatMap(surface => ['index.html', 'app.js', 'theme.css'].map(file => `design-preview-build/${surface}/${file}`)),
  'design-preview-build/admin/app.css', 'design-preview-build/admin/chat-import.js',
  ...['inter', 'space', 'mono'].map(font => `design-preview-build/fonts/${font}.woff2`),
]);
export async function requireLocalBuild(repoRoot = root) {
  const missing = [];
  for (const file of localBuildFiles) {
    const info = await stat(join(repoRoot, 'lab', file)).catch(() => null);
    if (!info?.isFile() || info.size === 0) missing.push(file);
  }
  if (missing.length) throw new Error(`Lokalt bygge saknas eller är ofullständigt: ${missing.join(', ')}. --skip-build bygger eller installerar ingenting. Bygg rätt checkout med npm --prefix lab run build först; bortstädade byggfiler är inte i sig ett källkodsfel.`);
}
function sourceVersion(repoRoot) {
  try {
    const head = execFileSync('git', ['-C', repoRoot, 'rev-parse', '--verify', 'HEAD'], { encoding: 'utf8', windowsHide: true, timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return /^[a-f0-9]{40}$/.test(head) ? head : null;
  } catch { return null; }
}
function registerShutdown(fixture) {
  const stop = async () => { await fixture.stop(); process.exit(0); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
}
export async function main(args = process.argv.slice(2), { open = openBrowser, log = console.log, repoRoot = root, dependencies = {} } = {}) {
  if(args.some(arg=>['--check','--astrid-camera','--cloud-storage'].includes(arg)))throw new Error('Den anslutna lokala produktstarten är avvecklad. Kör node lab/start.mjs för den publicerade produkten, eller node lab/start.mjs --offline för isolerade testdata utan externa tjänster. Sparade lokala data bevaras.');
  if (args.some(arg => !['--no-open', '--skip-build', '--offline', '--product'].includes(arg))) throw new Error('Använd node lab/start.mjs [--no-open] för produkten eller --offline [--skip-build] [--no-open] för isolerad provkörning.');
  if(args.includes('--product')&&args.some(arg=>!['--product','--no-open'].includes(arg)))throw new Error('--product kan endast kombineras med --no-open. Använd --offline för isolerad provkörning.');
  if(args.includes('--skip-build')&&!args.includes('--offline'))throw new Error('--skip-build kräver --offline. Kör node lab/start.mjs utan byggflaggor för den publicerade produkten.');
  if (!args.includes('--offline')) {
    log('Publicerad produkt: ' + publishedProductUrl + '\nBolag → spelrum → dealer. Inga lokala servrar eller externa genereringsanrop startas.');
    if (!args.includes('--no-open')) open(publishedProductUrl);
    return { mode: 'product', url: publishedProductUrl };
  }
  const runtime = { requireLocalBuild, sourceVersion, preparePreview, prepareDesignPreview, buildLab, prepareProject,
    startLocalComparison, registerShutdown, ...dependencies };
  const head = await runtime.sourceVersion(repoRoot);
  log(`Avsedd checkout: ${repoRoot}\nKällversion (Git HEAD): ${head || 'kunde inte läsas'}. Arbetsfiler kan ha egna ändringar; detta är inte ett byggversionskvitto.`);
  const skipBuild = args.includes('--skip-build');
  if (skipBuild) {
    // Check before creating fixture projects or acquiring a local session.
    await runtime.requireLocalBuild(repoRoot);
    log('--skip-build använder befintliga byggfiler utan förberedelse, bygge eller installation. Deras källversion är inte verifierad.');
  }
  const prepareBuild = async session => {
    if (skipBuild) return;
    await runtime.preparePreview();
    await runtime.prepareDesignPreview();
    await runtime.buildLab(session);
  };
  const fixture = await runtime.startLocalComparison({ repoRoot, streamLane: offlineStreamLane,
    prepare: prepareBuild, prepareStudio: runtime.prepareProject });
  log(`Lokalt Studio: ${fixture.labUrl}\nProvspel startas från en sparad sammansättning i Studio\nPublicerad produkt: ${publishedProductUrl}\nTestdata utan publicerat bolagspaket; externa tjänster är avstängda. Ctrl+C stoppar båda servrarna och rensar testdata.`);
  runtime.registerShutdown(fixture);
  if (!args.includes('--no-open')) open(fixture.labUrl);
  return fixture;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
