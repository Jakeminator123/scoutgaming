import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFileSync, createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
const snapshot = JSON.parse(readFileSync(join(directory, 'snapshot.json'), 'utf8'));
const entries = new Map(snapshot.items.map(item => [item.id, item]));

// This serves only the inventory page and allowlisted, verified local MP4s.
// It does not read .env, call the remote API, or modify the archive.
export function createAuditServer({ archiveDir } = {}) {
  const verified = new Map();
  const server = createServer(async (req, res) => {
    const port = server.address()?.port;
    const authorities = [`127.0.0.1:${port}`, `localhost:${port}`];
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    const end = (code, message) => {
      res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(req.method === 'HEAD' ? undefined : message);
    };
    if (!authorities.includes(req.headers.host)) return end(403, 'Local host required');
    if (req.headers.origin && !authorities.some(host => req.headers.origin === `http://${host}`)) {
      return end(403, 'Local origin required');
    }
    if (!['GET', 'HEAD'].includes(req.method)) return end(405, 'GET or HEAD only');
    try {
      const route = new URL(req.url, `http://127.0.0.1:${port}`).pathname;
      if (route === '/' || route === '/map.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(req.method === 'HEAD' ? undefined : readFileSync(join(directory, 'map.html')));
      }
      const id = /^\/video\/([a-f0-9-]{36})$/.exec(route)?.[1];
      const entry = entries.get(id);
      if (!entry) return end(404, 'Unknown resource');
      if (!archiveDir) return end(503, 'Start with --archive PATH to preview local videos. See README.');
      const archive = await realpath(resolve(archiveDir));
      const file = await realpath(join(archive, `${id}.mp4`));
      if (dirname(file) !== archive) return end(403, 'File is outside the archive');
      const info = await stat(file);
      if (!info.isFile() || info.size !== entry.size) return end(409, 'File differs from the inventory');
      const fingerprint = `${info.size}:${info.mtimeMs}:${info.ctimeMs}`;
      if (verified.get(id) !== fingerprint) {
        const hash = createHash('sha256');
        for await (const chunk of createReadStream(file)) hash.update(chunk);
        if (hash.digest('hex') !== entry.sha256) return end(409, 'File hash differs from the inventory');
        verified.set(id, fingerprint);
      }
      let start = 0, finish = info.size - 1, status = 200;
      if (req.headers.range) {
        const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
        const invalid = () => {
          res.setHeader('Content-Range', `bytes */${info.size}`);
          return end(416, 'Invalid range');
        };
        if (!range || (!range[1] && !range[2])) return invalid();
        start = range[1] ? Number(range[1]) : Math.max(0, info.size - Number(range[2]));
        finish = range[1] && range[2] ? Math.min(Number(range[2]), info.size - 1) : info.size - 1;
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(finish)
            || start > finish || start >= info.size) return invalid();
        status = 206;
        res.setHeader('Content-Range', `bytes ${start}-${finish}/${info.size}`);
      }
      res.writeHead(status, {
        'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Content-Length': finish - start + 1,
      });
      if (req.method === 'HEAD') return res.end();
      const stream = createReadStream(file, { start, end: finish });
      stream.on('error', () => res.destroy());
      res.on('close', () => stream.destroy());
      stream.pipe(res);
    } catch (error) {
      if (res.headersSent) return res.destroy();
      end(error.code === 'ENOENT' ? 404 : 500, 'Local preview unavailable. Check the archive path.');
    }
  });
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!['--archive', '--port'].includes(args[i]) || !args[i + 1]) throw new Error('Use --archive PATH --port NUMBER');
    options[args[i].slice(2)] = args[i + 1];
  }
  const port = Number(options.port ?? 4196);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port');
  const server = createAuditServer({ archiveDir: options.archive });
  server.on('error', error => { console.error(`Preview could not start: ${error.code}`); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`Video map: http://127.0.0.1:${port}/`));
}
