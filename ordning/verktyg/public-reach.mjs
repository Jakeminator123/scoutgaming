// Usage (repository root): node ordning/verktyg/public-reach.mjs
// Classifies web/public source modules by who can reach them:
//   product       = reachable from a web/public HTML page, or named by non-test product code
//   test-only     = only reachable from modules that tests name or import
//   pipeline-only = only reachable from modules that pipeline/ names
//   none          = no consumer found
// External consumers are matched by bare file name (conservative: a mention counts).
// Docs, random/, planes/, ordning/ and media/ never count as consumers.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { posix } from 'node:path';

const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\0').filter(Boolean);
const isSource = path => /\.(?:mjs|cjs|js|jsx|ts|tsx|mts|html|css|json|py|sh|yml|yaml)$/.test(path);
const pub = tracked.filter(path => path.startsWith('web/public/') && /\.(?:mjs|js|html|css)$/.test(path)
  && !path.includes('/vendor/') && !path.startsWith('web/public/review/'));
const read = path => { try { return readFileSync(path, 'utf8'); } catch { return ''; } };
const kind = path => {
  if (/(^|\/)(test|tests)\//.test(path) || /\.test\.(?:mjs|js|ts|tsx)$/.test(path)) return 'test';
  if (path.startsWith('pipeline/')) return 'pipeline';
  if (/^(?:docs|random|planes|ordning)\//.test(path) || path.endsWith('.md')) return 'doc';
  if (path.startsWith('media/')) return 'media';
  return 'product';
};
const importPatterns = [
  /\bimport\s+(?:[\w*{}\s,$]+?\s+from\s+)?['"]([^'"]+)['"]/g,
  /\bexport\s+(?:[\w*{}\s,$]+?\s+)?from\s+['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
  /<script[^>]+src=['"]([^'"]+)['"]/g,
  /<link[^>]+href=['"]([^'"]+\.css)['"]/g,
  /@import\s+(?:url\()?['"]([^'"]+)['"]/g,
  /new\s+URL\(\s*['"]([^'"]+)['"]\s*,\s*import\.meta\.url\s*\)/g,
];
const resolveInPublic = (from, spec) => {
  if (/^[a-z]+:/i.test(spec)) return null;
  const target = spec.startsWith('/') ? posix.join('web/public', spec) : posix.normalize(posix.join(posix.dirname(from), spec));
  return target.split('?')[0];
};
const edges = new Map(pub.map(path => [path, new Set()]));
for (const file of pub) {
  const text = read(file);
  for (const pattern of importPatterns) for (const match of text.matchAll(pattern)) {
    const target = resolveInPublic(file, match[1]);
    if (target && edges.has(target)) edges.get(file).add(target);
  }
}
const external = tracked.filter(path => !path.startsWith('web/public/') && isSource(path)
  && !/^(?:random-stuff-jakob|ordning)\//.test(path) && path !== 'docs/system-map/index.html');
const byName = new Map(pub.map(path => [path, new Set()]));
const baseNames = new Map();
for (const path of pub) {
  const name = posix.basename(path);
  if (!baseNames.has(name)) baseNames.set(name, []);
  baseNames.get(name).push(path);
}
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const namePattern = new RegExp('(?:^|[^\\w.-])(' + [...baseNames.keys()].map(escape).join('|') + ')(?![\\w.-])', 'g');
for (const file of external) {
  const text = read(file);
  if (!text) continue;
  for (const match of text.matchAll(namePattern)) for (const path of baseNames.get(match[1]) || []) byName.get(path).add(kind(file));
}
const reach = start => {
  const seen = new Set(start), queue = [...start];
  while (queue.length) for (const next of edges.get(queue.shift()) || []) if (!seen.has(next)) { seen.add(next); queue.push(next); }
  return seen;
};
const product = reach(pub.filter(path => path.endsWith('.html') || byName.get(path).has('product')));
const htmlOnly = reach(pub.filter(path => path.endsWith('.html')));
const testRoots = reach(pub.filter(path => byName.get(path).has('test')));
const pipelineRoots = reach(pub.filter(path => byName.get(path).has('pipeline')));
const rows = pub.map(path => ({
  path,
  cls: product.has(path) ? 'product' : testRoots.has(path) ? 'test-only' : pipelineRoots.has(path) ? 'pipeline-only' : 'none',
  html: htmlOnly.has(path),
}));
const counts = rows.reduce((acc, row) => ({ ...acc, [row.cls]: (acc[row.cls] || 0) + 1 }), {});
console.log('web/public source files:', pub.length, JSON.stringify(counts));
for (const row of rows.filter(row => row.cls !== 'product').sort((a, b) => a.cls.localeCompare(b.cls) || a.path.localeCompare(b.path))) {
  console.log(row.cls.padEnd(14), row.path);
}
console.log('--- product files NOT reachable from any HTML page (named by server/lab/apps code):');
for (const row of rows.filter(row => row.cls === 'product' && !row.html)) console.log('  ', row.path);
