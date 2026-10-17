// Local-only recording of the lab's existing, sanitized observation API.
// No game/table/wallet commands, credentials, or browser automation.
import { mkdir, writeFile, appendFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { sanitizeObservation } from '../apps/studio/lib/partner-trace.mjs';
import { autoArchiveLocalArtifacts } from './retention-archive.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const startedAt = new Date().toISOString();
const directory = resolve(root, 'apps/studio/data/observations', startedAt.replace(/[:.]/g, '-'));
await mkdir(directory, { recursive: true });
const base = 'http://127.0.0.1:4188';
const abort = new AbortController();
let reason = 'upstream-ended', count = 0, roundCount = 0, bytes = 0;
const stop = why => { reason = why; abort.abort(); };
const deadline = setTimeout(() => stop('ten-minute-limit'), 10 * 60 * 1000);
const poll = setInterval(() => { void access(resolve(directory, 'STOP')).then(() => stop('operator-stop')).catch(() => {}); }, 500);
process.once('SIGINT', () => stop('operator-interrupt'));
const save = (name, value) => writeFile(resolve(directory, name), JSON.stringify(sanitizeObservation(value), null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ directory, startedAt, stop: 'Create STOP in this directory to end capture.' }));
try {
  for (const action of ['verify', 'mapping']) {
    const response = await fetch(`${base}/api/inputs/reference`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify({ action }), signal: AbortSignal.any([abort.signal, AbortSignal.timeout(20000)]) });
    const data = await response.json();
    await save(`${action}.json`, { capturedAt: new Date().toISOString(), source: '/api/inputs/reference', action, status: response.status, data });
  }
  const response = await fetch(`${base}/api/inputs/events`, { signal: abort.signal });
  if (!response.ok || !response.headers.get('content-type')?.includes('text/event-stream')) throw new Error(`Local observer rejected: ${response.status}`);
  await writeFile(resolve(directory, 'partner-events.jsonl'), '', { flag: 'wx' });
  console.log('Recording Partner SSE; no game command sent.');
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let pending = '';
  try {
    while (!abort.signal.aborted) {
      const chunk = await reader.read(); if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 16 * 1024 * 1024) { stop('sixteen-MiB-limit'); break; }
      pending += decoder.decode(chunk.value, { stream: true });
      let index;
      while ((index = pending.indexOf('\n\n')) >= 0) {
        const frame = pending.slice(0, index); pending = pending.slice(index + 2);
        const payload = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
        if (!payload) continue;
        const record = sanitizeObservation(JSON.parse(payload));
        await appendFile(resolve(directory, 'partner-events.jsonl'), JSON.stringify(record) + '\n');
        count++; if (record.kind === 'round') roundCount++;
      }
    }
  } finally { await reader.cancel().catch(() => {}); }
} catch (error) {
  if (!abort.signal.aborted) { reason = 'capture-error'; await save('error.json', { message: String(error.message).replace(/https?:\/\/\S+/g, '[address]') }); }
} finally {
  clearInterval(poll); clearTimeout(deadline);
  await save('session.json', { startedAt, endedAt: new Date().toISOString(), reason, records: count, rounds: roundCount, receivedBytes: bytes, source: 'Local lab observer -> Partner SSE', originalPlayerTelemetry: false, replay: false });
  console.log(JSON.stringify({ directory, reason, records: count, rounds: roundCount }));
  await autoArchiveLocalArtifacts('observations');
}
