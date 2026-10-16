// Local, read-only film viewer. No env loader, credentials, cloud API or game server.
import { createServer } from 'node:http';
import { execFileSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
const gitAsync = promisify(execFile);
const allowed = path => /^(media\/|web\/public\/|apps\/croupier-frontend\/public\/|packages\/design-preview\/)/.test(path)
  && /\.(mp4|webm|mov|m4v)$/i.test(path);
const mime = path => path.endsWith('.webm') ? 'video/webm' : path.endsWith('.mov') ? 'video/quicktime' : 'video/mp4';

export function readMainCatalog(root) {
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  const commit = git(['rev-parse', '--verify', 'origin/main^{commit}']).trim();
  const clips = git(['ls-tree', '-r', '-l', '-z', commit]).split('\0').filter(Boolean).flatMap(line => {
    const match = /^(100644|100755) blob ([a-f0-9]{40})\s+(\d+)\t(.+)$/.exec(line);
    if (!match || !allowed(match[4])) return [];
    return [{ id: match[2], path: match[4], bytes: Number(match[3]), type: mime(match[4]) }];
  });
  return { commit, clips };
}

export function byteRange(header, size) {
  if (!header) return { start: 0, end: size - 1, partial: false };
  const m = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!m || (!m[1] && !m[2])) return null;
  const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
  const end = m[1] && m[2] ? Math.min(size - 1, Number(m[2])) : size - 1;
  return Number.isSafeInteger(start) && Number.isSafeInteger(end) && start >= 0 && start <= end && start < size
    ? { start, end, partial: true } : null;
}

export function createEditorServer(root, catalog = readMainCatalog(root)) {
  const token = randomBytes(24).toString('hex');
  const clips = new Map(catalog.clips.map(clip => [clip.id, clip]));
  let cached; // One bounded, immutable Git blob; no media copies or new catalog on disk.
  let activeRead = null;
  const server = createServer(async (req, res) => {
    const origin = `http://127.0.0.1:${server.address().port}`;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; media-src 'self' blob:; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    if (req.headers.host !== new URL(origin).host || (req.headers.origin && req.headers.origin !== origin)
      || req.headers['sec-fetch-site'] === 'cross-site') { res.writeHead(403).end(); return; }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
    const path = req.url?.split('?')[0];
    const prefix = `/${token}/`;
    if (!path?.startsWith(prefix)) { res.writeHead(404).end(); return; }
    const route = path.slice(prefix.length);
    try {
      if (route === 'catalog') {
        res.setHeader('Content-Type', 'application/json');
        res.end(req.method === 'HEAD' ? undefined : JSON.stringify(catalog)); return;
      }
      if (['', 'editor.mjs', 'style.css'].includes(route)) {
        res.setHeader('Content-Type', route === '' ? 'text/html; charset=utf-8' : route.endsWith('.mjs') ? 'text/javascript' : 'text/css');
        res.end(req.method === 'HEAD' ? undefined : await readFile(resolve(directory, route || 'index.html'))); return;
      }
      const clip = /^media\/([a-f0-9]{40})$/.exec(route)?.[1];
      const item = clips.get(clip);
      if (!item) { res.writeHead(404).end(); return; }
      // Current main's largest film is 12 MB. Fail explicitly for larger future inputs.
      if (item.bytes > 64 * 1024 * 1024) { res.writeHead(413).end('Film exceeds local preview limit (64 MiB).'); return; }
      const range = byteRange(req.headers.range, item.bytes);
      if (!range) { res.writeHead(416, { 'Content-Range': `bytes */${item.bytes}` }).end(); return; }
      if (req.method !== 'HEAD' && cached?.id !== clip) {
        // Serialize Git reads; bound retained memory when scrubbing/changing films.
        if (activeRead && activeRead.id !== clip) { res.writeHead(503, { 'Retry-After': '1' }).end(); return; }
        activeRead ||= { id: clip, promise: gitAsync('git', ['cat-file', 'blob', clip], { cwd: root, encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 }) };
        const pending = activeRead;
        try { const { stdout } = await pending.promise; cached = { id: clip, bytes: stdout }; }
        finally { if (activeRead === pending) activeRead = null; }
        if (cached.bytes.length !== item.bytes) throw Error('git_blob_size_mismatch');
      }
      res.writeHead(range.partial ? 206 : 200, { 'Content-Type': item.type, 'Accept-Ranges': 'bytes',
        'Content-Length': range.end - range.start + 1,
        ...(range.partial ? { 'Content-Range': `bytes ${range.start}-${range.end}/${item.bytes}` } : {}) });
      res.end(req.method === 'HEAD' ? undefined : cached.bytes.subarray(range.start, range.end + 1));
    } catch { if (!res.headersSent) res.writeHead(500); res.end('Local preview could not read this file.'); }
  });
  return { server, token, catalog };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(directory, '..');
  const catalog = readMainCatalog(root);
  if (process.argv.includes('--check')) console.log(JSON.stringify({ main: catalog.commit, films: catalog.clips.length, bytes: catalog.clips.reduce((n, c) => n + c.bytes, 0) }));
  else {
    const { server, token } = createEditorServer(root, catalog);
    server.listen(0, '127.0.0.1', () => console.log(`Lipsync-test: http://127.0.0.1:${server.address().port}/${token}/\nMain: ${catalog.commit}. ${catalog.clips.length} films. Ctrl+C stops the viewer.`));
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { server.close(); server.closeAllConnections(); });
  }
}
