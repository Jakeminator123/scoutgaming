// Usage (repository root): node ordning/verktyg/tree-sizes.mjs [prefix] [depth] [ref]
// Sums blob sizes from `git ls-tree -r -l` per path prefix. Never reads the private archive.
// Example: TOP=20 node ordning/verktyg/tree-sizes.mjs media/dealers/astrid 5
import { execFileSync } from 'node:child_process';

const [, , prefix = '', depthArg = '2', ref = 'HEAD'] = process.argv;
const depth = Number(depthArg);
const out = execFileSync('git', ['ls-tree', '-r', '-l', '-z', ref, '--', ...(prefix ? [prefix] : [])], {
  encoding: 'utf8',
  maxBuffer: 512 * 1024 * 1024,
});
const totals = new Map();
let all = 0;
let count = 0;
for (const record of out.split('\0')) {
  if (!record) continue;
  const tab = record.indexOf('\t');
  const meta = record.slice(0, tab).trim().split(/\s+/);
  const size = Number(meta[3]) || 0;
  const path = record.slice(tab + 1);
  if (path.startsWith('random-stuff-jakob/jakob-docs/arkiv/')) continue;
  const key = path.split('/').slice(0, depth).join('/');
  const entry = totals.get(key) || { size: 0, files: 0 };
  entry.size += size;
  entry.files += 1;
  totals.set(key, entry);
  all += size;
  count += 1;
}
const top = Number(process.env.TOP || 40);
for (const [key, entry] of [...totals].sort((a, b) => b[1].size - a[1].size).slice(0, top)) {
  console.log((entry.size / 1048576).toFixed(2).padStart(9), 'MB', String(entry.files).padStart(6), key);
}
console.log((all / 1048576).toFixed(2).padStart(9), 'MB', String(count).padStart(6), 'TOTAL', prefix || '(all)');
