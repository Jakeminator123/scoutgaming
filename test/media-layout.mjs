import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rename,symlink,rm} from 'node:fs/promises';
import {closeSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {applyMediaMigration} from '../tools/migrate-media-layout.mjs';
import {openPublicMedia,resolveMediaPath,normalizePresentationArchive,readMediaLayout} from '../tools/media-layout.mjs';
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
});
