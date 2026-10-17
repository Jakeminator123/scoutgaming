import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareChatImport,saveChatImport} from './dealer-chat-import.mjs';
const catalog={dealers:[{id:'dragan',label:'Dragan'}],slots:[{id:'deal.player.left/box0',label:'Plats 1',kind:'action',category:'deal',eventId:'deal.player.left',situation:'box0'}],limits:{maxFiles:30,maxFileBytes:134217728}};
const files=()=>Array.from({length:30},(_,i)=>new File([new Uint8Array(32)],`dragan-pos1-${i}.mp4`,{type:'video/mp4'}));
function fixture({low=false,changed=false}={}){
 let index=0,mapping=0;const uploads=[];
 const request=async(path,options)=>{
  if(path==='/api/videos')return {uploadMode:'private-client-blob'};
  if(!options)return changed?{...catalog,slots:[{...catalog.slots[0],situation:'box1'}]}:catalog;
  const body=JSON.parse(options.body);mapping++;
  assert.equal(body.files.length,30);assert.ok(body.files.every(file=>Object.keys(file).sort().join(',')==='id,name,size,type'));
  return {dealerId:body.dealerId,intent:'mapping',rows:body.files.map((file,i)=>({fileId:file.id,slotId:catalog.slots[0].id,confidence:low&&i===4?'low':'high',reason:'Exact filename'}))};
 };
 return {request,id:()=>`f${++index}`,uploads,mapping:()=>mapping,upload:async(file,classification)=>uploads.push({file,classification})};
}
test('explicit chat import maps 30 files then saves each exact slot once without a second approval',async()=>{
 const f=fixture(),selected=files();
 const batch=await prepareChatImport({files:selected,dealerId:'dragan',context:'Gröna filmer',background:'green-screen'},f);
 assert.equal(f.uploads.length,0);assert.equal(f.mapping(),1);
 assert.equal(await saveChatImport(batch,f),30);assert.equal(f.uploads.length,30);
 assert.ok(f.uploads.every(({classification})=>classification.dealerId==='dragan'&&classification.situation==='box0'&&classification.role==='alternative'));
 assert.equal(await saveChatImport(batch,f),0);assert.equal(f.uploads.length,30);
});
test('one uncertain proposal remains unassigned and cannot upload until its exact slot is selected',async()=>{
 const f=fixture({low:true});const batch=await prepareChatImport({files:files(),dealerId:'dragan',context:'',background:'green-screen'},f);
 assert.equal(batch.rows[4].slotId,'');await assert.rejects(saveChatImport(batch,f),/dragan-pos1-4.mp4/);assert.equal(f.uploads.length,0);
 batch.rows[4].slotId=catalog.slots[0].id;assert.equal(await saveChatImport(batch,f),30);
});
test('changed catalogue and unsupported alpha never reach an upload',async()=>{
 const f=fixture();const batch=await prepareChatImport({files:files(),dealerId:'dragan',context:'',background:'green-screen'},f);
 await assert.rejects(saveChatImport(batch,{...f,request:fixture({changed:true}).request}),/betydelse har ändrats/);
 batch.rows[0].background='alpha';await assert.rejects(saveChatImport(batch,f),/transparent material/);assert.equal(f.uploads.length,0);
});
test('an uncertain upload is retained as an error and never retried automatically',async()=>{
 const f=fixture();const batch=await prepareChatImport({files:files(),dealerId:'dragan',context:'',background:'green-screen'},f);
 let count=0;
 assert.equal(await saveChatImport(batch,{...f,upload:async()=>{count++;if(count===3)throw Error('Lost receipt');}}),29);
 assert.equal(batch.rows[2].state,'error');assert.match(batch.rows[2].message,/Kontrollera biblioteket/);
 await assert.rejects(saveChatImport(batch,f),/Lost receipt/);assert.equal(f.uploads.length,0);
});
test('missing dealer, more than 30 files, duplicate and malformed inputs are rejected before mapping',async()=>{
 const f=fixture();
 await assert.rejects(prepareChatImport({files:files(),dealerId:'unknown',context:'',background:'green-screen'},f),/registrerad dealer/);
 await assert.rejects(prepareChatImport({files:[...files(),files()[0]],dealerId:'dragan',context:'',background:'green-screen'},f),/1–30/);
 const duplicate=files()[0];await assert.rejects(prepareChatImport({files:[duplicate,duplicate],dealerId:'dragan',context:'',background:'green-screen'},f),/flera gånger/);
 assert.equal(f.mapping(),0);
});
