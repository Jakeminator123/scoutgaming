import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { watchDesignPreview } from '../tools/watch-design-preview.mjs';

async function until(predicate, description) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await delay(20);
  }
  throw Error('Timed out: ' + description);
}

const buildFixture = `
import { access, appendFile, mkdir, open, readFile, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const client = dirname(fileURLToPath(import.meta.url)), root = resolve(client, '../../..');
const journal = resolve(root, 'build-events.txt'), lock = resolve(root, 'build.lock');
const guard = await open(lock, 'wx');
try {
  await appendFile(journal, 'start\\n');
  const hold = resolve(root, 'hold-build');
  if (await access(hold).then(() => true, () => false)) {
    // Exercise shutdown with an owned compiler child, as the real builder uses tsc.
    const child = spawn(process.execPath, ['-e',
      'const fs=require("node:fs"),p=process.argv[1],end=Date.now()+6000;'+
      'const timer=setInterval(()=>{if(!fs.existsSync(p)||Date.now()>end){'+
      'fs.writeFileSync(process.argv[2],"finished");clearInterval(timer);}},15);',
      hold, resolve(root, 'compiler-finished')], { stdio: 'ignore', windowsHide: true });
    await new Promise((yes, no) => { child.once('error', no); child.once('close', code => code === 0 ? yes() : no(Error('compiler failed'))); });
  }
  const load = async path => (await import(pathToFileURL(resolve(root, path)).href)).default;
  const value = await load('apps/studio/client/admin/entry.mjs');
  const shared = await load('packages/presentation/contracts/example.mjs');
  const registry = await load('packages/studio-registry/server/document-contract.mjs');
  const component = await load('apps/studio/components/example.mjs');
  const css = await readFile(resolve(client, 'admin/app/studio.css'), 'utf8');
  const featurePath = 'apps/studio/client/admin/new-feature/label.mjs';
  const feature = await access(resolve(root, featurePath)).then(() => load(featurePath), () => null);
  const output = resolve(root, 'apps/studio/design-preview-build/admin');
  await mkdir(output, { recursive: true });
  await writeFile(resolve(output, 'app.js'), JSON.stringify({ value, shared, registry, component, css, feature }));
} finally {
  await appendFile(journal, 'end\\n');
  await guard.close(); await rm(lock, { force: true });
}
`;

async function fixture(t, { hold = false, command } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'studio-client-watch-'));
  let watcher;
  const path = value => join(root, value);
  const put = async (file, content) => { await mkdir(dirname(path(file)), { recursive: true }); await writeFile(path(file), content); };
  t.after(async () => {
    await rm(path('hold-build'), { force: true });
    await watcher?.close();
    await rm(root, { recursive: true, force: true });
  });
  await put('apps/studio/client/build.mjs', buildFixture);
  await put('apps/studio/client/admin/entry.mjs', "export default 'initial';\n");
  await put('apps/studio/client/admin/app/studio.css', '.title { color: red; }');
  await put('apps/studio/components/example.mjs', "export default 'component';\n");
  await put('packages/presentation/contracts/example.mjs', "export default 'shared';\n");
  await put('packages/studio-registry/server/document-contract.mjs', "export default 'registry';\n");
  if (hold) await put('hold-build', 'wait');
  const events = [];
  watcher = await watchDesignPreview({ repoRoot: root, debounceMs: 60, stdio: 'ignore',
    ...(command ? { command } : {}), onEvent: event => events.push(event) });
  const ended = () => events.filter(event => event.type === 'build-end');
  return {
    root, path, put, watcher, events, ended,
    built: count => until(() => ended().length >= count, 'build ' + count),
    output: async () => JSON.parse(await readFile(path('apps/studio/design-preview-build/admin/app.js'), 'utf8')),
    journal: async () => (await readFile(path('build-events.txt'), 'utf8').catch(() => '')).trim().split('\n').filter(Boolean),
  };
}

test('real client, CSS, reused component and shared-contract edits rebuild the generated output', async t => {
  const f = await fixture(t);
  assert.equal((await f.watcher.ready).code, 0);
  assert.equal((await f.output()).value, 'initial');
  await f.put('apps/studio/client/admin/entry.mjs', "export default 'edited';\n");
  await f.built(2);
  assert.equal((await f.output()).value, 'edited');
  await f.put('apps/studio/client/admin/app/studio.css', '.title { color: blue; }');
  await f.built(3);
  assert.equal((await f.output()).css, '.title { color: blue; }');
  await f.put('apps/studio/components/example.mjs', "export default 'updated component';\n");
  await f.built(4);
  assert.equal((await f.output()).component, 'updated component');
  await f.put('packages/presentation/contracts/example.mjs', "export default 'updated contract';\n");
  await f.built(5);
  assert.equal((await f.output()).shared, 'updated contract');
  await f.put('packages/studio-registry/server/document-contract.mjs', "export default 'updated registry';\n");
  await f.built(6);
  assert.equal((await f.output()).registry, 'updated registry');
  assert.ok(f.ended().every(result => result.code === 0));
});

test('new source directories and repeated atomic editor saves remain observable', async t => {
  const f = await fixture(t);
  await f.watcher.ready;
  await f.put('apps/studio/client/admin/new-feature/label.mjs', "export default 'new feature';\n");
  await f.built(2);
  assert.equal((await f.output()).feature, 'new feature');
  for (const [index, label] of ['atomic one', 'atomic two'].entries()) {
    await f.put('apps/studio/client/admin/entry.mjs.tmp', `export default '${label}';\n`);
    await rename(f.path('apps/studio/client/admin/entry.mjs.tmp'), f.path('apps/studio/client/admin/entry.mjs'));
    await f.built(index + 3);
    assert.equal((await f.output()).value, label);
  }
  await f.put('apps/studio/client/admin/new-feature/label.mjs', "export default 'edited feature';\n");
  await f.built(5);
  assert.equal((await f.output()).feature, 'edited feature');
  await rm(f.path('apps/studio/client/admin/new-feature'), { recursive: true });
  await f.built(6);
  assert.equal((await f.output()).feature, null);
  await f.put('apps/studio/client/admin/new-feature/label.mjs', "export default 'recreated feature';\n");
  await f.built(7);
  assert.equal((await f.output()).feature, 'recreated feature');
  await f.put('apps/studio/client/admin/new-feature/label.mjs', "export default 'edited recreation';\n");
  await f.built(8);
  assert.equal((await f.output()).feature, 'edited recreation');
  await f.put('apps/studio/.replacement-components/example.mjs', "export default 'replaced directory';\n");
  await rename(f.path('apps/studio/components'), f.path('apps/studio/.old-components'));
  await rename(f.path('apps/studio/.replacement-components'), f.path('apps/studio/components'));
  await f.built(9);
  assert.equal((await f.output()).component, 'replaced directory');
  await f.put('apps/studio/components/example.mjs', "export default 'edited replacement';\n");
  await f.built(10);
  assert.equal((await f.output()).component, 'edited replacement');
});

test('removing an explicit source root stops clearly instead of silently losing future edits', async t => {
  const f = await fixture(t);
  await f.watcher.ready;
  await rm(f.path('apps/studio/components'), { recursive: true });
  await until(() => f.events.some(event => event.type === 'watch-error'), 'missing source root is reported');
  await f.watcher.closed;
  assert.match(f.events.find(event => event.type === 'watch-error').error.message, /apps\/studio\/components/);
  assert.equal(f.events.filter(event => event.type === 'build-start').length, 1);
});

test('build output, dependencies, caches, tests and private files do not cause rebuild loops', async t => {
  const f = await fixture(t);
  await f.watcher.ready;
  for (const file of [
    'apps/studio/design-preview-build/admin/app.js',
    'apps/studio/client/node_modules/example/index.mjs',
    'apps/studio/client/admin/node_modules/example/index.mjs',
    'apps/studio/client/admin/.cache/cache.json',
    'apps/studio/client/admin/tests/example.mjs',
    'apps/studio/client/admin/example.test.mjs',
    'apps/studio/client/admin/example.spec.tsx',
    'apps/studio/client/admin/.env.local',
    'apps/studio/client/admin/secrets.json',
    'apps/studio/client/admin/secrets/key.json',
    'apps/studio/client/admin/data/example.json',
    'apps/studio/client/admin/media/source.mp4',
  ]) await f.put(file, 'not an input');
  await delay(450);
  assert.equal(f.ended().length, 1);
  assert.deepEqual(await f.journal(), ['start', 'end']);
});

test('saves during a build coalesce into one follow-up without overlapping compiler processes', async t => {
  const f = await fixture(t);
  await f.watcher.ready;
  await f.put('hold-build', 'wait');
  await f.put('apps/studio/client/admin/entry.mjs', "export default 'first change';\n");
  await until(async () => (await f.journal()).filter(line => line === 'start').length === 2, 'held build starts');
  for (let i = 0; i < 8; i++) await f.put('apps/studio/client/admin/entry.mjs', `export default 'change ${i}';\n`);
  await delay(200);
  assert.equal(f.events.filter(event => event.type === 'build-start').length, 2);
  await rm(f.path('hold-build'));
  await f.built(3);
  await delay(250);
  assert.equal(f.ended().length, 3);
  assert.ok(f.ended().every(result => result.code === 0));
  assert.equal((await f.output()).value, 'change 7');
  assert.deepEqual(await f.journal(), ['start', 'end', 'start', 'end', 'start', 'end']);
});

test('a failed real build keeps watching and the next valid edit recovers', async t => {
  const f = await fixture(t);
  await f.watcher.ready;
  await f.put('apps/studio/client/admin/entry.mjs', 'export default ;');
  await f.built(2);
  assert.notEqual(f.ended()[1].code, 0);
  assert.equal((await f.output()).value, 'initial');
  await f.put('apps/studio/client/admin/entry.mjs', "export default 'recovered';\n");
  await f.built(3);
  assert.equal(f.ended()[2].code, 0);
  assert.equal((await f.output()).value, 'recovered');
});

test('close drains the owned build and compiler child, drops queued work and releases all watchers', async t => {
  const f = await fixture(t, { hold: true });
  await until(async () => (await f.journal()).includes('start'), 'initial held build starts');
  await f.put('apps/studio/client/admin/entry.mjs', "export default 'before close';\n");
  await delay(100);
  let closed = false;
  const stopping = f.watcher.close().then(() => { closed = true; });
  assert.equal(f.watcher.close(), f.watcher.closed);
  await delay(100);
  assert.equal(closed, false);
  await rm(f.path('hold-build'));
  await stopping;
  assert.equal((await f.watcher.ready).code, 0);
  assert.equal(await readFile(f.path('compiler-finished'), 'utf8'), 'finished');
  await f.put('apps/studio/client/admin/entry.mjs', "export default 'after close';\n");
  await delay(200);
  assert.equal(f.events.filter(event => event.type === 'build-start').length, 1);
  assert.deepEqual(await f.journal(), ['start', 'end']);
});

test('a child spawn failure is reported and can be closed without an unhandled error', async t => {
  const f = await fixture(t, { command: join(tmpdir(), 'studio-watch-no-such-build-command') });
  const result = await f.watcher.ready;
  assert.equal(result.error?.code, 'ENOENT');
  assert.notEqual(result.code, 0);
  await f.put('apps/studio/client/admin/entry.mjs', "export default 'retry';\n");
  await f.built(2);
  assert.equal(f.ended()[1].error?.code, 'ENOENT');
  await f.watcher.close();
});
