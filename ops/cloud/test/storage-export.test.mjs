import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, mkdir, rm, writeFile, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';
import { createHash } from 'node:crypto';
import { createStorageExportServer, readStorageExportConfig } from '../storage-export.mjs';

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
