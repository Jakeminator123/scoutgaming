import { createPublicOperatorRooms as createPublicRoomsReader } from '../../packages/operators/server/public-rooms.mjs';

const PATH = /^\/api\/operators\/([^/]+)\/rooms$/;

// Game HTTP transport; the shared reader owns the exact frozen room selection.
export function createPublicOperatorRooms(options = {}) {
  const { read } = createPublicRoomsReader(options);
  async function handle(req, res, pathname) {
    const match = PATH.exec(pathname);
    if (!match) return false;
    const send = (status, value, headers = {}) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify(value));
    };
    if (!['GET', 'HEAD'].includes(req.method)) { send(405, { error: 'method_not_allowed' }, { Allow: 'GET, HEAD' }); return true; }
    if (new URL(req.url ?? pathname, 'http://local').search) { send(400, { error: 'invalid_query' }); return true; }
    let slug;
    try { slug = decodeURIComponent(match[1]); } catch { slug = ''; }
    try {
      const value = await read(slug);
      send(value ? 200 : 404, value ?? { error: 'not_found' });
    } catch { send(503, { error: 'operator_rooms_unavailable' }); }
    return true;
  }
  return Object.freeze({ read, handle });
}
