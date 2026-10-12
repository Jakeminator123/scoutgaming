// Usage (repository root): node ordning/verktyg/pipeline-consumers.mjs
// Classifies pipeline/ files by who names them (bare file name match):
//   hook/CI  = .githooks/pre-commit-full or a GitHub workflow
//   external = other tracked code, tests, tools, configs or active docs
//   internal = only other pipeline/ files
//   none     = nobody
// media/, random/, planes/, ordning/ and the generated system-map HTML never count.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { posix } from 'node:path';

const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\0').filter(Boolean);
const read = path => { try { return readFileSync(path, 'utf8'); } catch { return ''; } };
const excluded = path => /^(?:media|random|planes|ordning|random-stuff-jakob)\//.test(path) || path === 'docs/system-map/index.html';
const pipeline = tracked.filter(path => path.startsWith('pipeline/') && /\.(?:mjs|js|py|sh|json)$/.test(path));
const hookPaths = tracked.filter(path => path === '.githooks/pre-commit-full' || path.startsWith('.github/workflows/'));
const externalPaths = tracked.filter(path => !path.startsWith('pipeline/') && !excluded(path) && !hookPaths.includes(path)
  && /\.(?:mjs|cjs|js|jsx|ts|tsx|mts|json|yml|yaml|sh|py|md|html)$/.test(path));
const hookText = hookPaths.map(read).join('\n');
const externalText = externalPaths.map(read).join('\n');
const pipelineTexts = pipeline.map(path => [path, read(path)]);
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const rows = pipeline.map(path => {
  const pattern = new RegExp('(?:^|[^\\w.-])' + escape(posix.basename(path)) + '(?![\\w.-])');
  const internal = pipelineTexts.some(([other, text]) => other !== path && pattern.test(text));
  const cls = pattern.test(hookText) ? 'hook/CI' : pattern.test(externalText) ? 'external' : internal ? 'internal' : 'none';
  return { cls, path };
});
const counts = rows.reduce((acc, row) => ({ ...acc, [row.cls]: (acc[row.cls] || 0) + 1 }), {});
console.log('pipeline files:', rows.length, JSON.stringify(counts));
for (const row of rows.sort((a, b) => a.cls.localeCompare(b.cls) || a.path.localeCompare(b.path))) {
  console.log(row.cls.padEnd(9), row.path);
}
