import test from 'node:test';
import assert from 'node:assert/strict';
import { applyImportProposals, compatibleImportSlot, importClassification, importFileError, uniqueImportFiles } from './dealer-import.mjs';

const catalog = {dealers:[{id:'nora',label:'Nora'}],limits:{maxFileBytes:134217728},slots:[
  {id:'deal.player.left/box0',label:'Plats 1',eventId:'deal.player.left',situation:'box0',kind:'action',category:'deal'},
  {id:'speak.goodluck/goodluck',label:'Lycka till',eventId:'speak.goodluck',situation:'goodluck',kind:'speech',category:'speech'},
  {id:'pose/vila',pose:'vila',label:'VILA'},
]};
const row = (patch={}) => ({id:'file-1',file:{name:'nora-box1.mp4',size:100},label:'Plats 1',slotId:catalog.slots[0].id,background:'green-screen',state:'ready',...patch});

test('reviewed classification preserves exact box and dealer with alternative role', () => {
  const result = importClassification(row(), 'nora', catalog);
  assert.equal(result.dealerId,'nora'); assert.equal(result.situation,'box0'); assert.equal(result.eventId,'deal.player.left');
  assert.equal(result.role,'alternative'); assert.equal(result.playback,'once'); assert.equal(result.compositing.mode,'green-screen');
  assert.throws(()=>importClassification(row(),'invented-dealer',catalog));
  assert.throws(()=>importClassification(row({slotId:'deal.player.left/box7'}),'nora',catalog));
  assert.throws(()=>importClassification(row({background:''}),'nora',catalog));
  assert.throws(()=>importClassification(row({background:'alpha'}),'nora',catalog),/separat verifierad/);
});
test('same local file is not added twice, including saved and uncertain rows', () => {
  const file={name:'nora-pos1.mp4',size:100,lastModified:42};
  assert.deepEqual(uniqueImportFiles([file,{...file}],[]),{files:[file],duplicates:1});
  for(const state of ['ready','saved','error'])assert.deepEqual(uniqueImportFiles([{...file}],[row({file,state})]),{files:[],duplicates:1});
  const other={...file,name:'nora-pos1-alt.mp4'};
  assert.deepEqual(uniqueImportFiles([other],[row({file})]),{files:[other],duplicates:0});
});
test('images stay local references, audio only uses exact speech slots', () => {
  assert.equal(compatibleImportSlot({name:'VILA.png'},catalog.slots[2]),true);
  assert.equal(compatibleImportSlot({name:'VILA.png'},catalog.slots[0]),false);
  assert.throws(()=>importClassification(row({file:{name:'VILA.png',size:100},slotId:'pose/vila'}),'nora',catalog));
  assert.throws(()=>importClassification(row({file:{name:'greeting.wav',size:100}}),'nora',catalog));
  const audio = importClassification(row({file:{name:'goodluck.wav',size:100},slotId:catalog.slots[1].id,background:''}),'nora',catalog);
  assert.equal(audio.mediaType,'audio'); assert.equal(audio.compositing,undefined);
});
test('proposal cannot change saved rows, files, dealer or upload classification', () => {
  const original = row(); const saved=row({id:'saved',state:'saved'});
  const next=applyImportProposals([original,saved],[{fileId:original.id,slotId:'invented',reason:'model suggestion',classification:{dealerId:'other'}},{fileId:'saved',slotId:catalog.slots[1].id}],catalog.slots);
  assert.equal(next[0].slotId,''); assert.equal(next[0].file,original.file); assert.equal(next[1],saved);
  assert.equal(next[0].classification,undefined);
  assert.ok(importFileError({name:'unknown.svg',size:100})); assert.ok(importFileError({name:'idle.mp4',size:134217729}));
});
