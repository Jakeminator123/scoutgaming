import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { addDealer, createSeedProject } from '../../../packages/presentation/contracts/studio-model.mjs';
import { mediaExampleEvent } from '../../../packages/presentation/runtime/media-family-policy.mjs';
import { validateVideoMetadata, validateVideoCompositing } from '../../../packages/presentation/contracts/video-intake.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');
function load(file, mocks = {}, hookReact = React) {
  const url = new URL(file, import.meta.url);
  const localRequire = createRequire(url);
  const source = readFileSync(url, 'utf8');
  const output = transformSync(source, { filename: fileURLToPath(url), jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
  const module = { exports: {} };
  vm.runInNewContext(output.code, {
    module, exports: module.exports, structuredClone, URL, URLSearchParams, AbortController,
    window: { location: { hash: '', search: '' } }, crypto: { randomUUID: () => 'test-run' },
    require: name => {
      if (name === 'react') return hookReact;
      if (name in mocks) return mocks[name];
      if (name.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
      if (name.startsWith('.')) {
        for (const suffix of ['', '.tsx', '.ts', '.mjs', '.js']) {
          const candidate = new URL(name + suffix, url); const path = fileURLToPath(candidate);
          if (!existsSync(path)) continue;
          return /\.(mjs|js|json)$/.test(path) ? localRequire(path) : load(pathToFileURL(path), mocks, hookReact);
        }
      }
      return localRequire(name);
    },
  });
  return module.exports;
}
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
}
function hooks() {
  const states = [], refs = [], effects = []; let stateIndex = 0, refIndex = 0;
  const react = { ...React, useEffect: effect => effects.push(effect), useMemo: fn => fn(), useCallback: fn => fn,
    useRef(initial) { const index = refIndex++; return refs[index] ??= { current: initial }; },
    useState(initial) { const index = stateIndex++; if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial; return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }]; },
  };
  return { react, states, refs, effects, render(component, props) { stateIndex = refIndex = 0; return component(props); } };
}
const manifest = JSON.parse(readFileSync(new URL('../../../media/dealers/astrid/runtime/presentation/lab-video-manifest.json', import.meta.url), 'utf8'));
const inventory = { families: manifest.families, videos: manifest.items.map(item => ({ ...item, available: true, previewUrl: '/test/' + item.id, fileName: item.relativePath.split('/').at(-1) })) };

test('Utdelning retains seven player positions and distinct dealer up, hole and reveal families', () => {
  const { FamilyVideoLibrary } = load('./family-video-library.tsx');
  const html = renderToStaticMarkup(React.createElement(FamilyVideoLibrary, { inventory, dealerId: 'astrid', familyType: 'deal', onOpen() {}, onRefresh() {}, refreshing: false }));
  assert.equal((html.match(/data-position="/g) ?? []).length, 8);
  for (let box = 0; box < 7; box++) assert.match(html, new RegExp('data-position="box' + box + '"'));
  for (const family of manifest.families.filter(row => /^(deal|reveal)\./.test(row.eventId))) assert.ok(html.includes('data-family-id="' + family.id + '"'), family.id);
  assert.match(html, /Dealer · öppet kort/); assert.match(html, /Dealer · dolt kort/); assert.match(html, /Dealer · vänd dolt kort/);
  const h = hooks(); const { FamilyVideoLibrary: Controlled } = load('./family-video-library.tsx', {}, h.react);
  const opened = [];
  const tree = h.render(Controlled, { inventory, dealerId: 'astrid', familyType: 'deal', onOpen: (...selection) => opened.push(selection), onRefresh() {}, refreshing: false });
  for (const button of nodes(tree, node => node.type === 'button' && node.props.children === 'Inställningar')) button.props.onClick();
  assert.deepEqual(opened, manifest.families.filter(row => /^(deal|reveal)\./.test(row.eventId)).map(row => [row.eventId, row.situation]));
});

test('position preview changes only the destination; consecutive card slots, cards and exact speech survive', () => {
  const project = createSeedProject(); const before = structuredClone(project);
  for (const definition of project.events.filter(row => row.sourceType === 'deal')) {
    for (const handIndex of [0, 1, 2, 31]) {
      const card = { rank: 'K', suit: 'hearts' };
      const source = { ...definition, exampleEvent: { ...definition.exampleEvent, handIndex, card } };
      for (const situation of definition.id === 'deal.dealer' ? ['dealer-up', 'dealer-hole'] : ['box0', 'box1', 'box2', 'box3', 'box4', 'box5', 'box6']) {
        const event = mediaExampleEvent(source, situation);
        assert.equal(event.handIndex, handIndex);
        assert.deepEqual(event.card, situation === 'dealer-hole' ? null : card);
      }
    }
  }
  const speech = project.events.find(row => row.id === 'speak.other');
  assert.equal(mediaExampleEvent(speech, 'greeting').line, 'greeting');
  assert.deepEqual(project, before);
});

test('family upload sends exact family and green metadata, then opens the saved clip without an acceptance click', async () => {
  const h = hooks(); const project = createSeedProject();
  const family = inventory.families.find(row => row.situation === 'box5');
  const uploaded = [], opened = [], busy = [], captured = [];
  const video = { id: 'saved-variant', familyId: family.id, available: true, previewUrl: '/saved', bytes: 200, label: 'Min handrörelse', eventId: family.eventId, situation: family.situation };
  const { FamilyVideoUpload } = load('./family-video-upload.tsx', {
    './video-metadata-fields': { VideoCompositingFields: () => null, DealerFramingFields: () => null },
    './studio-types': { async requestJson() { return captured.length ? { videos: [video], families: inventory.families } : { uploadMode: 'private-client-blob' }; } },
    '../lib/upload-native-video.mjs': { async uploadNativeVideo(file, metadata, mime, options) { captured.push({ file, metadata: validateVideoMetadata(metadata), mime, options }); return { id: video.id, duplicate: false }; } },
  }, h.react);
  const props = { project, inventory, dealerId: 'astrid', initialFamilyId: family.id, onUploaded: (...args) => uploaded.push(args), onOpen: (...args) => opened.push(args), onBusyChange: value => busy.push(value) };
  let tree = h.render(FamilyVideoUpload, props);
  nodes(tree, node => node.type === 'input' && node.props.type === 'file')[0].props.onChange({ target: { files: [{ name: 'technical-file.mp4', size: 200 }] } });
  tree = h.render(FamilyVideoUpload, props);
  nodes(tree, node => node.type === 'input' && node.props.maxLength === 120)[0].props.onChange({ target: { value: 'Min handrörelse' } });
  nodes(tree, node => typeof node.type === 'function' && node.type.name === 'VideoCompositingFields')[0].props.onChange({ mode: 'green-screen', threshold: 0.23, softness: 0.15, despill: 0.4 });
  tree = h.render(FamilyVideoUpload, props);
  await nodes(tree, node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
  assert.equal(captured[0].metadata.familyId, family.id);
  assert.equal(captured[0].metadata.dealerId, 'astrid'); assert.equal(captured[0].metadata.eventId, family.eventId); assert.equal(captured[0].metadata.situation, 'box5');
  assert.equal(captured[0].metadata.label, 'Min handrörelse');
  assert.deepEqual(captured[0].metadata.compositing, { mode: 'green-screen', threshold: 0.23, softness: 0.15, despill: 0.4 });
  assert.deepEqual(JSON.parse(JSON.stringify(captured[0].metadata.framing)),{scale:1,x:0,y:0});
  assert.equal(uploaded[0][1], video.id); assert.deepEqual(opened, [[family.eventId, family.situation]]); assert.deepEqual(busy, [true, false]);
  assert.ok(!renderToStaticMarkup(h.render(FamilyVideoUpload, props)).includes('Välj hur klippet ska användas'));
});

test('saved idle background can be corrected with its original revision and exact binding, including framing',async()=>{
  const h=hooks(),calls=[],saved=[];
  const classification={dealerId:'nora',eventId:'idle.ready',kind:'idle',role:'standard',situation:'',label:'Grundloop',notes:'',compositing:{mode:'opaque'}};
  const video={id:'exact-idle',sha256:'a'.repeat(64),available:true,classification,previewUrl:'/fixture'};
  const {DealerFileSettings}=load('./dealer-file-settings.tsx',{
    './studio-types':{requestJson:async(url,request)=>{calls.push({url,...JSON.parse(request.body)});return {videos:[video]};}},
    './dealer-video-surface':{DealerClipPreview:()=>null},
  },h.react);
  const props={video,onSaved:value=>saved.push(value)};
  let tree=h.render(DealerFileSettings,props);tree.props.onToggle({currentTarget:{open:true}});tree=h.render(DealerFileSettings,props);
  nodes(tree,node=>typeof node.type==='function'&&node.type.name==='VideoCompositingFields')[0].props.onChange({mode:'green-screen',threshold:.23,softness:.15,despill:.5});
  tree=h.render(DealerFileSettings,props);
  nodes(tree,node=>typeof node.type==='function'&&node.type.name==='DealerFramingFields')[0].props.onChange({scale:3,x:0,y:.4});
  tree=h.render(DealerFileSettings,props);nodes(tree,node=>node.type==='button')[0].props.onClick();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(calls.length,1);assert.deepEqual(calls[0].previous,classification);assert.equal(calls[0].sha256,video.sha256);
  assert.deepEqual(calls[0].metadata,{...classification,compositing:{mode:'green-screen',threshold:.23,softness:.15,despill:.5},framing:{scale:3,x:0,y:.4}});
  assert.equal(saved.length,1);
});

test('family upload does not borrow Astrid families for Nora and disables submission during another operation', async () => {
  const h = hooks(); let calls = 0;
  const { FamilyVideoUpload } = load('./family-video-upload.tsx', { './video-metadata-fields': { VideoCompositingFields: () => null, DealerFramingFields: () => null }, './studio-types': { requestJson() { calls++; throw new Error('must not request'); } } }, h.react);
  const project = addDealer(createSeedProject(), 'nora', 'Nora');
  const props = { project, inventory, dealerId: 'nora', initialFamilyId: inventory.families[0].id, disabled: true, onUploaded() {} };
  const tree = h.render(FamilyVideoUpload, props);
  assert.equal(nodes(tree, node => node.type === 'option').length, 1);
  assert.equal(nodes(tree, node => node.type === 'fieldset')[0].props.disabled, true);
  await nodes(tree, node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
  assert.equal(calls, 0);
});

test('dealer backgrounds are always keyed with bounded controls and retain the exact event and situation', () => {
  const { VideoCompositingFields, VideoMetadataFields } = load('./video-metadata-fields.tsx');
  const values = []; let tree = VideoCompositingFields({ value: { mode: 'opaque' }, onChange: value => values.push(value) });
  assert.deepEqual(nodes(tree,node=>node.type==='option').map(node=>node.props.value),['green-screen','alpha'],'only keying or source alpha; no baked background retention');
  assert.match(renderToStaticMarkup(tree),/Äldre bakgrundsinställning behöver uppdateras/);
  nodes(tree, node => node.type === 'input')[0].props.onChange({ target: { valueAsNumber: .23 } });
  assert.equal(validateVideoCompositing(values[0]).mode, 'green-screen');
  tree = VideoCompositingFields({ value: values[0], onChange: value => values.push(value) });
  const inputs = nodes(tree, node => node.type === 'input');
  inputs[0].props.onChange({ target: { valueAsNumber: 1.7 } }); assert.equal(values.at(-1).threshold, 1);
  inputs[1].props.onChange({ target: { valueAsNumber: -1 } }); assert.equal(values.at(-1).softness, 0.001);
  const metadata = { label: 'Min rörelse', dealerId: 'astrid', eventId: 'deal.player.left', kind: 'action', role: 'alternative', situation: 'box1', playback: 'once', notes: '' };
  tree = VideoMetadataFields({ project: createSeedProject(), value: metadata, onChange: value => values.push(value) });
  nodes(tree, node => typeof node.type === 'function' && node.type.name === 'VideoCompositingFields')[0].props.onChange({ mode: 'green-screen', threshold: 0.4, softness: 0.2, despill: 0.1 });
  assert.equal(validateVideoMetadata(values.at(-1)).situation, 'box1'); assert.equal(values.at(-1).eventId, metadata.eventId);
});

test('bibliotek and upload consume the exact situation from a dealer deep link', () => {
  const { ControlVideosPage } = load('./control-videos-page.tsx');
  const project = addDealer(createSeedProject(), 'nora', 'Nora');
  const before = structuredClone(project);
  const html = renderToStaticMarkup(React.createElement(ControlVideosPage, { initialProject: project, initialVideos: { videos: [] }, initialStatus: { configured: false }, initialDealerId: 'nora', initialEventId: 'deal.player.left', initialSituation: 'box1' }));
  assert.match(html, /<option value="box1" selected="">Spelarplats 2<\/option>/);
  assert.match(html, /Spelarplats 2 <button/); assert.deepEqual(project, before);
  const { ControlEventsPage } = load('./control-events-page.tsx', { './gateway-panel': { modeLabels: {}, modeExplanations: {}, GatewayPanel: () => null } });
  const htmlEvents = renderToStaticMarkup(React.createElement(ControlEventsPage, { initialProject: createSeedProject(), initialVideos: inventory, initialStatus: { configured: false }, initialDealerId: 'astrid', initialEventId: 'deal.player.left', initialSituation: 'box1' }));
  assert.match(htmlEvents, /astrid\/deal.player.left\/box1/);
});

test('display naming is separate from file identity and situation URL survives variant changes', () => {
  const { studioHref, selectionHref } = load('./studio-types.ts');
  assert.equal(studioHref('/admin/videos', { dealerId: 'nora', eventId: 'deal.dealer', situation: 'dealer-hole' }), '/admin/videos?dealer=nora&event=deal.dealer&situation=dealer-hole');
  assert.match(selectionHref('/admin/events', '?dealer=astrid&event=deal.player.left&situation=box1', 'astrid', 'deal.player.left', 'same-variant'), /situation=box1/);
  assert.doesNotMatch(selectionHref('/admin/events', '?dealer=astrid&event=deal.player.left&situation=box1', 'astrid', 'deal.dealer'), /situation=/);
});


test('Probe selection stays in Admin and preserves room context under either mount', () => {
  const { selectionHref } = load('./studio-types.ts');
  const previous = process.env.NEXT_PUBLIC_LAB_BASE_PATH;
  try {
    for (const basePath of ['', '/studio']) {
      process.env.NEXT_PUBLIC_LAB_BASE_PATH = basePath;
      const href = selectionHref(basePath + '/admin/probe', '?dealer=astrid&event=idle.ready&operator=north&table=room-1&lane=portrait&token=private', 'saga', 'idle.ready');
      assert.equal(href, '/admin/probe?dealer=saga&event=idle.ready&composition=portrait&operator=north&table=room-1');
    }
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_LAB_BASE_PATH; else process.env.NEXT_PUBLIC_LAB_BASE_PATH = previous;
  }
});

test('dealerlocked preview upload verifies receipt, reports busy and never returns a runtime binding', async () => {
  const project = addDealer(createSeedProject(), 'nora', 'Nora');
  const metadata = { label:'Nora kort',dealerId:'nora',eventId:'deal.player.left',kind:'action',role:'standard',situation:'box1',playback:'once',notes:'' };
  for (const mismatch of [false, true]) {
    const h = hooks(), busy = [], callbacks = [], sent = [];
    const saved = {id:'saved-nora',available:true,classification:{...metadata,dealerId:mismatch?'astrid':'nora'}};
    const {VideoUpload} = load('./video-upload.tsx', {
      './video-metadata-fields': {VideoMetadataFields:()=>null},
      './variant-selection': {VariantSelectionFields:()=>null},
      './studio-types': {async requestJson(){return sent.length?{videos:[saved]}:{uploadMode:'private-client-blob'};}},
      '../lib/upload-native-video.mjs': {async uploadNativeVideo(file,value,mime,options){sent.push({value,options});return {id:saved.id,duplicate:false};}},
    },h.react);
    const props={project,dealerId:'nora',eventId:metadata.eventId,initialSituation:'box1',lockDealer:true,previewOnly:true,open:true,onBusyChange:value=>busy.push(value),onUploaded:(...args)=>callbacks.push(args)};
    let tree=h.render(VideoUpload,props);
    const fields=nodes(tree,node=>typeof node.type==='function'&&node.type.name==='VideoMetadataFields')[0];
    fields.props.onChange({...metadata,dealerId:'astrid'});
    nodes(tree,node=>node.type==='input'&&node.props.type==='file')[0].props.onChange({target:{files:[{name:'nora.mp4',size:200}]}});
    tree=h.render(VideoUpload,props);
    assert.equal(nodes(tree,node=>node.type==='input'&&node.props.type==='checkbox').length,0);
    await nodes(tree,node=>node.type==='form')[0].props.onSubmit({preventDefault(){}});
    assert.equal(sent[0].value.dealerId,'nora');
    assert.equal(sent[0].value.situation,'box1');assert.deepEqual(busy,[true,false]);
    assert.equal(callbacks.length,mismatch?0:1);
    if(!mismatch)assert.equal(callbacks[0][2],null);
    else assert.ok(nodes(h.render(VideoUpload,props),node=>node.props?.role==='alert').length);
  }
});

test('cancelled preview upload leaves the project intact and does not call onUploaded', async () => {
  const h=hooks(),busy=[],callbacks=[],project=createSeedProject(),before=structuredClone(project);
  const {VideoUpload}=load('./video-upload.tsx',{
    './video-metadata-fields':{VideoMetadataFields:()=>null},'./variant-selection':{VariantSelectionFields:()=>null},
    './studio-types':{async requestJson(){return {uploadMode:'private-client-blob'};}},
    '../lib/upload-native-video.mjs':{async uploadNativeVideo(file,value,mime,options){h.refs.find(ref=>ref.current instanceof AbortController).current.abort();options.signal.throwIfAborted();}},
  },h.react);
  const props={project,dealerId:'astrid',eventId:'deal.player.left',previewOnly:true,onBusyChange:value=>busy.push(value),onUploaded:(...args)=>callbacks.push(args)};
  let tree=h.render(VideoUpload,props);
  nodes(tree,node=>node.type==='input'&&node.props.type==='file')[0].props.onChange({target:{files:[{name:'take.mp4',size:200}]}});
  tree=h.render(VideoUpload,props);
  await nodes(tree,node=>node.type==='form')[0].props.onSubmit({preventDefault(){}});
  assert.equal(callbacks.length,0);assert.deepEqual(busy,[true,false]);assert.deepEqual(project,before);
});
