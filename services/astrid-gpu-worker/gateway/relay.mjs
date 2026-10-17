import { randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { constantEqual } from './auth.mjs';

/** Attach to an existing Node HTTP server. authenticateClient must verify both
 * identity and permission to use its returned sessionId (never trust URL ids).
 * One worker serves one utterance at a time; overload is rejected, never queued.
 */
export function attachSpeechRelay(server, {
  workerSecret, allowedOrigins, authenticateClient, authenticateWorker = () => true, movingSpeechRoutes = false,
  maxWorkers = 4, maxSessions = 4, maxAudioSeconds = 25,
  maxBufferedBytes = 8 * 1024 * 1024, sessionTimeoutMs = 120000,
  idleTimeoutMs = 15000, cancelTimeoutMs = 5000,
  allowClientPCM = false, onSessionReady = () => {}, onFirstMedia = () => {}, onTransport = () => {},
  onWorkerIdle = () => {}, onMedia = () => {}, onComplete = () => {},
} = {}) {
  if (!workerSecret || workerSecret.length < 32 || !allowedOrigins?.length || typeof authenticateClient !== 'function') throw new Error('Worker secret, origin allowlist and authenticated sessions are required');
  const origins = new Set(allowedOrigins);
  const workers = new Map(), sessions = new Map(), owners = new Set();
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024, perMessageDeflate: false, handleProtocols: p => p.has('astrid-v2') ? 'astrid-v2' : false });
  const workerWss = new WebSocketServer({ noServer: true, maxPayload: 4 * 1024 * 1024, perMessageDeflate: false });
  const reject = (socket, status = 403) => { socket.end(`HTTP/1.1 ${status} Rejected\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`); };
  const send = (ws, data, binary = false, callback) => {
    if (ws.readyState !== WebSocket.OPEN || ws.bufferedAmount + Buffer.byteLength(data) > maxBufferedBytes) return false;
    ws.send(data, { binary }, callback); return true;
  };
  const json = (ws, value) => send(ws, JSON.stringify(value));
  const release = s => {
    if (!sessions.has(s.id)) return;
    clearTimeout(s.timer); clearTimeout(s.cancelTimer);
    sessions.delete(s.id); owners.delete(s.owner);
    if (s.worker.session === s) s.worker.session = null;
    s.controller.abort();
    s.client.close(1000, 'Complete');
    if (s.started && s.worker.ws.readyState === WebSocket.OPEN) {
      try { onWorkerIdle(s.worker.id); } catch { /* Lifecycle notification must not prevent release. */ }
    }
  };
  const abort = (s, reason) => {
    if (!sessions.has(s.id) || s.cancelled) return;
    s.cancelled = true;
    s.controller.abort(reason);
    json(s.client, { t: 'error', id: s.id, error: reason });
    s.client.close(1008, reason.slice(0, 100));
    if (!s.started) { release(s); return; }
    if (!json(s.worker.ws, { t: 'abort', id: s.id })) { s.worker.ws.terminate(); release(s); return; }
    s.cancelTimer = setTimeout(() => { s.worker.ws.terminate(); release(s); }, cancelTimeoutMs);
  };
  workerWss.on('connection', (ws, req, id) => {
    const w = { ws, id, session: null, alive: true };
    workers.set(id, w);
    ws.on('pong', () => { w.alive = true; });
    ws.on('error', () => {});
    ws.on('message', (data, binary) => {
      const s = w.session;
      if (binary) {
        if (!s || !s.streaming) { ws.close(1008, 'Unexpected media'); return; }
        if (!s.cancelled) { try { onMedia(s.identity,data); } catch {} }
        const first = !s.firstMedia && !s.cancelled;
        const receivedAt = first ? performance.now() : 0;
        if (!s.firstMedia && !s.cancelled) {
          s.firstMedia = true;
          try { onFirstMedia(s.identity); } catch { /* Timing must not affect delivery. */ }
        }
        if (!s.cancelled && !send(s.client, data, true, first ? error => {
          if (!error) { try { onTransport(s.identity, Math.round(performance.now() - receivedAt)); } catch {} }
        } : undefined)) abort(s, 'Client is too slow');
        return;
      }
      let m;
      try { if (data.length > 8192) throw Error(); m = JSON.parse(data.toString()); if (!m || typeof m !== 'object' || Array.isArray(m)) throw Error(); } catch { ws.close(1008, 'Invalid control'); return; }
      if (m.t === 'pong') return;
      if (!s || m.id !== s.id) { ws.close(1008, 'Unexpected request id'); return; }
      if (m.t === 'stream') {
        if (s.streaming || typeof m.mime !== 'string' || !m.mime.startsWith('video/mp4') || m.mime.length > 200) { abort(s, 'Invalid media description'); return; }
        s.streaming = true;
      } else if (!['done', 'error'].includes(m.t)) { abort(s, 'Unknown worker message'); return; }
      if (!s.cancelled && !json(s.client, m)) abort(s, 'Client is too slow');
      if (m.t === 'done' && !s.cancelled && s.ended) { try { onComplete(s.identity,m); } catch {} }
      if (m.t === 'done' || m.t === 'error') release(s);
    });
    ws.on('close', () => {
      if (workers.get(id) === w) workers.delete(id);
      if (w.session) { json(w.session.client, { t: 'error', id: w.session.id, error: 'Worker disconnected' }); release(w.session); }
    });
  });
  wss.on('connection', (client, req, identity, w) => {
    const owner = JSON.stringify([identity.userId, identity.sessionId]);
    const s = { id: randomUUID(), owner, identity, client, worker: w, controller: new AbortController(), bytes: 0, started: false, ended: false, streaming: false, cancelled: false, lastInput: Date.now() };
    w.session = s; sessions.set(s.id, s); owners.add(owner);
    s.timer = setTimeout(() => abort(s, 'Session deadline exceeded'), sessionTimeoutMs);
    client.on('error', () => {});
    json(client, { t: 'ready', id: s.id, protocol: 2 });
    s.accept = (data, binary) => {
      if (s.cancelled || !sessions.has(s.id)) return;
      s.lastInput = Date.now();
      if (binary) {
        if (!s.started || s.ended || data.length % 2 !== 0) { abort(s, 'Invalid PCM sequence'); return; }
        s.bytes += data.length;
        if (s.bytes > s.rate * 2 * maxAudioSeconds) { abort(s, 'Audio limit exceeded'); return; }
        if (!send(w.ws, data, true)) abort(s, 'Worker is too slow');
        return;
      }
      let m;
      try { if (data.length > 4096) throw Error(); m = JSON.parse(data.toString()); if (!m || typeof m !== 'object' || Array.isArray(m)) throw Error(); } catch { abort(s, 'Invalid control'); return; }
      if (m.t === 'abort') { abort(s, 'Cancelled'); return; }
      if (m.t === 'start' && !s.started && m.protocol === 2 && [16000, 22050, 24000, 44100, 48000].includes(m.rate)) {
        s.started = true; s.rate = m.rate;
        if (!json(w.ws, { t: 'start', id: s.id, rate: s.rate, protocol: 2 })) abort(s, 'Worker unavailable');
      } else if (m.t === 'end' && s.started && !s.ended && s.bytes > 0) {
        s.ended = true;
        if (!json(w.ws, { t: 'end', id: s.id })) abort(s, 'Worker unavailable');
      } else abort(s, 'Invalid control sequence');
    };
    client.on('message', (data, binary) => {
      if (!allowClientPCM) {
        try { if (!binary && data.length <= 4096 && JSON.parse(data.toString()).t === 'abort') { abort(s, 'Cancelled'); return; } } catch {}
        abort(s, 'Client audio upload is disabled'); return;
      }
      s.accept(data, binary);
    });
    client.on('close', () => { if (sessions.has(s.id)) abort(s, 'Client disconnected'); });
    Promise.resolve().then(() => onSessionReady({ ...identity, id: s.id, signal: s.controller.signal })).catch(() => abort(s, 'Speech source failed'));
  });
  const upgrade = async (req, socket, head) => {
    try {
      const path = new URL(req.url, 'http://localhost').pathname;
      if (movingSpeechRoutes && (path === '/moving-speech-stream' || path.startsWith('/lipsync-moving/'))) return;
      if (path === '/lipsync-worker') {
        const id = req.headers['x-worker-id'];
        if (!constantEqual(req.headers.authorization || '', `Bearer ${workerSecret}`) || typeof id !== 'string' || !/^[\w-]{1,100}$/.test(id)) return reject(socket);
        if (!await authenticateWorker(req, id) || socket.destroyed) return reject(socket);
        if (workers.has(id) || workers.size >= maxWorkers) return reject(socket, 409);
        workerWss.handleUpgrade(req, socket, head, ws => workerWss.emit('connection', ws, req, id));
      } else if (path === '/speech-stream') {
        if (!origins.has(req.headers.origin)) return reject(socket);
        const identity = await authenticateClient(req);
        if (!identity?.userId || !identity?.sessionId) return reject(socket, 401);
        if (socket.destroyed) return;
        if (owners.has(JSON.stringify([identity.userId, identity.sessionId]))) return reject(socket, 409);
        const w = [...workers.values()].find(v => (!identity.workerId || v.id === identity.workerId) && !v.session && v.ws.readyState === WebSocket.OPEN);
        if (!w || sessions.size >= maxSessions) return reject(socket, 503);
        wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req, identity, w));
      } else reject(socket, 404);
    } catch { if (!socket.destroyed) reject(socket); }
  };
  server.on('upgrade', upgrade);
  const tick = setInterval(() => {
    const now = Date.now();
    for (const s of sessions.values()) if (!s.ended && now - s.lastInput > idleTimeoutMs) abort(s, 'Input idle timeout');
    for (const w of workers.values()) { if (!w.alive) w.ws.terminate(); else { w.alive = false; w.ws.ping(); } }
  }, Math.min(idleTimeoutMs, 10000));
  tick.unref();
  return {
    status: () => ({ workers: workers.size, busy: sessions.size, available: [...workers.values()].filter(w => !w.session && w.ws.readyState === WebSocket.OPEN).length }),
    workerStatus(id) {
      const worker = workers.get(id);
      const connected = worker?.ws.readyState === WebSocket.OPEN;
      return { workers: worker ? 1 : 0, busy: worker?.session ? 1 : 0, available: connected && !worker.session ? 1 : 0 };
    },
    stopWorker(id) {
      const worker = workers.get(id);
      if (!worker || worker.session) return false;
      json(worker.ws, { t: 'bye' });
      worker.ws.close(1000, 'Session complete');
      return true;
    },
    /** Trusted application-only API: call after verifying request/session ownership.
     * TTS PCM stays on Render -> GPU; the browser receives only media. */
    openSource({ userId, sessionId, id, rate }) {
      const owner = JSON.stringify([userId, sessionId]);
      const s = sessions.get(id);
      if (!s || s.owner !== owner || s.cancelled || s.started) throw new Error('No available owned speech session');
      s.accept(Buffer.from(JSON.stringify({ t: 'start', protocol: 2, rate })), false);
      if (s.cancelled) throw new Error('Invalid audio source');
      return {
        id: s.id, signal: s.controller.signal,
        async writePCM(bytes) {
          if (!(bytes instanceof Uint8Array) || bytes.byteLength % 2) throw new Error('Expected little-endian PCM16 bytes');
          for (let offset = 0; offset < bytes.byteLength; offset += 65536) {
            const deadline = Date.now() + 10000;
            while (s.worker.ws.bufferedAmount > 512 * 1024) {
              if (Date.now() > deadline || s.controller.signal.aborted) { abort(s, 'Audio source stalled'); throw new Error('Audio source stalled'); }
              await new Promise(resolve => setTimeout(resolve, 10));
            }
            if (s.controller.signal.aborted || s.ended) throw new Error('Audio source closed');
            s.accept(Buffer.from(bytes.buffer, bytes.byteOffset + offset, Math.min(65536, bytes.byteLength - offset)), true);
            if (s.cancelled) throw new Error('Audio source rejected');
          }
        },
        end() { if (s.controller.signal.aborted || s.ended) throw new Error('Audio source closed'); s.accept(Buffer.from('{"t":"end"}'), false); },
        abort() { abort(s, 'Source cancelled'); },
      };
    },
    close() { clearInterval(tick); server.off('upgrade', upgrade); for (const s of [...sessions.values()]) { s.client.terminate(); release(s); } for (const w of workers.values()) w.ws.terminate(); wss.close(); workerWss.close(); },
  };
}
