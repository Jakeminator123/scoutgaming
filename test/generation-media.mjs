import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:net';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openGenerationMedia, closeGenerationMedia } from '../web/generation-media.mjs';
import { startLocalComparison } from '../tools/start-local-comparison.mjs';

async function freePort(host) {
  const server = createServer(); await new Promise(resolve => server.listen(0, host, resolve));
  const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port;
}
const catalog = JSON.parse(readFileSync(new URL('../web/public/bo/generations.json', import.meta.url)));
const [first, second] = catalog;

test('media resolver allows only catalogue names and refuses symlink escapes', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'croupier-media-resolver-'));
  const directory = join(tmp, 'media'); await mkdir(directory);
  const open = fileName => openGenerationMedia({ directory, catalog: [{ id: first.id, thumb: 'https://example.invalid/thumbnail.jpg' }, second], fileName });
  try {
    await writeFile(join(directory, `${first.id}.mp4`), 'fixture bytes');
    await writeFile(join(directory, `${first.id}-thumb.jpg`), 'fixture thumbnail');
    await writeFile(join(directory, `${first.id}-thumb.png`), 'not the declared thumbnail');
    await writeFile(join(tmp, 'outside.mp4'), 'not served');
    await symlink(join(tmp, 'outside.mp4'), join(directory, `${second.id}.mp4`), 'file');
    for (const name of [`${first.id}.mp4`, `${first.id}-thumb.jpg`]) {
      const media = open(name); assert.ok(media); assert.ok(media.size > 0); closeGenerationMedia(media);
    }
    for (const name of [`${second.id}.mp4`, `${first.id}-thumb.png`, '../outside.mp4', `${first.id}.mp4/extra`, 'catalog.json', '.env', '11111111-2222-3333-4444-555555555555.mp4']) assert.equal(open(name), null);
    const linkedDir = join(tmp, 'linked');
    await symlink(directory, linkedDir, process.platform === 'win32' ? 'junction' : 'dir');
    assert.equal(openGenerationMedia({ directory: linkedDir, catalog, fileName: `${first.id}.mp4` }), null);
  } finally { await rm(tmp, { recursive: true, force: true }); }
});

test('explicit media directory serves BO and token API with auth, HEAD and byte ranges', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'croupier-media-http-'));
  const directory = join(tmp, 'media'); await mkdir(directory);
  const bytes = '0123456789abcdefgh';
  await writeFile(join(directory, `${first.id}.mp4`), bytes);
  await writeFile(join(tmp, 'outside.mp4'), 'never exposed');
  await symlink(join(tmp, 'outside.mp4'), join(directory, `${second.id}.mp4`), 'file');
  let fixture;
  try {
    fixture = await startLocalComparison({ startLab: false, gamePort: await freePort('localhost'), labPort: await freePort('127.0.0.1'), generationDirectory: directory });
    const boPath = `/bo/gen/${first.id}.mp4`, apiPath = `/api/v1/generations/${first.id}/video`;
    const get = (path, headers = {}, method = 'GET') => fetch(fixture.gameUrl + path, { method, headers, redirect: 'manual' });
    assert.equal((await get(boPath)).status, 302);
    assert.equal((await get(`/bo%2fgen%2f${first.id}.mp4`)).status, 302, 'encoded separators still require BO auth');
    assert.equal((await get(`/bo%5cgen%5c${first.id}.mp4`)).status, 302, 'Windows separators still require BO auth');
    assert.equal((await get(apiPath)).status, 401);
    const login = await fetch(fixture.gameUrl + '/api/bo/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: fixture.gameUrl }, body: JSON.stringify({ user: fixture.bo.username, pass: fixture.bo.password }) });
    const cookie = login.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
    assert.equal(login.status, 200);
    for (const [path, headers] of [[boPath, { Cookie: cookie }], [apiPath, { Authorization: `Bearer ${fixture.credentials.generations.token}` }]]) {
      const full = await get(path, headers); assert.equal(full.status, 200); assert.equal(await full.text(), bytes);
      const head = await get(path, headers, 'HEAD'); assert.equal(head.status, 200); assert.equal(head.headers.get('content-length'), String(bytes.length)); assert.equal(await head.text(), '');
      const range = await get(path, { ...headers, Range: 'bytes=3-6' }); assert.equal(range.status, 206); assert.equal(range.headers.get('content-range'), `bytes 3-6/${bytes.length}`); assert.equal(await range.text(), '3456');
      const tail = await get(path, { ...headers, Range: 'bytes=-3' }); assert.equal(await tail.text(), 'fgh');
      for (const invalid of ['bytes=-0', 'bytes=4-2', 'bytes=99-', 'bytes=0-1,4-6', 'bytes=-', 'bytes=9007199254740992-']) assert.equal((await get(path, { ...headers, Range: invalid })).status, 416);
      assert.equal((await get(path, headers, 'POST')).status, 405);
    }
    for (const path of [`/bo/gen/${second.id}.mp4`, `/api/v1/generations/${second.id}/video`, '/bo/gen/catalog.json', '/bo/gen/11111111-2222-3333-4444-555555555555.mp4']) {
      assert.equal((await get(path, { Cookie: cookie, Authorization: `Bearer ${fixture.credentials.generations.token}` })).status, 404);
    }
    await fixture.stop(); fixture = null;
    assert.equal(existsSync(join(directory, `${first.id}.mp4`)), true, 'fixture cleanup never deletes supplied archive');
    assert.equal(readFileSync(join(directory, `${first.id}.mp4`), 'utf8'), bytes);
  } finally { await fixture?.stop(); await rm(tmp, { recursive: true, force: true }); }
});
