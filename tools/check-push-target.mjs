#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

function knownAncestor(before, after) {
  return spawnSync('git', ['merge-base', '--is-ancestor', before, after], { encoding: 'utf8' }).status === 0;
}

export function validatePush(url, updates, policy, isAncestor = knownAncestor) {
  const allowed = [`git@github.com:${policy.repository}.git`, `https://github.com/${policy.repository}.git`];
  if (!allowed.includes(url)) throw new Error('GitLab is paused. Push only to the approved GitHub repository.');
  for (const line of updates.trim().split(/\r?\n/).filter(Boolean)) {
    const [localRef, sha, remoteRef, remoteSha] = line.split(/\s+/);
    if (!localRef || !/^[a-f0-9]{40,64}$/.test(sha || '') || !/^[a-f0-9]{40,64}$/.test(remoteSha || '')
      || remoteRef !== `refs/heads/${policy.branch}` || /^0+$/.test(sha)) {
      throw new Error(`Only updates to ${policy.branch} are allowed; no branch deletion or other refs.`);
    }
    if (!/^0+$/.test(remoteSha) && !isAncestor(remoteSha, sha)) {
      throw new Error('Push would rewrite history, or the remote commit is not known locally. Fetch and inspect divergence; no force push.');
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const policy = JSON.parse(readFileSync(new URL('./repository-policy.json', import.meta.url), 'utf8'));
    validatePush(process.argv[3], readFileSync(0, 'utf8'), policy);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
