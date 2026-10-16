#!/usr/bin/env node
import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { retireDemoExamples } from './lib/retire-demo-examples.mjs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPrivateConnection, probeConnections, startIsolatedConnection } from '../open-claw/lab/deploy/local-connection.mjs';
import { createEmptyProject, validateProject } from './lib/studio-model.mjs';
import { createProjectStore } from './lib/project-store.mjs';
import { startLocalComparison } from '../tools/start-local-comparison.mjs';
import { preparePreview } from './tools/prepare-preview.mjs';
import { prepareDesignPreview } from './tools/prepare-design-preview.mjs';

const profile = Object.freeze({id:'lissabon-stream-lane',productPort:4200,labPort:4201,generatedSpeech:true});
const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, '..');
export const localDataDir = (repoRoot = root) => {
  if (existsSync(join(repoRoot, 'lissabon/data/project.json'))) {
    throw new Error('Sparad Lissabon-data måste flyttas först: node tools/migrate-lab-state.mjs --destination <privat backup utanför Git> --apply.');
  }
  return join(repoRoot, 'lab/data');
};
export const defaultDataDir = join(root, 'lab/data');
export function createLocalProject() {
  const project = createEmptyProject();
  return project;
}
export async function prepareProject(dataDir = defaultDataDir) {
  const snapshot = JSON.stringify(createLocalProject(), null, 2) + '\n';
  validateProject(JSON.parse(snapshot));
  await mkdir(dataDir, { recursive: true });
  try { await writeFile(join(dataDir, 'project.json'), snapshot, { flag: 'wx' }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  // A broken saved project is reported, never silently replaced by the snapshot.
  const saved = validateProject(JSON.parse(await readFile(join(dataDir, 'project.json'), 'utf8')));
  // Add deliberately registered lane clips without replacing the operator's
  // existing modes, timings, descriptions or base weights. Save through the
  // normal revision/history path so upgrading an older lane is reversible.
  const draft = retireDemoExamples(saved);
  if (saved.idlePolicy) {
    const defaults = JSON.parse(snapshot).idlePolicy?.variants ?? [];
    for (const variant of defaults) {
      const existing = draft.idlePolicy.variants.find(item => item.videoId === variant.videoId);
      if (!existing) draft.idlePolicy.variants.push(variant);
      else if (!Object.hasOwn(existing, 'description')) existing.description = variant.description;
    }
  }
  if (JSON.stringify(draft) !== JSON.stringify(saved)) await createProjectStore(dataDir).save(draft, saved.revision);
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
  const runtime = { requireLocalBuild, sourceVersion, preparePreview, prepareDesignPreview, buildLab, prepareProject,
    startLocalComparison, startIsolatedConnection, loadPrivateConnection, probeConnections, registerShutdown,
    fetch: globalThis.fetch, ...dependencies };
  if (args.some(arg => !['--check', '--no-open', '--skip-build', '--astrid-camera', '--cloud-storage', '--offline', '--product'].includes(arg))) throw new Error('Använd --check, --no-open, --skip-build, --astrid-camera, --cloud-storage, --offline eller --product.');
  if (args.includes('--product')) {
    if (args.some(arg => !['--product', '--no-open'].includes(arg))) throw new Error('--product kan endast kombineras med --no-open.');
    log('Publicerad produkt: ' + publishedProductUrl + '\nBolag → spelrum → dealer. Inga lokala servrar eller externa genereringsanrop startas.');
    if (!args.includes('--no-open')) open(publishedProductUrl);
    return { mode: 'product', url: publishedProductUrl };
  }
  if (args.includes('--offline') && args.some(arg => ['--check', '--astrid-camera', '--cloud-storage'].includes(arg))) throw new Error('--offline kan inte kombineras med --check, --astrid-camera eller --cloud-storage.');
  const head = await runtime.sourceVersion(repoRoot);
  log(`Avsedd checkout: ${repoRoot}\nKällversion (Git HEAD): ${head || 'kunde inte läsas'}. Arbetsfiler kan ha egna ändringar; detta är inte ett byggversionskvitto.`);
  if (args.includes('--check')) {
    const { configuration, report } = runtime.loadPrivateConnection({ repoRoot, generatedSpeech: true, astridCamera: args.includes('--astrid-camera'), cloudStorage: args.includes('--cloud-storage') });
    log(JSON.stringify({ lane: profile.id, report, probe: await runtime.probeConnections(configuration) }, null, 2));
    return;
  }
  const skipBuild = args.includes('--skip-build');
  if (skipBuild) {
    // Check before reading connected profiles, creating projects or acquiring a session.
    await runtime.requireLocalBuild(repoRoot);
    log('--skip-build använder befintliga byggfiler utan förberedelse, bygge eller installation. Deras källversion är inte verifierad.');
  }
  const prepareBuild = async session => {
    if (skipBuild) return;
    await runtime.preparePreview();
    await runtime.prepareDesignPreview();
    await runtime.buildLab(session);
  };
  if (args.includes('--offline')) {
    const fixture = await runtime.startLocalComparison({ repoRoot, streamLane: profile.id,
      prepare: prepareBuild, prepareStudio: runtime.prepareProject });
    log(`Lokalt Studio: ${fixture.labUrl}\nProvspel startas från en sparad sammansättning i Studio\nPublicerad produkt: ${publishedProductUrl}\nTestdata utan publicerat bolagspaket; externa tjänster är avstängda. Ctrl+C stoppar båda servrarna och rensar testdata.`);
    runtime.registerShutdown(fixture);
    if (!args.includes('--no-open')) open(fixture.labUrl);
    return fixture;
  }
  const url = `http://127.0.0.1:${profile.labPort}/`;
  const running = await runtime.fetch(`http://127.0.0.1:${profile.labPort}/api/health`, { signal: AbortSignal.timeout(2000) }).then(r => r.json()).catch(() => null);
  if (running) throw new Error(`En server svarar på ${url}, men dess checkout och byggversion kan inte verifieras. Stoppa dess startprocess manuellt innan du startar från rätt checkout. Ingen process stängs automatiskt.`);
  const studioDataDir = localDataDir(repoRoot);
  const fixture = await runtime.startIsolatedConnection({ ...profile, repoRoot, studioDataDir, streamLane: profile.id,
    astridCamera: args.includes('--astrid-camera'),
    cloudStorage: args.includes('--cloud-storage'),
    prepare: async session => {
      await runtime.prepareProject(studioDataDir);
      await prepareBuild(session);
    },
  });
  log(`Lokalt Studio redo: ${url}\nVälj en sparad sammansättning i Studio för att starta provspel.\nPublicerad produkt: ${publishedProductUrl} (node lab/start.mjs --product)\nCtrl+C stoppar båda servrarna. Sparade inställningar finns kvar i ${studioDataDir}.`);
  runtime.registerShutdown(fixture);
  if (!args.includes('--no-open')) open(url);
  return fixture;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
