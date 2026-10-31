#!/usr/bin/env node
// PostgreSQL is the product store. Check executable JS/TS module loading and
// package declarations, not words in comments, types, examples or negative tests.
// Like other static checks this does not evaluate arbitrary computed loaders.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sqliteModules = ['node:sqlite', 'bun:sqlite', 'sqlite', 'sqlite3', 'better-sqlite3', 'sql.js'];
const codeFile = /\.[cm]?[jt]sx?$/;
let parser;

function sourceParser() {
  if (!parser) {
    try { parser = createRequire(new URL('../apps/studio/package.json', import.meta.url))('next/dist/compiled/babel/parser'); }
    catch { throw Error('SQLite import check requires the locked Studio dependencies: npm --prefix apps/studio ci'); }
  }
  return parser;
}

const isSqliteModule = value => typeof value === 'string'
  && sqliteModules.some(name => value === name || value.startsWith(name + '/'));

export function sqliteImports(source, file = 'source.mjs') {
  if (/\.d\.[cm]?ts$/.test(file)) return []; // Declaration files never execute.
  const tree = sourceParser().parse(source, {
    sourceType: 'unambiguous', allowReturnOutsideFunction: true,
    plugins: [/\.[cm]?tsx?$/.test(file) && ['typescript', { dts: /\.d\.[cm]?ts$/.test(file) }], (!/\.[cm]?ts$/.test(file)) && 'jsx'].filter(Boolean),
  });
  const scopes = new WeakMap(), nodes = [];
  const walk = (node, scope) => {
    if (!node || typeof node !== 'object' || typeof node.type !== 'string') return;
    if (['Program', 'BlockStatement', 'CatchClause'].includes(node.type) || /Function|Method/.test(node.type)) scope = { parent: scope, bindings: new Map() };
    scopes.set(node, scope); nodes.push(node);
    if (node.type === 'VariableDeclaration') for (const declaration of node.declarations) {
      if (declaration.id.type === 'Identifier') scope.bindings.set(declaration.id.name, node.kind === 'const' ? declaration.init : null);
    }
    for (const param of node.params || []) if (param.type === 'Identifier') scope.bindings.set(param.name, null);
    if (node.type === 'ImportDeclaration') for (const binding of node.specifiers) {
      const nodeModule = ['node:module', 'module'].includes(node.source.value);
      scope.bindings.set(binding.local.name, nodeModule && binding.imported?.name === 'createRequire' ? 'createRequire'
        : nodeModule && ['ImportNamespaceSpecifier', 'ImportDefaultSpecifier'].includes(binding.type) ? 'nodeModule' : null);
    }
    for (const [key, child] of Object.entries(node)) {
      if (['loc', 'start', 'end', 'comments', 'tokens'].includes(key)) continue;
      if (Array.isArray(child)) child.forEach(item => walk(item, scope));
      else walk(child, scope);
    }
  };
  walk(tree.program, { bindings: new Map() });
  const bindingOf = node => {
    for (let scope = scopes.get(node); scope; scope = scope.parent) if (scope.bindings.has(node.name)) return scope.bindings.get(node.name);
    return undefined;
  };
  const valueOf = (node, seen = new Set()) => {
    if (!node || seen.has(node)) return undefined;
    seen = new Set([...seen, node]);
    if (node.type === 'StringLiteral') return node.value;
    if (node.type === 'TemplateLiteral' && node.expressions.length === 0) return node.quasis[0].value.cooked;
    if (['ParenthesizedExpression', 'TSAsExpression', 'TSSatisfiesExpression'].includes(node.type)) return valueOf(node.expression, seen);
    if (node.type === 'BinaryExpression' && node.operator === '+') {
      const left = valueOf(node.left, seen), right = valueOf(node.right, seen);
      if (typeof left === 'string' && typeof right === 'string') return left + right;
    }
    if (node.type === 'Identifier') return valueOf(bindingOf(node), seen);
    return undefined;
  };
  const member = (node, name) => node?.type === 'MemberExpression' && !node.computed && node.property.name === name;
  const createsRequire = node => node?.type === 'CallExpression'
    && ((node.callee.type === 'Identifier' && bindingOf(node.callee) === 'createRequire')
      || (member(node.callee, 'createRequire') && node.callee.object.type === 'Identifier' && bindingOf(node.callee.object) === 'nodeModule'));
  const isRequire = node => (node?.type === 'Identifier' && (createsRequire(bindingOf(node)) || (node.name === 'require' && bindingOf(node) === undefined)))
    || createsRequire(node) || (member(node, 'require') && node.object.type === 'Identifier' && node.object.name === 'module' && bindingOf(node.object) === undefined);
  const references = [];
  const add = node => {
    const specifier = valueOf(node);
    if (isSqliteModule(specifier)) references.push({ line: node.loc.start.line, specifier });
  };
  for (const node of nodes) {
    if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type) && node.source
      && node.importKind !== 'type' && node.exportKind !== 'type'
      && !(node.specifiers?.length && node.specifiers.every(item => item.importKind === 'type' || item.exportKind === 'type'))) add(node.source);
    if (node.type === 'TSImportEqualsDeclaration' && node.importKind !== 'type' && node.moduleReference.type === 'TSExternalModuleReference') add(node.moduleReference.expression);
    if (node.type === 'ImportExpression') add(node.source);
    if (node.type === 'CallExpression' && (node.callee.type === 'Import' || isRequire(node.callee)
      || (member(node.callee, 'resolve') && isRequire(node.callee.object)))) add(node.arguments[0]);
  }
  return references;
}

export function sqliteDependencies(source) {
  const manifest = JSON.parse(source), found = new Set();
  for (const section of ['dependencies', 'optionalDependencies', 'peerDependencies', 'devDependencies']) {
    for (const [name, version] of Object.entries(manifest[section] || {})) {
      const alias = typeof version === 'string' && version.startsWith('npm:') ? version.slice(4).split('@')[0] : '';
      if (isSqliteModule(name)) found.add(name);
      else if (isSqliteModule(alias)) found.add(alias);
    }
  }
  return [...found];
}

export function sqliteViolations({ cwd = repository } = {}) {
  // Only tracked source as edited; never build output or arbitrary Markdown.
  const paths = execFileSync('git', ['ls-files', '-z'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 })
    .split('\0').filter(path => codeFile.test(path) || /(?:^|\/)package\.json$/.test(path));
  const violations = [];
  for (const path of paths) {
    let source;
    try { source = readFileSync(resolve(cwd, path), 'utf8'); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; } // Unstaged deletions are no longer executable.
    let references;
    try { references = codeFile.test(path) ? sqliteImports(source, path) : sqliteDependencies(source).map(specifier => ({ specifier })); }
    catch (error) { throw Error(path + ': ' + (error.reasonCode ? error.reasonCode + ' at line ' + error.loc.line : error.message)); }
    for (const reference of references) violations.push({ path, ...reference });
  }
  return violations;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length > 2) { console.error('Usage: node tools/check-no-sqlite.mjs'); process.exitCode = 2; }
  else try {
    const violations = sqliteViolations();
    for (const { path, line, specifier } of violations) console.error(path + (line ? ':' + line : '') + ': SQLite module ' + specifier + ' is retired; use PostgreSQL (PGlite for isolated tests).');
    if (violations.length) process.exitCode = 1;
    else console.log('SQLite imports and dependency declarations: none.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
