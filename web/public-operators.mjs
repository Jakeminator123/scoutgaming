// Public operator labels. The lobby list includes only currently playable rooms.
import { DEMO_OPERATORS as PARTNER_PREVIEW_OPERATORS } from './demo-operators.mjs';
import { isOperatorSlug } from '../packages/navigation/operator-slug.mjs';
import { isUnplayableOperatorRooms } from './public-operator-rooms.mjs';

const PATH = /^\/api\/operators\/([^/]+)$/;
export const OPERATOR_PUBLIC_CACHE_MS = 60_000;

function record(operator) {
  if (!operator || operator.status !== 'active' || !isOperatorSlug(operator.slug)) return null;
  if (typeof operator.name !== 'string' || operator.name.length < 1 || operator.name.length > 120) return null;
  if (/[\u0000-\u001f\u007f-\u009f]/u.test(operator.name)) return null;
  return {slug: operator.slug, name: operator.name};
}

export function createPublicOperatorDirectory({store = null, readRooms = null, now = Date.now, ttlMs = OPERATOR_PUBLIC_CACHE_MS} = {}) {
  if (typeof now !== 'function' || !Number.isFinite(ttlMs) || ttlMs < 0 || readRooms !== null && typeof readRooms !== 'function') throw new TypeError('Invalid operator directory');
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
  async function list() {
    // Unlike the legacy single-name lookup, this is never a cached/demo list.
    if (typeof store?.listOperators !== 'function' || !readRooms) throw Error('Operator list unavailable');
    const rows = await store.listOperators();
    if (!Array.isArray(rows) || rows.length > 1000 || Object.keys(rows).length !== rows.length) throw Error('Invalid operator list');
    const { validatePublicOperatorRooms } = await import('./public/operator-rooms-contract.mjs');
    const operators = [], seen = new Set();
    for (const row of rows) {
      const value = record(row);
      if (!value || !value.name.trim()) continue;
      if (seen.has(value.slug)) throw Error('Duplicate operator');
      seen.add(value.slug);
      let rooms;
      try { rooms = await readRooms(value.slug); }
      catch (error) {
        if (isUnplayableOperatorRooms(error, value.slug)) continue;
        throw error;
      }
      if (rooms === null) continue; // Operator was removed/suspended after listing.
      const current = validatePublicOperatorRooms(rooms, {operatorSlug: value.slug});
      if (current.rooms.length) operators.push({slug: current.operator.slug, name: current.operator.name});
    }
    const result = {operators};
    if (Buffer.byteLength(JSON.stringify(result), 'utf8') > 256 * 1024) throw Error('Operator list too large');
    return result;
  }
  async function handleList(req, res, pathname) {
    const send = (status, value, extra = {}) => {
      res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra});
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify(value));
    };
    if (!['GET', 'HEAD'].includes(req.method)) { send(405, {error: 'method_not_allowed'}, {Allow: 'GET, HEAD'}); return true; }
    if (new URL(req.url ?? pathname, 'http://local').search) { send(400, {error: 'invalid_query'}); return true; }
    try { send(200, await list()); }
    catch { send(503, {error: 'operator_directory_unavailable'}); }
    return true;
  }
  async function handle(req, res, pathname) {
    if (pathname === '/api/operators') return handleList(req, res, pathname);
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
  return {read, list, handle};
}
