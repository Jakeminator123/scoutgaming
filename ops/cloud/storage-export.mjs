import { createServer } from 'node:http';

// Only the PostgreSQL Studio freeze remains. The SQLite snapshot mode ('export',
// croupier-sqlite-snapshot-v1) was removed with the engine's SQLite path.
export function readStorageExportConfig(env = process.env) {
  if (!env.CROUPIER_STORAGE_MAINTENANCE) return null;
  const mode = env.CROUPIER_STORAGE_MAINTENANCE;
  if (mode !== 'studio-export'
    || typeof env.CROUPIER_STORAGE_EXPORT_SECRET !== 'string'
    || Buffer.byteLength(env.CROUPIER_STORAGE_EXPORT_SECRET) < 32
    || /[\r\n]/.test(env.CROUPIER_STORAGE_EXPORT_SECRET)) throw Error('Invalid storage maintenance configuration.');
  // Freezes legacy Studio files before their explicit Neon import. An omitted
  // flag is ambiguous: maintenance must never start the new shared writer or
  // permit either full-file or streaming provider work.
  if (env.CROUPIER_STUDIO_NEON_POLICY !== '0'
    || env.CROUPIER_GENERATED_SPEECH !== '0'
    || env.CROUPIER_CLOUD_GENERATED_SPEECH !== '0'
    || env.CROUPIER_GENERATED_SPEECH_STREAMING !== '0') throw Error('Invalid storage maintenance configuration.');
  return Object.freeze({ mode, secret: env.CROUPIER_STORAGE_EXPORT_SECRET });
}

// This server runs instead of all product/Lab children and answers only health.
export function createStorageExportServer(config, { mode } = {}, { childlessStartup = false } = {}) {
  if (mode !== 'studio-export' || config.database !== 'postgres' || childlessStartup !== true) {
    throw Error('Invalid storage maintenance startup.');
  }
  const expectedHost = new URL(config.vercelIngress?.transportOrigin || config.gameOrigin).host;
  return createServer((req, res) => {
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store',
      'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
    if (req.headers.host !== expectedHost) { res.writeHead(403, headers); res.end('{"error":"Invalid host"}'); return; }
    if (req.method === 'GET' && req.url === '/__cloud/health') {
      res.writeHead(200, headers);
      res.end(JSON.stringify({ service: 'croupier-storage-maintenance', mode, database: 'postgres',
        childlessStartup: true, children: 0, writers: 0, providers: 0 }));
      return;
    }
    // There is deliberately no PostgreSQL connection, public snapshot API,
    // media serving or disk capture here. Frozen bytes are inspected privately
    // through SSH after provider drain has separately been verified.
    res.writeHead(503, { ...headers, 'Retry-After': '120' }); res.end('{"error":"Storage migration in progress"}');
  });
}
