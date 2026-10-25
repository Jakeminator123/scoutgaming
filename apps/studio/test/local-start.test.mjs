import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, basename } from 'node:path';
import { prepareProject, main, publishedProductUrl, requireLocalBuild, localBuildFiles } from '../start.mjs';
import { childSpecifications, loadPrivateConnection } from '../../../services/openclaw/lab/deploy/local-connection.mjs';
import { createPresentationApi } from '../../../services/game/presentation-api.mjs';
import { createProjectStore } from '../lib/project-store.mjs';
import { createServer } from 'node:http';
import {defaultPresentationLane} from '../../../packages/presentation/contracts/studio-model.mjs';
import {createRegisteredIdlePolicy} from '../../../packages/presentation/runtime/registered-idle-policy.mjs';
import {cloudPresentationFixture} from './fixtures/cloud-presentation.mjs';
import { createLegacyProject } from './fixtures/legacy-project.mjs';
import { once } from 'node:events';

test('default product start never reads or changes saved local projects, including invalid legacy data', async t => {
  const repo = await mkdtemp(join(tmpdir(), 'croupier-data-location-'));
  t.after(() => rm(repo, { recursive: true, force: true }));
  await mkdir(join(repo, 'lissabon/data'), { recursive: true });
  await mkdir(join(repo, 'apps/studio/data'), { recursive: true });
  await writeFile(join(repo, 'lissabon/data/project.json'), 'invalid legacy project');
  await writeFile(join(repo, 'apps/studio/data/project.json'), 'saved local project bytes');
  const {events,options}=fakeRuntime();
  assert.deepEqual(await main(['--no-open'],{...options,repoRoot:repo}),{mode:'product',url:publishedProductUrl});
  assert.deepEqual(events,[]);
  assert.equal(await readFile(join(repo,'lissabon/data/project.json'),'utf8'),'invalid legacy project');
  assert.equal(await readFile(join(repo,'apps/studio/data/project.json'),'utf8'),'saved local project bytes');
  await assert.rejects(prepareProject(),/uttrycklig absolut katalog/);
  await assert.rejects(prepareProject('apps/studio/data'),/uttrycklig absolut katalog/);
});

test('explicit fixture project preserves saved edits and refuses a corrupt project', async t => {
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
  const ordinary = childSpecifications(configuration, join(dir, 'ordinary'));
  assert.equal(ordinary.product.dataDir, join(dir, 'ordinary', 'product'));
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

test('fixture preparation preserves historical project bytes, revision and history', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'croupier-fixture-preserve-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const old = createLegacyProject();
  const snapshot = JSON.stringify(old, null, 4) + '\n';
  const file = join(directory, 'project.json'), history = join(directory, 'history');
  await writeFile(file, snapshot);
  await prepareProject(directory);
  assert.equal(await readFile(file, 'utf8'), snapshot);
  assert.equal(JSON.parse(await readFile(file, 'utf8')).revision, old.revision);
  await assert.rejects(readdir(history), { code: 'ENOENT' });

  await mkdir(history);
  await writeFile(join(history, 'saved.json'), snapshot);
  await prepareProject(directory);
  assert.equal(await readFile(file, 'utf8'), snapshot);
  assert.deepEqual(await readdir(history), ['saved.json']);
  assert.equal(await readFile(join(history, 'saved.json'), 'utf8'), snapshot);
});


test('public product entry returns before any local connection or provider work', async t => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = () => assert.fail('Product entry must not contact local servers or providers');
  t.after(() => { globalThis.fetch = previousFetch; });
  const messages = [], opened = [];
  for(const args of [['--no-open'],['--product','--no-open']])assert.deepEqual(await main(args, { log: text => messages.push(text), open: url => opened.push(url) }), { mode: 'product', url: publishedProductUrl });
  assert.deepEqual(opened, []);
  assert.match(messages[0], /Publicerad produkt: https:\/\/www\.scoutgaming\.tech\/lobby/);
  assert.match(messages[0], /Inga lokala servrar/);
  for(const args of [[],['--product']])await main(args, { log: () => {}, open: url => opened.push(url) });
  assert.deepEqual(opened, [publishedProductUrl,publishedProductUrl]);
  for (const option of ['--offline','--skip-build']) {
    await assert.rejects(main(['--product',option], { log: () => {}, open: () => assert.fail('Invalid combination must not open') }), /kan endast kombineras/);
  }
});

async function buildFixture(t) {
  const repo = await mkdtemp(join(tmpdir(), 'croupier-start-build-'));
  t.after(() => rm(repo, { recursive: true, force: true }));
  for (const file of localBuildFiles) {
    const target = join(repo, 'apps', 'studio', file);
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
    const target = join(repo, 'apps', 'studio', file);
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

test('missing skip-build output stops explicit offline start before project work', async t => {
  const repo = await mkdtemp(join(tmpdir(), 'croupier-start-missing-'));
  t.after(() => rm(repo, { recursive: true, force: true }));
  const { events, options } = fakeRuntime();
  await assert.rejects(main(['--offline', '--skip-build', '--no-open'], { ...options, repoRoot: repo }), /Lokalt bygge saknas/);
  assert.deepEqual(events, ['source']);
  await assert.rejects(readFile(join(repo, 'apps/studio/data/project.json')), { code: 'ENOENT' });
});

test('explicit offline skip-build preserves built output and never invokes build preparation', async t => {
  const repo = await buildFixture(t);
    const { events, logs, fixture, dependencies, start, options } = fakeRuntime();
    dependencies.startLocalComparison = async spec => {
      assert.equal(spec.repoRoot, repo);
      assert.equal(spec.streamLane, 'lissabon-stream-lane');
      return start(spec);
    };
    const result = await main(['--offline', '--skip-build', '--no-open'], { ...options, repoRoot: repo });
    assert.equal(result, fixture);
    assert.deepEqual(events, ['source', 'start', 'project', 'shutdown-handler']);
    assert.match(logs[0], /Källversion \(Git HEAD\): a{40}/);
    assert.ok(logs[0].includes(repo));
    assert.match(logs[1], /källversion är inte verifierad/);
    assert.equal(await readFile(join(repo, 'apps/studio/preview-build/preview.js'), 'utf8'), 'fixture build');
    assert.equal(await readFile(join(repo, 'apps/studio/design-preview-build/admin/app.js'), 'utf8'), 'fixture build');
});

test('retired connected flags fail before probing profiles, running servers or touching local projects', async()=>{
  for(const flag of ['--check','--astrid-camera','--cloud-storage'])for(const mode of [[],['--offline'],['--product']]){
    const {events,options}=fakeRuntime();
    await assert.rejects(main([...mode,flag,'--no-open'],options),/anslutna lokala produktstarten är avvecklad.*node apps\/studio\/start.mjs.*--offline.*Sparade lokala data bevaras/);
    assert.deepEqual(events,[]);
  }
  const {events,options}=fakeRuntime();
  await assert.rejects(main(['--skip-build','--no-open'],options),/--skip-build kräver --offline/);assert.deepEqual(events,[]);
});

test('default and product modes require no build and create no local data on a fresh checkout', async t => {
  const repo=await mkdtemp(join(tmpdir(),'croupier-public-start-'));t.after(()=>rm(repo,{recursive:true,force:true}));
  const { events, dependencies, options } = fakeRuntime();
  dependencies.requireLocalBuild = () => assert.fail('Product must not inspect builds');
  dependencies.sourceVersion = () => assert.fail('Product must not inspect local Git');
  for(const args of [['--no-open'],['--product','--no-open']]){
    await main(args,{...options,repoRoot:repo});assert.deepEqual(events,[]);
    await assert.rejects(readFile(join(repo,'apps/studio/data/project.json')),{code:'ENOENT'});
  }
});

test('explicit offline start prepares both previews before the Next build', async t => {
  const repo = await buildFixture(t);
    const { events, dependencies, start, options } = fakeRuntime();
    dependencies.preparePreview = async () => { events.push('preview'); };
    dependencies.prepareDesignPreview = async () => { events.push('design'); };
    dependencies.buildLab = async () => { events.push('build'); };
    dependencies.startLocalComparison = start;
    await main(['--offline', '--no-open'], { ...options, repoRoot: repo });
    assert.deepEqual(events, ['source', 'start', 'preview', 'design', 'build', 'project', 'shutdown-handler']);
});
