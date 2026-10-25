import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { WEB_PORT } from './config.mjs';
import { SHUTDOWN_BUDGET, trackServerConnections } from '../../services/game/graceful-shutdown.mjs';

// An explicit diagnostic subscriber receives bounded complete lines. Ordinary
// children keep their discarded output; no stderr is exposed by this option.
export function observeChildStdout(stdout, onLine) {
  let pending = '', dropping = false;
  stdout.setEncoding('utf8');
  stdout.on('error', () => {});
  stdout.on('data', chunk => {
    for (const part of String(chunk).split(/(?<=\n)/)) {
      const ended = part.endsWith('\n');
      if (!dropping) {
        pending += part;
        if (Buffer.byteLength(pending) > 8192) {pending = ''; dropping = true;}
      }
      if (ended) {
        if (!dropping) {try {onLine(pending.trimEnd());} catch { /* Diagnostics cannot stop a child. */ }}
        pending = ''; dropping = false;
      }
    }
  });
}

export async function assertChildPortsFree(ports = [WEB_PORT]) {
  for (const port of ports) {
    const server = createServer();
    try {
      await new Promise((resolveReady, reject) => {
        const onError = error => reject(error);
        server.once('error', onError);
        server.listen(port, '127.0.0.1', () => { server.off('error', onError); resolveReady(); });
      });
    } catch { throw new Error('A cloud child port is already in use.'); }
    finally { if (server.listening) await new Promise(resolveClosed => server.close(resolveClosed)); }
  }
}

const terminations = new WeakMap();
export function terminateChild(child, timeoutMs = SHUTDOWN_BUDGET.childMs) {
  if (child && terminations.has(child)) return terminations.get(child);
  const pending = terminateOnce(child, timeoutMs);
  if (child) terminations.set(child, pending);
  return pending;
}
async function terminateOnce(child, timeoutMs) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise(resolve => child.once('close', resolve));
  child.kill('SIGTERM');
  const force = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
  force.unref?.();
  try { await exited; } finally { clearTimeout(force); }
}

export async function closeGateway(server, timeoutMs = SHUTDOWN_BUDGET.httpMs) {
  if (!server) return;
  const sockets = trackServerConnections(server);
  if (!server.listening && !sockets.sockets.size) return;
  const closed = !server.listening ? Promise.resolve() : new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  server.closeIdleConnections?.();
  const force = setTimeout(() => { server.closeAllConnections?.(); sockets.destroy(); }, timeoutMs);
  try { await Promise.all([closed, sockets.waitForEmpty()]); } finally { clearTimeout(force); }
}

export async function waitForChild(child, url, acceptable, timeoutMs = 30000, signal) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (signal?.aborted || !child.pid || child.exitCode !== null || child.signalCode !== null) throw new Error('A cloud child exited before readiness.');
    try {
      const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(1000) });
      const ready = await acceptable(response);
      if (!response.bodyUsed) await response.body?.cancel();
      if (ready) return;
    } catch { /* Still starting. */ }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('A cloud child did not become ready.');
}

export async function startChildren(specs, { spawnProcess = spawn, wait = waitForChild,
  portCheck = assertChildPortsFree, signal } = {}) {
  let web, webExit;
  let stopPromise;
  const stop = () => stopPromise ??= terminateChild(web);
  try {
    if (signal?.aborted) throw new Error('Cloud start was interrupted.');
    if (!specs?.web || Object.keys(specs).some(name => name !== 'web')) throw new Error('Cloud runtime accepts only the game child.');
    await portCheck([WEB_PORT]);
    if (signal?.aborted) throw new Error('Cloud start was interrupted.');
    // Each stream is observed only when an explicit line filter is supplied;
    // console.warn diagnostics arrive on stderr, console.info on stdout.
    const observeOut = typeof specs.web.onStdoutLine === 'function', observeErr = typeof specs.web.onStderrLine === 'function';
    web = spawnProcess(specs.web.command, specs.web.args,
      { cwd: specs.web.cwd, env: specs.web.env,
        stdio: observeOut || observeErr ? ['ignore', observeOut ? 'pipe' : 'ignore', observeErr ? 'pipe' : 'ignore'] : 'ignore', windowsHide: true });
    web.on('error', () => {});
    if (observeOut) observeChildStdout(web.stdout, specs.web.onStdoutLine);
    if (observeErr) observeChildStdout(web.stderr, specs.web.onStderrLine);
    webExit = new Promise(resolve => web.once('exit', () => resolve('web-exit')));
    await wait(web, 'http://127.0.0.1:4173/api/auth/access', response => [200, 302, 401].includes(response.status), 30000, signal);
    if (signal?.aborted) throw new Error('Cloud start was interrupted.');
    if (web.exitCode !== null || web.signalCode !== null) throw new Error('A cloud child exited before readiness.');
    return { web, stop, ended: webExit };
  } catch (error) { await stop(); throw error; }
}
