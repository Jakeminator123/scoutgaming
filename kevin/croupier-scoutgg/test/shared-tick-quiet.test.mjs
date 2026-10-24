import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {classifyManifest} from '../server/media-registry.mjs';
import {createSharedTable} from '../server/shared-table.mjs';
const {manifest}=classifyManifest(JSON.parse(readFileSync(new URL('../public/media/manifest.json',import.meta.url),'utf8')));

// Kevin 24 Oct: prod at 100 % CPU, 740 rooms loaded and saved by every tick
test('tick skips the rooms nobody sits at and still runs the table that plays', () => {
  const dir=mkdtempSync(join(tmpdir(),'tick-quiet-')),file=join(dir,'t.sqlite');let now=100000;
  const table=createSharedTable(file,{manifest,now:()=>now});
  try{
    for(let i=0;i<400;i++)table.run('viewer',{session:`studio-${i}`,op:'state'});
    const send=(op,args={})=>table.run('kevin',{session:'room',op,requestId:crypto.randomUUID(),...args});
    send('join',{name:'Kevin',seats:[3]});
    let st=table.run('kevin',{session:'room',op:'state'});
    st=send('bet',{seat:3,field:'main',chip:5,version:st.version});
    table.tick();   // the first tick sees every room once
    const t0=performance.now();for(let i=0;i<20;i++)table.tick();const per=(performance.now()-t0)/20;
    assert.ok(per<5,`a tick took ${per.toFixed(1)} ms with 400 empty rooms`);
    now=table.run('kevin',{session:'room',op:'state'}).deadline+1;table.tick();
    assert.equal(table.run('kevin',{session:'room',op:'state'}).phase,'round','the seated table still starts its round');
  }finally{table.close?.();rmSync(dir,{recursive:true,force:true});}
});
