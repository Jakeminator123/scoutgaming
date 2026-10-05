import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve, relative, basename } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createSourceReader, verifySystemMap, refreshContracts, captureSystemMapInputs, isolatedGitEnvironment, hashText, summarizeAssurance, parseSqlTables } from '../docs/system-map/verify.mjs';
import { importTestEvidence, reportTestFiles, captureEvidenceInputs } from '../tools/system-map-evidence.mjs';
import { buildSystemMap } from '../docs/system-map/build.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const A = 'a'.repeat(40), B = 'b'.repeat(40);
const sql = 'ops/neon-studio/001-example.sql', route = 'apps/croupier-frontend/app/example/route.ts';
function fixture(t) {
  const root = mkdtempSync(resolve(tmpdir(), 'croupier-system-map-'));
  const put = (path, value) => { mkdirSync(dirname(resolve(root, path)), { recursive: true }); writeFileSync(resolve(root, path), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n'); };
  const get = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
  t.after(() => {
    assert.match(basename(root), /^croupier-system-map-/);
    assert.equal(dirname(root).toLowerCase(), resolve(tmpdir()).toLowerCase());
    rmSync(root, { recursive: true, force: true });
  });
  put('docs/system-map/catalog.json', { sourceSha: A, services: [{ id: 'frontend' }], connections: [] });
  put('docs/system-map/routes.json', { sourceSha: A, pages: [], apiGroups: [], sourceRoutes: [{ id: 'frontend-example', app: 'frontend', path: '/example', methods: ['GET'], handlerFile: route }] });
  put('docs/system-map/storage.json', { sourceSha: A, tables: [{ schema: 'croupier_studio', name: 'documents', columns: [{ name: 'id', dataType: 'text', nullable: false }],
    primaryKey: { columns: ['id'] }, foreignKeys: [], sources: [{ path: sql }] }], sqlContractCatalog: { sources: [{ path: sql }] } });
  put('docs/system-map/flows.json', { sourceSha: A, flows: [{ id: 'game' }] });
  put('docs/environment-variables.json', { schema: 1, services: { runtime: { sources: ['web/env.mjs'], required: ['NODE_ENV'], firstBoot: [], conditional: [], managed: [], blocked: [] } } });
  put(route, 'export function GET() {}\n');
  put(sql, 'CREATE TABLE croupier_studio.documents (id text PRIMARY KEY);\n');
  put('web/env.mjs', 'export const mode = process.env.NODE_ENV;\n');
  put('web/events.mjs', 'export class Round { run() { this.emit("card.dealt"); } }\n');
  put('test/known.mjs', 'import test from "node:test"; test("fixture", () => {});\n');
  put('tools/system-map-evidence.mjs', '// Explicit source input of the evidence importer.\n');
  put('docs/system-map/verify.mjs', '// Explicit verifier input.\n');
  put('docs/system-map/build.mjs', '// Explicit builder input.\n');
  const definition = (id, sources, checks) => ({ id, label: id, serviceIds: ['frontend'], targets: [], sources, tests: ['test/known.mjs'], checks, expectedHashes: {} });
  put('docs/system-map/contracts.json', { schemaVersion: 1, contracts: [
    definition('routes', [], [{ type: 'next-routes', app: 'frontend' }]),
    definition('schema', [], [{ type: 'schema', schema: 'croupier_studio' }]),
    definition('environment', ['docs/environment-variables.json'], [{ type: 'environment', service: 'runtime' }]),
    definition('events', ['web/events.mjs'], [{ type: 'events', path: 'web/events.mjs', names: ['card.dealt'] }]),
  ] });
  const reader = () => createSourceReader({ repositoryRoot: root });
  refreshContracts({ reader: reader() });
  // Pure verifier fixtures simulate an already frozen tree; the separate Git
  // fixture below exercises actual object reads and contaminated GIT_* state.
  const frozen = () => Object.assign(reader(), { currentSha: A, mode: 'git-tree', commitMatched: () => true });
  const snapshot = () => captureSystemMapInputs({ reader: frozen() });
  const evidence = result => ({ schemaVersion: 1, kind: 'explicit-ci-test-files', sourceSha: A, observedAt: '2026-10-05T00:00:00Z',
    hashAlgorithm: 'sha256:utf8-lf',
    files: snapshot().files, tests: [{ path: 'test/known.mjs', result: result || 'passed' }], ciUrl: 'https://github.com/Jakeminator123/github-work/actions/runs/123' });
  const check = input => verifySystemMap({ reader: frozen(), evidence: input }).assurance;
  return { root, put, get, reader, frozen, snapshot, evidence, check };
}

test('missing CI evidence remains grey; successful overall jobs do not invent individual passes', t => {
  const f = fixture(t), empty = f.evidence(); empty.tests = []; empty.jobs = [{ conclusion: 'success' }];
  for (const input of [undefined, empty]) {
    const result = f.check(input);
    assert.equal(result.status, 'grey'); assert.equal(result.errors.length, 0);
    assert.ok(result.contracts.every(row => row.tests[0].result === 'not-read'));
  }
});
test('green requires explicit passing test files, current facts, SHA and matching declared input hashes', t => {
  const f = fixture(t), result = f.check(f.evidence());
  assert.equal(result.status, 'green'); assert.equal(result.counts.green, 4);
  assert.ok(result.contracts.every(row => row.verification.sha === A && row.verification.result === 'passed'));
  assert.equal(result.runtimeVerified, false);
});
test('incomplete or unsupported evidence metadata cannot produce green tests', t => {
  const f = fixture(t);
  for (const alter of [artifact => delete artifact.hashAlgorithm, artifact => artifact.hashAlgorithm = 'unknown',
    artifact => artifact.files['test/known.mjs'] = 'invalid-hash']) {
    const evidence = f.evidence(); alter(evidence);
    const result = f.check(evidence);
    assert.equal(result.status, 'grey'); assert.ok(result.warnings.some(row => row.code === 'evidence.unusable'));
  }
});
test('stale successful or failed evidence is yellow, not an exact-version failure', t => {
  const f = fixture(t);
  for (const result of ['passed', 'failed']) {
    const stale = f.evidence(result); stale.sourceSha = B;
    const assurance = f.check(stale);
    assert.equal(assurance.status, 'yellow'); assert.equal(assurance.errors.length, 0);
    assert.ok(assurance.contracts.every(row => row.tests[0].result === 'stale'));
  }
});
test('a relevant exact-version test failure is red and blocks --check', t => {
  const f = fixture(t), result = f.check(f.evidence('failed'));
  assert.equal(result.status, 'red');
  assert.ok(result.errors.some(row => row.code === 'test.failed' && row.path === 'test/known.mjs'));
});
test('source change invalidates only related contract evidence', t => {
  const f = fixture(t), evidence = f.evidence();
  f.put('web/events.mjs', 'export class Round { run() { this.emit("card.dealt"); this.emit("new.event"); } }\n');
  const result = f.check(evidence);
  assert.equal(result.contracts.find(row => row.id === 'events').status, 'yellow');
  assert.ok(result.contracts.filter(row => row.id !== 'events').every(row => row.status === 'green'));
  assert.ok(result.changedInputs.includes('web/events.mjs'));
});
test('changed fact metadata or checker code cannot reuse old exact-SHA evidence', t => {
  const f = fixture(t), evidence = f.evidence();
  const routes = f.get('docs/system-map/routes.json'); routes.sourceRoutes[0].label = 'Updated route description';
  f.put('docs/system-map/routes.json', routes);
  let result = f.check(evidence);
  assert.equal(result.contracts.find(row => row.id === 'routes').status, 'yellow');
  assert.ok(result.contracts.filter(row => row.id !== 'routes').every(row => row.status === 'green'));
  f.put('docs/system-map/verify.mjs', '// Changed verifier after the test artifact was captured.\n');
  result = f.check(evidence);
  assert.ok(result.contracts.every(row => row.tests[0].result === 'stale'));
});
test('missing registered reference and duplicate catalog identities are hard fact errors', t => {
  const f = fixture(t);
  const catalog = f.get('docs/system-map/catalog.json');
  catalog.services[0].sources = ['web/missing.mjs']; catalog.services.push({ id: 'frontend' });
  f.put('docs/system-map/catalog.json', catalog);
  const result = f.check();
  assert.equal(result.status, 'red');
  assert.ok(result.errors.some(row => row.code === 'catalog.missing-reference' && row.path === 'web/missing.mjs'));
  assert.ok(result.errors.some(row => row.code === 'catalog.duplicate'));
});
test('new selected route and changed HTTP exports warn with exact file and URL', t => {
  const f = fixture(t);
  f.put('apps/croupier-frontend/app/new/route.ts', 'export async function PATCH() {}\n');
  f.put('apps/croupier-frontend/app/new-js/route.js', 'export async function GET() {}\n');
  f.put('apps/croupier-frontend/app/new-page/page.jsx', 'export default function Page() {}\n');
  f.put(route, 'export async function POST() {}\n');
  const result = f.check(), contract = result.contracts.find(row => row.id === 'routes');
  assert.equal(contract.status, 'yellow'); assert.equal(result.errors.length, 0);
  assert.ok(contract.warnings.some(row => row.code === 'route.uninventoried' && row.message.includes('/new')));
  assert.ok(contract.warnings.some(row => row.path?.endsWith('/new-js/route.js')));
  assert.ok(contract.warnings.some(row => row.path?.endsWith('/new-page/page.jsx')));
  assert.ok(contract.warnings.some(row => row.code === 'route.method-drift' && row.path === route));
});
test('new SQL column is yellow; catalog update plus rebaseline and fresh tests can become green', t => {
  const f = fixture(t), previous = f.evidence();
  f.put(sql, 'CREATE TABLE croupier_studio.documents (id text PRIMARY KEY, revision bigint NOT NULL);\n');
  let result = f.check(previous), contract = result.contracts.find(row => row.id === 'schema');
  assert.equal(contract.status, 'yellow'); assert.equal(result.errors.length, 0);
  assert.ok(contract.warnings.some(row => row.code === 'schema.uninventoried-column' && row.message.includes('documents.revision')));
  const data = f.get('docs/system-map/storage.json'); data.tables[0].columns.push({ name: 'revision', dataType: 'bigint', nullable: false });
  f.put('docs/system-map/storage.json', data);
  refreshContracts({ reader: f.reader() });
  result = f.check(f.evidence());
  assert.equal(result.status, 'green', 'an intentional, documented and tested schema update has no arbitrary permanent gate');
});
test('new migration ADD COLUMN and unlisted SQL file produce bounded warnings', t => {
  const f = fixture(t);
  f.put('ops/neon-studio/002-new.sql', 'ALTER TABLE croupier_studio.documents ADD COLUMN note text;\n');
  const result = f.check(), contract = result.contracts.find(row => row.id === 'schema');
  assert.equal(result.errors.length, 0);
  assert.ok(contract.warnings.some(row => row.code === 'schema.uninventoried-source'));
  assert.ok(contract.warnings.some(row => row.code === 'schema.uninventoried-column' && row.message.includes('documents.note')));
});
test('existing multiline JSON constraints do not hide declared SQL columns', () => {
  const parsed = parseSqlTables(`CREATE TABLE croupier_studio.media_records (
    id uuid PRIMARY KEY,
    record jsonb NOT NULL CHECK (jsonb_typeof(record) = 'object'
      AND record->>'id' = id::text),
    updated_at timestamptz NOT NULL DEFAULT now()
  );`, sql);
  assert.deepEqual(parsed.tables[0].columns.map(column => column.name), ['id', 'record', 'updated_at']);
  assert.deepEqual(parsed.tables[0].columns[1], { name: 'record', dataType: 'jsonb', nullable: false });
});
test('duplicate columns and broken foreign key references are invalid catalogs', t => {
  const f = fixture(t), data = f.get('docs/system-map/storage.json');
  data.tables[0].columns.push(data.tables[0].columns[0]);
  data.tables[0].foreignKeys = [{ columns: ['id'], references: { schema: 'croupier_studio', table: 'missing', columns: ['id'] } }];
  f.put('docs/system-map/storage.json', data);
  const result = f.check();
  assert.equal(result.status, 'red');
  assert.ok(result.errors.some(row => row.code === 'schema.duplicate-column'));
  assert.ok(result.errors.some(row => row.code === 'schema.invalid-foreign-key'));
});
test('env-name and event warnings expose names and source paths, never values', t => {
  const f = fixture(t);
  f.put('web/env.mjs', 'const privateValue = "DO_NOT_PUBLISH_VALUE"; export const mode=process.env.NEW_REQUIRED_NAME;\n');
  const result = f.check(), text = JSON.stringify(result);
  assert.ok(text.includes('NEW_REQUIRED_NAME')); assert.equal(text.includes('DO_NOT_PUBLISH_VALUE'), false);
  assert.ok(result.contracts.find(row => row.id === 'environment').warnings.some(row => row.code === 'environment.unlisted-name'));
});

test('evidence importer cannot promote filtered or incomplete runs, or job success, to file pass', t => {
  const f = fixture(t), snapshot = f.snapshot();
  const receipt = selection => [
    { type: 'meta', schemaVersion: 1, selection }, { type: 'test-file', path: 'test/known.mjs', result: 'passed', ignoredPrivate: 'DO_NOT_PUBLISH_VALUE' },
    { type: 'summary', counts: { passed: 1, tests: 1, failed: 0 } },
  ].map(JSON.stringify).join('\n');
  let evidence = importTestEvidence({ snapshot, reports: [receipt('filtered')] });
  assert.equal(evidence.tests[0].result, 'skipped'); assert.equal(f.check(evidence).status, 'grey');
  evidence = importTestEvidence({ snapshot, reports: [receipt('full-files').split('\n').slice(0, 2).join('\n')], jobs: { jobs: [{ name: 'dealer-regression', status: 'completed', conclusion: 'success', head_sha: A }] } });
  assert.deepEqual(evidence.tests, []); assert.equal(f.check(evidence).status, 'grey');
  evidence = importTestEvidence({ snapshot, reports: [receipt('full-files')] });
  assert.equal(f.check(evidence).status, 'green'); assert.equal(JSON.stringify(evidence).includes('DO_NOT_PUBLISH_VALUE'), false);
});
test('passive reporter masks names/errors and refuses files outside its source root', async () => {
  const events = [
    { type: 'test:pass', data: { file: resolve(ROOT, 'test/system-map.mjs'), name: 'DO_NOT_PUBLISH_VALUE' } },
    { type: 'test:fail', data: { file: resolve(tmpdir(), 'outside.mjs'), details: { error: 'DO_NOT_PUBLISH_VALUE' } } },
    { type: 'test:summary', data: { counts: { passed: 1, failed: 1, tests: 2 } } },
  ];
  let text = ''; for await (const chunk of reportTestFiles(events, { repositoryRoot: ROOT, args: ['--test-name-pattern=fixture'] })) text += chunk;
  assert.equal(text.includes('DO_NOT_PUBLISH_VALUE'), false);
  assert.ok(text.includes('"selection":"filtered"')); assert.ok(text.includes('"path":null'));
});
test('the reporter works with an existing real Node test run and captures complete files', t => {
  const f = fixture(t), reporter = resolve(ROOT, 'tools/system-map-evidence.mjs');
  const env = { ...isolatedGitEnvironment(), GITHUB_WORKSPACE: f.root }; delete env.NODE_TEST_CONTEXT;
  const output = execFileSync(process.execPath, ['--test', '--test-concurrency=4', '--test-reporter=' + pathToFileURL(reporter).href, 'test/known.mjs'], {
    cwd: f.root, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const evidence = importTestEvidence({ snapshot: f.snapshot(), reports: [output] });
  assert.equal(evidence.tests.find(row => row.path === 'test/known.mjs')?.result, 'passed');
  assert.equal(f.check(evidence).status, 'green');
});
test('cancelled summary prevents earlier subtest passes from verifying a file', t => {
  const f = fixture(t), snapshot = f.snapshot();
  const receipt = [
    { type: 'meta', schemaVersion: 1, selection: 'full-files' },
    { type: 'test-file', path: 'test/known.mjs', result: 'passed' },
    { type: 'summary', counts: { passed: 1, cancelled: 1, tests: 2 } },
  ].map(JSON.stringify).join('\n');
  const evidence = importTestEvidence({ snapshot, reports: [receipt] });
  assert.equal(evidence.tests[0].result, 'cancelled'); assert.equal(f.check(evidence).status, 'grey');
  const incomplete = receipt.replace('"type":"summary"', '"type":"summary","path":"test/known.mjs"');
  assert.deepEqual(importTestEvidence({ snapshot, reports: [incomplete] }).tests, []);
});
test('real Node cancellation remains grey after a passing subtest', t => {
  const f = fixture(t), reporter = pathToFileURL(resolve(ROOT, 'tools/system-map-evidence.mjs')).href;
  f.put('test/known.mjs', 'import test from "node:test"; test("passed",()=>{}); test("cancelled",async()=>await new Promise(()=>{}));\n');
  refreshContracts({ reader: f.reader() });
  const env = { ...isolatedGitEnvironment(), GITHUB_WORKSPACE: f.root }; delete env.NODE_TEST_CONTEXT;
  const run = spawnSync(process.execPath, ['--test', '--test-concurrency=4', '--test-reporter=' + reporter, 'test/known.mjs'], {
    cwd: f.root, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  assert.equal(run.status, 1);
  const evidence = importTestEvidence({ snapshot: f.snapshot(), reports: [run.stdout] });
  assert.equal(evidence.tests[0].result, 'cancelled'); assert.equal(f.check(evidence).status, 'grey');
});
test('CLI summaries bound warnings and omit the full file/hash inventory', t => {
  const f = fixture(t);
  for (let i = 0; i < 20; i++) f.put(`apps/croupier-frontend/app/new${i}/route.ts`, 'export function GET() {}\n');
  const summary = summarizeAssurance(f.check());
  assert.equal(summary.status, 'yellow'); assert.equal(summary.warnings.length, 12); assert.ok(summary.omittedWarnings > 0);
  assert.equal('files' in summary, false); assert.equal('contracts' in summary, false);
});
test('offline builder is import-safe, escapes embedded JSON and supports non-writing --check', t => {
  const f = fixture(t), target = resolve(f.root, 'docs/system-map/index.html');
  f.put('docs/system-map/index.html', '<script id="system-data" type="application/json">{}</script>');
  const original = readFileSync(target, 'utf8');
  const result = buildSystemMap({ repositoryRoot: f.root, check: true });
  assert.equal(result.written, false); assert.equal(readFileSync(target, 'utf8'), original);
  const catalog = f.get('docs/system-map/catalog.json'); catalog.title = '</script><script>ignored</script>';
  f.put('docs/system-map/catalog.json', catalog);
  buildSystemMap({ repositoryRoot: f.root });
  const html = readFileSync(target, 'utf8');
  assert.equal(html.includes('</script><script>ignored'), false); assert.ok(html.includes('\\u003c'));
});
test('offline builder embeds a valid red test result but refuses a structurally broken catalog', t => {
  const f = fixture(t), target = resolve(f.root, 'docs/system-map/index.html');
  f.put('docs/system-map/index.html', '<script id="system-data" type="application/json">{}</script>');
  const result = buildSystemMap({ repositoryRoot: f.root, reader: f.frozen(), evidence: f.evidence('failed') });
  assert.equal(result.assurance.status, 'red'); assert.equal(result.written, true);
  assert.ok(readFileSync(target, 'utf8').includes('"code":"test.failed"'));
  const before = readFileSync(target, 'utf8'), catalog = f.get('docs/system-map/catalog.json');
  catalog.services.push({ id: 'frontend' }); f.put('docs/system-map/catalog.json', catalog);
  const invalid = buildSystemMap({ repositoryRoot: f.root, reader: f.frozen() });
  assert.equal(invalid.written, false); assert.equal(readFileSync(target, 'utf8'), before);
});

test('Git --ref reads frozen committed bytes, ignores dirty worktree, and isolates inherited GIT_*', t => {
  const f = fixture(t), gitEnv = isolatedGitEnvironment();
  const git = args => execFileSync('git', args, { cwd: f.root, env: gitEnv, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  try { git(['--version']); } catch { t.skip('Local Git unavailable for the isolated object-read fixture.'); return; }
  git(['init', '-q', '-b', 'main']); git(['add', '.']);
  git(['-c', 'user.name=System Map Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'isolated fixture']);
  const sha = git(['rev-parse', 'HEAD']), snapshot = captureEvidenceInputs({ repositoryRoot: f.root, ref: sha });
  const evidence = { schemaVersion: 1, kind: 'explicit-ci-test-files', sourceSha: sha, observedAt: '2026-10-05T00:00:00Z',
    hashAlgorithm: snapshot.hashAlgorithm, files: snapshot.files, tests: [{ path: 'test/known.mjs', result: 'passed' }] };
  f.put(route, 'export function POST() {}\n');
  const previous = { dir: process.env.GIT_DIR, tree: process.env.GIT_WORK_TREE, index: process.env.GIT_INDEX_FILE };
  try {
    process.env.GIT_DIR = resolve(ROOT, '.git'); process.env.GIT_WORK_TREE = ROOT; process.env.GIT_INDEX_FILE = resolve(ROOT, '.git/index');
    const committed = createSourceReader({ repositoryRoot: f.root, ref: sha });
    assert.equal(committed.currentSha, sha); assert.ok(committed.read(route).includes('GET'));
    assert.equal(verifySystemMap({ reader: committed, evidence }).assurance.status, 'green');
    const working = createSourceReader({ repositoryRoot: f.root }), result = verifySystemMap({ reader: working, evidence }).assurance;
    assert.equal(result.sourceView, 'working-tree'); assert.equal(result.status, 'yellow');
    assert.equal(result.files.find(row => row.path === route).commitMatched, false);
    const stale = { ...evidence, sourceSha: B };
    assert.equal(verifySystemMap({ reader: committed, evidence: stale }).assurance.status, 'yellow');
    assert.equal(hashText('same\r\n'), hashText('same\n'), 'Windows text checkout is normalized explicitly');
  } finally {
    for (const [key, value] of [['GIT_DIR', previous.dir], ['GIT_WORK_TREE', previous.tree], ['GIT_INDEX_FILE', previous.index]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
