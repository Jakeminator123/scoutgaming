import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudioAdminApi } from '../lib/studio-admin-api.mjs';
import { createSeedProject } from '../lib/studio-model.mjs';
import { createOperatorPackageApi, fixtureLaneOperators, openWritableOperatorStore } from '../lib/operator-package-api.mjs';
import { createOperatorStore } from '../../web/storage/operator-store.mjs';

const origin = 'https://studio.example';
const scope = { environment: 'isolated-fixture', workspaceId: 'qa' };
const session = { user: 'lane-actor', role: 'admin', scope };
const clock = () => 1_700_000_000_000;

function memoryPool() {
  const tables = { operators: [], operator_packages: [] };
  const pgError = code => Object.assign(new Error('fixture'), { code });
  async function query(text, values = []) {
    const tag = /\/\* operator-store:([a-z-]+) \*\//.exec(text)?.[1];
    const [environment, workspace] = values;
    const scoped = name => tables[name].filter(row => row.environment_id === environment && row.workspace_id === workspace);
    if (tag === 'list-operators') return { rows: scoped('operators').sort((a, b) => a.slug.localeCompare(b.slug)) };
    if (tag === 'create-operator') {
      if (scoped('operators').some(row => row.operator_id === values[2] || row.slug === values[3])) throw pgError('23505');
      const row = { environment_id: environment, workspace_id: workspace, operator_id: values[2], slug: values[3], name: values[4], status: values[5], created_at_ms: values[6] };
      tables.operators.push(row);
      return { rows: [row] };
    }
    if (tag === 'publish-package') {
      if (!scoped('operators').some(row => row.operator_id === values[2])) throw pgError('23503');
      const revision = scoped('operator_packages').filter(row => row.operator_id === values[2]).reduce((max, row) => Math.max(max, Number(row.package_revision)), 0) + 1;
      const row = { environment_id: environment, workspace_id: workspace, operator_id: values[2], package_revision: revision, lanes: values[3], games: values[4], tables: values[5], branding: values[6], published_at_ms: values[7] };
      tables.operator_packages.push(row);
      return { rows: [row] };
    }
    if (tag === 'current-package') {
      const rows = scoped('operator_packages').filter(row => row.operator_id === values[2]).sort((a, b) => b.package_revision - a.package_revision).slice(0, 1);
      return { rows };
    }
    throw new Error(`untagged query: ${text}`);
  }
  const pool = { query, async connect() { return { query, release() {} }; } };
  return pool;
}

function apiFor(pool, project = createSeedProject(), storeFactory) {
  const lane = createOperatorPackageApi({ pool, scope, project, now: clock, storeFactory });
  const api = createStudioAdminApi({
    authorize: async () => session,
    mutationTransaction: work => work(),
    allowedOrigins: [origin],
    publicHosts: ['studio.example'],
    handlers: lane.handlers,
  });
  return { api, lane };
}

function request(action, body, headers = {}) {
  return new Request(`${origin}/studio/api/admin/${action}`, {
    method: 'POST',
    headers: { origin, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

test('fixture keeps demo-north, demo-south and SG test', () => {
  const operators = fixtureLaneOperators();
  assert.deepEqual(operators.map(item => item.slug), ['demo-north', 'demo-south', 'sg-test']);
  assert.deepEqual(operators.find(item => item.slug === 'sg-test'), { id: 'sg-test', slug: 'sg-test', name: 'SG test game provider' });
});

test('a pool with connect is the store client; query-only is 503', async () => {
  const pool = memoryPool();
  let seen;
  const storeFactory = options => { seen = options; return createOperatorStore(options); };
  const opened = await openWritableOperatorStore({ pool, scope, now: clock, storeFactory });
  assert.equal(seen.sql, pool);
  assert.equal(typeof pool.connect, 'function');
  assert.equal(typeof opened.listOperators, 'function');
  await assert.rejects(
    openWritableOperatorStore({ pool: { query: pool.query }, scope, now: clock, storeFactory }),
    error => error.statusCode === 503,
  );
  assert.equal(seen.sql, pool);
});

test('admin POST uses the session actor, refuses a query-only pool, and keeps the Origin gate', async () => {
  const pool = memoryPool();
  let actor;
  const storeFactory = async options => {
    assert.equal(options.sql, pool);
    const store = await createOperatorStore(options);
    return {
      createOperator: input => { actor = input.actor; return store.createOperator(input); },
      publishPackage: input => { actor = input.actor; return store.publishPackage(input); },
      listOperators: () => store.listOperators(),
    };
  };
  const { api } = apiFor(pool, createSeedProject(), storeFactory);
  const missingOrigin = new Request(`${origin}/studio/api/admin/operator-create-demo`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' }, body: '{}',
  });
  assert.equal((await api.handle(missingOrigin)).status, 403);
  assert.equal(actor, undefined);
  const created = await api.handle(request('operator-create-demo', {}));
  assert.equal(created.status, 200);
  assert.equal(actor, 'lane-actor');
  assert.equal((await created.json()).operator.id, 'sg-test');
  const duplicate = await api.handle(request('operator-create-demo', {}));
  assert.equal(duplicate.status, 409);

  const queryOnly = apiFor({ query: pool.query });
  assert.equal((await queryOnly.api.handle(request('operator-create-demo', {}))).status, 503);
});

test('publishing increases package_revision and an unknown lane id is 422', async () => {
  const pool = memoryPool();
  const { api } = apiFor(pool);
  assert.equal((await api.handle(request('operator-create-demo', {}))).status, 200);
  const first = await api.handle(request('operator-package', { operatorId: 'sg-test', lanes: ['mobile-phone'] }));
  assert.equal(first.status, 200);
  const firstBody = await first.json();
  assert.equal(firstBody.package_revision, 1);
  assert.deepEqual(firstBody.games, ['blackjack']);
  assert.deepEqual(firstBody.tables, []);
  const second = await api.handle(request('operator-package', { operatorId: 'sg-test', lanes: ['mobile-phone'] }));
  assert.equal((await second.json()).package_revision, 2);
  const rejected = await api.handle(request('operator-package', { operatorId: 'sg-test', lanes: ['not-a-lane'] }));
  assert.equal(rejected.status, 422);
  const current = await (await createOperatorStore({ sql: pool, scope, now: clock })).getCurrentPackage('sg-test');
  assert.equal(current.revision, 2);
});

test('an empty project.lanes list accepts only the default mobile-phone lane', async () => {
  const project = createSeedProject();
  project.lanes = [];
  const { api } = apiFor(memoryPool(), project);
  await api.handle(request('operator-create-demo', {}));
  assert.equal((await api.handle(request('operator-package', { operatorId: 'sg-test', lanes: ['vip-table'] }))).status, 422);
  assert.equal((await api.handle(request('operator-package', { operatorId: 'sg-test', lanes: ['mobile-phone'] }))).status, 200);
});
