import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { createCloudGateway } from '../gateway.mjs';
import { terminateChild, closeGateway } from '../process-group.mjs';
import { stopCloudRuntime } from '../start.mjs';
import { SHUTDOWN_BUDGET, trackServerConnections } from '../../../services/game/graceful-shutdown.mjs';

const { WebSocket } = createRequire(new URL('../../../services/astrid-gpu-worker/gateway/package.json', import.meta.url))('ws');
const script = fileURLToPath(new URL('../../../test/fixtures/shutdown-process.mjs', import.meta.url));
function child(role, mode) {
  const processChild = spawn(process.execPath, [script, role, mode], {
    env: { PATH: process.env.PATH }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'], windowsHide: true });
  const messages = [], waits = new Set(); let errors = '';
  processChild.stderr.on('data', data => { errors += data; });
  processChild.on('message', message => { messages.push(message); for (const wait of waits) wait(); });
  const until = phase => new Promise((resolve, reject) => {
    const timer = setTimeout(() => { waits.delete(check); reject(Error(`fixture phase ${phase} missing: ${errors.slice(0, 1000)}`)); }, 3500);
    const check = () => {
      const message = messages.find(item => item.phase === phase);
      if (message) { clearTimeout(timer); waits.delete(check); resolve(message); }
    };
    waits.add(check); check();
  });
  return { child: processChild, messages, until };
}

test('the child/host deadline leaves margin after runtime, HTTP and storage', () => {
  assert.equal(SHUTDOWN_BUDGET.runtimeMs, SHUTDOWN_BUDGET.naturalWorkerMs + SHUTDOWN_BUDGET.providerRequestMs + SHUTDOWN_BUDGET.journalFlushMs);
  assert.ok(SHUTDOWN_BUDGET.runtimeMs + SHUTDOWN_BUDGET.httpMs + SHUTDOWN_BUDGET.storageMs < SHUTDOWN_BUDGET.childMs);
  assert.ok(SHUTDOWN_BUDGET.childMs < SHUTDOWN_BUDGET.hostMs);
});

for (const mode of ['natural', 'cancel', 'timeout']) test(`Linux SIGTERM chain with worker/client WebSockets and ${mode} provider shutdown`,
  { skip: process.platform !== 'linux', timeout: 6500 }, async t => {
    const web = child('web', mode), lab = child('lab', mode);
    let gateway, client;
    t.after(async () => {
      client?.terminate();
      await Promise.all([terminateChild(web.child, 100), terminateChild(lab.child, 100)]);
      await closeGateway(gateway, 100);
    });
    const [webReady, labReady] = await Promise.all([web.until('web:listening'), lab.until('lab:listening')]);
    const config = { gameOrigin: 'https://game.example.test', boOrigin: 'https://bo.example.test',
      labOrigin: 'https://lab.example.test', streaming: true };
    gateway = createCloudGateway(config, { labInternalSecret: 'fixture-gateway-secret-at-least-32-characters',
      webPort: webReady.port, labPort: labReady.port });
    trackServerConnections(gateway);
    gateway.listen(0, '127.0.0.1'); await once(gateway, 'listening');
    web.child.send({ command: 'start', gatewayPort: gateway.address().port });
    const ready = await web.until('worker:ready');
    assert.equal(ready.workers, 1); assert.equal(ready.available, 1);
    client = new WebSocket(`ws://127.0.0.1:${gateway.address().port}/speech-stream`, ['astrid-v2'], {
      headers: { host: 'game.example.test' }, origin: 'https://game.example.test' });
    client.on('error', () => {});
    await Promise.all([once(client, 'open'), web.until('client:active')]);
    const clientClosed = once(client, 'close');
    const before = performance.now();
    let groupStop;
    // Scaled fixture runtime1500 + HTTP40 + storage200 stays below force2000.
    const group = { stop: () => groupStop ??= Promise.all([terminateChild(lab.child, 2000), terminateChild(web.child, 2000)]) };
    const stopping = stopCloudRuntime(gateway, group);
    // A second parent shutdown cannot duplicate child/provider cancellation.
    void group.stop();
    const runtime = await web.until('runtime:start'); assert.ok(runtime);
    await lab.until('lab:signal');
    const stopped = await web.until('web:stopped');
    const snapshot = await web.until('runtime:snapshot');
    await stopping; await clientClosed;
    assert.ok(performance.now() - before < 3000);
    assert.equal(snapshot.runs, 1); assert.equal(snapshot.workers, 0);
    assert.ok(snapshot.reservations > 0, 'reservations never reset/refund');
    if (mode === 'timeout') {
      assert.equal(stopped.completed, false); assert.equal(stopped.timedOut, 'runtime');
      assert.equal(snapshot.terminal, null); assert.equal(snapshot.released, false);
      assert.equal(snapshot.cancels, 1);
      assert.equal(web.messages.some(message => message.phase === 'storage:start'), false);
      assert.equal(web.child.signalCode, 'SIGKILL', 'parent enforces final boundary while journal remains recoverable');
    } else {
      assert.equal(stopped.completed, true);
      assert.equal(snapshot.terminal, mode === 'natural' ? 'COMPLETED' : 'CANCELLED');
      assert.equal(snapshot.released, true); assert.equal(snapshot.cancels, mode === 'natural' ? 0 : 1);
      const phases = web.messages.map(message => message.phase);
      assert.ok(phases.indexOf('journal:terminal') < phases.indexOf('storage:start'));
      assert.equal(web.child.exitCode, 0); assert.equal(web.child.signalCode, null);
    }
  });
