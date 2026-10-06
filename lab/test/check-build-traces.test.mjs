import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {checkBuildTraces,privateBuildSource} from '../tools/check-build-traces.mjs';
test('traced private credentials, local identities and QA state are forbidden on both path styles',()=>{
  for(const path of ['/app/.env','C:\\app\\lab\\.env.local','/app/lab/data/platform-private/production-neon.json','/app/web/data/craig.db','/app/agent-talk/state.json','/app/random/private-notes.md','C:\\app\\random\\notes.txt']) assert.equal(privateBuildSource(path),true);
  for(const path of ['/app/ops/neon-game/product-schema.sql','/app/media/blob-index.json','/app/open-claw/lab/deploy/runtime-bundle/roles/croupier-speech.md']) assert.equal(privateBuildSource(path),false);
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
