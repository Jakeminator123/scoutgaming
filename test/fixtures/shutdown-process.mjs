import { createServer } from 'node:http';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { setTimeout as pause } from 'node:timers/promises';
import { attachSpeechRelay } from '../../services/astrid-gpu-worker/gateway/relay.mjs';
import { installGracefulShutdown } from '../../services/game/graceful-shutdown.mjs';
import { createSpeechJournal } from '../../services/game/postgres-speech-journal.mjs';
import { createJournalSpeechSessionManager } from '../../services/game/speech-journal-runtime.mjs';
import { SPEECH_SESSION_POLICY } from '../../services/game/generated-speech-session.mjs';
import { speechMemoryPool } from './speech-memory-pool.mjs';

const { WebSocket } = createRequire(new URL('../../services/astrid-gpu-worker/gateway/package.json', import.meta.url))('ws');
const [role, mode] = process.argv.slice(2);
const emit = (phase, data = {}) => process.send?.({ phase, ...data });
const listen = async server => { server.listen(0, '127.0.0.1'); await once(server, 'listening'); return server.address().port; };
const close = async server => {
  if (!server.listening) return;
  const closed = new Promise(resolve => server.close(resolve));
  server.closeAllConnections(); await closed;
};

if (role !== 'web') throw new Error('Unknown shutdown fixture role');
{
  const server = createServer((_req, res) => res.end('fixture'));
  const pool = speechMemoryPool(Date.now);
  const journal = await createSpeechJournal({ pool, environmentId: 'isolated-shutdown', now: Date.now });
  await journal.initializeBudgetPolicy({ dailyBudgetMicroUsd: 1000000, confirmation: 'verified-new-empty-cost-journal' });
  const workerSecret = 'shutdown-fixture-secret-at-least-32-characters';
  let worker, source, gatewayPort, providerState = 'IN_PROGRESS', runs = 0, cancels = 0;
  const pendingProvider = new Set();
  const provider = createServer(async (req, res) => {
    pendingProvider.add(res); res.on('close', () => pendingProvider.delete(res));
    const reply = value => { if (!res.destroyed) { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(value)); } };
    if (req.url === '/run') {
      runs++;
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const input = JSON.parse(Buffer.concat(chunks)).input;
      worker = new WebSocket(`ws://127.0.0.1:${gatewayPort}/lipsync-worker`, {
        headers: { host: 'game.example.test', authorization: `Bearer ${workerSecret}`, 'x-worker-id': input.worker_id } });
      worker.on('error', () => {});
      worker.on('message', bytes => {
        const message = JSON.parse(bytes.toString());
        if (message.t === 'abort') setTimeout(() => {
          if (worker.readyState === WebSocket.OPEN) worker.send(JSON.stringify({ t: 'error', id: message.id, error: 'fixture cancelled' }));
        }, 20);
        if (message.t === 'bye' && mode === 'natural') setTimeout(() => { providerState = 'COMPLETED'; }, 140);
      });
      await once(worker, 'open');
      reply({ id: 'shutdown-fixture-job', status: 'IN_QUEUE' }); return;
    }
    if (req.url === '/status/shutdown-fixture-job') {
      await pause(55); reply({ id: 'shutdown-fixture-job', status: providerState }); return;
    }
    if (req.url === '/cancel/shutdown-fixture-job') {
      cancels++; emit('provider:cancel');
      if (mode === 'timeout') return; // Actual pending HTTP, aborted by runtime deadline.
      await pause(180); providerState = 'CANCELLED';
      reply({ id: 'shutdown-fixture-job', status: providerState }); return;
    }
    res.writeHead(404); res.end();
  });
  const providerPort = await listen(provider);
  const relay = attachSpeechRelay(server, { workerSecret, allowedOrigins: ['https://game.example.test'],
    authenticateClient: async () => ({ userId: 'fixture-owner', sessionId: 'fixture-client' }),
    onSessionReady: identity => { source = relay.openSource({ ...identity, rate: 24000 }); emit('client:active'); } });
  const slowJournal = { ...journal, async confirmWorkerDrained(input) {
    await pause(45);
    const result = await journal.confirmWorkerDrained(input); emit('journal:terminal'); return result;
  } };
  const manager = createJournalSpeechSessionManager({ apiKey: 'fixture-only', endpointId: 'shutdown-fixture',
    workerSecret, origin: 'https://game.example.test' }, {
    journal: slowJournal, policy: SPEECH_SESSION_POLICY, reserveMicroUsd: 200000, dailyBudgetMicroUsd: 1000000,
    workerState: id => id ? relay.workerStatus(id) : relay.status(), stopWorker: id => relay.stopWorker(id),
    readyTimeoutMs: mode === 'natural' ? 1000 : 130, pollMs: 20,
    fetchImpl: (url, options) => {
      if (!url.startsWith('https://api.runpod.ai/v2/shutdown-fixture/')) throw Error('unexpected provider');
      // Real HTTP and AbortSignal; every call is redirected to this fixture's
      // loopback provider, never a cloud provider or production account.
      return fetch(`http://127.0.0.1:${providerPort}/${url.slice('https://api.runpod.ai/v2/shutdown-fixture/'.length)}`, options);
    } });
  const snapshot = () => {
    const session = [...pool.state.sessions.values()][0];
    return { terminal: session?.terminal_status ?? null, released: session?.released_at_ms != null,
      reservations: pool.state.reservations.size, runs, cancels, workers: relay.status().workers,
      busy: relay.status().busy, available: relay.status().available };
  };
  const shutdown = installGracefulShutdown({ server, httpTimeoutMs: 40,
    runtimeTimeoutMs: mode === 'timeout' ? 380 : 1500, storageTimeoutMs: 200,
    closeRuntime: async ({ signal }) => {
      emit('runtime:start'); source?.abort();
      try { await manager.close({ signal }); }
      finally {
        const workerClosed = worker?.readyState === WebSocket.CLOSED ? Promise.resolve() : once(worker, 'close');
        relay.close(); await workerClosed; emit('runtime:snapshot', snapshot());
      }
    }, closeStorage: async () => {
      emit('storage:start', snapshot()); await pause(30);
      for (const res of pendingProvider) res.destroy();
      await close(provider); emit('storage:closed');
    } });
  let completion;
  process.on('SIGTERM', () => completion ??= shutdown.stop().then(result => {
    emit('web:stopped', { ...result, ...snapshot() });
    if (result.completed) process.disconnect();
  }));
  process.on('message', async message => {
    if (message.command !== 'start') return;
    gatewayPort = message.gatewayPort;
    await manager.ensure({ beforeCostly: async () => {} }); emit('worker:ready', snapshot());
  });
  emit('web:listening', { port: await listen(server) });
}
