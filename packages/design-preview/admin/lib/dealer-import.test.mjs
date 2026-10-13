import test from 'node:test';
import assert from 'node:assert/strict';
import { appendAssistantHistory, applyImportProposals, compatibleImportSlot, importBatchError, importClassification, importErrorMessage, importFileError, uniqueImportFiles } from './dealer-import.mjs';

test('runtime readiness error is explained without rewriting the retained failure',()=>{
  const failure={message:'studio_presentation_runtime_update_required Kontrollera biblioteket innan filen läggs till igen.'};
  assert.match(importErrorMessage(failure.message),/Spelmotorn behöver uppdateras/);
  assert.match(importErrorMessage(failure.message),/inget nytt försök görs automatiskt/);
  assert.match(failure.message,/^studio_presentation_runtime_update_required/);
  assert.equal(importErrorMessage('Behörigheten har gått ut.'),'Behörigheten har gått ut.');
});

test('unsupported content type is explained while retaining unrelated failures',()=>{
  const failure={message:'studio_media_content_type_unsupported Kontrollera biblioteket innan filen läggs till igen.'};
  assert.match(importErrorMessage(failure.message),/Endast MP4 och WebM kan sparas/);
  assert.match(importErrorMessage(failure.message),/inget nytt försök görs automatiskt/);
  assert.match(failure.message,/^studio_media_content_type_unsupported/);
  assert.equal(importErrorMessage('studio_media_content_type_unsupported_extra'),'studio_media_content_type_unsupported_extra');
  assert.equal(importErrorMessage('Behörigheten har gått ut.'),'Behörigheten har gått ut.');
});

test('shared assistant history retains complete recent pairs within message and total bounds',()=>{
  let history=[];
  for(let index=0;index<6;index++)history=appendAssistantHistory(history,`user${index}`,`answer${index}`);
  assert.equal(history.length,8);assert.equal(history[0].content,'user2');assert.equal(history.at(-1).content,'answer5');
  const original=structuredClone(history);
  const long=appendAssistantHistory(appendAssistantHistory(history,'u'.repeat(2000),'a'.repeat(5000)),'v'.repeat(2000),'b'.repeat(5000));
  assert.deepEqual(history,original);assert.ok(long.length<=8);assert.ok(long.reduce((size,row)=>size+row.content.length,0)<=12000);
  assert.ok(long.every((row,index)=>row.role===(index%2?'assistant':'user')&&row.content.length<=3000));
  assert.equal(long.at(-1).content,'b'.repeat(3000));
});

const catalog = {dealers:[{id:'nora',label:'Nora'}],limits:{maxFileBytes:134217728},slots:[
  {id:'deal.player.left/box0',label:'Plats 1',eventId:'deal.player.left',situation:'box0',kind:'action',category:'deal'},
  {id:'speak.goodluck/goodluck',label:'Lycka till',eventId:'speak.goodluck',situation:'goodluck',kind:'speech',category:'speech'},
  {id:'pose/vila',pose:'vila',label:'VILA'},
]};
const row = (patch={}) => ({id:'file-1',file:{name:'nora-box1.mp4',size:100},label:'Plats 1',slotId:catalog.slots[0].id,background:'green-screen',state:'ready',...patch});

test('unsupported unsaved rows block the whole batch, including failed rows, without changing files or placements',()=>{
  const video=row({background:'alpha'});
  for(const name of ['pose.png','pose.jpg','pose.jpeg','pose.webp','speech.mp3','speech.wav','unknown.mov','unknown']){
    for(const state of ['ready','error']){
      const unsupported=row({id:'unsupported',file:{name,size:100},slotId:'pose/vila',state});
      const batch=[video,unsupported],before=structuredClone(batch);
      assert.match(importBatchError(batch),/Ta bort ljud, posebilder och andra filformat/);
      assert.match(importBatchError(batch),/innan videorna kan sparas/);
      assert.deepEqual(batch,before);assert.equal(batch[0],video);assert.equal(batch[1],unsupported);
    }
  }
  assert.equal(importBatchError([row(),row({file:{name:'clip.WEBM',size:100}})]),'');
  assert.equal(importBatchError([row(),row({file:{name:'old.wav',size:100},state:'saved'})]),'');
  assert.equal(importBatchError([]),'');
});

test('reviewed classification preserves exact box and dealer with alternative role', () => {
  const result = importClassification(row(), 'nora', catalog);
  assert.equal(result.dealerId,'nora'); assert.equal(result.situation,'box0'); assert.equal(result.eventId,'deal.player.left');
  assert.equal(result.role,'alternative'); assert.equal(result.playback,'once'); assert.equal(result.compositing.mode,'green-screen');
  assert.throws(()=>importClassification(row(),'invented-dealer',catalog));
  assert.throws(()=>importClassification(row({slotId:'deal.player.left/box7'}),'nora',catalog));
  assert.throws(()=>importClassification(row({background:''}),'nora',catalog));
  assert.throws(()=>importClassification(row({background:'alpha'}),'nora',catalog),/Assistentens kontroll och granskning.*inte färdig/);
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
