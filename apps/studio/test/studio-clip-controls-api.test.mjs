import test from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server.js';
import {createStudioClipControlsApi} from '../lib/studio-clip-controls-api.mjs';

const origin = 'https://studio.example.invalid',scope = Object.freeze({environment:'test',workspaceId:'studio-test'});
const config = {scope,apiBase:'/studio/api/admin',authBase:'/studio/api/auth',
  allowedOrigins:['https://public.example.invalid',origin],publicHosts:['public.example.invalid','studio.example.invalid']};
const request = (url = `${origin}/studio/api/clip-controls`,method = 'GET',headers) => new Request(url,{method,headers});
const fixture = options => createStudioClipControlsApi({config,authorize:async () => ({user:'Operator',role:'admin',scope}),
  gamePolicy:{readSaved:async () => ({project:{revision:'saved-revision'}})},legacyControls:async project => ({projectRevision:project.revision,reviewSafetyVerified:true}),...options});
test('native clip controls use saved shared policy and exact safety provider behind current Studio authorization',async () => {
  const response = await fixture().handle(request());assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{projectRevision:'saved-revision',reviewSafetyVerified:true});
  assert.equal(response.headers.get('Cache-Control'),'private, no-store');
  for (const role of ['staff','reader','partner','player']) assert.equal((await fixture({authorize:async () => ({user:'X',role,scope})}).handle(request())).status,403);
  assert.equal((await fixture({authorize:async () => ({user:'X',role:'admin',scope:{...scope,workspaceId:'other'}})}).handle(request())).status,403);
  assert.equal((await fixture().handle(request(undefined,'POST'))).status,405);
  assert.equal((await fixture().handle(request(`${origin}/studio/api/clip-controls/unknown`))).status,404);
  assert.equal((await fixture().handle(request(undefined,'GET',{origin:'https://evil.invalid'}))).status,403);
});
test('missing current policy, media or explicit legacy safety receipt fails closed without old BO state',async () => {
  for (const options of [{gamePolicy:null},{legacyControls:null},{legacyControls:async () => {throw Object.assign(new Error('studio_legacy_review_required'),{statusCode:503});}},
    {gamePolicy:{readSaved:async () => {throw new Error('private database URL');}}}]) {
    const response = await fixture(options).handle(request());assert.equal(response.status,503);
    assert.deepEqual(await response.json(),{error:'studio_native_unavailable'});
  }
});

test('Next stripped clip-controls preserves saved-policy authorization and rejects foreign forwarding or extra routes',async()=>{
  const publicOrigin=config.allowedOrigins[0],headers={host:'studio.example.invalid','x-forwarded-host':'public.example.invalid',
    'x-forwarded-proto':'https',origin:publicOrigin,'sec-fetch-site':'same-origin',cookie:'bo_jwt=fixture'};
  let reads=0;
  const api=fixture({authorize:async actual=>{
    assert.equal(actual.url,publicOrigin+'/studio/api/clip-controls');assert.equal(actual.headers.get('cookie'),'bo_jwt=fixture');
    return {user:'Operator',role:'admin',scope};
  },gamePolicy:{readSaved:async()=>{reads++;return {project:{revision:'saved-revision'}};}}});
  assert.equal((await api.handle(new NextRequest(origin+'/api/clip-controls',{headers}))).status,200);assert.equal(reads,1);
  for(const change of [{origin},{origin:'https://evil.invalid'},{'x-forwarded-host':'evil.invalid'},{'x-forwarded-proto':'http'}]){
    assert.equal((await api.handle(new NextRequest(origin+'/api/clip-controls',{headers:{...headers,...change}}))).status,403);
  }
  assert.equal((await api.handle(new NextRequest(origin+'/api/clip-controls/unknown',{headers}))).status,404);
  assert.equal(reads,1);
});
