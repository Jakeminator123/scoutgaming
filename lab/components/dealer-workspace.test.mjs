import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createSeedProject, addDealer, validateProject } from '../lib/studio-model.mjs';
import { studioNavigationTabs } from '../lib/studio-navigation.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');
const realStudioTypes=(()=>{
  const source=readFileSync(new URL('./studio-types.ts',import.meta.url),'utf8');
  const output=transformSync(source,{filename:'studio-types.ts',jsc:{parser:{syntax:'typescript'}},module:{type:'commonjs'}});
  const module={exports:{}};vm.runInNewContext(output.code,{module,exports:module.exports,URLSearchParams,require});return module.exports;
})();
const realVoicePicker=(()=>{
  const source=readFileSync(new URL('./dealer-voice-picker.tsx',import.meta.url),'utf8');
  const output=transformSync(source,{filename:'dealer-voice-picker.tsx',jsc:{parser:{syntax:'typescript',tsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
  const module={exports:{}};vm.runInNewContext(output.code,{module,exports:module.exports,require});return module.exports.DealerVoicePicker;
})();
const empty = () => null;
const marker = name => props => React.createElement('div', { 'data-component': name, 'data-dealer': props.dealerId }, props.slotEditor);
function harness(file, initialStates = [], overrides = {}) {
  const values = [...initialStates], refs = [], effects = []; let cursor = 0, refCursor = 0, effectCursor = 0;
  const runtimeWindow = overrides.window ?? {location:{hash:''}};
  // Keep the hand-written browser fixtures faithful to URL and History API
  // semantics, including metadata-only replaceState and cancellable events.
  if(runtimeWindow.history&&runtimeWindow.location.href){
    const address=new URL(runtimeWindow.location.href),events=new EventTarget();
    for(const key of ['href','pathname','origin','search','hash'])Object.defineProperty(runtimeWindow.location,key,{configurable:true,get:()=>address[key],set:value=>{address[key]=value;}});
    const add=runtimeWindow.addEventListener?.bind(runtimeWindow),remove=runtimeWindow.removeEventListener?.bind(runtimeWindow);
    runtimeWindow.addEventListener=(type,listener,options)=>{add?.(type,listener,options);events.addEventListener(type,listener,options);};
    runtimeWindow.removeEventListener=(type,listener,options)=>{remove?.(type,listener,options);events.removeEventListener(type,listener,options);};
    runtimeWindow.dispatchEvent=event=>events.dispatchEvent(event);
    let state=runtimeWindow.history.state??null;
    Object.defineProperty(runtimeWindow.history,'state',{configurable:true,get:()=>state});
    for(const method of ['pushState','replaceState']){
      const original=runtimeWindow.history[method].bind(runtimeWindow.history);
      runtimeWindow.history[method]=(value,title,next)=>{state=structuredClone(value);if(next!==undefined){address.href=new URL(next,address).href;original(value,title,next);}};
    }
  }
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
    './dealer-video-surface': {DealerClipPreview: marker('dealer-preview')},
    './activity-log': { ActivityLog: marker('observation') },
    './dealer-media-library': {DealerMediaLibrary: marker('dealer-media')},
    './dealer-forge-page': {DealerMaterialCreator: marker('dealer-material')},
    './dealer-registration': {DealerRegistration: empty},
    './dealer-speech-slot-editor': {DealerSpeechSlotEditor: marker('speech-slot')},
    './dealer-speech-settings': {DealerSpeechSettings: marker('speech-settings')},
    './dealer-voice-picker': {DealerVoicePicker:realVoicePicker},
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
  vm.runInNewContext(output.code, { module, exports: module.exports, structuredClone, URL, URLSearchParams, AbortController, crypto: webcrypto,
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
  if (node.type===realVoicePicker) return nodes(realVoicePicker(node.props),predicate);
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate), ...nodes(node.props?.slotEditor, predicate)];
}
function pressDealer(tree, label) {
  const chip = nodes(tree, node => node.type === 'button' && node.props.className === 'sg-chip' && [].concat(node.props.children).join('').includes(label))[0];
  assert.ok(chip, label);
  assert.equal(chip.props['aria-pressed'], false);
  chip.props.onClick();
  return chip;
}
const props = () => ({ initialProject: createSeedProject(), initialVideos: { videos: [] }, initialDealerId: 'astrid', connectedLane: true });

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
  assert.equal(chips.length, 3);
  assert.equal(chips.some(node=>JSON.stringify(node.props.children).includes('Amira')),false);
  assert.equal(chips.filter(node => node.props['aria-pressed'] === true).length, 1);
  assert.equal(nodes(tree, node => node.props?.onConfigureSlot).length,1);
  assert.equal(nodes(tree, node => node.type === 'nav' && node.props['aria-label']==='Dealerns klippkategorier').length,0);
  assert.match(html,/Standard och varianter/);
  assert.doesNotMatch(html, /href="\/control\/compositions/);
  assert.match(html, /Tal &amp; automatik/);
  assert.match(html, /Inställningar/);
  assert.equal(nodes(tree, node=>node.type==='details').length,0,'common workspace sections are not collapsed');
  assert.match(html, /href="\/control\/probe\?dealer=astrid"/);
  assert.match(html, /Inställningar för AI-småprat/);
  assert.match(html, /href="\/control\/rehearsal\?dealer=astrid"/);
  assert.match(html, /Provspelning &amp; logg/);
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
  assert.doesNotMatch(html, /href="\/control\/compositions/);
  assert.match(html, /href="\/control\/rehearsal\?dealer=vera"/);
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
  const runtimeWindow={location:{hash:'',search:'?dealer=astrid',href:'https://local.test/control/clips?dealer=astrid',assign(href){const event={preventDefault(){this.blocked=true;}};guards.get('beforeunload')?.(event);assigned.push({href,blocked:Boolean(event.blocked)});}},
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
  removal.props.onApplied(next,inventory,'');tree=h.render(p);
  assert.equal(h.state('dealerId'),'');assert.equal(h.state('project'),next);assert.equal(h.state('saved'),JSON.stringify(next));assert.equal(h.state('videos'),inventory);
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
  runtimeWindow.location.search='?dealer=astrid&view=speech';listeners.get('popstate')(new Event('popstate'));
  h.render(p);assert.equal(h.state('workspaceView'),'speech');assert.equal(h.state('project'),draft);
  runtimeWindow.location.search='?dealer=vera&view=clips&event=deal.player.centre&situation=box4';listeners.get('popstate')(new Event('popstate'));
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
    listeners.get('popstate')(new Event('popstate'));h.render(p);assert.equal(h.state('category'),expectedCategory);assert.equal(h.state('selection'),null);
  }
});

test('history cannot unmount a pending dealer operation or transfer queued uploads to another dealer',()=>{
  for(const pending of ['uploading','dealerBusy','intakePending','speechDraft'])for(const selection of ['?dealer=vera&view=clips','?view=clips','?dealer=unknown&view=clips']){
    const p=props(),listeners=new Map(),replaced=[],runtimeWindow={location:{href:'https://local.test/control/clips?dealer=astrid&view=idle',search:'?dealer=astrid&view=idle',hash:''},addEventListener:(key,value)=>listeners.set(key,value),removeEventListener(){},history:{replaceState(_s,_t,url){replaced.push(String(url));},pushState(){}}};
    const h=harness('./lab-studio.tsx',[],{window:runtimeWindow});h.render(p);h.flushEffects();h.state(pending,true);h.render(p);
    runtimeWindow.location.search=selection;runtimeWindow.location.href='https://local.test/control/clips'+runtimeWindow.location.search;
    listeners.get('popstate')(new Event('popstate'));h.render(p);assert.equal(h.state('dealerId'),'astrid',pending);assert.equal(h.state('workspaceView'),'idle');assert.match(replaced[0],/dealer=astrid/);assert.match(replaced[0],/view=idle/);
  }
});

test('legacy category hashes continue to select the requested dealer category',()=>{
  const p=props(),listeners=new Map(),runtimeWindow={location:{href:'https://local.test/control/clips?dealer=vera#deal',search:'?dealer=vera',hash:'#deal'},addEventListener:(key,value)=>listeners.set(key,value),removeEventListener(){},history:{replaceState(){},pushState(){}}};
  const h=harness('./lab-studio.tsx',[],{window:runtimeWindow});h.render(p);h.flushEffects();h.render(p);assert.equal(h.state('dealerId'),'vera');assert.equal(h.state('category'),'deal');assert.equal(h.state('workspaceView'),'clips');
  runtimeWindow.location.hash='#idle';listeners.get('hashchange')(new Event('hashchange'));h.render(p);assert.equal(h.state('workspaceView'),'idle');assert.equal(h.state('category'),'idle');
});


test('real navigation click changes local tabs while the actual unapplied voice form keeps its value',()=>{
  const navSource=readFileSync(new URL('./studio-navigation.tsx',import.meta.url),'utf8');
  const navOutput=transformSync(navSource,{filename:'studio-navigation.tsx',jsc:{parser:{syntax:'typescript',tsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
  const navModule={exports:{}};vm.runInNewContext(navOutput.code,{module:navModule,exports:navModule.exports,require:name=>name==='next/navigation'?{useSearchParams:()=>new URLSearchParams()}:name.endsWith('.module.css')?{__esModule:true,default:{}}:require(name)});
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


for(const dealer of [{id:'dragan',label:'Dragan'},{id:'paow-v2',label:'Paow'}])test(`${dealer.id} suggested voice does not block a clean hidden speech form; real edits still do`,()=>{
  const p={...props(),initialDealerId:dealer.id,initialView:'idle'},listeners=new Map();
  p.initialProject=addDealer(p.initialProject,dealer.id,dealer.label);
  const initial=structuredClone(p.initialProject),runtimeWindow={location:{href:`https://local.test/admin/dealer-studio?dealer=${dealer.id}`,search:`?dealer=${dealer.id}`,hash:''},history:{pushState(){},replaceState(){}},addEventListener:(key,value)=>listeners.set(key,value),removeEventListener(key,value){if(listeners.get(key)===value)listeners.delete(key);}};
  const h=harness('./lab-studio.tsx',[],{window:runtimeWindow}),speech=harness('./dealer-speech-settings.tsx');let tree,form;
  const render=()=>{tree=h.render(p);h.flushEffects();tree=h.render(p);const mounted=nodes(tree,node=>node.props?.expanded&&node.props?.dealer)[0];form=speech.render(mounted.props);speech.flushEffects();tree=h.render(p);h.flushEffects();};render();
  const guarded=()=>{const event={preventDefault(){this.blocked=true;}};listeners.get('beforeunload')(event);return Boolean(event.blocked);};
  const input=()=>nodes(form,node=>node.type==='input'&&node.props.placeholder==='Röstens ID, ingen API-nyckel')[0];
  const button=label=>nodes(form,node=>node.type==='button'&&node.props.children===label)[0];
  assert.equal(h.state('workspaceView'),'idle');assert.equal(h.state('speechDraft'),false);assert.equal(guarded(),false);
  assert.ok(input().props.value,'the explicitly paired voice remains available as a proposal');assert.deepEqual(h.state('project'),initial);
  const proposedVoice=input().props.value;
  input().props.onChange({target:{value:'user-edited-voice'}});render();assert.equal(h.state('speechDraft'),true);assert.equal(guarded(),true);
  button('Ångra ändringar i talformuläret').props.onClick();render();assert.equal(h.state('speechDraft'),false);assert.equal(guarded(),false);assert.equal(input().props.value,proposedVoice);
  button('Använd talunderlag i utkastet').props.onClick();render();assert.equal(h.state('speechDraft'),false);assert.equal(guarded(),true,'the deliberately staged profile still requires project save');
  assert.equal(h.state('project').dealers.find(row=>row.id===dealer.id).speechProfile.voice.voiceId,proposedVoice);
  assert.deepEqual(p.initialProject,initial,'opening and staging never mutate the supplied saved project');
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
  const route=nodes(tree,node=>node.type==='a'&&node.props.href?.startsWith('/control/rehearsal'))[0];route.props.onClick({preventDefault(){}});render();assert.equal(h.state('workspaceView'),'speech');assert.deepEqual(assigned,[]);assert.match(h.state('notice'),/ångra/);
  pressDealer(tree,'Mei');render();assert.equal(h.state('dealerId'),'vera');assert.match(h.state('notice'),/talformuläret/);
  nodes(form,node=>node.type==='button'&&node.props.children==='Ångra ändringar i talformuläret')[0].props.onClick();render();assert.equal(h.state('speechDraft'),false);assert.equal(input('Röstens ID, ingen API-nyckel').props.value,'');
  const clean={preventDefault(){this.blocked=true;}};listeners.get('beforeunload')(clean);assert.equal(clean.blocked,undefined);
  nodes(form,node=>node.type==='select'&&node.props.children.some?.(option=>option.props?.value==='cartesia'))[0].props.onChange({target:{value:'cartesia'}});render();
  input('Röstens ID, ingen API-nyckel').props.onChange({target:{value:'  chosen-voice  '}});render();input('Modellens ID').props.onChange({target:{value:'chosen-model'}});render();assert.equal(h.state('speechDraft'),true);
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

test('clips route and dealer management preserve composition operator and room through SSR and history',async()=>{
  const project=addDealer(createSeedProject(),'paow','PAOW');
  const pageSource=readFileSync(new URL('../app/control/clips/page.tsx',import.meta.url),'utf8');
  const pageOutput=transformSync(pageSource,{filename:'page.tsx',jsc:{parser:{syntax:'typescript',tsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
  const routeModule={exports:{}},LabStudioMarker=()=>null;
  vm.runInNewContext(pageOutput.code,{module:routeModule,exports:routeModule.exports,Request,URLSearchParams,process:{env:{CROUPIER_STREAM_LANE:'lissabon-stream-lane'}},require:name=>({
    '@/components/studio-types':realStudioTypes,
    'next/headers':{headers:async()=>new Headers({host:'local.test'})},
    '@/components/lab-studio':{LabStudio:LabStudioMarker},
    '../../control-studio-data':{loadControlStudio:async()=>({project,videos:{videos:[]}})},
  })[name]??require(name)});
  const page=await routeModule.exports.default({searchParams:Promise.resolve({composition:'mobile-phone',operator:'operator-42',table:'room-7',dealer:'paow',view:'clips'})});
  assert.equal(page.type,LabStudioMarker);assert.equal(page.props.initialLaneId,'mobile-phone');assert.equal(page.props.initialOperatorId,'operator-42');assert.equal(page.props.initialTableId,'room-7');
  const navSource=readFileSync(new URL('./studio-navigation.tsx',import.meta.url),'utf8');
  const navOutput=transformSync(navSource,{filename:'studio-navigation.tsx',jsc:{parser:{syntax:'typescript',tsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
  const navModule={exports:{}};vm.runInNewContext(navOutput.code,{module:navModule,exports:navModule.exports,require:name=>name==='next/navigation'?{useSearchParams:()=>new URLSearchParams()}:name.endsWith('.module.css')?{__esModule:true,default:{}}:require(name)});
  const listeners=new Map(),assigned=[];
  const location=new URL('https://local.test/control/clips?composition=mobile-phone&operator=operator-42&table=room-7&dealer=paow&view=clips');
  const runtimeWindow={location:{href:location.href,search:location.search,hash:location.hash,assign:href=>assigned.push(href)},addEventListener:(name,callback)=>listeners.set(name,callback),removeEventListener(){},history:{pushState(_state,_title,url){setLocation(url);},replaceState(_state,_title,url){setLocation(url);}}};
  function setLocation(value){const next=new URL(value,runtimeWindow.location.href);Object.assign(runtimeWindow.location,{href:next.href,search:next.search,hash:next.hash});}
  const h=harness('./lab-studio.tsx',[],{window:runtimeWindow,'./studio-navigation':navModule.exports});
  let tree=h.render(page.props);
  const tabLinks=()=>{const component=nodes(tree,node=>typeof node.props?.onNavigate==='function')[0];return nodes(component.type(component.props),node=>node.type==='a'&&['Grundloop','Klipp','Skapa material','Tal & automatik','Svarsbibliotek','Provspelning & logg','Inställningar'].includes(node.props.children));};
  function assertTabs(dealer,composition,operator=null,table=null){const links=tabLinks();assert.equal(links.length,7);for(const link of links){const query=new URL(link.props.href,'https://local.test').searchParams;assert.equal(query.get('dealer'),dealer);assert.equal(query.get('composition'),composition);assert.equal(query.get('operator'),operator);assert.equal(query.get('table'),table);assert.equal(query.has('lane'),false);}return links;}
  assertTabs('paow','mobile-phone','operator-42','room-7');
  h.flushEffects();tree=h.render(page.props);
  const management=nodes(tree,node=>node.type==='button'&&node.props['aria-controls']==='dealer-settings')[0];assert.ok(management);management.props.onClick();tree=h.render(page.props);
  assert.equal(h.state('workspaceView'),'settings');assert.equal(nodes(tree,node=>node.props?.id==='dealer-settings')[0].props.hidden,false);
  const lifecycle=nodes(tree,node=>typeof node.props?.onApplied==='function')[0];assert.equal(lifecycle.props.laneId,'mobile-phone');assert.equal(lifecycle.props.operatorId,'operator-42');assert.equal(lifecycle.props.tableId,'room-7');
  const currentUrl=new URL(runtimeWindow.location.href);assert.equal(currentUrl.searchParams.get('operator'),'operator-42');assert.equal(currentUrl.searchParams.get('table'),'room-7');
  nodes(tree,node=>node.props?.onConfigureSlot)[0].props.onConfigureSlot('speak.goodluck','goodluck');tree=h.render(page.props);
  const outgoing=nodes(tree,node=>node.type==='a'&&/^\/control\/(?:events|administration|compositions|rehearsal)/.test(node.props.href??''));
  assert.equal(outgoing.some(link=>link.props.href.startsWith('/control/events')),false,'registered speech uses its inline editor');assert.ok(nodes(tree,node=>node.props?.slot?.situation==='goodluck').length);assert.ok(outgoing.some(link=>link.props.href.startsWith('/control/administration')));
  for(const link of outgoing){const query=new URL(link.props.href,'https://local.test').searchParams;assert.equal(query.get('composition'),'mobile-phone');assert.equal(query.get('operator'),'operator-42');assert.equal(query.get('table'),'room-7');}
  pressDealer(tree,'Mei');tree=h.render(page.props);assertTabs('mei','mobile-phone','operator-42','room-7');
  for(const link of tabLinks()){const query=new URL(link.props.href,'https://local.test').searchParams;assert.equal(query.has('event'),false);assert.equal(query.has('situation'),false);}
  for(const [url,composition] of [['/control/clips?dealer=paow&view=settings',null],['/control/clips?composition=mobile-phone&dealer=paow&view=settings','mobile-phone']]){
    setLocation(url);listeners.get('popstate')(new Event('popstate'));tree=h.render(page.props);assertTabs('paow',composition);
  }
  const replies=tabLinks().find(link=>link.props.children==='Svarsbibliotek');replies.props.onClick({button:0,preventDefault(){}});tree=h.render(page.props);h.flushEffects();
  assert.equal(assigned.length,1);assert.equal(new URL(assigned[0],'https://local.test').searchParams.get('composition'),'mobile-phone');
});

test('visible dealer archive entry preserves dirty drafts and blocks lifecycle mutations until saved',()=>{
 const p=props(),h=harness('./lab-studio.tsx');h.render(p);
 const draft={...h.state('project'),revision:'unsaved'};h.state('project',draft);h.state('speechDraft',true);
 let tree=h.render(p);const management=nodes(tree,node=>node.type==='button'&&node.props['aria-controls']==='dealer-settings')[0];
 assert.match(renderToStaticMarkup(management),/Hantera dealers/);management.props.onClick();tree=h.render(p);
 assert.equal(h.state('workspaceView'),'settings');assert.equal(h.state('project'),draft);assert.equal(h.state('speechDraft'),true);
 const lifecycle=nodes(tree,node=>typeof node.props?.onApplied==='function')[0];assert.equal(lifecycle.props.disabled,true);assert.match(lifecycle.props.disabledReason,/talformulärets ändringar/);
 for(const blocker of ['uploading','dealerBusy','saving']){
  h.state(blocker,true);h.state('workspaceView','idle');tree=h.render(p);
  const button=nodes(tree,node=>node.type==='button'&&node.props['aria-controls']==='dealer-settings')[0];assert.equal(button.props.disabled,true);
  button.props.onClick();assert.equal(h.state('workspaceView'),'idle');h.state(blocker,false);
 }
});


test('no dealer is selected implicitly and choosing a dealer preserves the draft and context',()=>{
 for(const initialDealerId of [undefined,'','unknown']) {
  const h=harness('./lab-studio.tsx'),p={...props(),initialDealerId};let tree=h.render(p);
  assert.equal(h.state('dealerId'),'');assert.ok(nodes(tree,node=>node.props?.['aria-label']==='Välj dealer').length);
  assert.equal(nodes(tree,node=>node.props?.onConfigureSlot).length,0);assert.equal(nodes(tree,node=>node.props?.expanded&&node.props?.dealer).length,0);
  assert.equal(nodes(tree,node=>node.type==='button'&&node.props['aria-pressed']===true).length,0);
  assert.ok(nodes(tree,node=>typeof node.props?.onApplied==='function').length,'archive restoration remains available without a selected dealer');
  const draft={...h.state('project'),revision:'unsaved'};h.state('project',draft);tree=h.render(p);pressDealer(tree,'Vera');tree=h.render(p);
  assert.equal(h.state('dealerId'),'vera');assert.equal(h.state('project'),draft);assert.equal(nodes(tree,node=>node.props?.onConfigureSlot)[0].props.dealerId,'vera');
 }
});

test('history with no dealer clears selection instead of keeping the previous dealer',()=>{
 const listeners=new Map();const runtimeWindow={location:{href:'https://local.test/control/clips?dealer=vera&operator=op-1&composition=mobile-phone',search:'?dealer=vera&operator=op-1&composition=mobile-phone',hash:''},addEventListener:(key,value)=>listeners.set(key,value),removeEventListener(){},history:{replaceState(){},pushState(){}}};
 const p={...props(),initialDealerId:'vera'},h=harness('./lab-studio.tsx',[],{window:runtimeWindow});h.render(p);h.flushEffects();
 runtimeWindow.location.search='?operator=op-1&composition=mobile-phone';listeners.get('popstate')(new Event('popstate'));const tree=h.render(p);
 assert.equal(h.state('dealerId'),'');assert.equal(h.state('operatorId'),'op-1');assert.equal(h.state('laneId'),'mobile-phone');assert.equal(nodes(tree,node=>node.props?.onConfigureSlot).length,0);
});


test('room observation loads saved evidence without a dealer session and retains early live events',()=>{
 const saved={id:'saved-event',observationId:'old-session',data:{evidence:'presented-frame'}},writes=[];
 const h=harness('./control-activity-page.tsx',[],{
  '../lib/activity-store.mjs':{loadActivities:()=>[saved],saveActivities:entries=>writes.push(entries)},
  './playback-guidance':{PlaybackGuidance:empty},
  './studio-types':{requestJson:async()=>null},
 });
 const p={...props(),initialDealerId:undefined,initialStatus:{configured:false},initialTableId:'room-7',initialOperatorSlug:'operator-42'};
 let tree=h.render(p);const activity=nodes(tree,node=>node.props?.observationContext&&node.props?.onActivity)[0];
 assert.equal(activity.props.streamView,undefined);assert.equal(activity.props.observationContext.dealerId,undefined);assert.equal(activity.props.observationContext.tableId,'room-7');
 activity.props.onActivity({source:'player',stage:'playback',status:'observed',title:'New frame',owner:'fixture',reason:'receipt',data:{evidence:'presented-frame',token:'private'}});
 assert.equal(writes.length,0);h.flushEffects();tree=h.render(p);h.flushEffects();
 const entries=h.state('activities');assert.equal(entries.length,2);assert.equal(entries[0],saved);assert.equal(entries[1].title,'New frame');assert.equal(entries[1].data.token,'[dolt]');assert.equal(writes.at(-1),entries);
 h.render({...p,initialDealerId:'vera'});h.flushEffects();assert.equal(h.state('activities'),entries,'choosing an explicit dealer keeps earlier evidence');
});


function ownIdleWorkspace(){
  const p=props();p.initialProject=addDealer(addDealer(p.initialProject,'paow','PAOW'),'nora','Nora');p.initialDealerId='paow';
  const policy=dealerId=>({schemaVersion:1,familyId:dealerId+'/idle.ready/ready',base:[{videoId:'11111111-1111-4111-8111-111111111111',weight:100,durationMs:3000}],variants:[]});
  p.initialProject.dealerIdlePolicies=['paow','nora'].map(dealerId=>({dealerId,policy:policy(dealerId)}));
  for(const line of p.initialProject.lines.filter(row=>['paow','nora'].includes(row.dealerId)&&row.eventId==='idle.ready'))line.variants[0].videoGenerationId=policy(line.dealerId).base[0].videoId;
  p.initialProject.dealers.find(row=>row.id==='paow').speechProfile={schemaVersion:2,state:'preparation',voice:{provider:'elevenlabs',voiceId:'own-voice',modelId:'fixture-model'},reference:null};
  return p;
}
const ownIdleNode=tree=>nodes(tree,row=>row.props?.dealerId==='paow'&&typeof row.props?.onBusyChange==='function')[0];

test('detaching a registered ground loop atomically saves a valid empty connection and preserves voice and other dealers',async()=>{
  const p=ownIdleWorkspace(),before=structuredClone(p.initialProject),requests=[];
  const h=harness('./lab-studio.tsx',[],{'./studio-types':{async requestJson(url,options){requests.push({url,...options});return {project:{...JSON.parse(options.body).project,revision:'saved-empty-idle'}};}}});
  let tree=h.render(p);assert.equal(typeof ownIdleNode(tree).props.onDetach,'function');ownIdleNode(tree).props.onDetach();tree=h.render(p);
  const next=h.state('project');assert.equal(validateProject(next),next);
  assert.deepEqual(next.dealerIdlePolicies,before.dealerIdlePolicies.filter(row=>row.dealerId!=='paow'));
  const line=next.lines.find(row=>row.dealerId==='paow'&&row.eventId==='idle.ready');assert.equal(line.variants[0].videoGenerationId,null);assert.equal(line.baselineVariantId,'paow.idle.ready.standard');assert.equal(line.variants.length,1);
  assert.deepEqual(next.dealers,before.dealers);assert.deepEqual(next.idlePolicy,before.idlePolicy);assert.deepEqual(next.lines.filter(row=>row!==line),before.lines.filter(row=>row.dealerId!=='paow'||row.eventId!=='idle.ready'));
  assert.deepEqual(p.initialProject,before);assert.equal(h.state('videos'),p.initialVideos);
  const save=nodes(tree,row=>row.type==='button'&&row.props.children==='Spara inställningar')[0];assert.equal(save.props.disabled,false);save.props.onClick();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(requests.length,1);const body=JSON.parse(requests[0].body);assert.equal(body.expectedRevision,before.revision);assert.equal(body.project.lines.find(row=>row.dealerId==='paow'&&row.eventId==='idle.ready').variants[0].videoGenerationId,null);
  assert.equal(h.state('project').revision,'saved-empty-idle');assert.equal(h.state('saved'),JSON.stringify(h.state('project')));
});

test('detaching and stale draft callbacks respect saving, busy, connection and dealer guards',()=>{
  for(const scenario of ['saving','busy','offline','dealer']){
    const p=ownIdleWorkspace(),h=harness('./lab-studio.tsx');let tree=h.render(p);const stale=ownIdleNode(tree);assert.equal(typeof stale.props.onDetach,'function');
    if(scenario==='saving')h.state('saving',true);
    if(scenario==='busy')stale.props.onBusyChange(true);
    if(scenario==='offline')p.connectedLane=false;
    if(scenario==='dealer')h.state('dealerId','nora');
    tree=h.render(p);stale.props.onDetach();assert.equal(h.state('project'),p.initialProject,scenario);
  }
});

test('registered speech slot edits only its saved UUID in the existing project draft',()=>{
 const p={...props(),initialDealerId:'dragan',initialView:'clips',initialEventId:'speak.other',initialSituation:'greeting',initialCategory:'speech'};
 p.initialProject=addDealer(p.initialProject,'dragan','Dragan');
 const before=structuredClone(p.initialProject),h=harness('./lab-studio.tsx');
 let tree=h.render(p);const editor=nodes(tree,row=>row.props?.slot?.situation==='greeting'&&typeof row.props.onChange==='function')[0];
 assert.ok(editor);assert.equal(editor.props.dealerId,'dragan');
 assert.doesNotMatch(renderToStaticMarkup(tree),/Användning och villkor/);
 const id='11111111-1111-4111-8111-111111111111';editor.props.onChange(id);tree=h.render(p);
 const current=h.state('project'),line=current.lines.find(row=>row.dealerId==='dragan'&&row.eventId==='speak.other');
 assert.equal(line.variants.find(row=>row.id==='dragan.speak.other.slot-greeting').videoGenerationId,id);
 assert.deepEqual(current.lines.filter(row=>row!==line),before.lines.filter(row=>row.dealerId!=='dragan'||row.eventId!=='speak.other'));
 assert.deepEqual(p.initialProject,before);
 const save=nodes(tree,row=>row.type==='button'&&row.props.children==='Spara inställningar')[0];assert.equal(save.props.disabled,false);
});
