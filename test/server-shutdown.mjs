import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createServer } from 'node:http';
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
