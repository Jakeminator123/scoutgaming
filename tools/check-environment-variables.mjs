#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = resolve(root, 'docs/environment-variables.json');
const categories = ['required', 'firstBoot', 'conditional', 'managed', 'blocked'];
const namePattern = /^[A-Z][A-Z0-9_]*$/;

export function referencedNames(source, file = 'source.mjs') {
  return new Set(fixedEnvironmentUses(source, file).flatMap(use => use.names));
}

// Fixed production values may be described freely; only env use/declaration is retired.
// Workflows remain outside this audit and are changed in their own PR.
export const HARDCODED_EXCLUDES = Object.freeze([':(exclude)docs/**', ':(exclude)*.md', ':(exclude).github/workflows/**']);

export function hardcodedNames(registry) {
  return registry?.hardcodedNames?.names ?? [];
}

let parser;
function sourceParser() {
  if (!parser) {
    try { parser = createRequire(new URL('../apps/studio/package.json', import.meta.url))('next/dist/compiled/babel/parser'); }
    catch { throw Error('Environment check requires the locked Studio dependencies: npm --prefix apps/studio ci'); }
  }
  return parser;
}

const member = node => ['MemberExpression', 'OptionalMemberExpression'].includes(node?.type);
const keyOf = node => node?.type === 'Identifier' ? node.name : node?.type === 'StringLiteral' ? node.value
  : node?.type === 'TemplateLiteral' && node.expressions.length === 0 ? node.quasis[0].value.cooked : undefined;
const propertyOf = node => node.computed && node.property.type === 'Identifier' ? undefined : keyOf(node.property);

// Literal env members, destructuring and const aliases. Deliberately does not
// evaluate arbitrary computed keys, function returns or reassigned aliases.
export function fixedEnvironmentUses(source, file, names) {
  if (/\.d\.[cm]?ts$/.test(file)) return [];
  const tree = /\.json$/.test(file) ? sourceParser().parseExpression(source) : sourceParser().parse(source, {
    sourceType: 'unambiguous', allowReturnOutsideFunction: true,
    plugins: [/\.[cm]?tsx?$/.test(file) && 'typescript', !/\.[cm]?ts$/.test(file) && 'jsx'].filter(Boolean),
  });
  const scopes = new WeakMap(), nodes = [];
  const bind = (pattern, scope, value = null) => {
    if (!pattern) return;
    if (pattern.type === 'Identifier') scope.bindings.set(pattern.name, value);
    else if (pattern.type === 'AssignmentPattern') bind(pattern.left, scope);
    else if (pattern.type === 'RestElement') bind(pattern.argument, scope);
    else if (pattern.type === 'ArrayPattern') pattern.elements.forEach(item => bind(item, scope));
    else if (pattern.type === 'ObjectPattern') pattern.properties.forEach(item => bind(item.type === 'RestElement' ? item.argument : item.value, scope));
  };
  const walk = (node, scope) => {
    if (!node || typeof node.type !== 'string') return;
    if (['FunctionDeclaration', 'ClassDeclaration'].includes(node.type)) bind(node.id, scope);
    const functionScope = node.type === 'Program' || /Function|Method/.test(node.type);
    if (functionScope || ['BlockStatement', 'CatchClause', 'ForStatement', 'ForInStatement', 'ForOfStatement', 'SwitchStatement', 'ClassExpression', 'StaticBlock'].includes(node.type)) {
      scope = { parent: scope, bindings: new Map(), functionScope };
    }
    scopes.set(node, scope); nodes.push(node);
    if (['FunctionExpression', 'ClassExpression'].includes(node.type)) bind(node.id, scope);
    if (node.type === 'VariableDeclaration') {
      let target = scope;
      if (node.kind === 'var') while (target.parent && !target.functionScope) target = target.parent;
      node.declarations.forEach(item => bind(item.id, target, node.kind === 'const' ? item.init : null));
    }
    for (const param of node.params || []) bind(param, scope);
    if (node.type === 'CatchClause') bind(node.param, scope);
    if (node.type === 'ImportDeclaration') for (const item of node.specifiers) {
      const processModule = ['node:process', 'process'].includes(node.source.value);
      scope.bindings.set(item.local.name, processModule && item.imported?.name === 'env' ? 'env'
        : processModule && ['ImportDefaultSpecifier', 'ImportNamespaceSpecifier'].includes(item.type) ? 'process' : null);
    }
    for (const [key, child] of Object.entries(node)) {
      if (['loc', 'start', 'end', 'comments', 'tokens'].includes(key)) continue;
      if (Array.isArray(child)) child.forEach(item => walk(item, scope));
      else walk(child, scope);
    }
  };
  walk(tree.program || tree, { bindings: new Map() });
  const bindingOf = node => {
    for (let scope = scopes.get(node); scope; scope = scope.parent) if (scope.bindings.has(node.name)) return scope.bindings.get(node.name);
    return undefined;
  };
  const isEnv = (node, seen = new Set()) => {
    if (!node || seen.has(node)) return false;
    seen = new Set([...seen, node]);
    if (['TSAsExpression', 'TSSatisfiesExpression', 'TSNonNullExpression', 'ParenthesizedExpression'].includes(node.type)) return isEnv(node.expression, seen);
    if (member(node)) return propertyOf(node) === 'env' && node.object.type === 'Identifier'
      && ((node.object.name === 'process' && bindingOf(node.object) === undefined) || bindingOf(node.object) === 'process');
    if (node.type === 'Identifier') return node.name === 'env' || bindingOf(node) === 'env' || isEnv(bindingOf(node), seen);
    return false;
  };
  const found = new Map();
  const add = (name, node) => {
    if (!namePattern.test(name ?? '') || (names && !names.includes(name))) return;
    const line = node.loc.start.line;
    if (!found.has(line)) found.set(line, new Set());
    found.get(line).add(name);
  };
  const properties = node => {
    if (['ObjectExpression', 'ObjectPattern'].includes(node?.type)) for (const item of node.properties) {
      if (item.type !== 'RestElement' && item.type !== 'SpreadElement') add(item.computed && item.key.type === 'Identifier' ? undefined : keyOf(item.key), item);
    }
  };
  for (const node of nodes) {
    if (member(node) && isEnv(node.object)) add(propertyOf(node), node);
    if (node.type === 'VariableDeclarator') {
      if (isEnv(node.init)) properties(node.id);
      if (isEnv(node.id)) properties(node.init);
    }
    if (node.type === 'AssignmentExpression') {
      if (isEnv(node.right)) properties(node.left);
      if (isEnv(node.left)) properties(node.right);
    }
    if (node.type === 'ObjectProperty' && (!node.computed || node.key.type !== 'Identifier') && keyOf(node.key) === 'env') properties(node.value);
    if (node.type === 'CallExpression' && member(node.callee) && node.callee.object.name === 'Object'
      && propertyOf(node.callee) === 'assign' && isEnv(node.arguments[0])) node.arguments.slice(1).forEach(properties);
  }
  return [...found].map(([line, used]) => ({ line, names: [...used] }));
}

// git grep is only a candidate filter; comments and descriptive strings never
// establish env use. Read tracked files as edited, including ignored source.
export function hardcodedNameReferences(names, { cwd = root, run = execFileSync } = {}) {
  if (!names.length) return [];
  let output;
  try {
    output = run('git', ['grep', '-I', '-l', '-z', '-w', '-F', ...names.flatMap(name => ['-e', name]), '--', '.', ...HARDCODED_EXCLUDES],
      { cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  } catch (error) {
    if (error?.status === 1) return [];
    throw error;
  }
  return output.split('\0').filter(Boolean).flatMap(path => {
    let source;
    try { source = readFileSync(resolve(cwd, path), 'utf8'); }
    catch (error) { if (error.code === 'ENOENT') return []; throw error; }
    let uses = [];
    try {
      if (/\.[cm]?[jt]sx?$/.test(path)) uses = fixedEnvironmentUses(source, path, names);
      else if (/\.json$/.test(path)) {
        JSON.parse(source); // Reject invalid JSON before inspecting its declaration syntax.
        uses = fixedEnvironmentUses(source, path, names);
      } else {
        const envFile = /(^|\/)\.env(?:\.|$)/.test(path);
        const blueprint = /(^|\/)render[^/]*\.ya?ml$/.test(path);
        source.split(/\r?\n/).forEach((line, index) => {
          const declarations = envFile ? [...templateNames(line)]
            : blueprint ? [/^\s*-\s+key:\s*['"]?([A-Z][A-Z0-9_]*)\b/.exec(line)?.[1]] : [];
          const used = declarations.filter(name => names.includes(name));
          if (used.length) uses.push({ line: index + 1, names: used });
        });
      }
    } catch (error) {
      // JSON.parse diagnostics can quote env values from malformed configuration.
      const detail = error.reasonCode ? error.reasonCode + ' at line ' + error.loc.line
        : error instanceof SyntaxError ? 'Invalid environment configuration syntax' : error.message;
      throw Error(path + ': ' + detail);
    }
    return uses.map(use => ({ path, ...use }));
  });
}

export function validateRegistry(registry) {
  const errors = [];
  if (registry?.schema !== 1 || !registry.services || typeof registry.services !== 'object') {
    return ['Invalid environment registry schema.'];
  }
  const fixed = registry.hardcodedNames?.names;
  if (fixed !== undefined && (!Array.isArray(fixed) || fixed.some(name => typeof name !== 'string' || !namePattern.test(name)))) {
    errors.push('hardcodedNames: names must be a list of key names');
  }
  for (const name of Array.isArray(fixed) ? fixed : []) {
    for (const [service, entry] of Object.entries(registry.services)) {
      if (categories.some(category => Array.isArray(entry[category]) && entry[category].includes(name))) {
        errors.push(`${service}: ${name} is hard-coded and must not be listed as read`);
      }
    }
  }
  for (const [service, entry] of Object.entries(registry.services)) {
    const names = new Set();
    if (!Array.isArray(entry.sources)) errors.push(`${service}: sources must be a list`);
    for (const category of categories) {
      if (!Array.isArray(entry[category])) {
        errors.push(`${service}: ${category} must be a list`);
        continue;
      }
      for (const name of entry[category]) {
        if (typeof name !== 'string' || !namePattern.test(name)) errors.push(`${service}: invalid key name`);
        else if (names.has(name)) errors.push(`${service}: duplicate ${name}`);
        else names.add(name);
      }
    }
  }
  return errors;
}

export function parseEnvNames(source) {
  const names = new Set();
  for (const line of source.split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=/.exec(line);
    if (match) names.add(match[1]);
  }
  return names;
}

export function templateNames(source) {
  const names = parseEnvNames(source);
  for (const line of source.split(/\r?\n/)) {
    const match = /^\s*#\s*([A-Z][A-Z0-9_]*)\s*=/.exec(line);
    if (match) names.add(match[1]);
  }
  return names;
}

export function blueprintNames(source, service) {
  const section = source.split(/^  - type: /m).find(part => new RegExp(`^    name: ${service}$`, 'm').test(part));
  if (!section) return null;
  return new Set([...section.matchAll(/^      - key: ([A-Z][A-Z0-9_]*)\s*$/gm)].map(match => match[1]));
}

export function compareKeys(entry, present) {
  return {
    missing: entry.required.filter(name => !present.has(name)),
    unlisted: [...present].filter(name => !categories.some(category => entry[category].includes(name))).sort(),
  };
}

export function hasEnvChange(patch, envTemplate = false) {
  return patch.split(/\r?\n/).some(line => {
    if (!/^[+-](?![+-])/.test(line)) return false;
    const content = line.slice(1);
    return envTemplate
      ? /^\s*#?\s*(?:export\s+)?[A-Z][A-Z0-9_]*\s*=/.test(content)
        || /^\s*-\s+key:\s*[A-Z][A-Z0-9_]*\b/.test(content)
        || /^\s*(?:value|generateValue|sync|fromService|envVarKey):/.test(content)
      : /\b(?:process\.)?env(?:\.[A-Z][A-Z0-9_]*\b|\[['"][A-Z][A-Z0-9_]*['"]\])/.test(content);
  });
}

function stagedChangesNeedDocs(registry) {
  const staged = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMRT'], { cwd: root, encoding: 'utf8' })
    .split(/\r?\n/).filter(Boolean);
  const sourcePaths = new Set(Object.values(registry.services).flatMap(entry => entry.sources));
  const templatePaths = new Set(Object.values(registry.services).flatMap(entry => entry.templates ?? []));
  const blueprintPaths = new Set(Object.values(registry.services).map(entry => entry.blueprint?.path).filter(Boolean));
  const changed = staged.filter(path => sourcePaths.has(path) || templatePaths.has(path) || blueprintPaths.has(path) || /(^|\/)\.env(?:\.|$)/.test(path));
  for (const path of changed) {
    const patch = execFileSync('git', ['diff', '--cached', '--unified=0', '--', path], { cwd: root, encoding: 'utf8' });
    if (hasEnvChange(patch, templatePaths.has(path) || blueprintPaths.has(path) || /(^|\/)\.env(?:\.|$)/.test(path))) {
      return !staged.includes('docs/environment-variables.json') || !staged.includes('docs/ENVIRONMENT-VARIABLES.md')
        ? [`${path} changes environment variables; stage both environment inventory files in the same commit.`] : [];
    }
  }
  return [];
}

async function audit(registry) {
  const errors = validateRegistry(registry);
  if (errors.length) return errors;
  for (const { path, line, names } of hardcodedNameReferences(hardcodedNames(registry))) {
    errors.push(`${path}:${line} names ${names.join(', ')}, which is hard-coded (docs/ENVIRONMENT-VARIABLES.md#fasta-värden); use the fixed value instead of reading the variable.`);
  }
  for (const [service, entry] of Object.entries(registry.services)) {
    const listed = new Set(categories.flatMap(category => entry[category]));
    for (const sourcePath of entry.sources) {
      if (typeof sourcePath !== 'string' || sourcePath.startsWith('/') || sourcePath.includes('..') || sourcePath.includes('\\')) {
        errors.push(`${service}: invalid source path`);
        continue;
      }
      let source;
      try { source = await readFile(resolve(root, sourcePath), 'utf8'); }
      catch { errors.push(`${service}: source missing: ${sourcePath}`); continue; }
      for (const name of referencedNames(source, sourcePath)) {
        if (!listed.has(name)) errors.push(`${service}: ${name} is read in ${sourcePath} but missing from registry`);
      }
    }
    for (const templatePath of entry.templates ?? []) {
      if (typeof templatePath !== 'string' || templatePath.startsWith('/') || templatePath.includes('..') || templatePath.includes('\\')) {
        errors.push(`${service}: invalid template path`);
        continue;
      }
      let template;
      try { template = await readFile(resolve(root, templatePath), 'utf8'); }
      catch { errors.push(`${service}: template missing: ${templatePath}`); continue; }
      for (const name of templateNames(template)) {
        if (!listed.has(name)) errors.push(`${service}: ${name} is in ${templatePath} but missing from registry`);
      }
    }
    if (entry.blueprint) {
      const { path, service: blueprintService } = entry.blueprint;
      if (typeof path !== 'string' || path.startsWith('/') || path.includes('..') || path.includes('\\')
        || typeof blueprintService !== 'string') {
        errors.push(`${service}: invalid blueprint reference`);
      } else {
        let source;
        try { source = await readFile(resolve(root, path), 'utf8'); }
        catch { errors.push(`${service}: blueprint missing: ${path}`); }
        if (source) {
          const names = blueprintNames(source, blueprintService);
          if (!names) errors.push(`${service}: blueprint service missing: ${blueprintService}`);
          else for (const name of names) {
            if (!listed.has(name)) errors.push(`${service}: ${name} is in ${path} but missing from registry`);
          }
        }
      }
    }
  }
  return errors;
}

async function main(args) {
  if (args.length !== 0 && !(args.length === 3 && args[0] === '--compare')) {
    throw Error('Usage: node tools/check-environment-variables.mjs [--compare SERVICE ENV_FILE]');
  }
  const registry = JSON.parse(await readFile(manifestPath, 'utf8'));
  const errors = await audit(registry);
  if (args.length === 0) errors.push(...stagedChangesNeedDocs(registry));
  if (errors.length) throw Error(errors.join('\n'));
  if (args.length) {
    const [, service, envPath] = args;
    const entry = registry.services[service];
    if (!entry) throw Error(`Unknown service: ${service}`);
    const names = parseEnvNames(await readFile(resolve(envPath), 'utf8'));
    const { missing, unlisted } = compareKeys(entry, names);
    if (missing.length) throw Error(`Missing required key names for ${service}: ${missing.join(', ')}`);
    if (unlisted.length) console.log(`Unlisted key names for ${service}: ${unlisted.join(', ')}`);
    console.log(`Key-name comparison passed for ${service}; no values were printed.`);
  } else console.log('Environment variable registry matches checked deployment entrypoints.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
