import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, resolve, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { referencedNames, validateRegistry } from '../../tools/check-environment-variables.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PARTS = ['catalog', 'routes', 'storage', 'flows'];
const SHA = /^[a-f0-9]{40}$/;
const HASH = /^sha256:[a-f0-9]{64}$/;
const CATEGORIES = ['required', 'firstBoot', 'conditional', 'managed', 'blocked'];
const NAME = /^[A-Za-z0-9_.:@+\[\]/-]+$/;
const TEXT = /\.(?:mjs|cjs|js|jsx|ts|tsx|mts|sql|json|md|css|html|yml|yaml)$|(?:^|\/)(?:Dockerfile|package-lock\.json|pre-commit-full|pre-push)$/;
const NEXT_SOURCE = /\/(?:page|route)\.(?:tsx?|jsx?)$/;
export const hashText = text => 'sha256:' + createHash('sha256').update(String(text).replace(/\r\n/g, '\n')).digest('hex');
const parse = text => JSON.parse(text.replace(/^\uFEFF/, ''));
const stable = value => JSON.stringify(value);

export function safePath(path) {
  return typeof path === 'string' && /^[A-Za-z0-9_.@+[\]/-]+$/.test(path) && !isAbsolute(path)
    && !path.split('/').some(part => ['', '.', '..', '.git', 'node_modules', '.next', '.croupier-inbox', 'arkiv'].includes(part))
    && !/(?:^|\/)\.env(?:$|\.(?!example$|sample$|template$))/.test(path);
}
export function isolatedGitEnvironment(env = process.env) {
  const clean = Object.fromEntries(Object.entries(env).filter(([key]) => !/^GIT_/i.test(key)));
  return { ...clean, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null', GIT_TERMINAL_PROMPT: '0' };
}
// Local Git object reads only. Resolve a moving ref exactly once; never checkout,
// fetch, read credentials, stage, or touch shared Git configuration.
export function createSourceReader({ repositoryRoot = ROOT, ref } = {}) {
  const root = resolve(repositoryRoot), env = isolatedGitEnvironment();
  const git = args => execFileSync('git', args, { cwd: root, env, encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 8 * 1024 * 1024 });
  let currentSha = null;
  try { currentSha = git(['rev-parse', '--verify', (ref || 'HEAD') + '^{commit}']).trim(); }
  catch { if (ref) throw Error('Selected Git commit is unavailable.'); }
  if (currentSha !== null && !SHA.test(currentSha)) throw Error('Invalid selected Git commit.');
  const mode = ref ? 'git-tree' : 'working-tree', cache = new Map(), committed = new Map();
  const atCommit = path => {
    if (!currentSha) return null;
    if (!committed.has(path)) {
      try { committed.set(path, git(['show', currentSha + ':' + path])); } catch { committed.set(path, null); }
    }
    return committed.get(path);
  };
  const read = path => {
    if (!safePath(path)) return null;
    if (!cache.has(path)) {
      if (mode === 'git-tree') cache.set(path, atCommit(path));
      else {
        try {
          const actual = resolve(root, path);
          cache.set(path, statSync(actual).isFile() ? readFileSync(actual, 'utf8') : null);
        } catch { cache.set(path, null); }
      }
    }
    return cache.get(path);
  };
  const list = prefix => {
    if (!safePath(prefix)) return [];
    if (mode === 'git-tree') return git(['ls-tree', '-r', '--name-only', currentSha, '--', prefix]).trim().split(/\r?\n/).filter(Boolean).sort();
    const found = [];
    const walk = directory => {
      if (!existsSync(resolve(root, directory))) return;
      for (const entry of readdirSync(resolve(root, directory), { withFileTypes: true })) {
        if (entry.name.startsWith('.') || ['node_modules', 'arkiv'].includes(entry.name) || entry.isSymbolicLink()) continue;
        const path = directory + '/' + entry.name;
        if (entry.isDirectory()) walk(path); else if (entry.isFile()) found.push(path);
      }
    };
    walk(prefix); return found.sort();
  };
  return { root, currentSha, mode, read, list,
    commitMatched(path) { const text = read(path), original = atCommit(path); return text !== null && original !== null && hashText(text) === hashText(original); } };
}

function refs(value, found = new Set()) {
  if (Array.isArray(value)) value.forEach(item => refs(item, found));
  else if (value && typeof value === 'object') {
    if (typeof value.path === 'string' && safePath(value.path) && TEXT.test(value.path)) found.add(value.path);
    Object.values(value).forEach(item => refs(item, found));
  } else if (typeof value === 'string') {
    const path = value.replace(/:\d+$/, '');
    if (/^(?:apps|web|lab|ops|tools|test|services|open-claw|presentation-runtime|pipeline|docs|planes|\.github|\.githooks)\//.test(path)
      && safePath(path) && TEXT.test(path)) found.add(path);
  }
  return found;
}
function duplicates(rows, key) {
  const seen = new Set(), repeated = new Set();
  for (const row of rows || []) { const id = key(row); if (seen.has(id)) repeated.add(id); seen.add(id); }
  return [...repeated].sort();
}
const verbs = source => [...new Set([
  ...[...source.matchAll(/\bexport\s+(?:async\s+)?(?:function|const)\s+(GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS)\b/g)].map(match => match[1]),
  ...[...source.matchAll(/\bexport\s*\{([^}]+)\}/g)].flatMap(match => match[1].split(',').map(value => value.trim().split(/\s+as\s+/).at(-1)).filter(value => /^(GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS)$/.test(value))),
])].sort();
function routePattern(file, prefix) {
  const parts = file.slice(prefix.length + 1).split('/').slice(0, -1).filter(part => !/^\(.+\)$/.test(part) && !part.startsWith('@'));
  return '/' + parts.map(part => part.replace(/^\[\[\.\.\.(.+)\]\]$/, ':$1*').replace(/^\[\.\.\.(.+)\]$/, ':$1+').replace(/^\[(.+)\]$/, ':$1')).join('/');
}

// Bounded SQL source comparison, not a PostgreSQL parser or live-schema read.
// Handles the repository's qualified CREATE TABLE, inline/table keys, and
// ADD COLUMN migrations. Unknown DDL is a warning, never invented metadata.
function splitSql(text) {
  const values = []; let start = 0, depth = 0, quoted = false;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "'") { if (quoted && text[i + 1] === "'") { i++; continue; } quoted = !quoted; }
    if (quoted) continue;
    if (text[i] === '(') depth++; else if (text[i] === ')') depth--;
    else if (text[i] === ',' && depth === 0) { values.push(text.slice(start, i).trim()); start = i + 1; }
  }
  values.push(text.slice(start).trim()); return values.filter(Boolean);
}
function bodyEnd(text, start) {
  let depth = 1, quoted = false;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "'") { if (quoted && text[i + 1] === "'") { i++; continue; } quoted = !quoted; }
    if (quoted) continue;
    if (text[i] === '(') depth++; else if (text[i] === ')' && --depth === 0) return i;
  }
  return -1;
}
const names = text => text.split(',').map(value => value.trim()).filter(Boolean);
function column(part) {
  const match = /^([a-z_][a-z0-9_]*)\s+([\s\S]+)$/i.exec(part);
  if (!match || /^(?:primary|foreign|check|unique|constraint)$/i.test(match[1])) return null;
  const type = match[2].split(/\b(?:NOT\s+NULL|NULL|DEFAULT|PRIMARY|REFERENCES|CHECK|UNIQUE|CONSTRAINT|GENERATED|COLLATE)\b/i)[0].trim().replace(/\s+/g, ' ').toLowerCase();
  return { name: match[1], dataType: type, nullable: !/\bNOT\s+NULL\b|\bPRIMARY\s+KEY\b/i.test(part) };
}
export function parseSqlTables(source, path) {
  const text = source.replace(/--[^\r\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, ''), tables = [], alterations = [];
  for (const match of text.matchAll(/\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_]\w*)\.([a-z_]\w*)\s*\(/gi)) {
    const start = match.index + match[0].length, end = bodyEnd(text, start);
    if (end < 0) continue;
    const table = { schema: match[1], name: match[2], columns: [], primaryKey: [], foreignKeys: [], path };
    for (const item of splitSql(text.slice(start, end))) {
      const part = item.replace(/^CONSTRAINT\s+\w+\s+/i, ''), col = column(part);
      if (col) table.columns.push(col);
      const pk = /\bPRIMARY\s+KEY\s*\(([^)]+)\)/i.exec(part);
      if (pk) table.primaryKey.push(...names(pk[1])); else if (col && /\bPRIMARY\s+KEY\b/i.test(part)) table.primaryKey.push(col.name);
      const fk = /\bREFERENCES\s+([a-z_]\w*)\.([a-z_]\w*)\s*\(([^)]+)\)/i.exec(part);
      if (fk) {
        const own = /\bFOREIGN\s+KEY\s*\(([^)]+)\)/i.exec(part);
        table.foreignKeys.push({ columns: own ? names(own[1]) : [col?.name], references: { schema: fk[1], table: fk[2], columns: names(fk[3]) } });
      }
    }
    for (const col of table.columns) if (table.primaryKey.includes(col.name)) col.nullable = false;
    tables.push(table);
  }
  for (const match of text.matchAll(/\bALTER\s+TABLE\s+([a-z_]\w*)\.([a-z_]\w*)\s+ADD\s+(?:COLUMN\s+)?(?:IF\s+NOT\s+EXISTS\s+)?([^;]+);/gi)) {
    const col = column(match[3]); if (col) alterations.push({ table: match[1] + '.' + match[2], column: col, path });
  }
  return { tables, alterations };
}
const keyShape = table => ({
  primaryKey: [...(Array.isArray(table.primaryKey) ? table.primaryKey : table.primaryKey?.columns || [])].sort(),
  foreignKeys: (table.foreignKeys || []).map(key => ({ columns: key.columns, references: key.references })).sort((a, b) => stable(a).localeCompare(stable(b))),
});
const tableShape = table => ({ columns: table.columns.map(col => ({ name: col.name, dataType: col.dataType.toLowerCase().replace(/\s+/g, ' '), nullable: col.nullable })).sort((a, b) => a.name.localeCompare(b.name)), ...keyShape(table) });

export function loadSystemMap(reader) {
  const data = {};
  for (const part of PARTS) { const text = reader.read('docs/system-map/' + part + '.json'); if (text === null) throw Error('Catalog is missing.'); data[part] = parse(text); }
  const registry = parse(reader.read('docs/environment-variables.json') || 'null');
  data.environment = { source: 'docs/environment-variables.json', services: Object.fromEntries(Object.entries(registry?.services || {}).map(([id, entry]) => [id,
    Object.fromEntries(['sources', ...CATEGORIES].map(key => [key, entry[key]]))])) };
  return { data, registry, contracts: parse(reader.read('docs/system-map/contracts.json') || 'null') };
}

function selectedInputs(reader, data, registry, contract) {
  const inputs = new Set([...(contract.sources || []), ...(contract.tests || [])]);
  // Facts are versioned inputs too. Bind each contract to the catalog parts it
  // uses rather than trusting updated working-tree metadata against an old run.
  inputs.add('docs/system-map/catalog.json');
  for (const target of contract.targets || []) {
    if (target.kind === 'route') inputs.add('docs/system-map/routes.json');
    else if (['table', 'schema'].includes(target.kind)) inputs.add('docs/system-map/storage.json');
    else if (target.kind === 'flow') inputs.add('docs/system-map/flows.json');
    else if (target.kind === 'environment') inputs.add('docs/environment-variables.json');
  }
  for (const check of contract.checks || []) {
    if (check.type === 'next-routes') {
      inputs.add('docs/system-map/routes.json');
      const prefix = check.app === 'frontend' ? 'apps/croupier-frontend/app' : 'lab/app';
      reader.list(prefix).filter(path => NEXT_SOURCE.test(path)).forEach(path => inputs.add(path));
    } else if (check.type === 'schema') {
      inputs.add('docs/system-map/storage.json');
      (data.storage.sqlContractCatalog?.sources || []).filter(ref => (data.storage.tables || []).some(table => table.schema === check.schema && table.sources.some(source => source.path === ref.path))).forEach(ref => inputs.add(ref.path));
      if (check.schema === 'croupier_studio') reader.list('ops/neon-studio').filter(path => path.endsWith('.sql')).forEach(path => inputs.add(path));
    } else if (check.type === 'environment') {
      inputs.add('docs/environment-variables.json');
      (registry.services[check.service]?.sources || []).forEach(path => inputs.add(path));
    }
  }
  return [...inputs].sort();
}
export function captureSystemMapInputs({ reader = createSourceReader() } = {}) {
  const { data, registry, contracts } = loadSystemMap(reader);
  const paths = new Set(['docs/system-map/contracts.json', 'docs/environment-variables.json',
    '.github/workflows/croupier.yml', 'tools/system-map-evidence.mjs', 'docs/system-map/verify.mjs',
    'docs/system-map/build.mjs', ...PARTS.map(part => 'docs/system-map/' + part + '.json')]);
  for (const contract of contracts?.contracts || []) selectedInputs(reader, data, registry, contract).forEach(path => paths.add(path));
  const files = {}, commitMatched = {};
  for (const path of [...paths].sort()) { const text = reader.read(path); if (text !== null) { files[path] = hashText(text); commitMatched[path] = reader.commitMatched(path); } }
  return { schemaVersion: 1, sourceSha: reader.currentSha, sourceView: reader.mode, capturedAt: new Date().toISOString(),
    hashAlgorithm: 'sha256:utf8-lf', files, commitMatched };
}
export function refreshContracts({ reader = createSourceReader(), write = true } = {}) {
  const { data, registry, contracts } = loadSystemMap(reader);
  if (reader.mode !== 'working-tree' || contracts?.schemaVersion !== 1) throw Error('Baseline refresh requires a valid working-tree contract catalog.');
  contracts.baseline = { kind: 'working-tree-inputs', observedCommit: reader.currentSha, capturedAt: new Date().toISOString(),
    hashAlgorithm: 'sha256:utf8-lf', note: 'Input capture only; no tests or runtime are marked verified.' };
  for (const contract of contracts.contracts) {
    contract.expectedHashes = {};
    for (const path of selectedInputs(reader, data, registry, contract)) { const text = reader.read(path); if (text !== null) contract.expectedHashes[path] = hashText(text); }
  }
  if (write) writeFileSync(resolve(reader.root, 'docs/system-map/contracts.json'), JSON.stringify(contracts, null, 2) + '\n');
  return contracts;
}
export function safeCiUrl(value) {
  if (value === undefined || value === null) return null;
  // The repository was renamed from github-work to scoutgaming on 2026-10-06;
  // older evidence still carries the previous address.
  return typeof value === 'string' && /^https:\/\/github\.com\/Jakeminator123\/(?:scoutgaming|github-work)\/actions\/runs\/\d+(?:\/attempts\/\d+)?(?:\/job\/\d+)?$/i.test(value) ? value : null;
}

export function verifySystemMap({ reader = createSourceReader(), evidence, now = new Date().toISOString() } = {}) {
  const assurance = { schemaVersion: 1, currentSha: reader.currentSha, catalogSha: null, sourceView: reader.mode,
    status: 'grey', updatedAt: now, scope: 'source-contracts-and-explicit-test-evidence', runtimeVerified: false,
    counts: { green: 0, red: 0, yellow: 0, grey: 0 }, contracts: [], files: [], changedInputs: [], warnings: [], errors: [],
    limitations: ['Only declared source/test inputs and bounded inventories are checked.', 'Imported test artifacts are not a live CI API read.', 'No database, provider, deployment, or browser acceptance is performed.', 'Working-tree mode makes no claim about the staged Git index.'] };
  let loaded;
  try { loaded = loadSystemMap(reader); } catch { assurance.errors.push({ code: 'catalog.unreadable', message: 'A required fact catalog is missing or invalid JSON.' }); assurance.status = 'red'; return { data: {}, assurance }; }
  const { data, registry, contracts } = loaded;
  assurance.catalogSha = data.catalog.sourceSha;
  const error = (code, message, path) => assurance.errors.push({ code, message, ...(path ? { path } : {}) });
  const warning = (list, code, message, path, objectId) => list.push({ code, message, ...(path ? { path } : {}), ...(objectId ? { objectId } : {}) });
  if (!SHA.test(data.catalog.sourceSha || '')) error('catalog.sha', 'Catalog sourceSha must be a full commit SHA.');
  for (const part of PARTS.slice(1)) if (data[part].sourceSha !== data.catalog.sourceSha) error('catalog.version-mismatch', 'Fact catalogs identify different source snapshots.', 'docs/system-map/' + part + '.json');
  if (contracts?.schemaVersion !== 1 || !Array.isArray(contracts.contracts)) error('contracts.schema', 'Contract catalog must contain schemaVersion 1 and contracts.');
  if (!Array.isArray(data.catalog.services) || !Array.isArray(data.routes.sourceRoutes) || !Array.isArray(data.storage.tables) || !Array.isArray(data.flows.flows)) error('catalog.shape', 'Required service, route, table or flow lists are missing.');
  for (const detail of validateRegistry(registry)) error('environment.schema', detail);
  if (assurance.errors.length) { assurance.status = 'red'; return { data, assurance }; }
  const identities = [
    ['service', data.catalog.services, row => row.id], ['route', data.routes.sourceRoutes, row => row.id],
    ['route-group', [...data.routes.pages, ...data.routes.apiGroups], row => row.id],
    ['table', data.storage.tables, row => row.schema + '.' + row.name], ['flow', data.flows.flows, row => row.id],
    ['contract', contracts.contracts, row => row.id],
  ];
  for (const [kind, rows, key] of identities) {
    if (rows.some(row => typeof key(row) !== 'string' || !NAME.test(key(row)))) error('catalog.identity', 'Invalid ' + kind + ' identity.');
    for (const id of duplicates(rows, key)) error('catalog.duplicate', 'Duplicate ' + kind + ' identity: ' + id);
  }
  for (const table of data.storage.tables) {
    if (!Array.isArray(table.columns) || table.columns.some(col => !NAME.test(col.name || '') || typeof col.dataType !== 'string' || typeof col.nullable !== 'boolean')) { error('schema.catalog-shape', 'Invalid column catalog.', table.sources?.[0]?.path); continue; }
    for (const name of duplicates(table.columns, col => col.name)) error('schema.duplicate-column', 'Duplicate column: ' + table.schema + '.' + table.name + '.' + name);
    for (const name of table.primaryKey?.columns || []) if (!table.columns.some(col => col.name === name)) error('schema.invalid-primary-key', 'Primary key refers to an unlisted column: ' + table.schema + '.' + table.name + '.' + name);
    for (const key of table.foreignKeys || []) {
      const target = data.storage.tables.find(row => row.schema === key.references?.schema && row.name === key.references?.table);
      if (!target || key.columns.some(name => !table.columns.some(col => col.name === name)) || key.references.columns.some(name => !target.columns.some(col => col.name === name))) error('schema.invalid-foreign-key', 'Foreign key references an unlisted table or column: ' + table.schema + '.' + table.name);
    }
  }
  const services = new Set(data.catalog.services.map(row => row.id));
  for (const connection of data.catalog.connections || []) if (connection.from && connection.to && (!services.has(connection.from) || !services.has(connection.to))) error('catalog.connection', 'Connection refers to an unlisted service.');
  for (const path of refs({ data, contracts })) if (reader.read(path) === null) error('catalog.missing-reference', 'Registered source/test file is missing.', path);
  const evidenceValid = evidence?.schemaVersion === 1 && evidence.kind === 'explicit-ci-test-files' && SHA.test(evidence.sourceSha || '')
    && evidence.hashAlgorithm === 'sha256:utf8-lf'
    && typeof evidence.observedAt === 'string' && !Number.isNaN(Date.parse(evidence.observedAt)) && evidence.files && typeof evidence.files === 'object'
    && !Array.isArray(evidence.files) && Object.entries(evidence.files).every(([path, hash]) => safePath(path) && HASH.test(hash))
    && Array.isArray(evidence.tests) && evidence.tests.every(test => safePath(test.path) && ['passed', 'failed', 'skipped', 'cancelled'].includes(test.result))
    && evidence.tests.every(test => test.observedAt === undefined || typeof test.observedAt === 'string' && !Number.isNaN(Date.parse(test.observedAt)))
    && !duplicates(evidence.tests || [], test => test.path).length;
  if (evidence && !evidenceValid) warning(assurance.warnings, 'evidence.unusable', 'Imported CI/test metadata is incomplete or ambiguous; no test result is accepted.');
  const records = new Map((evidenceValid ? evidence.tests : []).map(test => [test.path, test]));
  const fileMap = new Map();
  const fileStatus = (path, expected) => {
    const text = reader.read(path), hash = text === null ? null : hashText(text);
    const row = { path, sha256: hash, expectedSha256: expected || null,
      status: text === null ? 'missing' : hash !== expected ? 'changed' : 'current', commitMatched: reader.commitMatched(path) };
    if (!fileMap.has(path) || row.status !== 'current') fileMap.set(path, row);
    return row;
  };
  for (const spec of contracts.contracts) {
    const warnings = [], errors = [], paths = selectedInputs(reader, data, registry, spec);
    const sources = paths.map(path => fileStatus(path, spec.expectedHashes?.[path]));
    for (const file of sources) {
      if (file.status === 'missing') errors.push({ code: 'contract.missing-input', message: 'Required contract input is missing.', path: file.path });
      else if (file.status === 'changed') warning(warnings, 'input.changed', 'Contract input differs from its captured baseline.', file.path);
      if (file.commitMatched === false && reader.currentSha) warning(warnings, 'input.worktree-changed', 'Working input differs from the selected commit.', file.path);
    }
    for (const check of spec.checks || []) {
      if (check.type === 'next-routes') {
        const prefix = check.app === 'frontend' ? 'apps/croupier-frontend/app' : 'lab/app';
        const actual = reader.list(prefix).filter(path => NEXT_SOURCE.test(path));
        const listed = data.routes.sourceRoutes.filter(row => row.app === check.app);
        const routeDrift = (code, message, path, objectId) => errors.push({ code, message, ...(path ? { path } : {}), ...(objectId ? { objectId } : {}) });
        for (const path of actual) {
          const row = listed.find(item => item.handlerFile === path), url = routePattern(path, prefix);
          if (!row) routeDrift('route.uninventoried', 'Selected route has no catalog entry: ' + url, path);
          else {
            if (row.path !== url) routeDrift('route.path-drift', 'Source route pattern differs from catalog: ' + url, path, row.id);
            const methods = /\/route\.(?:tsx?|jsx?)$/.test(path) ? verbs(reader.read(path)) : [];
            if (stable(methods) !== stable([...(row.methods || [])].sort())) routeDrift('route.method-drift', 'Exported HTTP methods differ from the route catalog.', path, row.id);
          }
        }
        for (const row of listed) if (!actual.includes(row.handlerFile)) routeDrift('route.removed', 'Catalog route has no selected source handler.', row.handlerFile, row.id);
      } else if (check.type === 'schema') {
        const sqlPaths = paths.filter(path => path.endsWith('.sql')), parsed = sqlPaths.flatMap(path => { const text = reader.read(path); return text === null ? [] : [{ path, ...parseSqlTables(text, path) }]; });
        const actual = parsed.flatMap(part => part.tables).filter(table => table.schema === check.schema);
        for (const addition of parsed.flatMap(part => part.alterations)) {
          const table = actual.find(row => row.schema + '.' + row.name === addition.table);
          if (table && !table.columns.some(col => col.name === addition.column.name)) table.columns.push(addition.column);
        }
        for (const path of sqlPaths) if (!(data.storage.sqlContractCatalog?.sources || []).some(source => source.path === path)) warning(warnings, 'schema.uninventoried-source', 'Selected SQL source is not inventoried.', path);
        const listed = data.storage.tables.filter(table => table.schema === check.schema);
        for (const table of actual) {
          const id = table.schema + '.' + table.name, catalog = listed.find(row => row.name === table.name);
          if (!catalog) warning(warnings, 'schema.uninventoried-table', 'Selected source table is not inventoried: ' + id, table.path, id);
          else {
            const expected = new Map(catalog.columns.map(col => [col.name, col]));
            for (const col of table.columns) {
              const old = expected.get(col.name);
              if (!old) warning(warnings, 'schema.uninventoried-column', 'New column needs catalog/test review: ' + id + '.' + col.name, table.path, id);
              else if (old.dataType.toLowerCase().replace(/\s+/g, ' ') !== col.dataType || old.nullable !== col.nullable) warning(warnings, 'schema.column-drift', 'Column type/nullability differs: ' + id + '.' + col.name, table.path, id);
            }
            for (const col of catalog.columns) if (!table.columns.some(row => row.name === col.name)) warning(warnings, 'schema.removed-column', 'Catalog column is absent from selected SQL: ' + id + '.' + col.name, table.path, id);
            if (stable(keyShape(table)) !== stable(keyShape(catalog))) warning(warnings, 'schema.key-drift', 'Primary/foreign key metadata differs: ' + id, table.path, id);
          }
        }
        for (const table of listed) if (!actual.some(row => row.name === table.name)) warning(warnings, 'schema.removed-table', 'Catalog table is absent from selected SQL: ' + table.schema + '.' + table.name, table.sources?.[0]?.path);
      } else if (check.type === 'environment') {
        const entry = registry.services[check.service], declared = new Set(CATEGORIES.flatMap(category => entry?.[category] || []));
        if (!entry) errors.push({ code: 'environment.missing-service', message: 'Selected environment service is unlisted.' });
        else for (const path of entry.sources) for (const name of referencedNames(reader.read(path) || '')) if (!declared.has(name)) warning(warnings, 'environment.unlisted-name', 'Source reads an unlisted environment key: ' + name, path, check.service);
      } else if (check.type === 'events') {
        const source = reader.read(check.path) || '', actual = [...new Set([...source.matchAll(/this\.emit\(['"]([a-z_.]+)['"]/g)].map(match => match[1]))].sort();
        for (const name of actual) if (!check.names.includes(name)) warning(warnings, 'event.uninventoried', 'Producer emits an unlisted event: ' + name, check.path);
        for (const name of check.names) if (!actual.includes(name)) warning(warnings, 'event.removed', 'Inventoried event is absent from its producer: ' + name, check.path);
      }
    }
    const versionInputs = [...new Set([...paths, 'docs/system-map/contracts.json', 'tools/system-map-evidence.mjs',
      'docs/system-map/verify.mjs', 'docs/system-map/build.mjs'])];
    const versionMatches = evidenceValid && evidence.sourceSha === reader.currentSha && versionInputs.every(path => {
      const text = reader.read(path); return text !== null && HASH.test(evidence.files[path] || '') && evidence.files[path] === hashText(text) && reader.commitMatched(path);
    });
    const tests = (spec.tests || []).map(path => {
      const reported = records.get(path);
      const result = !reported ? 'not-read' : !versionMatches ? 'stale' : reported.result;
      return { path, result, verifiedSha: reported ? evidence.sourceSha : null,
        verifiedAt: reported ? reported.observedAt || evidence.observedAt : null, ciUrl: reported ? safeCiUrl(evidence.ciUrl) : null };
    });
    if (tests.some(test => test.result === 'stale')) warning(warnings, 'evidence.stale', 'Relevant test evidence does not match the selected commit and input hashes.');
    for (const test of tests) if (test.result === 'failed') errors.push({ code: 'test.failed', message: 'A relevant test file failed for this exact source version.', path: test.path });
    const factsStatus = errors.length || assurance.errors.length ? 'invalid' : warnings.length ? 'changed' : 'current';
    const passed = tests.length > 0 && tests.every(test => test.result === 'passed');
    const status = factsStatus === 'invalid' ? 'red' : factsStatus === 'changed' ? 'yellow' : passed ? 'green' : 'grey';
    assurance.contracts.push({ id: spec.id, label: spec.label, serviceIds: spec.serviceIds || [], targets: spec.targets || [],
      status, factsStatus, sources, tests, warnings, errors,
      verification: { kind: versionMatches && tests.some(test => test.result !== 'not-read') ? 'explicit-ci-test-files' : 'not-read',
        sha: versionMatches ? evidence.sourceSha : null, result: passed ? 'passed' : tests.some(test => test.result === 'failed') ? 'failed' : 'not-read',
        verifiedAt: versionMatches ? tests.map(test => test.verifiedAt).filter(Boolean).sort((a, b) => Date.parse(a) - Date.parse(b)).at(-1) || evidence.observedAt : null,
        ciUrl: versionMatches ? safeCiUrl(evidence.ciUrl) : null } });
    assurance.counts[status]++;
  }
  assurance.files = [...fileMap.values()].sort((a, b) => a.path.localeCompare(b.path));
  assurance.changedInputs = assurance.files.filter(file => file.status === 'changed' || file.commitMatched === false).map(file => file.path);
  for (const contract of assurance.contracts) for (const detail of contract.errors) assurance.errors.push({ contractId: contract.id, ...detail });
  assurance.status = assurance.errors.length ? 'red' : assurance.counts.yellow ? 'yellow' : assurance.counts.grey || !assurance.counts.green ? 'grey' : 'green';
  return { data, assurance };
}

export function summarizeAssurance(assurance, { warningLimit = 12 } = {}) {
  const warnings = [...assurance.warnings, ...assurance.contracts.flatMap(contract =>
    contract.warnings.map(warning => ({ contractId: contract.id, ...warning })))];
  return { status: assurance.status, currentSha: assurance.currentSha, catalogSha: assurance.catalogSha,
    sourceView: assurance.sourceView, counts: assurance.counts, errors: assurance.errors,
    warningCount: warnings.length, warnings: warnings.slice(0, warningLimit), omittedWarnings: Math.max(0, warnings.length - warningLimit) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2), options = {}; let refresh = false;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--check') continue;
      if (args[i] === '--refresh-baseline') { refresh = true; continue; }
      if (['--ref', '--evidence', '--json'].includes(args[i]) && args[i + 1]) options[args[i].slice(2)] = args[++i];
      else throw Error('Invalid checker options.');
    }
    let reader = createSourceReader({ ref: options.ref });
    if (refresh) { refreshContracts({ reader }); reader = createSourceReader({ ref: options.ref }); }
    const evidence = options.evidence ? parse(readFileSync(resolve(options.evidence), 'utf8')) : undefined;
    const { assurance } = verifySystemMap({ reader, evidence });
    if (options.json) writeFileSync(resolve(options.json), JSON.stringify(assurance, null, 2) + '\n');
    console.log(JSON.stringify(summarizeAssurance(assurance)));
    if (assurance.errors.length) process.exitCode = 1;
  } catch { console.error('System map check could not read the selected catalog/version or options.'); process.exitCode = 1; }
}
