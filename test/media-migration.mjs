import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, lstat, symlink, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { applyMediaMigration, rollbackMediaMigration, verifyMediaLayout } from '../tools/migrate-media-layout.mjs';
import { resolveMediaPath, openPublicMedia } from '../tools/media-layout.mjs';
import { closeSync } from 'node:fs';
test('source migration verifies bytes, preserves the old root mapping and restores without overwrite',async()=>{
  const root=await mkdtemp(join(tmpdir(),'croupier-media-migration-'));try{
    await mkdir(join(root,'design-kit/deal'),{recursive:true});await writeFile(join(root,'design-kit/deal/take.mp4'),'exact immutable bytes');
    const result=await applyMediaMigration({root,scope:'all'});assert.equal(result.files,1);assert.equal((await verifyMediaLayout({root})).errors.length,0);
    const resolved=resolveMediaPath('design-kit/deal/take.mp4',{repositoryRoot:root});assert.equal(await readFile(resolved,'utf8'),'exact immutable bytes');
    await assert.rejects(lstat(join(root,'design-kit')),{code:'ENOENT'});
    assert.equal((await rollbackMediaMigration(result.ledger,{root})).restored,1);await writeFile(join(root,'design-kit/deal/take.mp4'),'new draft');
    await assert.rejects(rollbackMediaMigration(result.ledger,{root}),/conflict/);assert.equal(await readFile(resolved,'utf8'),'exact immutable bytes');
  }finally{await rm(root,{recursive:true,force:true});}
});
test('published aliases are exact; source and traversal are not published',async()=>{
  const root=await mkdtemp(join(tmpdir(),'croupier-media-published-'));try{
    await mkdir(join(root,'web/public/dealer/streams'),{recursive:true});await writeFile(join(root,'web/public/dealer/streams/take.h264'),'stream bytes');
    await mkdir(join(root,'assets/astrid-3d'),{recursive:true});await writeFile(join(root,'assets/astrid-3d/source.blend'),'private source');
    await applyMediaMigration({root,scope:'all'});
    const descriptor=openPublicMedia('/dealer/streams/take.h264',{repositoryRoot:root});assert.ok(descriptor);closeSync(descriptor.fd);
    for(const url of ['/media/dealers/astrid/source/3d/source.blend','/dealer/../dealer/streams/take.h264','/%2e%2e/source.blend','/dealer/streams/take.h264?token=x','/unknown.png'])assert.equal(openPublicMedia(url,{repositoryRoot:root}),null);
  }finally{await rm(root,{recursive:true,force:true});}
});
test('conflicting canonical copies are never replaced',async()=>{
  const root=await mkdtemp(join(tmpdir(),'croupier-media-conflict-'));try{
    await mkdir(join(root,'design-kit'),{recursive:true});await writeFile(join(root,'design-kit/take.mp4'),'source');
    await mkdir(join(root,'media/site/source/design-kit'),{recursive:true});await writeFile(join(root,'media/site/source/design-kit/take.mp4'),'draft');
    await assert.rejects(applyMediaMigration({root,scope:'all'}),/conflict/);assert.equal(await readFile(join(root,'design-kit/take.mp4'),'utf8'),'source');
  }finally{await rm(root,{recursive:true,force:true});}
});
