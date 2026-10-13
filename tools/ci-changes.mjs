import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Only prose with no runtime role takes the short PR path. Unknown paths,
// runtime prompts, machine registries and workflow changes run the full suite.
const guides = new Set([
  'README.md', 'AGENTS.md', 'CLAUDE.md', 'lab/README.md',
  'web/README.md', 'web/public/README.md', 'web/storage/README.md',
  'apps/croupier-frontend/README.md', 'packages/design-preview/README.md',
  'packages/presentation/README.md', 'pipeline/README.md',
  'open-claw/README.md', 'open-claw/lab/README.md', 'open-claw/lab/docs/README.md',
  'services/astrid-gpu-worker/README.md', 'services/astrid-gpu-worker/SOURCE.md',
  'services/astrid-gpu-worker/gateway/README.md',
]);

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

export function documentationOnly(changes) {
  return changes.length > 0 && changes.every(({ before, after, status, path }) =>
    /^[AMD]$/.test(status) && [before, after].every(mode => ['000000', '100644'].includes(mode)) &&
    !path.includes('\\') && !path.split('/').some(part => ['', '.', '..'].includes(part)) &&
    (guides.has(path) || /^(?:docs|lab\/docs)\/.+\.md$/.test(path))
  );
}

export function ciScope({ env = process.env, cwd = process.cwd() } = {}) {
  // Main and manual runs always verify the complete product after integration.
  if (env.GITHUB_EVENT_NAME !== 'pull_request') return 'full';
  if (!/^refs\/pull\/\d+\/merge$/.test(env.GITHUB_REF || '') || !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA || '')) return 'full';
  const git = args => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  const parents = git(['rev-list', '--parents', '-n', '1', 'HEAD']).trim().split(' ');
  if (parents.length !== 3 || parents[0] !== env.GITHUB_SHA) return 'full';
  // Checkout's PR merge commit includes current main. Comparing its first
  // parent avoids misclassifying an old branch or looking only at its last push.
  const changes = parseDiff(git(['diff', '--raw', '--no-abbrev', '--no-renames', '--no-ext-diff', '--no-textconv', '-z', 'HEAD^1', 'HEAD', '--']));
  return documentationOnly(changes) ? 'documentation' : 'full';
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const scope = ciScope();
  console.log(`CI scope: ${scope}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `scope=${scope}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `### Verification scope: ${scope}\n\n${scope === 'documentation'
      ? 'Prose-only PR: environment registry, delivery policy, documentation and system-map checks. No runtime acceptance is claimed.'
      : 'Full product checks, Studio build, migration readiness, isolated SQL/HTTPS acceptance and worker checks.'}\n`);
}
