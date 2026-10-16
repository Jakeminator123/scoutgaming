import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, basename } from 'node:path';
import { prepareProject, localDataDir, main, publishedProductUrl, requireLocalBuild, localBuildFiles } from '../start.mjs';
import { childSpecifications, loadPrivateConnection } from '../../open-claw/lab/deploy/local-connection.mjs';
import { createPresentationApi } from '../../web/presentation-api.mjs';
import { createProjectStore } from '../lib/project-store.mjs';
import { createServer } from 'node:http';
import {defaultPresentationLane} from '../lib/studio-model.mjs';
import {createRegisteredIdlePolicy} from '../../packages/presentation/runtime/registered-idle-policy.mjs';
import {cloudPresentationFixture} from './fixtures/cloud-presentation.mjs';
import { once } from 'node:events';

test('a guard-only legacy directory does not redirect Lab data after restart', async t => {
  const repo = await mkdtemp(join(tmpdir(), 'croupier-data-location-'));
  t.after(() => rm(repo, { recursive: true, force: true }));
  assert.equal(localDataDir(repo), join(repo, 'lab/data'));
  await mkdir(join(repo, 'lissabon/data'), { recursive: true });
  await writeFile(join(repo, 'lissabon/data/.local-session.sqlite'), 'fixture');
  assert.equal(localDataDir(repo), join(repo, 'lab/data'));
  await writeFile(join(repo, 'lissabon/data/project.json'), '{}');
  assert.throws(() => localDataDir(repo), /migrate-lab-state/);
});

test('lane shares durable project, preserves saved edits and refuses a corrupt project', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'lissabon-test-'));
  t.after(async () => {
    assert.equal(dirname(resolve(dir)), resolve(tmpdir()));
    assert.ok(basename(dir).startsWith('lissabon-test-'));
    await rm(dir, { recursive: true, force: true });
  });
  const data = await prepareProject(join(dir, 'saved'));
  const store = createProjectStore(data);
  const original = await store.load();
  assert.deepEqual(original.dealers,[]);assert.deepEqual(original.lines,[]);assert.deepEqual(original.lanes,[]);assert.equal(original.idlePolicy,undefined);
  const {project:edit,inventory}=cloudPresentationFixture({project:original,lanes:[defaultPresentationLane('linnea')]});
  const policy=createRegisteredIdlePolicy({dealerId:'linnea',baselineVideoId:inventory.videos[0].id,durationMs:1000});
  policy.variants=[1,2].map(index=>({videoId:'20000000-0000-4000-8000-'+String(index).padStart(12,'0'),durationMs:1000,use:'openclaw',automatic:null}));
  edit.dealerIdlePolicies=[{dealerId:'linnea',policy}];
  edit.dealerIdlePolicies[0].policy.variants[0].use='manual';
  const saved = await store.save(edit, original.revision);
  await prepareProject(data);
  assert.deepEqual(await store.load(), saved);

  const old = structuredClone(saved);
  old.dealerIdlePolicies[0].policy.variants = old.dealerIdlePolicies[0].policy.variants.slice(0, 1);
  old.dealerIdlePolicies[0].policy.variants[0].description = 'Keep my own description.';
  await store.save(old, saved.revision);
  await prepareProject(data);
  const retained = await store.load();
  assert.equal(retained.dealerIdlePolicies[0].policy.variants.length, 1,'restart must not refill removed variants');
  assert.deepEqual(retained.dealerIdlePolicies,old.dealerIdlePolicies);
  assert.deepEqual(retained.dealers,old.dealers);
  // Continue the HTTP assertions with the current stored revision.
  const restored = await store.save(saved, retained.revision);

  const { configuration } = loadPrivateConnection({ envFiles: [], env: {} });
  const specs = childSpecifications(configuration, join(dir, 'disposable'), { productPort: 4200, labPort: 4201, studioDataDir: data, streamLane: 'lissabon-stream-lane' });
  assert.equal(specs.product.env.CROUPIER_PRESENTATION_STUDIO_DIR, undefined);
  assert.equal(specs.lab.env.LAB_STUDIO_DATA_DIR, undefined);
  assert.equal(specs.lab.env.CROUPIER_GAME_ORIGIN, 'http://127.0.0.1:4200');
  assert.notEqual(specs.product.dataDir, data);
  assert.equal(specs.product.dataDir, join(data, 'players'));
  assert.equal(specs.product.env.CROUPIER_LISSABON_PROFILES, '1');
  const ordinary = childSpecifications(configuration, join(dir, 'ordinary'));
  assert.equal(ordinary.product.dataDir, join(dir, 'ordinary', 'product'));
  assert.equal(ordinary.product.env.CROUPIER_LISSABON_PROFILES, '');
  assert.equal(specs.product.env.CROUPIER_STREAM_LANE, 'lissabon-stream-lane');
  assert.equal(specs.lab.env.CROUPIER_STREAM_LANE, 'lissabon-stream-lane');

  for (const [lane, expected] of [['lissabon-stream-lane', 'active'], ['', 'off']]) {
    const handler = createPresentationApi({ env: { CROUPIER_STREAM_LANE: lane }, store,registryLoader:async()=>inventory });
    const server = createServer((req, res) => handler(req, res, '/api/presentation/config', 'demo'));
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    try {
      const config = await (await fetch(`http://127.0.0.1:${server.address().port}/api/presentation/config?dealerId=linnea`)).json();
      assert.equal(config.defaultMode, expected);
      assert.equal(config.revision, restored.revision);
      assert.deepEqual(config.idlePolicy, saved.dealerIdlePolicies[0].policy);
      assert.deepEqual(Object.keys(config.dealerIdle),['linnea']);
    } finally { server.closeAllConnections(); await new Promise(yes => server.close(yes)); }
  }
  const file = join(data, 'project.json');
  await writeFile(file, 'invalid saved project');
  await assert.rejects(prepareProject(data));
  assert.equal(await readFile(file, 'utf8'), 'invalid saved project');
});


test('public product entry returns before any local connection or provider work', async t => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = () => assert.fail('Product entry must not contact local servers or providers');
  t.after(() => { globalThis.fetch = previousFetch; });
  const messages = [], opened = [];
  assert.deepEqual(await main(['--product','--no-open'], { log: text => messages.push(text), open: url => opened.push(url) }), { mode: 'product', url: publishedProductUrl });
  assert.deepEqual(opened, []);
  assert.match(messages[0], /Publicerad produkt: https:\/\/www\.scoutgaming\.tech\/lobby/);
  assert.match(messages[0], /Inga lokala servrar/);
  await main(['--product'], { log: () => {}, open: url => opened.push(url) });
  assert.deepEqual(opened, [publishedProductUrl]);
  for (const option of ['--offline','--check','--skip-build','--astrid-camera','--cloud-storage']) {
    await assert.rejects(main(['--product',option], { log: () => {}, open: () => assert.fail('Invalid combination must not open') }), /kan endast kombineras/);
  }
});

async function buildFixture(t) {
  const repo = await mkdtemp(join(tmpdir(), 'croupier-start-build-'));
  t.after(() => rm(repo, { recursive: true, force: true }));
  for (const file of localBuildFiles) {
    const target = join(repo, 'lab', file);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, 'fixture build');
  }
  return repo;
}
function fakeRuntime() {
  const events = [], logs = [];
  const forbidden = name => () => assert.fail(`Unexpected ${name}`);
  const fixture = { labUrl: 'http://127.0.0.1:4192/', stop: forbidden('stop') };
  const dependencies = {
    sourceVersion: () => { events.push('source'); return 'a'.repeat(40); },
    preparePreview: forbidden('preview preparation'), prepareDesignPreview: forbidden('design build/install'), buildLab: forbidden('Next build'),
    prepareProject: async () => { events.push('project'); },
    startLocalComparison: forbidden('offline start'), startIsolatedConnection: forbidden('connected start'),
    loadPrivateConnection: forbidden('profile read'), probeConnections: forbidden('provider probe'),
    fetch: async () => { events.push('health'); throw new Error('No listener'); },
    registerShutdown: value => { assert.equal(value, fixture); events.push('shutdown-handler'); },
  };
  const start = async options => {
    events.push('start');
    await options.prepare({});
    await options.prepareStudio?.('fixture-studio');
    return fixture;
  };
  return { events, logs, fixture, dependencies, start,
    options: { dependencies, log: text => logs.push(text), open: forbidden('browser open') } };
}

test('skip-build checks all three existing build groups without changing files', async t => {
  const repo = await buildFixture(t);
  await requireLocalBuild(repo);
  for (const [file, kind] of [['.next/BUILD_ID', 'missing'], ['preview-build/preview.js', 'empty'], ['design-preview-build/admin/app.js', 'directory']]) {
    const target = join(repo, 'lab', file);
    if (kind === 'empty') await writeFile(target, '');
    else {
      await rm(target);
      if (kind === 'directory') await mkdir(target);
    }
    await assert.rejects(requireLocalBuild(repo), error => {
      assert.ok(error.message.includes(file));
      assert.match(error.message, /--skip-build bygger eller installerar ingenting/);
      return true;
    });
    if (kind === 'directory') await rm(target, { recursive: true });
    await writeFile(target, 'fixture build');
  }
  await requireLocalBuild(repo);
});

test('missing skip-build output stops offline and connected starts before profile or project work', async t => {
  const repo = await mkdtemp(join(tmpdir(), 'croupier-start-missing-'));
  t.after(() => rm(repo, { recursive: true, force: true }));
  for (const flags of [[], ['--offline']]) {
    const { events, options } = fakeRuntime();
    await assert.rejects(main([...flags, '--skip-build', '--no-open'], { ...options, repoRoot: repo }), /Lokalt bygge saknas/);
    assert.deepEqual(events, ['source']);
    await assert.rejects(readFile(join(repo, 'lab/data/project.json')), { code: 'ENOENT' });
  }
});

test('offline and connected skip-build preserve built output and never invoke build preparation', async t => {
  const repo = await buildFixture(t);
  for (const offline of [true, false]) {
    const { events, logs, fixture, dependencies, start, options } = fakeRuntime();
    dependencies[offline ? 'startLocalComparison' : 'startIsolatedConnection'] = async spec => {
      assert.equal(spec.repoRoot, repo);
      assert.equal(spec.streamLane, 'lissabon-stream-lane');
      return start(spec);
    };
    const result = await main([...(offline ? ['--offline'] : []), '--skip-build', '--no-open'], { ...options, repoRoot: repo });
    assert.equal(result, fixture);
    assert.deepEqual(events, ['source', ...(offline ? [] : ['health']), 'start', 'project', 'shutdown-handler']);
    assert.match(logs[0], /Källversion \(Git HEAD\): a{40}/);
    assert.ok(logs[0].includes(repo));
    assert.match(logs[1], /källversion är inte verifierad/);
    assert.equal(await readFile(join(repo, 'lab/preview-build/preview.js'), 'utf8'), 'fixture build');
    assert.equal(await readFile(join(repo, 'lab/design-preview-build/admin/app.js'), 'utf8'), 'fixture build');
  }
});

test('a matching service and lane never silently reuse an unidentified running checkout', async t => {
  const repo = await buildFixture(t);
  for (const response of [{ service: 'croupier-next-studio', streamLane: 'lissabon-stream-lane' }, { service: 'another-server' }]) {
    const { events, dependencies, options } = fakeRuntime();
    dependencies.fetch = async () => ({ json: async () => response });
    await assert.rejects(main(['--skip-build', '--no-open'], { ...options, repoRoot: repo }), /checkout och byggversion kan inte verifieras.*Stoppa dess startprocess manuellt.*Ingen process stängs automatiskt/);
    assert.deepEqual(events, ['source']);
  }
});

test('check and product modes do not require or create builds or start servers', async () => {
  const { events, logs, dependencies, options } = fakeRuntime();
  dependencies.requireLocalBuild = () => assert.fail('Check/product must not inspect builds');
  dependencies.loadPrivateConnection = () => { events.push('profile'); return { configuration: { fixture: true }, report: { safe: true } }; };
  dependencies.probeConnections = async configuration => { assert.deepEqual(configuration, { fixture: true }); events.push('probe'); return { checked: true }; };
  await main(['--check', '--skip-build', '--no-open'], options);
  assert.deepEqual(events, ['source', 'profile', 'probe']);
  assert.deepEqual(JSON.parse(logs.at(-1)), { lane: 'lissabon-stream-lane', report: { safe: true }, probe: { checked: true } });
  events.length = 0;
  await main(['--product', '--no-open'], options);
  assert.deepEqual(events, []);
});

test('ordinary offline and connected starts still prepare both previews before the Next build', async t => {
  const repo = await buildFixture(t);
  for (const offline of [true, false]) {
    const { events, dependencies, start, options } = fakeRuntime();
    dependencies.preparePreview = async () => { events.push('preview'); };
    dependencies.prepareDesignPreview = async () => { events.push('design'); };
    dependencies.buildLab = async () => { events.push('build'); };
    dependencies[offline ? 'startLocalComparison' : 'startIsolatedConnection'] = start;
    await main([...(offline ? ['--offline'] : []), '--no-open'], { ...options, repoRoot: repo });
    assert.deepEqual(events, ['source', ...(offline ? [] : ['health']), 'start', ...(!offline ? ['project'] : []), 'preview', 'design', 'build', ...(offline ? ['project'] : []), 'shutdown-handler']);
  }
});
