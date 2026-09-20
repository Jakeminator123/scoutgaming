import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const script=fileURLToPath(new URL('../pipeline/audit-dealer-sync.mjs',import.meta.url));
function fixture(t) {
 const root=mkdtempSync(join(tmpdir(),'sync-audit-'));t.after(()=>rmSync(root,{recursive:true,force:true}));mkdirSync(join(root,'docs'));
 const bases=['dealer','dealers/astrid','dealers/amira','dealers/mei'].map(b=>join(root,'web/public',b));
 for(const base of bases){
  mkdirSync(join(base,'streams'),{recursive:true});mkdirSync(join(base,'audio/en'),{recursive:true});
  writeFileSync(join(base,'streams/win.h264'),'video');writeFileSync(join(base,'audio/en/win.mp3'),'audio');
  writeFileSync(join(base,'audio/en/bank.json'),JSON.stringify({win:{text:'Well played.'}}));
  writeFileSync(join(base,'streams/index.json'),JSON.stringify({clips:{'idle-1/speak/win':{file:'win.h264',audioDelayMs:100,fps:24,frames:[[0,5]]}}}));
 }
 writeFileSync(join(bases[1],'dealing-cues.json'),'{\n  "release": 12\n}\n');
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

test('cue CRLF checkout matches the LF baseline without rewriting either file',t=>{
 const f=fixture(t),file=join(f.bases[1],'dealing-cues.json'),baseline=join(f.root,'docs/dealer-sync-baseline.json');
 const before=readFileSync(baseline),crlf=readFileSync(file,'utf8').replace(/\n/g,'\r\n');
 writeFileSync(file,crlf);assert.match(f.run(),/PASS/);
 assert.equal(readFileSync(file,'utf8'),crlf);assert.deepEqual(readFileSync(baseline),before);
 // A newly recorded fixture must use the same identity on either platform.
 f.run('--record-baseline');assert.deepEqual(readFileSync(baseline),before);
});

test('cue value, whitespace and removal changes still require review',t=>{
 const f=fixture(t),file=join(f.bases[1],'dealing-cues.json'),original=readFileSync(file,'utf8');
 for(const changed of [original.replace('12','13'),original.replace('  ',' '),original.replace(/\n/g,'\r')]){
  writeFileSync(file,changed);assert.throws(()=>f.run(),/hand cues changed/);
 }
 rmSync(file);assert.throws(()=>f.run(),/hand cues changed/);
});

test('binary media hashes remain byte-exact even for CRLF-only changes',t=>{
 const f=fixture(t),file=join(f.bases[1],'audio/en/win.mp3');
 writeFileSync(file,'audio\n');f.run('--record-baseline');
 writeFileSync(file,'audio\r\n');assert.throws(()=>f.run(),/changed since baseline/);
});
