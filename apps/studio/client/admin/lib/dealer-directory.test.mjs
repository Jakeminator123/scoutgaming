import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {createEmptyProject,addDealer,defaultPresentationLane} from '../../../../../packages/presentation/contracts/studio-model.mjs';
import {setTemplateDealers,dealerIdFromName} from './dealer-directory.mjs';
import * as dealerDirectoryLib from './dealer-directory.mjs';
import {lifecycleMessage} from './studio-lifecycle.mjs';
import * as lifecycleActions from './lifecycle-actions.mjs';
import * as dealerCoverage from './dealer-coverage.mjs';
const require=createRequire(import.meta.url),React=require('react'),{transformSync}=require('esbuild');
// The kit's dialogs and buttons are function components; expand them so their texts and buttons are inspectable.
const expand=node=>{while(node&&typeof node==='object'&&typeof node.type==='function')node=node.type(node.props);return node;};
const nodes=(raw,predicate)=>{const node=expand(raw);return !node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(child=>nodes(child,predicate)):[...(predicate(node)?[node]:[]),...nodes(node.props?.children,predicate)];};
const text=raw=>{const node=expand(raw);return typeof node==='string'||typeof node==='number'?String(node):Array.isArray(node)?node.map(text).join(''):node?.props?text(node.props.children):'';};
// Hookless stand-ins for the hub primitives: the harness shares one hook cursor with the directory.
const hub={
  HubPage:({title,intro,actions,children})=>React.createElement('div',null,React.createElement('h1',null,title),intro,actions,children),
  Card:({title,aside,children})=>React.createElement('section',null,title&&React.createElement('h2',null,title),aside,children),
  Chip:({children})=>React.createElement('span',null,children),
  Empty:({title,text})=>React.createElement('div',{role:'status'},React.createElement('h3',null,title),text),
  ActionMenu:({name,actions})=>React.createElement('span',{'aria-label':'Åtgärder för '+name},actions.map(a=>React.createElement('button',{key:a.id,type:'button',disabled:Boolean(a.disabled),onClick:a.onSelect},a.label))),
};
const tsx=name=>transformSync(readFileSync(new URL('../components/'+(name.includes('/')?name:'studio/'+name)+'.tsx',import.meta.url),'utf8'),{loader:'tsx',format:'cjs',jsx:'automatic'}).code;
function harness(restoreCompositions=[],additionalDealers=[],search='?dealer=dragan') {
  let remote={project:addDealer(createEmptyProject(),'dragan','Dragan'),inventory:{videos:[]},catalog:{source:'registered',administration:{operators:[],rooms:[],dealers:[{id:'dragan',name:'Dragan'}]}}};
  for(const dealer of additionalDealers){remote.project=addDealer(remote.project,dealer.id,dealer.label);remote.catalog.administration.dealers.push({id:dealer.id,name:dealer.label});}
  const saves=[],changes=[],navigations=[],toasts=[],archives=[],checks=[],deletionChecks=[],deletions=[],slots=[],effects=[],module={exports:{}},dialogModule={exports:{}},kitModule={exports:{}};
  let cursor=0,saveFailure='',readFailure=false,lifecycleFailure='',loads=0,eligibility={allowed:true,count:2};
  const props={active:true,onChanged:()=>changes.push(true)};
  const hooks={...React,useState(initial){const index=cursor++;if(!(index in slots))slots[index]=typeof initial==='function'?initial():initial;return[slots[index],next=>slots[index]=typeof next==='function'?next(slots[index]):next];},useRef(initial){const index=cursor++;return slots[index]??={current:initial};},useEffect(fn,deps){const index=cursor++;if(!slots[index]||deps.some((dep,i)=>dep!==slots[index].deps[i])){effects.push(()=>{slots[index]?.cleanup?.();slots[index]={deps,cleanup:fn()};});}}};
  let archiveCheck=null;
  const impact={dealerId:'dragan',token:'a'.repeat(64),mediaCount:0,speechEnabled:false,operators:[],rooms:[],compositions:[]};
  const client={load:async()=>{loads++;if(readFailure)throw Error('read unavailable');return structuredClone(remote);},save:async project=>{
    saves.push(project);
    if(saveFailure==='conflict')throw Error('En annan ändring har sparats.');
    remote={...remote,project:{...project,revision:'studio.project.2'}};
    if(saveFailure==='lost')throw Error('lost response');return remote.project;
  }};
  const lifecycle={checkDealerArchive:async(project,id)=>{checks.push({id,revision:project.revision});return archiveCheck?archiveCheck(project,id):impact;},dealerLifecycle:async(project,id,archived,plan,current)=>{
    assert.equal(current(),true);archives.push({id,archived,plan,revision:project.revision});
    if(lifecycleFailure==='conflict')throw Object.assign(Error('studio_conflict'),{code:'studio_conflict'});
    remote={...remote,project:{...remote.project,revision:'studio.project.3',dealers:[],dealerTrash:[{dealer:{id,label:'Dragan'},lines:[],compositions:restoreCompositions}]}};
    if(lifecycleFailure==='lost')throw Error('Network lost');
  },checkDealerDeletion:async(project,id)=>{deletionChecks.push({id,revision:project.revision});return eligibility;},deleteDealer:async(project,id,current)=>{
    assert.equal(current(),true);deletions.push({id,revision:project.revision});
    remote={...remote,project:{...remote.project,revision:'studio.project.4',dealers:[],dealerTrash:[]}};
  }};
  const shared={URLSearchParams,AbortController,structuredClone,window:{addEventListener(){},removeEventListener(){}}};
  // The kit's dialog (ConfirmDialog, Dialog) shares the directory's hook cursor, like the hub stand-ins.
  runInNewContext(tsx('ui/kit'),{...shared,module:kitModule,exports:kitModule.exports,require:name=>name==='react'?hooks:require(name)});
  runInNewContext(tsx('ui/dialog'),{...shared,module:dialogModule,exports:dialogModule.exports,require:name=>name==='react'?hooks:name==='lucide-react'?new Proxy({},{get:()=>()=>null}):name==='./kit'?kitModule.exports:require(name)});
  runInNewContext(tsx('dealer-directory'),{...shared,module,exports:module.exports,require:name=>{
    if(name==='react')return hooks;
    if(name==='lucide-react')return new Proxy({},{get:()=>()=>null});
    if(name==='../ui/dialog')return dialogModule.exports;
    if(name==='../ui/kit')return kitModule.exports;
    if(name==='../ui/toast')return{toast:text=>toasts.push(text)};
    if(name.includes('lib/dealer-directory'))return dealerDirectoryLib;
    if(name.includes('lifecycle-actions'))return lifecycleActions;
    if(name.includes('studio-model'))return{addDealer};
    if(name.includes('connected-studio'))return{createStudioClient:()=>client};
    if(name.includes('studio-lifecycle'))return{createLifecycleClient:()=>lifecycle,lifecycleMessage};
    if(name.includes('runtime/navigation'))return{__esModule:true,default:'a',useSearchParams:()=>new URLSearchParams(search),navigate:href=>navigations.push(href)};
    if(name==='../ui/hub')return hub;
    if(name==='./dealer-identity-portrait')return{DealerAvatar:()=>null};
    if(name.includes('dealer-coverage'))return dealerCoverage;
    return require(name);
  }});
  const h={setArchiveCheck:handler=>archiveCheck=handler,props,saves,toasts,archives,checks,deletionChecks,deletions,changes,navigations,impact,setSaveFailure:value=>saveFailure=value,setReadFailure:value=>readFailure=value,setEligibility:value=>eligibility=value,
    setLifecycleFailure:value=>lifecycleFailure=value,patchRemote:change=>{remote=change(structuredClone(remote));},loads:()=>loads,
    render(){cursor=0;return module.exports.DealerDirectory(props);},
    async settle(){for(let i=0;i<5;i++){h.render();while(effects.length)effects.shift()();await new Promise(resolve=>setImmediate(resolve));}},
    button(label){return nodes(h.render(),node=>node.type==='button'&&text(node)===label)[0];},
    dialog(){return nodes(h.render(),node=>node.type==='dialog'&&Boolean(node.props.children))[0];},
    dialogButton(label){return nodes(h.dialog(),node=>node.type==='button'&&text(node)===label)[0];},
    input(name){return nodes(h.render(),node=>node.type==='label'&&text(node).startsWith(name)).flatMap(node=>nodes(node,child=>child.type==='input'))[0];},
  };return h;
}

test('dealer library includes Dragan without a table and opens his own clip intake',async()=>{
  const h=harness();await h.settle();
  assert.match(text(h.render()),/Dragan/);assert.match(text(h.render()),/Inte tilldelad något bolag/);
  assert.equal(nodes(h.render(),node=>node.type==='a'&&text(node)==='Dragan')[0].props.href,'/admin/dealers/dragan?flik=klipp');
  h.button('Lägg till klipp').props.onClick();
  assert.deepEqual(h.navigations,['/admin/dealers/dragan?flik=klipp&panel=intake']);
  assert.equal(h.saves.length,0);
});
test('every registered dealer gets the same ordinary card without a name-bound legacy note',async()=>{
  const h=harness([],[{id:'astrid',label:'Astrid'}]);await h.settle();
  const card=label=>nodes(h.render(),node=>node.type==='li'&&nodes(node,child=>child.type==='a'&&text(child)===label).length)[0];
  const astrid=card('Astrid'),dragan=card('Dragan');
  for(const node of [astrid,dragan])assert.doesNotMatch(text(node),/Legacyreferens|trelagersversion|OpenClaw/);
  for(const [dealer,node] of [['astrid',astrid],['dragan',dragan]]){
    assert.equal(nodes(node,child=>child.type==='a')[0].props.href,`/admin/dealers/${dealer}?flik=klipp`);
    assert.deepEqual(nodes(node,child=>child.type==='button').map(text),['Öppna dealern','Lägg till klipp','Arkivera'],'every card has the same actions');
    nodes(node,child=>child.type==='button'&&text(child)==='Lägg till klipp')[0].props.onClick();
    assert.equal(h.navigations.at(-1),`/admin/dealers/${dealer}?flik=klipp&panel=intake`);
  }
  assert.equal(h.saves.length,0);
});
test('cancelling dealer creation restores focus to its initiating button without saving',async()=>{
  const h=harness();await h.settle();
  let focused=null;
  const target={focus(){focused=target;}};
  const trigger=h.button('Ny dealer');
  if(trigger.props.ref)trigger.props.ref.current=target;
  trigger.props.onClick();
  assert.ok(h.input('Namn'));
  h.button('Avbryt').props.onClick();
  assert.equal(h.input('Namn'),undefined);
  assert.equal(focused,target);
  assert.equal(h.saves.length,0);assert.equal(h.changes.length,0);assert.equal(h.navigations.length,0);
});
test('create asks only for the name, saves the identity once without copying media, voice or room membership',async()=>{
  const h=harness();await h.settle();h.button('Ny dealer').props.onClick();
  assert.deepEqual(nodes(h.dialog(),node=>node.type==='input').map(node=>node.props.type??'text'),['text'],'one name field and no id field');
  assert.doesNotMatch(text(h.dialog()),/\bId\b|Blob|dealers\[\]/);
  h.input('Namn').props.onChange({target:{value:'Nora'}});
  assert.ok(h.dialogButton('Skapa dealer'));
  await nodes(h.render(),node=>node.type==='form')[0].props.onSubmit({preventDefault(){}});await h.settle();
  assert.equal(h.saves.length,1);const saved=h.saves[0];
  assert.deepEqual(saved.dealers.find(row=>row.id==='nora'),{id:'nora',label:'Nora'});
  assert.ok(saved.lines.filter(row=>row.dealerId==='nora').every(row=>row.variants.every(variant=>variant.videoGenerationId===null)));
  assert.equal(saved.lanes?.some(lane=>lane.dealers.includes('nora'))??false,false);
  assert.match(text(h.dialog()),/Nora är sparad/);assert.equal(h.navigations.length,0,'the dialog offers the next step instead of leaving');
  h.dialogButton('Lägg till klipp').props.onClick();
  assert.deepEqual(h.navigations,['/admin/dealers/nora?flik=klipp&panel=intake'],'the next step opens the new dealer on its own clip intake');
  assert.deepEqual(h.toasts,['Nora är sparad.']);
});
test('the id is made from the name by the validation rule and never clashes with active or trashed dealers',async()=>{
  const active=addDealer(addDealer(createEmptyProject(),'nora','Nora'),'ake','Åke');
  const project={...active,dealerTrash:[{dealer:{id:'bjorn-ostlund',label:'Björn Östlund'}}]};
  assert.equal(dealerIdFromName(project,'Nora'),'nora-2');assert.equal(dealerIdFromName(project,'Åke'),'ake-2');
  assert.equal(dealerIdFromName(project,'Björn Östlund'),'bjorn-ostlund-2','the trash keeps its ids');
  assert.equal(dealerIdFromName(project,'Märta Ödman'),'marta-odman');assert.equal(dealerIdFromName(project,'7even'),'dealer-7even');
  assert.equal(dealerIdFromName(project,'Admin'),'admin-2','reserved names get a suffix');assert.equal(dealerIdFromName(project,'Vera'),'vera-2','retired names get a suffix');
  assert.equal(dealerIdFromName(project,'!!!'),'dealer');assert.equal(dealerIdFromName(project,'x'.repeat(80)).length,40);
  for(const name of ['Nora','Åke','Admin','Vera','7even','x'.repeat(80)])assert.doesNotThrow(()=>addDealer(active,dealerIdFromName(active,name),name));
  const h=harness([],[{id:'nora',label:'Nora'}]);await h.settle();h.button('Ny dealer').props.onClick();h.input('Namn').props.onChange({target:{value:'Nora'}});
  await nodes(h.render(),node=>node.type==='form')[0].props.onSubmit({preventDefault(){}});await h.settle();
  assert.deepEqual(h.saves[0].dealers.map(row=>row.id),['dragan','nora','nora-2'],'a second Nora gets the next free id');
});
test('lost create acknowledgement is reconciled without a duplicate write',async()=>{
  const h=harness();await h.settle();h.setSaveFailure('lost');h.button('Ny dealer').props.onClick();h.input('Namn').props.onChange({target:{value:'Nora'}});
  nodes(h.render(),node=>node.type==='form')[0].props.onSubmit({preventDefault(){}});await h.settle();
  assert.equal(h.saves.length,1);assert.match(text(h.dialog()),/Nora är sparad/);
});
test('revision conflicts preserve the creation form and never replay its write',async()=>{
  const h=harness();await h.settle();h.setSaveFailure('conflict');h.button('Ny dealer').props.onClick();h.input('Namn').props.onChange({target:{value:'Nora'}});
  nodes(h.render(),node=>node.type==='form')[0].props.onSubmit({preventDefault(){}});await h.settle();
  assert.equal(h.saves.length,1);assert.equal(h.input('Namn').props.value,'Nora');assert.equal(h.navigations.length,0);
  assert.match(text(h.render()),/En annan ändring/);
});
test('removal opens one dialog, checks the server impact inside it, then sends its exact revision and token',async()=>{
  const h=harness();await h.settle();assert.equal(h.dialog(),undefined);
  h.button('Arkivera').props.onClick();
  assert.ok(h.dialog());assert.match(text(h.dialog()),/Kontrollerar klipp, spelbord, bolag och scenmallar/);assert.equal(h.dialogButton('Flytta till papperskorgen'),undefined);
  await h.settle();
  assert.equal(h.checks.length,1);assert.equal(h.archives.length,0);assert.match(text(h.dialog()),/Ta bort Dragan\?/);assert.match(text(h.dialog()),/Källfiler och publiceringshistorik bevaras/);
  assert.match(text(h.dialog()),/0 klipp följer med till papperskorgen/);
  h.dialogButton('Flytta till papperskorgen').props.onClick();await h.settle();
  assert.equal(h.dialog(),undefined);
  assert.equal(h.archives.length,1);assert.equal(h.archives[0].plan,h.impact);assert.equal(h.archives[0].revision,h.checks[0].revision);
  assert.match(text(h.render()),/Dragan har flyttats till papperskorgen/);
});
test('a pending Studio draft blocks dealer mutations even when a stale button handler is called',async()=>{
  const h=harness();await h.settle();h.props.blocked=true;assert.equal(h.button('Arkivera').props.disabled,true);h.button('Arkivera').props.onClick();await h.settle();
  assert.equal(h.checks.length,0);assert.equal(h.archives.length,0);assert.equal(h.button('Ny dealer').props.disabled,true);
});

test('restore confirmation names the saved compositions before any restore is submitted',async()=>{
  const h=harness([{id:'first',label:'Första mallen'},{id:'second',label:'Andra mallen'}]);await h.settle();
  h.button('Arkivera').props.onClick();await h.settle();h.button('Flytta till papperskorgen').props.onClick();await h.settle();
  h.button('Återställ').props.onClick();await h.settle();
  const review=text(h.dialog());
  assert.match(review,/Återställ Dragan\?/);assert.match(review,/sparade sammansättningar återförs som utkast/);
  assert.match(review,/Sparade sammansättningar \(2\)/);assert.match(review,/Första mallen/);assert.match(review,/Andra mallen/);
  assert.match(review,/AI-tal förblir avstängt/);assert.match(review,/Rum återställs eller öppnas inte automatiskt/);
  assert.equal(h.archives.length,1);assert.ok(h.dialogButton('Återställ dealern'));
  h.dialogButton('Avbryt').props.onClick();assert.equal(h.dialog(),undefined);assert.equal(h.archives.length,1);
});
test('permanent deletion checks the server inside the dialog and requires the file acknowledgement, never an id',async()=>{
  const h=harness();await h.settle();h.button('Arkivera').props.onClick();await h.settle();h.dialogButton('Flytta till papperskorgen').props.onClick();await h.settle();
  h.button('Radera permanent').props.onClick();
  assert.match(text(h.dialog()),/Kontrollerar lagring och beroenden/);
  await h.settle();
  assert.deepEqual(h.deletionChecks,[{id:'dragan',revision:'studio.project.3'}]);
  const dialog=text(h.dialog());
  assert.match(dialog,/Radera Dragan permanent\?/);assert.match(dialog,/2 filer raderas från lagringen/);assert.match(dialog,/Det går inte att ångra/);
  assert.equal(nodes(h.dialog(),node=>node.type==='input').length,1,'no id confirmation field, only the acknowledgement checkbox');
  const confirm=h.dialogButton('Radera permanent');assert.equal(confirm.props.disabled,true);
  confirm.props.onClick();await h.settle();assert.equal(h.deletions.length,0);
  nodes(h.dialog(),node=>node.type==='input'&&node.props.type==='checkbox')[0].props.onChange({target:{checked:true}});
  assert.equal(h.dialogButton('Radera permanent').props.disabled,false);
  h.dialogButton('Radera permanent').props.onClick();await h.settle();
  assert.deepEqual(h.deletions,[{id:'dragan',revision:'studio.project.3'}]);assert.equal(h.dialog(),undefined);
  assert.match(text(h.render()),/Dragan och dealerns egna filer är permanent raderade/);assert.match(text(h.render()),/Papperskorgen är tom/);
});
test('a server refusal keeps the dealer in the trash and explains the wait without any confirm button',async()=>{
  const h=harness();await h.settle();h.button('Arkivera').props.onClick();await h.settle();h.dialogButton('Flytta till papperskorgen').props.onClick();await h.settle();
  h.setEligibility({allowed:false,reason:'studio_media_upload_grant_active',retryAfterMs:9*60000});
  h.button('Radera permanent').props.onClick();await h.settle();
  const dialog=text(h.dialog());
  assert.match(dialog,/uppladdningstillåtelse är fortfarande giltig/);assert.match(dialog,/Försök igen om cirka 9 minuter/);assert.match(dialog,/ligger kvar i papperskorgen/);
  assert.equal(h.dialogButton('Radera permanent'),undefined);assert.ok(h.dialogButton('Behåll i papperskorgen'));
  h.dialogButton('Behåll i papperskorgen').props.onClick();await h.settle();
  assert.equal(h.deletions.length,0);assert.equal(h.dialog(),undefined);assert.ok(h.button('Radera permanent'));
});
test('template dealer choices remain explicit, preserve unrelated state and require a valid default',()=>{
  let project=addDealer(addDealer(createEmptyProject(),'dragan','Dragan'),'nora','Nora');project.lanes=[defaultPresentationLane('nora')];
  const before=structuredClone(project),id=project.lanes[0].id;
  const next=setTemplateDealers(project,id,['nora','dragan'],'nora');
  assert.deepEqual(project,before);assert.deepEqual(next.lanes[0].dealers,['nora','dragan']);assert.equal(next.lanes[0].layers.dealer.default,'nora');
  assert.deepEqual(next.lines,before.lines);assert.deepEqual(next.lanes[0].layers.background,before.lanes[0].layers.background);
  for(const [ids,defaultId] of [[[],'nora'],[['missing'],'missing'],[['nora'],'dragan'],[['nora','nora'],'nora']])assert.throws(()=>setTemplateDealers(project,id,ids,defaultId));
});

test('home create link opens the existing dealer form without a write and contextual tools retain their dealer',async()=>{
  const h=harness([],[],'?view=create');await h.settle();
  assert.ok(h.input('Namn'));assert.equal(h.saves.length,0);
  h.button('Öppna dealern').props.onClick();h.button('Lägg till klipp').props.onClick();
  const destinations=[...nodes(h.render(),row=>row.type==='a').map(link=>link.props.href),...h.navigations].map(href=>new URL(href,'https://test.invalid'));
  assert.ok(destinations.some(url=>url.searchParams.get('panel')==='intake'),'clip intake is reachable');
  assert.ok(destinations.some(url=>!url.searchParams.has('panel')),'dealer editor is reachable');
  for(const url of destinations){assert.equal(url.pathname,'/admin/dealers/dragan');assert.equal(url.searchParams.get('flik'),'klipp');assert.equal(url.searchParams.has('dealer'),false);}
  assert.equal(h.saves.length,0);
});


test('late lifecycle checks cannot fill a reopened dialog for the same or another dealer',async()=>{
  for(const target of ['dragan','nora']){
    const h=harness([],[{id:'nora',label:'Nora'}]),pending=[];
    h.setArchiveCheck((_project,id)=>new Promise(resolve=>pending.push({id,resolve})));
    await h.settle();
    const open=id=>nodes(nodes(h.render(),node=>node.type==='li'&&node.key===id)[0],node=>node.type==='button'&&text(node)==='Arkivera')[0].props.onClick();
    open('dragan');await h.settle();h.dialog().props.onCancel({preventDefault(){}});
    open(target);await h.settle();assert.equal(pending[1].id,target);
    pending[0].resolve({...h.impact,mediaCount:99});await h.settle();
    assert.equal(h.dialog().props['aria-busy'],true);
    assert.equal(h.dialogButton('Flytta till papperskorgen'),undefined);
    pending[1].resolve({...h.impact,dealerId:target,mediaCount:0});await h.settle();
    assert.ok(h.dialogButton('Flytta till papperskorgen'));
    assert.equal(h.archives.length,0);
  }
});

test('a repeated archive confirmation submits exactly one archive request',async()=>{
  const h=harness();await h.settle();h.button('Arkivera').props.onClick();await h.settle();
  const confirm=h.dialogButton('Flytta till papperskorgen').props.onClick;confirm();confirm();await h.settle();
  assert.equal(h.checks.length,1);assert.equal(h.archives.length,1);
  assert.match(text(h.render()),/Dragan har flyttats till papperskorgen/);
});
test('an uncertain or refused archive is settled by one registry read and is never repeated',async()=>{
  for(const failure of ['lost','conflict']){
    const h=harness();await h.settle();h.button('Arkivera').props.onClick();await h.settle();
    h.setLifecycleFailure(failure);const reads=h.loads();
    h.dialogButton('Flytta till papperskorgen').props.onClick();await h.settle();
    assert.equal(h.archives.length,1,failure+' never repeats the archive');assert.equal(h.loads(),reads+1,failure+' reads the registry once');
    assert.equal(h.dialog(),undefined);assert.equal(h.button('Ny dealer').props.disabled,false,'the write lock is released');
    const page=text(h.render());
    if(failure==='lost'){assert.match(page,/Dragan har flyttats till papperskorgen/);assert.doesNotMatch(page,/kunde inte bekräftas/);}
    else{assert.doesNotMatch(page,/har flyttats till papperskorgen/);assert.match(page,/Registret eller urvalet har ändrats/);assert.ok(h.button('Arkivera'),'the refused dealer stays active');}
  }
});
test('a pending permanent deletion disables restore and only offers to finish the deletion',async()=>{
  const h=harness();await h.settle();h.button('Arkivera').props.onClick();await h.settle();h.dialogButton('Flytta till papperskorgen').props.onClick();await h.settle();
  h.patchRemote(remote=>{remote.project.dealerTrash[0].deletion={state:'pending',requestedAt:'2026-10-11T12:00:00.000Z',mediaIds:[]};return remote;});
  h.props.refreshKey=1;await h.settle();
  assert.match(text(h.render()),/radering påbörjad/);assert.equal(h.button('Återställ').props.disabled,true);
  assert.equal(h.button('Radera permanent'),undefined);h.button('Slutför radering').props.onClick();await h.settle();
  assert.match(text(h.dialog()),/Slutför raderingen av Dragan\?/);assert.deepEqual(h.deletionChecks,[{id:'dragan',revision:'studio.project.3'}]);
  assert.equal(h.archives.length,1,'restore is never submitted');assert.equal(h.deletions.length,0);
});
