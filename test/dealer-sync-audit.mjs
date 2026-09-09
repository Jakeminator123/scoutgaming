import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
const script=new URL('../pipeline/audit-dealer-sync.mjs',import.meta.url).pathname;
function fixture(t) {
 const root=mkdtempSync(join(tmpdir(),'sync-audit-'));t.after(()=>rmSync(root,{recursive:true,force:true}));mkdirSync(join(root,'docs'));
 const bases=['dealer','dealers/astrid','dealers/amira','dealers/mei'].map(b=>join(root,'web/public',b));
 for(const base of bases){
  mkdirSync(join(base,'streams'),{recursive:true});mkdirSync(join(base,'audio/en'),{recursive:true});
  writeFileSync(join(base,'streams/win.h264'),'video');writeFileSync(join(base,'audio/en/win.mp3'),'audio');
  writeFileSync(join(base,'audio/en/bank.json'),JSON.stringify({win:{text:'Well played.'}}));
  writeFileSync(join(base,'streams/index.json'),JSON.stringify({clips:{'idle-1/speak/win':{file:'win.h264',audioDelayMs:100,fps:24,frames:[[0,5]]}}}));
 }
 const run=(...args)=>execFileSync(process.execPath,[script,'--root',root,...args],{encoding:'utf8',stdio:'pipe'});
 run('--record-baseline');return {root,bases,run};
}
test('all dealers pass unchanged; replacing any dealer audio is detected',t=>{
 const f=fixture(t);assert.match(f.run(),/PASS/);
 for(const base of f.bases){const file=join(base,'audio/en/win.mp3');writeFileSync(file,'different');assert.throws(()=>f.run(),/changed since baseline/);writeFileSync(file,'audio');}
});
test('caption and calibration changes require explicit baseline review',t=>{
 const f=fixture(t),base=f.bases[3],bank=join(base,'audio/en/bank.json');
 writeFileSync(bank,JSON.stringify({win:{text:'Different words.'}}));assert.throws(()=>f.run(),/changed since baseline/);
 writeFileSync(bank,JSON.stringify({win:{text:'Well played.'}}));
 const path=join(base,'streams/index.json'),index=JSON.parse(readFileSync(path));delete index.clips['idle-1/speak/win'].audioDelayMs;writeFileSync(path,JSON.stringify(index));
 assert.throws(()=>f.run(),/missing or invalid calibration/);
});

test('embedded speech media and wording are protected by the roster baseline',t=>{
 const f=fixture(t),path=join(f.root,'web/public/speech-media.json');
 const manifest={astrid:{win:{src:'dealers/astrid/audio/en/win.mp3',text:'Well played.',review:'fixture'}}};
 writeFileSync(path,JSON.stringify(manifest));assert.throws(()=>f.run(),/changed since baseline/);
 f.run('--record-baseline');assert.match(f.run(),/PASS/);
 manifest.astrid.win.text='Changed native words';writeFileSync(path,JSON.stringify(manifest));assert.throws(()=>f.run(),/changed since baseline/);
});
