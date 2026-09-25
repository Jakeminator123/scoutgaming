#!/usr/bin/env node
/**
 * One-way, offline publication of the active animation-events documentation
 * from Croupier to the separate GitLab wiki worktree.
 *
 * This tool does not fetch, build the Vercel site, commit, push or delete.
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_BRANCH = 'jakeminator123/work';
const REPOSITORY = 'https://gitlab.com/scout-gg/croupier';
const WIKI_ROOT = `${REPOSITORY}/-/wikis`;
const GENERATOR_VERSION = '1.0.0';
const ACTIVE_DIRECTORY = 'docs/animation-events/v5-7-days-mvp';
const ACTIVE_FILES = [
  'README.md', 'CANVAS.md', 'DECISIONS.md', 'RUNTIME-EVIDENCE.md',
  's00-helheten.md', 's01-kartan.md', 's02-spraket.md',
  's03-eventtradet.md', 's04-saker-presentation.md', 's05-ordlista.md',
  's06-plan.md',
];
const SOURCE_TO_WIKI = new Map([
  ['docs/animation-events/README.md', 'animation-events.md'],
  ...ACTIVE_FILES.map(name => [`${ACTIVE_DIRECTORY}/${name}`, `animation-events/v5-7-days-mvp/${name}`]),
]);
const LEGACY_ALIASES = new Map([
  ['animation-events/v5-8-days-mvp/README.md', 'README.md'],
  ['animation-events/v5-8-days-mvp/CANVAS.md', 'CANVAS.md'],
  ['animation-events/v5-8-days-mvp/DECISIONS.md', 'DECISIONS.md'],
  ['animation-events/v5-8-days-mvp/RUNTIME-EVIDENCE.md', 'RUNTIME-EVIDENCE.md'],
  ...ACTIVE_FILES.filter(name => /^s\d\d-/.test(name)).flatMap(name => {
    const section = name.slice(0, 3);
    return [
      [`animation-events/v5-8-days-mvp/${name}`, name],
      [`animation-events-v5-${section}.md`, name],
      [`animation-events-v5/canvas/${name}`, name],
    ];
  }),
]);

const sha256 = value => createHash('sha256').update(value).digest('hex');
const normalize = value => value.replace(/\r\n?/g, '\n').replace(/^\uFEFF/, '').trimEnd() + '\n';

function repositoryRoot(value, label, requireGit = false) {
  const absolute = path.resolve(value);
  if (absolute === path.parse(absolute).root) throw new Error(`${label}: filesystem root is not a safe target`);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isDirectory()) throw new Error(`${label}: directory does not exist: ${absolute}`);
  if (fs.lstatSync(absolute).isSymbolicLink()) throw new Error(`${label}: symlink root is not allowed`);
  const real = fs.realpathSync(absolute);
  if (requireGit && !fs.existsSync(path.join(real, '.git'))) throw new Error(`${label}: expected an existing Git worktree root`);
  return real;
}

function safePath(root, relative) {
  if (typeof relative !== 'string' || relative.includes('\\') || path.posix.isAbsolute(relative) || /^[a-z]:/i.test(relative)) {
    throw new Error(`Unsafe wiki path: ${relative}`);
  }
  const parts = relative.split('/');
  if (parts.some(part => !part || part === '.' || part === '..')) throw new Error(`Unsafe wiki path: ${relative}`);
  let current = root;
  for (const [index, part] of parts.entries()) {
    current = path.join(current, part);
    if (!fs.existsSync(current)) continue;
    if (fs.lstatSync(current).isSymbolicLink()) throw new Error(`Symlink in wiki path is not allowed: ${relative}`);
    if (index < parts.length - 1 && !fs.statSync(current).isDirectory()) throw new Error(`Wiki parent is not a directory: ${relative}`);
    const fromRoot = path.relative(root, fs.realpathSync(current));
    if (fromRoot === '..' || fromRoot.startsWith(`..${path.sep}`) || path.isAbsolute(fromRoot)) throw new Error(`Wiki path escapes root: ${relative}`);
  }
  return current;
}

function readRequired(root, relative) {
  const target = safePath(root, relative);
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) throw new Error(`Required source file is missing: ${relative}`);
  return normalize(fs.readFileSync(target, 'utf8'));
}

function gitCommit(root) {
  const result = spawnSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true });
  const value = result.status === 0 ? result.stdout.trim() : '';
  if (/^[a-f0-9]{40,64}$/.test(value)) return value;
  throw new Error(`Cannot determine source commit: ${result.error?.message || result.stderr?.trim() || 'git returned no commit'}`);
}

function wikiUrl(relative) {
  return `${WIKI_ROOT}/${relative.replace(/\.md$/, '')}`;
}

function rewriteHref(href, sourcePath, commit) {
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\/)/i.test(href)) return href;
  const match = /^([^?#]+)([?#].*)?$/.exec(href);
  if (!match) return href;
  const [, rawPath, suffix = ''] = match;
  let decoded;
  try { decoded = decodeURIComponent(rawPath); } catch { return href; }
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(sourcePath), decoded));
  if (SOURCE_TO_WIKI.has(resolved)) return `${wikiUrl(SOURCE_TO_WIKI.get(resolved))}${suffix}`;
  if (resolved.startsWith('../') || resolved === '..') throw new Error(`Relative link escapes repository: ${href} in ${sourcePath}`);
  return `${REPOSITORY}/-/blob/${commit}/${resolved}${suffix}`;
}

function mirrorMarkdown(source, sourcePath, targetPath, commit) {
  let fence = null;
  const rewriteLinks = line => line
    .replace(/(!?\[[^\]\n]*\]\()(<[^>\n]+>|[^\s)]+)([^)\n]*\))/g, (_all, start, target, end) => {
      const bracketed = target.startsWith('<');
      const href = bracketed ? target.slice(1, -1) : target;
      const transformed = rewriteHref(href, sourcePath, commit);
      return `${start}${bracketed ? `<${transformed}>` : transformed}${end}`;
    })
    .replace(/^(\s{0,3}\[[^\]\n]+\]:\s*)(<[^>\n]+>|\S+)(.*)$/, (_all, start, target, end) => {
      const bracketed = target.startsWith('<');
      const href = bracketed ? target.slice(1, -1) : target;
      const transformed = rewriteHref(href, sourcePath, commit);
      return `${start}${bracketed ? `<${transformed}>` : transformed}${end}`;
    });
  const rewriteOutsideInlineCode = line => {
    let cursor = 0;
    let result = '';
    const code = /(`+)(.*?)\1/g;
    for (const match of line.matchAll(code)) {
      result += rewriteLinks(line.slice(cursor, match.index));
      result += match[0];
      cursor = match.index + match[0].length;
    }
    return result + rewriteLinks(line.slice(cursor));
  };
  const rewritten = source.split('\n').map(line => {
    const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
    if (marker) {
      if (!fence) fence = { character: marker[1][0], length: marker[1].length };
      else if (marker[1][0] === fence.character && marker[1].length >= fence.length) fence = null;
      return line;
    }
    if (fence) return line;
    return rewriteOutsideInlineCode(line);
  }).join('\n').trimEnd();
  const sourceUrl = `${REPOSITORY}/-/blob/${commit}/${sourcePath}`;
  return `${rewritten}\n\n---\n\n> Synkad wiki-spegel från [Croupier-källan](${sourceUrl}) vid \`${commit.slice(0, 12)}\`. Redigera källan, inte den här kopian.\n`;
}

function aliasPage(targetName) {
  const target = `animation-events/v5-7-days-mvp/${targetName}`;
  return `# Flyttad: V5 · sju arbetsdagar\n\nDen här äldre wikiadressen bevaras som hänvisning. Läs den aktuella sidan: [${targetName.replace(/\.md$/, '')}](${wikiUrl(target)}).\n`;
}

function manifestPage(commit, records) {
  const rows = records.map(record => `| \`${record.source}\` | [\`${record.target}\`](${wikiUrl(record.target)}) | \`${record.hash}\` |`).join('\n');
  return `# Animation events · synkkvitto\n\n` +
    `- Generator: \`tools/sync-animation-events-wiki.mjs\` version \`${GENERATOR_VERSION}\`\n` +
    `- Croupier-commit: [\`${commit}\`](${REPOSITORY}/-/commit/${commit})\n` +
    `- Källa: \`${ACTIVE_DIRECTORY}\` samt \`docs/animation-events/README.md\`\n` +
    `- Webbbygge: **inte använt**. Synken skriver endast Markdown i wiki-worktreet.\n\n` +
    `| Källfil | Wiki | SHA-256 av normaliserad källa |\n| --- | --- | --- |\n${rows}\n\n` +
    `Hashparitet visar textversionen. Den bevisar inte att en länk renderas rätt, att en film är godkänd eller att produktkod är driftsatt.\n`;
}

function buildPlan(sourceRoot) {
  const commit = gitCommit(sourceRoot);
  const files = new Map();
  const records = [];
  for (const [sourcePath, targetPath] of SOURCE_TO_WIKI) {
    const source = readRequired(sourceRoot, sourcePath);
    files.set(targetPath, Buffer.from(mirrorMarkdown(source, sourcePath, targetPath, commit)));
    records.push({ source: sourcePath, target: targetPath, hash: sha256(source) });
  }
  for (const [targetPath, targetName] of LEGACY_ALIASES) files.set(targetPath, Buffer.from(aliasPage(targetName)));
  files.set('animation-events/SYNC-MANIFEST.md', Buffer.from(manifestPage(commit, records)));
  return { commit, files, records };
}

function applyOrCheck(wikiRoot, files, write) {
  const changes = [];
  const validated = [];
  for (const [name, content] of files) {
    const target = safePath(wikiRoot, name);
    if (fs.existsSync(target) && !fs.statSync(target).isFile()) throw new Error(`Wiki target is not a regular file: ${name}`);
    validated.push({ name, target, content });
  }
  for (const item of validated) {
    if (fs.existsSync(item.target) && fs.readFileSync(item.target).equals(item.content)) continue;
    changes.push(item.name);
    if (write) {
      fs.mkdirSync(path.dirname(item.target), { recursive: true });
      safePath(wikiRoot, item.name);
      fs.writeFileSync(item.target, item.content);
    }
  }
  return changes;
}

function main(argv) {
  const options = { source: REPO_ROOT, write: false };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      console.log('Usage: node tools/sync-animation-events-wiki.mjs --wiki PATH [--source PATH] [--write]\nReads Croupier only, writes/checks the GitLab wiki worktree only, and never builds or changes the separate website.');
      return;
    }
    if (arg === '--write') options.write = true;
    else if (arg === '--wiki' || arg === '--source') {
      if (!argv[index + 1] || argv[index + 1].startsWith('--')) throw new Error(`${arg} needs a directory`);
      options[arg.slice(2)] = argv[++index];
    } else throw new Error(`Unknown option: ${arg}`);
  }
  if (!options.wiki) throw new Error('--wiki is required');
  const sourceRoot = repositoryRoot(options.source, 'Source', true);
  const wikiRoot = repositoryRoot(options.wiki, 'Wiki', options.write);
  if (sourceRoot === wikiRoot) throw new Error('Wiki target must be a separate repository root');
  const plan = buildPlan(sourceRoot);
  const changes = applyOrCheck(wikiRoot, plan.files, options.write);
  const status = options.write ? (changes.length ? 'updated' : 'ok') : (changes.length ? 'drift' : 'ok');
  console.log(JSON.stringify({ status, sourceCommit: plan.commit, sourceFiles: plan.records.length, checkedFiles: plan.files.size, [options.write ? 'updatedFiles' : 'drift']: changes }, null, 2));
  if (!options.write && changes.length) process.exitCode = 1;
}

try {
  main(process.argv.slice(2));
} catch (error) {
  console.error(`sync-animation-events-wiki: ${error.message}`);
  process.exitCode = 1;
}
