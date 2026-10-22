const namespace = /^\/api\/shared-room(?:[/?#]|$)/;
const route = /^\/api\/shared-room\/[a-z0-9_-]{1,128}\/command$/;
const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store',
  'CDN-Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

// Cancelling an oversized Fetch body must leave the HTTP socket available for
// its 413 response. Readable.toWeb(IncomingMessage) would destroy that socket.
function requestBody(req, res) {
  let clean;
  return new ReadableStream({
    start(controller) {
      const data = chunk => { controller.enqueue(chunk); if (controller.desiredSize <= 0) req.pause(); };
      const end = () => { clean(); controller.close(); };
      const error = failure => { clean(); controller.error(failure); };
      clean = () => { req.removeListener('data', data); req.removeListener('end', end); req.removeListener('error', error); };
      req.on('data', data); req.once('end', end); req.once('error', error); req.pause();
      if (req.readableEnded) end();
    },
    pull() { req.resume(); },
    cancel() { clean(); res.shouldKeepAlive = false; req.resume(); },
  });
}

async function send(res, status, responseHeaders, body) {
  if (res.destroyed) return;
  res.writeHead(status, responseHeaders);
  await new Promise((resolve, reject) => {
    const clean = () => { res.removeListener('finish', finish); res.removeListener('close', finish); res.removeListener('error', error); };
    const finish = () => { clean(); resolve(); };
    const error = failure => { clean(); reject(failure); };
    res.once('finish', finish); res.once('close', finish); res.once('error', error);
    try { res.end(body); } catch (failure) { error(failure); }
  });
}

/** Node-only bridge; no route installation, authentication or automatic retry. */
export async function handleSharedRoomHttp(req, res, { command, engineOrigin } = {}) {
  const target = req.url;
  // Own malformed raw namespace paths even when URL normalization would move
  // them elsewhere; also reject paths normalized into the protected namespace.
  let normalized;
  try { normalized = new URL(target, 'http://local').pathname; } catch {}
  if (!namespace.test(target) && !namespace.test(normalized)) return false;
  if (!route.test(target)) {
    await send(res, 400, headers, '{"error":"shared_room_invalid_path"}'); return true;
  }
  if (typeof command !== 'function') {
    await send(res, 503, headers, '{"error":"shared_room_service_unavailable"}'); return true;
  }
  const controller = new AbortController();
  const abort = () => controller.abort(new DOMException('Client disconnected', 'AbortError'));
  const closed = () => { if (!res.writableEnded) abort(); };
  req.once('aborted', abort); res.once('close', closed);
  let body;
  try {
    if (req.aborted || res.destroyed) abort();
    if (req.method === 'POST') body = requestBody(req, res);
    const request = new Request(new URL(target, engineOrigin), { method: req.method, headers: req.headers, signal: controller.signal,
      ...(body ? { body, duplex: 'half' } : {}) });
    const response = await command(request);
    if (body && !body.locked) await body.cancel().catch(() => {});
    if (!response) { await send(res, 404, headers); return true; }
    const content = await response.text();
    if (!controller.signal.aborted) await send(res, response.status, Object.fromEntries(response.headers), req.method === 'HEAD' ? undefined : content);
  } catch {
    if (body && !body.locked) await body.cancel().catch(() => {});
    if (!res.destroyed && !res.headersSent) await send(res, 503, headers, '{"error":"shared_room_command_unavailable"}');
    else if (!res.destroyed) res.destroy();
  } finally {
    // Early origin/method rejection can leave the body unread. Cancel only our
    // stream, drain the request and close this connection after the response.
    if (body && !body.locked) await body.cancel().catch(() => {});
    req.removeListener('aborted', abort); res.removeListener('close', closed);
  }
  return true;
}
