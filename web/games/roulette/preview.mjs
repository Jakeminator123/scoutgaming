import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { createSpinResult } from './index.mjs';

const files = new Map([
  ['/roulette-test', ['index.html', 'text/html; charset=utf-8']],
  ['/roulette-test/app.mjs', ['app.mjs', 'text/javascript; charset=utf-8']],
  ['/roulette-test/style.css', ['style.css', 'text/css; charset=utf-8']],
]);
const apiPath = '/api/roulette-test/spin';
const headers = {
  'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow',
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
};

// Deliberately public, unlisted diagnostics: no sessions, bets, wallet or DB.
// The process-wide token bucket bounds this cheap endpoint without storing IPs.
export function createRoulettePreview({ origin, now = () => performance.now(), draw = createSpinResult }) {
  const expectedOrigin = new URL(origin).origin;
  let tokens = 30, lastRefill = now();
  return async function roulettePreview(req, res) {
    const url = new URL(req.url, expectedOrigin);
    if (url.pathname !== '/roulette-test/' && !files.has(url.pathname) && url.pathname !== apiPath) return false;
    const json = (status, data, extra = {}) => {
      res.writeHead(status, { ...headers, 'Content-Type': 'application/json; charset=utf-8', ...extra });
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify(data));
    };
    if (url.pathname !== apiPath) {
      if (!['GET', 'HEAD'].includes(req.method)) { json(405, { error: 'method_not_allowed' }, { Allow: 'GET, HEAD' }); return true; }
      if (url.pathname === '/roulette-test/') {
        res.writeHead(308, { ...headers, Location: '/roulette-test' }); res.end(); return true;
      }
      const [name, type] = files.get(url.pathname);
      const data = await readFile(new URL(`../../public/roulette-test/${name}`, import.meta.url));
      res.writeHead(200, { ...headers, 'Content-Type': type });
      res.end(req.method === 'HEAD' ? undefined : data); return true;
    }
    if (req.method !== 'POST') { json(405, { error: 'method_not_allowed' }, { Allow: 'POST' }); return true; }
    if (req.headers.origin !== expectedOrigin || req.headers['x-roulette-preview'] !== '1'
        || req.headers['sec-fetch-site'] && req.headers['sec-fetch-site'] !== 'same-origin') {
      req.resume(); json(403, { error: 'same_origin_required' }); return true;
    }
    // Empty POST only. The server chooses all IDs; clients cannot select an outcome.
    if (url.search || req.headers['transfer-encoding']
        || req.headers['content-length'] && req.headers['content-length'] !== '0') {
      req.resume(); json(400, { error: 'empty_request_required' }); return true;
    }
    const time = now();
    tokens = Math.min(30, tokens + Math.max(0, time - lastRefill) / 1000); lastRefill = time;
    if (tokens < 1) { json(429, { error: 'preview_rate_limited' }, { 'Retry-After': '1' }); return true; }
    tokens--;
    try {
      const event = draw({ operatorId: 'roulette-demo', roomId: 'roulette-test', roundId: randomUUID() });
      json(200, { demo: true, event });
    } catch {
      json(503, { error: 'roulette_draw_failed' });
    }
    return true;
  };
}
