import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const script = fileURLToPath(new URL('../pipeline/build-index.mjs',import.meta.url));
const bytes = Buffer.from([0,0,0,1,9,16,0,0,0,1,5,1]);
function fixture(t) {
 const root=mkdtempSync(join(tmpdir(),'dealer-index-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const input=join(root,'input'),output=join(root,'output');mkdirSync(input);mkdirSync(join(output,'streams'),{recursive:true});
 const file='idle-1_speak_win.h264';writeFileSync(join(input,file),bytes);writeFileSync(join(output,'streams',file),bytes);
 const index={version:1,codec:'test',width:1440,height:316,clips:{'idle-1/speak/win':{file,fps:24,frames:[[0,bytes.length]],frameCount:1,audioDelayMs:190,review:'keep'},'idle-1/idle/idle':{file:'idle.h264',frames:[[0,1]]}}};
 const indexFile=join(output,'streams/index.json');writeFileSync(indexFile,JSON.stringify(index));
 return {input,output,file,indexFile,index};
}
test('identical partial rebuild preserves calibration, metadata, dimensions and other clips',t=>{
 const f=fixture(t);execFileSync(process.execPath,[script,f.input,f.output]);
 assert.deepEqual(JSON.parse(readFileSync(f.indexFile)),f.index);
});
test('changed calibrated video fails before replacing deployed files or index',t=>{
 const f=fixture(t);writeFileSync(join(f.input,f.file),Buffer.concat([bytes,Buffer.from([2])]));
 assert.throws(()=>execFileSync(process.execPath,[script,f.input,f.output],{stdio:'pipe'}),/separately staged/);
 assert.deepEqual(JSON.parse(readFileSync(f.indexFile)),f.index);
 assert.deepEqual(readFileSync(join(f.output,'streams',f.file)),bytes);
});
