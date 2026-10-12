// Usage (repository root): node ordning/verktyg/pipeline-consumers.mjs
// Classifies pipeline/ files by who names them (bare file name match):
//   hook/CI     = .githooks/pre-commit-full or a GitHub workflow
//   external    = other tracked code, tests, tools, configs or active docs
//   media/notes = only tracked text in media/ (manifests, QA notes)
//   internal    = only other pipeline/ files
//   none        = nobody
// "none" is a CANDIDATE, not proof that a file is unused: manual tools have no
// importer. Unreadable files are listed and make the exit code 2.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { posix } from 'node:path';

const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\0').filter(Boolean);
const unreadable = [];
const read = path => {
  try { return readFileSync(path, 'utf8'); } catch (error) { unreadable.push(path + ' (' + error.code + ')'); return null; }
};
const textFile = path => /\.(?:mjs|cjs|js|jsx|ts|tsx|mts|json|yml|yaml|sh|py|md|html|txt)$/.test(path);
const excluded = path => /^(?:random-stuff-jakob|ordning)\//.test(path) || path === 'docs/system-map/index.html';
const pipeline = tracked.filter(path => path.startsWith('pipeline/') && /\.(?:mjs|js|py|sh|json)$/.test(path));
const hookPaths = tracked.filter(path => path === '.githooks/pre-commit-full' || path.startsWith('.github/workflows/'));
const mediaPaths = tracked.filter(path => path.startsWith('media/') && textFile(path) && !excluded(path));
const externalPaths = tracked.filter(path => !path.startsWith('pipeline/') && !path.startsWith('media/') && !excluded(path)
  && !hookPaths.includes(path) && textFile(path));
const join = paths => paths.map(read).filter(text => text !== null).join('\n');
const hookText = join(hookPaths);
const externalText = join(externalPaths);
const mediaText = join(mediaPaths);
const pipelineTexts = pipeline.map(path => [path, read(path)]);
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const rows = pipeline.map(path => {
  const pattern = new RegExp('(?:^|[^\\w.-])' + escape(posix.basename(path)) + '(?![\\w.-])');
  const internal = pipelineTexts.some(([other, text]) => other !== path && text !== null && pattern.test(text));
  const cls = pattern.test(hookText) ? 'hook/CI' : pattern.test(externalText) ? 'external'
    : pattern.test(mediaText) ? 'media/notes' : internal ? 'internal' : 'none';
  return { cls, path };
});
const counts = rows.reduce((acc, row) => ({ ...acc, [row.cls]: (acc[row.cls] || 0) + 1 }), {});
console.log('pipeline files:', rows.length, JSON.stringify(counts));
for (const row of rows.sort((a, b) => a.cls.localeCompare(b.cls) || a.path.localeCompare(b.path))) {
  console.log(row.cls.padEnd(11), row.path);
}
if (unreadable.length) {
  console.error('UNREADABLE (not analysed):');
  for (const file of unreadable) console.error('  ', file);
  process.exitCode = 2;
}
