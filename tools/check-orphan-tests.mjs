import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const testExtensions = new Set(['.mjs', '.js', '.cjs', '.ts', '.mts', '.cts']);
const discoveryRoots = ['test', 'lab/test', 'lab/components', 'lab/lib', 'packages', 'tools/media', 'open-claw', 'ops', 'apps', 'services', 'lipsync-test'];
const coverageRoots = /^(?:test|lab|open-claw|ops|apps|services|packages|tools\/media|lipsync-test)\//;
const skippedDirectories = new Set(['node_modules', '.git', '.next', '.nuxt', '.cache', '.turbo', 'coverage',
  'playwright-report', 'test-results', '__pycache__', '.venv', '.lipsync-venv', 'vendor', 'arkiv',
  'data', 'media', 'staging', 'fixtures', '__fixtures__']);

// Files under a fixtures directory are helpers imported by tests, not test files.
function isTestFile(rel) {
  const parts = rel.split('/');
  if (parts.includes('fixtures') || parts.includes('__fixtures__')) return false;
  const name = parts[parts.length - 1];
  const dot = name.lastIndexOf('.');
  const extensionOk = dot > 0 && testExtensions.has(name.slice(dot));
  if (extensionOk && /\.(?:test|spec)\.[^.]+$/.test(name)) return true;
  if (rel.startsWith('tools/media/') && extensionOk && name.startsWith('test-')) return true;
  if (!parts.slice(0, -1).some(part => part === 'test' || part === 'tests')) return false;
  return extensionOk;
}

function toRel(abs, root) {
  return relative(root, abs).split('\\').join('/');
}

function walk(absDir, out, root) {
  if (!existsSync(absDir)) return;
  for (const entry of readdirSync(absDir, { withFileTypes: true })) {
    if (skippedDirectories.has(entry.name) || entry.name.startsWith('.')) continue;
    const abs = join(absDir, entry.name);
    // Dirent symlinks/junctions are not followed into another checkout or private data.
    if (entry.isDirectory()) walk(abs, out, root);
    else if (entry.isFile()) out.push(toRel(abs, root));
  }
}

function collectTree(relDir, root) {
  const found = [];
  walk(join(root, relDir), found, root);
  return found;
}

function globRegExp(pattern) {
  const body = pattern.split('/').map(segment => {
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

function readTestScript(prefix, root) {
  const pkgPath = prefix && prefix !== '.'
    ? join(root, prefix, 'package.json')
    : join(root, 'package.json');
  if (!existsSync(pkgPath)) return null;
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const script = pkg.scripts && pkg.scripts.test;
  return typeof script === 'string' ? script : null;
}

function commandPatterns(argv, cwd, followNpm, root) {
  if (argv.length === 0) return [];
  if (followNpm && argv[0] === 'npm' && npmRunsTest(argv)) {
    const prefix = npmPrefix(argv) || cwd || '.';
    const script = readTestScript(prefix, root);
    if (!script) return [];
    const patterns = [];
    for (const part of splitShell(script)) {
      patterns.push(...commandPatterns(tokenize(part), prefix, false, root));
    }
    return patterns;
  }
  // Only executable commands, never an echoed command or an arbitrary source string.
  const nodeAt = argv[0] === 'node' || argv[0] === 'run_node_tests' ? 0
    : argv[0] === 'run_check' && argv[4] === 'node' ? 4 : -1;
  if (nodeAt < 0) return [];
  const rest = argv.slice(nodeAt + 1);
  if (rest.some(token => ['--check', '-c', '--eval', '-e', '--print', '-p'].includes(token))) return [];
  const selected = [];
  if (argv[nodeAt] === 'run_node_tests' || rest.includes('--test')) {
    for (const token of rest) if (isPathArg(token)) selected.push(token);
  } else {
    const file = rest.find(token => !token.startsWith('-') && isPathArg(token));
    if (file) selected.push(file);
  }
  return selected.map(token => withCwd(token, cwd)).filter(pattern => coverageRoots.test(pattern));
}

function patternsFromShell(text, cwd, followNpm, root) {
  const patterns = [];
  for (const line of shellLines(text)) {
    for (const part of splitShell(line)) {
      patterns.push(...commandPatterns(tokenize(part), cwd, followNpm, root));
    }
  }
  return patterns;
}

function loadRunnerPatterns(root) {
  const found = [];
  const add = (runner, patterns) => {
    for (const pattern of patterns) found.push({ runner, pattern });
  };
  const workflowDir = join(root, '.github/workflows');
  if (existsSync(workflowDir)) {
    for (const name of readdirSync(workflowDir)) {
      if (!/\.ya?ml$/.test(name)) continue;
      const runner = `.github/workflows/${name}`;
      add(runner, patternsFromShell(readFileSync(join(workflowDir, name), 'utf8'), '', true, root));
    }
  }
  for (const name of ['pre-commit', 'pre-commit-full']) {
    const rel = `.githooks/${name}`;
    const abs = join(root, rel);
    if (existsSync(abs)) add(rel, patternsFromShell(readFileSync(abs, 'utf8'), '', true, root));
  }
  for (const prefix of ['.', 'lab']) {
    const script = readTestScript(prefix, root);
    if (!script) continue;
    const runner = prefix === '.' ? 'package.json' : 'lab/package.json';
    add(runner, patternsFromShell(script, prefix === '.' ? '' : prefix, false, root));
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

function loadExceptions(root) {
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
    return { entries: [], errors: [`${rel} must be a list of { "path", "kind", "reason" }`] };
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
    if (path.startsWith('/') || path.includes('\\') || path.split('/').includes('..') || /[*?\[\]]/.test(path)) {
      errors.push(`${rel}: invalid path ${path}`);
      return;
    }
    if (!['helper', 'opt-in'].includes(entry.kind)) {
      errors.push(`${rel}: ${path} needs kind helper or opt-in`);
      return;
    }
    if (entries.some(item => item.path === path)) {
      errors.push(`${rel}: duplicate classification for ${path}`);
      return;
    }
    entries.push({ path, kind: entry.kind, reason: entry.reason.trim() });
  });
  return { entries, errors };
}

export function auditOrphanTests({ root = repositoryRoot } = {}) {
  const items = loadRunnerPatterns(root);
  // Recursive glob semantics differ between sh, bash and Node. Do not infer coverage.
  const unsupported = items.filter(item => item.pattern.includes('**'));
  const patterns = compilePatterns(items.filter(item => !item.pattern.includes('**')));
  const files = [...new Set(discoveryRoots.flatMap(directory => collectTree(directory, root)))].sort();
  const unique = files.filter(isTestFile);
  const pythonFiles = files.filter(file => file.startsWith('services/') && /\/tests?\/test_[^/]+\.py$/.test(file));
  const { entries, errors } = loadExceptions(root);
  for (const item of unsupported) errors.push(`${item.runner}: unsupported recursive glob ${item.pattern}; coverage needs an explicit runner pattern`);
  const known = new Set(unique);
  for (const entry of entries) {
    if (!known.has(entry.path)) errors.push(`tools/orphan-tests-exceptions.json: ${entry.path} is not a discovered test file`);
  }
  const excepted = new Set(entries.map(entry => entry.path));
  const orphans = [];
  const covered = [];
  for (const file of unique) {
    const matches = patterns.filter(item => patternHits(item, file));
    const hit = matches.find(item => item.runner === '.githooks/pre-commit-full') || matches[0];
    if (hit) covered.push({ file, runner: hit.runner, pattern: hit.pattern,
      kind: hit.runner === '.githooks/pre-commit-full' ? 'full-regression'
        : hit.runner.startsWith('.github/workflows/') ? 'ci' : 'package-or-local' });
    else if (!excepted.has(file)) orphans.push(file);
  }
  return { files: unique, orphans, covered, exceptions: entries, errors,
    python: { files: pythonFiles, coverage: 'not-evaluated', note: 'Python runner coverage is outside this JavaScript audit.' } };
}

function main() {
  const result = auditOrphanTests();
  for (const error of result.errors) console.error(error);
  if (result.orphans.length > 0) {
    console.error('Orphan JavaScript/TypeScript tests:');
    for (const file of result.orphans) console.error(file);
  } else if (result.errors.length === 0) {
    console.log(`Checked ${result.files.length} JavaScript/TypeScript test candidates. Orphans: 0. Explicit helper/opt-in classifications: ${result.exceptions.length}.`);
  }
  console.log(`Separate Python inventory: ${result.python.files.length} test files. ${result.python.note}`);
  return result.orphans.length > 0 || result.errors.length > 0 ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
