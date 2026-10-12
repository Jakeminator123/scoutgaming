import test from 'node:test';
import assert from 'node:assert/strict';
import {createSeedProject,createEmptyProject,addDealer} from '../lib/studio-model.mjs';
import {dealerMediaSlots,mediaClassification,dealerLibraryVideos,dealerSlotStatus,mediaPage,mediaUsage,mediaMatchesSlot,draftUsesMedia} from '../lib/dealer-media-library.mjs';
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

test('required idle uses only available own registry clips and explicit saved choices',()=>{
  const draft=structuredClone(project),slot=dealerMediaSlots(draft,'idle')[0];
  const video={id:'own-idle',dealer:'paow',available:true,eventId:slot.eventId,situation:''};
  assert.equal(dealerSlotStatus(draft,{videos:[]},'paow',slot).level,'required');
  assert.match(dealerSlotStatus(draft,{videos:[video]},'paow',slot).label,/välj grundloop/);
  const line=draft.lines.find(row=>row.dealerId==='paow'&&row.eventId===slot.eventId);
  line.variants.find(row=>row.id===line.baselineVariantId).videoGenerationId=video.id;
  assert.equal(dealerSlotStatus(draft,{videos:[video]},'paow',slot).level,'ready');
  for(const patch of [{available:false},{dealer:'astrid'},{classification:{archived:true}},{classification:{mediaType:'audio'}}])assert.equal(dealerSlotStatus(draft,{videos:[{...video,...patch}]},'paow',slot).level,'required');
  assert.equal(dealerSlotStatus(draft,{videos:[]},'vera',slot).level,'required');
  const legacy={defaults:{idle:'idle/default'},clips:[{id:'vera-idle',engineKey:'idle/default',dealerId:'vera',available:true,exactParts:['idle']}]};
  assert.equal(dealerSlotStatus(draft,{videos:[]},'vera',slot,legacy).level,'required','legacy inventory alone is not registered media');
  draft.legacyClipPolicy=[{dealerId:'vera',part:'idle',clipId:'missing'}];
  assert.equal(dealerSlotStatus(draft,{videos:[]},'vera',slot,legacy).level,'required');
});
test('recommendations distinguish every exact box and never count archived, unavailable or audio files',()=>{
  const slots=dealerMediaSlots(project,'deal'),slot=slots.find(row=>row.situation==='box3');
  const video={id:'deal',dealer:'paow',available:true,eventId:slot.eventId,situation:'box3'};
  assert.equal(dealerSlotStatus(project,{videos:[video]},'paow',slot).level,'ready');
  for(const patch of [{situation:'box2'},{available:false},{classification:{archived:true}},{classification:{mediaType:'audio'}}])assert.equal(dealerSlotStatus(project,{videos:[{...video,...patch}]},'paow',slot).level,'recommended');
  assert.equal(mediaMatchesSlot(video,slots.find(row=>row.situation==='box4')),false);
});
test('pagination clamps after removal and never displays more than six videos',()=>{
  const clips=Array.from({length:13},(_,id)=>({id}));
  assert.deepEqual(mediaPage(clips,2).items.map(row=>row.id),[6,7,8,9,10,11]);
  assert.deepEqual(mediaPage(clips,3).items.map(row=>row.id),[12]);
  assert.equal(mediaPage(clips.slice(0,6),3).page,1);
  assert.deepEqual(mediaPage([],9),{items:[],page:1,pages:1,total:0});
});
test('an uploaded standard classification does not claim that the clip is active',()=>{
  const video={id:'new-upload',classification:{role:'standard'}};
  assert.equal(mediaUsage(project,video,'paow'),'Inte vald i utkastet');
  const draft=structuredClone(project),line=draft.lines.find(row=>row.dealerId==='paow');
  line.variants.find(row=>row.id===line.baselineVariantId).videoGenerationId=video.id;
  assert.equal(mediaUsage(draft,video,'paow'),'Standard i utkastet');
  assert.equal(mediaUsage(draft,video,'astrid'),'Inte vald i utkastet');
});

test('AI speech references count as active usage; labels and trash bookkeeping do not',()=>{
 const draft=structuredClone(project),id='11111111-1111-4111-8111-111111111111';
 draft.clipLabels={[id]:'Mitt klipp'};
 draft.dealerTrash=[{dealer:{id:'removed'},activeMediaIds:[id]}];
 assert.equal(draftUsesMedia(draft,id),false);
 draft.dealers.find(row=>row.id==='paow').speechProfile={reference:{videoId:id}};
 assert.equal(draftUsesMedia(draft,id),true);
 assert.equal(mediaUsage(draft,{id},'paow'),'Referensklipp för AI-tal');
});


test('former dealer names and new dealers share exact own idle-policy status without global defaults',()=>{
  for(const dealerId of ['astrid','vera','mei','paow']){
    const draft=addDealer(createEmptyProject(),dealerId,dealerId),slot=dealerMediaSlots(draft,'idle')[0];
    const own={id:dealerId+'-idle',dealer:dealerId,available:true,eventId:slot.eventId,situation:''};
    draft.idlePolicy={base:[{videoId:own.id}],variants:[]};
    assert.equal(dealerSlotStatus(draft,{videos:[own]},dealerId,slot).level,'required',dealerId+' never borrows global idle');
    assert.equal(mediaUsage(draft,own,dealerId),'Inte vald i utkastet');
    draft.dealerIdlePolicies=[{dealerId,policy:{base:[{videoId:own.id}],variants:[]}}];
    assert.equal(dealerSlotStatus(draft,{videos:[own]},dealerId,slot).level,'ready');
    assert.equal(mediaUsage(draft,own,dealerId),'Grundloop');
    for(const patch of [{dealer:'foreign-dealer'},{available:false},{classification:{archived:true}},{classification:{mediaType:'audio'}}]){
      assert.equal(dealerSlotStatus(draft,{videos:[{...own,...patch}]},dealerId,slot).level,'required');
    }
  }
});

test('library renders registered clips consistently without requesting local clip-controls',async()=>{
  const {createRequire}=await import('node:module'),{readFileSync}=await import('node:fs'),{runInNewContext}=await import('node:vm');
  const file=new URL('../components/dealer-media-library.tsx',import.meta.url),require=createRequire(file),React=require('react');
  const {renderToStaticMarkup}=require('react-dom/server'),{transformSync}=require('next/dist/build/swc');
  const output=transformSync(readFileSync(file,'utf8'),{filename:file.pathname,jsc:{parser:{syntax:'typescript',tsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
  for(const dealerId of ['astrid','vera','mei','paow']){
    const calls=[],effects=[],module={exports:{}};
    const fakeReact={...React,useState:initial=>[initial,()=>{}],useRef:initial=>({current:initial}),useEffect:run=>effects.push(run)};
    runInNewContext(output.code,{module,exports:module.exports,require:name=>{
      if(name==='react')return fakeReact;
      if(name==='./studio-types')return {requestJson:async path=>{calls.push(path);return {};},studioHref:()=>'/control/clips'};
      if(name==='./media-removal-feedback')return {mediaRemovalMessage:()=>''};
      if(name==='./video-metadata-fields')return {VideoCompositingFields:()=>null,DealerFramingFields:()=>null};
      if(name==='./dealer-video-surface')return {DealerClipPreview:()=>null};
      if(name==='./dealer-file-settings')return {DealerFileSettings:()=>null};
      if(name.endsWith('.css'))return {default:{}};
      return require(name);
    }});
    const draft=addDealer(createEmptyProject(),dealerId,dealerId);
    const own={id:dealerId+'-clip',dealer:dealerId,source:'upload',available:true,label:'Own '+dealerId,previewUrl:'/own',classification:{dealerId,eventId:'idle.ready',situation:''}};
    const tree=module.exports.DealerMediaLibrary({project:draft,inventory:{videos:[own,{...own,id:'foreign',dealer:'foreign-dealer',label:'Foreign clip'}]},dealerId,onInventory(){},onProjectSaved(){},onLifecycleChange(){},onPendingChange(){}});
    const cleanup=effects.map(run=>run());await new Promise(resolve=>setImmediate(resolve));
    assert.deepEqual(calls,[],dealerId+' needs no local registry request');
    const html=renderToStaticMarkup(tree);assert.ok(html.includes('Own '+dealerId));assert.doesNotMatch(html,/Foreign clip|Originalklipp behöver kontrolleras/);
    assert.match(html,/Krävs · välj grundloop/);
    for(const stop of cleanup)if(typeof stop==='function')stop();
  }
});
