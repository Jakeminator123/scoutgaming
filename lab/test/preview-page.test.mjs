import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {createSeedProject,addDealer,defaultPresentationLane} from '../lib/studio-model.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');

function loadTs(fileUrl,overrides={}) {
  const source = readFileSync(fileUrl, 'utf8');
  const output = transformSync(source, { filename: fileURLToPath(fileUrl), jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
  const module = { exports: {} };
  const localRequire = createRequire(fileUrl);
  vm.runInNewContext(output.code, {
    module, exports: module.exports, structuredClone, URL, URLSearchParams,
    window: new Proxy({}, { get: (_target, key) => globalThis.window?.[key] }),
    require: name => {
      if(Object.hasOwn(overrides,name))return overrides[name];
      if (name.endsWith('.module.css') || name.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
      if (name.startsWith('./') || name.startsWith('../')) {
        for (const suffix of ['', '.tsx', '.ts', '.mjs', '.js']) {
          const candidate = new URL(name + suffix, fileUrl);
          const path = fileURLToPath(candidate);
          if (!existsSync(path)) continue;
          if (path.endsWith('.mjs') || path.endsWith('.js') || path.endsWith('.json')) return localRequire(path);
          return loadTs(pathToFileURL(path),overrides);
        }
      }
      return localRequire(name);
    },
  }, { filename: fileURLToPath(fileUrl) });
  return module.exports;
}

test('Förhandsvisning edits three saved lane choices and keeps the separated dealer trial available', () => {
  const pageSource = readFileSync(new URL('../app/control/preview/page.tsx', import.meta.url), 'utf8');
  assert.match(pageSource, /title: 'Förhandsvisning · Croupier Studio'/);
  assert.match(pageSource, /studioUiInitialData\(/);
  const { ControlPreviewPage } = loadTs(new URL('../components/control-preview-page.tsx', import.meta.url));
  const html = renderToStaticMarkup(React.createElement(ControlPreviewPage,{
    initialProject:createSeedProject(),initialVideos:{videos:[]},initialStatus:{configured:false},
  }));
  assert.match(html, /\/\/ STUDIO/);
  assert.match(html, /<h1>Förhandsvisning<\/h1>/);
  assert.match(html, /Sätt ihop dealer, bord och bakgrund/);
  assert.match(html, /aria-label="Tre lager"/);
  assert.match(html, /<legend>Bord<\/legend>/);
  assert.match(html, /<legend>Bakgrund<\/legend>/);
  assert.match(html, /Fullbildsklippet behåller sin bild/);
  assert.match(html, /Frilagda dealerpaket · Paow och Dragge/);
  assert.match(html, /<button[^>]*disabled[^>]*>Spara lane<\/button>/);
  assert.match(html, /<iframe[^>]*title="Förhandsvisning · lagerprov"[^>]*src="[^"]*\/preview\/index\.html"/);
});

test('shared preview data authorization rejects unauthenticated and partner access before reading any Studio data',async()=>{
  let role='partner',unauthenticated=false,reads=0;
  const config={apiBase:'/studio/api/admin',publicOrigin:'https://studio.example.invalid'};
  const native={authorize:async()=>{if(unauthenticated)throw Object.assign(Error('unauthenticated'),{statusCode:401});return {role};},
    gamePolicy:{readSaved:async()=>{reads++;return {project:createSeedProject()};}},
    videoRegistry:async()=>{reads++;return {videos:[]};}};
  const shared=loadTs(new URL('../lib/ui-server.ts',import.meta.url),{
    'next/navigation':{redirect:url=>{throw Object.assign(Error('redirect'),{redirect:url});}},
    './http-guard.mjs':{assertLocalPageRequest:()=>{throw Error('native must not reach the local fallback');}},
    './studio-server.mjs':{studioInitialData:()=>{throw Error('native must not read the legacy store');}},
    './remote-ui.mjs':{remoteUiConfiguration:()=>null},
    './studio-native-runtime.mjs':{nativeStudioAdminEnabled:()=>true,nativeStudioAdminConfiguration:()=>config,assertNativeStudioRequest:()=>{},studioNativeRuntime:async()=>native},
    './studio-native-request.mjs':{normalizeNativeStudioPageRequest:request=>request},
  });
  const request=new Request('https://studio.example.invalid/control/preview');
  await assert.rejects(shared.studioUiInitialData(request),error=>error.statusCode===403);
  assert.equal(reads,0);
  unauthenticated=true;
  await assert.rejects(shared.studioUiInitialData(request),error=>{
    if(typeof error.redirect!=='string')return false;
    const target=new URL(error.redirect,'https://studio.example.invalid');
    return target.pathname==='/login'&&target.searchParams.get('returnTo')==='/control/preview';
  });
  assert.equal(reads,0);
  role='admin';unauthenticated=false;
  const data=await shared.studioUiInitialData(request);
  assert.equal(reads,2);assert.equal(data.status.provider,'neon');assert.equal(data.project.dealers.length,4);
});

test('registered Nora gets her own clip preview and intake link without borrowing Astrid media',()=>{
  const {ControlPreviewPage}=loadTs(new URL('../components/control-preview-page.tsx',import.meta.url));
  const project=addDealer(createSeedProject(),'nora','Nora');
  const lane=defaultPresentationLane();lane.dealers.push('nora');lane.layers.dealer.allowed.push('nora');lane.layers.dealer.default='nora';
  project.lanes=[lane];
  const original=structuredClone(project);
  const videos=[
    {id:'nora-test',label:'Nora greenscreenprov',available:true,dealer:'nora',previewUrl:'/api/videos/nora-test',classification:{dealerId:'nora',eventId:'speak.goodluck',compositing:{mode:'green-screen',threshold:.23,softness:.15,despill:0}}},
    {id:'astrid-other',label:'ASTRID_SPEECH_SHOULD_NOT_BORROW',available:true,dealer:'astrid',previewUrl:'/api/videos/astrid-other'},
    {id:'nora-missing',label:'UNAVAILABLE_NORA_TAKE',available:false,dealer:'nora',previewUrl:'/api/videos/nora-missing'},
  ];
  const html=renderToStaticMarkup(React.createElement(ControlPreviewPage,{initialProject:project,initialVideos:{videos},initialStatus:{provider:'neon'}}));
  assert.match(html,/<option value="nora" selected="">Nora<\/option>/);
  assert.match(html,/Nora greenscreenprov/);
  assert.doesNotMatch(html,/ASTRID_SPEECH_SHOULD_NOT_BORROW|UNAVAILABLE_NORA_TAKE/);
  assert.match(html,/\/control\/videos\?dealer=nora&amp;event=speak.goodluck/);
  assert.match(html,/Tröskel 0.23 · Mjukhet 0.15/);
  assert.deepEqual(project,original);
});
