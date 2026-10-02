// QA-process preload only. It uses the product auth, session manager and relay.
// Provider responses and worker media are synthetic transport evidence.
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';

export const QA_SERVICE_ID = 'srv-datj7l893c1s73ar3u50';
export const QA_PUBLIC_ORIGIN = 'https://croupier-player-preview-qa.vercel.app';
export const QA_TRANSPORT_ORIGIN = 'https://croupier-vercel-preview-qa.onrender.com';
export const FIXTURE_PROVIDER_ORIGIN = 'https://unpaid-transport.invalid';
export const FIXTURE_CREDENTIAL = 'unpaid-transport-fixture';
export const FIXTURE_ENDPOINT = 'unpaid-transport-fixture';
export const TRANSPORT_SENTINEL = Buffer.from('CROUPIER_UNPAID_WSS_TRANSPORT_V1');
const DIAGNOSTICS = Symbol.for('croupier.unpaid-stream-diagnostics');
const TRACE_PHASES = new Set(['fresh_before', 'fresh_after', 'source_opened', 'tts_source_before', 'pcm_written', 'source_error',
  'product_request', 'tts_request', 'tts_return_pcm', 'gpu_submit', 'gpu_worker_ready', 'gpu_status', 'gpu_cancel',
  'worker_open', 'worker_recv_start', 'worker_recv_pcm', 'worker_recv_end', 'worker_recv_abort',
  'worker_send_stream', 'worker_send_bytes', 'worker_send_done', 'worker_close', 'worker_error']);

export function installUnpaidDiagnostics(env, {emit = value => console.info(value)} = {}) {
  assertUnpaidQaEnvironment(env);
  const counts = new Map();
  let emitted = 0;
  const trace = (phase, fields = {}) => {
    if (!TRACE_PHASES.has(phase) || emitted >= 256) return;
    const count = (counts.get(phase) ?? 0) + 1; counts.set(phase, count);
    const value = {phase, count};
    if (Number.isSafeInteger(fields)) fields = {ms: fields};
    for (const name of ['ms', 'bytes', 'code']) if (Number.isSafeInteger(fields?.[name]) && fields[name] >= 0 && fields[name] <= 16 * 1024 * 1024) value[name] = fields[name];
    emitted++;
    try {emit('CROUPIER_UNPAID_STREAM ' + JSON.stringify(value));} catch { /* Evidence never changes transport. */ }
  };
  globalThis[DIAGNOSTICS] = trace;
  return trace;
}

export function assertUnpaidQaEnvironment(env) {
  if (env.RENDER_SERVICE_ID !== QA_SERVICE_ID || env.PUBLIC_URL !== QA_PUBLIC_ORIGIN
      || env.CROUPIER_VERCEL_TRANSPORT_ORIGIN !== QA_TRANSPORT_ORIGIN || env.NODE_ENV !== 'production'
      || env.OPENCLAW_PRODUCT_SPEECH_URL !== FIXTURE_PROVIDER_ORIGIN
      || env.OPENCLAW_PRODUCT_SPEECH_TOKEN !== FIXTURE_CREDENTIAL
      || env.CARTESIA_API_KEY !== FIXTURE_CREDENTIAL || env.RUNPOD_API_KEY !== FIXTURE_CREDENTIAL
      || env.CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID !== FIXTURE_ENDPOINT
      || env.CROUPIER_GENERATED_SPEECH_STREAMING !== '1' || env.CROUPIER_CLOUD_GENERATED_SPEECH !== '1'
      || env.CROUPIER_GENERATED_SPEECH !== '1' || env.DEMO_GUEST_ACCESS === '1'
      || env.CROUPIER_MEDIA_STORAGE !== 'disk') throw Error('Unpaid transport fixture requires the exact isolated QA deployment and fake provider configuration.');
}

export async function openSyntheticWorker(input, {WebSocketImpl, timeoutMs = 10000, trace = globalThis[DIAGNOSTICS] ?? (() => {})} = {}) {
  if (input.ws_url !== QA_PUBLIC_ORIGIN.replace('https:', 'wss:') + '/lipsync-worker'
      || typeof input.ws_token !== 'string' || input.ws_token.length < 32
      || !/^croupier-[a-f0-9]{32}$/.test(input.worker_id)) throw Error('Invalid isolated worker transport.');
  const WebSocket = WebSocketImpl ?? createRequire(new URL('../../services/astrid-gpu-worker/gateway/package.json', import.meta.url))('ws');
  const worker = new WebSocket(input.ws_url, {headers: {Authorization: `Bearer ${input.ws_token}`, 'X-Worker-Id': input.worker_id}});
  let currentId, sent = false;
  worker.on('message', (bytes, binary) => {
    if (binary) {
      trace('worker_recv_pcm', {bytes: bytes.length});
      if (currentId && !sent) {sent = true; worker.send(TRANSPORT_SENTINEL, {binary: true}); trace('worker_send_bytes', {bytes: TRANSPORT_SENTINEL.length});}
      return;
    }
    const message = JSON.parse(bytes.toString());
    if (message.t === 'start') {
      trace('worker_recv_start');
      currentId = message.id; sent = false;
      worker.send(JSON.stringify({t: 'stream', id: currentId, mime: 'video/mp4; codecs="avc1.64002a, mp4a.40.2"'}));
      trace('worker_send_stream');
    }
    if (['end', 'abort'].includes(message.t)) {
      trace(message.t === 'end' ? 'worker_recv_end' : 'worker_recv_abort');
      worker.send(JSON.stringify({t: 'done', id: message.id, frames: 0, ms: 0, syntheticTransport: true, ...(message.t === 'abort' ? {aborted: true} : {})}));
      trace('worker_send_done');
      currentId = null;
    }
  });
  worker.on('error', () => trace('worker_error'));
  worker.on('close', code => trace('worker_close', {code}));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {worker.terminate(); reject(Error('Unpaid worker upgrade failed.'));}, timeoutMs);
    worker.once('open', () => {trace('worker_open'); clearTimeout(timer); resolve(worker);});
    worker.once('error', () => {clearTimeout(timer); worker.terminate(); reject(Error('Unpaid worker upgrade failed.'));});
  });
}

export function unpaidQaFetch(env, {realFetch = fetch, createWorker = openSyntheticWorker, trace = globalThis[DIAGNOSTICS] ?? (() => {})} = {}) {
  assertUnpaidQaEnvironment(env);
  const jobs = new Map();
  return async (input, init = {}) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.href === FIXTURE_PROVIDER_ORIGIN + '/api/product/speech') {
      trace('product_request');
      const {request, status} = JSON.parse(init.body);
      return Response.json({kind: 'generatedText', requestId: request.requestId, dealerId: status.dealerId,
        sessionRevision: status.sessionRevision, roundRevision: status.roundRevision, text: 'Synthetic unpaid transport fixture.'});
    }
    if (url.href === 'https://api.cartesia.ai/tts/bytes') {
      trace('tts_request');
      init.signal?.throwIfAborted();
      trace('tts_return_pcm', {bytes: 4800});
      return new Response(new Uint8Array(4800), {headers: {'Content-Type': 'audio/pcm'}});
    }
    if (url.origin === 'https://api.runpod.ai') {
      const prefix = `/v2/${FIXTURE_ENDPOINT}/`;
      if (!url.pathname.startsWith(prefix)) throw Error('Nonfixture RunPod endpoint is forbidden.');
      const route = url.pathname.slice(prefix.length);
      if (route === 'run' && init.method === 'POST') {
        trace('gpu_submit');
        const body = JSON.parse(init.body);
        const id = `unpaid-${body.input.worker_id}`;
        const worker = await createWorker(body.input);
        trace('gpu_worker_ready');
        jobs.set(id, {worker, status: 'IN_PROGRESS'});
        return Response.json({id, status: 'IN_PROGRESS'});
      }
      const match = /^(status|cancel)\/(unpaid-croupier-[a-f0-9]{32})$/.exec(route), job = match && jobs.get(match[2]);
      if (!match) throw Error('Unknown unpaid session fixture.');
      // A QA process restart terminates every synthetic worker. Preserve the
      // existing session ledger while allowing its normal terminal recovery.
      if (!job) return Response.json({id: match[2], status: 'COMPLETED'});
      trace(match[1] === 'cancel' ? 'gpu_cancel' : 'gpu_status');
      if (match[1] === 'cancel') {job.worker.close(); job.status = 'CANCELLED';}
      return Response.json({id: match[2], status: job.status});
    }
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw Error('External provider request forbidden in unpaid transport fixture.');
    return realFetch(input, init);
  };
}

/** Called by the QA operator after real BO login and POST /api/bo/speech-qa.
 * Never place its cookie or descriptor in command output or checked-in files. */
export async function verifyUnpaidWssTransport({cookie, descriptor}, {WebSocketImpl, timeoutMs = 15000} = {}) {
  if (typeof cookie !== 'string' || !cookie.includes('bo_jwt=') || descriptor?.url !== '/speech-stream'
      || typeof descriptor.ticket !== 'string' || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(descriptor.ticket)) throw Error('A real isolated BO session and prepared stream are required.');
  const WebSocket = WebSocketImpl ?? createRequire(new URL('../../services/astrid-gpu-worker/gateway/package.json', import.meta.url))('ws');
  const client = new WebSocket(QA_PUBLIC_ORIGIN.replace('https:', 'wss:') + '/speech-stream', ['astrid-v2', `ticket.${descriptor.ticket}`],
    {origin: QA_PUBLIC_ORIGIN, headers: {Cookie: cookie}, handshakeTimeout: timeoutMs});
  return new Promise((resolve, reject) => {
    let ready, streamed = false, done = false, media = null, settled = false, accepted = false;
    const fail = (gate, {statusCode, closeCode, networkCode} = {}) => {
      if (settled) return;
      settled = true; clearTimeout(timer); client.terminate();
      reject(Object.assign(Error('Unpaid client transport verification failed.'), {gate, accepted},
        Number.isInteger(statusCode) ? {statusCode} : {}, Number.isInteger(closeCode) ? {closeCode} : {},
        ['ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EPROTO', 'ERR_TLS_CERT_ALTNAME_INVALID', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'].includes(networkCode) ? {networkCode} : {}));
    };
    const timer = setTimeout(() => fail('client_timeout'), timeoutMs);
    client.on('open', () => {accepted = true;});
    client.on('unexpected-response', (_request, response) => {response.resume(); fail('client_upgrade', {statusCode: response.statusCode});});
    client.on('error', error => fail('client_socket', {networkCode: error?.code}));
    client.on('message', (bytes, binary) => {
      if (binary) {
        if (!streamed || media || !Buffer.from(bytes).equals(TRANSPORT_SENTINEL)) {fail('client_binary'); return;}
        media = Buffer.from(bytes); return;
      }
      let message;
      try {message = JSON.parse(bytes.toString());} catch {fail('client_protocol'); return;}
      if (message.t === 'ready' && !ready && message.protocol === 2 && typeof message.id === 'string' && message.id) ready = message.id;
      else if (message.t === 'stream' && ready === message.id && !streamed) streamed = true;
      else if (message.t === 'done' && ready === message.id && media && !done && message.syntheticTransport === true) done = true;
      else fail('client_protocol');
    });
    client.on('close', code => {
      if (settled) return;
      if (code !== 1000 || !ready || !streamed || !done || !media) {fail('client_terminal', {closeCode: code}); return;}
      settled = true; clearTimeout(timer);
      resolve({accepted: true, upgradeStatus: 101, workerRoundTrip: true, bytes: media.length, sha256: createHash('sha256').update(media).digest('hex'),
        terminalCode: code, syntheticTransport: true, actualPlayback: false});
    });
  });
}

if (process.env.NODE_OPTIONS === `--import=${import.meta.url}`) {
  installUnpaidDiagnostics(process.env);
  globalThis.fetch = unpaidQaFetch(process.env);
}
