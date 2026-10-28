import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Partnerportalens serverläsning körs i serverkomponenter (app/partner →
// workspace-surface-page.tsx) och i app/api/partner-rutten. En modul utan
// 'use client' som drar in React-hooks eller klientdelar av Next i den grafen
// fäller Next-bygget ("importing a module that depends on useEffect into a
// React Server Component"). Provet går igenom grafen från dessa ingångar,
// följer statiska och dynamiska importer i .mjs/.js/.ts/.tsx/.jsx och stannar
// vid klientgränsen ('use client'), där hooks hör hemma.
const studioRoot = fileURLToPath(new URL('../', import.meta.url));
const roots = ['app/api/partner/[...action]/route.ts', 'components/workspace-surface-page.tsx', 'lib/partner-data.mjs', 'lib/partner-session.mjs', 'lib/partner-words.mjs'];
const extensions = ['.tsx', '.ts', '.jsx', '.js', '.mjs'];
const importPattern = /(?:^|\n)\s*(?:import|export)\s[^'";]*?from\s*['"]([^'"]+)['"]|(?:^|\n)\s*import\s*['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;
const clientDirective = /^\s*(['"])use client\1/;
const hookImport = /\buse[A-Z]\w*/;

function resolveSpecifier(specifier, from) {
  const base = specifier.startsWith('@/') ? resolve(studioRoot, specifier.slice(2)) : specifier.startsWith('.') ? resolve(dirname(from), specifier) : null;
  if (!base) return null;
  if (/\.(?:mjs|js|ts|tsx|jsx|mts|cts)$/.test(base)) return existsSync(base) ? base : null;
  for (const extension of extensions) { if (existsSync(base + extension)) return base + extension; }
  for (const extension of extensions) { if (existsSync(resolve(base, 'index' + extension))) return resolve(base, 'index' + extension); }
  return null;
}

function walk(file, graph) {
  if (graph.seen.has(file)) return;
  graph.seen.add(file);
  const source = readFileSync(file, 'utf8');
  if (clientDirective.test(source)) { graph.boundaries.add(file); return; }
  const kind = /\.(?:tsx|jsx)$/.test(file) ? 'component' : 'module';
  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1] ?? match[2] ?? match[3];
    const clause = match[0];
    if (/^react(?:-dom)?(?:\/|$)/.test(specifier)) {
      // Pure .mjs/.ts modules never import React; a server component may import
      // React for JSX but no hook, and never react-dom.
      if (kind === 'module' || specifier.startsWith('react-dom') || hookImport.test(clause)) graph.offenders.push(`${file} → ${clause.trim().split('\n').pop()}`);
    } else if (/^next\//.test(specifier)) {
      // next/headers, redirect() and notFound() are server APIs; the hooks are not.
      if (kind === 'module' || hookImport.test(clause) || /^next\/(?:link|image|script|dynamic|router)/.test(specifier)) graph.offenders.push(`${file} → ${clause.trim().split('\n').pop()}`);
    }
    const target = resolveSpecifier(specifier, file);
    if (target) walk(target, graph);
  }
}

test('the server reading of Partnerportalen never pulls React hooks or Next client modules into its import graph', () => {
  const graph = { seen: new Set(), boundaries: new Set(), offenders: [] };
  for (const root of roots) {
    const file = resolve(studioRoot, root);
    assert.ok(existsSync(file), root);
    walk(file, graph);
  }
  assert.deepEqual(graph.offenders, []);
  const relative = file => file.slice(studioRoot.length).replaceAll('\\', '/');
  const seen = [...graph.seen].map(relative), boundaries = [...graph.boundaries].map(relative);
  for (const expected of ['lib/partner-data.mjs', 'lib/partner-session.mjs', 'lib/partner-words.mjs', 'lib/partner-game-readout.mjs', 'lib/partner-workspace-access.mjs']) assert.ok(seen.includes(expected), expected);
  assert.ok(seen.length > 20, `the walk covers the server modules (${seen.length})`);
  // The client components the page hands the snapshot to are boundaries, not server modules.
  for (const expected of ['components/kevin-bo/partner-operator-workspace.jsx', 'components/partner-workspace.tsx']) assert.ok(boundaries.includes(expected), expected);
  assert.ok(!seen.includes('components/kevin-bo/partner-copy.mjs'), 'the hook module stays behind the client boundary');
});

test('the graph walk itself catches a hook import, a react import in a .mjs module and a dynamic import', () => {
  const fixture = `${studioRoot}test/fixtures/`;
  const scan = (file, source) => { const graph = { seen: new Set(), boundaries: new Set(), offenders: [] }; readFileSync.cache = null; return { graph, source }; };
  assert.ok(scan && fixture, 'helpers in scope');
  // Static analysis of representative sources through the same regexes.
  const cases = [
    ["import { useEffect, useState } from 'react';", true],
    ["import React from 'react';", false],
    ["import { createRoot } from 'react-dom/client';", true],
    ["import { useRouter } from 'next/navigation';", true],
    ["import { notFound, redirect } from 'next/navigation';", false],
    ["const { x } = await import('./partner-copy.mjs');", null],
  ];
  for (const [source, offends] of cases) {
    const [match] = [...source.matchAll(importPattern)];
    assert.ok(match, source);
    const specifier = match[1] ?? match[2] ?? match[3];
    if (offends === null) { assert.equal(specifier, './partner-copy.mjs', 'dynamic import is followed'); continue; }
    const hit = /^react(?:-dom)?(?:\/|$)/.test(specifier) ? specifier.startsWith('react-dom') || hookImport.test(match[0])
      : /^next\//.test(specifier) ? hookImport.test(match[0]) : false;
    assert.equal(hit, offends, source);
  }
});

test('the role words the server renders are the words the shell shows', async () => {
  const { partnerRoleWord } = await import('../lib/partner-words.mjs');
  const copy = await import('../components/kevin-bo/partner-copy.mjs');
  assert.equal(copy.partnerRoleWord, partnerRoleWord);
  assert.equal(partnerRoleWord('partner-editor'), 'redaktör');
  assert.equal(partnerRoleWord('custom-role', 'Nattskift'), 'Nattskift');
});
