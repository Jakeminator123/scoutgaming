import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createSeedProject, addDealer } from '../lib/studio-model.mjs';
import { studioNavigationTabs } from '../lib/studio-navigation.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');
const realStudioTypes=(()=>{
  const source=readFileSync(new URL('./studio-types.ts',import.meta.url),'utf8');
  const output=transformSync(source,{filename:'studio-types.ts',jsc:{parser:{syntax:'typescript'}},module:{type:'commonjs'}});
  const module={exports:{}};vm.runInNewContext(output.code,{module,exports:module.exports,URLSearchParams,require});return module.exports;
})();
const empty = () => null;
const marker = name => props => React.createElement('div', { 'data-component': name, 'data-dealer': props.dealerId }, props.slotEditor);
function harness(file, initialStates = [], overrides = {}) {
  const values = [...initialStates], refs = [], effects = []; let cursor = 0, refCursor = 0, effectCursor = 0;
  const runtimeWindow = overrides.window ?? {location:{hash:''}};
  const fakeReact = { ...React, useEffect(run,deps) { const index=effectCursor++; const previous=effects[index]; const changed=!previous||!deps||deps.some((value,key)=>value!==previous.deps?.[key]); effects[index]={...previous,run,deps,changed}; }, useCallback: callback => callback, useRef(initial) { return refs[refCursor++] ??= {current:initial}; },
    useState(initial) {
      const index = cursor++;
      if (!(index in values)) values[index] = typeof initial === 'function' ? initial() : initial;
      return [values[index], next => { values[index] = typeof next === 'function' ? next(values[index]) : next; }];
    },
  };
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  const output = transformSync(source, { filename: file, jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
  const mocks = {
    './activity-log': { ActivityLog: marker('observation') },
    './dealer-media-library': {DealerMediaLibrary: marker('dealer-media')},
    './dealer-registration': {DealerRegistration: empty},
    './dealer-speech-settings': {DealerSpeechSettings: marker('speech-settings')},
    './studio-navigation': {StudioNavigation: props => React.createElement('nav', {'aria-label':'Dealerflikar'}, studioNavigationTabs(props).map(tab => React.createElement('a', {key:tab.id,href:tab.href,'aria-current':tab.id===props.active?'page':undefined,onClick:event=>props.onNavigate(event,tab.href)},tab.label)))},
    './dealer-removal': {DealerRemoval: marker('remove-dealer')},
    './registered-idle-editor': {RegisteredIdleEditor: marker('own-idle')},
    './idle-policy-editor': { IdlePolicyEditor: marker('idle') },
    './family-video-library': { FamilyVideoLibrary: marker('families') },
    './legacy-clip-editor': { LegacyClipEditor: marker('legacy') },
    './family-video-upload': { FamilyVideoUpload: marker('upload') },
    './media-family-editor': { MediaFamilyEditor: empty },
    './probe-editor': { ProbeEditor: empty }, './project-conflict': { ProjectConflict: empty },
    './studio-types': { ...realStudioTypes, requestJson() { throw new Error('Unexpected request'); } },
    ...overrides,
  };
  if (overrides['./studio-types']) mocks['./studio-types'] = { ...realStudioTypes, ...overrides['./studio-types'] };
  const stateNames = [...source.matchAll(/const \[([^,]*),[^\]]*\]\s*=\s*useState/g)].map(match=>match[1].trim());
  const module = { exports: {} };
  vm.runInNewContext(output.code, { module, exports: module.exports, structuredClone, URL, URLSearchParams,
    window: runtimeWindow,
    require: name => name === 'react' ? fakeReact : name.endsWith('.module.css') ? { __esModule: true, default: {} } : mocks[name] ?? require(name),
  });
  return { render(props) { cursor=refCursor=effectCursor=0; return Object.values(module.exports)[0](props); }, values, state(name, ...next) { const index=stateNames.indexOf(name); assert.ok(index>=0,name); if(next.length)values[index]=next[0]; return values[index]; },
    flushEffects() { const pending=effects.filter(effect=>effect.changed); for(const effect of pending)effect.cleanup?.(); for(const effect of pending){effect.changed=false;effect.cleanup=effect.run();} },
  };
}
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate), ...nodes(node.props?.slotEditor, predicate)];
}
function pressDealer(tree, label) {
  const chip = nodes(tree, node => node.type === 'button' && node.props.className === 'sg-chip' && [].concat(node.props.children).join('').includes(label))[0];
  assert.ok(chip, label);
  assert.equal(chip.props['aria-pressed'], false);
  chip.props.onClick();
  return chip;
}
const props = () => ({ initialProject: createSeedProject(), initialVideos: { videos: [] }, connectedLane: true });

test('cloud idle refresh reads the shared registry even when imported media has an old archive label', async () => {
  const calls = [], refreshed = { videos: [{ id:'new-idle-variant' }] };
  const h = harness('./lab-studio.tsx', [], {
    '../lib/lab-url.mjs': { labBasePath: () => '/studio', labUrl: path => `/studio${path}` },
    './studio-types': { async requestJson(...args) { calls.push(args); return refreshed; } },
  });
  const p = props(); p.initialVideos.summary = { archiveSource:'emil-default' };
  const tree = h.render(p);
  const refresh = nodes(tree, node => node.type === 'button' && node.props.children === 'Uppdatera klipplistan')[0];
  refresh.props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls,[['/api/videos',undefined]]);
  assert.equal(h.values[2],refreshed);
  assert.equal(h.values[0],p.initialProject,'loading clips preserves the project draft');
});

test('dealer workspace has visible breadcrumbs tabs and in-category settings with separate AI speech', () => {
  const h = harness('./lab-studio.tsx'); const tree = h.render(props());
  const html = renderToStaticMarkup(tree);
  assert.equal(nodes(tree, node => node.type === 'select' && node.props['aria-label'] === 'Dealer').length, 0);
  const chips = nodes(tree, node => node.type === 'button' && node.props.className === 'sg-chip');
  assert.equal(chips.length, 4);
  assert.equal(chips.filter(node => node.props['aria-pressed'] === true).length, 1);
  assert.equal(nodes(tree, node => node.props?.onConfigureSlot).length,1);
  assert.equal(nodes(tree, node => node.type === 'nav' && node.props['aria-label']==='Dealerns klippkategorier').length,0);
  assert.match(html,/Standard och varianter/);
  assert.match(html, /href="\/control\/preview\?dealer=astrid"/);
  assert.match(html, /Scen &amp; format/);
  assert.match(html, /Tal &amp; automatik/);
  assert.match(html, /Inställningar/);
  assert.equal(nodes(tree, node=>node.type==='details').length,0,'common workspace sections are not collapsed');
  assert.match(html, /href="\/control\/probe\?dealer=astrid"/);
  assert.match(html, /Inställningar för AI-småprat/);
  assert.match(html, /href="\/control\/activity\?dealer=astrid"/);
  assert.match(html, /Uppspelning och logg/);
  assert.doesNotMatch(html, /href="[^"]*openclaw|Spel &amp; uppspelning|Sparat i Lab|aria-label="Dealer"|Granska i spel|sg-pill|Förhandsvisa bakgrundszoner/);
  assert.equal(nodes(tree, node => node.props?.streamView).length, 0, 'playback log is a link, not an embed');
});

test('draft survives dealer chip and category changes', () => {
  const h = harness('./lab-studio.tsx'); const p = props();
  let tree = h.render(p);
  const draft = structuredClone(h.values[0]); draft.revision = 'unsaved-draft'; h.values[0] = draft;
  pressDealer(tree, 'Vera');
  tree = h.render(p);
  const library=nodes(tree,node=>node.props?.onCategoryChange)[0];
  library.props.onCategoryChange('deal'); tree=h.render(p);
  assert.equal(h.values[0], draft);
  assert.equal(h.values[4], 'deal');
  const legacy = nodes(tree, node => node.props?.section === 'deal')[0];
  assert.equal(legacy.props.dealerId, 'vera');
  assert.equal(nodes(tree, node => node.props?.inventory && (node.props?.family || node.props?.policy)).length, 0, 'Astrid family tools not rendered for Vera');
  const html = renderToStaticMarkup(tree);
  assert.doesNotMatch(html, /Bakgrundsredigering stöds/);
  assert.match(html, /href="\/control\/preview\?dealer=vera"/);
  assert.match(html, /href="\/control\/activity\?dealer=vera"/);
  assert.equal(nodes(tree, node => node.props?.streamView).length, 0);
  assert.equal(nodes(tree, node => node.type === 'button' && node.props.className === 'sg-chip' && node.props['aria-pressed'] === true)[0].props.children.join(''), 'V Vera');
});

test('controlled legacy editor lists only selected dealer exact speech and no second dealer selector', () => {
  const controls = { clips: ['astrid', 'vera'].map(dealerId => ({ id: `${dealerId}:line`, dealerId, kind: 'recorded-speech', exactParts: [], lineId: 'goodluck', text: `${dealerId} exact text`, available: true, source: 'speech-media.json', route: '/', reviewStatus: 'registered' })) };
  const h = harness('./legacy-clip-editor.tsx', [controls, 'astrid', '']);
  const html = renderToStaticMarkup(h.render({ project: createSeedProject(), dealerId: 'vera', section: 'clips', onChange() { throw new Error('Unexpected edit'); } }));
  assert.match(html, /vera exact text/); assert.doesNotMatch(html, /astrid exact text|<select|Äldre BO-val|Importera exakt koppling|Avancerat · spelvägar och klippkontroll/);
});

test('another dealer keeps idle tools and the draft without a probe tab', () => {
  const h = harness('./lab-studio.tsx'); const p = props();
  let tree = h.render(p);
  const draft = structuredClone(h.values[0]); draft.revision = 'unsaved-draft'; h.values[0] = draft;
  pressDealer(tree, 'Vera');
  tree = h.render(p);
  const library=nodes(tree,node=>node.props?.onConfigureSlot)[0];
  assert.equal(library.props.dealerId,'vera');
  assert.equal(nodes(tree,node=>node.type==='button'&&node.props.children==='Probe').length,0);
  assert.equal(nodes(tree, node => node.props?.section === 'idle')[0].props.dealerId, 'vera');
  assert.equal(nodes(tree, node => node.type === 'button' && node.props.children === 'Ladda upp klipp').length, 0);
  assert.doesNotMatch(renderToStaticMarkup(tree), /href="\/control\/probe\?dealer=vera"/);
  assert.match(renderToStaticMarkup(tree), /stöds för närvarande endast av Astrid/);
  assert.equal(h.values[0], draft);
});

test('save still uses revisions and beforeunload; navigation does not replace project state', () => {
  const source = readFileSync(new URL('./lab-studio.tsx', import.meta.url), 'utf8');
  assert.match(source, /expectedRevision: submitted\.revision/);
  assert.match(source, /window\.addEventListener\('beforeunload', guard\)/);
  assert.match(source, /current === submitted \? response\.project/);
  assert.doesNotMatch(source, /router\.push|setProject\(initialProject\)/);
});

function navigationHarness() {
  const p=props(),guards=new Map(),assigned=[],requests=[];let finish;
  const runtimeWindow={location:{hash:'',search:'',href:'https://local.test/control/clips',assign(href){const event={preventDefault(){this.blocked=true;}};guards.get('beforeunload')?.(event);assigned.push({href,blocked:Boolean(event.blocked)});}},
    addEventListener(name,callback){guards.set(name,callback);},removeEventListener(name,callback){if(guards.get(name)===callback)guards.delete(name);},
    history:{replaceState(){},pushState(_state,_unused,url){runtimeWindow.location.href=String(url);runtimeWindow.location.search=new URL(url).search;runtimeWindow.location.hash=new URL(url).hash;}},
  };
  const h=harness('./lab-studio.tsx',[],{window:runtimeWindow,'./studio-types':{requestJson(...args){requests.push(args);return new Promise((resolve,reject)=>{finish={resolve,reject};});}}});
  h.render(p);h.flushEffects();
  const draft=structuredClone(h.values[0]);draft.clipLabels={'named-clip':'Ej sparat'};h.values[0]=draft;
  const tree=h.render(p);h.flushEffects();
  const links=nodes(tree,node=>node.type==='a'&&node.props.href?.includes('/control/'));
  return {h,p,draft,links,assigned,requests,finish:()=>finish};
}
const click=link=>link.props.onClick({preventDefault(){}});

test('save and continue waits for the clean render to replace the old beforeunload guard and ignores double clicks',async()=>{
  const n=navigationHarness();
  click(n.links[0]);click(n.links[1]);
  assert.equal(n.requests.length,1);assert.deepEqual(n.assigned,[]);
  n.h.render(n.p);n.h.flushEffects();assert.deepEqual(n.assigned,[]);
  n.finish().resolve({project:{...n.draft,revision:'saved-revision'}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(n.assigned,[],'save completion alone must not navigate using the dirty closure');
  n.h.render(n.p);n.h.flushEffects();
  assert.deepEqual(n.assigned,[{href:n.links[0].props.href,blocked:false}]);
});

test('pending content navigation is cancelled by newer edits, upload or conflict',async()=>{
  for(const blocker of ['new-edit','upload','conflict','dealer-lifecycle','intake']){
    const n=navigationHarness();click(n.links[0]);
    n.finish().resolve({project:{...n.draft,revision:'saved-revision'}});
    await new Promise(resolve=>setImmediate(resolve));
    if(blocker==='new-edit')n.h.values[0]={...n.h.values[0],clipLabels:{'named-clip':'Nyare ändring'}};
    if(blocker==='upload')n.h.state('uploading',true);
    if(blocker==='dealer-lifecycle')n.h.state('dealerBusy',true);
    if(blocker==='intake')n.h.state('intakePending',true);
    if(blocker==='conflict')n.h.state('conflict',true);
    n.h.render(n.p);n.h.flushEffects();assert.deepEqual(n.assigned,[],blocker);
    if(blocker==='upload')n.h.state('uploading',false);
    if(blocker==='dealer-lifecycle')n.h.state('dealerBusy',false);
    if(blocker==='intake')n.h.state('intakePending',false);
    if(blocker==='conflict')n.h.state('conflict',false);
    n.h.render(n.p);n.h.flushEffects();assert.deepEqual(n.assigned,[],'clearing blocker must not revive an old navigation');
  }
});

test('content links refuse navigation during a save and after a failed CAS request',async()=>{
  const n=navigationHarness();click(n.links[0]);
  const tree=n.h.render(n.p);n.h.flushEffects();
  click(nodes(tree,node=>node.type==='a'&&node.props.href?.includes('/control/'))[1]);
  assert.equal(n.requests.length,1);
  n.finish().reject(Object.assign(new Error('revision conflict'),{statusCode:409}));
  await new Promise(resolve=>setImmediate(resolve));
  const failedTree=n.h.render(n.p);n.h.flushEffects();
  assert.equal(n.h.state('conflict'),true);assert.deepEqual(n.assigned,[]);
  click(nodes(failedTree,node=>node.type==='a'&&node.props.href?.includes('/control/'))[1]);assert.equal(n.requests.length,1);assert.deepEqual(n.assigned,[]);
});

test('own idle changes update only selected dealer policy and baseline atomically; metadata locks saving and removal',()=>{
  const p=props();p.initialProject=addDealer(addDealer(p.initialProject,'johanna','Johanna'),'nora','Nora');p.initialDealerId='johanna';
  const videoId='11111111-1111-4111-8111-111111111111';
  const policy={schemaVersion:1,familyId:'johanna/idle.ready/ready',base:[{videoId,weight:100,durationMs:4321}],variants:[]};
  const noraPolicy={...policy,familyId:'nora/idle.ready/ready'};
  p.initialProject.dealerIdlePolicies=[{dealerId:'nora',policy:noraPolicy}];
  const astridPolicy=structuredClone(p.initialProject.idlePolicy);
  const h=harness('./lab-studio.tsx');let tree=h.render(p);
  const own=nodes(tree,row=>row.props?.dealerId==='johanna'&&typeof row.props?.onBusyChange==='function')[0];
  assert.ok(own);assert.equal(own.props.project,p.initialProject);
  own.props.onChange(policy);tree=h.render(p);
  const updated=h.values[0];
  assert.deepEqual(updated.idlePolicy,astridPolicy);assert.deepEqual(updated.dealerIdlePolicies.find(row=>row.dealerId==='nora').policy,noraPolicy);
  assert.deepEqual(JSON.parse(JSON.stringify(updated.dealerIdlePolicies.find(row=>row.dealerId==='johanna').policy)),policy);
  assert.equal(updated.lines.find(row=>row.dealerId==='johanna'&&row.eventId==='idle.ready').variants[0].videoGenerationId,videoId);
  assert.equal(p.initialProject.dealerIdlePolicies.length,1,'input draft is preserved');
  own.props.onBusyChange(true);tree=h.render(p);
  assert.ok(nodes(tree,row=>row.type==='button'&&row.props.children==='Spara inställningar').every(row=>row.props.disabled));
  assert.equal(nodes(tree,row=>typeof row.props?.onApplied==='function')[0].props.disabled,true);
  own.props.onBusyChange(false);tree=h.render(p);
  assert.equal(nodes(tree,row=>typeof row.props?.onApplied==='function')[0].props.disabled,true,'unsaved edits must still block server lifecycle writes');
  assert.equal(nodes(tree,row=>row.props?.dealerId==='johanna'&&typeof row.props?.onBusyChange==='function')[0].props.blocked,false,'metadata lock does not block its own editor');
});

test('server-confirmed dealer removal applies project, inventory and next selection as a saved revision',()=>{
  const p=props();p.initialProject=addDealer(p.initialProject,'johanna','Johanna');p.initialDealerId='johanna';
  const h=harness('./lab-studio.tsx');let tree=h.render(p);
  const removal=nodes(tree,row=>typeof row.props?.onApplied==='function')[0];
  const next={...p.initialProject,revision:'server-archived',dealers:p.initialProject.dealers.filter(row=>row.id!=='johanna'),lines:p.initialProject.lines.filter(row=>row.dealerId!=='johanna')};
  const inventory={videos:[]};
  removal.props.onApplied(next,inventory,'astrid');tree=h.render(p);
  assert.equal(h.state('dealerId'),'astrid');assert.equal(h.state('project'),next);assert.equal(h.state('saved'),JSON.stringify(next));assert.equal(h.state('videos'),inventory);
  assert.equal(p.initialProject.dealers.some(row=>row.id==='johanna'),true);
  assert.equal(nodes(tree,row=>row.props?.dealerId==='johanna').length,0);
});

test('opening an exact slot reveals settings and preserves destination and unsaved draft',()=>{
  const h=harness('./lab-studio.tsx'),p=props();let tree=h.render(p);
  const draft={...h.values[0],revision:'unsaved'};h.values[0]=draft;
  nodes(tree,node=>node.props?.onConfigureSlot)[0].props.onConfigureSlot('deal.player.centre','box4');tree=h.render(p);
  assert.equal(h.values[0],draft);assert.equal(h.state('selection').situation,'box4');
  const settings=nodes(tree,node=>node.props?.['aria-label']==='Klippval, varianter och villkor')[0];assert.ok(settings);assert.equal(settings.type,'section');
  const variants=nodes(tree,node=>node.type==='a'&&node.props.href?.includes('tab=variants'))[0];
  assert.match(variants.props.href,/situation=box4/);
  nodes(tree,node=>node.props?.onCategoryChange)[0].props.onCategoryChange('speech');tree=h.render(p);
  assert.equal(nodes(tree,node=>node.props?.['aria-label']==='Klippval, varianter och villkor').length,0);
  assert.equal(h.values[0],draft);
});


test('local dealer tabs keep unsaved project and mounted upload and speech editors without a save request',()=>{
  const n=navigationHarness();let tree=n.h.render(n.p);
  const library=nodes(tree,node=>node.props?.onConfigureSlot)[0];
  const speech=nodes(tree,node=>node.props?.expanded&&node.props?.dealer)[0];
  const nav=nodes(tree,node=>typeof node.props?.onNavigate==='function')[0];
  n.h.state('intakePending',true);tree=n.h.render(n.p);
  nodes(tree,node=>typeof node.props?.onNavigate==='function')[0].props.onNavigate({preventDefault(){}},'/control/clips?dealer=astrid&view=speech');
  tree=n.h.render(n.p);
  assert.equal(n.h.state('workspaceView'),'speech');assert.equal(n.h.state('project'),n.draft);
  assert.equal(n.requests.length,0);assert.equal(n.assigned.length,0);
  const current=nodes(tree,node=>node.props?.onConfigureSlot)[0];
  assert.equal(current.type,library.type);assert.equal(current.key,library.key);
  assert.equal(nodes(tree,node=>node.props?.expanded&&node.props?.dealer)[0].key,speech.key);
  assert.equal(nodes(tree,node=>node.props?.id==='dealer-media')[0].props.hidden,true);
  nodes(tree,node=>typeof node.props?.onNavigate==='function')[0].props.onNavigate({preventDefault(){}},'/control/clips?dealer=astrid&view=clips');
  tree=n.h.render(n.p);assert.equal(nodes(tree,node=>node.props?.id==='dealer-media')[0].props.hidden,false);
  assert.equal(n.h.state('intakePending'),true);assert.equal(n.h.state('project'),n.draft);
});

test('browser back restores exact dealer slot and category without replacing a dirty draft',()=>{
  const listeners=new Map(), p=props(), runtimeWindow={location:{href:'https://local.test/control/clips?dealer=vera&view=clips&event=deal.player.centre&situation=box4',hash:'',search:'?dealer=vera&view=clips&event=deal.player.centre&situation=box4'},addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener(){},history:{replaceState(){},pushState(){}}};
  const h=harness('./lab-studio.tsx',[],{window:runtimeWindow});h.render(p);h.flushEffects();
  assert.equal(h.state('dealerId'),'vera');assert.equal(h.state('category'),'deal');assert.equal(h.state('selection').situation,'box4');
  const draft={...h.state('project'),revision:'draft'};h.state('project',draft);h.render(p);
  runtimeWindow.location.search='?dealer=astrid&view=speech';listeners.get('popstate')({type:'popstate'});
  h.render(p);assert.equal(h.state('workspaceView'),'speech');assert.equal(h.state('project'),draft);
  runtimeWindow.location.search='?dealer=vera&view=clips&event=deal.player.centre&situation=box4';listeners.get('popstate')({type:'popstate'});
  h.render(p);assert.equal(h.state('dealerId'),'vera');assert.equal(h.state('category'),'deal');assert.equal(h.state('selection').situation,'box4');assert.equal(h.state('project'),draft);
});

test('speech clips link to the selected dealer review and invalid view safely falls back',()=>{
  const p=props();p.initialDealerId='vera';p.initialView='clips';p.initialCategory='speech';
  const h=harness('./lab-studio.tsx');let tree=h.render(p);
  const link=nodes(tree,node=>node.type==='a'&&node.props.href?.includes('tab=media-review'))[0];assert.ok(link);assert.equal(link.props.href,'/control/administration?tab=media-review&dealer=vera');
  assert.equal(nodes(tree,node=>node.props?.onConfigureSlot)[0].props.category,'speech');
  const invalid=harness('./lab-studio.tsx');invalid.render({...p,initialView:'javascript:bad',initialCategory:'bad'});assert.equal(invalid.state('workspaceView'),'idle');
});


test('idle first-frame action uses the declared own baseline, requires decoded review and does not save or enable speech',()=>{
  const dealer={id:'paow',label:'PAOW',speechProfile:{schemaVersion:2,state:'preparation',voice:null,reference:{kind:'video-frame',videoId:'old',sha256:'b'.repeat(64),offsetMs:120}}};
  const own={id:'idle-reference',dealer:'paow',available:true,bytes:100,sha256:'a'.repeat(64),previewUrl:'/idle.mp4',label:'Vald grundloop'};
  const old={...own,id:'old',sha256:'b'.repeat(64),previewUrl:'/old.mp4'};let changes=0;
  const h=harness('./dealer-speech-settings.tsx');const p={dealer,inventory:{videos:[own,old]},idleReferenceId:own.id,expanded:true,onEdit(){changes++;}};
  let tree=h.render(p),choose=nodes(tree,node=>node.type==='button'&&node.props.children==='Använd grundloopens första bildruta')[0];assert.ok(choose);
  assert.equal(nodes(tree,node=>node.type==='video')[0].props.src,old.previewUrl);choose.props.onClick();tree=h.render(p);
  let save=nodes(tree,node=>node.type==='button'&&node.props.children==='Använd talunderlag i utkastet')[0];assert.equal(save.props.disabled,true);assert.equal(changes,0);
  const player=nodes(tree,node=>node.type==='video')[0];assert.equal(player.props.src,own.previewUrl);player.props.ref.current={readyState:2,seeking:false,currentTime:0,duration:3};
  player.props.onLoadedMetadata();tree=h.render(p);nodes(tree,node=>node.type==='video')[0].props.onLoadedData();tree=h.render(p);
  save=nodes(tree,node=>node.type==='button'&&node.props.children==='Använd talunderlag i utkastet')[0];assert.equal(save.props.disabled,false);assert.equal(changes,0);
  assert.equal(nodes(tree,node=>node.type==='input'&&node.props.type==='checkbox').at(-1).props.checked,false);
  const wrong=harness('./dealer-speech-settings.tsx');assert.equal(nodes(wrong.render({...p,inventory:{videos:[{...own,dealer:'astrid'}]}}),node=>node.type==='button'&&node.props.children==='Använd grundloopens första bildruta').length,0);
  const absent=harness('./dealer-speech-settings.tsx');assert.equal(nodes(absent.render({...p,idleReferenceId:undefined}),node=>node.type==='button'&&node.props.children==='Använd grundloopens första bildruta').length,0,'no guess from upload order');
});


test('explicit top view takes precedence over an incompatible event on first render and history restore',()=>{
  for(const [view,eventId,expectedCategory] of [['idle','speak.goodluck','idle'],['clips','idle.ready','all']]){
    const p={...props(),initialView:view,initialEventId:eventId,initialSituation:'goodluck'};
    const listeners=new Map(),runtimeWindow={location:{href:'https://local.test/control/clips?view='+view+'&event='+eventId,search:'?view='+view+'&event='+eventId,hash:''},addEventListener:(key,value)=>listeners.set(key,value),removeEventListener(){},history:{replaceState(){},pushState(){}}};
    const h=harness('./lab-studio.tsx',[],{window:runtimeWindow});h.render(p);
    assert.equal(h.state('workspaceView'),view);assert.equal(h.state('selection'),null);assert.equal(h.state('category'),expectedCategory);
    h.flushEffects();h.render(p);assert.equal(h.state('workspaceView'),view);assert.equal(h.state('selection'),null);assert.equal(h.state('category'),expectedCategory);
    listeners.get('popstate')({type:'popstate'});h.render(p);assert.equal(h.state('category'),expectedCategory);assert.equal(h.state('selection'),null);
  }
});

test('history cannot unmount a pending dealer operation or transfer queued uploads to another dealer',()=>{
  for(const pending of ['uploading','dealerBusy','intakePending']){
    const p=props(),listeners=new Map(),replaced=[],runtimeWindow={location:{href:'https://local.test/control/clips?dealer=astrid&view=idle',search:'?dealer=astrid&view=idle',hash:''},addEventListener:(key,value)=>listeners.set(key,value),removeEventListener(){},history:{replaceState(_s,_t,url){replaced.push(String(url));},pushState(){}}};
    const h=harness('./lab-studio.tsx',[],{window:runtimeWindow});h.render(p);h.flushEffects();h.state(pending,true);h.render(p);
    runtimeWindow.location.search='?dealer=vera&view=clips';runtimeWindow.location.href='https://local.test/control/clips'+runtimeWindow.location.search;
    listeners.get('popstate')({type:'popstate'});h.render(p);assert.equal(h.state('dealerId'),'astrid',pending);assert.equal(h.state('workspaceView'),'idle');assert.match(replaced[0],/dealer=astrid/);assert.match(replaced[0],/view=idle/);
  }
});

test('legacy category hashes continue to select the requested dealer category',()=>{
  const p=props(),listeners=new Map(),runtimeWindow={location:{href:'https://local.test/control/clips?dealer=vera#deal',search:'?dealer=vera',hash:'#deal'},addEventListener:(key,value)=>listeners.set(key,value),removeEventListener(){},history:{replaceState(){},pushState(){}}};
  const h=harness('./lab-studio.tsx',[],{window:runtimeWindow});h.render(p);h.flushEffects();h.render(p);assert.equal(h.state('dealerId'),'vera');assert.equal(h.state('category'),'deal');assert.equal(h.state('workspaceView'),'clips');
  runtimeWindow.location.hash='#idle';listeners.get('hashchange')({type:'hashchange'});h.render(p);assert.equal(h.state('workspaceView'),'idle');assert.equal(h.state('category'),'idle');
});


test('real navigation click changes local tabs while the actual unapplied voice form keeps its value',()=>{
  const navSource=readFileSync(new URL('./studio-navigation.tsx',import.meta.url),'utf8');
  const navOutput=transformSync(navSource,{filename:'studio-navigation.tsx',jsc:{parser:{syntax:'typescript',tsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
  const navModule={exports:{}};vm.runInNewContext(navOutput.code,{module:navModule,exports:navModule.exports,require:name=>name.endsWith('.module.css')?{__esModule:true,default:{}}:require(name)});
  const assigned=[],p={...props(),initialDealerId:'vera',initialView:'speech'},runtimeWindow={location:{href:'https://local.test/control/clips?dealer=vera&view=speech',search:'?dealer=vera&view=speech',hash:'',assign:href=>assigned.push(href)},history:{pushState(_s,_t,url){runtimeWindow.location.href=String(url);},replaceState(){}},addEventListener(){},removeEventListener(){}};
  const h=harness('./lab-studio.tsx',[],{window:runtimeWindow,'./studio-navigation':navModule.exports});let tree=h.render(p);
  const findSpeech=tree=>nodes(tree,node=>node.props?.expanded&&node.props?.dealer)[0];
  const mounted=findSpeech(tree),speech=harness('./dealer-speech-settings.tsx');let form=speech.render(mounted.props);
  const voiceId=nodes(form,node=>node.type==='input'&&node.props.placeholder==='Röstens ID, ingen API-nyckel')[0];voiceId.props.onChange({target:{value:'studio-qa-unsaved'}});
  const go=label=>{const nav=nodes(tree,node=>typeof node.props?.onNavigate==='function')[0];const anchor=nodes(nav.type(nav.props),node=>node.type==='a'&&node.props.children===label)[0];const event={button:0,preventDefault(){this.defaultPrevented=true;}};anchor.props.onClick(event);assert.equal(event.defaultPrevented,true);tree=h.render(p);};
  go('Klipp');assert.equal(h.state('workspaceView'),'clips');assert.equal(findSpeech(tree).type,mounted.type);assert.equal(findSpeech(tree).key,mounted.key);
  form=speech.render(findSpeech(tree).props);assert.equal(nodes(form,node=>node.type==='input'&&node.props.placeholder==='Röstens ID, ingen API-nyckel')[0].props.value,'studio-qa-unsaved');
  go('Tal & automatik');assert.equal(h.state('workspaceView'),'speech');form=speech.render(findSpeech(tree).props);assert.equal(nodes(form,node=>node.type==='input'&&node.props.placeholder==='Röstens ID, ingen API-nyckel')[0].props.value,'studio-qa-unsaved');assert.deepEqual(assigned,[]);
});


test('unapplied actual speech edits protect dealer and route exits, remain across tabs, and can be undone or applied',()=>{
  const p={...props(),initialDealerId:'vera',initialView:'speech'},listeners=new Map(),assigned=[];
  const runtimeWindow={location:{href:'https://local.test/control/clips?dealer=vera&view=speech',search:'?dealer=vera&view=speech',hash:'',assign:href=>assigned.push(href)},history:{pushState(_s,_t,url){runtimeWindow.location.href=String(url);runtimeWindow.location.search=new URL(url).search;},replaceState(){}},addEventListener:(key,value)=>listeners.set(key,value),removeEventListener(key,value){if(listeners.get(key)===value)listeners.delete(key);}};
  const h=harness('./lab-studio.tsx',[],{window:runtimeWindow});let tree=h.render(p);h.flushEffects();tree=h.render(p);
  const findSpeech=()=>nodes(tree,node=>node.props?.expanded&&node.props?.dealer)[0];
  const speech=harness('./dealer-speech-settings.tsx');let form;
  const render=()=>{tree=h.render(p);form=speech.render(findSpeech().props);speech.flushEffects();tree=h.render(p);h.flushEffects();};render();
  const input=placeholder=>nodes(form,node=>node.type==='input'&&node.props.placeholder===placeholder)[0];
  input('Röstens ID, ingen API-nyckel').props.onChange({target:{value:'studio-qa-unsaved'}});render();assert.equal(h.state('speechDraft'),true);
  const guard={preventDefault(){this.blocked=true;}};listeners.get('beforeunload')(guard);assert.equal(guard.blocked,true);
  nodes(tree,node=>typeof node.props?.onNavigate==='function')[0].props.onNavigate({preventDefault(){}},'/control/clips?dealer=vera&view=clips');render();assert.equal(h.state('workspaceView'),'clips');assert.equal(input('Röstens ID, ingen API-nyckel').props.value,'studio-qa-unsaved');
  const route=nodes(tree,node=>node.type==='a'&&node.props.href?.startsWith('/control/preview'))[0];route.props.onClick({preventDefault(){}});render();assert.equal(h.state('workspaceView'),'speech');assert.deepEqual(assigned,[]);assert.match(h.state('notice'),/ångra/);
  pressDealer(tree,'Amira');render();assert.equal(h.state('dealerId'),'vera');assert.match(h.state('notice'),/talformuläret/);
  nodes(form,node=>node.type==='button'&&node.props.children==='Ångra ändringar i talformuläret')[0].props.onClick();render();assert.equal(h.state('speechDraft'),false);assert.equal(input('Röstens ID, ingen API-nyckel').props.value,'');
  const clean={preventDefault(){this.blocked=true;}};listeners.get('beforeunload')(clean);assert.equal(clean.blocked,undefined);
  nodes(form,node=>node.type==='select'&&node.props.children.some?.(option=>option.props?.value==='cartesia'))[0].props.onChange({target:{value:'cartesia'}});
  input('Röstens ID, ingen API-nyckel').props.onChange({target:{value:'  chosen-voice  '}});input('Modellens ID').props.onChange({target:{value:'chosen-model'}});render();assert.equal(h.state('speechDraft'),true);
  nodes(form,node=>node.type==='button'&&node.props.children==='Använd talunderlag i utkastet')[0].props.onClick();render();assert.equal(h.state('speechDraft'),false);
  const savedProfile=h.state('project').dealers.find(row=>row.id==='vera').speechProfile;assert.equal(savedProfile.voice.voiceId,'chosen-voice');assert.equal(savedProfile.state,'preparation');assert.equal(savedProfile.reference,null);assert.equal(input('Röstens ID, ingen API-nyckel').props.value,'chosen-voice');assert.deepEqual(assigned,[]);
  const projectDirty={preventDefault(){this.blocked=true;}};listeners.get('beforeunload')(projectDirty);assert.equal(projectDirty.blocked,true,'applied project changes still need explicit save');
});

test('exact selected variants remain in outgoing navigation and both editor tab links',()=>{
  const p=props(),h=harness('./lab-studio.tsx');let tree=h.render(p);nodes(tree,node=>node.props?.onConfigureSlot)[0].props.onConfigureSlot('deal.player.centre','box4');h.state('variantId','astrid.deal.player.centre.alt-2');tree=h.render(p);
  const nav=nodes(tree,node=>typeof node.props?.onNavigate==='function')[0];assert.equal(nav.props.variantId,'astrid.deal.player.centre.alt-2');
  const editors=nodes(tree,node=>node.type==='a'&&node.props.href?.startsWith('/control/events'));assert.equal(editors.length,2);
  for(const link of editors){const params=new URL(link.props.href,'https://test.invalid').searchParams;assert.equal(params.get('variant'),'astrid.deal.player.centre.alt-2');assert.equal(params.get('situation'),'box4');assert.ok(['variants','triggers'].includes(params.get('tab')));}
});
