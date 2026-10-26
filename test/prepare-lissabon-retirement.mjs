import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtemp,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,dirname,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareLissabonRetirement } from '../tools/prepare-lissabon-retirement.mjs';

const fixture = () => ({database:'postgres',role:'studio_qa',releaseSha:'1'.repeat(40),rollbackSha:'2'.repeat(40),
  consumerInventorySha256:'3'.repeat(64),backupSha256:'4'.repeat(64),restoreReceiptSha256:'5'.repeat(64)});

test('retirement preparation fails closed without every explicit evidence reference',async () => {
  for (const value of [undefined,null,{},[],{...fixture(),extra:true}]) await assert.rejects(prepareLissabonRetirement(value));
  for (const key of Object.keys(fixture())) {
    const missing=fixture(); delete missing[key]; await assert.rejects(prepareLissabonRetirement(missing));
    await assert.rejects(prepareLissabonRetirement({...fixture(),[key]:''}));
    await assert.rejects(prepareLissabonRetirement({...fixture(),[key]:"x'; COMMIT;"}));
  }
});

test('retirement artifact is deterministic, hash-bound and does not claim approval',async () => {
  const first=await prepareLissabonRetirement(fixture());
  assert.deepEqual(await prepareLissabonRetirement(fixture()),first);
  assert.equal(first.manifest.sqlSha256,createHash('sha256').update(first.sql).digest('hex'));
  assert.equal(first.manifest.readinessSha256,createHash('sha256').update(first.readinessSql).digest('hex'));
  assert.equal(first.manifest.applies,false); assert.equal(first.manifest.productionApproved,false);
  assert.equal(first.manifest.deploymentRequired,false);
  const different=await prepareLissabonRetirement({...fixture(),rollbackSha:'6'.repeat(40)});
  assert.notEqual(different.manifest.sqlSha256,first.manifest.sqlSha256);
  first.manifest.evidence.role='mutated';
  assert.equal((await prepareLissabonRetirement(fixture())).manifest.evidence.role,'studio_qa');
});

test('offline CLI refuses apply, missing evidence and unknown arguments without exposing evidence',async t => {
  const root=await mkdtemp(join(tmpdir(),'lissabon-offline-'));
  t.after(()=>{assert.equal(dirname(root),resolve(tmpdir()));return rm(root,{recursive:true,force:true});});
  const evidence=join(root,'evidence.json'); await writeFile(evidence,JSON.stringify(fixture()));
  const script=fileURLToPath(new URL('../tools/prepare-lissabon-retirement.mjs',import.meta.url));
  for (const args of [[],['--apply'],['--evidence',evidence,'--apply'],['--evidence',evidence,'--sql','extra']]) {
    const result=spawnSync(process.execPath,[script,...args],{encoding:'utf8',timeout:10000});
    assert.equal(result.status,1); assert.equal(result.stdout,'');
    assert.equal(result.stderr.trim(),'lissabon_retirement_preparation_refused');
  }
  const result=spawnSync(process.execPath,[script,'--evidence',evidence],{encoding:'utf8',timeout:10000});
  assert.equal(result.status,0,result.stderr); assert.equal(JSON.parse(result.stdout).applies,false);
});
