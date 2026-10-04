import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createServer } from 'node:http';
import { connect } from 'node:net';
import { once } from 'node:events';
import { installGracefulShutdown } from '../web/graceful-shutdown.mjs';

class FakeServer extends EventEmitter {
  closeCalls = 0;
  idleCloseCalls = 0;
  close(callback) {
    this.closeCalls++;
    queueMicrotask(() => { this.emit('close'); callback(); });
  }
  closeIdleConnections() { this.idleCloseCalls++; }
}

test('SIGTERM closes HTTP once, cancels accepted speech and preserves terminal journal order before storage', async () => {
  const server = new FakeServer(), processTarget = new EventEmitter();
  processTarget.exitCode = undefined;
  const activity = [];
  let releaseJournal;
  const journalTerminal = new Promise(resolve => { releaseJournal = resolve; });
  const shutdown = installGracefulShutdown({ server, processTarget, closeRuntime: async () => {
    activity.push('speech:cancel');
    await journalTerminal;
    activity.push('journal:terminal');
  }, closeStorage: async () => { activity.push('storage:close'); } });
  processTarget.emit('SIGTERM');
  processTarget.emit('SIGINT');
  assert.equal(server.closeCalls, 1);
  assert.equal(server.idleCloseCalls, 1);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(activity, ['speech:cancel']);
  let stopped = false;
  shutdown.stop().then(() => { stopped = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(stopped, false, 'shutdown must await the terminal journal receipt');
  releaseJournal();
  await shutdown.stop();
  assert.equal(stopped, true);
  assert.deepEqual(activity, ['speech:cancel', 'journal:terminal', 'storage:close']);
  assert.equal(processTarget.exitCode, undefined);
});

test('natural server close runs runtime cleanup once without waiting for a signal', async () => {
  const server = new FakeServer(), processTarget = new EventEmitter();
  processTarget.exitCode = undefined;
  let closes = 0, storageCloses = 0;
  const shutdown = installGracefulShutdown({ server, processTarget,
    closeRuntime: async () => { closes++; }, closeStorage: async () => { storageCloses++; } });
  server.emit('close');
  await shutdown.closeRuntime();
  await shutdown.closeStorage();
  await shutdown.closeRuntime();
  await shutdown.closeStorage();
  await shutdown.stop();
  assert.equal(closes, 1);
  assert.equal(storageCloses, 1);
  assert.equal(processTarget.listenerCount('SIGINT'), 0);
  assert.equal(processTarget.listenerCount('SIGTERM'), 0);
});

test('runtime and storage failures are sanitized, mark failure and still run each phase once', async () => {
  const server = new FakeServer(), processTarget = new EventEmitter();
  processTarget.exitCode = undefined;
  let runtimeCloses = 0, storageCloses = 0;
  const shutdown = installGracefulShutdown({ server, processTarget,
    closeRuntime: async () => { runtimeCloses++; throw new Error('private provider failure'); },
    closeStorage: async () => { storageCloses++; throw new Error('private storage failure'); } });
  await shutdown.stop();
  await shutdown.stop();
  assert.equal(server.closeCalls, 1);
  assert.equal(runtimeCloses, 1);
  assert.equal(storageCloses, 1);
  assert.equal(processTarget.exitCode, 1);
});

test('SIGTERM cancels a pending real HTTP response before drain and closes storage only after drain', async t => {
  const processTarget = new EventEmitter();
  processTarget.exitCode = undefined;
  const activity = [];
  let response, responseTimer, requestStartedResolve, cancelReachedResolve;
  const requestStarted = new Promise(resolve => { requestStartedResolve = resolve; });
  const cancelReached = new Promise(resolve => { cancelReachedResolve = resolve; });
  const server = createServer((_request, currentResponse) => {
    response = currentResponse;
    requestStartedResolve();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const clientController = new AbortController();
  let pendingResponse;
  t.after(async () => {
    clearTimeout(responseTimer);
    clientController.abort();
    if (response && !response.writableEnded) response.destroy();
    server.closeAllConnections?.();
    if (server.listening) await new Promise(resolve => server.close(() => resolve()));
    await pendingResponse?.catch(() => {});
  });
  server.once('close', () => activity.push('http:drained'));
  const shutdown = installGracefulShutdown({ server, processTarget, closeRuntime: async () => {
    activity.push('runtime:cancel');
    cancelReachedResolve();
    responseTimer = setTimeout(() => { activity.push('response:end'); response.end('cancelled'); }, 25);
    activity.push('journal:terminal');
  }, closeStorage: async () => { activity.push('storage:close'); } });
  pendingResponse = fetch(`http://127.0.0.1:${server.address().port}/pending`, { signal: clientController.signal }).then(result => result.text());
  await requestStarted;
  processTarget.emit('SIGTERM');
  let timeout;
  try {
    await Promise.race([cancelReached, new Promise((_, reject) => { timeout = setTimeout(() => reject(Error('runtime cancellation waited for HTTP drain')), 1000); })]);
  } finally { clearTimeout(timeout); }
  assert.deepEqual(activity, ['runtime:cancel', 'journal:terminal']);
  assert.equal(await pendingResponse, 'cancelled');
  await shutdown.stop();
  assert.deepEqual(activity, ['runtime:cancel', 'journal:terminal', 'response:end', 'http:drained', 'storage:close']);
  assert.equal(processTarget.exitCode, undefined);
});

test('an upgraded socket stays available to runtime cleanup and closes before storage', async t => {
  const server = createServer(), processTarget = new EventEmitter(), activity = [];
  let peer;
  server.on('upgrade', (_req, socket) => {
    peer = socket; socket.write('HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n');
  });
  const shutdown = installGracefulShutdown({ server, processTarget, httpTimeoutMs: 15,
    closeRuntime: async () => {
      activity.push('runtime:start');
      await new Promise(resolve => setTimeout(resolve, 45));
      assert.equal(peer.destroyed, false, 'do not destroy the worker before provider cleanup');
      activity.push('journal:terminal');
    }, closeStorage: async () => { assert.equal(peer.destroyed, true); activity.push('storage:close'); } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const client = connect(server.address().port, '127.0.0.1');
  t.after(() => { client.destroy(); peer?.destroy(); server.close(); });
  await once(client, 'connect');
  client.write('GET /fixture HTTP/1.1\r\nHost: fixture.invalid\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n');
  await once(client, 'data');
  processTarget.emit('SIGTERM'); processTarget.emit('SIGTERM');
  await shutdown.stop();
  assert.deepEqual(activity, ['runtime:start', 'journal:terminal', 'storage:close']);
  assert.equal(processTarget.exitCode, undefined);
});

test('runtime deadline marks failure and preserves storage for unfinished journal writes', async () => {
  const server = new FakeServer(), processTarget = new EventEmitter();
  let signal, release, storageCloses = 0;
  const pending = new Promise(resolve => { release = resolve; });
  const shutdown = installGracefulShutdown({ server, processTarget, runtimeTimeoutMs: 30,
    closeRuntime: async context => { signal = context.signal; await pending; },
    closeStorage: async () => { storageCloses++; } });
  await shutdown.stop();
  assert.equal(signal.aborted, true);
  assert.equal(processTarget.exitCode, 1);
  assert.equal(storageCloses, 0, 'never close the journal pool while its writes are still running');
  release(); await shutdown.closeRuntime();
});
