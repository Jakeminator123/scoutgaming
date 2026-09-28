import assert from 'node:assert/strict';
import { test } from 'node:test';
import { labUrl, stripLabBasePath } from '../lib/lab-url.mjs';
import { assertLocalRequest } from '../lib/http-guard.mjs';

test('Lab URLs support a build-time mount without changing local or external links', () => {
  const before = process.env.NEXT_PUBLIC_LAB_BASE_PATH;
  try {
    delete process.env.NEXT_PUBLIC_LAB_BASE_PATH;
    assert.equal(labUrl('/api/project'), '/api/project');
    process.env.NEXT_PUBLIC_LAB_BASE_PATH = '/studio';
    for (const path of ['/api/project', '/api/videos/abc', '/openclaw']) {
      assert.equal(labUrl(path), '/studio' + path);
      assert.equal(stripLabBasePath(labUrl(path)), path);
      assert.equal(labUrl(labUrl(path)), labUrl(path));
    }
    assert.equal(labUrl('/'), '/studio');
    assert.equal(stripLabBasePath('/studio'), '/');
    for (const value of ['https://game.example.test/', '//external.test/x', '#tab', 'blob:test']) assert.equal(labUrl(value), value);
    assert.equal(stripLabBasePath('/studio-other/api'), '/studio-other/api');
  } finally { if (before === undefined) delete process.env.NEXT_PUBLIC_LAB_BASE_PATH; else process.env.NEXT_PUBLIC_LAB_BASE_PATH = before; }
});

test('mounted Lab only permits loopback health, not loopback data access', () => {
  const keys = ['NEXT_PUBLIC_LAB_BASE_PATH', 'LAB_PUBLIC_URL', 'CROUPIER_LAB_INTERNAL_SECRET'];
  const before = keys.map(key => process.env[key]);
  try {
    process.env.NEXT_PUBLIC_LAB_BASE_PATH = '/studio';
    process.env.LAB_PUBLIC_URL = 'https://game.example.test';
    process.env.CROUPIER_LAB_INTERNAL_SECRET = 'fixture-secret-'.repeat(4);
    assert.doesNotThrow(() => assertLocalRequest(new Request('http://127.0.0.1:4188/studio/api/health')));
    assert.throws(() => assertLocalRequest(new Request('http://127.0.0.1:4188/studio/api/project')), error => error.statusCode === 403);
  } finally { keys.forEach((key, i) => { if (before[i] === undefined) delete process.env[key]; else process.env[key] = before[i]; }); }
});
