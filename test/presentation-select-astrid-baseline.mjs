import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARCHIVE_PATHS, FIXTURE_DIR, HEAD_SELECTION_ENTRIES, canonical, firstDiff, listJobs, runWorktree } from '../tools/astrid-select-baseline.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function stripComments(source) {
  let out = '';
  let i = 0;
  let state = 'code';
  let quote = '';
  while (i < source.length) {
    const c = source[i];
    const n = source[i + 1];
    if (state === 'line') {
      if (c === '\n') { state = 'code'; out += c; }
      i += 1;
      continue;
    }
    if (state === 'block') {
      if (c === '*' && n === '/') { state = 'code'; i += 2; continue; }
      if (c === '\n') out += c;
      i += 1;
      continue;
    }
    if (state === 'str') {
      out += c;
      if (c === '\\') { if (n) out += n; i += 2; continue; }
      if (c === quote) state = 'code';
      i += 1;
      continue;
    }
    if (c === '/' && n === '/') { state = 'line'; i += 2; continue; }
    if (c === '/' && n === '*') { state = 'block'; i += 2; continue; }
    if (c === '"' || c === "'" || c === '`') { state = 'str'; quote = c; out += c; i += 1; continue; }
    out += c;
    i += 1;
  }
  return out;
}

function localEdges(source) {
  const clean = stripComments(source);
  const edges = [];
  const take = spec => {
    if (spec.startsWith('node:') || (!spec.startsWith('.') && !spec.startsWith('file:'))) return;
    edges.push(spec);
  };
  for (const match of clean.matchAll(/(?:^|[^.\w])from\s*(['"])([^'"]+)\1/g)) {
    const before = clean.slice(0, match.index);
    const window = before.slice(before.lastIndexOf(';') + 1);
    if (/\b(?:import|export)\b/.test(window)) take(match[2]);
  }
  for (const match of clean.matchAll(/(?:^|[;\n])\s*import\s*(['"])([^'"]+)\1/g)) take(match[2]);
  for (const match of clean.matchAll(/\bimport\s*\(\s*(['"])([^'"]+)\1\s*\)/g)) take(match[2]);
  for (const match of clean.matchAll(/new\s+URL\(\s*(['"])([^'"]+)\1\s*,\s*import\.meta\.url\s*\)/g)) take(match[2]);
  for (const match of clean.matchAll(/join\(\s*(?:dirname\(\s*fileURLToPath\(\s*import\.meta\.url\s*\)\s*\)|import\.meta\.dirname)\s*((?:\s*,\s*(['"])[^'"]+\2)+)/g)) {
    const parts = [...match[1].matchAll(/(['"])([^'"]+)\1/g)].map(item => item[2]);
    take(`./${parts.join('/')}`);
  }
  const dynamic = [];
  for (const match of clean.matchAll(/\bimport\s*\(\s*([^)'"`\s][^)]*)\)/g)) dynamic.push(match[1].trim());
  return { edges, dynamic };
}

function repoRelative(abs) {
  const rel = relative(repoRoot, abs).split('\\').join('/');
  if (!rel || rel.startsWith('..') || rel.startsWith('/')) return null;
  return rel;
}

function archived(rel) {
  return ARCHIVE_PATHS.some(path => rel === path || rel.startsWith(`${path}/`));
}

function modulesOutsideArchive() {
  const missing = [];
  const seen = new Set();
  const queue = HEAD_SELECTION_ENTRIES.map(rel => join(repoRoot, rel));
  while (queue.length) {
    const abs = queue.shift();
    const rel = repoRelative(abs);
    if (!rel) {
      missing.push(`outside repository: ${abs}`);
      continue;
    }
    if (seen.has(rel)) continue;
    seen.add(rel);
    if (!archived(rel)) missing.push(rel);
    if (!/\.(?:mjs|js|cjs)$/.test(rel)) continue;
    const { edges, dynamic } = localEdges(readFileSync(abs, 'utf8'));
    for (const spec of dynamic) missing.push(`${rel}: dynamic import(${spec})`);
    for (const spec of edges) {
      const target = spec.startsWith('file:') ? fileURLToPath(spec) : resolve(dirname(abs), spec);
      if (!existsSync(target) || !statSync(target).isFile()) {
        missing.push(`${rel}: missing ${spec}`);
        continue;
      }
      queue.push(target);
    }
  }
  return { missing, seen: seen.size };
}

test('Astrid select in the worktree matches the approved baseline', async () => {
  const jobs = listJobs();
  const manifest = JSON.parse(await readFile(join(FIXTURE_DIR, 'manifest.json'), 'utf8'));
  assert.equal(manifest.calls, jobs.length);
  assert.deepEqual(manifest.cases, jobs.map(job => job.id));
  const { results, networkCalls } = await runWorktree(jobs);
  assert.equal(networkCalls, 0);
  const byId = new Map(results.map(result => [result.id, result]));
  const failures = [];
  let first = null;
  for (const job of jobs) {
    const result = byId.get(job.id);
    const label = `event=${job.eventId} mode=${job.mode} kontext=${job.contextId}`;
    if (!result?.ok) {
      failures.push(`${label}: ${result?.error ?? 'saknas'}`);
      first ??= { label, actual: result ?? null, expected: 'select-svar' };
      continue;
    }
    const expected = canonical(JSON.parse(await readFile(join(FIXTURE_DIR, `${job.id}.json`), 'utf8')));
    const diff = firstDiff(expected, result.response);
    if (diff) {
      failures.push(`${label} ${diff.path}`);
      first ??= { label, actual: result.response, expected };
    }
  }
  if (first) {
    const rest = failures.length > 1 ? `\növriga: ${failures.slice(1).join('; ')}` : '';
    assert.deepEqual(first.actual, first.expected, `${first.label}${rest}`);
  }
});

test('HEAD archive covers the selection import graph', () => {
  const graph = modulesOutsideArchive();
  assert.ok(graph.seen > 20, `import graph unexpectedly small (${graph.seen})`);
  assert.deepEqual(graph.missing, []);
});
