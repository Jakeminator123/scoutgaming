import test from 'node:test';
import assert from 'node:assert/strict';
import { hashText, safeCiUrl, verifySystemMap } from '../docs/system-map/verify.mjs';

const SHA = 'a'.repeat(40);
const ROUTE = 'apps/croupier-frontend/app/play/page.tsx';

function check(sourceRoutes, files) {
  const documents = {
    'docs/system-map/catalog.json': { sourceSha: SHA, services: [{ id: 'frontend' }], connections: [] },
    'docs/system-map/routes.json': { sourceSha: SHA, pages: [{ id: 'player-area' }], apiGroups: [], sourceRoutes },
    'docs/system-map/storage.json': { sourceSha: SHA, tables: [] },
    'docs/system-map/flows.json': { sourceSha: SHA, flows: [{ id: 'game' }] },
    'docs/environment-variables.json': {
      schema: 1,
      services: { runtime: { sources: [], required: [], firstBoot: [], conditional: [], managed: [], blocked: [] } },
    },
    ...files,
  };
  const encoded = Object.fromEntries(Object.entries(documents).map(([path, value]) => [path, typeof value === 'string' ? value : JSON.stringify(value)]));
  const inputs = ['docs/system-map/catalog.json', 'docs/system-map/routes.json', ...Object.keys(files)];
  const expectedHashes = Object.fromEntries(inputs.map(path => [path, hashText(encoded[path])]));
  encoded['docs/system-map/contracts.json'] = JSON.stringify({
    schemaVersion: 1,
    contracts: [{
      id: 'routes.frontend', label: 'Frontend routes', serviceIds: ['frontend'], targets: [], sources: [], tests: [],
      checks: [{ type: 'next-routes', app: 'frontend' }], expectedHashes,
    }],
  });
  return verifySystemMap({
    reader: {
      root: 'memory', currentSha: SHA, mode: 'working-tree',
      read: path => Object.hasOwn(encoded, path) ? encoded[path] : null,
      list: prefix => Object.keys(encoded).filter(path => path.startsWith(prefix + '/')).sort(),
      commitMatched: () => true,
    },
  }).assurance;
}

test('an uninventoried Next route is an error and the map is red', () => {
  const assurance = check([], { [ROUTE]: 'export default function Page() {}\n' });
  assert.equal(assurance.status, 'red');
  assert.ok(assurance.errors.some(row => row.code === 'route.uninventoried' && row.path === ROUTE));
});

test('map accepts CI run links for the current and the previous repository name only', () => {
  for (const url of ['https://github.com/Jakeminator123/scoutgaming/actions/runs/37598077333',
    'https://github.com/Jakeminator123/scoutgaming/actions/runs/1/attempts/2/job/3',
    'https://github.com/Jakeminator123/github-work/actions/runs/123']) assert.equal(safeCiUrl(url), url);
  for (const url of ['https://github.com/Jakeminator123/other/actions/runs/1', 'https://github.com/Jakeminator123/scoutgaming/pull/1',
    'http://github.com/Jakeminator123/scoutgaming/actions/runs/1', 'https://github.com/Jakeminator123/scoutgaming/actions/runs/1?token=x', 42, null]) {
    assert.equal(safeCiUrl(url), null, String(url));
  }
});

test('a fully inventoried route fixture has no route error', () => {
  const assurance = check(
    [{ id: 'frontend-play', app: 'frontend', path: '/play', methods: [], handlerFile: ROUTE }],
    { [ROUTE]: 'export default function Page() {}\n' },
  );
  assert.notEqual(assurance.status, 'red');
  assert.equal(assurance.errors.length, 0);
  assert.equal(assurance.contracts[0].warnings.some(row => row.code.startsWith('route.')), false);
});
