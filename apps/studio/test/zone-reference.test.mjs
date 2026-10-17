import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { zoneReferenceResponse, ZONE_REFERENCE_PATH } from '../lib/zone-reference.mjs';
import { mediaBlobPath } from '../lib/cloud-media-store.mjs';
import nextConfig from '../next.config.mjs';

const repositoryRoot = resolve(import.meta.dirname, '../../..');
const image = await readFile(join(repositoryRoot, 'media', ZONE_REFERENCE_PATH));
const layout = JSON.parse(await readFile(join(repositoryRoot, 'media/layout.json'), 'utf8'));
const entry = layout.files.find(row => row.path === ZONE_REFERENCE_PATH);
const sha256 = value => createHash('sha256').update(value).digest('hex');
const LAB = 'https://zone-reference.example.test';
const AUTHORITY = 'zone-reference-test-authority-'.repeat(3);
const localRequest = (options = {}) => new Request('http://127.0.0.1:4188/api/zones/reference', options);
const cloudRequest = (extra = {}, url = 'http://localhost:4188/studio/api/zones/reference') => new Request(url, {
  headers: { host: 'zone-reference.example.test', 'x-forwarded-host': 'zone-reference.example.test',
    'x-forwarded-proto': 'https', 'x-croupier-lab-authorized': AUTHORITY,
    origin: LAB, 'sec-fetch-site': 'same-origin', ...extra },
});

function cloudBoundary(t, enabled = true) {
  const values = { LAB_PUBLIC_URL: enabled ? LAB : undefined,
    CROUPIER_LAB_INTERNAL_SECRET: enabled ? AUTHORITY : undefined,
    CROUPIER_LAB_BASE_PATH: enabled ? '/studio' : undefined };
  const old = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  t.after(() => {
    for (const [key, value] of Object.entries(old)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
}

async function fixture(t, { localImage = false, state, mutateIndex } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'croupier-zone-reference-'));
  t.after(async () => {
    assert.equal(dirname(resolve(root)), resolve(tmpdir()));
    assert.match(basename(root), /^croupier-zone-reference-/);
    await rm(root, { recursive: true, force: true });
  });
  await mkdir(join(root, 'media'), { recursive: true });
  await writeFile(join(root, 'media/layout.json'), JSON.stringify({ schemaVersion: 1, roots: {}, files: [entry] }));
  const file = join(root, 'media', ZONE_REFERENCE_PATH);
  if (localImage) { await mkdir(dirname(file), { recursive: true }); await writeFile(file, image); }
  const id = `${entry.sha256.slice(0, 8)}-${entry.sha256.slice(8, 12)}-${entry.sha256.slice(12, 16)}-${entry.sha256.slice(16, 20)}-${entry.sha256.slice(20, 32)}`;
  const storage = { provider: 'vercel-blob',
    pathname: mediaBlobPath(dirname(ZONE_REFERENCE_PATH).replaceAll('\\', '/'), id, entry.sha256, 'png'),
    sha256: entry.sha256, size: entry.size, contentType: 'image/png' };
  const index = { schemaVersion: 1, namespace: 'croupier/media', verification: 'readback-sha256',
    files: [{ logicalPath: ZONE_REFERENCE_PATH, id, access: 'source', sha256: entry.sha256, size: entry.size, storage }] };
  mutateIndex?.(index);
  const indexPath = join(root, 'blob-index.json');
  await writeFile(indexPath, JSON.stringify(index));
  const calls = [];
  const env = { NODE_ENV: 'production', CROUPIER_MEDIA_STORAGE: 'blob',
    BLOB_READ_WRITE_TOKEN: 'zone-reference-fixture-token', CROUPIER_MEDIA_BLOB_INDEX: indexPath };
  const blobClient = { async get(pathname, options) {
    calls.push(pathname);
    assert.equal(pathname, storage.pathname);
    assert.equal(options.access, 'private');
    assert.equal(options.token, env.BLOB_READ_WRITE_TOKEN);
    if (state === 'missing') return null;
    const bytes = state === 'corrupt' ? Buffer.alloc(image.length, 1) : image;
    return { statusCode: 200, stream: new Response(bytes).body, blob: {
      pathname, url: `https://zonereferencefixture.private.blob.vercel-storage.com/${pathname}`,
      size: bytes.length, contentType: state === 'mime' ? 'video/mp4' : 'image/png' },
      headers: new Headers({ 'content-length': String(bytes.length) }) };
  } };
  const runtimeCatalog={schemaVersion:1,layout:{schemaVersion:1,roots:{},files:[entry]},blobIndex:index,presentation:{},legacy:{schemaVersion:2,entries:{}}};
  const repository={readRuntimeCatalog:async()=>({revision:'a'.repeat(64),value:runtimeCatalog})};
  return { root, file, storage, calls, options: { repositoryRoot: root, repository, env, blobClient, cacheDir: join(root, 'cache') } };
}

async function assertImage(response) {
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/png');
  assert.equal(response.headers.get('cache-control'), 'private, max-age=300');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('cross-origin-resource-policy'), 'same-origin');
  assert.equal(Number(response.headers.get('content-length')), entry.size);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.deepEqual(bytes, image);
  assert.equal(sha256(bytes), entry.sha256);
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(bytes.toString('ascii', 12, 16), 'IHDR');
  assert.equal(bytes.readUInt32BE(16), 1080);
  assert.equal(bytes.readUInt32BE(20), 1920);
}

test('zone reference is the registered exact 1080x1920 PNG without the retired source directory', async t => {
  cloudBoundary(t, false);
  const f = await fixture(t, { localImage: true });
  assert.equal(entry.access, 'source');
  assert.equal(image.length, entry.size);
  assert.equal(sha256(image), entry.sha256);
  await assert.rejects(stat(join(f.root, 'emil')), { code: 'ENOENT' });
  await assertImage(await zoneReferenceResponse(localRequest(), { repositoryRoot: f.root, env: {} }));
});

test('authorized Next internal URL serves private Blob reference bytes without a local image', async t => {
  cloudBoundary(t);
  const f = await fixture(t);
  await assert.rejects(stat(f.file), { code: 'ENOENT' });
  await rm(join(f.root,'media/layout.json'));await rm(join(f.root,'blob-index.json'));
  await assertImage(await zoneReferenceResponse(cloudRequest(), f.options));
  assert.deepEqual(f.calls, [f.storage.pathname]);
});

test('anonymous, wrong gateway authority and foreign callers cannot read zone bytes or reach Blob', async t => {
  cloudBoundary(t);
  const f = await fixture(t);
  const denied = [
    new Request(`${LAB}/studio/api/zones/reference`),
    localRequest(),
    cloudRequest({ 'x-croupier-lab-authorized': '' }),
    cloudRequest({ 'x-croupier-lab-authorized': 'invalid-authority'.repeat(8) }),
    cloudRequest({ host: 'foreign.example.test' }),
    cloudRequest({ 'x-forwarded-host': 'foreign.example.test' }),
    cloudRequest({ origin: 'https://foreign.example.test' }),
    cloudRequest({ 'sec-fetch-site': 'cross-site' }),
    cloudRequest({ 'sec-fetch-site': 'same-site' }),
  ];
  for (const request of denied) {
    const response = await zoneReferenceResponse(request, f.options);
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.doesNotMatch(response.headers.get('content-type'), /^image\//);
    assert.notDeepEqual(Buffer.from(await response.arrayBuffer()), image);
  }
  assert.equal(f.calls.length, 0);
});

test('active cloud source failure cannot fall back to an exact local zone image', async t => {
  cloudBoundary(t);
  const cases = {
    'missing-neon-catalog': { noIndex: true },
    'missing-row': { mutateIndex: index => { index.files = []; } },
    'wrong-access': { mutateIndex: index => { index.files[0].access = 'public'; } },
    'missing-object': { state: 'missing' },
    'corrupt-object': { state: 'corrupt' },
    'wrong-object-mime': { state: 'mime' },
    'missing-blob-configuration': { noBlob: true },
  };
  for (const [name, config] of Object.entries(cases)) await t.test(name, async nested => {
    const f = await fixture(nested, { localImage: true, ...config });
    if (config.noIndex) delete f.options.repository;
    if (config.noBlob) {
      delete f.options.env.CROUPIER_MEDIA_BLOB_INDEX;
      delete f.options.env.CROUPIER_MEDIA_STORAGE;
      delete f.options.env.BLOB_READ_WRITE_TOKEN;
    }
    const response = await zoneReferenceResponse(cloudRequest(), f.options);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal((await stat(f.file)).size, image.length);
    assert.notDeepEqual(Buffer.from(await response.arrayBuffer()), image);
    assert.equal(f.calls.length, config.state ? 1 : 0);
  });
});

test('zone reference production tracing excludes local registers and source image bytes', () => {
  const files = nextConfig.outputFileTracingIncludes['/api/zones/reference'];
  for(const file of ['../../media/layout.json','../../media/blob-index.json','../../media/catalog/*.json'])assert.ok(!files.includes(file));
  const excluded=nextConfig.outputFileTracingExcludes['/*'];
  for(const file of ['../../media/layout.json','../../media/blob-index.json','../../media/catalog/**'])assert.ok(excluded.includes(file));
  assert.ok(!files.some(file => file.includes('emil/') || file.endsWith('.png')));
});
