import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';
import { spawn } from 'node:child_process';
import { createStorageExportServer, readStorageExportConfig } from '../storage-export.mjs';
import { inspectCloudBootstrap, validateCloudConfig } from '../config.mjs';

const studioEnv = () => ({ CROUPIER_STORAGE_MAINTENANCE: 'studio-export',   CROUPIER_STUDIO_NEON_POLICY: '0', CROUPIER_GENERATED_SPEECH: '0', CROUPIER_CLOUD_GENERATED_SPEECH: '0',
  CROUPIER_GENERATED_SPEECH_STREAMING: '0', CROUPIER_STORAGE_EXPORT_SECRET: 'fixture-export-secret-'.repeat(3) });

test('Studio freeze requires PostgreSQL and every policy/provider flag explicitly off', () => {
  const env = studioEnv();
  assert.deepEqual(readStorageExportConfig(env), { mode: 'studio-export', secret: env.CROUPIER_STORAGE_EXPORT_SECRET });
  for (const name of ['CROUPIER_STUDIO_NEON_POLICY', 'CROUPIER_GENERATED_SPEECH',
    'CROUPIER_CLOUD_GENERATED_SPEECH', 'CROUPIER_GENERATED_SPEECH_STREAMING']) {
    for (const value of [undefined, '', '1', 'false', '0 ']) {
      assert.throws(() => readStorageExportConfig({ ...env, [name]: value }), /maintenance/);
    }
  }
  for (const changes of [ { CROUPIER_STORAGE_EXPORT_SECRET: 'short' }, { CROUPIER_STORAGE_EXPORT_SECRET: 'a'.repeat(32)+'\n' } ]) {
    assert.throws(() => readStorageExportConfig({ ...env, ...changes }), /maintenance/);
  }
});

test('PostgreSQL Studio freeze validates cloud config but never connects or bootstraps the database', async () => {
  const env = { ...studioEnv(), NODE_ENV: 'production', PORT: '10000',
    CROUPIER_CLOUD_DATA_ROOT: join(tmpdir(), 'croupier-studio-maintenance-fixture'),
    PUBLIC_URL: 'https://game.example.test', BO_URL: 'https://bo.example.test', LAB_PUBLIC_URL: 'https://lab.example.test',
    CROUPIER_GAME_ORIGIN: 'https://game.example.test', BETTALOTTO_PARTNER_BASE_URL: 'https://game.example.test',
    OPENCLAW_PRODUCT_SPEECH_URL: 'https://speech.example.test',
    OPENCLAW_PRODUCT_SPEECH_TOKEN: 'unused-fixture-token',
    CROUPIER_GAME_DATABASE_URL: 'postgresql://fixture:never-use@fixture.neon.tech/neondb?sslmode=require' };
  const config = validateCloudConfig(env);
  assert.equal(config.storageExport.mode, 'studio-export');
  assert.equal(config.generatedSpeech, false); assert.equal(config.streaming, false);
  // An invalid connection would throw immediately if preflight constructed a
  // Postgres store. The maintenance branch must not need even a DB credential.
  await inspectCloudBootstrap({ ...config, gameDatabaseUrl: 'must-not-connect' });
  assert.throws(() => createStorageExportServer(config, config.storageExport), /startup/);
  assert.throws(() => createStorageExportServer({ ...config, database: 'sqlite' }, config.storageExport,
    { childlessStartup: true }), /startup/);
});

test('isolated Studio freeze process serves only attested health and cannot capture, write or call providers', async () => {
  const maintenance = readStorageExportConfig(studioEnv());
  const script = `
    import { createStorageExportServer } from ${JSON.stringify(new URL('../storage-export.mjs', import.meta.url).href)};
    const server = createStorageExportServer({ database:'postgres', gameOrigin:'https://isolated.example.test' },
      ${JSON.stringify(maintenance)}, { childlessStartup:true });
    server.listen(0,'127.0.0.1',()=>process.send({port:server.address().port}));
    process.on('disconnect',()=>server.close(()=>process.exit(0)));
  `;
  const child = spawn(process.execPath, ['--input-type=module', '-e', script], { stdio: ['ignore','ignore','pipe','ipc'] });
  const exited = new Promise(resolve => child.once('exit', resolve));
  let privateError = ''; child.stderr.on('data', bytes => { privateError += bytes.toString(); });
  try {
    const { port } = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Isolated maintenance startup timed out.')), 5000);
      child.once('message', value => { clearTimeout(timer); resolve(value); });
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', () => { clearTimeout(timer); reject(Error('Isolated maintenance process exited before readiness.')); });
    });
    const call = (path, method = 'GET', headers = {}) => new Promise((resolve, reject) => {
      const req = request({ hostname: '127.0.0.1', port, path, method,
        headers: { host: 'isolated.example.test', ...headers } }, res => {
        let body = ''; res.on('data', bytes => body += bytes); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
      }); req.on('error', reject); req.end();
    });
    const health = await call('/__cloud/health');
    assert.equal(health.status, 200); assert.equal(health.headers['cache-control'], 'private, no-store');
    assert.deepEqual(JSON.parse(health.body), { service: 'croupier-storage-maintenance', mode: 'studio-export', database: 'postgres',
      childlessStartup: true, children: 0, writers: 0, providers: 0 });
    for (const path of ['/', '/blackjack', '/studio', '/api/table', '/api/bo/config', '/studio/api/admin/players/create',
      '/api/studio/project', '/api/generated-speech', '/api/speech-stream', '/__migration/storage/export', '/__cloud/health?extra=1']) {
      for (const method of ['GET','POST','PUT','DELETE']) {
        const result = await call(path, method, { 'x-croupier-storage-export': maintenance.secret });
        assert.equal(result.status, 503, `${method} ${path}`); assert.equal(result.headers['retry-after'], '120');
        assert.equal(JSON.parse(result.body).error, 'Storage migration in progress');
      }
    }
    assert.equal((await call('/__cloud/health','POST')).status, 503);
    assert.equal((await call('/__cloud/health','GET',{host:'wrong.example.test'})).status, 403);
    assert.equal(privateError, '');
  } finally {
    if (child.connected) child.disconnect();
    const timeout = setTimeout(() => child.kill(), 5000);
    await exited; clearTimeout(timeout);
  }
});

test('maintenance accepts only the PostgreSQL Studio freeze; the SQLite snapshot mode is retired', () => {
  assert.equal(readStorageExportConfig({}), null);
  const secret = 'a'.repeat(64);
  for (const env of [{ CROUPIER_STORAGE_MAINTENANCE: 'yes' },
    { CROUPIER_STORAGE_MAINTENANCE: 'export', CROUPIER_STORAGE_EXPORT_SECRET: secret },
    { ...studioEnv(), CROUPIER_STORAGE_MAINTENANCE: 'export', CROUPIER_STORAGE_EXPORT_SECRET: secret },
    { CROUPIER_STORAGE_MAINTENANCE: 'export', CROUPIER_STORAGE_EXPORT_SECRET: secret }]) {
    assert.throws(() => readStorageExportConfig(env), /maintenance/);
  }
  assert.throws(() => createStorageExportServer({ database: 'postgres', gameOrigin: 'https://isolated.example.test' },
    { mode: 'export', secret }, { childlessStartup: true }), /startup/);
});
