#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

function knownAncestor(before, after) {
  return spawnSync('git', ['merge-base', '--is-ancestor', before, after], { encoding: 'utf8' }).status === 0;
}

// Masks all URL userinfo: user:password@, token@ and user@ alike.
export function redactSecrets(text) {
  return String(text ?? '')
    .replace(/([A-Za-z][A-Za-z0-9+.-]*:\/\/)[^/\s@]+@/g, '$1[redacted]@');
}

export function repositoryFromRemote(url) {
  if (typeof url !== 'string' || url.length === 0 || url.length > 2000 || /[\s\\]/.test(url)) return null;
  let path = '';
  const scp = /^git@([^:]+):(.+)$/.exec(url);
  if (scp) {
    if (scp[1].toLowerCase() !== 'github.com') return null;
    path = scp[2];
  } else {
    let parsed;
    try { parsed = new URL(url); } catch { return null; }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'ssh:') return null;
    if (parsed.hostname.toLowerCase() !== 'github.com') return null;
    // Credential URLs are refused: a token in the remote must never reach a log.
    if (parsed.protocol === 'https:' && (parsed.username || parsed.password)) return null;
    if (parsed.protocol === 'ssh:' && (parsed.password || (parsed.username && parsed.username !== 'git'))) return null;
    path = parsed.pathname.replace(/^\//, '');
  }
  path = path.replace(/\.git$/, '').replace(/\/$/, '');
  const parts = path.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return `${parts[0]}/${parts[1]}`;
}

export function matchesBranchPattern(name, pattern) {
  if (typeof name !== 'string' || typeof pattern !== 'string') return false;
  const parts = pattern.split('*');
  if (parts.length !== 2 || !parts[0].endsWith('/')) return false;
  const [prefix, suffix] = parts;
  if (!name.startsWith(prefix) || !name.endsWith(suffix)) return false;
  const middle = name.slice(prefix.length, name.length - suffix.length);
  if (!middle || middle.startsWith('/') || middle.endsWith('/') || middle.includes('//') || middle.includes('..') || middle.includes('@{') || middle.endsWith('.lock') || middle.endsWith('.')) return false;
  return /^[A-Za-z0-9._/-]+$/.test(middle);
}

export function featurePatterns(policy) {
  const patterns = policy?.featureBranches;
  const invalid = !Array.isArray(patterns) || patterns.length === 0 || patterns.some(pattern => {
    const parts = typeof pattern === 'string' ? pattern.split('*') : [];
    return parts.length !== 2 || !parts[0].endsWith('/');
  });
  if (invalid) throw new Error('repository policy featureBranches must list patterns such as jakob/*, codex/* and cursor/*.');
  return patterns;
}

export function isAllowedHead(name, policy) {
  return name === policy.branch || featurePatterns(policy).some(pattern => matchesBranchPattern(name, pattern));
}

function refusal(policy) {
  const patterns = featurePatterns(policy).join(', ');
  return `Only updates to ${policy.branch} or feature branches (${patterns}) are allowed; no branch deletion, tags or other refs.`;
}

export function validatePush(url, updates, policy, isAncestor = knownAncestor) {
  const repo = repositoryFromRemote(url);
  if (!repo || repo.toLowerCase() !== String(policy.repository || '').toLowerCase()) {
    throw new Error('GitLab is paused. Push only to the approved GitHub repository.');
  }
  featurePatterns(policy);
  for (const line of String(updates || '').trim().split(/\r?\n/).filter(Boolean)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length !== 4) throw new Error(refusal(policy));
    const [, sha, remoteRef, remoteSha] = parts;
    if (!/^[a-f0-9]{40,64}$/.test(sha || '') || !/^[a-f0-9]{40,64}$/.test(remoteSha || '')) throw new Error(refusal(policy));
    if (remoteRef.startsWith('refs/tags/')) throw new Error('Tag updates are not allowed.');
    if (/^0+$/.test(sha)) throw new Error('Branch deletion is not allowed.');
    const name = remoteRef.startsWith('refs/heads/') ? remoteRef.slice('refs/heads/'.length) : '';
    if (!name || !isAllowedHead(name, policy)) throw new Error(refusal(policy));
    if (!/^0+$/.test(remoteSha) && !isAncestor(remoteSha, sha)) {
      throw new Error('Push would rewrite history, or the remote commit is not known locally. Fetch and inspect divergence; no force push.');
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const policy = JSON.parse(readFileSync(new URL('./repository-policy.json', import.meta.url), 'utf8'));
    const updates = readFileSync(0, 'utf8');
    validatePush(process.argv[3], updates, policy);
  } catch (error) {
    console.error(redactSecrets(error.message));
    process.exitCode = 1;
  }
}
