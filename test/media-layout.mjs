import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rename,symlink,rm,lstat} from 'node:fs/promises';
import {closeSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {openPublicMedia,resolveMediaPath,resolvePublicMedia,readMediaLayout,validateMediaLayout,validateMediaAliases} from '../tools/media-layout.mjs';
import {writeMediaLayoutFixture} from './fixtures/media-layout-files.mjs';
test('public URL aliases serve the same descriptor bytes and forbid directory links',async t=>{
  const root=await mkdtemp(join(tmpdir(),'croupier-public-layout-'));t.after(()=>rm(root,{recursive:true,force:true}));
  await writeMediaLayoutFixture(root,{files:[{path:'game/runtime/assets/streams/a.h264',legacyPath:'web/public/assets/streams/a.h264',access:'public',publicUrl:'/assets/streams/a.h264',body:'immutable frame bytes'}]});
  for(const url of ['/assets/streams/a.h264','/media/game/runtime/assets/streams/a.h264']){const result=openPublicMedia(url,{repositoryRoot:root});assert.equal(readFileSync(result.fd).toString(),'immutable frame bytes');closeSync(result.fd);}
  const directory=join(root,'media/game/runtime/assets/streams'),outside=join(root,'alternate');await rename(directory,outside);await symlink(outside,directory,process.platform==='win32'?'junction':'dir');
  assert.throws(()=>openPublicMedia('/assets/streams/a.h264',{repositoryRoot:root}),/links/);
});
test('public media opens only exact published URLs, also through a canonical alias',async t=>{
  const root=await mkdtemp(join(tmpdir(),'croupier-public-alias-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const canonicalPath='game/runtime/streams/take.h264',alias='game/runtime/streams/orig/take.h264';
  await writeMediaLayoutFixture(root,{files:[
    {path:canonicalPath,legacyPath:'web/public/streams/take.h264',access:'public',publicUrl:'/streams/take.h264',body:'stream bytes'},
    {path:alias,legacyPath:'web/public/streams/orig/take.h264',access:'public',publicUrl:'/streams/orig/take.h264',canonicalPath},
    {path:'game/source/3d/source.blend',legacyPath:'assets/3d/source.blend',access:'source',body:'private source'}]});
  await assert.rejects(lstat(join(root,'media',alias)),{code:'ENOENT'},'the alias has no file of its own');
  for(const url of ['/streams/take.h264','/streams/orig/take.h264','/media/'+alias]){
    const opened=openPublicMedia(url,{repositoryRoot:root});assert.equal(readFileSync(opened.fd).toString(),'stream bytes',url);closeSync(opened.fd);
  }
  for(const url of ['/media/game/source/3d/source.blend','/streams/../streams/take.h264','/%2e%2e/source.blend','/streams/take.h264?token=x','/unknown.png'])
    assert.equal(openPublicMedia(url,{repositoryRoot:root}),null,url);
});
test('unregistered relative paths stay unchanged and layout paths are unique',()=>{
  const root=process.cwd();
  assert.equal(resolveMediaPath('pipeline/example.mjs'),join(root,'pipeline/example.mjs'));
  const layout=readMediaLayout();assert.equal(new Set(layout.files.map(row=>row.path)).size,layout.files.length);
});
test('partial media roots preserve renderer and admin code in the existing application',async t=>{
  const root=await mkdtemp(join(tmpdir(),'croupier-partial-media-'));t.after(()=>rm(root,{recursive:true,force:true}));
  // The whole cards root moved, but only the image subtree of the site root.
  await writeMediaLayoutFixture(root,{roots:{'web/public/cards':'media/game/runtime/cards','web/public/site/img':'media/site/runtime/img'},files:[
    {path:'game/runtime/cards/back.png',legacyPath:'web/public/cards/back.png',access:'public',publicUrl:'/cards/back.png',body:'card bytes'},
    {path:'site/runtime/img/logo.png',legacyPath:'web/public/site/img/logo.png',access:'public',publicUrl:'/site/img/logo.png',body:'logo bytes'}]});
  for(const [file,body]of [['web/public/cards/calibration.mjs','export const calibration={};'],['web/public/site/speech-qa.html','<main>Operator QA</main>']]){await mkdir(join(root,file,'..'),{recursive:true});await writeFile(join(root,file),body);}
  for(const file of ['web/public/cards/calibration.mjs','web/public/site/speech-qa.html'])assert.equal(resolveMediaPath(file,{repositoryRoot:root}),join(root,file));
  assert.equal(resolveMediaPath('web/public/cards/back.png',{repositoryRoot:root}),join(root,'media/game/runtime/cards/back.png'));
  for(const file of ['cards/calibration.mjs','site/speech-qa.html']) {
    const sourcePath='services/game/public/'+file;await mkdir(join(root,sourcePath,'..'),{recursive:true});
    await rename(join(root,'web/public',file),join(root,sourcePath));
    assert.equal(resolveMediaPath('web/public/'+file,{repositoryRoot:root,sourcePath}),join(root,sourcePath));
    assert.ok(readFileSync(resolveMediaPath('web/public/'+file,{repositoryRoot:root,sourcePath})).length);
  }
  const sourcePath='services/game/public/cards/back.png';await writeFile(join(root,sourcePath),'shadow bytes');
  assert.equal(resolveMediaPath('web/public/cards/back.png',{repositoryRoot:root,sourcePath}),join(root,'media/game/runtime/cards/back.png'));
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

test('canonical dealer paths resolve without treating a historical four-name list as registration',()=>{
  const root=process.cwd();
  for(const dealer of ['dragan','paow-kevin','astrid','vera','amira','mei']) {
    const path=`dealers/${dealer}/runtime/presentation/vila.png`;
    const row={path,legacyPath:`source/${dealer}/vila.png`,access:'private',sha256:'a'.repeat(64),size:32};
    const layout={schemaVersion:1,roots:{},files:[row]};
    assert.equal(validateMediaLayout(layout),layout);
    assert.equal(resolveMediaPath(row.legacyPath,{repositoryRoot:root,runtimeCatalog:{layout}}),join(root,'media',path));
    assert.equal(resolvePublicMedia('/media/'+path,{repositoryRoot:root,runtimeCatalog:{layout}}),null,'valid dealer syntax does not expose private media');
  }
  for(const dealer of ['admin','constructor','runtime','game','Dragan','-dragan','dragan--x','x'.repeat(41),'%2e%2e','..','x%2fy']) {
    const layout={schemaVersion:1,roots:{},files:[{path:`dealers/${dealer}/runtime/a.png`,legacyPath:'source/a.png',access:'private',sha256:'a'.repeat(64),size:32}]};
    assert.throws(()=>validateMediaLayout(layout),/Invalid media entry/);
  }
});

test('canonical aliases reject traversal, missing targets, hash/type mismatches and chains',()=>{
  // One physical file and two aliases with identical bytes: a public URL and a source path.
  const sha256='b'.repeat(64),size=26,canonicalPath='game/runtime/streams/a.h264';
  const valid={schemaVersion:1,roots:{},files:[
    {path:canonicalPath,legacyPath:'web/public/streams/a.h264',access:'public',publicUrl:'/streams/a.h264',sha256,size},
    {path:'game/runtime/streams/orig/a.h264',legacyPath:'web/public/streams/orig/a.h264',access:'public',publicUrl:'/streams/orig/a.h264',sha256,size,canonicalPath},
    {path:'game/source/3d/a.h264',legacyPath:'assets/3d/a.h264',access:'source',sha256,size,canonicalPath}]};
  assert.equal(validateMediaLayout(valid),valid);
  for(const mutate of [row=>row.canonicalPath='../escape',row=>row.canonicalPath='game/missing.h264',row=>row.canonicalPath=row.path,row=>row.sha256='a'.repeat(64),row=>row.size++,row=>row.path=row.path+'.mp4']){
    const bad=structuredClone(valid);mutate(bad.files.find(row=>row.canonicalPath));assert.throws(()=>validateMediaAliases(bad),/Invalid canonical/);
  }
  const bad=structuredClone(valid),aliases=bad.files.filter(row=>row.canonicalPath);aliases[0].canonicalPath=aliases[1].path;assert.throws(()=>validateMediaAliases(bad),/Invalid canonical/);
});
