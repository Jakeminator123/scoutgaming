import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDocumentationPath } from './documentation-paths.mjs';

// Only prose with no runtime role takes the short PR path. Unknown paths,
// runtime prompts, machine registries and workflow changes run the full suite.

// The regression legs of .github/workflows/croupier.yml. The workflow reads its
// matrix from the classifier output, so the leg table lives here, next to the
// scope table that selects legs; test/ci-changes.mjs proves the legs partition
// the suites of .githooks/pre-commit-full (engine and container run separately).
export const REGRESSION_LEGS = Object.freeze([
  { leg: 'studio', suites: 'studio' },
  { leg: 'admin-contracts', suites: 'admin contracts', policy: true },
  { leg: 'database-engine', suites: 'database', postgres: true },
  { leg: 'presentation', suites: 'presentation' },
  { leg: 'access', suites: 'access', build: true },
  { leg: 'speech-gameplay', suites: 'speech gameplay', speech_node: true, lipsync: true },
  { leg: 'browser', suites: '', browser: true },
].map(Object.freeze));
export const LIPSYNC_LEG = 'speech-gameplay';

// Scope matrix (which regression legs a classified PR diff runs). Unknown or
// shared paths (packages/*, test/fixtures/*, .githooks, tools, ops) are 'full'.
//   documentation    reviewed prose only                      no legs; documentation job
//   openclaw-deploy  only services/openclaw/lab/deploy/**     admin-contracts, access (+ gateway container)
//   full             everything else                          every leg
// openclaw-deploy is safe because the Gateway image copies only deploy/ files,
// and deploy/ is imported solely by the access suite (deploy/*.test.mjs,
// test/backup-render-state.mjs, the lab check) and scanned by the contracts
// suite (no-sqlite, orphan tests). lab/src/ is copied into Postgres fixtures,
// so it stays 'full'.
export const SCOPE_LEGS = Object.freeze({
  documentation: Object.freeze([]),
  'openclaw-deploy': Object.freeze(['admin-contracts', 'access']),
  full: Object.freeze(REGRESSION_LEGS.map(({ leg }) => leg)),
});

export function parseDiff(raw) {
  if (raw === '') return [];
  if (!raw.endsWith('\0')) throw Error('Incomplete CI diff');
  const fields = raw.slice(0, -1).split('\0');
  if (fields.length % 2) throw Error('Malformed CI diff');
  const changes = [];
  for (let index = 0; index < fields.length; index += 2) {
    const match = /^:(\d{6}) (\d{6}) [a-f0-9]{40} [a-f0-9]{40} ([A-Z])$/.exec(fields[index]);
    if (!match || !fields[index + 1]) throw Error('Unexpected CI diff record');
    changes.push({ before: match[1], after: match[2], status: match[3], path: fields[index + 1] });
  }
  return changes;
}

// Plain file edits (no symlinks, modes or type changes) with a safe repository path.
function ordinaryChange({ before, after, status, path }) {
  return /^[AMD]$/.test(status) && [before, after].every(mode => ['000000', '100644'].includes(mode))
    && typeof path === 'string' && path !== '' && !path.includes('\\') && !path.split('/').some(part => ['', '.', '..'].includes(part));
}

export function documentationOnly(changes) {
  return changes.length > 0 && changes.every(change => ordinaryChange(change) && isDocumentationPath(change.path));
}

export function openClawDeployOnly(changes) {
  return changes.length > 0 && changes.every(change => ordinaryChange(change) && change.path.startsWith('services/openclaw/lab/deploy/'));
}

export function scopeOf(changes) {
  return documentationOnly(changes) ? 'documentation' : openClawDeployOnly(changes) ? 'openclaw-deploy' : 'full';
}

export function regressionLegs(scope) {
  const names = SCOPE_LEGS[scope] ?? SCOPE_LEGS.full;
  return REGRESSION_LEGS.filter(({ leg }) => names.includes(leg));
}

function migrationSensitivePath(path) {
  // A client directory can also contain dependencies, schemas or build/config
  // inputs. Serialized metadata is not proof of a presentation-only change.
  return /\.(?:json5?|ya?ml|toml|ini|sql|ddl|prisma|lockb?)$/.test(path)
    || /(?:^|\/)(?:migrations?|schemas?|configs?|configuration)(?:\/|$)/.test(path)
    || /(?:^|\/)(?:\.env(?:\.[^/]+)?|\.npmrc|\.yarnrc|(?:[^/]+[.-])?(?:config|configuration|schema|build|setup)\.[cm]?[jt]s)$/.test(path);
}

export function migrationReadinessRequired(changes) {
  if (!changes.length) return true;
  if (documentationOnly(changes)) return false;
  // Only clearly client-side edits and test-only edits avoid a live ledger read.
  // Server code, migrations, dependencies, workflow and unknown paths stay strict.
  return !changes.every(({path, before, after, status}) =>
    /^[AMD]$/.test(status) && [before, after].every(mode => ['000000', '100644'].includes(mode)) &&
    !path.includes('\\') && !path.split('/').some(part => ['', '.', '..'].includes(part)) &&
    (/^(?:test\/|apps\/studio\/test\/)/.test(path)
      || documentationOnly([{path, before, after, status}])
      || !migrationSensitivePath(path)
        && (/^(?:apps\/studio\/components\/|apps\/web\/components\/|apps\/studio\/client\/)/.test(path)
          || /\.(?:css|scss|png|jpg|jpeg|svg|webp)$/.test(path)))
  );
}

export function movingWorkerRequired(changes) {
  // Include deletions (the diff uses --no-renames) and the worker's own workflow.
  // Edits to croupier.yml or this classifier no longer rebuild the image: Actions
  // validates the workflow_call hand-off when it parses the workflow (unknown inputs,
  // secrets or bad YAML fail before any job starts); a wrong value mapping only
  // surfaces on the next worker build. Uncertain input stays strict.
  return !changes.length || changes.some(({path}) =>
    !path || path.includes('\\') || path.split('/').some(part => ['', '.', '..'].includes(part))
    || path.startsWith('services/moving-gpu-worker/')
    || path === '.github/workflows/moving-gpu-build.yml');
}

export function gatewayContainerRequired(changes) {
  // The pinned Gateway image is built from services/openclaw/lab with only deploy/
  // inputs (Dockerfile.gateway COPY lines). Its own test, the lab root files, the
  // hook registry and the workflow that runs it also count; uncertain input stays strict.
  return !changes.length || changes.some(({path}) =>
    !path || path.includes('\\') || path.split('/').some(part => ['', '.', '..'].includes(part))
    || path.startsWith('services/openclaw/lab/deploy/')
    || /^services\/openclaw\/lab\/[^/]+$/.test(path)
    || path.startsWith('.github/') || path.startsWith('.githooks/')
    || path === 'tools/regression-group.mjs');
}

const LONG_LIVED_REFS = ['refs/heads/main', 'refs/heads/preview'];

function readEvent(env) {
  try { return JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8')); } catch { return null; }
}

// A draft PR runs only the classifier and the targeted job (precommit-checks on
// the merge diff); the gate is then named "CI (utkast)" so the required check
// CI stays missing until the PR is ready. Anything unreadable counts as ready.
export function draftPullRequest({ env = process.env } = {}) {
  if (env.GITHUB_EVENT_NAME !== 'pull_request' || !env.GITHUB_EVENT_PATH) return false;
  return readEvent(env)?.pull_request?.draft === true;
}

export function ciSelection({ env = process.env, cwd = process.cwd() } = {}) {
  // Long-lived branches (main, preview) and manual runs always verify the complete product after integration.
  const complete = {scope: 'full', migration: true, moving: true, gateway: true, draft: false};
  const git = args => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore','pipe','pipe'] });
  // Rebuilding an unchanged isolated worker image adds no new acceptance.
  // Only a complete, verified push range may skip that image build on main/preview.
  if (env.GITHUB_EVENT_NAME === 'push' && LONG_LIVED_REFS.includes(env.GITHUB_REF)
    && /^[a-f0-9]{40}$/.test(env.GITHUB_SHA || '') && env.GITHUB_EVENT_PATH) {
    try {
      const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8'));
      if (!/^[a-f0-9]{40}$/.test(event?.before || '') || event.before === env.GITHUB_SHA
        || event.after !== env.GITHUB_SHA || git(['rev-parse','HEAD']).trim() !== env.GITHUB_SHA) return complete;
      git(['merge-base','--is-ancestor',event.before,'HEAD']);
      const changes = parseDiff(git(['diff','--raw','--no-abbrev','--no-renames','--no-ext-diff','--no-textconv','-z',event.before,'HEAD','--']));
      return {...complete, moving: movingWorkerRequired(changes)};
    } catch {
      // Missing history, malformed events and uncertain diffs keep the build.
      return complete;
    }
  }
  if (env.GITHUB_EVENT_NAME !== 'pull_request') return complete;
  if (!/^refs\/pull\/\d+\/merge$/.test(env.GITHUB_REF || '') || !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA || '')) return complete;
  const parents = git(['rev-list', '--parents', '-n', '1', 'HEAD']).trim().split(' ');
  if (parents.length !== 3 || parents[0] !== env.GITHUB_SHA) return complete;
  // Checkout's PR merge commit includes current main. Comparing its first
  // parent avoids misclassifying an old branch or looking only at its last push.
  const changes = parseDiff(git(['diff', '--raw', '--no-abbrev', '--no-renames', '--no-ext-diff', '--no-textconv', '-z', 'HEAD^1', 'HEAD', '--']));
  return {scope: scopeOf(changes), migration: migrationReadinessRequired(changes), moving: movingWorkerRequired(changes),
    gateway: gatewayContainerRequired(changes), draft: draftPullRequest({ env })};
}

export function ciScope(options) {
  return ciSelection(options).scope;
}

// GITHUB_OUTPUT lines for the workflow: scope, booleans, the leg list and the
// dealer-regression matrix (fromJSON in the workflow).
export function ciOutputs(selection) {
  const legs = regressionLegs(selection.scope);
  return {
    scope: selection.scope, migration: String(selection.migration), moving: String(selection.moving),
    gateway: String(selection.gateway), draft: String(selection.draft),
    legs: JSON.stringify(legs.map(({ leg }) => leg)), matrix: JSON.stringify({ include: legs }),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const selection = ciSelection();
  const outputs = ciOutputs(selection);
  const {scope, migration, moving, gateway, draft} = outputs;
  console.log(`CI scope: ${scope}; draft: ${draft}; regression legs: ${outputs.legs}; production migration readiness: ${migration}; Moving image check: ${moving}; Gateway container: ${gateway}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(outputs).map(([key, value]) => `${key}=${value}\n`).join(''));
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `### Verification scope: ${scope}${draft === 'true' ? ' (draft: targeted checks only, no CI check until ready for review)' : ''}\n\n${scope === 'documentation'
      ? 'Prose-only PR: environment registry, delivery policy and documentation checks. No runtime acceptance is claimed.'
      : draft === 'true'
        ? 'Draft PR: precommit-checks on the merge diff only. The full regression runs when the PR is marked ready for review.'
        : `Regression legs: ${JSON.parse(outputs.legs).join(', ')}${scope === 'full' ? ' (full product checks, Studio build, isolated SQL/HTTPS acceptance and worker checks)' : ''}. Gateway container: ${gateway}. Live migration readiness: ${migration === 'true' ? 'required' : 'not needed for client/test-only edits'}.`}\n`);
}
