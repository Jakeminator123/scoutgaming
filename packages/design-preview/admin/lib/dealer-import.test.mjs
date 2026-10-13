import test from 'node:test';
import assert from 'node:assert/strict';
import { appendAssistantHistory, applyImportProposals, compatibleImportSlot, importBatchError, importClassification, importErrorMessage, importFileError, importRowError, uniqueImportFiles, planImportFiles, importDealerId, registerImportDealer } from './dealer-import.mjs';
import { createSeedProject, addDealer } from '../../../../lab/lib/studio-model.mjs';

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

test('new upload batches retire saved receipts while retaining uncertain files and duplicate protection',()=>{
  const saved=Array.from({length:10},(_,i)=>row({id:`saved-${i}`,state:'saved',file:{name:`old-${i}.mp4`,size:100,lastModified:i}}));
  const fresh=Array.from({length:10},(_,i)=>({name:`new-${i}.mp4`,size:100,lastModified:i}));
  const next=planImportFiles(fresh,saved,10);
  assert.equal(next.files.length,10);assert.deepEqual(next.rows,[]);assert.equal(saved.length,10);
  assert.deepEqual(planImportFiles([saved[0].file],saved,10),{files:[],duplicates:1,rows:saved});
  const uncertain=row({id:'uncertain',state:'error',file:{name:'uncertain.mp4',size:100,lastModified:1}});
  assert.throws(()=>planImportFiles(fresh,[...saved,uncertain],10),/1 finns redan/);
  const partial=planImportFiles(fresh.slice(0,9),[...saved,uncertain],10);
  assert.deepEqual(partial.rows,[uncertain]);assert.equal(partial.rows[0].state,'error');
  assert.throws(()=>planImportFiles([{name:'extra.mp4',size:100,lastModified:1}],fresh.map((file,i)=>row({id:String(i),file})),10),/10 finns redan/);
});

test('dealer registration adds only an empty identity with current CAS revision through the normal project writer',async()=>{
  const original=createSeedProject(),calls=[];
  const saved=await registerImportDealer({id:'dragge',name:'Dragge'},async(path,options)=>{
    calls.push({path,options});if(!options)return {project:original};
    const body=JSON.parse(options.body);
    assert.equal(path,'/api/project');assert.equal(options.method,'PUT');assert.equal(body.expectedRevision,original.revision);
    return {project:{...body.project,revision:'new-revision'}};
  });
  assert.equal(calls.length,2);assert.equal(saved.dealers.at(-1).id,'dragge');
  assert.deepEqual(saved.dealers.slice(0,-1),original.dealers);assert.deepEqual(saved.lanes,original.lanes);
  assert.ok(saved.lines.filter(line=>line.dealerId==='dragge').every(line=>line.variants.every(variant=>variant.videoGenerationId===null)));
  assert.equal(original.dealers.some(row=>row.id==='dragge'),false);
  assert.equal(importDealerId('  Drägge Ny  '),'dragge-ny');
});

test('dealer registration rejects duplicates/capacity and never replays uncertain writes',async()=>{
  const original=addDealer(createSeedProject(),'dragge','Dragge');let puts=0;
  const request=async(_path,options)=>{if(options){puts++;throw Error('network failed');}return {project:original};};
  await assert.rejects(registerImportDealer({id:'dragge',name:'Dragge'},request),/finns redan/);
  assert.equal(puts,0);
  await assert.rejects(registerImportDealer({id:'new-dealer',name:'New'},request),/Läs om dealerlistan/);
  assert.equal(puts,1);
  for(const input of [{id:'../other',name:'Test'},{id:'admin',name:'Test'},{id:'valid',name:' '}])
    await assert.rejects(registerImportDealer(input,()=>assert.fail('invalid identity must not request')));
  let full=createSeedProject();for(let i=full.dealers.length;i<32;i++)full=addDealer(full,`own-${i}`,`Own ${i}`);
  await assert.rejects(registerImportDealer({id:'one-more',name:'More'},async(_path,options)=>{assert.equal(options,undefined);return {project:full};}),/gränsen 32/);
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

async function importAssistantHarness(dealers=catalog.dealers,props={},options={}){
  if(props.props||props.request){options={...options,request:props.request};props=props.props??{};}
  const {createRequire}=await import('node:module'),{readFileSync}=await import('node:fs'),{runInNewContext}=await import('node:vm');
  const require=createRequire(import.meta.url),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{transformSync}=require('esbuild');
  const helpers=await import('./dealer-import.mjs'),module={exports:{}},slots=[],effects=[];let cursor=0;
  const react={...React,useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;
    return [slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next}];},useRef(initial){return slots[cursor++]??={current:initial}},useEffect(effect,deps){const i=cursor++;if(!slots[i]||deps.some((dep,j)=>dep!==slots[i][j])){slots[i]=deps;effects.push(effect);}}};
  const source=readFileSync(new URL('../components/studio/dealer-import-assistant.tsx',import.meta.url),'utf8'),output=transformSync(source,{loader:'tsx',format:'cjs',jsx:'automatic'});
  runInNewContext(output.code,{module,exports:module.exports,AbortController,URL,URLSearchParams,crypto:globalThis.crypto,window:{addEventListener(){},removeEventListener(){},confirm:()=>true},document:{addEventListener(){},removeEventListener(){}},
    fetch:options.request??(async(path)=>Response.json(options.response?.(path)??{...catalog,dealers,limits:{...catalog.limits,maxFiles:30},provider:{configured:false}})),require:name=>name==='react'?react
      :name.includes('upload-native-video.mjs')?{uploadNativeVideo(){throw Error('no upload expected')}}
      :name.includes('media-upload-batch.mjs')?{uploadMediaBatch:options.uploadMediaBatch??(()=>{throw Error('no upload expected')})}
      :name.includes('dealer-import.mjs')?helpers:require(name)});
  const render=()=>{cursor=0;return module.exports.DealerImportAssistant(props)};
  const all=(node,predicate)=>!node||typeof node!=='object'?[]:[...(predicate(node)?[node]:[]),...React.Children.toArray(node.props?.children).flatMap(child=>all(child,predicate))];
  const settle=async()=>{for(let i=0;i<4;i++){render();for(const effect of effects.splice(0))effect();await new Promise(resolve=>setImmediate(resolve));}};
  await settle();
  return {props,settle,flush:settle,nodes:predicate=>all(render(),predicate),html:()=>renderToStaticMarkup(render())};
}
test('import recovery and dealer links keep the selected registered dealer in Admin',async()=>{
  const h=await importAssistantHarness();h.nodes(node=>node.type==='select')[0].props.onChange({target:{value:'nora'}});
  h.nodes(node=>node.type==='input'&&node.props.type==='file')[0].props.onChange({target:{files:[{name:'unsupported.mov',size:100,lastModified:1}]}});
  const links=h.nodes(node=>node.type==='a');assert.equal(links.filter(node=>node.props.href==='/admin/clips?dealer=nora').length,2);assert.ok(links.some(node=>node.props.href==='/admin/dealers'));
  assert.match(h.html(),/Filer med fel försöks inte om automatiskt/);assert.doesNotMatch(h.html(),/href="\/control/);
  const empty=await importAssistantHarness([]);assert.ok(empty.nodes(node=>node.type==='a').some(node=>node.props.href==='/admin/dealers'));
});

test('Dragan is preselected by an explicit import link without implicitly approving uploads',async()=>{
  const h=await importAssistantHarness([{id:'dragan',label:'Dragan'}],{requestedDealerId:'dragan'});
  assert.equal(h.nodes(node=>node.type==='select')[0].props.value,'dragan');
  assert.equal(h.nodes(node=>node.type==='input'&&node.props.type==='checkbox').length,0);
  assert.equal(h.nodes(node=>node.type==='input'&&node.props.type==='file')[0].props.disabled,false);
});
test('a later dealer link preserves pending files and requires an explicit dealer switch',async()=>{
  const h=await importAssistantHarness([{id:'nora',label:'Nora'},{id:'dragan',label:'Dragan'}],{requestedDealerId:'nora'});
  h.nodes(node=>node.type==='input'&&node.props.type==='file')[0].props.onChange({target:{files:[{name:'unsupported.mov',size:100,lastModified:1}]}});
  h.props.requestedDealerId='dragan';await h.settle();
  assert.equal(h.nodes(node=>node.type==='select')[0].props.value,'nora');assert.match(h.html(),/Din tidigare import är kvar/);assert.match(h.html(),/unsupported.mov/);
});

function addVideo(h,name='dragan-box1.mp4') {
  h.nodes(node=>node.type==='input'&&node.props.type==='file')[0].props.onChange({target:{files:[new File([new Uint8Array(100)],name,{lastModified:1,type:'video/mp4'})]}});
}
function placeVideo(h,name='dragan-box1.mp4') {
  h.nodes(node=>node.props?.['aria-label']===`Fack för ${name}`)[0].props.onChange({target:{value:catalog.slots[0].id}});
  h.nodes(node=>node.props?.['aria-label']===`Bakgrund för ${name}`)[0].props.onChange({target:{value:'green-screen'}});
}
const saveButton=h=>h.nodes(node=>node.type==='button'&&node.props.className==='dealer-import-primary').at(-1);

test('unmapped file is named beside its row and in the summary; no hidden approval step',async()=>{
  const h=await importAssistantHarness([{id:'dragan',label:'Dragan'}],{requestedDealerId:'dragan'});
  addVideo(h);assert.equal(saveButton(h).props.disabled,true);
  assert.match(h.html(),/dragan-box1.mp4:<\/strong> Välj ett fack för den här filen/);
  assert.ok(h.nodes(node=>node.props?.['aria-label']==='Fack för dragan-box1.mp4')[0].props['aria-describedby']);
  saveButton(h).props.onClick();await h.settle();assert.match(h.html(),/dragan-box1.mp4: Välj ett fack/);
  placeVideo(h);assert.equal(saveButton(h).props.disabled,false);
  assert.match(h.html(),/OK – placera 1 klipp hos Dragan/);
  assert.doesNotMatch(h.html(),/Granska importen|Bekräfta och spara/);
  assert.equal(h.nodes(node=>node.type==='input'&&node.props.type==='checkbox').length,0);
});

test('one explicit OK saves exact dealer and slots after preflight; duplicate clicks do not retry',async()=>{
  const batches=[];
  const h=await importAssistantHarness([{id:'dragan',label:'Dragan'}],{requestedDealerId:'dragan'}, {
    response:path=>path.endsWith('/api/videos')?{uploadMode:'private-client-blob'}:undefined,
    uploadMediaBatch:async(prepared,{onChange})=>{batches.push(prepared);for(const {row} of prepared)onChange(row.id,{state:'saved'});return prepared.length;},
  });
  addVideo(h);placeVideo(h);assert.equal(batches.length,0);
  const click=saveButton(h).props.onClick;click();click();await h.settle();
  assert.equal(batches.length,1);assert.equal(batches[0][0].classification.dealerId,'dragan');
  assert.equal(batches[0][0].classification.situation,'box0');assert.equal(batches[0][0].classification.role,'alternative');
  assert.match(h.html(),/1 av 1 filer sparades hos Dragan/);assert.match(h.html(),/Sparad i valt fack/);
});

test('a changed slot meaning at preflight cannot be approved by an earlier OK',async()=>{
  let changed=false;
  const h=await importAssistantHarness([{id:'dragan',label:'Dragan'}],{requestedDealerId:'dragan'}, {
    response:()=>changed?{...catalog,dealers:[{id:'dragan',label:'Dragan'}],limits:{...catalog.limits,maxFiles:30},slots:[{...catalog.slots[0],situation:'box1'}]}:undefined,
  });
  addVideo(h);placeVideo(h);changed=true;saveButton(h).props.onClick();await h.settle();
  assert.match(h.html(),/Fackens betydelse har ändrats/);
});

test('failed or unsupported rows still block approval while saved rows do not',()=>{
  assert.equal(importRowError(row(),'nora',catalog),'');
  assert.match(importRowError(row({file:{name:'pose.png',size:100}}),'nora',catalog),/Endast MP4 och WebM/);
  assert.equal(importRowError(row({state:'error',message:'Kontrollera biblioteket.'}),'nora',catalog),'Kontrollera biblioteket.');
  assert.equal(importRowError(row({state:'saved',slotId:''}),'nora',catalog),'');
  assert.match(importRowError(row({background:''}),'nora',catalog),/grön bakgrund/);
});

test('Admin import creates the typed dealer once, refreshes the list, and immediately enables file selection',async()=>{
  let project=createSeedProject(),puts=0,changed=0;
  const request=async(url,options)=>{
    if(url.endsWith('/api/project')){
      if(options.method==='PUT'){puts++;project={...JSON.parse(options.body).project,revision:'created-revision'};}
      return Response.json({project});
    }
    return Response.json({...catalog,dealers:project.dealers,limits:{...catalog.limits,maxFiles:30},provider:{configured:false}});
  };
  const h=await importAssistantHarness([],{request,props:{onRegistered:()=>changed++}});
  h.nodes(node=>node.type==='input'&&node.props.maxLength===120)[0].props.onChange({target:{value:'Dragge'}});
  await h.nodes(node=>node.type==='form')[0].props.onSubmit({preventDefault(){}});
  // The onSubmit deliberately does not expose its promise to React.
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(puts,1);assert.equal(changed,1);assert.equal(h.nodes(node=>node.type==='select')[0].props.value,'dragge');
  assert.equal(h.nodes(node=>node.type==='input'&&node.props.type==='checkbox').length,0);
  assert.equal(h.nodes(node=>node.type==='input'&&node.props.type==='file')[0].props.disabled,false);
  assert.match(h.html(),/Dragge är registrerad/);
});

test('Admin import blocks registration while the map has an unsaved draft',async()=>{
  const h=await importAssistantHarness(catalog.dealers,{props:{registrationBlocked:true}});
  assert.equal(h.nodes(node=>node.type==='fieldset')[0].props.disabled,true);
  await h.nodes(node=>node.type==='form')[0].props.onSubmit({preventDefault(){}});
  assert.match(h.html(),/Spara eller avsluta ändringarna i klippkartan/);
});

test('dealer navigation selects only an exact registered dealer and preserves pending files',async()=>{
  const props={requestedDealerId:'nora'};
  const h=await importAssistantHarness([...catalog.dealers,{id:'dragge',label:'Dragge'}],{props});
  await h.flush();assert.equal(h.nodes(node=>node.type==='select')[0].props.value,'nora');
  assert.equal(h.nodes(node=>node.type==='input'&&node.props.type==='checkbox').length,0);
  h.nodes(node=>node.type==='input'&&node.props.type==='file')[0].props.onChange({target:{files:[new File([new Uint8Array(100)],'own.mp4',{lastModified:1})]}});
  props.requestedDealerId='dragge';await h.flush();
  assert.equal(h.nodes(node=>node.type==='select')[0].props.value,'nora');assert.match(h.html(),/own.mp4/);
  props.requestedDealerId='unknown';await h.flush();assert.equal(h.nodes(node=>node.type==='select')[0].props.value,'nora');
});
