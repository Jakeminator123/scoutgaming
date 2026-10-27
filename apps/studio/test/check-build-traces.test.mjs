import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink} from 'node:fs/promises';
import {join,relative,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {checkBuildTraces,privateBuildSource,dealerAuthoringBuildSource} from '../tools/check-build-traces.mjs';

test('managed worktree parent does not erase application traces; private project and external files stay excluded',async()=>{
  const temporary=await mkdtemp(join(tmpdir(),'studio-worktree-trace-'));
  const repositoryRoot=join(temporary,'.codex','worktrees','task','repo');
  const directory=join(repositoryRoot,'apps', 'studio','.next'),file=join(directory,'server','route.js.nft.json');
  try {
    await mkdir(dirname(file),{recursive:true});
    const paths=['apps/studio/lib/studio-model.mjs','ops/neon-game/product-schema.sql','media/blob-index.json',
      '.codex/private.json','.env.local','apps/studio/data/qa.json','web/data/state.db','services/game/data/qa.json','media/dealers/test/source.mp4'];
    const files=paths.map(path=>relative(dirname(file),join(repositoryRoot,path)));
    files.push(relative(dirname(file),join(temporary,'.codex','external-private.json')));
    await writeFile(file,JSON.stringify({version:1,files}));
    await assert.rejects(checkBuildTraces({directory,repositoryRoot}),/private_state/);
    assert.deepEqual(await checkBuildTraces({directory,repositoryRoot,sanitize:true}),{checked:1,removed:7});
    assert.deepEqual(JSON.parse(await readFile(file,'utf8')).files,files.slice(0,3));
  }finally{await rm(temporary,{recursive:true,force:true});}
});
test('traced private credentials, local identities and QA state are forbidden on both path styles',()=>{
  for(const path of ['/app/.env','C:\\app\\lab\\.env.local','/app/lab/data/platform-private/production-neon.json','/app/apps/studio/data/platform-private/production-neon.json','C:\\app\\apps\\studio\\.env.local','/app/web/data/craig.db','/app/services/game/data/qa.json','C:\\app\\services\\game\\data\\qa.json','/app/open-claw/lab/data/state.db','/app/services/openclaw/lab/data/state.db','C:\\app\\services\\openclaw\\lab\\runtime\\state.db','/app/random/private-notes.md','C:\\app\\random\\notes.txt']) assert.equal(privateBuildSource(path),true);
  for(const path of ['/app/ops/neon-game/product-schema.sql','/app/media/blob-index.json','/app/services/openclaw/lab/deploy/runtime-bundle/roles/croupier-speech.md']) assert.equal(privateBuildSource(path),false);
});

test('dealer authoring media is excluded while shared metadata is preserved',async()=>{
  for(const path of ['/app/media/dealers/paow/raw.mp4','C:\\app\\media\\dealers\\astrid\\index.json'])assert.equal(dealerAuthoringBuildSource(path),true);
  assert.equal(dealerAuthoringBuildSource('/app/media/catalog/legacy.json'),false);
  const root=await mkdtemp(join(tmpdir(),'studio-media-trace-'));
  try {
    await mkdir(join(root,'server'));
    const file=join(root,'server','route.js.nft.json');
    const keep=['../../media/catalog/legacy.json','../../media/catalog/presentation.json','../../media/layout.json','../../media/blob-index.json'];
    await writeFile(file,JSON.stringify({version:1,files:[...keep,'../../media/dealers/astrid/runtime/idle.mp4']}));
    await assert.rejects(checkBuildTraces({directory:root}),/dealer_authoring_media/);
    assert.deepEqual(await checkBuildTraces({directory:root,sanitize:true}),{checked:1,removed:1});
    assert.deepEqual(JSON.parse(await readFile(file,'utf8')).files,keep);
  }finally{await rm(root,{recursive:true,force:true});}
});
test('compiler cache and standalone dependency links are not traversed; server trace links fail closed',async()=>{
  const root=await mkdtemp(join(tmpdir(),'studio-trace-cache-'));
  const cache=await mkdtemp(join(tmpdir(),'studio-compiler-cache-'));
  try {
    await mkdir(join(root,'server'));
    await writeFile(join(root,'server','route.js.nft.json'),JSON.stringify({version:1,files:['../../media/blob-index.json']}));
    await symlink(cache,join(root,'cache'),process.platform==='win32'?'junction':'dir');
    await symlink(cache,join(root,'standalone'),process.platform==='win32'?'junction':'dir');
    assert.deepEqual(await checkBuildTraces({directory:root}),{checked:1,removed:0});
    await symlink(cache,join(root,'server','unsafe'),process.platform==='win32'?'junction':'dir');
    await assert.rejects(checkBuildTraces({directory:root}),/unsafe_build_trace_entry/);
  } finally {await rm(root,{recursive:true,force:true});await rm(cache,{recursive:true,force:true});}
});
test('build verification rejects leaked local state then removes only those trace references',async()=>{
  const root=await mkdtemp(join(tmpdir(),'studio-trace-'));try{
    await mkdir(join(root,'server'));const file=join(root,'server','route.js.nft.json');
    await writeFile(file,JSON.stringify({version:1,files:['../../.env','../../lab/data/qa.json','../../media/blob-index.json','../../ops/neon-game/product-schema.sql']}));
    await assert.rejects(checkBuildTraces({directory:root}),/private_state/);
    assert.deepEqual(await checkBuildTraces({directory:root,sanitize:true}),{checked:1,removed:2});
    assert.deepEqual(JSON.parse(await readFile(file,'utf8')).files,['../../media/blob-index.json','../../ops/neon-game/product-schema.sql']);
    assert.deepEqual(await checkBuildTraces({directory:root}),{checked:1,removed:0});
  }finally{await rm(root,{recursive:true,force:true});}
});

test('layer and video routes trace the bounded media worker and its runtime dependencies',async()=>{
  const {default:config}=await import('../next.config.mjs');
  const {matchesGlob}=await import('node:path');
  const {fileURLToPath}=await import('node:url');
  const {access}=await import('node:fs/promises');
  const required=['lib/layer-media-inspection-worker.mjs','lib/mp4-media-timing.mjs',
    'node_modules/mediabunny/package.json','node_modules/mediabunny/dist/modules/src/index.js',
    'node_modules/sharp/package.json'];
  for(const prefix of ['', '/app'])for(const route of ['/api/layer-assets/**','/api/videos/**']){
    const patterns=config.outputFileTracingIncludes[prefix+route];
    assert.ok(Array.isArray(patterns));
    for(const file of required){
      await access(fileURLToPath(new URL('../'+file,import.meta.url)));
      assert.ok(patterns.some(pattern=>matchesGlob(file,pattern.replace(/^\.\//,''))),route+' must include '+file);
    }
  }
});
