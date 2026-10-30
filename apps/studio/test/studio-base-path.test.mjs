import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import config from '../next.config.mjs';
import { surfaceBundleOptions } from '../client/surface-bundle.mjs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

// vercel.json rewrites /admin, /lobby and /partner to /studio/*; with another basePath
// those documents would 404 while the build stays green.
test('Studio is mounted at the fixed /studio basePath that vercel.json routes to', () => {
  assert.equal(config.basePath, '/studio');
  assert.equal(config.env.NEXT_PUBLIC_LAB_BASE_PATH, config.basePath);
  const routes = JSON.parse(read('../../../vercel.json')).services.studio.routes;
  assert.ok(routes.length > 0);
  for (const route of routes) {
    assert.ok(route.dest.startsWith(config.basePath + '/'), route.dest);
    for (const transform of route.transforms) assert.ok(transform.args.startsWith(config.basePath + '/'), transform.args);
  }
});

test('the client bundles and the documents the build writes use the same /studio basePath', () => {
  for (const surface of ['admin', 'lobby', 'public-lobby']) {
    assert.equal(surfaceBundleOptions(surface).define['process.env.NEXT_PUBLIC_LAB_BASE_PATH'], JSON.stringify(config.basePath), surface);
  }
  // The assistant widget is a public file, served under the basePath.
  assert.ok(existsSync(new URL('../public/assistant-widget.js', import.meta.url)));
  const widget = `${config.basePath}/assistant-widget.js`;
  const build = read('../client/build.mjs');
  // client/build.mjs writes the static documents and the chat-import bundle itself.
  assert.ok(build.includes(`<script src="${widget}" defer></script>`), 'client/build.mjs widget script');
  assert.deepEqual([...build.matchAll(/'process\.env\.NEXT_PUBLIC_LAB_BASE_PATH':('[^']*')/g)].map(match => match[1]), [`'${JSON.stringify(config.basePath)}'`]);
  assert.ok(read('../app/layout.tsx').includes(`<Script src="${widget}"`), 'app/layout.tsx widget script');
});
