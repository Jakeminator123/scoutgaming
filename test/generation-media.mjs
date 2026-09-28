import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:net';
import { mkdtemp, mkdir, writeFile, symlink, rm, readdir, copyFile } from 'node:fs/promises';
import { copyOpenClawRuntime } from './fixtures/copy-openclaw-runtime.mjs';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
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
    await symlink(fileURLToPath(new URL('../web/', import.meta.url)), join(tmp, 'web'), process.platform === 'win32' ? 'junction' : 'dir');
    fixture = await startLocalComparison({ repoRoot: tmp, startLab: false, gamePort: await freePort('localhost'), labPort: await freePort('127.0.0.1'), generationDirectory: directory });
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

test('default media directory cannot bypass BO auth or catalog checks through Windows route aliases', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'croupier-media-case-'));
  const web = join(tmp, 'web'), directory = join(web, 'public/bo/gen');
  const known = '11111111-2222-3333-4444-555555555555';
  const unknown = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  let fixture;
  try {
    await mkdir(directory, { recursive: true });
    await copyOpenClawRuntime(tmp);
    const source = new URL('../web/', import.meta.url);
    for (const file of await readdir(source)) if (file.endsWith('.mjs')) {
      await copyFile(new URL(file, source), join(web, file === 'server.mjs' ? 'server-under-test.mjs' : file));
    }
    await copyFile(new URL('public/blackjack.mjs', source), join(web, 'public/blackjack.mjs'));
    await copyFile(new URL('public/speech-package.mjs', source), join(web, 'public/speech-package.mjs'));
    await copyFile(new URL('public/astrid-voice-profile.mjs', source), join(web, 'public/astrid-voice-profile.mjs'));
    await copyFile(new URL('public/astrid-camera-audio.mjs', source), join(web, 'public/astrid-camera-audio.mjs'));
    await copyFile(new URL('public/chat-response.mjs', source), join(web, 'public/chat-response.mjs'));
    // Exercise the real server's default directory, not the comparison fixture's
    // intentional empty-media override. Only this disposable child loses it.
    await writeFile(join(web, 'server.mjs'), "delete process.env.CROUPIER_GENERATIONS_DIR; await import('./server-under-test.mjs');\n");
    await writeFile(join(web, 'public/bo/generations.json'), JSON.stringify([{ id: known }]));
    await writeFile(join(directory, `${known}.mp4`), 'synthetic known media');
    await writeFile(join(directory, `${unknown}.mp4`), 'synthetic uncatalogued media');
    fixture = await startLocalComparison({ startLab: false, repoRoot: tmp, gamePort: await freePort('localhost'), labPort: await freePort('127.0.0.1') });
    const get = (path, cookie = '') => fetch(fixture.gameUrl + path, { headers: { Cookie: cookie }, redirect: 'manual' });
    const prefixes = ['/BO/GEN/', '/Bo/gEn/', '/BO%2fGEN%2f', '/BO%5cGEN%5c',
      '/bo./gen./', '/bo%20/gen%20/', '/BO.%20/Gen%20./'];
    for (const prefix of prefixes) {
      const denied = await get(`${prefix}${known}.mp4`);
      assert.equal(denied.status, 302, `${prefix} requires BO auth even when default files exist`);
      assert.equal(denied.headers.get('location'), '/bo/login.html');
    }
    const login = await fetch(fixture.gameUrl + '/api/bo/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: fixture.gameUrl }, body: JSON.stringify({ user: fixture.bo.username, pass: fixture.bo.password }) });
    assert.equal(login.status, 200);
    const cookie = login.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
    for (const prefix of prefixes) {
      const allowed = await get(`${prefix}${known}.mp4`, cookie);
      assert.equal(allowed.status, 200);
      assert.equal(await allowed.text(), 'synthetic known media');
      assert.equal((await get(`${prefix}${unknown}.mp4`, cookie)).status, 404, 'existing uncatalogued file is never served by static fallback');
    }
  } finally { await fixture?.stop(); await rm(tmp, { recursive: true, force: true }); }
});
