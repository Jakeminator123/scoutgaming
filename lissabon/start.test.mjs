import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, basename } from 'node:path';
import { prepareProject } from './start.mjs';
import { childSpecifications, loadPrivateConnection } from '../open-claw/lab/deploy/local-connection.mjs';
import { createPresentationApi } from '../web/presentation-api.mjs';
import { createProjectStore } from '../lab/lib/project-store.mjs';
import { createServer } from 'node:http';
import { once } from 'node:events';

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
  const edit = structuredClone(original);
  edit.idlePolicy.variants.find(row => row.use === 'openclaw').use = 'manual';
  const saved = await store.save(edit, original.revision);
  await prepareProject(data);
  assert.deepEqual(await store.load(), saved);

  const { configuration } = loadPrivateConnection({ envFiles: [], env: {} });
  const specs = childSpecifications(configuration, join(dir, 'disposable'), { productPort: 4200, labPort: 4201, studioDataDir: data, streamLane: 'lissabon-stream-lane' });
  assert.equal(specs.product.env.CROUPIER_PRESENTATION_STUDIO_DIR, data);
  assert.equal(specs.lab.env.LAB_STUDIO_DATA_DIR, data);
  assert.notEqual(specs.product.dataDir, data);
  assert.equal(specs.product.env.CROUPIER_STREAM_LANE, 'lissabon-stream-lane');
  assert.equal(specs.lab.env.CROUPIER_STREAM_LANE, 'lissabon-stream-lane');

  for (const [lane, expected] of [['lissabon-stream-lane', 'active'], ['', 'off']]) {
    const handler = createPresentationApi({ env: { CROUPIER_STREAM_LANE: lane }, store });
    const server = createServer((req, res) => handler(req, res, '/api/presentation/config', 'demo'));
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    try {
      const config = await (await fetch(`http://127.0.0.1:${server.address().port}/api/presentation/config`)).json();
      assert.equal(config.defaultMode, expected);
      assert.equal(config.revision, saved.revision);
      assert.deepEqual(config.idlePolicy, saved.idlePolicy);
    } finally { server.closeAllConnections(); await new Promise(yes => server.close(yes)); }
  }
  const file = join(data, 'project.json');
  await writeFile(file, 'invalid saved project');
  await assert.rejects(prepareProject(data));
  assert.equal(await readFile(file, 'utf8'), 'invalid saved project');
});
