import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifySystemMap, createSourceReader, summarizeAssurance } from './verify.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
// The caller owns index.html. Importing this module never edits the document.
export function buildSystemMap({ repositoryRoot = root, output, ref, evidence, check = false, reader: sourceReader } = {}) {
  const reader = sourceReader || createSourceReader({ repositoryRoot, ref });
  const { data, assurance } = verifySystemMap({ reader, evidence });
  // A valid catalog can display failed tests. Structural catalog errors still
  // prevent embedding untrustworthy facts; the CLI exits 1 for either failure.
  if (assurance.errors.some(error => error.code !== 'test.failed')) return { assurance, written: false };
  const target = output ? resolve(output) : resolve(repositoryRoot, 'docs/system-map/index.html');
  const html = readFileSync(target, 'utf8');
  const marker = /(<script id="system-data" type="application\/json">)[\s\S]*?(<\/script>)/;
  if (!marker.test(html)) throw Error('Documentation data marker missing');
  const encoded = JSON.stringify({ ...data, assurance }).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  if (!check) writeFileSync(target, html.replace(marker, (_, start, end) => start + encoded + end));
  return { assurance, written: !check };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2), options = {};
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--check') options.check = true;
      else if (['--ref', '--output', '--evidence', '--json'].includes(args[i]) && args[i + 1]) options[args[i].slice(2)] = args[++i];
      else throw Error('Usage: node docs/system-map/build.mjs [--check] [--ref SHA] [--evidence FILE] [--output HTML]');
    }
    if (options.evidence) options.evidence = JSON.parse(readFileSync(resolve(options.evidence), 'utf8'));
    const result = buildSystemMap(options);
    if (options.json) writeFileSync(resolve(options.json), JSON.stringify(result.assurance, null, 2) + '\n');
    console.log(JSON.stringify({ written: result.written, ...summarizeAssurance(result.assurance) }));
    if (result.assurance.errors.length) process.exitCode = 1;
  } catch { console.error('System map build failed; inspect its checked catalog or options.'); process.exitCode = 1; }
}
