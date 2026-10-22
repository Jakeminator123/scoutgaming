import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createSeedProject,addDealer,defaultPresentationLane} from '../../../packages/presentation/contracts/studio-model.mjs';
import {dealerRemovalStatus} from '../lib/dealer-removal.mjs';
import {lifecycleProject} from '../lib/dealer-lifecycle.mjs';
const archiveFixture=project=>lifecycleProject(project,{dealerId:'linnea',archived:true,records:[]});

const own = () => addDealer(addDealer(createSeedProject(),'linnea','Linnea'),'elin','Elin');
const impactFixture = (dealerId='linnea', extra={}) => ({token:'confirmed-impact',dealerId,mediaCount:0,speechEnabled:false,compositions:[],rooms:[],operators:[],...extra});
const preflightOnly = async(path,init) => {if(path==='/api/dealers/archive-check')return{impact:impactFixture(JSON.parse(init.body).dealerId)};throw Error('Unexpected request');};
const require=createRequire(import.meta.url),{transformSync}=require('next/dist/build/swc');
const compiled=transformSync(readFileSync(new URL('./dealer-removal.tsx',import.meta.url),'utf8'),{filename:'dealer-removal.tsx',jsc:{parser:{syntax:'typescript',tsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
function harness(request=preflightOnly){
 const state=[];let cursor=0;
 const react={...React,useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return[state[i],value=>{state[i]=typeof value==='function'?value(state[i]):value;}];},useRef(initial){const i=cursor++;if(!(i in state))state[i]={current:initial};return state[i];}};
 const module={exports:{}};
 vm.runInNewContext(compiled.code,{module,exports:module.exports,Error,require:name=>{
  if(name==='react')return react;
  if(name.includes('dealer-removal.mjs'))return{dealerRemovalStatus};
  if(name==='./studio-types')return{requestJson:request};
  if(name==='./media-removal-feedback')return{mediaRemovalMessage:cause=>cause.message??String(cause)};
  if(name==='./dealer-media-library')return{DealerMediaLibrary:()=>null};
  if(name.endsWith('.css'))return{default:{}};
  return require(name);
 }});
 return{render(props){cursor=0;return module.exports.DealerRemoval(props);}};
}
function find(tree,match){if(!tree||typeof tree!=='object')return null;if(match(tree))return tree;for(const child of [tree.props?.children].flat(Infinity)){const found=find(child,match);if(found)return found;}return null;}
const button=(tree,text)=>find(tree,node=>node.type==='button'&&String(node.props.children).includes(text));
const props=(project=own())=>({project,inventory:{videos:[]},dealerId:'linnea',onApplied(){},onInventory(){},onProjectSaved(){},onPendingChange(){}});
const settle=()=>new Promise(resolve=>setImmediate(resolve));
async function confirmArchive(h,p){button(h.render(p),'Arkivera dealer…').props.onClick();await settle();return button(h.render(p),'Arkivera '+p.project.dealers.find(row=>row.id===p.dealerId).label);}
test('registered names and composition references do not create local archive blockers',()=>{
 const p=props();p.project.lanes.push(defaultPresentationLane('linnea'));
 const h=harness(),tree=h.render(p),status=dealerRemovalStatus(p.project,'linnea');
 assert.equal(status.kind,'ready');assert.equal(status.references[0].id,p.project.lanes[0].id);
 assert.equal(button(tree,'Arkivera dealer…').props.disabled,false);
 assert.doesNotMatch(renderToStaticMarkup(tree),/Byt eller ta bort|grunddealer|Stäng av AI-tal/);
 for(const dealerId of ['astrid','adam','molly','kevin']){
  if(!p.project.dealers.some(row=>row.id===dealerId))p.project=addDealer(p.project,dealerId,dealerId);
  p.dealerId=dealerId;assert.equal(dealerRemovalStatus(p.project,dealerId).kind,'ready');
  assert.equal(button(h.render(p),'Arkivera dealer…').props.disabled,false);
 }
 assert.equal(dealerRemovalStatus(p.project,'missing').kind,'missing');
});

test('archive reads the exact impact before one token-bound CAS request and applies only confirmed success',async()=>{
 let resolve;const calls=[],applied=[],pending=[];
 const h=harness((...args)=>{calls.push(args);if(args[0].endsWith('archive-check'))return Promise.resolve({impact:impactFixture()});return new Promise(done=>{resolve=done;});});
 const p={...props(),onApplied:(...args)=>applied.push(args),onPendingChange:x=>pending.push(x)};
 const confirmation=await confirmArchive(h,p);assert.equal(calls.length,1,'opening confirmation only reads consequences');
 assert.equal(calls[0][0],'/api/dealers/archive-check');assert.deepEqual(JSON.parse(calls[0][1].body),{dealerId:'linnea',expectedRevision:p.project.revision});
 const click=confirmation.props.onClick;click();click();
 assert.equal(calls.length,2);assert.deepEqual(applied,[]);
 assert.equal(calls[1][0],'/api/dealers/archive');
 assert.deepEqual(JSON.parse(calls[1][1].body),{dealerId:'linnea',expectedRevision:p.project.revision,archived:true,impactToken:'confirmed-impact'});
 const project=archiveFixture(p.project),inventory={videos:[]};resolve({project,inventory});await settle();
 assert.deepEqual(applied,[[project,inventory,'']]);assert.deepEqual(pending,[true,false,true,false]);
});

test('a server conflict keeps the selected dealer, clears its plan and releases the UI lock',async()=>{
 let applied=0;const pending=[],h=harness(async(path,init)=>{if(path.endsWith('archive-check'))return preflightOnly(path,init);throw Error('studio_conflict');});
 const p={...props(),onApplied(){applied++;},onPendingChange:x=>pending.push(x)};
 (await confirmArchive(h,p)).props.onClick();await settle();
 const tree=h.render(p);assert.equal(applied,0);assert.match(renderToStaticMarkup(tree),/kopplingarna har ändrats/);assert.deepEqual(pending,[true,false,true,false]);
 assert.equal(button(tree,'Arkivera Linnea').props.disabled,true);assert.ok(button(tree,'Kontrollera igen'));
 assert.ok(p.project.dealers.some(row=>row.id==='linnea'));
});

test('unsaved changes disable lifecycle writes and explain how to continue',()=>{
 const h=harness(),p={...props(),disabled:true,disabledReason:'Spara först'};
 const tree=h.render(p);button(tree,'Arkivera dealer…').props.onClick();assert.match(renderToStaticMarkup(tree),/Spara först/);
});
test('trash is accessible with another dealer selected and restores the exact dealer without a publication token',async()=>{
 const original=own(),project=archiveFixture(original);
 project.dealerTrash=[{schemaVersion:1,dealer:original.dealers.find(row=>row.id==='linnea'),lines:original.lines.filter(row=>row.dealerId==='linnea'),idlePolicy:null,activeMediaIds:[],archivedAt:'2026-10-11T12:00:00.000Z'}];
 const calls=[],applied=[],h=harness(async(path,init)=>{calls.push(JSON.parse(init.body));return{project:original,inventory:{videos:[]}};});
 const p={...props(project),dealerId:'astrid',onApplied:(...args)=>applied.push(args)};
 const tree=h.render(p);assert.match(renderToStaticMarkup(tree),/Arkiverade dealers · 1/);
 button(tree,'Återställ dealer').props.onClick();await settle();
 assert.deepEqual(calls[0],{dealerId:'linnea',expectedRevision:project.revision,archived:false});assert.equal(applied[0][2],'linnea');
 assert.match(renderToStaticMarkup(tree),/som utkast/);assert.match(renderToStaticMarkup(tree),/AI-tal förblir avstängt/);assert.match(renderToStaticMarkup(tree),/inte automatiskt igen/);
});

test('a lost archive response is reconciled by reads without repeating the mutation',async()=>{
 const p=props(),saved=archiveFixture(p.project),calls=[],applied=[];
 const h=harness(async(path,init)=>{calls.push(path);if(path.endsWith('archive-check'))return preflightOnly(path,init);if(path==='/api/dealers/archive')throw Error('Network lost');if(path==='/api/project')return{project:saved};if(path==='/api/videos')return{videos:[]};throw Error('Unexpected request');});
 p.onApplied=(...args)=>applied.push(args);(await confirmArchive(h,p)).props.onClick();await settle();
 assert.deepEqual(calls,['/api/dealers/archive-check','/api/dealers/archive','/api/project','/api/videos']);
 assert.equal(applied.length,1);assert.equal(applied[0][0],saved);
});

test('whole dealer purge has a separate preflight and explicit final confirmation',async()=>{
 const project=archiveFixture(own()),calls=[],applied=[],p={...props(project),dealerId:'astrid',onApplied:(...args)=>applied.push(args)};
 const finished=structuredClone(project);finished.revision='purged';finished.dealerTrash=[];
 const h=harness(async(path,init)=>{calls.push([path,JSON.parse(init.body)]);return path.endsWith('delete-check')?{allowed:true,count:2}:{project:finished,inventory:{videos:[]}};});
 button(h.render(p),'Radera dealer permanent…').props.onClick();await settle();
 assert.equal(calls.length,1);assert.equal(calls[0][0],'/api/dealers/delete-check');
 let tree=h.render(p);assert.match(renderToStaticMarkup(tree),/alla 2 ägda mediefiler/);
 button(tree,'Radera dealer och filer permanent').props.onClick();await settle();
 assert.equal(calls[1][0],'/api/dealers/delete');assert.deepEqual(calls[1][1],{dealerId:'linnea',expectedRevision:project.revision});
 assert.equal(applied.length,1);assert.equal(applied[0][0].revision,'purged');
});
test('a dealer upload-grant wait prevents confirmation and shows remaining time',async()=>{
 const calls=[],p={...props(archiveFixture(own())),dealerId:'astrid'},h=harness(async path=>{calls.push(path);return{allowed:false,reason:'studio_media_upload_grant_active',retryAfterMs:120001};});
 button(h.render(p),'Radera dealer permanent…').props.onClick();await settle();
 const tree=h.render(p),final=button(tree,'Radera dealer och filer permanent');
 assert.equal(final.props.disabled,true);final.props.onClick();await settle();
 assert.deepEqual(calls,['/api/dealers/delete-check']);assert.match(renderToStaticMarkup(tree),/cirka 3 minuter/);
});
test('a partially completed dealer purge refreshes pending state, blocks restore and offers resume',async()=>{
 const project=archiveFixture(own()),pending=structuredClone(project),calls=[];
 pending.revision='pending-purge';pending.dealerTrash[0].deletion={state:'pending',requestedAt:'2026-10-11T12:00:00.000Z',mediaIds:[]};
 const p={...props(project),dealerId:'astrid',onProjectSaved:next=>{p.project=next;}};
 const h=harness(async path=>{calls.push(path);if(path.endsWith('delete-check'))return{allowed:true};if(path==='/api/project')return{project:pending};if(path==='/api/videos')return{videos:[]};throw Error('studio_media_delete_failed');});
 button(h.render(p),'Radera dealer permanent…').props.onClick();await settle();
 button(h.render(p),'Radera dealer och filer permanent').props.onClick();await settle();
 const tree=h.render(p);assert.equal(p.project.revision,'pending-purge');assert.equal(button(tree,'Återställ dealer').props.disabled,true);
 assert.ok(button(tree,'Slutför radering'));assert.match(renderToStaticMarkup(tree),/Några filer kan redan vara permanent raderade/);
 assert.equal(calls.filter(path=>path==='/api/dealers/delete').length,1);
});

test('enabled speech and all owned media are included automatically in the server impact',async()=>{
 const p=props();p.project.dealers.find(row=>row.id==='linnea').speechProfile={state:'enabled'};
 p.project.lanes.push(defaultPresentationLane('linnea'));
 const calls=[],h=harness(async(path,init)=>{calls.push(path);return{impact:impactFixture('linnea',{speechEnabled:true,mediaCount:12,compositions:[{id:p.project.lanes[0].id,label:'Sparad scen'}]})};});
 assert.equal(button(h.render(p),'Arkivera dealer…').props.disabled,false);
 const confirm=await confirmArchive(h,p),html=renderToStaticMarkup(h.render(p));
 assert.equal(confirm.props.disabled,false);assert.match(html,/AI-tal stängs av automatiskt/);assert.match(html,/12 klipp och mediefiler/);
 assert.match(html,/Sparad scen/);assert.doesNotMatch(html,/Stäng av AI-tal under|spara innan|Byt eller ta bort/);
 assert.deepEqual(calls,['/api/dealers/archive-check']);
});

test('archive confirmation can be cancelled and stays bound to the selected dealer',async()=>{
 const calls=[],h=harness(async(path,init)=>{calls.push(path);return preflightOnly(path,init);}),p=props();await confirmArchive(h,p);
 assert.ok(find(h.render(p),node=>node.props?.['aria-label']==='Bekräfta arkivering'));
 button(h.render(p),'Avbryt').props.onClick();
 assert.equal(find(h.render(p),node=>node.props?.['aria-label']==='Bekräfta arkivering'),null);
 const oldConfirmation=await confirmArchive(h,p);p.dealerId='elin';
 assert.equal(find(h.render(p),node=>node.props?.['aria-label']==='Bekräfta arkivering'),null);
 assert.ok(button(h.render(p),'Arkivera dealer…'));oldConfirmation.props.onClick();await settle();
 assert.deepEqual(calls,['/api/dealers/archive-check','/api/dealers/archive-check']);
});

test('impact links preserve selection context and target each affected room and company correctly',async()=>{
 const p={...props(),laneId:'another-composition',operatorId:'operator-42',tableId:'room-7'};
 const impact=impactFixture('linnea',{compositions:[{id:'affected-composition',label:'Sparad scen'}],rooms:[{id:'affected-room',name:'Berört rum',operatorId:'affected-operator'}],operators:[{id:'affected-operator',name:'Berört spelbolag'}]});
 const navigated=[];p.onNavigate=(event,href)=>{event.preventDefault();navigated.push(href);};
 const h=harness(async()=>({impact}));await confirmArchive(h,p);const tree=h.render(p);
 const link=find(tree,node=>node.type==='a'&&node.props.children==='Sparad scen');
 const composition=new URL(link.props.href,'https://test.invalid');
 assert.equal(composition.pathname,"/admin/clips");assert.equal(composition.searchParams.get('composition'),'affected-composition');
 assert.equal(composition.searchParams.get('operator'),'operator-42');assert.equal(composition.searchParams.get('table'),'room-7');
 const room=find(tree,node=>node.type==='a'&&node.props.children==='Berört rum'),roomUrl=new URL(room.props.href,'https://test.invalid');
 assert.equal(roomUrl.pathname,'/admin/rooms');assert.equal(roomUrl.searchParams.get('table'),'affected-room');assert.equal(roomUrl.searchParams.get('operator'),'affected-operator');
 const operator=find(tree,node=>node.type==='a'&&node.props.children==='Berört spelbolag'),operatorUrl=new URL(operator.props.href,'https://test.invalid');
 assert.equal(operatorUrl.pathname,'/admin/rooms');assert.equal(operatorUrl.searchParams.get('operator'),'affected-operator');assert.equal(operatorUrl.searchParams.has('table'),false);
 for(const anchor of [link,room,operator]){const query=new URL(anchor.props.href,'https://test.invalid').searchParams;assert.equal(query.get('dealer'),'linnea');assert.equal(query.has('lane'),false);anchor.props.onClick({button:0,preventDefault(){}});}
 assert.equal(navigated.length,3);
});

test('changed server usage requests a fresh consequence check instead of manual unlinking',async()=>{
 const p=props(),calls=[],h=harness(async(path,init)=>{calls.push(path);if(path.endsWith('archive-check'))return preflightOnly(path,init);throw Object.assign(Error('conflict'),{code:'studio_dealer_published'});});
 (await confirmArchive(h,p)).props.onClick();await settle();
 const tree=h.render(p),html=renderToStaticMarkup(tree);assert.match(html,/Kontrollera konsekvenserna igen/);assert.doesNotMatch(html,/Uppdatera paketet|studio_dealer_published/);
 assert.equal(button(tree,'Arkivera Linnea').props.disabled,true);
 assert.equal(p.project.dealers.some(row=>row.id==='linnea'),true);assert.equal(calls.filter(path=>path==='/api/dealers/archive').length,1);
});

test('incomplete deletion checks explain retained files and never enable permanent deletion',async()=>{
 const p={...props(archiveFixture(own())),dealerId:'astrid'},calls=[];
 const h=harness(async path=>{calls.push(path);return{allowed:false,reason:'studio_media_delete_coverage_incomplete'};});
 button(h.render(p),'Radera dealer permanent…').props.onClick();await settle();
 const tree=h.render(p);assert.equal(button(tree,'Radera dealer och filer permanent').props.disabled,true);
 assert.match(renderToStaticMarkup(tree),/inte kan kontrollera alla kopplingar/);assert.match(renderToStaticMarkup(tree),/Inga ytterligare filer raderas/);
 assert.deepEqual(calls,['/api/dealers/delete-check']);
});

test('unconfirmed or mismatched impact responses never enable archive',async()=>{
 for(const impact of [null,impactFixture('elin'),impactFixture('linnea',{token:''}),impactFixture('linnea',{mediaCount:-1}),impactFixture('linnea',{rooms:[{id:'r',name:'Room'}]})]){
  const calls=[],h=harness(async path=>{calls.push(path);return{impact};}),p=props();
  const confirmation=await confirmArchive(h,p);assert.equal(confirmation.props.disabled,true);confirmation.props.onClick();await settle();
  assert.deepEqual(calls,['/api/dealers/archive-check']);assert.match(renderToStaticMarkup(h.render(p)),/Ingen arkivering har skickats/);
 }
});

test('a late consequence response cannot authorize a changed dealer or revision',async()=>{
 for(const change of [p=>{p.dealerId='elin';},p=>{p.project={...p.project,revision:'changed'};}]){
  let resolve;const calls=[],p=props(),h=harness((path)=>{calls.push(path);return new Promise(done=>{resolve=done;});});
  button(h.render(p),'Arkivera dealer…').props.onClick();change(p);h.render(p);
  resolve({impact:impactFixture()});await settle();
  const tree=h.render(p),confirmation=button(tree,'Arkivera Linnea');
  if(confirmation){assert.equal(confirmation.props.disabled,true);confirmation.props.onClick();}
  assert.deepEqual(calls,['/api/dealers/archive-check']);
 }
});

test('a prepared impact expires when the project revision changes',async()=>{
 const calls=[],p=props(),h=harness(async(path,init)=>{calls.push(path);return preflightOnly(path,init);});
 const oldConfirmation=await confirmArchive(h,p);p.project={...p.project,revision:'new-revision'};
 const tree=h.render(p);assert.equal(button(tree,'Arkivera Linnea').props.disabled,true);oldConfirmation.props.onClick();await settle();
 assert.deepEqual(calls,['/api/dealers/archive-check']);
 button(h.render(p),'Kontrollera igen').props.onClick();await settle();assert.equal(button(h.render(p),'Arkivera Linnea').props.disabled,false);
});

test('an older room without a company is shown without inventing a company link',async()=>{
 const p={...props(),operatorId:'unrelated-operator'},impact=impactFixture('linnea',{rooms:[{id:'unowned-room',name:'Äldre rum',operatorId:null}]});
 const h=harness(async()=>({impact})),confirmation=await confirmArchive(h,p),tree=h.render(p);
 assert.equal(confirmation.props.disabled,false);assert.match(renderToStaticMarkup(tree),/Äldre rum/);
 assert.equal(find(tree,node=>node.type==='a'&&node.props.children==='Äldre rum'),null);
});

test('a retained publication blocks permanent deletion without telling the user to repeat archive',async()=>{
 const p={...props(archiveFixture(own())),dealerId:'astrid'},h=harness(async()=>({allowed:false,reason:'studio_dealer_published'}));
 button(h.render(p),'Radera dealer permanent…').props.onClick();await settle();const tree=h.render(p),html=renderToStaticMarkup(tree);
 assert.equal(button(tree,'Radera dealer och filer permanent').props.disabled,true);
 assert.match(html,/sparat spelbolagspaket/);assert.match(html,/innehållet är kvar i arkivet/);assert.doesNotMatch(html,/Kontrollera konsekvenserna igen/);
});
