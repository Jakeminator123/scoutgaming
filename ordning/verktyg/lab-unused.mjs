// Usage (repository root): node ordning/verktyg/lab-unused.mjs [dir...]
// Default dirs: lab/components lab/lib lab/app. Lists source files with no importer,
// or with test-only importers. Resolves relative specifiers and the lab "@/" alias.
// Next.js entry files (page/layout/route/...) are framework roots and are skipped.
// A file that is only loaded by path at runtime (for example served to the browser)
// shows up as "no importer": verify with rg before removing anything.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { posix } from 'node:path';

const dirs = process.argv.slice(2).length ? process.argv.slice(2) : ['lab/components', 'lab/lib', 'lab/app'];
const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\0').filter(Boolean);
const code = tracked.filter(path => /\.(?:mjs|cjs|js|jsx|ts|tsx|mts)$/.test(path) && !/^(?:random-stuff-jakob|media|ordning)\//.test(path));
const targets = code.filter(path => dirs.some(dir => path.startsWith(dir + '/'))
  && !/\.test\.(?:mjs|js|ts|tsx)$/.test(path) && !path.endsWith('.d.mts') && !path.endsWith('.d.ts'));
const isTest = path => /(^|\/)(test|tests)\//.test(path) || /\.test\.(?:mjs|js|ts|tsx)$/.test(path);
const strip = path => path.replace(/\.(?:d\.mts|mjs|cjs|js|jsx|ts|tsx|mts)$/, '').replace(/\/index$/, '');
const keyOf = new Map(targets.map(path => [strip(path), path]));
const importers = new Map(targets.map(path => [path, { product: new Set(), test: new Set() }]));
const patterns = [
  /\bimport\s+(?:type\s+)?(?:[\w*{}\s,$]+?\s+from\s+)?['"]([^'"]+)['"]/g,
  /\bexport\s+(?:type\s+)?(?:[\w*{}\s,$]+?\s+)?from\s+['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
];
for (const file of code) {
  const text = readFileSync(file, 'utf8');
  for (const pattern of patterns) for (const match of text.matchAll(pattern)) {
    const spec = match[1];
    let target = null;
    if (spec.startsWith('@/')) target = posix.join('lab', spec.slice(2));
    else if (spec.startsWith('.')) target = posix.normalize(posix.join(posix.dirname(file), spec));
    if (!target) continue;
    const hit = keyOf.get(strip(target));
    if (!hit || hit === file) continue;
    importers.get(hit)[isTest(file) ? 'test' : 'product'].add(file);
  }
}
const isRoot = path => /\/(?:page|layout|route|loading|error|not-found|template|default|middleware|instrumentation)\.(?:tsx?|jsx?|mjs)$/.test(path);
const noImporter = [], testOnly = [];
for (const [path, entry] of importers) {
  if (entry.product.size || isRoot(path)) continue;
  (entry.test.size ? testOnly : noImporter).push(path);
}
console.log('checked', targets.length, 'files in', dirs.join(', '));
for (const [label, list] of [['no importer at all', noImporter], ['imported only by tests', testOnly]]) {
  console.log(`== ${label}: ${list.length}`);
  for (const path of list.sort()) console.log('  ', path);
}
