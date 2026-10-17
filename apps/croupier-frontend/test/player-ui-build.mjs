import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';
import { build } from '../tools/player-ui-build.mjs';
import { canonicalGameDestination } from '../../../web/public/game-entry-contract.mjs';

function legacyPlayerEntryDestination(source, canonical = false) {
  const playerEntry = {}, nodes = new Map(), dialog = { setAttribute() {}, querySelector: key => { if (key === '#auth-player-login') return playerEntry; if (!nodes.has(key)) nodes.set(key, {}); return nodes.get(key); } };
  const document = { documentElement: { dataset: canonical ? { gamePath: '/blackjack' } : {} }, body: { appendChild() {} }, createElement: () => dialog };
  const runnable = source.replace(/^import .*;\r?$/gm, '').replace('export function requestLogin', 'function requestLogin');
  return runInNewContext(runnable + '\nplayerEntry.href;', { document, URL, canonicalGameDestination, location: { href: 'https://preview.example/game?dealer=nora&motion=smooth60&launch=a.b.c&returnTo=https://evil.invalid' } });
}

const origin = 'https://game.example.test';

async function fixture(fn) {
  const directory = await mkdtemp(join(tmpdir(), 'croupier-player-ui-build-'));
  try { await fn(directory, pathToFileURL(`${directory}${sep}`)); }
  finally { await rm(directory, { recursive: true, force: true }); }
}

async function files(directory, prefix = '') {
  const result = [];
  for (const entry of await readdir(join(directory, prefix), { withFileTypes: true })) {
    const name = join(prefix, entry.name);
    if (entry.isDirectory()) result.push(...await files(directory, name));
    else result.push(name.split(sep).join('/'));
  }
  return result.sort();
}

test('default build keeps the exact two-file landing and game link', async () => {
  await fixture(async (directory, output) => {
    await build({ origin, output });
    assert.deepEqual(await files(directory), ['index.html', 'style.css']);
    const source = await readFile(new URL('../tools/player-ui-landing.html', import.meta.url), 'utf8');
    const actual = await readFile(join(directory, 'index.html'), 'utf8');
    assert.equal(actual, source.replace('{{BLACKJACK_URL}}', `${origin}/blackjack`));
    assert.deepEqual(await readFile(join(directory, 'style.css')),
      await readFile(new URL('../../../web/public/blackjack-entry.css', import.meta.url)));
  });
});

test('opt-in preview includes game/login text dependencies, internal navigation, and no media or BO', async () => {
  await fixture(async (directory, output) => {
    await build({ origin, frontendPreview: true, output });
    const names = await files(directory);
    for (const required of [
      'frontend-preview/blackjack/index.html', 'frontend-preview/game/index.html',
      'blackjack-entry.mjs', 'app.mjs', 'styles.css', 'vendor/three/three.module.js',
      'vendor/three/three.core.min.js',
      'presentation-runtime/live-idle.mjs', 'lab/policies/idle-policy.seed.json',
      'astrid-camera-audio-worklet.mjs', 'dealer-identity.mjs',
      'packages/presentation/contracts/game-lane-id.mjs',
    ]) assert.ok(names.includes(required), `missing ${required}`);
    assert.ok(!names.includes('dealer-version-switcher.css'));
    assert.ok(!names.includes('vendor/three/GLTFLoader.js'));
    const total = (await Promise.all(names.map(async name => (await stat(join(directory, name))).size)))
      .reduce((sum, size) => sum + size, 0);
    assert.ok(total < 5 * 1024 * 1024, `preview is ${total} bytes`);
    assert.ok(names.every(name => !/(?:^|\/)(?:bo|dealers|dealer|review|assets|sfx)(?:\/|$)/.test(name)));
    assert.ok(names.every(name => !/\.(?:mp4|webm|png|jpg|jpeg|glb|wav|mp3)$/i.test(name)));
    for (const name of names.filter(name => /\.(?:mjs|js)$/.test(name))) {
      const body = await readFile(join(directory, name), 'utf8');
      const imports = [
        ...body.matchAll(/^\s*(?:import|export)\s+(?:[\w\s{},*$]+?\s+from\s*)?['"]([^'"]+)['"]/gm),
        ...body.matchAll(/^\s*(?:import|export)[^'"\n]*?\bfrom\s*['"]([^'"]+)['"]/gm),
        ...body.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g),
      ];
      for (const match of imports) {
        const path = new URL(match[1], `https://preview.example/${name}`).pathname.slice(1);
        assert.ok(names.includes(path), `${name} imports missing ${path}`);
      }
    }
    assert.equal(await readFile(join(directory, 'dealer-identity.mjs'), 'utf8'), await readFile(new URL('../../../packages/presentation/contracts/dealer-identity.mjs', import.meta.url), 'utf8'));
    const login = await readFile(join(directory, 'blackjack-entry.mjs'), 'utf8');
    const modal = await readFile(join(directory, 'auth-modal.mjs'), 'utf8');
    assert.match(login, /const destination = '\/frontend-preview\/game\/\?dealer=astrid&presentation=local'/);
    assert.match(modal, /\/api\/auth\/login/);
    assert.doesNotMatch(modal, /\/api\/auth\/player\/(?:login|register)/);
    assert.match(modal, /const playerLoginPath = '\/frontend-preview\/blackjack\/'/);
    assert.equal(legacyPlayerEntryDestination(modal), '/frontend-preview/blackjack/');
    assert.equal(legacyPlayerEntryDestination(modal, true), '/player-login?dealer=nora');
    assert.equal(modal, (await readFile(new URL('../../../web/public/auth-modal.mjs', import.meta.url), 'utf8')).replace("const playerLoginPath = '/blackjack';", "const playerLoginPath = '/frontend-preview/blackjack/';"));
    assert.doesNotMatch(login, /const destination = '\/\?dealer=/);
    assert.equal(await readFile(join(directory, 'frontend-preview/blackjack/index.html'), 'utf8'),
      await readFile(new URL('../../../web/public/blackjack-entry.html', import.meta.url), 'utf8'));
  });
});
