import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rename,symlink,rm} from 'node:fs/promises';
import {closeSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {applyMediaMigration} from '../tools/migrate-media-layout.mjs';
import {openPublicMedia,resolveMediaPath,resolvePublicMedia,normalizePresentationArchive,readMediaLayout,validateMediaLayout} from '../tools/media-layout.mjs';
test('public URL aliases serve the same descriptor bytes and forbid directory links',async t=>{
  const root=await mkdtemp(join(tmpdir(),'croupier-public-layout-'));t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(join(root,'web/public/dealer/streams'),{recursive:true});await writeFile(join(root,'web/public/dealer/streams/a.h264'),'immutable frame bytes');
  await applyMediaMigration({root,scope:'all'});
  for(const url of ['/dealer/streams/a.h264','/media/dealers/vera/runtime/indexed/streams/a.h264']){const result=openPublicMedia(url,{repositoryRoot:root});assert.equal(readFileSync(result.fd).toString(),'immutable frame bytes');closeSync(result.fd);}
  const directory=join(root,'media/dealers/vera/runtime/indexed/streams'),outside=join(root,'alternate');await rename(directory,outside);await symlink(outside,directory,process.platform==='win32'?'junction':'dir');
  assert.throws(()=>openPublicMedia('/dealer/streams/a.h264',{repositoryRoot:root}),/links/);
});
test('only the exact retired archive location normalizes; explicit roots and relative paths stay unchanged',()=>{
  const root=process.cwd();assert.equal(normalizePresentationArchive(join(root,'emil/dealklipp-v1'),root),join(root,'media/dealers/astrid/runtime/presentation'));
  for(const value of ['emil/dealklipp-v1',join(root,'external'),join(root,'emil/dealklipp-v1-other')])assert.equal(normalizePresentationArchive(value,root),value);
  assert.equal(resolveMediaPath('pipeline/example.mjs'),join(root,'pipeline/example.mjs'));
  const layout=readMediaLayout();assert.equal(new Set(layout.files.map(row=>row.path)).size,layout.files.length);
});
test('partial media roots preserve renderer and admin code in the existing application',async t=>{
  const root=await mkdtemp(join(tmpdir(),'croupier-partial-media-'));t.after(()=>rm(root,{recursive:true,force:true}));
  for(const [file,body]of [['web/public/kevin-cards/back.png','card bytes'],['web/public/kevin-cards/calibration.mjs','export const calibration={};'],['web/public/bo/img/logo.png','logo bytes'],['web/public/bo/speech-qa.html','<main>Operator QA</main>']]){await mkdir(join(root,file,'..'),{recursive:true});await writeFile(join(root,file),body);}
  await applyMediaMigration({root,scope:'all'});
  for(const file of ['web/public/kevin-cards/calibration.mjs','web/public/bo/speech-qa.html'])assert.equal(resolveMediaPath(file,{repositoryRoot:root}),join(root,file));
  assert.equal(resolveMediaPath('web/public/kevin-cards/back.png',{repositoryRoot:root}),join(root,'media/game/runtime/cards/back.png'));
  assert.ok(!Object.hasOwn(readMediaLayout(root).roots,'web/public/bo'));
  for(const file of ['kevin-cards/calibration.mjs','bo/speech-qa.html']) {
    const sourcePath='services/game/public/'+file;await mkdir(join(root,sourcePath,'..'),{recursive:true});
    await rename(join(root,'web/public',file),join(root,sourcePath));
    assert.equal(resolveMediaPath('web/public/'+file,{repositoryRoot:root,sourcePath}),join(root,sourcePath));
    assert.ok(readFileSync(resolveMediaPath('web/public/'+file,{repositoryRoot:root,sourcePath})).length);
  }
  const sourcePath='services/game/public/kevin-cards/back.png';await writeFile(join(root,sourcePath),'shadow bytes');
  assert.equal(resolveMediaPath('web/public/kevin-cards/back.png',{repositoryRoot:root,sourcePath}),join(root,'media/game/runtime/cards/back.png'));
  assert.throws(()=>resolveMediaPath('web/public/entry.mjs',{repositoryRoot:root,sourcePath:'../outside.mjs'}),/Unsafe media path/);
  const noLayout=join(root,'without-layout'),code='services/game/public/entry.mjs';await mkdir(join(noLayout,code,'..'),{recursive:true});await writeFile(join(noLayout,code),'export const code=true;');
  assert.equal(readFileSync(resolveMediaPath('web/public/entry.mjs',{repositoryRoot:noLayout,sourcePath:code}),'utf8'),'export const code=true;');
});

test('explicit catalog resolves public and canonical aliases without a layout file', async t => {
  const root=await mkdtemp(join(tmpdir(),'croupier-neon-layout-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const original={path:'dealers/astrid/runtime/source.mp4',legacyPath:'old/source.mp4',access:'source',sha256:'a'.repeat(64),size:32};
  const alias={...original,path:'dealers/astrid/runtime/public.mp4',legacyPath:'web/public/astrid.mp4',access:'public',publicUrl:'/astrid.mp4',canonicalPath:original.path};
  const layout={schemaVersion:1,roots:{},files:[original,alias]},options={repositoryRoot:root,runtimeCatalog:{layout}};
  assert.equal(validateMediaLayout(layout),layout);
  assert.equal(resolveMediaPath('web/public/astrid.mp4',options),join(root,'media',original.path));
  assert.equal(resolvePublicMedia('/astrid.mp4',options).logicalPath,alias.path);
  assert.equal(resolvePublicMedia('/media/'+original.path,options),null,'a public alias does not expose its source path');
  assert.equal(resolvePublicMedia('/%2e%2e/astrid.mp4',options),null);
  assert.throws(()=>resolvePublicMedia('/astrid.mp4',{...options,runtimeCatalog:{layout:null}}),/Invalid media layout/);
  const sourcePath='services/game/public/unregistered.mjs';await mkdir(join(root,sourcePath,'..'),{recursive:true});await writeFile(join(root,sourcePath),'local code');
  assert.equal(resolveMediaPath('web/public/unregistered.mjs',{...options,sourcePath}),join(root,'web/public/unregistered.mjs'),'captured runtime catalog cannot use local source fallback');
  assert.equal(resolveMediaPath('web/public/astrid.mp4',{...options,sourcePath}),join(root,'media',original.path));
});
