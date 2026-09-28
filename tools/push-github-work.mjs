#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const policy = JSON.parse(readFileSync(new URL('./repository-policy.json', import.meta.url), 'utf8'));
const args = process.argv.slice(2);
const ref = `refs/heads/${policy.branch}`;
const allowed = [`git@github.com:${policy.repository}.git`, `https://github.com/${policy.repository}.git`];
function git(...args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr.trim());
  return result.stdout.trim();
}
try {
  if (args.some(arg => arg !== '--check')) throw new Error('Usage: node tools/push-github-work.mjs [--check]');
  if (policy.mode !== 'github-only') throw new Error('Expected GitHub-only repository policy.');
  if (git('branch', '--show-current') !== policy.branch) throw new Error(`Use branch ${policy.branch}.`);
  const urls = git('remote', 'get-url', '--push', '--all', 'origin').split(/\r?\n/);
  if (urls.length !== 1 || !allowed.includes(urls[0])) throw new Error('origin must have exactly one push URL: the approved GitHub repository.');
  const local = git('rev-parse', 'HEAD');
  const remote = git('ls-remote', '--heads', urls[0], ref).split(/\s+/)[0];
  if (remote) {
    try { git('merge-base', '--is-ancestor', remote, local); }
    catch { throw new Error(`GitHub is not a known ancestor. Run git fetch origin ${policy.branch}, then inspect divergence. No force push.`); }
  }
  console.log(JSON.stringify({ branch: policy.branch, local, remote: remote || null, gitlab: 'paused' }));
  if (!args.includes('--check')) {
    git('push', 'origin', `${local}:${ref}`);
    const after = git('ls-remote', '--heads', urls[0], ref).split(/\s+/)[0];
    if (after !== local) throw new Error('GitHub commit does not match the pushed commit.');
    git('branch', `--set-upstream-to=origin/${policy.branch}`, policy.branch);
    console.log(`GitHub verified: ${after}`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
