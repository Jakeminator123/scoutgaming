import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureSystemMapInputs, createSourceReader, hashText, safeCiUrl, safePath } from '../docs/system-map/verify.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHA = /^[a-f0-9]{40}$/, HASH = /^[a-f0-9]{64}$/;
const json = path => JSON.parse(readFileSync(resolve(path), 'utf8').replace(/^\uFEFF/, ''));
const counts = source => Object.fromEntries(['passed', 'failed', 'cancelled', 'skipped', 'tests'].map(key => [key, Number.isSafeInteger(source?.[key]) && source[key] >= 0 ? source[key] : 0]));

// Passive Node --test reporter. It executes no test and emits no test names,
// exception messages, logs, provider receipts, identities, or environment values.
export async function* reportTestFiles(events, { repositoryRoot = process.env.GITHUB_WORKSPACE || ROOT,
  args = [...process.execArgv, ...process.argv] } = {}) {
  const root = resolve(repositoryRoot);
  const filtered = args.some(arg => /^--test-(?:name-pattern|skip-pattern|only|shard)(?:=|$)/.test(arg));
  const untypedFailures = [];
  yield JSON.stringify({ type: 'meta', schemaVersion: 1, selection: filtered ? 'filtered' : 'full-files', platform: process.platform }) + '\n';
  for await (const event of events) {
    const data = event.data || {};
    const source = data.file || (typeof data.name === 'string' && isAbsolute(data.name) && /\.(?:mjs|cjs|js|ts)$/.test(data.name) ? data.name : null);
    const path = typeof source === 'string' ? relative(root, resolve(source)).replace(/\\/g, '/') : null;
    const allowed = path && safePath(path) && /\.(?:mjs|cjs|js|ts)$/.test(path);
    if (['test:pass', 'test:fail'].includes(event.type)) {
      // Explicit AbortSignal errors can lose their type during Node's error
      // serialization. Only the same file's completed summary can disambiguate.
      if (event.type === 'test:fail' && data.details?.error?.failureType == null) {
        untypedFailures.push(allowed ? path : null); continue;
      }
      const result = event.type === 'test:fail' ? data.details?.error?.failureType === 'cancelledByParent' ? 'cancelled' : 'failed'
        : data.skip || data.todo ? 'skipped' : 'passed';
      yield JSON.stringify({ type: 'test-file', path: allowed ? path : null, result }) + '\n';
    } else if (event.type === 'test:summary') {
      const fileSummary = typeof data.file === 'string';
      for (let i = 0; i < untypedFailures.length;) {
        if (!fileSummary || (allowed && untypedFailures[i] === path)) {
          const aborted = fileSummary && allowed && data.counts?.failed === 0
            && Number.isSafeInteger(data.counts?.cancelled) && data.counts.cancelled > 0;
          yield JSON.stringify({ type: 'test-file', path: untypedFailures.splice(i, 1)[0], result: aborted ? 'cancelled' : 'failed' }) + '\n';
        } else i++;
      }
      yield JSON.stringify({ type: 'summary', path: allowed ? path : null, counts: counts(data.counts) }) + '\n';
    }
  }
  for (const path of untypedFailures) yield JSON.stringify({ type: 'test-file', path, result: 'failed' }) + '\n';
}
export default reportTestFiles;

export function captureEvidenceInputs({ repositoryRoot = ROOT, ref } = {}) {
  const working = createSourceReader({ repositoryRoot });
  if (ref) {
    const tree = createSourceReader({ repositoryRoot, ref });
    working.currentSha = tree.currentSha;
    working.commitMatched = path => {
      const actual = working.read(path), committed = tree.read(path);
      return actual !== null && committed !== null && hashText(actual) === hashText(committed);
    };
  }
  // Capture the bytes actually consumed by existing tests, not clean Git
  // bytes while a different dirty working tree is being tested.
  return captureSystemMapInputs({ reader: working });
}

export function importTestEvidence({ snapshot, reports = [], ciUrl, jobs } = {}) {
  if (snapshot?.schemaVersion !== 1 || !SHA.test(snapshot.sourceSha || '') || snapshot.hashAlgorithm !== 'sha256:utf8-lf'
    || !snapshot.files || Object.entries(snapshot.files).some(([path, hash]) => !safePath(path) || !HASH.test(hash))) {
    throw Error('A complete version-bound input snapshot is required.');
  }
  const found = new Map(), notes = [];
  for (const report of reports) {
    const events = report.trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
    const meta = events.find(event => event.type === 'meta' && event.schemaVersion === 1);
    const summaries = events.filter(event => event.type === 'summary');
    if (!meta || !summaries.some(event => event.path == null)) { notes.push('An incomplete reporter receipt was ignored.'); continue; }
    const failureKnown = events.some(event => event.type === 'test-file' && event.path && event.result === 'failed');
    const unboundFailure = summaries.some(event => counts(event.counts).failed > 0) && !failureKnown;
    const cancelled = summaries.some(event => counts(event.counts).cancelled > 0);
    for (const event of events) {
      if (event.type !== 'test-file' || !safePath(event.path) || !snapshot.files[event.path] || !['passed', 'failed', 'skipped', 'cancelled'].includes(event.result)) continue;
      const value = found.get(event.path) || { path: event.path, passed: 0, failed: 0, skipped: 0, cancelled: 0 };
      // A cancelled run cannot prove that files with earlier passing subtests
      // finished. Keep this conservative even when cancellation lacks a file.
      if (event.result === 'passed' && cancelled) value.cancelled++;
      else if (event.result === 'passed' && (meta.selection !== 'full-files' || unboundFailure)) value.skipped++;
      else value[event.result]++;
      found.set(event.path, value);
    }
    if (meta.selection !== 'full-files') notes.push('Filtered runs cannot verify complete test files.');
    if (unboundFailure) notes.push('A reporter failure could not be attributed to a declared test file.');
    if (cancelled) notes.push('A cancelled run cannot verify complete test files.');
  }
  const tests = [...found.values()].map(value => ({ ...value,
    result: value.failed ? 'failed' : value.cancelled ? 'cancelled' : value.skipped || !value.passed ? 'skipped' : 'passed' })).sort((a, b) => a.path.localeCompare(b.path));
  const safeJobs = (Array.isArray(jobs?.jobs) ? jobs.jobs : []).filter(job => typeof job.name === 'string'
    && /^[A-Za-z0-9 ._-]{1,100}$/.test(job.name) && SHA.test(job.head_sha || '')).map(job => ({
      name: job.name, sourceSha: job.head_sha, status: ['queued', 'in_progress', 'completed'].includes(job.status) ? job.status : 'unknown',
      conclusion: ['success', 'failure', 'cancelled', 'skipped', 'neutral', 'timed_out', 'action_required'].includes(job.conclusion) ? job.conclusion : 'unknown',
      ciUrl: safeCiUrl(job.html_url),
    }));
  return { schemaVersion: 1, kind: 'explicit-ci-test-files', sourceSha: snapshot.sourceSha,
    observedAt: new Date().toISOString(), hashAlgorithm: snapshot.hashAlgorithm, ciUrl: safeCiUrl(ciUrl),
    files: snapshot.files, tests, jobs: safeJobs, notes: [...new Set(notes)],
    limitation: 'Imported existing test reporter artifacts only. Successful CI jobs do not imply individual tests ran. No live CI API read.' };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2), options = { reports: [] };
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--capture') options.capture = true;
      else if (args[i] === '--report' && args[i + 1]) options.reports.push(args[++i]);
      else if (['--ref', '--snapshot', '--output', '--ci-url', '--jobs'].includes(args[i]) && args[i + 1]) options[args[i].slice(2)] = args[++i];
      else throw Error('Invalid evidence options.');
    }
    const result = options.capture ? captureEvidenceInputs({ ref: options.ref }) : importTestEvidence({
      snapshot: json(options.snapshot), reports: options.reports.map(path => readFileSync(resolve(path), 'utf8')),
      ciUrl: options['ci-url'], jobs: options.jobs ? json(options.jobs) : undefined,
    });
    if (options.output) writeFileSync(resolve(options.output), JSON.stringify(result, null, 2) + '\n');
    else console.log(JSON.stringify(result));
  } catch { console.error('System map evidence import needs a valid input snapshot and completed, sanitized reporter receipts.'); process.exitCode = 1; }
}
