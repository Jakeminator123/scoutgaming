// Byte-range responder for a descriptor already opened and validated by the caller
// (server.mjs passes media-layout's openPublicMedia result). Closes the descriptor on
// every branch that does not hand it to the response stream.
import { closeSync, createReadStream } from 'node:fs';

function closeGenerationMedia(media) {
  if (media?.fd !== undefined) { closeSync(media.fd); media.fd = undefined; }
}

export function serveGenerationMedia(req, res, media, headers = {}) {
  const base = { 'Content-Type': media.contentType, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff', ETag: `"${media.size}-${Math.round(media.mtimeMs)}"`, ...headers };
  if (!['GET', 'HEAD'].includes(req.method)) {
    closeGenerationMedia(media); res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return;
  }
  let start = 0, end = media.size - 1, status = 200;
  const raw = req.headers.range;
  if (raw) {
    const range = /^bytes=(\d*)-(\d*)$/.exec(raw);
    const first = range?.[1] ? Number(range[1]) : null, last = range?.[2] ? Number(range[2]) : null;
    if (!range || first === null && last === null || first !== null && !Number.isSafeInteger(first) || last !== null && !Number.isSafeInteger(last)
      || first === null && last === 0) {
      closeGenerationMedia(media); res.writeHead(416, { ...base, 'Content-Range': `bytes */${media.size}` }); res.end(); return;
    }
    start = first === null ? Math.max(0, media.size - last) : first;
    end = first !== null && last !== null ? Math.min(last, media.size - 1) : media.size - 1;
    if (start > end || start >= media.size) {
      closeGenerationMedia(media); res.writeHead(416, { ...base, 'Content-Range': `bytes */${media.size}` }); res.end(); return;
    }
    status = 206; base['Content-Range'] = `bytes ${start}-${end}/${media.size}`;
  }
  res.writeHead(status, { ...base, 'Content-Length': Math.max(0, end - start + 1) });
  if (req.method === 'HEAD' || media.size === 0) { closeGenerationMedia(media); res.end(); return; }
  const stream = createReadStream('', { fd: media.fd, autoClose: true, start, end });
  media.fd = undefined;
  stream.on('error', () => res.destroy());
  res.on('close', () => stream.destroy());
  stream.pipe(res);
}
