import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { test } from 'node:test';
import { checkLabSession } from '../lab-session-check.mjs';

test('Lab session check uses only loopback Web with the exact Lab Host and cookie', async () => {
  const seen = [];
  const server = createServer((request, response) => {
    seen.push({ host: request.headers.host, path: request.url, cookie: request.headers.cookie });
    response.writeHead(request.headers.cookie === 'lab_session=valid' ? 200 : 401);
    response.end();
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const port = server.address().port;
    assert.deepEqual(await checkLabSession('lab_session=valid', 'lab.example.test', { port }),
      { authorized: true, available: true });
    assert.deepEqual(await checkLabSession('lab_session=old', 'lab.example.test', { port }),
      { authorized: false, available: true });
    assert.deepEqual(await checkLabSession('', 'lab.example.test', { port }),
      { authorized: false, available: true });
    assert.deepEqual(seen, [
      { host: 'lab.example.test', path: '/api/auth/lab/check', cookie: 'lab_session=valid' },
      { host: 'lab.example.test', path: '/api/auth/lab/check', cookie: 'lab_session=old' },
    ]);
  } finally { server.close(); await once(server, 'close'); }
});

test('Lab check fails closed on Web errors and unavailable endpoints', async () => {
  const server = createServer((_request, response) => { response.writeHead(503); response.end(); });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  try {
    assert.deepEqual(await checkLabSession('lab_session=valid', 'lab.example.test', { port }),
      { authorized: false, available: false });
  } finally { server.close(); await once(server, 'close'); }
  assert.deepEqual(await checkLabSession('lab_session=valid', 'lab.example.test', { port, timeoutMs: 250 }),
    { authorized: false, available: false });
});
