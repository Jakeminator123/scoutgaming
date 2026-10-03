import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';
import { build } from '../build.mjs';
import { canonicalGameDestination } from '../../../web/public/game-entry-contract.mjs';

const origin = 'https://game.example.test';

async function fixture(fn) {
  const directory = await mkdtemp(join(tmpdir(), 'croupier-vercel-entry-test-'));
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

function playerEntryDestination(source, canonical = false) {
  let playerEntry;
  const controls = new Map();
  const dialog = {setAttribute() {},append(element) {playerEntry = element;},
    querySelector(selector) {if (!controls.has(selector)) controls.set(selector,{});return controls.get(selector);}};
  // Execute the generated module's setup with its real query contract. Only
  // import/export syntax is adapted for this small DOM fixture.
  const script = source.replace(/^import[^\n]*\n/gm,'').replace(/^export /gm,'');
  runInNewContext(script,{URL,canonicalGameDestination,
    document:{documentElement:{dataset:canonical ? {gamePath:'/blackjack'} : {}},body:{appendChild() {}},
      createElement:tag => tag === 'dialog' ? dialog : {}},
    location:{href:'https://preview.example/frontend-preview/game/?dealer=mei&motion=smooth60&launch=a.b.c&returnTo=https://evil.invalid'},
    fetch:async () => ({ok:true,json:async () => ({playerAccounts:true})}),
  },{timeout:1000});
  return playerEntry.href;
}

test('default build keeps the exact two-file Production landing and Render link', async () => {
  await fixture(async (directory, output) => {
    await build({ origin, output });
    assert.deepEqual(await files(directory), ['index.html', 'style.css']);
    const source = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    const actual = await readFile(join(directory, 'index.html'), 'utf8');
    assert.equal(actual, source.replace('{{BLACKJACK_URL}}', `${origin}/blackjack`));
    assert.deepEqual(await readFile(join(directory, 'style.css')),
      await readFile(new URL('../../../web/public/blackjack-entry.css', import.meta.url)));
    const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
    assert.equal(config.buildCommand, 'node build.mjs');
    const productionCsp = config.headers.find(row => row.source === '/((?!frontend-preview/).*)');
    assert.equal(productionCsp.headers[0].value,
      "default-src 'none'; style-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
    const matchProduction = new RegExp(`^${productionCsp.source}$`);
    assert.ok(matchProduction.test('/'));
    assert.ok(matchProduction.test('/index.html'));
    assert.ok(matchProduction.test('/style.css'));
    assert.ok(matchProduction.test('/unrelated-path'));
    assert.ok(!matchProduction.test('/frontend-preview/game/'));
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
      'vendor/three/GLTFLoader.js', 'vendor/three/BufferGeometryUtils.js',
      'presentation-runtime/live-idle.mjs', 'lab/policies/idle-policy.seed.json',
      'astrid-camera-audio-worklet.mjs',
    ]) assert.ok(names.includes(required), `missing ${required}`);
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
    const login = await readFile(join(directory, 'blackjack-entry.mjs'), 'utf8');
    const modal = await readFile(join(directory, 'auth-modal.mjs'), 'utf8');
    assert.match(login, /const destination = '\/frontend-preview\/game\/\?dealer=astrid&presentation=local'/);
    assert.equal(playerEntryDestination(modal),'/frontend-preview/blackjack/');
    assert.equal(playerEntryDestination(modal,true),'/player-login?dealer=mei&motion=smooth60');
    assert.doesNotMatch(login, /const destination = '\/\?dealer=/);
    assert.equal(await readFile(join(directory, 'frontend-preview/blackjack/index.html'), 'utf8'),
      await readFile(new URL('../../../web/public/blackjack-entry.html', import.meta.url), 'utf8'));
    const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
    assert.match(config.headers.find(row => row.source === '/frontend-preview/(.*)').headers[0].value,
      /script-src 'self'/);
  });
});
