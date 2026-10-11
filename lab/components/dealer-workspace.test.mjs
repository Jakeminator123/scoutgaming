import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createSeedProject, addDealer } from '../lib/studio-model.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');
const empty = () => null;
const marker = name => props => React.createElement('div', { 'data-component': name, 'data-dealer': props.dealerId });
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
    './dealer-removal': {DealerRemoval: marker('remove-dealer')},
    './registered-idle-editor': {RegisteredIdleEditor: marker('own-idle')},
    './idle-policy-editor': { IdlePolicyEditor: marker('idle') },
    './family-video-library': { FamilyVideoLibrary: marker('families') },
    './legacy-clip-editor': { LegacyClipEditor: marker('legacy') },
    './family-video-upload': { FamilyVideoUpload: marker('upload') },
    './media-family-editor': { MediaFamilyEditor: empty },
    './probe-editor': { ProbeEditor: empty }, './project-conflict': { ProjectConflict: empty },
    './studio-types': { studioHref(path, selection={}) { const query = new URLSearchParams(); for (const [key, value] of Object.entries(selection)) if(value) query.set(({dealerId:'dealer',eventId:'event',variantId:'variant'})[key] ?? key,value); return query.size ? path+'?'+query : path; }, requestJson() { throw new Error('Unexpected request'); } },
    ...overrides,
  };
  if (overrides['./studio-types']) mocks['./studio-types'] = { studioHref(path, selection={}) { const query=new URLSearchParams(); for(const [key,value] of Object.entries(selection)) if(value) query.set(({dealerId:'dealer',eventId:'event',variantId:'variant'})[key]??key,value); return query.size?path+'?'+query:path; }, ...overrides['./studio-types'] };
  const module = { exports: {} };
  vm.runInNewContext(output.code, { module, exports: module.exports, structuredClone, URL, URLSearchParams,
    window: runtimeWindow,
    require: name => name === 'react' ? fakeReact : name.endsWith('.module.css') ? { __esModule: true, default: {} } : mocks[name] ?? require(name),
  });
  return { render(props) { cursor=refCursor=effectCursor=0; return Object.values(module.exports)[0](props); }, values,
    flushEffects() { const pending=effects.filter(effect=>effect.changed); for(const effect of pending)effect.cleanup?.(); for(const effect of pending){effect.changed=false;effect.cleanup=effect.run();} },
  };
}
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
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

test('focused workspace has one media category entry and separate clip settings and AI speech', () => {
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
  assert.match(html, /Sammansättning →/);
  assert.match(html, /href="\/control\/probe\?dealer=astrid"/);
  assert.match(html, /AI-småprat vid inaktivitet →/);
  assert.match(html, /href="\/control\/activity\?dealer=astrid"/);
  assert.match(html, /Uppspelning och logg →/);
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
  assert.equal(nodes(tree, node => node.props?.inventory && !node.props?.section && !node.props?.onPendingChange).length, 0, 'Astrid family tools not rendered for Vera');
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
  assert.match(renderToStaticMarkup(tree), /href="\/control\/probe\?dealer=vera"/);
  assert.equal(h.values[0], draft);
});

test('save still uses revisions and beforeunload; navigation does not replace project state', () => {
  const source = readFileSync(new URL('./lab-studio.tsx', import.meta.url), 'utf8');
  assert.match(source, /expectedRevision: submitted\.revision/);
  assert.match(source, /window\.addEventListener\('beforeunload', guard\)/);
  assert.match(source, /current === submitted \? response\.project/);
  assert.doesNotMatch(source, /history\.pushState|router\.push|setProject\(initialProject\)/);
});

function navigationHarness() {
  const p=props(),guards=new Map(),assigned=[],requests=[];let finish;
  const runtimeWindow={location:{hash:'',search:'',href:'https://local.test/control/clips',assign(href){const event={preventDefault(){this.blocked=true;}};guards.get('beforeunload')?.(event);assigned.push({href,blocked:Boolean(event.blocked)});}},
    addEventListener(name,callback){guards.set(name,callback);},removeEventListener(name,callback){if(guards.get(name)===callback)guards.delete(name);},
    history:{replaceState(){}},
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
  for(const blocker of ['new-edit','upload','conflict']){
    const n=navigationHarness();click(n.links[0]);
    n.finish().resolve({project:{...n.draft,revision:'saved-revision'}});
    await new Promise(resolve=>setImmediate(resolve));
    if(blocker==='new-edit')n.h.values[0]={...n.h.values[0],clipLabels:{'named-clip':'Nyare ändring'}};
    if(blocker==='upload')n.h.values[13]=true;
    if(blocker==='conflict')n.h.values[10]=true;
    n.h.render(n.p);n.h.flushEffects();assert.deepEqual(n.assigned,[],blocker);
    if(blocker==='upload')n.h.values[13]=false;
    if(blocker==='conflict')n.h.values[10]=false;
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
  assert.equal(n.h.values[10],true);assert.deepEqual(n.assigned,[]);
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
  assert.equal(nodes(tree,row=>typeof row.props?.onRemoved==='function')[0].props.disabled,true);
  own.props.onBusyChange(false);tree=h.render(p);
  assert.equal(nodes(tree,row=>typeof row.props?.onRemoved==='function')[0].props.disabled,false);
  assert.equal(nodes(tree,row=>row.props?.dealerId==='johanna'&&typeof row.props?.onBusyChange==='function')[0].props.blocked,false,'metadata lock does not block its own editor');
});

test('draft removal integration updates draft and follows confirmed next dealer selection',()=>{
  const p=props();p.initialProject=addDealer(p.initialProject,'johanna','Johanna');p.initialDealerId='johanna';
  const h=harness('./lab-studio.tsx');let tree=h.render(p);
  const removal=nodes(tree,row=>typeof row.props?.onRemoved==='function')[0];
  removal.props.onEdit(current=>({...current,dealers:current.dealers.filter(row=>row.id!=='johanna'),lines:current.lines.filter(row=>row.dealerId!=='johanna')}));
  assert.equal(h.values[3],'johanna','navigation waits for the component-confirmed removal callback');
  removal.props.onRemoved('johanna','astrid');tree=h.render(p);
  assert.equal(h.values[3],'astrid');assert.equal(h.values[0].dealers.some(row=>row.id==='johanna'),false);
  assert.equal(p.initialProject.dealers.some(row=>row.id==='johanna'),true);
  assert.equal(nodes(tree,row=>row.props?.dealerId==='johanna').length,0);
});

test('opening an exact slot reveals settings and preserves destination and unsaved draft',()=>{
  const h=harness('./lab-studio.tsx'),p=props();let tree=h.render(p);
  const draft={...h.values[0],revision:'unsaved'};h.values[0]=draft;
  nodes(tree,node=>node.props?.onConfigureSlot)[0].props.onConfigureSlot('deal.player','box4');tree=h.render(p);
  assert.equal(h.values[0],draft);assert.equal(h.values[11].situation,'box4');
  const settings=nodes(tree,node=>node.type==='details'&&node.props.onToggle)[0];assert.equal(settings.props.open,true);
  const variants=nodes(tree,node=>node.type==='a'&&node.props.href?.includes('tab=variants'))[0];
  assert.match(variants.props.href,/situation=box4/);
  nodes(tree,node=>node.props?.onCategoryChange)[0].props.onCategoryChange('speech');tree=h.render(p);
  assert.equal(nodes(tree,node=>node.type==='details'&&node.props.onToggle)[0].props.open,false);
  assert.equal(h.values[0],draft);
});
