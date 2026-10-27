import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { main, publishedProductUrl } from '../start.mjs';

const forbidden = name => () => assert.fail(`Unexpected ${name}`);

test('default product start never reads or changes saved local projects, including invalid legacy data', async t => {
  const repo = await mkdtemp(join(tmpdir(), 'croupier-data-location-'));
  t.after(() => rm(repo, { recursive: true, force: true }));
  await mkdir(join(repo, 'lissabon/data'), { recursive: true });
  await mkdir(join(repo, 'apps/studio/data'), { recursive: true });
  await writeFile(join(repo, 'lissabon/data/project.json'), 'invalid legacy project');
  await writeFile(join(repo, 'apps/studio/data/project.json'), 'saved local project bytes');
  assert.deepEqual(await main(['--no-open'], { log: () => {}, open: forbidden('browser open') }), { mode: 'product', url: publishedProductUrl });
  assert.equal(await readFile(join(repo, 'lissabon/data/project.json'), 'utf8'), 'invalid legacy project');
  assert.equal(await readFile(join(repo, 'apps/studio/data/project.json'), 'utf8'), 'saved local project bytes');
  assert.deepEqual((await readdir(join(repo, 'apps/studio'))).sort(), ['data']);
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
  await assert.rejects(main(['--unknown'], { log: forbidden('log'), open: forbidden('browser open') }), /node apps\/studio\/start.mjs \[--no-open\]/);
});

test('retired offline fixture and connected flags fail before logging or opening anything', async () => {
  for (const flag of ['--offline', '--skip-build', '--check', '--astrid-camera', '--cloud-storage']) for (const mode of [[], ['--product'], ['--no-open']]) {
    await assert.rejects(main([...mode, flag], { log: forbidden('log'), open: forbidden('browser open') }),
      /avvecklade.*node apps\/studio\/start.mjs.*publicerade produkten.*Sparade lokala data bevaras/);
  }
  await assert.rejects(main(['--offline', '--skip-build', '--no-open'], { log: forbidden('log'), open: forbidden('browser open') }), /avvecklade/);
});
