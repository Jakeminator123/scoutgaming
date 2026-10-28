import {createLegacyProject} from './fixtures/legacy-project.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import {createSeedProject as createEmptyProject,defaultPresentationLane,normalizeProject} from '../../../packages/presentation/contracts/studio-model.mjs';
import {defaultCompositionSettings,defaultBlackjackTableGeometry} from '../../../packages/presentation/contracts/composition-settings.mjs';
import {createStudioPreview} from '../lib/studio-preview-client.mjs';
import {compositionPreviewLayers} from '../lib/studio-composition.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');

function loadTs(fileUrl,overrides={}) {
  const source = readFileSync(fileUrl, 'utf8');
  const output = transformSync(source, { filename: fileURLToPath(fileUrl), jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
  const module = { exports: {} };
  const localRequire = createRequire(fileUrl);
  vm.runInNewContext(output.code, {
    module, exports: module.exports, structuredClone, URL, URLSearchParams, Request, Headers, AbortController, Error,
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



test('shared preview data authorization rejects unauthenticated and partner access before reading any Studio data',async()=>{
  let role='partner',unauthenticated=false,reads=0;
  const config={apiBase:'/studio/api/admin',authBase:'/studio/api/auth',
    allowedOrigins:['https://public.example.invalid','https://studio.example.invalid'],
    publicHosts:['public.example.invalid','studio.example.invalid']};
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
  const request=new Request('https://studio.example.invalid/admin/compositions');
  await assert.rejects(shared.studioUiInitialData(request),error=>error.statusCode===403);
  assert.equal(reads,0);
  unauthenticated=true;
  await assert.rejects(shared.studioUiInitialData(request),error=>{
    if(typeof error.redirect!=='string')return false;
    const target=new URL(error.redirect);
    return target.origin===config.allowedOrigins[0]&&target.pathname==='/admin/login'
      &&target.searchParams.get('returnTo')==='/admin/scenes?tab=mallar';
  });
  assert.equal(reads,0);
  role='admin';unauthenticated=false;
  const data=await shared.studioUiInitialData(request);
  assert.equal(reads,2);assert.equal(data.status.provider,'neon');assert.equal(data.project.dealers.length,1);
});







test('removing a board from the scene detaches only its table geometry',()=>{
  const first='10000000-0000-4000-8000-000000000001',second='10000000-0000-4000-8000-000000000002';
  const {LayerAssetSelect}=loadTs(new URL('../components/layer-selectors.tsx',import.meta.url));
  const lane=defaultPresentationLane('astrid');lane.layers.table={enabled:true,default:first,allowed:[first,second]};
  lane.composition={...defaultCompositionSettings(),blackjackTables:[defaultBlackjackTableGeometry(first),defaultBlackjackTableGeometry(second)]};
  let updated;const tree=LayerAssetSelect({role:'table',lane,assets:[first,second].map(id=>({id,role:'table',label:id,contentType:'image/png',width:1672,height:941})),onChange:next=>{updated=next;}});
  const find=node=>!node||typeof node!=='object'?null:node.type==='input'&&node.props.type==='checkbox'?node:[node.props?.children].flat(Infinity).map(find).find(Boolean);
  find(tree).props.onChange({target:{checked:false}});
  assert.equal(updated.layers.table.default,null);assert.deepEqual(structuredClone(updated.composition.blackjackTables.map(row=>row.tableId)),[second]);
  assert.equal(lane.composition.blackjackTables.length,2);
});

const previewId='11111111-2222-4333-8444-555555555555';
const previewRequest={presentationLaneId:'mobile-phone',expectedProjectRevision:'revision-1'};
const previewReceipt=()=>({sessionId:previewId,presentationLaneId:'mobile-phone',projectRevision:'revision-1',expiresAt:new Date(Date.now()+60000).toISOString(),entryUrl:'/studio-preview/'+previewId});
const previewResponse=(body=previewReceipt(),status=201,contentType='application/json')=>new Response(typeof body==='string'?body:JSON.stringify(body),{status,headers:{'content-type':contentType}});

test('explicit Studio preview uses the root API and exact saved revision with safe same-origin JSON transport',async()=>{
  let call;
  const receipt=previewReceipt();
  const result=await createStudioPreview(previewRequest,{fetchImpl:async(...args)=>{call=args;return previewResponse(receipt);}});
  assert.deepEqual(result,receipt);
  assert.equal(call[0],'/api/studio-preview');
  assert.equal(call[1].method,'POST');assert.equal(call[1].credentials,'same-origin');
  assert.equal(call[1].redirect,'error');assert.equal(call[1].cache,'no-store');
  assert.deepEqual(JSON.parse(call[1].body),previewRequest);
  assert.equal(call[1].headers.Accept,'application/json');
});

test('preview rejects foreign, forged, expired, mismatched and non-JSON receipts',async()=>{
  const receipt=previewReceipt();
  for(const mutation of [
    {entryUrl:'https://www.scoutgaming.tech'+receipt.entryUrl},
    {entryUrl:'//evil.test/studio-preview/'+previewId},
    {entryUrl:receipt.entryUrl+'?next=https://evil.test'}, {entryUrl:receipt.entryUrl+'#x'},
    {entryUrl:'/studio-preview/%2e%2e/control'}, {entryUrl:'/play/blackjack'},
    {sessionId:previewId.toUpperCase().replace('111','ABC')}, {projectRevision:'other'}, {presentationLaneId:'other'},
    {expiresAt:new Date(0).toISOString()}, {expiresAt:{toString:null}}, {extra:'ignored'},
  ]) await assert.rejects(createStudioPreview(previewRequest,{fetchImpl:async()=>previewResponse({...receipt,...mutation})}),/ogiltigt svar/);
  for(const response of [previewResponse('<html>login</html>',200,'text/html'),previewResponse('{',201),previewResponse([],201),previewResponse(receipt,200),previewResponse('x'.repeat(16385),201)]){
    await assert.rejects(createStudioPreview(previewRequest,{fetchImpl:async()=>response}),/ogiltigt svar|kunde inte startas/);
  }
});

test('preview maps known failures without exposing server text and never retries automatically',async()=>{
  for(const [status,code,phrase] of [
    [422,'studio_preview_idle_required','grundloop för startdealern'],
    [409,'studio_preview_revision_conflict','Projektet har ändrats'],
    [429,'studio_preview_limit','För många provspelningar'],
    [401,'studio_login_required','Logga in'],
    [403,'studio_preview_forbidden','saknar behörighet'],
    [503,'studio_preview_media_unavailable','medier kunde inte läsas'],
  ]) {
    let calls=0;
    await assert.rejects(createStudioPreview(previewRequest,{fetchImpl:async()=>{calls++;return previewResponse({error:code,detail:'DO NOT DISPLAY'},status);}}),new RegExp(phrase));
    assert.equal(calls,1);
  }
  for(const error of ['unknown server detail',{toString:null}])await assert.rejects(createStudioPreview(previewRequest,{fetchImpl:async()=>previewResponse({error},503)}),/kunde inte startas/);
  await assert.rejects(createStudioPreview(previewRequest,{fetchImpl:async()=>{throw Error('DO NOT DISPLAY');}}),/Kontrollera anslutningen/);
  let calls=0;
  await assert.rejects(createStudioPreview({...previewRequest,expectedProjectRevision:''},{fetchImpl:async()=>{calls++;}}),/Spara sammansättningen/);
  assert.equal(calls,0);
});

const previewButton=(h,tree)=>h.find(tree,node=>node.type==='button'&&node.props['aria-describedby']==='studio-preview-help');












// This suite exercises a saved composition, not an automatically populated new project.
function createSeedProject() { const project = createEmptyProject(); project.lanes = [defaultPresentationLane('astrid')]; return project; }
