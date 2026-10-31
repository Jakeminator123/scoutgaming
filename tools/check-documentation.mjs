import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { posix, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

export const isDocumentationSource = path => /^(?:docs\/.+\.md|(?:START-HERE|README|AGENTS)\.md|apps\/studio\/(?:docs\/.+\.md|README\.md|client\/README\.md|components\/partner\/README\.md))$/.test(path);
const unsafe = path => path.split('/').some(part => /^(?:\.env(?:\..*)?|\.git|\.aws|\.ssh|\.codex|\.claude|node_modules|arkiv|random-stuff-jakob)$/i.test(part));
const blank = text => text.replace(/[^\n]/g, ' ');

// Keep offsets and line numbers while removing examples and comments.
function prose(source, stripInline = true) {
  let fence;
  const text = source.replace(/<!--[\s\S]*?(?:-->|$)/g, blank).split('\n').map(line => {
    const match = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (match && (!fence || (match[1][0] === fence[0] && match[1].length >= fence.length))) {
      fence = fence ? undefined : match[1];
      return blank(line);
    }
    return fence || /^(?: {4}|\t)/.test(line) ? blank(line) : line;
  }).join('\n');
  return stripInline ? text.replace(/(`+)[\s\S]*?\1/g, blank) : text;
}

export function anchors(source) {
  const ids = new Set();
  const counts = new Map();
  const lines = prose(source, false).split('\n');
  const visible = prose(source).split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const match of visible[i].matchAll(/<(?:a|[a-z][\w-]*)\b[^>]*\b(?:id|name)\s*=\s*["']([^"']+)["']/gi)) ids.add(match[1]);
    const heading = lines[i].match(/^ {0,3}#{1,6}\s+(.+?)\s*#*\s*$/)?.[1]
      ?? (i + 1 < lines.length && /^ {0,3}(?:=+|-+)\s*$/.test(lines[i + 1]) ? lines[i].trim() : undefined);
    if (!heading) continue;
    const id = heading.toLowerCase().replace(/<[^>]*>/g, '').replace(/!?\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[^\p{L}\p{M}\p{N}_\-\s]/gu, '').replace(/\s/g, '-');
    let candidate = id;
    let n = counts.get(id) ?? 0;
    while (ids.has(candidate)) candidate = `${id}-${++n}`;
    counts.set(id, n);
    ids.add(candidate);
  }
  return ids;
}

const label = text => text.replace(/\\([\[\]\\])/g, '$1').trim().replace(/\s+/g, ' ').toLowerCase();
function links(source) {
  const text = prose(source);
  const definitions = new Map();
  const result = [];
  const destination = String.raw`(<[^>\n]*>|(?:\\.|[^\s])+?)`;
  const definitionPattern = new RegExp(String.raw`^ {0,3}\[([^\]\n]+)\]:\s*${destination}(?:\s+["'(].*)?$`, 'gm');
  for (const match of text.matchAll(definitionPattern)) definitions.set(label(match[1]), match[2]);
  // Balanced parentheses in destinations (usual code paths) without a Markdown dependency.
  const pattern = /!?\[((?:\\.|[^\]\\\n])*)\](?:\(\s*(<[^>\n]*>|(?:\\.|[^()\s]|\((?:\\.|[^()])*\))+)(?:\s+["'][^\n]*?["'])?\s*\)|\[([^\]\n]*)\])?/g;
  for (const match of text.matchAll(pattern)) {
    if (text[match.index + match[0].length] === ':') continue;
    const href = match[2] ?? definitions.get(label(match[3] || match[1]));
    if (href) result.push({ href: href.replace(/^<|>$/g, '').replace(/\\([\\()[\] #])/g, '$1'), line: text.slice(0, match.index).split('\n').length });
  }
  return result;
}

export function checkDocumentation({ files, read, sources = files.filter(isDocumentationSource) }) {
  const tracked = new Set(files);
  const errors = [];
  const cache = new Map();
  for (const file of sources) {
    if (unsafe(file)) continue;
    for (const { href, line } of links(read(file))) {
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/|\/)/i.test(href)) continue;
      const fail = reason => errors.push({ file, line, target: href, reason });
      let path, fragment;
      try {
        const hash = href.indexOf('#');
        const raw = hash < 0 ? href : href.slice(0, hash);
        fragment = hash < 0 ? '' : decodeURIComponent(href.slice(hash + 1));
        path = raw ? posix.normalize(posix.join(posix.dirname(file), decodeURIComponent(raw.split('?')[0]))) : file;
      } catch { fail('Invalid percent encoding'); continue; }
      if (path === '..' || path.startsWith('../') || path.includes('\\') || unsafe(path)) { fail('Unsafe target'); continue; }
      if (!tracked.has(path)) {
        if (files.some(name => name.startsWith(path.replace(/\/$/, '') + '/')) && !fragment) continue;
        fail('Target is not a tracked file or directory'); continue;
      }
      if (fragment && /\.md$/i.test(path)) {
        if (!cache.has(path)) cache.set(path, anchors(read(path)));
        if (!cache.get(path).has(fragment)) fail('Markdown heading or explicit id does not exist');
      }
    }
  }
  return errors;
}

export function main(args = process.argv.slice(2)) {
  if (args.some(arg => !['--cached', '--json'].includes(arg))) throw Error('Usage: node tools/check-documentation.mjs [--cached] [--json]');
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const git = command => execFileSync('git', command, { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  const entries = git(['ls-files', '--stage', '-z']).split('\0').filter(Boolean).map(entry => {
    const match = entry.match(/^(\d+) ([a-f\d]+) (\d)\t([\s\S]+)$/);
    if (!match || match[3] !== '0') throw Error('Resolve unmerged index entries first');
    return { mode: match[1], path: match[4] };
  });
  const files = entries.filter(entry => entry.mode === '100644' || entry.mode === '100755').map(entry => entry.path);
  const read = file => {
    if (unsafe(file) || !files.includes(file)) throw Error('Refusing unsafe or untracked read');
    if (args.includes('--cached')) return git(['show', ':' + file]);
    const actual = realpathSync(resolve(root, file));
    const rel = relative(realpathSync(root), actual);
    if (isAbsolute(rel) || rel.replaceAll('\\', '/') !== file || unsafe(rel.replaceAll('\\', '/'))) throw Error('Refusing symlink or unsafe repository read');
    return readFileSync(actual, 'utf8');
  };
  const errors = checkDocumentation({ files, read });
  if (args.includes('--json')) console.log(JSON.stringify({ errors }, null, 2));
  else if (errors.length) for (const error of errors) console.error(`${error.file}:${error.line}: ${error.reason}: ${error.target}`);
  else console.log('Documentation relative links and Markdown anchors: OK');
  return errors.length ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main();
