// Read-only API for the Higgsfield generations shown on the backoffice Generations page.
// GET /api/v1/generations            list (id, prompt, model, verdict, landedAt, size, sha256, downloadUrl)
// GET /api/v1/generations/:id/video  the MP4, with byte-range support
// Auth: Bearer token whose sha256 is listed in GENERATIONS_READ_TOKENS (comma-separated digests).
// Never writes, never takes a path from the client: the id is looked up in generations.json
// and the file is always <genDir>/<id>.mp4.
import { createHash, timingSafeEqual } from 'node:crypto';
import { createReadStream, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ID = /^[0-9a-f-]{36}$/;

export function installGenerationsApi({ catalogPath, genDir, verdicts = () => ({}), tokenDigests = () => [], publicUrl = '' }) {
  const load = () => { try { return JSON.parse(readFileSync(catalogPath, 'utf8')); } catch { return []; } };
  const meta = new Map();
  const fileMeta = id => {
    const p = join(genDir, `${id}.mp4`);
    let st; try { st = statSync(p); } catch { return null; }
    const c = meta.get(id);
    if (c && c.mtime === st.mtimeMs && c.size === st.size) return c;
    const m = { path: p, size: st.size, mtime: st.mtimeMs, sha256: createHash('sha256').update(readFileSync(p)).digest('hex') };
    meta.set(id, m); return m;
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
      const items = load().map(g => {
        const f = fileMeta(g.id);
        return { id: g.id, prompt: g.prompt ?? '', model: g.model ?? null, duration: g.duration ?? null, aspect: g.aspect ?? null,
          verdict: v[g.id]?.verdict ?? null, verdictReason: v[g.id]?.reason ?? null, landedAt: g.at ?? null,
          size: f?.size ?? null, sha256: f?.sha256 ?? null,
          downloadUrl: f ? `${publicUrl}/api/v1/generations/${g.id}/video` : null };
      });
      json(res, 200, { count: items.length, items }); return true;
    }
    const m = /^\/api\/v1\/generations\/([^/]+)\/video$/.exec(pathname);
    if (!m) { json(res, 404, { error: 'not found' }); return true; }
    const id = m[1];
    if (!ID.test(id) || !load().some(g => g.id === id)) { json(res, 404, { error: 'unknown generation' }); return true; }
    const f = fileMeta(id);
    if (!f) { json(res, 404, { error: 'video not on server' }); return true; }
    const head = { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=3600', 'ETag': `"${f.sha256}"`, 'Content-Disposition': `attachment; filename="${id}.mp4"` };
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
    if (range) {
      let start = range[1] === '' ? Math.max(0, f.size - Number(range[2])) : Number(range[1]);
      let end = range[1] !== '' && range[2] !== '' ? Math.min(Number(range[2]), f.size - 1) : f.size - 1;
      if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= f.size) { res.writeHead(416, { 'Content-Range': `bytes */${f.size}` }); res.end(); return true; }
      res.writeHead(206, { ...head, 'Content-Range': `bytes ${start}-${end}/${f.size}`, 'Content-Length': end - start + 1 });
      if (req.method === 'HEAD') { res.end(); return true; }
      createReadStream(f.path, { start, end }).pipe(res); return true;
    }
    res.writeHead(200, { ...head, 'Content-Length': f.size });
    if (req.method === 'HEAD') { res.end(); return true; }
    createReadStream(f.path).pipe(res); return true;
  };
}
