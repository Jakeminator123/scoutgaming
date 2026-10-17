import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertLocalPageRequest, assertLocalRequest, readLocalJson } from '../lib/http-guard.mjs';

const LAB = 'https://lab.example.test';
const SECRET = '0123456789abcdef'.repeat(4);
const forbidden = error => error?.statusCode === 403;
const cloudHeaders = (extra = {}) => ({
  Host: 'lab.example.test',
  'X-Forwarded-Host': 'lab.example.test',
  'X-Forwarded-Proto': 'https',
  'X-Croupier-Lab-Authorized': SECRET,
  ...extra,
});
const request = (path = '/api/project', options = {}) =>
  new Request(`${LAB}${path}`, { ...options, headers: cloudHeaders(options.headers) });

test('cloud Lab guard requires exact gateway authority and same-origin mutations', async () => {
  const oldUrl = process.env.LAB_PUBLIC_URL;
  const oldSecret = process.env.CROUPIER_LAB_INTERNAL_SECRET;
  process.env.LAB_PUBLIC_URL = LAB;
  process.env.CROUPIER_LAB_INTERNAL_SECRET = SECRET;
  try {
    assert.doesNotThrow(() => assertLocalRequest(request()));
    assert.doesNotThrow(() => assertLocalRequest(request('/api/project', {
      method: 'POST', headers: { Origin: LAB, 'Sec-Fetch-Site': 'same-origin' },
    })));
    const json = request('/api/project', {
      method: 'POST', body: '{"saved":true}',
      headers: { Origin: LAB, 'Content-Type': 'application/json' },
    });
    assert.deepEqual(await readLocalJson(json), { saved: true });

    for (const headers of [
      { 'X-Croupier-Lab-Authorized': '' },
      { 'X-Croupier-Lab-Authorized': 'f'.repeat(64) },
      { Host: 'game.example.test' },
      { Host: 'lab.example.test:443' },
      { 'X-Forwarded-Host': 'game.example.test' },
      { 'X-Forwarded-Proto': 'http' },
    ]) assert.throws(() => assertLocalRequest(request('/api/project', { headers })), forbidden);
    assert.throws(() => assertLocalRequest(new Request(`${LAB}/api/project`)), forbidden);
    assert.throws(() => assertLocalRequest(new Request('https://game.example.test/api/project', {
      headers: cloudHeaders(),
    })), forbidden);

    for (const headers of [
      {}, { Origin: 'https://game.example.test' }, { Origin: `${LAB}/path` },
      { Origin: 'null' }, { Origin: LAB, 'Sec-Fetch-Site': 'same-site' },
      { Origin: LAB, 'Sec-Fetch-Site': 'cross-site' },
    ]) assert.throws(() => assertLocalRequest(request('/api/project', { method: 'POST', headers })), forbidden);
    assert.throws(() => assertLocalRequest(request('/api/project', {
      headers: { 'Sec-Fetch-Site': 'same-site' },
    })), forbidden);

    const page = new Request('http://lab.example.test/control', {
      headers: cloudHeaders({ 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Site': 'cross-site' }),
    });
    assert.doesNotThrow(() => assertLocalPageRequest(page));
    assert.throws(() => assertLocalPageRequest(new Request('http://lab.example.test/control', {
      headers: cloudHeaders({ 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Dest': 'iframe' }),
    })), forbidden);

    assert.doesNotThrow(() => assertLocalRequest(new Request('http://127.0.0.1:4188/api/health')));
    assert.throws(() => assertLocalRequest(new Request('http://127.0.0.1:4188/api/project')), forbidden);
  } finally {
    if (oldUrl === undefined) delete process.env.LAB_PUBLIC_URL;
    else process.env.LAB_PUBLIC_URL = oldUrl;
    if (oldSecret === undefined) delete process.env.CROUPIER_LAB_INTERNAL_SECRET;
    else process.env.CROUPIER_LAB_INTERNAL_SECRET = oldSecret;
  }
});

test('incomplete cloud settings never expose a public Lab host', () => {
  const oldUrl = process.env.LAB_PUBLIC_URL;
  const oldSecret = process.env.CROUPIER_LAB_INTERNAL_SECRET;
  process.env.LAB_PUBLIC_URL = LAB;
  delete process.env.CROUPIER_LAB_INTERNAL_SECRET;
  try { assert.throws(() => assertLocalRequest(request()), forbidden); }
  finally {
    if (oldUrl === undefined) delete process.env.LAB_PUBLIC_URL;
    else process.env.LAB_PUBLIC_URL = oldUrl;
    if (oldSecret === undefined) delete process.env.CROUPIER_LAB_INTERNAL_SECRET;
    else process.env.CROUPIER_LAB_INTERNAL_SECRET = oldSecret;
  }
});
