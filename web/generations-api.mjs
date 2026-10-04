// Authenticated compatibility endpoint for the active presentation mapping.
// The old generation catalog and MP4 package mount were disk-backed and are
// deliberately retired; media is resolved through the active Studio/Blob path.
import { createHash, timingSafeEqual } from 'node:crypto';

export function installGenerationsApi({ tokenDigests = () => [], mapping = () => null }) {
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
    if (pathname === '/api/v1/generations/mapping') { const out = mapping(); if (!out) { json(res, 404, { error: 'no mapping' }); return true; } json(res, 200, out); return true; }
    json(res, 410, { error: 'legacy generation catalog retired' });
    return true;
  };
}
