import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const testExtensions = new Set(['.mjs', '.js', '.cjs', '.ts', '.mts', '.cts']);
const coverageRoots = /^(?:test|lab|open-claw|ops|apps|services)\//;

// Files under a fixtures directory are helpers imported by tests, not test files.
function isTestFile(rel) {
  const parts = rel.split('/');
  if (parts.includes('fixtures') || parts.includes('__fixtures__')) return false;
  if (!parts.slice(0, -1).includes('test')) return false;
  const name = parts[parts.length - 1];
  const dot = name.lastIndexOf('.');
  return dot > 0 && testExtensions.has(name.slice(dot));
}

function toRel(abs) {
  return relative(root, abs).split('\\').join('/');
}

function walk(absDir, out) {
  if (!existsSync(absDir)) return;
  for (const entry of readdirSync(absDir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const abs = join(absDir, entry.name);
    if (entry.isDirectory()) walk(abs, out);
    else if (entry.isFile()) out.push(toRel(abs));
  }
}

function collectTree(relDir) {
  const found = [];
  walk(join(root, relDir), found);
  return found.filter(isTestFile);
}

function globRegExp(pattern) {
  const body = pattern.split('/').map(segment => {
    if (segment === '**') return '.*';
    let out = '';
    for (const ch of segment) {
      if (ch === '*') out += '[^/]*';
      else if (ch === '?') out += '[^/]';
      else if ('\\.+^${}()|[]'.includes(ch)) out += `\\${ch}`;
      else out += ch;
    }
    return out;
  }).join('/');
  return new RegExp(`^${body}$`);
}

function isPathArg(token) {
  if (!token || token.startsWith('-') || /[$={}\s]/.test(token) || token.includes('..')) return false;
  const bare = token.replaceAll('*', 'x').replaceAll('?', 'x');
  return /^(?:[\w.+@-]+\/)*[\w.+@-]+\.(?:mjs|js|cjs|ts|mts|cts)$/.test(bare);
}

function withCwd(token, cwd) {
  const clean = token.replace(/^\.\//, '').replaceAll('\\', '/');
  if (!cwd || cwd === '.') return clean;
  const base = cwd.replace(/\/$/, '').replaceAll('\\', '/');
  if (clean === base || clean.startsWith(`${base}/`)) return clean;
  return `${base}/${clean}`;
}

function tokenize(command) {
  const tokens = [];
  let current = '';
  let quote = '';
  for (const ch of command) {
    if (quote) {
      if (ch === quote) quote = '';
      else current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (current) tokens.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current) tokens.push(current);
  return tokens;
}

function splitShell(line) {
  const parts = [];
  let current = '';
  let quote = '';
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      current += ch;
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === '#') break;
    if (ch === ';' || (ch === '&' && line[i + 1] === '&') || (ch === '|' && line[i + 1] === '|')) {
      if (current.trim()) parts.push(current.trim());
      current = '';
      if (ch !== ';') i += 1;
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function shellLines(text) {
  const lines = [];
  let pending = '';
  for (const raw of text.split(/\r?\n/)) {
    let line = raw.trim();
    if (!pending && (line === '' || line.startsWith('#'))) continue;
    if (!pending) {
      const run = line.match(/^(?:-\s+)?run:\s*(.*)$/);
      if (run) line = run[1].trim();
    }
    if (line === '|' || line === '|-' || line === '|+' || line === '>' || line === '>-' || line === '>+') continue;
    if (line.endsWith('\\')) {
      pending = `${pending} ${line.slice(0, -1)}`.trim();
      continue;
    }
    const combined = `${pending} ${line}`.trim();
    pending = '';
    if (combined) lines.push(combined);
  }
  return lines;
}

function npmPrefix(argv) {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--prefix' && argv[i + 1]) return argv[i + 1];
    if (argv[i].startsWith('--prefix=')) return argv[i].slice('--prefix='.length);
  }
  return '';
}

function npmRunsTest(argv) {
  const start = argv.indexOf('npm');
  if (start < 0) return false;
  const filtered = [];
  for (let i = start + 1; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--prefix') {
      i += 1;
      continue;
    }
    if (token.startsWith('--prefix=') || token.startsWith('-')) continue;
    filtered.push(token);
  }
  return filtered[0] === 'test' || (filtered[0] === 'run' && filtered[1] === 'test');
}

function readTestScript(prefix) {
  const pkgPath = prefix && prefix !== '.'
    ? join(root, prefix, 'package.json')
    : join(root, 'package.json');
  if (!existsSync(pkgPath)) return null;
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const script = pkg.scripts && pkg.scripts.test;
  return typeof script === 'string' ? script : null;
}

function commandPatterns(argv, cwd, followNpm) {
  if (argv.length === 0) return [];
  if (followNpm && argv[0] === 'npm' && npmRunsTest(argv)) {
    const prefix = npmPrefix(argv) || cwd || '.';
    const script = readTestScript(prefix);
    if (!script) return [];
    const patterns = [];
    for (const part of splitShell(script)) {
      patterns.push(...commandPatterns(tokenize(part), prefix, false));
    }
    return patterns;
  }
  const nodeAt = argv.findIndex(token => token === 'node' || token === 'run_node_tests');
  if (nodeAt < 0) return [];
  const rest = argv.slice(nodeAt + 1);
  const selected = [];
  if (argv[nodeAt] === 'run_node_tests' || rest.some(token => token === '--test' || token.startsWith('--test'))) {
    for (const token of rest) if (isPathArg(token)) selected.push(token);
  } else {
    const file = rest.find(token => !token.startsWith('-') && isPathArg(token));
    if (file) selected.push(file);
  }
  return selected.map(token => withCwd(token, cwd)).filter(pattern => coverageRoots.test(pattern));
}

function patternsFromShell(text, cwd, followNpm) {
  const patterns = [];
  for (const line of shellLines(text)) {
    for (const part of splitShell(line)) {
      patterns.push(...commandPatterns(tokenize(part), cwd, followNpm));
    }
  }
  return patterns;
}

function patternsFromJavascript(text) {
  const patterns = [];
  for (const match of text.matchAll(/'([^'\n]+)'|"([^"\n]+)"/g)) {
    const value = match[1] ?? match[2];
    if (!isPathArg(value)) continue;
    const pattern = withCwd(value, '');
    if (coverageRoots.test(pattern)) patterns.push(pattern);
  }
  return patterns;
}

function loadRunnerPatterns() {
  const found = [];
  const add = (runner, patterns) => {
    for (const pattern of patterns) found.push({ runner, pattern });
  };
  const workflowDir = join(root, '.github/workflows');
  if (existsSync(workflowDir)) {
    for (const name of readdirSync(workflowDir)) {
      if (!/\.ya?ml$/.test(name)) continue;
      const runner = `.github/workflows/${name}`;
      add(runner, patternsFromShell(readFileSync(join(workflowDir, name), 'utf8'), '', true));
    }
  }
  add('tools/precommit-checks.mjs', patternsFromJavascript(readFileSync(join(root, 'tools/precommit-checks.mjs'), 'utf8')));
  for (const name of ['pre-commit', 'pre-commit-full']) {
    const rel = `.githooks/${name}`;
    const abs = join(root, rel);
    if (existsSync(abs)) add(rel, patternsFromShell(readFileSync(abs, 'utf8'), '', true));
  }
  for (const prefix of ['.', 'lab']) {
    const script = readTestScript(prefix);
    if (!script) continue;
    const runner = prefix === '.' ? 'package.json' : 'lab/package.json';
    add(runner, patternsFromShell(script, prefix === '.' ? '' : prefix, false));
  }
  return found;
}

function compilePatterns(items) {
  return items.map(item => ({
    runner: item.runner,
    pattern: item.pattern,
    regex: item.pattern.includes('*') || item.pattern.includes('?') ? globRegExp(item.pattern) : null,
  }));
}

function patternHits(pattern, file) {
  return pattern.regex ? pattern.regex.test(file) : pattern.pattern === file;
}

function targetsTree(patterns, tree) {
  return patterns.some(item => {
    const parts = item.pattern.split('/');
    return parts[0] === tree && parts.includes('test');
  });
}

function loadExceptions() {
  const rel = 'tools/orphan-tests-exceptions.json';
  const abs = join(root, rel);
  if (!existsSync(abs)) return { entries: [], errors: [] };
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(abs, 'utf8'));
  } catch (error) {
    return { entries: [], errors: [`${rel}: ${error.message}`] };
  }
  if (!Array.isArray(parsed)) {
    return { entries: [], errors: [`${rel} must be a list of { "path", "reason" }`] };
  }
  const entries = [];
  const errors = [];
  parsed.forEach((entry, index) => {
    if (!entry || typeof entry.path !== 'string' || !entry.path.trim()
      || typeof entry.reason !== 'string' || !entry.reason.trim()) {
      errors.push(`${rel}: entry ${index} needs path and reason`);
      return;
    }
    const path = entry.path.trim();
    if (path.startsWith('/') || path.includes('\\') || path.split('/').includes('..')) {
      errors.push(`${rel}: invalid path ${path}`);
      return;
    }
    entries.push({ path, reason: entry.reason.trim() });
  });
  return { entries, errors };
}

export function auditOrphanTests() {
  const items = loadRunnerPatterns();
  const patterns = compilePatterns(items);
  const files = [...collectTree('test'), ...collectTree('lab/test')];
  if (targetsTree(patterns, 'open-claw')) files.push(...collectTree('open-claw'));
  if (targetsTree(patterns, 'ops')) files.push(...collectTree('ops'));
  files.sort();
  const unique = [...new Set(files)];
  const { entries, errors } = loadExceptions();
  const known = new Set(unique);
  for (const entry of entries) {
    if (!known.has(entry.path)) errors.push(`tools/orphan-tests-exceptions.json: ${entry.path} is not a discovered test file`);
  }
  const excepted = new Set(entries.map(entry => entry.path));
  const orphans = [];
  const covered = [];
  for (const file of unique) {
    const hit = patterns.find(item => patternHits(item, file));
    if (hit) covered.push({ file, runner: hit.runner, pattern: hit.pattern });
    else if (!excepted.has(file)) orphans.push(file);
  }
  return { files: unique, orphans, covered, exceptions: entries, errors };
}

function main() {
  const result = auditOrphanTests();
  for (const error of result.errors) console.error(error);
  if (result.orphans.length > 0) {
    console.error('Orphan tests:');
    for (const file of result.orphans) console.error(file);
  } else if (result.errors.length === 0) {
    console.log(`Checked ${result.files.length} test files. Orphans: 0. Exceptions: ${result.exceptions.length}.`);
  }
  return result.orphans.length > 0 || result.errors.length > 0 ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
