#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { featurePatterns, matchesBranchPattern, redactSecrets, repositoryFromRemote } from './check-push-target.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

export function loadPolicy(read = readFileSync) {
  return JSON.parse(read(new URL('./repository-policy.json', import.meta.url), 'utf8'));
}

export function parseDeliveryArgs(args) {
  if (args.some(arg => arg !== '--check' && arg !== '--admin-main')) {
    throw new Error('Usage: node tools/push-github-work.mjs [--check] [--admin-main]');
  }
  return { check: args.includes('--check'), adminMain: args.includes('--admin-main') };
}

export function planGithubDelivery({ branch, adminMain = false, policy }) {
  if (policy.mode !== 'github-only') throw new Error('Expected GitHub-only repository policy.');
  const patterns = featurePatterns(policy);
  if (adminMain) {
    if (branch !== policy.branch) throw new Error(`--admin-main only pushes ${policy.branch}.`);
    return { branch, ref: `refs/heads/${policy.branch}`, emergency: true, pullRequest: null };
  }
  if (branch === policy.branch) {
    throw new Error(`Direct push to ${policy.branch} is an admin emergency path. Pass --admin-main, or deliver from a feature branch (${patterns.join(', ')}) and open a pull request.`);
  }
  if (!patterns.some(pattern => matchesBranchPattern(branch, pattern))) {
    throw new Error(`Branch ${branch || '(detached)'} is not a delivery branch. Use ${patterns.join(', ')}.`);
  }
  return {
    branch,
    ref: `refs/heads/${branch}`,
    emergency: false,
    pullRequest: `gh pr create --repo ${policy.repository} --base ${policy.branch} --head ${branch}`,
  };
}

function gitRunner(cwd) {
  return (...args) => {
    const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
    if (result.error || result.status !== 0) {
      throw new Error(redactSecrets(result.error?.message || result.stderr.trim() || `git ${args[0]} failed`));
    }
    return result.stdout.trim();
  };
}

export function deliver({ args = [], policy, git, log = console.log }) {
  const options = parseDeliveryArgs(args);
  const branch = git('branch', '--show-current');
  const plan = planGithubDelivery({ branch, adminMain: options.adminMain, policy });
  const urls = git('remote', 'get-url', '--push', '--all', 'origin').split(/\r?\n/).filter(Boolean);
  const repo = urls.length === 1 ? repositoryFromRemote(urls[0]) : null;
  if (!repo || repo.toLowerCase() !== String(policy.repository).toLowerCase()) {
    throw new Error('origin must have exactly one push URL: the approved GitHub repository.');
  }
  const local = git('rev-parse', 'HEAD');
  const remote = git('ls-remote', '--heads', urls[0], plan.ref).split(/\s+/)[0] || '';
  if (remote) {
    try { git('merge-base', '--is-ancestor', remote, local); }
    catch { throw new Error(`GitHub is not a known ancestor. Run git fetch origin ${branch}, then inspect divergence. No force push.`); }
  }
  log(JSON.stringify({
    branch: plan.branch,
    local,
    remote: remote || null,
    gitlab: 'paused',
    emergency: plan.emergency,
    pullRequest: plan.pullRequest,
  }));
  if (!options.check) {
    git('push', 'origin', `${local}:${plan.ref}`);
    const after = git('ls-remote', '--heads', urls[0], plan.ref).split(/\s+/)[0];
    if (after !== local) throw new Error('GitHub commit does not match the pushed commit.');
    const tracking = `refs/remotes/origin/${plan.branch}`;
    // Explicit source/destination works when origin fetches only main. Fetch
    // the already-approved push URL, which may differ from origin's fetch URL.
    git('fetch', '--no-tags', urls[0], `${plan.ref}:${tracking}`);
    if (git('rev-parse', tracking) !== local) throw new Error('GitHub branch changed while fetching the pushed commit.');
    let fetchSpecs = [];
    try { fetchSpecs = git('config', '--get-all', 'remote.origin.fetch').split(/\r?\n/); } catch { /* No fetch mapping yet. */ }
    const mapped = fetchSpecs.some(spec => {
      const [from, to] = spec.replace(/^\+/, '').split(':');
      if (!to) return false;
      const wildcard = from.indexOf('*');
      if (wildcard < 0) return from === plan.ref && to === tracking;
      const prefix = from.slice(0, wildcard), suffix = from.slice(wildcard + 1);
      if (!plan.ref.startsWith(prefix) || !plan.ref.endsWith(suffix)) return false;
      const match = plan.ref.slice(prefix.length, suffix ? -suffix.length : undefined);
      return to.replace('*', match) === tracking;
    });
    if (!mapped) git('remote', 'set-branches', '--add', 'origin', plan.branch);
    git('branch', `--set-upstream-to=origin/${plan.branch}`, plan.branch);
    log(`GitHub verified: ${after}`);
  }
  if (plan.pullRequest) log(`Pull request command (not created by this tool): ${plan.pullRequest}`);
  return plan;
}

export function main(argv = process.argv.slice(2)) {
  try {
    deliver({ args: argv, policy: loadPolicy(), git: gitRunner(root) });
  } catch (error) {
    console.error(redactSecrets(error.message));
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
