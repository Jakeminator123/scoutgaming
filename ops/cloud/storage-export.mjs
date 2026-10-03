import { createServer } from 'node:http';
import { DatabaseSync, backup } from 'node:sqlite';
import { randomUUID, timingSafeEqual, createHash } from 'node:crypto';
import { lstat, realpath, mkdir, readFile, chmod } from 'node:fs/promises';
import { join, resolve } from 'node:path';

export function readStorageExportConfig(env = process.env) {
  if (!env.CROUPIER_STORAGE_MAINTENANCE) return null;
  const mode = env.CROUPIER_STORAGE_MAINTENANCE;
  if (!['export', 'studio-export'].includes(mode)
    || typeof env.CROUPIER_STORAGE_EXPORT_SECRET !== 'string'
    || Buffer.byteLength(env.CROUPIER_STORAGE_EXPORT_SECRET) < 32
    || /[\r\n]/.test(env.CROUPIER_STORAGE_EXPORT_SECRET)) throw Error('Invalid storage maintenance configuration.');
  if (mode === 'export' && (env.CROUPIER_DATABASE || 'sqlite') !== 'sqlite') throw Error('Invalid storage maintenance configuration.');
  // Freezes legacy Studio files before their explicit Neon import. An omitted
  // flag is ambiguous: maintenance must never start the new shared writer or
  // permit either full-file or streaming provider work.
  if (mode === 'studio-export' && (env.CROUPIER_DATABASE !== 'postgres'
    || env.CROUPIER_STUDIO_NEON_POLICY !== '0'
    || env.CROUPIER_GENERATED_SPEECH !== '0'
    || env.CROUPIER_CLOUD_GENERATED_SPEECH !== '0'
    || env.CROUPIER_GENERATED_SPEECH_STREAMING !== '0')) throw Error('Invalid storage maintenance configuration.');
  return Object.freeze({ mode, secret: env.CROUPIER_STORAGE_EXPORT_SECRET });
}

async function regular(path) {
  const info = await lstat(path);
  const actual = resolve(await realpath(path)), expected = resolve(path);
  const same = process.platform === 'win32' ? actual.toLowerCase() === expected.toLowerCase() : actual === expected;
  if (!info.isFile() || info.isSymbolicLink() || !same) throw Error('Invalid storage export source.');
  return info;
}

// This server runs instead of all product/Lab children. Render attaches a disk
// to one instance only, so the old process must stop before it can start. The
// source databases are read-only; node:sqlite backup also includes committed WAL.
export function createStorageExportServer(config, { secret, mode = 'export' },
  { backupDatabase = backup, onError = () => {}, childlessStartup = false } = {}) {
  if (!['export', 'studio-export'].includes(mode)
    || mode === 'studio-export' && (config.database !== 'postgres' || childlessStartup !== true)) {
    throw Error('Invalid storage maintenance startup.');
  }
  const expectedHost = new URL(config.vercelIngress?.transportOrigin || config.gameOrigin).host;
  let snapshot;
  async function capture() {
    const id = randomUUID(), directory = join(config.dataRoot, 'storage-backups', id);
    const files = [];
    for (const name of ['croupier.db', 'craig.db']) {
      const info = await regular(join(config.paths.players, name));
      if (info.size > 128 * 1024 * 1024) throw Error('Storage export requires a larger transfer path.');
    }
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await chmod(directory, 0o700);
    for (const name of ['croupier.db', 'craig.db']) {
      const source = new DatabaseSync(join(config.paths.players, name), { readOnly: true });
      const destination = join(directory, name);
      try { await backupDatabase(source, destination); } finally { source.close(); }
      await chmod(destination, 0o600);
      const bytes = await readFile(destination);
      files.push({ name, size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), data: bytes.toString('base64') });
    }
    return { format: 'croupier-sqlite-snapshot-v1', id, createdAt: new Date().toISOString(), files };
  }
  return createServer(async (req, res) => {
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store',
      'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
    if (req.headers.host !== expectedHost) { res.writeHead(403, headers); res.end('{"error":"Invalid host"}'); return; }
    if (req.method === 'GET' && req.url === '/__cloud/health') {
      res.writeHead(200, headers);
      res.end(mode === 'studio-export'
        ? JSON.stringify({ service: 'croupier-storage-maintenance', mode, database: 'postgres',
          childlessStartup: true, children: 0, writers: 0, providers: 0 })
        : '{"service":"croupier-storage-maintenance","writers":0}');
      return;
    }
    // There is deliberately no PostgreSQL connection, public snapshot API,
    // media serving or disk capture here. Frozen bytes are inspected privately
    // through SSH after provider drain has separately been verified.
    if (mode === 'studio-export') {
      res.writeHead(503, { ...headers, 'Retry-After': '120' }); res.end('{"error":"Storage migration in progress"}'); return;
    }
    const supplied = req.headers['x-croupier-storage-export'];
    const key = Buffer.from(secret), bytes = typeof supplied === 'string' ? Buffer.from(supplied) : Buffer.alloc(0);
    if (req.method !== 'POST' || req.url !== '/__migration/storage/export'
      || bytes.length !== key.length || !timingSafeEqual(bytes, key)) {
      res.writeHead(503, { ...headers, 'Retry-After': '120' }); res.end('{"error":"Storage migration in progress"}'); return;
    }
    try {
      snapshot ??= capture().catch(error => { snapshot = null; throw error; });
      const packet = JSON.stringify(await snapshot);
      res.writeHead(200, { ...headers, 'Content-Length': Buffer.byteLength(packet) }); res.end(packet);
    } catch (error) {
      try { onError(error); } catch { /* Keep private export failures off the response. */ }
      res.writeHead(500, headers); res.end('{"error":"Storage snapshot unavailable"}');
    }
  });
}
