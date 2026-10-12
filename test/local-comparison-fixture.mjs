import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:net';
import { createHmac } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startLocalComparison } from '../tools/start-local-comparison.mjs';

async function freePort(host) {
  const server = createServer();
  await new Promise(resolve => server.listen(0, host, resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

test('comparison keeps isolated BO/Partner data and refuses a game without a published presentation', async t => {
  const gamePort = await freePort('localhost'), labPort = await freePort('127.0.0.1');
  const repoRoot = await mkdtemp(join(tmpdir(), 'croupier-comparison-repo-test-'));
  await symlink(fileURLToPath(new URL('../web/', import.meta.url)), join(repoRoot, 'web'), process.platform === 'win32' ? 'junction' : 'dir');
  t.after(() => rm(repoRoot, { recursive: true, force: true }));
  const fixture = await startLocalComparison({ repoRoot, startLab: false, gamePort, labPort });
  const post = (path, body, headers = {}) => fetch(fixture.gameUrl + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: fixture.gameUrl, ...headers }, body: JSON.stringify(body),
  });
  try {
    assert.ok(fixture.gameUrl.startsWith('http://localhost:'));
    assert.ok(fixture.labUrl.startsWith('http://127.0.0.1:'));
    for (const name of ['game','original','v2']) {
      assert.equal(new URL(fixture.urls[name]).searchParams.get('rehearsal'),'1');
      const response = await fetch(fixture.urls[name]);
      assert.equal(response.status,503);
      const html = await response.text();
      assert.match(html,/<h1>Ingen presentation vald<\/h1>/);
      assert.match(html,/Starta ett publicerat bord/);
      assert.doesNotMatch(html,/<video|<script|data-game-entry/);
    }
    const partner = fixture.credentials.partner;
    const ts = String(Math.floor(Date.now() / 1000)), body = '{}', path = '/api/v1/ping';
    const response = await post(path, {}, {
      'X-Api-Key': partner.keyId, 'X-Timestamp': ts,
      'X-Signature': createHmac('sha256', partner.secret).update(`${ts}.POST.${path}.${body}`).digest('hex'),
    });
    assert.deepEqual((await response.json()).scopes, ['launch', 'events']);
    const launch = await fetch(partner.launchUrl, { redirect: 'manual' });
    assert.equal(launch.status, 303);
    const cookie = launch.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
    const player = await (await post('/api/player', {}, { Cookie: cookie })).json();
    assert.equal(player.id, partner.playerRef);
    assert.equal(player.balance, 1000);
    const mapping = await fetch(fixture.gameUrl + '/api/v1/generations/mapping', { headers: { Authorization: `Bearer ${fixture.credentials.generations.token}` } });
    assert.equal(mapping.status, 200);
    assert.equal((await mapping.json()).actualPlayback, false);
    assert.ok(!JSON.stringify(fixture).includes(fixture.bo.password));
    assert.ok(!JSON.stringify(fixture).includes(partner.secret));
  } finally { await fixture.stop(); }
  assert.equal(existsSync(fixture.runDir), false);
  await assert.rejects(fixture.startLab(), /stopped/);
});

test('comparison child guard blocks env-file reads and non-fixture fetch/TCP before IO', () => {
  const guard = new URL('../tools/start-local-comparison.mjs', import.meta.url).href;
  const program = `
    import assert from 'node:assert/strict';
    import {readFileSync} from 'node:fs';
    import {Socket} from 'node:net';
    import {installComparisonProcessGuard} from ${JSON.stringify(guard)};
    installComparisonProcessGuard();
    assert.throws(()=>readFileSync('.env'),error=>error.code==='ENOENT');
    await assert.rejects(fetch('https://example.invalid/'),error=>error.code==='QA_NETWORK_BLOCKED');
    assert.throws(()=>new Socket().connect({host:'203.0.113.1',port:443}),error=>error.code==='QA_NETWORK_BLOCKED');
    assert.throws(()=>new Socket().connect({host:'localhost',port:3100}),error=>error.code==='QA_NETWORK_BLOCKED');
    console.log('isolated guard passed');
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', program], {
    windowsHide: true, encoding: 'utf8', env: { CROUPIER_QA_ALLOWED_PORTS: '4192,4194' }, timeout: 15000,
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /isolated guard passed/);
});
