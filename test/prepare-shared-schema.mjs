import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { prepareSharedSchema } from '../tools/prepare-shared-schema.mjs';

test('schema preparation requires explicit safe target and supported PostgreSQL floor', async () => {
  for (const options of [undefined, {}, {expectedDatabase:'postgres'}, {expectedDatabase:'postgres',expectedRole:"app'; COMMIT;"},
    {expectedDatabase:'postgres',expectedRole:'app',minimumServerMajor:15}]) await assert.rejects(prepareSharedSchema(options));
});
test('offline artifact pins bytes and is reproducible without shared mutable manifest', async () => {
  const target={expectedDatabase:'croupier_game',expectedRole:'croupier_game'};
  const first=await prepareSharedSchema(target), original=structuredClone(first);
  assert.equal(first.manifest.sqlSha256,createHash('sha256').update(first.sql).digest('hex'));
  for (const [path,expected] of Object.entries(first.manifest.sourceHashes)) {
    const source=(await readFile(new URL('../'+path,import.meta.url),'utf8')).replaceAll('\r\n','\n');
    assert.equal(createHash('sha256').update(source).digest('hex'),expected);
  }
  first.manifest.tables.length=0; first.manifest.indexes.length=0; first.manifest.functions.length=0;
  assert.deepEqual(await prepareSharedSchema(target),original);
});
test('offline CLI refuses apply flags and returns an unapproved artifact manifest', () => {
  const path=fileURLToPath(new URL('../tools/prepare-shared-schema.mjs',import.meta.url));
  const target=['--database','croupier_game','--role','croupier_game'];
  for (const args of [[],[...target,'--apply'],[...target,'constructor','ignored'],[...target,'__proto__','ignored'],[...target,'--database','other']]) {
    const result=spawnSync(process.execPath,[path,...args],{encoding:'utf8',timeout:10000});
    assert.equal(result.status,1); assert.equal(result.stdout,'');
  }
  const result=spawnSync(process.execPath,[path,...target],{encoding:'utf8',timeout:10000});
  assert.equal(result.status,0,result.stderr);
  const manifest=JSON.parse(result.stdout);
  assert.equal(manifest.applies,false); assert.equal(manifest.productionApproved,false); assert.equal(manifest.minimumServerMajor,18);
});
