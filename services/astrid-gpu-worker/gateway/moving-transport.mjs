import { randomBytes, timingSafeEqual } from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';

const MAX_MESSAGE = 2 * 1024 * 1024;
const MAX_PENDING_BYTES = 4 * 1024 * 1024;
const equal = (a, b) => {
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

/** One callback connection per admitted attempt. The application must dispatch
 * upgrades explicitly: this does not install a competing HTTP upgrade listener.
 * callbackUrl is a secret capability; never log it or send it to the browser.
 */
export function createMovingWorkerChannel({ origin, avatar, idleMs = 15000, lifetimeMs = 180000 } = {}) {
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/'
    || !['paow', 'dragge'].includes(avatar)
    || !Number.isInteger(idleMs) || idleMs < 20 || idleMs > 15000
    || !Number.isInteger(lifetimeMs) || lifetimeMs < idleMs || lifetimeMs > 180000) {
    throw Error('invalid_moving_worker_channel');
  }
  const path = `/lipsync-moving/${randomBytes(24).toString('hex')}`;
  const token = randomBytes(32).toString('hex');
  url.protocol = 'wss:'; url.pathname = path;
  url.searchParams.set('token', token); url.searchParams.set('avatar', avatar);
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE, perMessageDeflate: false });
  const controller = new AbortController();
  let ws, claimed = false, failure, waiter, queuedBytes = 0;
  const queue = [];
  const timer = setTimeout(() => close('moving_worker_lifetime_exceeded'), lifetimeMs);
  timer.unref?.();

  function close(code = 'moving_worker_closed') {
    if (failure) return;
    failure = Error(code); clearTimeout(timer); controller.abort();
    for (const item of queue.splice(0)) item.data.fill(0);
    queuedBytes = 0;
    if (waiter) { waiter.reject(failure); waiter = null; }
    ws?.terminate(); wss.close();
  }
  function accept(socket) {
    ws = socket;
    ws.on('error', () => close('moving_worker_socket_error'));
    ws.on('close', () => close('moving_worker_disconnected'));
    ws.on('message', (data, binary) => {
      if (failure) return;
      const item = { data: Buffer.from(data), binary };
      if (!binary && item.data.length > 65536) return close('moving_worker_metadata_too_large');
      if (waiter) { const current = waiter; waiter = null; current.resolve(item); }
      else if (queue.length >= 8 || queuedBytes + item.data.length > MAX_PENDING_BYTES) close('moving_worker_backpressure');
      else { queue.push(item); queuedBytes += item.data.length; }
    });
  }
  function bounded(promise, code) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const end = (callback, value) => {
        if (settled) return;
        settled = true; clearTimeout(timeout); controller.signal.removeEventListener('abort', abort);
        callback(value);
      };
      const timeout = setTimeout(() => { close(code); end(reject, Error(code)); }, idleMs);
      const abort = () => end(reject, failure || Error('moving_worker_closed'));
      controller.signal.addEventListener('abort', abort, { once: true });
      promise.then(value => end(resolve, value), error => end(reject, error));
      if (failure) abort();
    });
  }
  return Object.freeze({
    callbackUrl: url.href, path, signal: controller.signal,
    handleUpgrade(req, socket, head) {
      let target;
      try { target = new URL(req.url, origin); } catch { return false; }
      if (target.pathname !== path) return false;
      const provided = target.searchParams.get('token') || '';
      if (failure || claimed || req.headers.origin || req.headers['sec-websocket-protocol']
        || target.searchParams.getAll('token').length !== 1 || !equal(provided, token)
        || target.searchParams.getAll('avatar').length !== 1 || target.searchParams.get('avatar') !== avatar
        || [...target.searchParams.keys()].some(key => !['token', 'avatar'].includes(key))) {
        socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return true;
      }
      claimed = true;
      wss.handleUpgrade(req, socket, head, accept);
      return true;
    },
    async next() {
      if (failure) throw failure;
      if (queue.length) { const item = queue.shift(); queuedBytes -= item.data.length; return item; }
      if (waiter) throw Error('moving_worker_concurrent_read');
      return bounded(new Promise((resolve, reject) => { waiter = { resolve, reject }; }), 'moving_worker_read_timeout');
    },
    async send(data) {
      if (failure) throw failure;
      if (ws?.readyState !== WebSocket.OPEN) throw Error('moving_worker_not_connected');
      if (ws.bufferedAmount > MAX_PENDING_BYTES) { close('moving_worker_backpressure'); throw failure; }
      return bounded(new Promise((resolve, reject) => ws.send(data, error => error ? reject(Error('moving_worker_send_failed')) : resolve())), 'moving_worker_write_timeout');
    },
    // Bounded callbacks must observe this signal too. After timeout no further
    // chunks are delivered; callers discard any late completion after abort.
    bounded, close,
  });
}
