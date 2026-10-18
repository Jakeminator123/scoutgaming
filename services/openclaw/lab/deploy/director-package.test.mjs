import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat, copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const dockerfile = await readFile(new URL('../Dockerfile', import.meta.url), 'utf8');
const ignoreRules = (await readFile(new URL('../Dockerfile.dockerignore', import.meta.url), 'utf8'))
  .split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#'));
// This Dockerfile uses only explicit paths and a one-level *.mjs allowlist.
// No Docker daemon is needed to test its actual packaged import graph.
const included = path => {
  let allowed = true;
  for (const rule of ignoreRules) {
    const allow = rule.startsWith('!');
    const pattern = (allow ? rule.slice(1) : rule).replace(/\/$/, '');
    const regex = pattern === '**' ? /^.*$/ : new RegExp('^' + pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$');
    // Docker also checks parents. Never allow a whole parent directory: that
    // would silently reopen its .env/data/media descendants after default-deny.
    const parts = path.split('/');
    if (parts.some((_, index) => regex.test(parts.slice(0, index + 1).join('/')))) allowed = allow;
  }
  return allowed;
};

test('Director root build context admits runtime sources but excludes local keys, data and media', () => {
  assert.equal(ignoreRules[0], '**');
  for (const path of ['.env', '.env.local', '.git/config', 'lab/data/private.json',
    'services/openclaw/lab/.env', 'services/openclaw/lab/data/catalog.json', 'services/openclaw/lab/src/.env',
    'services/openclaw/lab/public/take.mp4', 'services/openclaw/lab/src/node_modules/unrelated/index.mjs',
    'services/openclaw/lab/deploy/runtime-bundle/roles/croupier-chat.md', 'web/public/unrelated.mjs']) {
    assert.equal(included(path), false, path);
  }
  assert.equal(included('services/openclaw/lab/src/server.mjs'), true);
  assert.equal(included('packages/director/engine.mjs'), true);
  assert.equal(included('packages/director/node/companion-store.mjs'), true);
  for (const privatePath of ['packages/director/.env', 'packages/director/node/companion.sqlite', 'packages/director/node_modules/extra/index.mjs']) assert.equal(included(privatePath), false, privatePath);
  assert.equal(included('packages/presentation/contracts/dealer-identity.mjs'), true);
});

test('Director and Gateway retain their distinct Render and Compose build contexts', async () => {
  const render = await readFile(new URL('../render.yaml', import.meta.url), 'utf8');
  const compose = await readFile(new URL('./compose.yaml', import.meta.url), 'utf8');
  const [director, gateway] = render.split('  - type: pserv');
  assert.match(director, /dockerfilePath: \.\/services\/openclaw\/lab\/Dockerfile\s+dockerContext: \.\s/);
  assert.match(director, /- packages\/presentation\/contracts\/dealer-identity\.mjs/);
  assert.match(gateway, /dockerContext: \.\/services\/openclaw\/lab/);
  assert.match(compose, /director:\s+build:\s+context: \.\.\/\.\.\/\.\.\/\.\.\s+dockerfile: services\/openclaw\/lab\/Dockerfile/);
  assert.match(compose, /gateway:\s+build:\s+context: \.\.\s+dockerfile: deploy\/Dockerfile.gateway/);
});

test('isolated Docker COPY inputs resolve the complete Director graph and serve health, catalog and UI', async t => {
  const fixture = await mkdtemp(join(tmpdir(), 'croupier-director-image-'));
  assert.equal(dirname(fixture), resolve(tmpdir()));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  const workdir = dockerfile.match(/^WORKDIR (\S+)$/m)?.[1];
  assert.equal(workdir, '/app/services/openclaw/lab');
  assert.deepEqual(JSON.parse(dockerfile.match(/^CMD (.+)$/m)?.[1]), ['node', 'deploy/start-director.mjs']);
  const copied = [];
  async function copy(source, target) {
    const path = resolve(root, source);
    assert.ok(path.startsWith(resolve(root) + '/') || path.startsWith(resolve(root) + '\\'));
    const entry = await stat(path);
    if (entry.isDirectory()) {
      for (const name of await readdir(path)) await copy(`${source.replace(/\/$/, '')}/${name}`, join(target, name));
    } else if (included(source)) {
      await mkdir(dirname(target), { recursive: true });
      await copyFile(path, target);
      copied.push(source);
    }
  }
  for (const match of dockerfile.matchAll(/^COPY --chown=node:node (\S+) (\S+)$/gm)) {
    const [, source, destination] = match;
    const imagePath = destination.startsWith('/') ? destination : `${workdir}/${destination}`;
    const target = resolve(fixture, `.${imagePath}`);
    assert.ok(target.startsWith(fixture + '/') || target.startsWith(fixture + '\\'));
    await copy(source, target);
  }
  assert.ok(copied.includes('packages/presentation/contracts/dealer-identity.mjs'));
  assert.ok(copied.includes('packages/director/engine.mjs'));
  assert.ok(copied.includes('packages/director/node/companion-store.mjs'));
  const isolatedLab = join(fixture, 'app/services/openclaw/lab');
  const script = `
    import assert from 'node:assert/strict';
    import { once } from 'node:events';
    const localFetch = globalThis.fetch;
    let upstreamCalls = 0;
    globalThis.fetch = async () => { upstreamCalls++; throw new Error('provider access forbidden'); };
    const { createLabServer } = await import('./src/server.mjs');
    const { server } = await createLabServer();
    try {
      server.listen(0, '127.0.0.1');
      await once(server, 'listening');
      const origin = 'http://127.0.0.1:' + server.address().port;
      for (const path of ['/healthz', '/', '/app.mjs', '/styles.css', '/api/catalog', '/api/scenarios']) {
        const response = await localFetch(origin + path);
        assert.equal(response.status, 200, path);
        const body = await response.text();
        assert.ok(body.length > 0, path);
        if (path === '/healthz') assert.equal(JSON.parse(body).ok, true);
      }
      assert.equal(upstreamCalls, 0);
      console.log('isolated-director-package-ok');
    } finally {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
  `;
  // Do not inherit local environment files or provider credentials.
  const child = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
    cwd: isolatedLab, timeout: 15000, encoding: 'utf8',
    env: { SystemRoot: process.env.SystemRoot || '', HOST: '127.0.0.1',
      LAB_DATA_DIR: join(fixture, 'data'), NODE_ENV: 'production' },
  });
  assert.equal(child.error, undefined, child.error?.message);
  assert.equal(child.status, 0, `${child.stdout}\n${child.stderr}`);
  assert.match(child.stdout, /isolated-director-package-ok/);
});
