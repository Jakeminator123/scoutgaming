#!/usr/bin/env node

// Push only Jakob's work branch. GitLab is canonical; GitHub is a private copy.
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const branch = 'jakeminator123/work';
const ref = `refs/heads/${branch}`;
const gitlab = 'git@gitlab.com:scout-gg/croupier.git';
const github = 'git@github.com:Jakeminator123/github-work.git';
const args = process.argv.slice(2);
const checkOnly = args.includes('--check');

if (args.some((arg) => arg !== '--check')) {
  console.error('Usage: node tools/push-work-mirrors.mjs [--check]');
  process.exit(2);
}

function git(...args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    throw new Error(
      `git ${args.join(' ')} failed: ${result.error?.message ?? result.stderr.trim()}`,
    );
  }
  if (result.stderr) process.stderr.write(result.stderr);
  return result.stdout.trim();
}

function remoteHead(url) {
  const output = git('ls-remote', '--heads', url, ref);
  const sha = output.split(/\s+/)[0];
  if (!/^[0-9a-f]{40}$/.test(sha) || !output.endsWith(ref)) {
    throw new Error(`Missing or invalid ${ref} on ${url}`);
  }
  return sha;
}

function assertAncestor(sha, label) {
  const result = spawnSync('git', ['merge-base', '--is-ancestor', sha, 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(
      `${label} (${sha}) is not known to be an ancestor of local HEAD; ` +
        'fetch and resolve divergence before pushing. No force push.',
    );
  }
}

try {
  if (git('symbolic-ref', '--short', 'HEAD') !== branch) {
    throw new Error(`Run only from branch ${branch}`);
  }
  if (git('remote', 'get-url', 'origin') !== gitlab) {
    throw new Error(`origin must be ${gitlab}`);
  }

  const local = git('rev-parse', 'HEAD');
  const gitlabBefore = remoteHead(gitlab);
  const githubBefore = remoteHead(github);
  assertAncestor(gitlabBefore, 'GitLab');
  assertAncestor(githubBefore, 'GitHub');

  console.log(`Local   ${local}`);
  console.log(`GitLab  ${gitlabBefore}`);
  console.log(`GitHub  ${githubBefore}`);
  if (checkOnly) {
    console.log('Preflight passed; no push performed.');
    process.exit(0);
  }

  git('push', 'origin', `HEAD:${ref}`);
  // If this fails, GitLab may be ahead. Rerun this script after fixing access.
  git('push', github, `HEAD:${ref}`);

  const gitlabAfter = remoteHead(gitlab);
  const githubAfter = remoteHead(github);
  if (gitlabAfter !== local || githubAfter !== local) {
    throw new Error('Remote commit IDs do not both match local HEAD.');
  }
  console.log(`Both work branches match ${local}`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
