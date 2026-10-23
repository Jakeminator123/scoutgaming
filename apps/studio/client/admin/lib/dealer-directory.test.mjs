import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {createEmptyProject,addDealer,defaultPresentationLane} from '../../../../../packages/presentation/contracts/studio-model.mjs';
import {setTemplateDealers} from './dealer-directory.mjs';
import {lifecycleMessage} from './studio-lifecycle.mjs';
import * as lifecycleActions from './lifecycle-actions.mjs';
const require=createRequire(import.meta.url),React=require('react'),{transformSync}=require('esbuild');
// The shared ConfirmDialog is a function component; expand it so its texts and buttons are inspectable.
const expand=node=>node&&typeof node==='object'&&typeof node.type==='function'?node.type(node.props):node;
const nodes=(raw,predicate)=>{const node=expand(raw);return !node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(child=>nodes(child,predicate)):[...(predicate(node)?[node]:[]),...nodes(node.props?.children,predicate)];};
const text=raw=>{const node=expand(raw);return typeof node==='string'||typeof node==='number'?String(node):Array.isArray(node)?node.map(text).join(''):node?.props?text(node.props.children):'';};
const tsx=name=>transformSync(readFileSync(new URL('../components/studio/'+name+'.tsx',import.meta.url),'utf8'),{loader:'tsx',format:'cjs',jsx:'automatic'}).code;
function harness(restoreCompositions=[],additionalDealers=[],search='?dealer=dragan') {
  let remote={project:addDealer(createEmptyProject(),'dragan','Dragan'),inventory:{videos:[]},catalog:{source:'registered',administration:{operators:[],rooms:[],dealers:[{id:'dragan',name:'Dragan'}]}}};
  for(const dealer of additionalDealers){remote.project=addDealer(remote.project,dealer.id,dealer.label);remote.catalog.administration.dealers.push({id:dealer.id,name:dealer.label});}
  const saves=[],changes=[],navigations=[],archives=[],checks=[],deletionChecks=[],deletions=[],slots=[],effects=[],module={exports:{}},dialogModule={exports:{}};
  let cursor=0,saveFailure='',readFailure=false,eligibility={allowed:true,count:2};
  const props={active:true,onChanged:()=>changes.push(true)};
  const hooks={...React,useState(initial){const index=cursor++;if(!(index in slots))slots[index]=typeof initial==='function'?initial():initial;return[slots[index],next=>slots[index]=typeof next==='function'?next(slots[index]):next];},useRef(initial){const index=cursor++;return slots[index]??={current:initial};},useEffect(fn,deps){const index=cursor++;if(!slots[index]||deps.some((dep,i)=>dep!==slots[index].deps[i])){effects.push(()=>{slots[index]?.cleanup?.();slots[index]={deps,cleanup:fn()};});}}};
  const impact={dealerId:'dragan',token:'a'.repeat(64),mediaCount:0,speechEnabled:false,operators:[],rooms:[],compositions:[]};
  const client={load:async()=>{if(readFailure)throw Error('read unavailable');return structuredClone(remote);},save:async project=>{
    saves.push(project);
    if(saveFailure==='conflict')throw Error('En annan ändring har sparats.');
    remote={...remote,project:{...project,revision:'studio.project.2'}};
    if(saveFailure==='lost')throw Error('lost response');return remote.project;
  }};
  const lifecycle={checkDealerArchive:async(project,id)=>{checks.push({id,revision:project.revision});return impact;},dealerLifecycle:async(project,id,archived,plan,current)=>{
    assert.equal(current(),true);archives.push({id,archived,plan,revision:project.revision});
    remote={...remote,project:{...remote.project,revision:'studio.project.3',dealers:[],dealerTrash:[{dealer:{id,label:'Dragan'},lines:[],compositions:restoreCompositions}]}};
  },checkDealerDeletion:async(project,id)=>{deletionChecks.push({id,revision:project.revision});return eligibility;},deleteDealer:async(project,id,current)=>{
    assert.equal(current(),true);deletions.push({id,revision:project.revision});
    remote={...remote,project:{...remote.project,revision:'studio.project.4',dealers:[],dealerTrash:[]}};
  }};
  const shared={URLSearchParams,AbortController,structuredClone,window:{addEventListener(){},removeEventListener(){}}};
  runInNewContext(tsx('confirm-dialog'),{...shared,module:dialogModule,exports:dialogModule.exports,require:name=>name==='react'?hooks:name.endsWith('.module.css')?{__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})}:require(name)});
  runInNewContext(tsx('dealer-directory'),{...shared,module,exports:module.exports,require:name=>{
    if(name==='react')return hooks;
    if(name==='lucide-react')return new Proxy({},{get:()=>()=>null});
    if(name==='./confirm-dialog')return dialogModule.exports;
    if(name.includes('lifecycle-actions'))return lifecycleActions;
    if(name.includes('studio-model'))return{addDealer};
    if(name.includes('connected-studio'))return{createStudioClient:()=>client};
    if(name.includes('studio-lifecycle'))return{createLifecycleClient:()=>lifecycle,lifecycleMessage};
    if(name.includes('runtime/navigation'))return{useSearchParams:()=>new URLSearchParams(search),navigate:href=>navigations.push(href)};
    return require(name);
  }});
  const h={props,saves,archives,checks,deletionChecks,deletions,changes,navigations,impact,setSaveFailure:value=>saveFailure=value,setReadFailure:value=>readFailure=value,setEligibility:value=>eligibility=value,
    render(){cursor=0;return module.exports.DealerDirectory(props);},
    async settle(){for(let i=0;i<5;i++){h.render();while(effects.length)effects.shift()();await new Promise(resolve=>setImmediate(resolve));}},
    button(label){return nodes(h.render(),node=>node.type==='button'&&text(node)===label)[0];},
    dialog(){return nodes(h.render(),node=>node.type==='dialog'&&Boolean(node.props.children))[0];},
    dialogButton(label){return nodes(h.dialog(),node=>node.type==='button'&&text(node)===label)[0];},
    input(name){return nodes(h.render(),node=>node.type==='label'&&text(node).startsWith(name)).flatMap(node=>nodes(node,child=>child.type==='input'))[0];},
  };return h;
}

test('dealer library includes Dragan without a room and opens his own clip intake',async()=>{
  const h=harness();await h.settle();
  assert.match(text(h.render()),/Dragan/);assert.match(text(h.render()),/Inga rum kopplade ännu/);
  const link=nodes(h.render(),node=>node.type==='a'&&text(node)==='Lägg till klipp')[0];
  assert.equal(link.props.href,'/admin/clips?dealer=dragan&panel=intake');
});
test('Astrid is a visible legacy reference while Dragan keeps his ordinary dealer card',async()=>{
  const h=harness([],[{id:'astrid',label:'Astrid'}]);await h.settle();
  const card=label=>nodes(h.render(),node=>node.type==='li'&&nodes(node,child=>child.type==='h2'&&text(child)===label).length)[0];
  const astrid=card('Astrid'),dragan=card('Dragan');
  assert.match(text(astrid),/Legacyreferens.*inkopplad via legacy och saknar trelagersversion/);
  assert.match(text(astrid),/Befintliga OpenClaw- och talflöden kan användas som referens/);
  assert.doesNotMatch(text(dragan),/Legacyreferens|trelagersversion|OpenClaw/);
  for(const [dealer,node] of [['astrid',astrid],['dragan',dragan]]){
    assert.equal(nodes(node,child=>child.type==='a'&&text(child)==='Lägg till klipp')[0].props.href,`/admin/clips?dealer=${dealer}&panel=intake`);
  }
  assert.equal(h.saves.length,0);
});
test('cancelling dealer creation restores focus to its initiating button without saving',async()=>{
  const h=harness();await h.settle();
  let focused=null;
  const target={focus(){focused=target;}};
  const trigger=h.button('Skapa dealer');
  if(trigger.props.ref)trigger.props.ref.current=target;
  trigger.props.onClick();
  assert.ok(h.input('Dealerns namn'));
  h.button('Avbryt').props.onClick();
  assert.equal(h.input('Dealerns namn'),undefined);
  assert.equal(focused,target);
  assert.equal(h.saves.length,0);assert.equal(h.changes.length,0);assert.equal(h.navigations.length,0);
});
test('create saves the identity once without copying media, voice or room membership',async()=>{
  const h=harness();await h.settle();h.button('Skapa dealer').props.onClick();
  h.input('Dealerns namn').props.onChange({target:{value:'Nora'}});
  await nodes(h.render(),node=>node.type==='form')[0].props.onSubmit({preventDefault(){}});await h.settle();
  assert.equal(h.saves.length,1);const saved=h.saves[0];
  assert.deepEqual(saved.dealers.find(row=>row.id==='nora'),{id:'nora',label:'Nora'});
  assert.ok(saved.lines.filter(row=>row.dealerId==='nora').every(row=>row.variants.every(variant=>variant.videoGenerationId===null)));
  assert.equal(saved.lanes?.some(lane=>lane.dealers.includes('nora'))??false,false);
  assert.equal(h.navigations.at(-1),'/admin/dealers?dealer=nora');
});
test('lost create acknowledgement is reconciled without a duplicate write',async()=>{
  const h=harness();await h.settle();h.setSaveFailure('lost');h.button('Skapa dealer').props.onClick();h.input('Dealerns namn').props.onChange({target:{value:'Nora'}});
  nodes(h.render(),node=>node.type==='form')[0].props.onSubmit({preventDefault(){}});await h.settle();
  assert.equal(h.saves.length,1);assert.match(text(h.render()),/Nora är sparad/);
});
test('revision conflicts preserve the creation form and never replay its write',async()=>{
  const h=harness();await h.settle();h.setSaveFailure('conflict');h.button('Skapa dealer').props.onClick();h.input('Dealerns namn').props.onChange({target:{value:'Nora'}});
  nodes(h.render(),node=>node.type==='form')[0].props.onSubmit({preventDefault(){}});await h.settle();
  assert.equal(h.saves.length,1);assert.equal(h.input('Dealerns namn').props.value,'Nora');assert.equal(h.navigations.length,0);
  assert.match(text(h.render()),/En annan ändring/);
});
test('removal opens one dialog, checks the server impact inside it, then sends its exact revision and token',async()=>{
  const h=harness();await h.settle();assert.equal(h.dialog(),undefined);
  h.button('Ta bort').props.onClick();
  assert.ok(h.dialog());assert.match(text(h.dialog()),/Kontrollerar klipp, rum, bolag och sammansättningar/);assert.equal(h.dialogButton('Flytta till papperskorgen'),undefined);
  await h.settle();
  assert.equal(h.checks.length,1);assert.equal(h.archives.length,0);assert.match(text(h.dialog()),/Ta bort Dragan\?/);assert.match(text(h.dialog()),/Källfiler och publiceringshistorik bevaras/);
  assert.match(text(h.dialog()),/0 klipp följer med till papperskorgen/);
  h.dialogButton('Flytta till papperskorgen').props.onClick();await h.settle();
  assert.equal(h.dialog(),undefined);
  assert.equal(h.archives.length,1);assert.equal(h.archives[0].plan,h.impact);assert.equal(h.archives[0].revision,h.checks[0].revision);
  assert.match(text(h.render()),/Dragan har flyttats till papperskorgen/);
});
test('a pending Studio draft blocks dealer mutations even when a stale button handler is called',async()=>{
  const h=harness();await h.settle();h.props.blocked=true;h.button('Ta bort').props.onClick();await h.settle();
  assert.equal(h.checks.length,0);assert.equal(h.archives.length,0);assert.equal(h.button('Skapa dealer').props.disabled,true);
});

test('restore confirmation names the saved compositions before any restore is submitted',async()=>{
  const h=harness([{id:'first',label:'Första mallen'},{id:'second',label:'Andra mallen'}]);await h.settle();
  h.button('Ta bort').props.onClick();await h.settle();h.button('Flytta till papperskorgen').props.onClick();await h.settle();
  h.button('Återställ').props.onClick();await h.settle();
  const review=text(h.dialog());
  assert.match(review,/Återställ Dragan\?/);assert.match(review,/sparade sammansättningar återförs som utkast/);
  assert.match(review,/Sparade sammansättningar \(2\)/);assert.match(review,/Första mallen/);assert.match(review,/Andra mallen/);
  assert.match(review,/AI-tal förblir avstängt/);assert.match(review,/Rum återställs eller öppnas inte automatiskt/);
  assert.equal(h.archives.length,1);assert.ok(h.dialogButton('Återställ dealern'));
  h.dialogButton('Avbryt').props.onClick();assert.equal(h.dialog(),undefined);assert.equal(h.archives.length,1);
});
test('permanent deletion checks the server inside the dialog and requires the file acknowledgement, never an id',async()=>{
  const h=harness();await h.settle();h.button('Ta bort').props.onClick();await h.settle();h.dialogButton('Flytta till papperskorgen').props.onClick();await h.settle();
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
  const h=harness();await h.settle();h.button('Ta bort').props.onClick();await h.settle();h.dialogButton('Flytta till papperskorgen').props.onClick();await h.settle();
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
  assert.ok(h.input('Dealerns namn'));assert.equal(h.saves.length,0);
  const links=nodes(h.render(),row=>row.type==='a');
  const destinations=links.map(link=>new URL(link.props.href,'https://test.invalid')).filter(url=>url.pathname==='/admin/clips');
  assert.ok(destinations.some(url=>url.searchParams.get('panel')==='intake'),'clip intake is reachable');
  assert.ok(destinations.some(url=>!url.searchParams.has('panel')),'dealer editor is reachable');
  for(const url of destinations)assert.equal(url.searchParams.get('dealer'),'dragan');
});
