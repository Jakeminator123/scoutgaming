import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// partner-data.mjs läses i serverkomponenter (workspace-surface-page.tsx) och i
// app/api/partner-rutten. En modul med React-hooks i den grafen fäller Next-bygget
// ("importing a module that depends on useEffect into a React Server Component").
const roots = ['../lib/partner-data.mjs', '../lib/partner-session.mjs', '../lib/partner-words.mjs'];
const forbidden = /^(?:react(?:-dom)?(?:\/.*)?|next\/.*)$/;
const importPattern = /(?:^|\n)\s*(?:import|export)\s[^'";]*?from\s*['"]([^'"]+)['"]|(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g;

function walk(file, seen, offenders) {
  if (seen.has(file)) return;
  seen.add(file);
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1] ?? match[2];
    if (forbidden.test(specifier)) offenders.push(`${file} → ${specifier}`);
    if (specifier.startsWith('.') && /\.(?:mjs|js)$/.test(specifier)) walk(resolve(dirname(file), specifier), seen, offenders);
  }
}

test('the server reading of Partnerportalen never pulls React or Next client modules into its import graph', async () => {
  const seen = new Set(), offenders = [];
  for (const root of roots) walk(fileURLToPath(new URL(root, import.meta.url)), seen, offenders);
  assert.deepEqual(offenders, []);
  assert.ok(seen.size > 10, 'the graph walk covers the server modules');
  // The role words the server renders are the same the shell shows.
  const { partnerRoleWord } = await import('../lib/partner-words.mjs');
  const copy = await import('../components/kevin-bo/partner-copy.mjs');
  assert.equal(copy.partnerRoleWord, partnerRoleWord);
  assert.equal(partnerRoleWord('partner-editor'), 'redaktör');
  assert.equal(partnerRoleWord('custom-role', 'Nattskift'), 'Nattskift');
});
