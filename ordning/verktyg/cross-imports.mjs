// Usage (repository root): node ordning/verktyg/cross-imports.mjs [--edges] [--to=<area-prefix>]
// Counts relative imports that cross area boundaries. An area is the top-level
// directory, refined for lab/, web/ (server vs public), apps/, services/, ops/,
// open-claw/lab/ and test-videoeditor/. Test files are included; filter the output
// with `--to=` or by reading the source column.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { posix } from 'node:path';

const showEdges = process.argv.includes('--edges');
const filter = process.argv.find(arg => arg.startsWith('--to='))?.slice(5);
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  .split('\0')
  .filter(path => /\.(?:mjs|cjs|js|jsx|ts|tsx|mts|cts|html)$/.test(path))
  .filter(path => !/^(?:random-stuff-jakob|media|ordning)\//.test(path));

const area = path => {
  const parts = path.split('/');
  if (['apps', 'services', 'ops', 'media'].includes(parts[0]) && parts.length > 2) return parts.slice(0, 2).join('/');
  if (parts[0] === 'open-claw' && parts.length > 3) return parts.slice(0, 3).join('/');
  if (parts[0] === 'test-videoeditor' && parts.length > 2) return parts.slice(0, 2).join('/');
  if (parts[0] === 'lab' && parts.length > 2) return parts.slice(0, 2).join('/');
  if (parts[0] === 'web' && parts.length > 2 && parts[1] === 'public') return 'web/public';
  if (parts[0] === 'web') return 'web(server)';
  return parts.length > 1 ? parts[0] : '(root)';
};
const top = path => path.split('/')[0];
const refined = new Set(['lab', 'web', 'apps', 'test-videoeditor', 'open-claw', 'ops', 'services']);

const patterns = [
  /\bimport\s+(?:[\w*{}\s,$]+?\s+from\s+)?['"]([^'"]+)['"]/g,
  /\bexport\s+(?:[\w*{}\s,$]+?\s+)?from\s+['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /new\s+URL\(\s*['"]([^'"]+)['"]\s*,\s*import\.meta\.url\s*\)/g,
  /<script[^>]+src=['"]([^'"]+)['"]/g,
];
const edges = new Map();
for (const file of files) {
  let text;
  try { text = readFileSync(file, 'utf8'); } catch { continue; }
  const specs = new Set();
  for (const pattern of patterns) for (const match of text.matchAll(pattern)) specs.add(match[1]);
  for (const spec of specs) {
    if (!spec.startsWith('.')) continue;
    const target = posix.normalize(posix.join(posix.dirname(file), spec));
    if (target.startsWith('..')) continue;
    if (top(target) === top(file) && area(target) === area(file)) continue;
    if (top(target) === top(file) && !refined.has(top(file))) continue;
    if (filter && !area(target).startsWith(filter)) continue;
    const key = area(file) + ' -> ' + area(target);
    const entry = edges.get(key) || { count: 0, examples: new Set() };
    entry.count += 1;
    if (entry.examples.size < 4) entry.examples.add(file + ' => ' + target);
    edges.set(key, entry);
  }
}
for (const [key, entry] of [...edges].sort((a, b) => a[0].localeCompare(b[0]))) {
  console.log(String(entry.count).padStart(4), key);
  if (showEdges) for (const example of entry.examples) console.log('       ', example);
}
