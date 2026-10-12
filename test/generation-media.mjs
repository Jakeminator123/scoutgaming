import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:net';
import { mkdtemp, mkdir, writeFile, symlink, rm, readdir, copyFile, lstat, realpath, unlink } from 'node:fs/promises';
import { copyOpenClawRuntime } from './fixtures/copy-openclaw-runtime.mjs';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
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

test('explicit media directory cannot re-enable retired BO or token package routes', async () => {
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
    for (const path of [boPath, `/bo%2fgen%2f${first.id}.mp4`, `/bo%5cgen%5c${first.id}.mp4`, '/bo/generations.json']) {
      const response = await get(path);
      assert.equal(response.status, 302);
      assert.equal(response.headers.get('location'), '/control/login');
    }
    const auth = { Authorization: `Bearer ${fixture.credentials.generations.token}` };
    for (const path of [apiPath, `/api/v1/generations/${second.id}/video`, '/api/v1/generations']) {
      const response = await get(path, auth);
      assert.equal(response.status, 410);
      assert.deepEqual(await response.json(), { error: 'legacy generation catalog retired' });
    }
    assert.equal((await get('/api/v1/generations/mapping', auth)).status, 200);
    assert.equal((await get(apiPath, auth, 'POST')).status, 405);
    await fixture.stop(); fixture = null;
    assert.equal(existsSync(join(directory, `${first.id}.mp4`)), true, 'fixture cleanup never deletes supplied archive');
    assert.equal(readFileSync(join(directory, `${first.id}.mp4`), 'utf8'), bytes);
  } finally { await fixture?.stop(); await rm(tmp, { recursive: true, force: true }); }
});

test('retired generation aliases cannot fall through to static files through Windows route aliases', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'croupier-media-case-'));
  const web = join(tmp, 'web'), mediaRoot=join(tmp,'media'),directory=join(mediaRoot,'site/runtime/backoffice/gen');
  const known = '11111111-2222-3333-4444-555555555555';
  const unknown = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  let fixture;
  try {
    await copyOpenClawRuntime(tmp);
    // Detach only the temporary link created by the copy helper. Never write
    // synthetic files through it or recursively remove its real repo target.
    assert.equal((await lstat(mediaRoot)).isSymbolicLink(),true);
    assert.equal(await realpath(mediaRoot),await realpath(fileURLToPath(new URL('../media/',import.meta.url))));
    await unlink(mediaRoot);
    await mkdir(directory,{recursive:true});
    assert.equal((await lstat(mediaRoot)).isSymbolicLink(),false);
    await writeFile(join(mediaRoot,'layout.json'),JSON.stringify({schemaVersion:1,roots:{'web/public/bo/gen':'media/site/runtime/backoffice/gen'},files:[]}));
    await mkdir(join(web,'public/bo'),{recursive:true});
    const source = new URL('../web/', import.meta.url);
    for (const file of await readdir(source)) if (file.endsWith('.mjs')) await copyFile(new URL(file, source), join(web, file));
    await copyFile(new URL('public/blackjack.mjs', source), join(web, 'public/blackjack.mjs'));
    await copyFile(new URL('public/speech-package.mjs', source), join(web, 'public/speech-package.mjs'));
    await copyFile(new URL('public/astrid-voice-profile.mjs', source), join(web, 'public/astrid-voice-profile.mjs'));
    await copyFile(new URL('public/astrid-camera-audio.mjs', source), join(web, 'public/astrid-camera-audio.mjs'));
    await copyFile(new URL('public/chat-response.mjs', source), join(web, 'public/chat-response.mjs'));
    // Offline game documents use the same validated entry/composition contracts.
    await mkdir(join(web,'public','card-presentation'),{recursive:true});
    for (const name of ['dealer-identity.mjs', 'dealer-speech-profile.mjs', 'game-entry-contract.mjs', 'game-lanes.mjs', 'presentation-composition.mjs', 'composition-settings.mjs', 'dealer-framing.mjs', 'dealer-compositing.mjs', 'background-playback-policy.mjs', 'background-playback.mjs', 'game-overlay-layout.mjs', 'card-presentation/calibration.mjs']) {
      await copyFile(new URL('public/' + name, source), join(web, 'public', name));
    }
    // An inactive catalog must import without optional Studio public modules.
    await import(pathToFileURL(join(web, 'public-operator-rooms.mjs')).href);
    await writeFile(join(web, 'public/bo/generations.json'), JSON.stringify([{ id: known }]));
    await writeFile(join(directory, `${known}.mp4`), 'synthetic known media');
    await writeFile(join(directory, `${unknown}.mp4`), 'synthetic uncatalogued media');
    fixture = await startLocalComparison({ startLab: false, repoRoot: tmp, gamePort: await freePort('localhost'), labPort: await freePort('127.0.0.1') });
    const get = (path, cookie = '') => fetch(fixture.gameUrl + path, { headers: { Cookie: cookie }, redirect: 'manual' });
    const unavailableRooms=await get('/api/operators/sg-test/rooms');
    assert.equal(unavailableRooms.status,503);assert.deepEqual(await unavailableRooms.json(),{error:'operator_rooms_unavailable'});
    assert.equal(unavailableRooms.headers.get('cache-control'),'no-store');assert.equal(unavailableRooms.headers.has('set-cookie'),false);
    const prefixes = ['/BO/GEN/', '/Bo/gEn/', '/BO%2fGEN%2f', '/BO%5cGEN%5c',
      '/bo./gen./', '/bo%20/gen%20/', '/BO.%20/Gen%20./'];
    for (const prefix of prefixes) {
      const denied = await get(`${prefix}${known}.mp4`);
      assert.equal(denied.status, 302, `${prefix} requires BO auth even when default files exist`);
      assert.equal(denied.headers.get('location'), '/control/login');
    }
    const catalog = await get('/bo/generations.json');
    assert.equal(catalog.status, 302); assert.equal(catalog.headers.get('location'), '/control/login');
    const retired = await fetch(fixture.gameUrl + `/api/v1/generations/${known}/video`, {
      headers: { Authorization: `Bearer ${fixture.credentials.generations.token}` }, redirect: 'manual' });
    assert.equal(retired.status, 410);
    assert.deepEqual(await retired.json(), { error: 'legacy generation catalog retired' });
  } finally { await fixture?.stop(); await rm(tmp, { recursive: true, force: true }); }
});
