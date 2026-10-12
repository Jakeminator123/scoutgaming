import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server.js';
import { normalizeNativeStudioRequest, normalizeNativeStudioPageRequest, studioDocumentNavigationHeaders, studioDocumentNavigationMetadata } from '../lib/studio-native-request.mjs';
import { nativeStudioAdminConfiguration, assertNativeStudioRequest } from '../lib/studio-native-runtime.mjs';
import { createStudioAdminApi } from '../lib/studio-admin-api.mjs';
import { studioAdminEndpoint } from '../lib/studio-admin-contract.mjs';

const publicOrigin='https://public.example.invalid',labOrigin='https://studio.example.invalid';
const config=nativeStudioAdminConfiguration({CROUPIER_STUDIO_NATIVE_ADMIN:'1',CROUPIER_STUDIO_NEON_POLICY:'1',
  CROUPIER_PUBLIC_ORIGIN:publicOrigin,CROUPIER_LAB_UI_ORIGIN:labOrigin,CROUPIER_LAB_BASE_PATH:'/studio',
  CROUPIER_STUDIO_ENVIRONMENT_ID:'fixture',CROUPIER_STUDIO_WORKSPACE_ID:'croupier',
  CROUPIER_GAME_DATABASE_URL:'postgres://fixture:fixture@fixture.neon.tech/fixture?sslmode=require'});
const scope={environment:'fixture',workspaceId:'croupier'};
const forwarded={host:new URL(publicOrigin).host,'x-forwarded-host':new URL(publicOrigin).host,
  'x-forwarded-proto':'https',origin:publicOrigin,'sec-fetch-site':'same-origin',cookie:'bo_jwt=private-fixture-cookie'};

test('real Next Request restores only the configured native basePath and retains credentials',async()=>{
  const next=new NextRequest(labOrigin+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json',origin:labOrigin,cookie:'bo_jwt=fixture'},body:'{"user":"fixture","pass":"fixture-password"}'});
  const normalized=normalizeNativeStudioRequest(next,config);
  assert.equal(normalized.url,labOrigin+'/studio/api/auth/login');
  assert.equal(normalized.headers.get('cookie'),'bo_jwt=fixture');
  assert.equal(normalized.headers.get('origin'),labOrigin);
  assert.deepEqual(await normalized.json(),{user:'fixture',pass:'fixture-password'});
  assert.doesNotThrow(()=>assertNativeStudioRequest(normalized,config));
  const canonical=new NextRequest(labOrigin+'/studio/api/auth/session',{nextConfig:{basePath:'/studio'}});
  assert.equal(normalizeNativeStudioRequest(canonical,config).url,labOrigin+'/studio/api/auth/session');
});

test('public frontend rewrite preserves original CSRF origin, cookie and body for native handlers',async()=>{
  const request=new NextRequest(labOrigin+'/api/admin/tier',{method:'POST',headers:{...forwarded,'content-type':'application/json'},body:'{"tier":"fixture","expectedRevision":3}'});
  const normalized=normalizeNativeStudioRequest(request,config);
  assert.equal(normalized.url,publicOrigin+'/studio/api/admin/tier');
  assert.equal(normalized.headers.get('host'),new URL(publicOrigin).host);
  assert.equal(normalized.headers.get('x-forwarded-host'),new URL(publicOrigin).host);
  assert.equal(normalized.headers.get('origin'),publicOrigin);
  assert.equal(normalized.headers.get('cookie'),forwarded.cookie);
  assert.equal(normalized.headers.get('sec-fetch-site'),'same-origin');
  assert.deepEqual(await normalized.json(),{tier:'fixture',expectedRevision:3});
  assert.doesNotThrow(()=>assertNativeStudioRequest(normalized,config));
});

test('a rewritten exact native read reaches existing authorization and role checks',async()=>{
  let authorized=0;const request=normalizeNativeStudioRequest(new NextRequest(labOrigin+'/api/admin/overview',{headers:forwarded}),config);
  const api=createStudioAdminApi({authorize:async r=>{authorized++;assert.equal(r.headers.get('cookie'),forwarded.cookie);return {user:'fixture',role:'admin',scope};},allowedOrigins:config.allowedOrigins,publicHosts:config.publicHosts,handlers:new Map([['GET /studio/api/admin/overview',async()=>({fixture:true})]])});
  assert.equal((await api.handle(request)).status,200);assert.equal(authorized,1);
  const deniedApi=createStudioAdminApi({authorize:async()=>null,allowedOrigins:config.allowedOrigins,publicHosts:config.publicHosts,handlers:new Map([['GET /studio/api/admin/overview',async()=>{assert.fail('unauthenticated handler');}]])});
  assert.equal((await deniedApi.handle(request)).status,401);
});

test('rewritten native writes retain CSRF and transaction authorization without granting reader writes',async()=>{
  const endpoint=studioAdminEndpoint('POST','/studio/api/admin/tier');let writes=0,locks=0;let role='admin';
  const api=createStudioAdminApi({authorize:async()=>({user:'fixture',role,scope}),allowedOrigins:config.allowedOrigins,publicHosts:config.publicHosts,
    handlers:new Map([['POST /studio/api/admin/tier',async context=>{writes++;assert.equal(context.actor.role,'admin');assert.deepEqual(context.body,{expectedRevision:3,tier:'fixture'});return {fixture:true};}]]),
    gates:new Map(endpoint.handlerRequirements.map(name=>[name,async()=>true])),mutationTransaction:async work=>{locks++;return work();}});
  const request=()=>normalizeNativeStudioRequest(new NextRequest(labOrigin+'/api/admin/tier',{method:'POST',headers:{...forwarded,host:new URL(labOrigin).host,'content-type':'application/json'},body:'{"expectedRevision":3,"tier":"fixture"}'}),config);
  assert.equal((await api.handle(request())).status,200);assert.equal(writes,1);assert.equal(locks,1);
  role='reader';assert.equal((await api.handle(request())).status,403);assert.equal(writes,1);assert.equal(locks,1);
  const missingOrigin={...forwarded,'content-type':'application/json'};delete missingOrigin.origin;
  role='admin';const noOrigin=normalizeNativeStudioRequest(new NextRequest(labOrigin+'/api/admin/tier',{method:'POST',headers:missingOrigin,body:'{"expectedRevision":3,"tier":"fixture"}'}),config);
  assert.equal((await api.handle(noOrigin)).status,403);assert.equal(writes,1);assert.equal(locks,1);
});

test('foreign/mixed forwarding, origins, insecure protocol and cross-site/action requests stay rejected',()=>{
  for(const change of [{'x-forwarded-host':'evil.invalid'},{'x-forwarded-host':'public.example.invalid,evil.invalid'},
    {'x-forwarded-host':'public.example.invalid:443'}, {host:'evil.invalid'}, {origin:'https://evil.invalid'},
    {origin:labOrigin},{'x-forwarded-proto':'http'},{'sec-fetch-site':'cross-site'},{'next-action':'fixture'}]){
    assert.throws(()=>normalizeNativeStudioRequest(new NextRequest(labOrigin+'/api/admin/overview',{headers:{...forwarded,...change}}),config),error=>error.statusCode===403);
  }
  assert.throws(()=>normalizeNativeStudioRequest(new NextRequest(publicOrigin+'/api/admin/overview',{headers:{'x-forwarded-host':new URL(labOrigin).host}}),config),error=>error.statusCode===403);
  for(const address of ['https://evil.invalid/api/admin/overview',labOrigin+'/api/admin/%6fverview',labOrigin+'/api/admin/overview?x=1',labOrigin+'/api/admin/overview#x']){
    assert.throws(()=>normalizeNativeStudioRequest(new NextRequest(address),config),error=>error.statusCode===403);
  }
});

test('already canonical requests and unrelated paths never receive another namespace or forward origin',()=>{
  const canonical=new Request(publicOrigin+'/studio/api/admin/overview');assert.equal(normalizeNativeStudioRequest(canonical,config),canonical);
  const local={...config,apiBase:'/api/admin',authBase:'/api/auth'};
  const base=new Request(labOrigin+'/api/auth/session');assert.equal(normalizeNativeStudioRequest(base,local),base);
  for(const path of ['/api/unknown','/other/api/admin/overview','/studio/studio/api/admin/overview']){
    const request=new Request(labOrigin+path);assert.equal(normalizeNativeStudioRequest(request,config),request);
  }
});

test('both native SSR pages reconcile only exact Lab/public rewrites and keep the same cookie/Origin',()=>{
  for(const path of ['/', '/administration', '/studio/administration', '/videos', '/openclaw']){
    for(const [address,headers] of [
      ['http://studio.example.invalid'+path,{host:'studio.example.invalid'}],
      [labOrigin+path,{...forwarded,host:'studio.example.invalid'}],
      ['http://public.example.invalid'+path,forwarded],
    ]){
      const request=normalizeNativeStudioPageRequest(new Request(address,{headers}),config);
      const expectedOrigin=headers['x-forwarded-host']?'https://public.example.invalid':labOrigin;
      const expectedPath=path==='/studio/administration'?path:'/studio'+(path==='/'?'':path);
      assert.equal(request.url,expectedOrigin+expectedPath);
      assert.equal(request.headers.get('cookie'),headers.cookie??null);
      assert.equal(request.headers.get('origin'),headers.origin??null);
      assert.doesNotThrow(()=>assertNativeStudioRequest(request,config));
    }
  }
});

test('the page navigation exception cannot relax API, Origin, forwarded host/protocol or body checks',()=>{
  const navigation={...forwarded,'sec-fetch-site':'cross-site','sec-fetch-mode':'navigate','sec-fetch-dest':'document'};
  const page=normalizeNativeStudioPageRequest(new Request(labOrigin+'/administration',{headers:navigation}),config);
  assert.equal(page.headers.get('sec-fetch-site'),null);
  assert.equal(page.headers.get('origin'),publicOrigin);
  assert.equal(page.headers.get('cookie'),forwarded.cookie);
  for(const path of ['/api/admin/overview','/studio/api/admin/overview','/api/auth/session']){
    assert.throws(()=>normalizeNativeStudioPageRequest(new Request(labOrigin+path,{headers:navigation}),config),error=>error.statusCode===403);
  }
  assert.throws(()=>normalizeNativeStudioRequest(new Request(labOrigin+'/api/admin/overview',{headers:navigation}),config),error=>error.statusCode===403);
  const nonDocument={...navigation,'sec-fetch-dest':'empty'};
  assert.throws(()=>normalizeNativeStudioPageRequest(new Request(labOrigin+'/administration',{headers:nonDocument}),config),error=>error.statusCode===403);
  for(const change of [{host:'evil.invalid'},{'x-forwarded-host':'evil.invalid'},
    {'x-forwarded-host':'public.example.invalid,studio.example.invalid'}, {'x-forwarded-proto':'http'},
    {origin:'https://evil.invalid'}, {origin:labOrigin}, {'next-action':'fixture'}]){
    assert.throws(()=>normalizeNativeStudioPageRequest(new Request(labOrigin+'/administration',{headers:{...navigation,...change}}),config),error=>error.statusCode===403);
  }
  for(const address of ['http://evil.invalid/administration',labOrigin+'/administration?x=1',labOrigin+'/administration#x',labOrigin+'/%61dministration']){
    assert.throws(()=>normalizeNativeStudioPageRequest(new Request(address,{headers:navigation}),config),error=>error.statusCode===403);
  }
  assert.throws(()=>normalizeNativeStudioPageRequest(new Request(labOrigin+'/administration',{method:'POST',headers:navigation,body:'mutation'}),config),error=>error.statusCode===403);
  assert.throws(()=>normalizeNativeStudioRequest(new Request('http://studio.example.invalid/api/auth/session'),config),error=>error.statusCode===403);
});


test('only the room preparation GET retains two exact query keys through the public rewrite', async () => {
  const query = '?operatorId=north&presentationLaneId=vip-presentation';
  const request = normalizeNativeStudioRequest(new NextRequest(labOrigin + '/api/admin/presentation-room' + query, { headers: forwarded }), config);
  assert.equal(request.url, publicOrigin + '/studio/api/admin/presentation-room' + query);
  assert.equal(request.headers.get('cookie'), forwarded.cookie);
  assert.doesNotThrow(() => assertNativeStudioRequest(request, config));
  let reads = 0;
  const api = createStudioAdminApi({ authorize: async () => ({ user: 'fixture', role: 'admin', scope }), allowedOrigins: config.allowedOrigins, publicHosts: config.publicHosts,
    handlers: new Map([['GET /studio/api/admin/presentation-room', async context => { reads++; assert.equal(new URL(context.request.url).search, query); return { ok: true }; }]]) });
  assert.equal((await api.handle(request)).status, 200); assert.equal(reads, 1);
  for (const [method, extra] of [['POST', query], ['GET', query + '&x=1'], ['GET', query + '&operatorId=other'], ['GET', '?operatorId=north'], ['GET', '?operatorId=north&presentationLaneId=constructor']]) {
    assert.throws(() => normalizeNativeStudioRequest(new NextRequest(labOrigin + '/api/admin/presentation-room' + extra, { method, headers: forwarded }), config), error => error.statusCode === 403);
  }
  assert.throws(() => normalizeNativeStudioRequest(new NextRequest(labOrigin + '/api/admin/presentation-room' + query, { headers: { ...forwarded, origin: 'https://evil.invalid' } }), config), error => error.statusCode === 403);
});

test('known staff document navigation remains readable when transport omits mode and destination',()=>{
  const navigation={...forwarded,'sec-fetch-site':'cross-site','sec-fetch-mode':'navigate','sec-fetch-dest':'document'};
  for(const path of ['/control','/control/clips','/control/replies','/studio/control/replies']) {
    const headers=studioDocumentNavigationHeaders(new Request(publicOrigin+path,{headers:navigation}));
    assert.equal(headers.get('sec-fetch-site'),null);
    assert.equal(headers.get('cookie'),forwarded.cookie);
    assert.equal(headers.get('origin'),publicOrigin);
    headers.delete('sec-fetch-mode');headers.delete('sec-fetch-dest');
    assert.doesNotThrow(()=>normalizeNativeStudioPageRequest(new Request(publicOrigin+path,{headers}),config));
  }
  const foreign=studioDocumentNavigationHeaders(new Request(publicOrigin+'/control/replies',{headers:{...navigation,origin:'https://evil.invalid'}}));
  assert.equal(foreign.get('origin'),'https://evil.invalid');
  assert.throws(()=>normalizeNativeStudioPageRequest(new Request(publicOrigin+'/control/replies',{headers:foreign}),config),error=>error.statusCode===403);
  for(const path of ['/api/replies','/studio/api/replies','/control/api/replies','/control/replies/extra','/studio/_next/static/test.js','/unknown']) {
    const headers=studioDocumentNavigationHeaders(new Request(publicOrigin+path,{headers:navigation}));
    assert.equal(headers.get('sec-fetch-site'),'cross-site',path);
  }
  for(const change of [{'sec-fetch-mode':'cors'},{'sec-fetch-dest':'empty'},{'sec-fetch-mode':null},{'sec-fetch-dest':null},{'next-action':'fixture'}]) {
    const headers=new Headers(navigation);for(const [key,value] of Object.entries(change)){if(value===null)headers.delete(key);else headers.set(key,value);}
    assert.equal(studioDocumentNavigationHeaders(new Request(publicOrigin+'/control/replies',{headers})).get('sec-fetch-site'),'cross-site');
  }
  assert.equal(studioDocumentNavigationHeaders(new Request(publicOrigin+'/control/replies',{method:'POST',headers:navigation,body:'mutation'})).get('sec-fetch-site'),'cross-site');
});

test('transport diagnostics keep only fixed enums and booleans while rejected reads stay rejected',()=>{
  const privateValue='never-log-fixture-private';
  const request=new Request(publicOrigin+'/control/replies?dealer='+privateValue,{headers:{...forwarded,origin:privateValue,cookie:privateValue,'sec-fetch-mode':privateValue,'sec-fetch-dest':privateValue,'sec-fetch-site':'cross-site','next-action':privateValue}});
  const metadata=studioDocumentNavigationMetadata(request);
  assert.deepEqual(metadata,{controlDocument:true,mode:'other',destination:'other',crossSite:true,originPresent:true,actionPresent:true});
  assert.equal(JSON.stringify(metadata).includes(privateValue),false);
  assert.throws(()=>normalizeNativeStudioPageRequest(new Request(publicOrigin+'/control/replies',{headers:request.headers}),config),error=>{
    assert.equal(error.statusCode,403);assert.deepEqual(error.studioNavigation,{stage:'ssr',...metadata});assert.equal(JSON.stringify(error.studioNavigation).includes(privateValue),false);return true;
  });
  const absent=studioDocumentNavigationMetadata(new Request(publicOrigin+'/control/replies'));
  assert.equal(absent.mode,'missing');assert.equal(absent.destination,'missing');
});

test('rejected SSR reads built with a synthetic root URL expose fixed metadata without relaxing the guard',()=>{
  for(const path of ['/','/studio']){
    const request=new Request(publicOrigin+path,{headers:{cookie:'private-fixture-only','sec-fetch-mode':'cors','sec-fetch-dest':'document','sec-fetch-site':'cross-site'}});
    assert.throws(()=>normalizeNativeStudioPageRequest(request,config),error=>{
      assert.equal(error.statusCode,403);
      assert.deepEqual(error.studioNavigation,{stage:'ssr',controlDocument:false,mode:'cors',destination:'document',crossSite:true,originPresent:false,actionPresent:false});
      assert.equal(JSON.stringify(error.studioNavigation).includes('private-fixture-only'),false);return true;
    });
  }
});
