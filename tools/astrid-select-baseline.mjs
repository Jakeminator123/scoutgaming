/**
 * Astrid select-baslinje.
 *
 * En ny baslinje får skrivas endast efter Jakobs godkännande:
 *   node tools/astrid-select-baseline.mjs --write
 * Utan --write jämför skriptet bara och skriver inga fixturer.
 * --write avbryter om HEAD och arbetsträdet skiljer sig, så en omskrivning
 * kan inte dölja att Astrids svar har ändrats.
 *
 * Select anropas som guldjämförelsen i test/presentation-select-dealers.mjs:
 * createSeedProject i minne, loadVideoRegistry, injicerad random. Ingen
 * Neon-server och inget modellanrop. API:t tar en random-funktion, inte ett
 * numeriskt seed; varje anrop får därför mulberry32 med RANDOM_SEED.
 * active och shadow körs utan remoteUrl och utan gateway, så askDirector
 * stannar på openclaw_not_configured utan fetch. fetchImpl kastar om något
 * ändå försöker nå nätet.
 *
 * HEAD läses med git archive till %TEMP%. Arbetskopian och git stash rörs inte.
 */
import { execFile } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createSeedProject, isDirectorSourceType, OPENCLAW_MODES } from '../lab/lib/studio-model.mjs';
import { selectPresentation } from '../lab/lib/presentation-selection.mjs';
import { loadVideoRegistry } from '../lab/lib/video-registry.mjs';

const execFileAsync = promisify(execFile);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
export const FIXTURE_DIR = join(repoRoot, 'test', 'fixtures', 'astrid-select-baseline');
export const RANDOM_SEED = 20261008;
const MODE_ORDER = ['off', 'rules', 'random', 'shadow', 'active'];
// The composed selection entry must resolve its model and Director from the same HEAD.
// The HEAD archive must contain every module these entries import, statically or
// through a literal import(); bare packages still resolve against the worktree.
export const HEAD_SELECTION_ENTRIES = Object.freeze([
  'lab/lib/presentation-selection.mjs',
  'lab/lib/studio-model.mjs',
]);
export const ARCHIVE_PATHS = Object.freeze([
  'packages/presentation/runtime',
  'packages/presentation/server',
  'packages/shared/studio-error.mjs',
  'packages/shared/media-file-types.mjs',
  'packages/studio-access/studio-scope.mjs',
  'lab/lib',
  'lab/policies',
  'lab/schemas',
  'open-claw/lab',
  'tools/media',
  'tools/media-layout.mjs',
  'tools/retention-archive.mjs',
  'tools/retention-policy.json',
  'web/dealer-identity.mjs',
  'web/layer-asset-contract.mjs',
  'web/managed-media-contract.mjs',
  'web/storage/studio-contract.mjs',
  'web/public/background-playback-policy.mjs',
  'web/public/background-playback.mjs',
  'web/public/background-materials.mjs',
  'web/public/material-catalog.mjs',
  'web/public/card-presentation/calibration.mjs',
  'web/public/card-view.mjs',
  'web/public/composition-settings.mjs',
  'web/public/dealer-compositing.mjs',
  'web/public/dealer-framing.mjs',
  'web/public/roulette-idle-contract.mjs',
  'web/public/roulette-start-contract.mjs',
  'web/public/dealer-identity.mjs',
  'web/public/dealer-speech-profile.mjs',
  'web/public/recorded-speech.mjs',
  'web/public/speech-slot-bindings.mjs',
  'web/public/speech-lines.mjs',
  'web/public/game-lanes.mjs',
  'packages/presentation/contracts/game-lane-id.mjs',
  'web/public/game-overlay-layout.mjs',
  'web/public/presentation-composition.mjs',
]);
const DROP_KEYS = new Set(['elapsedMs', 'cacheId', 'cacheKey', 'generatedAt', 'timestamp', 'observedAt']);

export const CONTEXTS = Object.freeze([
  {
    id: 'neutral',
    context: {
      chat: { signal: 'none' },
      playerHistory: { returning: false, preferredLanguage: null },
      session: { recentWins: 0, recentLosses: 0 },
    },
  },
  {
    id: 'returning-two-losses',
    context: {
      chat: { signal: 'none' },
      playerHistory: { returning: true, preferredLanguage: null },
      session: { recentWins: 0, recentLosses: 2 },
    },
  },
]);

let registryPromise;

export function createRandom(seed = RANDOM_SEED) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function modeList(modes = OPENCLAW_MODES) {
  const present = [...modes];
  const missing = MODE_ORDER.filter(mode => !present.includes(mode));
  if (missing.length) throw new Error(`OPENCLAW_MODES saknar ${missing.join(', ')}`);
  return [...MODE_ORDER, ...present.filter(mode => !MODE_ORDER.includes(mode))];
}

export function astridEvents(project) {
  const ids = new Set(project.lines.filter(line => line.dealerId === 'astrid').map(line => line.eventId));
  // Clip-only slots (transition.shoe) are never director events; select() refuses them by design.
  return project.events.filter(event => ids.has(event.id) && isDirectorSourceType(event.sourceType));
}

export function listJobs(project = createSeedProject()) {
  const jobs = [];
  for (const event of astridEvents(project)) {
    for (const mode of modeList()) {
      for (const item of CONTEXTS) {
        jobs.push({
          id: `${event.id}__${mode}__${item.id}`,
          eventId: event.id,
          mode,
          contextId: item.id,
          context: item.context,
          requestId: `astrid-baseline:${event.id}:${mode}:${item.id}`,
        });
      }
    }
  }
  return jobs;
}

export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).filter(key => !DROP_KEYS.has(key)).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}

export function firstDiff(left, right, path = '$') {
  if (Object.is(left, right)) return null;
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) return { path, left: `length ${left.length}`, right: `length ${right.length}` };
    for (let index = 0; index < left.length; index += 1) {
      const diff = firstDiff(left[index], right[index], `${path}[${index}]`);
      if (diff) return diff;
    }
    return null;
  }
  if (left && right && typeof left === 'object' && typeof right === 'object') {
    const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
    for (const key of keys) {
      if (!Object.hasOwn(left, key)) return { path: `${path}.${key}`, left: undefined, right: right[key] };
      if (!Object.hasOwn(right, key)) return { path: `${path}.${key}`, left: left[key], right: undefined };
      const diff = firstDiff(left[key], right[key], `${path}.${key}`);
      if (diff) return diff;
    }
    return null;
  }
  return { path, left, right };
}

function preview(value) {
  if (value === undefined) return 'undefined';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > 200 ? `${text.slice(0, 200)}…` : text;
}

export function jobLabel(job) {
  return { id: job.id, event: job.eventId, mode: job.mode, kontext: job.contextId };
}

export async function loadRegistry() {
  registryPromise ??= (async () => {
    const here = realpathSync(process.cwd());
    const root = realpathSync(repoRoot);
    if (here !== root) process.chdir(root);
    // Explicit historical fixture for baseline comparison; never a product default.
    return loadVideoRegistry({archiveDir:join(repoRoot, 'media/dealers/astrid/runtime/presentation')});
  })();
  return registryPromise;
}

export async function executeJobs(select, project, registry, jobs) {
  let networkCalls = 0;
  const fetchImpl = async () => {
    networkCalls += 1;
    throw new Error('Astrid-baslinjen tillåter inget nätverk.');
  };
  const results = [];
  for (const job of jobs) {
    const event = project.events.find(item => item.id === job.eventId);
    if (!event) {
      results.push({ id: job.id, ok: false, error: 'event saknas i projektet' });
      continue;
    }
    const before = networkCalls;
    try {
      const response = canonical(await select({
        requestId: job.requestId,
        project: structuredClone(project),
        dealerId: 'astrid',
        eventId: job.eventId,
        sourceEvent: structuredClone(event.exampleEvent),
        mode: job.mode,
        context: structuredClone(job.context),
      }, {
        videoRegistry: registry,
        random: createRandom(RANDOM_SEED),
        settings: { adviceTimeoutMs: 2200 },
        fetchImpl,
      }));
      if (networkCalls !== before) {
        results.push({ id: job.id, ok: false, error: 'nätverksanrop' });
        continue;
      }
      results.push({ id: job.id, ok: true, response });
    } catch (error) {
      results.push({ id: job.id, ok: false, error: error.message });
    }
  }
  return { results, networkCalls };
}

export async function runWorktree(jobs = listJobs()) {
  const registry = await loadRegistry();
  return executeJobs(selectPresentation, createSeedProject(), registry, jobs);
}

function compareResults(jobs, head, worktree) {
  const diffs = [];
  for (const job of jobs) {
    const left = head.get(job.id);
    const right = worktree.get(job.id);
    const label = jobLabel(job);
    if (!left || !right) {
      diffs.push({ ...label, path: '$', head: left ? 'finns' : 'saknas', worktree: right ? 'finns' : 'saknas' });
      continue;
    }
    if (!left.ok || !right.ok) {
      if (left.ok !== right.ok || left.error !== right.error) {
        diffs.push({ ...label, path: '$', head: left.ok ? 'svar' : left.error, worktree: right.ok ? 'svar' : right.error });
      } else diffs.push({ ...label, path: '$', head: left.error, worktree: right.error, note: 'båda sidor kastade' });
      continue;
    }
    const diff = firstDiff(left.response, right.response);
    if (diff) diffs.push({ ...label, path: diff.path, head: preview(diff.left), worktree: preview(diff.right) });
  }
  return diffs;
}

async function readFixtures(jobs, worktree) {
  const diffs = [];
  for (const job of jobs) {
    const right = worktree.get(job.id);
    const label = jobLabel(job);
    let expected;
    try {
      expected = canonical(JSON.parse(await readFile(join(FIXTURE_DIR, `${job.id}.json`), 'utf8')));
    } catch (error) {
      if (error.code === 'ENOENT') diffs.push({ ...label, path: '$', fixture: 'saknas' });
      else diffs.push({ ...label, path: '$', fixture: error.message });
      continue;
    }
    if (!right?.ok) {
      diffs.push({ ...label, path: '$', worktree: right?.error ?? 'saknas' });
      continue;
    }
    const diff = firstDiff(expected, right.response);
    if (diff) diffs.push({ ...label, path: diff.path, fixture: preview(diff.left), worktree: preview(diff.right) });
  }
  return diffs;
}

async function writeFixtures(jobs, worktree) {
  await mkdir(FIXTURE_DIR, { recursive: true });
  for (const job of jobs) {
    const result = worktree.get(job.id);
    if (!result?.ok) throw new Error(`${job.id}: inget svar att spara (${result?.error ?? 'saknas'})`);
    await writeFile(join(FIXTURE_DIR, `${job.id}.json`), `${JSON.stringify(result.response, null, 2)}\n`);
  }
  const manifest = {
    dealerId: 'astrid',
    randomSeed: RANDOM_SEED,
    calls: jobs.length,
    note: 'Ny baslinje får skrivas endast efter Jakobs godkännande.',
    cases: jobs.map(job => job.id),
  };
  await writeFile(join(FIXTURE_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

async function materializeHead() {
  const dir = await mkdtemp(join(tmpdir(), 'astrid-select-head-'));
  const archive = join(dir, 'head.tar');
  // A newly added worktree module may not exist in the older HEAD being compared.
  const {stdout}=await execFileAsync('git',['ls-tree','-r','--name-only','HEAD','--',...ARCHIVE_PATHS],{cwd:repoRoot});
  const tracked=stdout.trim().split(/\r?\n/);
  const paths=ARCHIVE_PATHS.filter(path=>tracked.some(file=>file===path||file.startsWith(path+'/')));
  await execFileAsync('git', ['archive', '--format=tar', 'HEAD', '-o', archive, ...paths], { cwd: repoRoot });
  await execFileAsync('tar', ['-xf', archive, '-C', dir]);
  const packageUrl = pathToFileURL(join(repoRoot, 'lab', 'lib', 'project-store.mjs')).href;
  const entryPath = join(dir, 'register-hooks.mjs');
  const hooksPath = join(dir, 'bare-specifier-hooks.mjs');
  const runnerPath = join(dir, 'run-head.mjs');
  await writeFile(hooksPath, `const parentURL = ${JSON.stringify(packageUrl)};
const bare = specifier => !specifier.includes(':') && !specifier.startsWith('.') && !specifier.startsWith('/') && !specifier.startsWith('\\\\');
export async function resolve(specifier, context, nextResolve) {
  if (!bare(specifier)) return nextResolve(specifier, context);
  return nextResolve(specifier, { ...context, parentURL });
}
`);
  await writeFile(entryPath, `import { register } from 'node:module';
register(${JSON.stringify(pathToFileURL(hooksPath).href)}, import.meta.url);
`);
  const toolUrl = pathToFileURL(join(repoRoot, 'tools/astrid-select-baseline.mjs')).href;
  await writeFile(runnerPath, `import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { executeJobs, loadRegistry } from ${JSON.stringify(toolUrl)};
const root = process.env.ASTRID_HEAD_ROOT;
const selectionEntry = join(root, ${JSON.stringify(HEAD_SELECTION_ENTRIES[0])});
// During the extraction, an older HEAD still owns the previous source path.
// Resolve within the frozen archive, never through the current app composition.
const selection = await import(pathToFileURL(existsSync(selectionEntry) ? selectionEntry : join(root, 'packages/presentation/runtime/selection.mjs')).href);
const model = await import(pathToFileURL(join(root, ${JSON.stringify(HEAD_SELECTION_ENTRIES[1])})).href);
const jobs = JSON.parse(await readFile(process.env.ASTRID_JOBS, 'utf8'));
const outcome = await executeJobs(selection.selectPresentation, model.createSeedProject(), await loadRegistry(), jobs);
await writeFile(process.env.ASTRID_OUT, JSON.stringify(outcome));
`);
  return { dir, entryPath, runnerPath };
}

async function runHead(scratch, jobs) {
  const jobsPath = join(scratch.dir, 'jobs.json');
  const outPath = join(scratch.dir, 'head-results.json');
  await writeFile(jobsPath, JSON.stringify(jobs));
  await execFileAsync(process.execPath, ['--import', pathToFileURL(scratch.entryPath).href, scratch.runnerPath], {
    cwd: repoRoot,
    env: { ...process.env, ASTRID_HEAD_ROOT: scratch.dir, ASTRID_JOBS: jobsPath, ASTRID_OUT: outPath },
    maxBuffer: 8 * 1024 * 1024,
    timeout: 180000,
  });
  return JSON.parse(await readFile(outPath, 'utf8'));
}

function byId(results) {
  return new Map(results.map(result => [result.id, result]));
}

async function main(write) {
  const jobs = listJobs();
  const scratch = await materializeHead();
  try {
    process.stderr.write(`HEAD-arkiv ${scratch.dir}\n`);
    const [headOutcome, workOutcome] = await Promise.all([runHead(scratch, jobs), runWorktree(jobs)]);
    const head = byId(headOutcome.results);
    const worktree = byId(workOutcome.results);
    const headDiffs = compareResults(jobs, head, worktree);
    const wrote = write && !headDiffs.length;
    if (wrote) await writeFixtures(jobs, worktree);
    const fixtureDiffs = await readFixtures(jobs, worktree);
    const summary = {
      calls: jobs.length,
      networkCalls: headOutcome.networkCalls + workOutcome.networkCalls,
      headDiffs,
      fixtureDiffs: wrote ? fixtureDiffs : fixtureDiffs.slice(0, 8),
      fixtureDiffCount: fixtureDiffs.length,
      wrote,
      writeRefused: Boolean(write && headDiffs.length),
    };
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    if (headDiffs.length || fixtureDiffs.length) process.exitCode = 1;
  } finally {
    await rm(scratch.dir, { recursive: true, force: true });
  }
}

function invokedDirectly() {
  const entry = process.argv[1];
  if (!entry) return false;
  try { return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
}

if (invokedDirectly()) {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const unknown = args.filter(arg => arg !== '--write');
  if (unknown.length) {
    process.stderr.write(`Okänt argument: ${unknown.join(' ')}\n`);
    process.exitCode = 2;
  } else {
    main(write).catch(error => {
      process.stderr.write(`${error.stderr || error.stack || error.message}\n`);
      process.exitCode = 1;
    });
  }
}
