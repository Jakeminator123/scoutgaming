import assert from 'node:assert/strict';
import { test } from 'node:test';
import { labUrl, stripLabBasePath, publicAbsoluteUrl } from '../lib/lab-url.mjs';
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

test('public root redirect admits exact Admin without accepting external or auth destinations', () => {
  const headers = new Headers({host:'studio.internal.invalid','x-forwarded-host':'public.example.invalid','x-forwarded-proto':'https'});
  assert.equal(publicAbsoluteUrl(headers, '/admin'), 'https://public.example.invalid/admin');
  assert.equal(publicAbsoluteUrl(headers, '/admin/dealer-studio?dealer=saga&view=clips#idle'), 'https://public.example.invalid/admin/dealer-studio?dealer=saga&view=clips#idle');
  for(const path of ['/admin/dealer-studio-extra','/admin/dealer-studio/edit','/admin/dealer-studio/../login'])assert.throws(()=>publicAbsoluteUrl(headers,path),/control_redirect_rejected/);
  for (const path of ['/admin/ai/models?dealer=saga&operator=north#models','/admin/dealer-agent?dealer=saga&event=idle.ready&composition=portrait']) {
    assert.equal(publicAbsoluteUrl(headers,path),'https://public.example.invalid'+path);
  }
  for (const path of ['/admin/ai/models-extra','/admin/ai/models/edit','/admin/dealer-agent-extra','/admin/dealer-agent/edit','/admin/ai/models/../login']) {
    assert.throws(() => publicAbsoluteUrl(headers,path),/control_redirect_rejected/);
  }
  for(const path of ['/admin/publication?operator=north&room=room-1&game=roulette#review','/admin/companies?operator=north','/admin/guide?dealer=saga','/admin/videos?dealer=saga&event=idle.ready#clips','/admin/probe?dealer=astrid&event=idle.ready','/admin/replies?dealer=saga&category=greeting','/admin/events?dealer=saga&event=idle.ready&tab=variants','/admin/compositions?composition=portrait&operator=north&table=room-1&game=roulette','/admin/rehearsal?dealer=saga&composition=portrait&operator=north&table=room-1'])assert.equal(publicAbsoluteUrl(headers,path),'https://public.example.invalid'+path);
  assert.equal(publicAbsoluteUrl(headers, '/control/clips?dealer=vera'), 'https://public.example.invalid/control/clips?dealer=vera');
  for (const value of ['https://outside.invalid/admin','//outside.invalid/admin','/administrator','/admin/publication-extra','/admin/publication/../login','/admin/companies/edit','/admin/videos-extra','/admin/guide/edit','/admin/probe-extra','/admin/replies/edit','/admin/events-extra','/admin/compositions-extra','/admin/rehearsal/edit','/admin/tree','/admin/login','/admin?returnTo=https://outside.invalid','/studio/login','/admin\\outside','/admin#secret']) {
    assert.throws(() => publicAbsoluteUrl(headers, value), /control_redirect_rejected/);
  }
});
