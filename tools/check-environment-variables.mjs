#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = resolve(root, 'docs/environment-variables.json');
const categories = ['required', 'firstBoot', 'conditional', 'managed', 'blocked'];
const namePattern = /^[A-Z][A-Z0-9_]*$/;

export function referencedNames(source) {
  const dotted = [...source.matchAll(/\b(?:process\.)?env\.([A-Z][A-Z0-9_]*)\b/g)].map(match => match[1]);
  const bracketed = [...source.matchAll(/\b(?:process\.)?env\[['"]([A-Z][A-Z0-9_]*)['"]\]/g)].map(match => match[1]);
  return new Set([...dotted, ...bracketed]);
}

export function validateRegistry(registry) {
  const errors = [];
  if (registry?.schema !== 1 || !registry.services || typeof registry.services !== 'object') {
    return ['Invalid environment registry schema.'];
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
      for (const name of referencedNames(source)) {
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
