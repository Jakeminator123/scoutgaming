// Public name for an active operator. No package, membership or branding.
import { DEMO_OPERATORS as PARTNER_PREVIEW_OPERATORS, isOperatorSlug } from './demo-operators.mjs';

const PATH = /^\/api\/operators\/([^/]+)$/;
export const OPERATOR_PUBLIC_CACHE_MS = 60_000;

function record(operator) {
  if (!operator || operator.status !== 'active' || !isOperatorSlug(operator.slug)) return null;
  if (typeof operator.name !== 'string' || operator.name.length < 1 || operator.name.length > 120) return null;
  if (/[\u0000-\u001f\u007f-\u009f]/u.test(operator.name)) return null;
  return {slug: operator.slug, name: operator.name};
}

export function createPublicOperatorDirectory({store = null, now = Date.now, ttlMs = OPERATOR_PUBLIC_CACHE_MS} = {}) {
  if (typeof now !== 'function' || !Number.isFinite(ttlMs) || ttlMs < 0) throw new TypeError('Invalid operator directory');
  const cache = new Map();
  const fixtures = new Map(PARTNER_PREVIEW_OPERATORS.map(item => [item.slug, {slug: item.slug, name: item.name, status: 'active'}]));
  async function load(slug) {
    if (!store) return record(fixtures.get(slug));
    const operator = await store.getOperatorBySlug(slug);
    return record(operator);
  }
  async function read(slug) {
    if (!isOperatorSlug(slug)) return null;
    const at = now();
    const hit = cache.get(slug);
    if (hit && at - hit.at >= 0 && at - hit.at < ttlMs) return hit.value;
    const value = await load(slug);
    if (value && ttlMs > 0) cache.set(slug, {at, value});
    else cache.delete(slug);
    return value;
  }
  async function handle(req, res, pathname) {
    const match = PATH.exec(pathname);
    if (!match) return false;
    const headers = {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=60'};
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, {Allow: 'GET, HEAD', 'Cache-Control': 'no-store'});
      res.end();
      return true;
    }
    let slug;
    try { slug = decodeURIComponent(match[1]); } catch { slug = ''; }
    try {
      const value = await read(slug);
      if (!value) {
        res.writeHead(404, headers);
        res.end(req.method === 'HEAD' ? undefined : '{"error":"not_found"}');
        return true;
      }
      const body = JSON.stringify({slug: value.slug, name: value.name});
      res.writeHead(200, headers);
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch {
      res.writeHead(503, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'});
      res.end('{"error":"operator_directory_unavailable"}');
    }
    return true;
  }
  return {read, handle};
}
