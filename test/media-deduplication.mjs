import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,lstat} from 'node:fs/promises';
import {readFileSync,closeSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {applyMediaMigration,verifyMediaLayout} from '../tools/migrate-media-layout.mjs';
import {planBlobExport} from '../tools/export-media-blob.mjs';
import {planMediaDeduplication,applyMediaDeduplication} from '../tools/deduplicate-media.mjs';
import {readMediaLayout,resolveMediaPath,openPublicMedia,resolvePublicMedia,validateMediaAliases} from '../tools/media-layout.mjs';

async function fixture(t){
  const root=await mkdtemp(join(tmpdir(),'croupier-dedup-'));t.after(()=>rm(root,{recursive:true,force:true}));
  for(const path of ['web/public/dealer/streams/orig/a.h264','web/public/dealer/streams/a.h264','assets/astrid-3d/a.h264']){
    await mkdir(join(root,path,'..'),{recursive:true});await writeFile(join(root,path),'exact original video bytes');
  }
  await applyMediaMigration({root});const layout=readMediaLayout(root),index={...await planBlobExport({root,includeSource:true}),verification:'readback-sha256'};
  await writeFile(join(root,'media/blob-index.json'),JSON.stringify(index));return {root,layout,index};
}
test('dedup removes physical copies while local URLs, legacy paths, IDs and export storage stay exact',async t=>{
  const {root,layout,index}=await fixture(t),plan=planMediaDeduplication({layout,index});
  assert.equal(plan.summary.localFiles,2);assert.equal(plan.summary.blobObjects,2);
  await applyMediaDeduplication(plan,{root});
  const next=readMediaLayout(root),canonical=next.files.find(row=>!row.canonicalPath);
  for(const row of next.files){
    assert.equal(resolveMediaPath(row.legacyPath,{repositoryRoot:root}),join(root,'media',canonical.path));
    assert.equal(resolveMediaPath('media/'+row.path,{repositoryRoot:root}),join(root,'media',canonical.path));
    if(row.canonicalPath)await assert.rejects(lstat(join(root,'media',row.path)),{code:'ENOENT'});
    if(row.publicUrl){for(const url of [row.publicUrl,'/media/'+row.path]){const opened=openPublicMedia(url,{repositoryRoot:root});assert.equal(readFileSync(opened.fd).toString(),'exact original video bytes');closeSync(opened.fd);}}
    else assert.equal(resolvePublicMedia('/media/'+row.path,{repositoryRoot:root}),null,'source aliases never become public');
  }
  const exported=await planBlobExport({root,includeSource:true});
  assert.deepEqual(exported.files,plan.nextIndex.files);
  for(let i=0;i<index.files.length;i++){const {storage,...before}=index.files[i],{storage:afterStorage,...after}=plan.nextIndex.files[i];assert.deepEqual(after,before);assert.equal(afterStorage.sha256,storage.sha256);}
  assert.deepEqual((await verifyMediaLayout({root})).errors,[]);
  const repeat=planMediaDeduplication({layout:next,index:plan.nextIndex});assert.equal(repeat.summary.localFiles,0);assert.equal(repeat.summary.blobObjects,0);
});
test('changed bytes or tampered plans fail before switching metadata or removing any file',async t=>{
  const {root,layout,index}=await fixture(t),plan=planMediaDeduplication({layout,index}),before=await readFile(join(root,'media/layout.json'),'utf8');
  await assert.rejects(applyMediaDeduplication({...plan,localDeletes:[]},{root}),/plan changed/);
  await writeFile(join(root,'media',plan.localDeletes[0].canonicalPath),'changed');
  await assert.rejects(applyMediaDeduplication(plan,{root}),/bytes changed/);
  assert.equal(await readFile(join(root,'media/layout.json'),'utf8'),before);
  for(const row of plan.localDeletes)assert.ok((await lstat(join(root,'media',row.path))).isFile());
});
test('canonical aliases reject traversal, missing targets, hash/type mismatches and chains',async t=>{
  const {layout,index}=await fixture(t),valid=planMediaDeduplication({layout,index}).nextLayout;
  for(const mutate of [row=>row.canonicalPath='../escape',row=>row.canonicalPath='game/missing.h264',row=>row.canonicalPath=row.path,row=>row.sha256='a'.repeat(64),row=>row.size++,row=>row.path=row.path+'.mp4']){
    const bad=structuredClone(valid);mutate(bad.files.find(row=>row.canonicalPath));assert.throws(()=>validateMediaAliases(bad),/Invalid canonical/);
  }
  const bad=structuredClone(valid),aliases=bad.files.filter(row=>row.canonicalPath);aliases[0].canonicalPath=aliases[1].path;assert.throws(()=>validateMediaAliases(bad),/Invalid canonical/);
});
