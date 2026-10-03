import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, mkdir, rm, writeFile, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createStorageExportServer, readStorageExportConfig } from '../storage-export.mjs';
import { inspectCloudBootstrap, validateCloudConfig } from '../config.mjs';

const studioEnv = () => ({ CROUPIER_STORAGE_MAINTENANCE: 'studio-export', CROUPIER_DATABASE: 'postgres',
  CROUPIER_STUDIO_NEON_POLICY: '0', CROUPIER_GENERATED_SPEECH: '0', CROUPIER_CLOUD_GENERATED_SPEECH: '0',
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
  for (const changes of [ { CROUPIER_DATABASE: undefined }, { CROUPIER_DATABASE: 'sqlite' },
    { CROUPIER_STORAGE_EXPORT_SECRET: 'short' }, { CROUPIER_STORAGE_EXPORT_SECRET: 'a'.repeat(32)+'\n' } ]) {
    assert.throws(() => readStorageExportConfig({ ...env, ...changes }), /maintenance/);
  }
});

test('PostgreSQL Studio freeze validates cloud config but never connects or bootstraps the database', async () => {
  const env = { ...studioEnv(), NODE_ENV: 'production', PORT: '10000',
    CROUPIER_CLOUD_DATA_ROOT: join(tmpdir(), 'croupier-studio-maintenance-fixture'),
    PUBLIC_URL: 'https://game.example.test', BO_URL: 'https://bo.example.test', LAB_PUBLIC_URL: 'https://lab.example.test',
    CROUPIER_GAME_ORIGIN: 'https://game.example.test', BETTALOTTO_PARTNER_BASE_URL: 'https://game.example.test',
    CROUPIER_STREAM_LANE: 'lissabon-stream-lane', OPENCLAW_PRODUCT_SPEECH_URL: 'https://speech.example.test',
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
      ${JSON.stringify(maintenance)}, { childlessStartup:true, backupDatabase:()=>{throw Error('forbidden capture');} });
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
    assert.equal(privateError.includes('forbidden capture'), false);
  } finally {
    if (child.connected) child.disconnect();
    const timeout = setTimeout(() => child.kill(), 5000);
    await exited; clearTimeout(timeout);
  }
});

test('maintenance requires explicit SQLite export and private key', () => {
  assert.equal(readStorageExportConfig({}), null);
  for (const env of [{ CROUPIER_STORAGE_MAINTENANCE: 'yes' },
    { CROUPIER_STORAGE_MAINTENANCE: 'export', CROUPIER_STORAGE_EXPORT_SECRET: 'short' },
    { CROUPIER_STORAGE_MAINTENANCE: 'export', CROUPIER_DATABASE: 'postgres', CROUPIER_STORAGE_EXPORT_SECRET: 'a'.repeat(64) }]) {
    assert.throws(() => readStorageExportConfig(env), /maintenance/);
  }
});

test('quiesced export includes committed WAL, rejects other routes and preserves source bytes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'croupier-storage-export-'));
  const players = join(dir, 'players'); await mkdir(players);
  const handles = [];
  let server;
  try {
    for (const name of ['croupier.db', 'craig.db']) {
      const db = new DatabaseSync(join(players, name)); handles.push(db);
      db.exec('PRAGMA journal_mode=WAL; CREATE TABLE evidence(id TEXT PRIMARY KEY,value TEXT NOT NULL)');
      db.prepare('INSERT INTO evidence VALUES (?,?)').run(name, 'preserved-history');
    }
    const before = await readFile(join(players, 'croupier.db'));
    server = createStorageExportServer({ gameOrigin: 'https://isolated.example.test', paths: { players }, dataRoot: dir }, { secret: 'a'.repeat(64) }, { onError: error => console.error(error.message) });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const call = (path, method = 'GET', headers = {}) => new Promise((resolve, reject) => {
      const req = request({ hostname: '127.0.0.1', port: server.address().port, path, method,
        headers: { host: 'isolated.example.test', ...headers } }, res => {
        let body=''; res.on('data', chunk => body+=chunk); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
      }); req.on('error',reject);req.end();
    });
    assert.equal((await call('/__cloud/health')).status, 200);
    assert.equal((await call('/api/table', 'POST')).status, 503);
    assert.equal((await call('/__migration/storage/export', 'POST')).status, 503);
    assert.equal((await call('/__migration/storage/export?key=wrong', 'POST', { 'x-croupier-storage-export':'a'.repeat(64) })).status,503);
    assert.equal((await call('/__migration/storage/export','POST',{host:'wrong.example.test','x-croupier-storage-export':'a'.repeat(64)})).status,403);
    const result = await call('/__migration/storage/export','POST',{'x-croupier-storage-export':'a'.repeat(64)});
    assert.equal(result.status, 200); assert.equal(result.headers['cache-control'], 'private, no-store');
    const packet = JSON.parse(result.body); assert.equal(packet.files.length, 2);
    for (const file of packet.files) {
      const bytes=Buffer.from(file.data,'base64'); assert.equal(bytes.length,file.size);
      assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256);
      const restored=join(dir,'restored-'+file.name); await writeFile(restored,bytes);
      const db=new DatabaseSync(restored,{readOnly:true});
      try { assert.equal(db.prepare('SELECT value FROM evidence WHERE id=?').get(file.name).value,'preserved-history'); }
      finally { db.close(); }
    }
    assert.deepEqual(await readFile(join(players,'croupier.db')),before);
    assert.equal(JSON.parse((await call('/__migration/storage/export','POST',{'x-croupier-storage-export':'a'.repeat(64)})).body).id,packet.id);
    assert.equal((await readdir(join(dir,'storage-backups'))).length,1);
  } finally {
    if(server)await new Promise(resolve=>server.close(resolve));for(const db of handles)db.close();await rm(dir,{recursive:true,force:true});
  }
});
