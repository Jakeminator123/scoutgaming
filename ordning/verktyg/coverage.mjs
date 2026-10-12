// Usage (repository root): node ordning/verktyg/coverage.mjs [depth]
// Inventory coverage: every tracked directory (default depth 2; media/, lab/, web/,
// apps/ and pipeline/ one level deeper) with file count and size, and which reports in
// ordning/rapporter/ mention it. A directory without a report mention is printed as
// "NOT COVERED" and needs either analysis or a written reason. Local untracked folders
// are never listed: they are covered only by the orchestrator's local inventory (A19).
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';

const depth = Number(process.argv[2] || 2);
const deeper = new Set(['media', 'lab', 'web', 'apps', 'pipeline']);
const out = execFileSync('git', ['ls-tree', '-r', '-l', '-z', 'HEAD'], { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
const dirs = new Map();
for (const record of out.split('\0')) {
  if (!record) continue;
  const tab = record.indexOf('\t');
  const size = Number(record.slice(0, tab).trim().split(/\s+/)[3]) || 0;
  const path = record.slice(tab + 1);
  if (path.startsWith('random-stuff-jakob/') || path.startsWith('ordning/')) continue;
  const parts = path.split('/');
  if (parts.length === 1) continue;
  const level = deeper.has(parts[0]) ? depth + 1 : depth;
  const key = parts.slice(0, Math.min(level, parts.length - 1)).join('/');
  const entry = dirs.get(key) || { files: 0, size: 0 };
  entry.files += 1;
  entry.size += size;
  dirs.set(key, entry);
}
const reportDir = 'ordning/rapporter';
const reports = readdirSync(reportDir).filter(name => name.endsWith('.md') && name !== 'README.md')
  .map(name => [name, readFileSync(`${reportDir}/${name}`, 'utf8')]);
// A specific last segment (e.g. "vera" in media/dealers/vera) also counts when a
// report writes the path relative to its parent; generic names never do.
const generic = new Set(['test', 'tests', 'tools', 'docs', 'lib', 'app', 'src', 'public', 'fixtures', 'data', 'assets',
  'runtime', 'source', 'staging', 'components', 'schemas', 'api', 'web', 'lab', 'deploy', 'config', 'views', 'templates']);
const aliases = dir => {
  const parts = dir.split('/');
  const last = parts.at(-1);
  const list = [dir + '/', '`' + dir + '`'];
  if (parts.length >= 3 && last.length >= 3 && !generic.has(last)) list.push(last + '/', '`' + last + '`');
  return list;
};
let uncovered = 0;
console.log('files'.padStart(7), 'MiB'.padStart(9), ' directory  ->  reports');
for (const [dir, entry] of [...dirs].sort((a, b) => a[0].localeCompare(b[0]))) {
  const keys = aliases(dir);
  const mentions = reports.filter(([, text]) => keys.some(key => text.includes(key))).map(([name]) => name.replace(/\.md$/, ''));
  if (!mentions.length) uncovered += 1;
  console.log(String(entry.files).padStart(7), (entry.size / 1048576).toFixed(2).padStart(9), ' ' + dir, ' -> ', mentions.join(', ') || 'NOT COVERED');
}
console.log(`directories: ${dirs.size}, not covered by any report: ${uncovered}`);
