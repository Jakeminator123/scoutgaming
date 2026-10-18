import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {once} from 'node:events';
import {mkdtemp, rm} from 'node:fs/promises';
import {createServer} from 'node:net';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {clipMapping} from '../services/game/clip-mapping.mjs';

const repository = fileURLToPath(new URL('../', import.meta.url));
const token = 'isolated-clip-mapping-fixture';
const headers = {authorization: `Bearer ${token}`};

async function gameServer(t, cloudRuntime = false) {
  const directory = await mkdtemp(join(tmpdir(), 'croupier-clip-mapping-'));
  const listener = createServer();
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const port = listener.address().port;
  await new Promise(done => listener.close(done));
  const env = Object.fromEntries(['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'TEMP', 'TMP']
    .filter(key => process.env[key]).map(key => [key, process.env[key]]));
  Object.assign(env, {
    HOST: '127.0.0.1', PORT: String(port), NODE_ENV: 'production',
    CROUPIER_DATA_DIR: directory, CROUPIER_DATABASE: 'sqlite',
    CROUPIER_CLOUD_RUNTIME: cloudRuntime ? '1' : '0', CROUPIER_STUDIO_NEON_POLICY: '0',
    CROUPIER_CLOUD_BOOTSTRAP_ADMIN_USER: 'mapping-fixture',
    CROUPIER_CLOUD_BOOTSTRAP_ADMIN_PASSWORD: 'Isolated-Mapping-Fixture-Password',
    CROUPIER_GENERATED_SPEECH: '', CROUPIER_GENERATED_SPEECH_STREAMING: '',
    GENERATIONS_READ_TOKENS: createHash('sha256').update(token).digest('hex'),
    PUBLIC_URL: 'https://clip-mapping.fixture.invalid', BO_URL: 'https://clip-mapping.fixture.invalid',
  });
  const child = spawn(process.execPath, [join(repository, 'services/game/server.mjs')], {
    cwd: join(repository, 'services/game'), env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const stopped = once(child, 'exit'); child.kill('SIGTERM'); await stopped;
    }
    await rm(directory, {recursive: true, force: true});
  });
  let diagnostics = '';
  child.stderr.on('data', chunk => { diagnostics = (diagnostics + chunk).slice(-4000); });
  await new Promise((done, reject) => {
    const timer = setTimeout(() => reject(Error('Isolated mapping server timeout: ' + diagnostics)), 15000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', () => { clearTimeout(timer); reject(Error('Isolated mapping server exited: ' + diagnostics)); });
    child.stdout.on('data', chunk => {
      if (String(chunk).includes('croupier demo on')) { clearTimeout(timer); done(); }
    });
  });
  return `http://127.0.0.1:${port}/api/v1/generations/mapping`;
}

test('game server keeps catalog aliases after its public source root moves', async t => {
  const expected = clipMapping({root: join(repository, 'web/public')});
  assert.ok(expected.dealers.astrid.greenSpeech.length > 0, 'fixture must include registered speech');
  assert.ok(expected.dealers.astrid.nativeSpeech.length > 0, 'fixture must include native overrides');
  assert.ok(expected.dealers.astrid.greenTakes.length > 0, 'fixture must include registered takes');
  const url = await gameServer(t);
  assert.equal((await fetch(url)).status, 401);
  const response = await fetch(url, {headers});
  assert.equal(response.status, 200);
  const actual = await response.json();
  for (const kind of ['greenSpeech', 'nativeSpeech', 'greenTakes']) {
    assert.equal(actual.dealers.astrid[kind].length, expected.dealers.astrid[kind].length, kind);
  }
  assert.deepEqual(actual.dealers, expected.dealers,
    'the real server must retain exact media, captions, hashes, audio and availability through catalog aliases');
  assert.equal(actual.actualPlayback, false);
});

test('cloud game server does not expose the local clip catalog', async t => {
  const url = await gameServer(t, true);
  const response = await fetch(url, {headers});
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {error: 'no mapping'});
});
