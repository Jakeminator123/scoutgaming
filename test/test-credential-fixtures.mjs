import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { fixtureDatabaseUrl } from './fixtures/database-url.mjs';
import { checkTestCredentials, findNeonCredentialLiterals } from '../tools/check-test-credentials.mjs';

test('database fixtures preserve validation fields but never reuse a password', () => {
  const base = 'postgres://ep-example.neon.tech/croupier?sslmode=require';
  const first = new URL(fixtureDatabaseUrl(base,'migrator'));
  const second = new URL(fixtureDatabaseUrl(base,'migrator'));
  assert.equal(first.protocol,'postgres:');
  assert.equal(first.hostname,'ep-example.neon.tech');
  assert.equal(first.pathname,'/croupier');
  assert.equal(first.username,'migrator');
  assert.equal(first.searchParams.get('sslmode'),'require');
  assert.ok(first.password.length >= 32);
  assert.notEqual(first.password,second.password);
  assert.throws(() => fixtureDatabaseUrl('https://example.invalid/db'), /credential_free_postgres_base/);
  assert.throws(() => fixtureDatabaseUrl(first.href), /credential_free_postgres_base/);
});

test('the guard reports only locations for credential-bearing Neon literals', () => {
  const fixture = fixtureDatabaseUrl();
  for (const scheme of ['postgres:', 'postgresql:', 'POSTGRESQL:']) {
    const source = 'first line\nconst url = ' + JSON.stringify(fixture.replace('postgresql:',scheme)) + ';';
    const findings = findNeonCredentialLiterals(source);
    assert.deepEqual(findings,[{line:2,code:'static_neon_test_credentials'}]);
    assert.equal(JSON.stringify(findings).includes(new URL(fixture).password),false);
  }
  assert.deepEqual(findNeonCredentialLiterals('postgresql://fixture.neon.tech/fixture'),[]);
});

test('repository test sources contain no static Neon credential URLs', () => {
  const root = fileURLToPath(new URL('../',import.meta.url));
  assert.deepEqual(checkTestCredentials(root), [], 'Use test/fixtures/database-url.mjs with an injected pool; do not suppress the security scanner.');
});
