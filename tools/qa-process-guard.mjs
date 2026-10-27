// In-process isolation for local QA harnesses (tools/admin-clips-fixture.mjs).
// Install before importing repository modules: env files read as absent and
// outbound TCP/fetch is limited to the harness's own loopback ports.
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import net from 'node:net';
import { syncBuiltinESMExports } from 'node:module';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const GUARD_INSTALLED = Symbol.for('croupier.qa-process.guard');

export function installQaProcessGuard({ ports } = {}) {
  if (globalThis[GUARD_INSTALLED]) return;
  const allowedPorts = new Set((Array.isArray(ports) ? ports : []).map(String).filter(port => /^[1-9][0-9]{0,4}$/.test(port) && Number(port) <= 65535));
  if (!allowedPorts.size) throw new Error('QA process guard needs explicit local ports.');
  globalThis[GUARD_INSTALLED] = true;
  const blockedEnv = value => {
    if (typeof value === 'number') return false;
    let name;
    try { name = basename(value instanceof URL ? fileURLToPath(value) : String(value)).toLowerCase(); }
    catch { return false; }
    return name === 'agent.env' || name === '.env' || name.startsWith('.env.');
  };
  const absent = () => Object.assign(new Error('Environment files are disabled in isolated QA.'), { code: 'ENOENT' });
  const readSync = fs.readFileSync, read = fs.readFile, readAsync = fsPromises.readFile;
  fs.readFileSync = function (file, ...args) { if (blockedEnv(file)) throw absent(); return readSync.call(this, file, ...args); };
  fs.readFile = function (file, ...args) {
    if (blockedEnv(file)) { queueMicrotask(() => args.at(-1)(absent())); return; }
    return read.call(this, file, ...args);
  };
  fsPromises.readFile = async function (file, ...args) { if (blockedEnv(file)) throw absent(); return readAsync.call(this, file, ...args); };
  syncBuiltinESMExports();
  const blockedNetwork = () => Object.assign(new Error('Only the isolated QA servers are reachable.'), { code: 'QA_NETWORK_BLOCKED' });
  const allowed = (host, port) => LOOPBACK.has(String(host || 'localhost').toLowerCase()) && allowedPorts.has(String(port));
  const fetchLocal = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    if (!['http:', 'https:'].includes(url.protocol) || !allowed(url.hostname, url.port || (url.protocol === 'https:' ? 443 : 80))) throw blockedNetwork();
    return fetchLocal(input, init);
  };
  const connect = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function (...args) {
    const first = Array.isArray(args[0]) ? args[0][0] : args[0];
    // Keep local IPC pipes available to Node workers. TCP is restricted.
    if (typeof first === 'object' && first?.path || typeof first === 'string' && !/^\d+$/.test(first)) return connect.apply(this, args);
    const host = typeof first === 'object' ? first.host ?? first.hostname : typeof args[1] === 'string' ? args[1] : 'localhost';
    const port = typeof first === 'object' ? first.port : first;
    if (!allowed(host, port)) throw blockedNetwork();
    return connect.apply(this, args);
  };
}
