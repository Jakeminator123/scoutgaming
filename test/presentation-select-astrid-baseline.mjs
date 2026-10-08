import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { FIXTURE_DIR, canonical, firstDiff, listJobs, runWorktree } from '../tools/astrid-select-baseline.mjs';

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
