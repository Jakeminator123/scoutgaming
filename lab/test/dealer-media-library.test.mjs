import test from 'node:test';
import assert from 'node:assert/strict';
import {createSeedProject,addDealer} from '../lib/studio-model.mjs';
import {dealerMediaSlots,mediaClassification,dealerLibraryVideos} from '../lib/dealer-media-library.mjs';
import {uploadMediaBatch} from '../lib/media-upload-batch.mjs';
import {validateManagedStudioMedia} from '../../web/managed-media-contract.mjs';
import {mediaHeaderMatches} from '../lib/media-file-types.mjs';
import {videoFitsLine} from '../lib/video-intake.mjs';
const project=addDealer(createSeedProject(),'paow','PAOW');
test('every deal destination maps to its exact box for every dealer, without borrowing Astrid family',()=>{
  const slots=dealerMediaSlots(project,'deal');
  for(const slot of slots)for(const dealer of project.dealers){
    const value=mediaClassification(project,{dealerId:dealer.id,slotId:slot.id,label:'Clip',contentType:'video/mp4'});
    assert.equal(value.dealerId,dealer.id);assert.equal(value.eventId,slot.eventId);assert.equal(value.situation,slot.situation);
    if(dealer.id!=='astrid')assert.equal(value.familyId,undefined);
  }
  assert.deepEqual(slots.filter(row=>row.situation.startsWith('box')).map(row=>row.situation).sort(),['box0','box1','box2','box3','box4','box5','box6']);
});
test('dealer/category/archive filtering never mixes PAOW with originals and audio cannot be bound as video',()=>{
  const make=(dealerId,contentType='video/mp4')=>mediaClassification(project,{dealerId,slotId:'speak.goodluck/goodluck',label:'Hi',contentType});
  const videos=[{id:'paow',dealer:'paow',classification:make('paow')},{id:'astrid',dealer:'astrid',classification:make('astrid')},{id:'removed',dealer:'paow',classification:{...make('paow'),archived:true}}];
  assert.deepEqual(dealerLibraryVideos(project,{videos},'paow','speech').map(row=>row.id),['paow']);
  assert.deepEqual(dealerLibraryVideos(project,{videos},'paow','speech',true).map(row=>row.id),['removed']);
  const audio=make('paow','audio/wav');assert.equal(videoFitsLine({classification:audio},'paow','speak.goodluck'),false);
  assert.throws(()=>mediaClassification(project,{dealerId:'paow',slotId:'idle.ready/',label:'Wrong',contentType:'audio/wav'}));
});
test('audio contract requires exact speech identity, MIME/path agreement and matching file signature',()=>{
  const id='11111111-1111-4111-8111-111111111111',sha256='a'.repeat(64);
  const classification=mediaClassification(project,{dealerId:'paow',slotId:'speak.goodluck/goodluck',label:'Hej',contentType:'audio/wav'});
  const row={id,sha256,size:32,contentType:'audio/wav',classification,pathname:'croupier/media/dealers/paow/review/uploads/'+id+'/'+sha256+'.wav'};
  assert.deepEqual(validateManagedStudioMedia(row),row);
  assert.throws(()=>validateManagedStudioMedia({...row,contentType:'video/mp4'}));
  assert.throws(()=>validateManagedStudioMedia({...row,classification:{...classification,mediaType:undefined}}));
  assert.equal(mediaHeaderMatches('audio/wav',Buffer.from('RIFF0000WAVEfmt 000000')),true);
  assert.equal(mediaHeaderMatches('audio/wav',Buffer.from('0000ftypisom00000000')),false);
  assert.equal(mediaHeaderMatches('audio/mpeg',Buffer.from('ID3abcdefghijklmno')),true);
});
test('a ten-file batch preserves successes, skips saved rows and never automatically retries an uncertain commit',async()=>{
  const items=Array.from({length:10},(_,i)=>({row:{id:String(i),file:i,state:i===0?'saved':'ready'},classification:{dealerId:'paow'}}));
  const calls=[],states=new Map();
  const saved=await uploadMediaBatch(items,{upload:async file=>{calls.push(file);if(file===4)throw Error('Lost commit response');},onChange:(id,patch)=>states.set(id,{...states.get(id),...patch})});
  assert.equal(saved,8);assert.deepEqual(calls,[1,2,3,4,5,6,7,8,9]);assert.equal(states.get('4').state,'error');assert.equal(states.get('9').state,'saved');
});
