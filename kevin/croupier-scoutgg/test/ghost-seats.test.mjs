import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {classifyManifest} from '../server/media-registry.mjs';
import {createSharedTable} from '../server/shared-table.mjs';
const {manifest}=classifyManifest(JSON.parse(readFileSync(new URL('../public/media/manifest.json',import.meta.url),'utf8')));

// Kevin 24 Oct: "Table is full bugg a player is finished but reserverad all the table"
function table(){
  const dir=mkdtempSync(join(tmpdir(),'ghost-')),clock={t:100000};
  const t=createSharedTable(join(dir,'t.sqlite'),{manifest,now:()=>clock.t});
  const st=who=>t.run(who,{session:'room',op:'state'});
  const send=(who,op,args={})=>t.run(who,{session:'room',op,requestId:crypto.randomUUID(),version:st(who).version,...args});
  return {t,st,send,clock,close:()=>{t.close?.();rmSync(dir,{recursive:true,force:true});}};
}

test('a player still on the page who neither bets nor acts gives up all his boxes after 90 s; one who bets keeps them', () => {
  const x=table();
  try{
    x.send('guest','join',{name:'Guest 769',seats:[0,1,2,3,4,5,6]});
    assert.equal(x.st('kevin').owners.filter(Boolean).length,7,'the table is full');
    x.clock.t+=60000;x.st('guest');x.t.tick();
    assert.equal(x.st('kevin').owners.filter(Boolean).length,7,'not yet at 60 s');
    x.clock.t+=31000;x.st('guest');x.t.tick();   // his page still asks (seen is fresh)
    assert.equal(x.st('kevin').owners.filter(Boolean).length,0,'released after 90 s idle');
    x.send('kevin','join',{name:'Kevin',seats:[3]});
    assert.ok(x.st('kevin').owners[3],'Kevin can sit down');
    x.send('kevin','bet',{seat:3,field:'main',chip:5});
    x.clock.t+=15000;x.st('kevin');x.t.tick();
    assert.ok(x.st('kevin').owners[3],'a player with a bet keeps his box');
  }finally{x.close();}
});

test('a player who closed the page gives up his boxes after 60 s between rounds', () => {
  const x=table();
  try{
    x.send('guest','join',{name:'Guest',seats:[0,1,2]});
    x.clock.t+=59000;x.t.tick();
    assert.equal(x.st('kevin').owners.filter(Boolean).length,3);
    x.clock.t+=2000;x.t.tick();
    assert.equal(x.st('kevin').owners.filter(Boolean).length,0,'gone 61 s: released');
  }finally{x.close();}
});
