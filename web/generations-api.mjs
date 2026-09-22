// Read-only API for the Higgsfield generations shown on the backoffice Generations page.
// GET /api/v1/generations            list (id, prompt, model, verdict, landedAt, size, sha256, downloadUrl)
// GET /api/v1/generations/:id/video  the MP4, with byte-range support
// Auth: Bearer token whose sha256 is listed in GENERATIONS_READ_TOKENS (comma-separated digests).
// Never writes, never takes a path from the client: the id is looked up in generations.json
// and the file is always <genDir>/<id>.mp4.
import { createHash, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { openGenerationMedia, closeGenerationMedia, serveGenerationMedia } from './generation-media.mjs';

const ID = /^[0-9a-f-]{36}$/;

export function installGenerationsApi({ catalogPath, genDir, verdicts = () => ({}), tokenDigests = () => [], publicUrl = '', mapping = () => null }) {
  const load = () => { try { return JSON.parse(readFileSync(catalogPath, 'utf8')); } catch { return []; } };
  const meta = new Map();
  const fileMeta = file => {
    const c = meta.get(file.id);
    if (c && c.mtime === file.mtimeMs && c.size === file.size && c.dev === file.dev && c.ino === file.ino) return c;
    const m = { size: file.size, mtime: file.mtimeMs, dev: file.dev, ino: file.ino, sha256: createHash('sha256').update(readFileSync(file.fd)).digest('hex') };
    meta.set(file.id, m); return m;
  };
  const authed = req => {
    const m = /^Bearer\s+(\S+)$/.exec(req.headers.authorization ?? '');
    if (!m) return false;
    const d = Buffer.from(createHash('sha256').update(m[1]).digest('hex'));
    return tokenDigests().some(x => { const b = Buffer.from(String(x).trim()); return b.length === d.length && timingSafeEqual(b, d); });
  };
  const json = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };

  // returns true when the request was handled
  return async function handle(req, res, pathname) {
    if (pathname !== '/api/v1/generations' && !pathname.startsWith('/api/v1/generations/')) return false;
    if (req.method !== 'GET' && req.method !== 'HEAD') { json(res, 405, { error: 'GET only' }); return true; }
    if (!authed(req)) { res.setHeader('WWW-Authenticate', 'Bearer'); json(res, 401, { error: 'bearer token required' }); return true; }
    if (pathname === '/api/v1/generations') {
      const v = verdicts();
      const catalog = load();
      const items = catalog.map(g => {
        const file = openGenerationMedia({ directory: genDir, catalog, fileName: `${g.id}.mp4` });
        let f;
        try { f = file ? fileMeta(file) : null; } finally { closeGenerationMedia(file); }
        return { id: g.id, prompt: g.prompt ?? '', model: g.model ?? null, duration: g.duration ?? null, aspect: g.aspect ?? null,
          verdict: v[g.id]?.verdict ?? null, verdictReason: v[g.id]?.reason ?? null, landedAt: g.at ?? null,
          size: f?.size ?? null, sha256: f?.sha256 ?? null,
          downloadUrl: f ? `${publicUrl}/api/v1/generations/${g.id}/video` : null };
      });
      json(res, 200, { count: items.length, items }); return true;
    }
    if (pathname === '/api/v1/generations/mapping') { const out = mapping(); if (!out) { json(res, 404, { error: 'no mapping' }); return true; } json(res, 200, out); return true; }
    const m = /^\/api\/v1\/generations\/([^/]+)\/video$/.exec(pathname);
    if (!m) { json(res, 404, { error: 'not found' }); return true; }
    const id = m[1];
    if (!ID.test(id) || !load().some(g => g.id === id)) { json(res, 404, { error: 'unknown generation' }); return true; }
    const file = openGenerationMedia({ directory: genDir, catalog: load(), fileName: `${id}.mp4` });
    if (!file) { json(res, 404, { error: 'video not on server' }); return true; }
    try {
      const f = fileMeta(file);
      serveGenerationMedia(req, res, file, { 'Cache-Control': 'private, max-age=3600', ETag: `"${f.sha256}"`, 'Content-Disposition': `attachment; filename="${id}.mp4"` });
    } catch { closeGenerationMedia(file); if (!res.headersSent) json(res, 500, { error: 'video could not be read' }); else res.destroy(); }
    return true;
  };
}
