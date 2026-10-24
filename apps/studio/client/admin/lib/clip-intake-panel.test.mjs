import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {fileURLToPath} from 'node:url';
import {addDealer,createSeedProject} from '../../../../../packages/presentation/contracts/studio-model.mjs';
import {dealerImportCatalog,validateDealerImportInput,filenameDealerImportRows,finishDealerImportRows} from '../../../lib/dealer-import-catalog.mjs';
import {frozenKevinImportSource} from '../../../lib/dealer-import-plan.mjs';
const fileUrl=new URL('../components/studio/clip-intake-panel.tsx',import.meta.url),require=createRequire(fileUrl);
const React=require('react'),{transformSync}=require('esbuild');
const code=transformSync(readFileSync(fileUrl,'utf8'),{loader:'tsx',format:'cjs',jsx:'automatic'}).code;
const walk=(node,predicate)=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(n=>walk(n,predicate)):[...(predicate(node)?[node]:[]),...walk(node.props?.children,predicate)];
const text=node=>typeof node==='string'||typeof node==='number'?String(node):Array.isArray(node)?node.map(text).join(''):node?.props?text(node.props.children):'';
const catalog={dealers:[{id:'dragan',label:'Dragan'}],limits:{maxFiles:30,maxFileBytes:134217728},slots:[{id:'idle.ready/',eventId:'idle.ready',situation:'',kind:'idle',label:'Vila'}]};
function harness(upload,{importCatalog=catalog,review=()=>({dealerId:'dragan',intent:'mapping',rows:[]}),request}={}){
  const states=[],effects=[];let cursor=0;
  const hooks={...React,useState(initial){const i=cursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return[states[i],value=>states[i]=typeof value==='function'?value(states[i]):value];},useRef(initial){const i=cursor++;return states[i]??={current:initial};},useEffect(fn,deps){const i=cursor++,old=states[i];if(!old||deps.some((value,j)=>value!==old.deps[j])){states[i]={deps,cleanup:old?.cleanup};effects.push(()=>{states[i].cleanup?.();states[i].cleanup=fn();});}},useImperativeHandle(ref,create){ref.current=create();}};
  const module={exports:{}},ref={current:null},requests=[];
  const fetch=async(url,options={})=>{requests.push({url,options});const custom=await request?.(url,options);if(custom)return custom;return{ok:true,status:200,json:async()=>url.includes('import-proposal')?options.method==='POST'?review(JSON.parse(options.body)):importCatalog:{uploadMode:'private-client-blob',videos:[]}};};
  runInNewContext(code,{module,exports:module.exports,fetch,AbortController,URL,File,console,require:name=>name==='react'?hooks:name==='lucide-react'?new Proxy({},{get:()=>()=>null}):name.includes('upload-native-video')?{uploadNativeVideo:upload}:require(name)},{filename:fileURLToPath(fileUrl)});
  const props={ref,dealer:{id:'dragan',label:'Dragan'},groups:[],active:true,blocked:false,hasStandard:()=>false,onBusyChange(){},onPendingChange(){},onInventory(){},onDragChange(){},onBind(){},onOpenSlot(){},onChooseDealer(){}};
  const h={ref,props,requests,render(){cursor=0;return module.exports.ClipIntakePanel(props);},async settle(){for(let i=0;i<5;i++){h.render();while(effects.length)effects.shift()();await new Promise(resolve=>setImmediate(resolve));}},unmount(){for(const state of states)state?.cleanup?.();},drop(dataTransfer){walk(h.render(),n=>n.props?.className?.startsWith('studio-intake-drop'))[0].props.onDrop({preventDefault(){},dataTransfer});},button(label){return walk(h.render(),n=>n.type==='button'&&text(n).startsWith(label))[0];},remove(name){return walk(h.render(),n=>n.type==='button'&&n.props['aria-label']==='Ta bort '+name+' ur listan')[0];}};
  return h;
}

test('pending rows stay visible and cannot be removed while an approved upload batch is running',async()=>{
  const uploaded=[];let release;
  const h=harness(async file=>{uploaded.push(file.name);if(uploaded.length===1)await new Promise(resolve=>{release=resolve;});return{id:'11111111-1111-4111-8111-111111111111'};});
  await h.settle();
  const files=['first.mp4','second.mp4'].map(name=>new File([new Uint8Array(64)],name,{type:'video/mp4'}));
  h.ref.current.addFiles(files.map(file=>({file})),'idle.ready/');await h.settle();
  const oldRemove=h.remove('second.mp4');assert.equal(oldRemove.props.disabled,false);
  h.button('Godkänn och spara').props.onClick();
  oldRemove.props.onClick();await h.settle();
  assert.deepEqual(uploaded,['first.mp4']);
  assert.ok(h.remove('second.mp4'),'the pending file remains visible');
  assert.equal(h.remove('second.mp4').props.disabled,true);
  h.remove('second.mp4').props.onClick();await h.settle();assert.ok(h.remove('second.mp4'));
  release();await h.settle();
  assert.deepEqual(uploaded,['first.mp4','second.mp4']);
  assert.ok(h.remove('second.mp4'),'the saved receipt stays visible');
  assert.equal(h.remove('second.mp4').props.disabled,false);
});

test('delayed panel drops are discarded on context changes, hiding and unmounting',async t=>{
  for(const change of ['context','hidden','unmount'])await t.test(change,async()=>{
    const h=harness(async()=>({id:'unused'}));h.props.contextKey='room-a';await h.settle();
    let release;
    h.drop({types:['Files'],items:[{webkitGetAsEntry:()=>({isFile:true,file:resolve=>{release=resolve;}})}]});
    if(change==='unmount')h.unmount();else{if(change==='context')h.props.contextKey='room-b';else h.props.active=false;await h.settle();}
    release(new File([new Uint8Array(64)],'late.mp4',{type:'video/mp4'}));
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(h.requests.filter(row=>row.options.method==='POST').length,0,'cancelled drops must not request mapping or upload');
    if(change!=='unmount'){await h.settle();assert.equal(h.remove('late.mp4'),undefined);}
  });
});

test('an active panel accepts a completed drop and requests placement once',async()=>{
  const h=harness(async()=>({id:'unused'}));await h.settle();
  const file=new File([new Uint8Array(64)],'current.mp4',{type:'video/mp4'});
  h.drop({types:['Files'],files:[file]});await h.settle();
  assert.ok(h.remove('current.mp4'));
  assert.equal(h.requests.filter(row=>row.options.method==='POST').length,1);
});

test('approved intake preserves frozen Paow source, language, take and file label without approving speech',async()=>{
  const source=frozenKevinImportSource('paow'),uploaded=[],proposals=[];
  const importCatalog=dealerImportCatalog(addDealer(createSeedProject(),'paow','Paow'));
  const h=harness(async(file,classification)=>{uploaded.push({file,classification});return{id:`saved-${uploaded.length}`};},{importCatalog,review(input){
    const checked=validateDealerImportInput(input,importCatalog);
    const rows=finishDealerImportRows(filenameDealerImportRows(checked,importCatalog),checked,importCatalog);
    proposals.push(...rows);return{dealerId:'paow',intent:'mapping',rows};
  }});
  h.props.dealer={id:'paow',label:'Paow'};await h.settle();
  const files=['sv','en'].map(language=>{
    const entry=source.files.find(row=>row.path.endsWith(`/repliker/${language}/bust_2.mp4`));
    return new File([new Uint8Array(entry.size)],'bust_2.mp4',{type:'video/mp4',lastModified:1});
  });
  h.ref.current.addFiles(files.map((file,index)=>({file,path:`paow/repliker/${['sv','en'][index]}/bust_2.mp4`})));await h.settle();
  assert.equal(proposals.length,2,text(h.render()));
  h.button('Godkänn och spara').props.onClick();await h.settle();
  assert.equal(uploaded.length,2);
  assert.deepEqual(uploaded.map(row=>row.classification.label),['bust_2','bust_2']);
  for(const [index,{file,classification}] of uploaded.entries()){
    assert.equal(file,files[index]);assert.equal(classification.notes,proposals[index].classification.notes);
    assert.match(classification.notes,/kevin-paow-c7138759/);
    assert.match(classification.notes,new RegExp(`Språk i källan: ${['sv','en'][index]}\\.`));
    assert.match(classification.notes,/Tagning 2 enligt källan/);
    assert.match(classification.notes,/inte visuellt godkänt/);
    assert.equal(classification.dealerId,'paow');assert.equal(classification.eventId,'speak.other');assert.equal(classification.situation,'bust');
    assert.equal(classification.role,'alternative');assert.equal(classification.playback,'once');
    assert.equal(classification.recordedSpeech,undefined);assert.equal(classification.approved,undefined);
  }
});

test('source note repair requires an explicit save, reports partial conflicts and rereads before retry',async()=>{
  const previous={dealerId:'dragan',eventId:'idle.ready',situation:'',kind:'idle',role:'alternative',playback:'once',label:'Fil',notes:'',compositing:{mode:'green-screen',threshold:0.23,softness:0.15,despill:0}};
  const candidates=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'].map(id=>({id,sha256:'a'.repeat(64),previous,notes:'Importförslag · innehållet är inte visuellt godkänt.'}));
  let reads=0,writes=0,conflict=true;
  const saved=[];
  const h=harness(()=>assert.fail('note repair must not upload media'),{request:async(url,options)=>{
    const body=options.body&&JSON.parse(options.body);
    if(body?.operation==='repair-notes'){reads++;return Response.json({dealerId:'dragan',candidates:candidates.filter(row=>!saved.some(video=>video.id===row.id)),skipped:1});}
    if(url.endsWith('/videos/classify')){
      writes++;assert.equal(options.credentials,'same-origin');assert.deepEqual(body.previous,previous);
      assert.deepEqual(body.metadata,{...previous,notes:candidates[0].notes});
      if(body.id===candidates[1].id&&conflict)return Response.json({error:'studio_conflict'},{status:409});
      saved.push({id:body.id,sha256:body.sha256,classification:body.metadata});return Response.json({videos:saved});
    }
  }});
  await h.settle();assert.equal(h.button('Återställ'),undefined);
  h.button('Kontrollera källnotiser').props.onClick();await h.settle();
  assert.equal(reads,1);assert.equal(writes,0);assert.ok(h.button('Återställ 2 källnotiser'));
  const save=h.button('Återställ 2 källnotiser');save.props.onClick();save.props.onClick();await h.settle();
  assert.equal(writes,2);assert.match(text(h.render()),/1 av 2 notiser sparade\. 1 konflikter/);assert.equal(h.button('Återställ'),undefined);
  conflict=false;h.button('Kontrollera källnotiser').props.onClick();await h.settle();
  h.button('Återställ 1 källnotiser').props.onClick();await h.settle();assert.equal(writes,3);assert.equal(reads,2);
  assert.match(text(h.render()),/1 av 1 notiser sparade\. 0 konflikter, 0 ej bekräftade, 0 inte försökta/);
});

test('source note candidates arriving after a dealer context change cannot be saved',async()=>{
  let release;
  const h=harness(()=>assert.fail('no upload'),{request:async(_url,options)=>{
    if(options.body&&JSON.parse(options.body).operation==='repair-notes')return await new Promise(resolve=>{release=resolve;});
  }});
  await h.settle();h.button('Kontrollera källnotiser').props.onClick();await h.settle();
  h.props.contextKey='another-room';await h.settle();
  release(Response.json({dealerId:'dragan',candidates:[],skipped:0}));await h.settle();
  assert.equal(h.button('Återställ'),undefined);
  assert.equal(h.requests.some(row=>row.url.endsWith('/videos/classify')),false);
});
