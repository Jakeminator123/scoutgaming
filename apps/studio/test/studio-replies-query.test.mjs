import test from 'node:test';
import assert from 'node:assert/strict';
import {parseStudioRepliesRequest,isStudioRepliesReadQuery} from '../lib/studio-replies-query.mjs';
import {normalizeNativeStudioRequest} from '../lib/studio-native-request.mjs';
import {platformRoute} from '../../../packages/navigation/server/platform-routing.mjs';

const origin='https://public.example.invalid',labOrigin='https://studio.example.invalid';
const config={allowedOrigins:[origin,labOrigin],publicHosts:['public.example.invalid','studio.example.invalid'],apiBase:'/studio/api/admin',authBase:'/studio/api/auth'};
const url=path=>new URL(path,origin);
const id='2d892414-d620-4b72-9b33-cfa85e1a4a0b';

test('reply queries bind an exact read route and dealer, with a single optional category/cursor',()=>{
  for(const prefix of ['/api','/studio/api']){
    assert.deepEqual(parseStudioRepliesRequest('GET',url(`${prefix}/replies?dealer=vera&category=player-greeting&cursor=abc_DEF-123%3D`)),{kind:'list',dealerId:'vera',category:'player-greeting',cursor:'abc_DEF-123='});
    assert.deepEqual(parseStudioRepliesRequest('GET',url(`${prefix}/replies/${id}?dealer=vera`)),{kind:'item',dealerId:'vera',id});
    for(const method of ['GET','HEAD'])assert.deepEqual(parseStudioRepliesRequest(method,url(`${prefix}/replies/${id}/audio?dealer=vera`)),{kind:'media',dealerId:'vera',id,mediaKind:'audio'});
    assert.deepEqual(parseStudioRepliesRequest('PATCH',url(`${prefix}/replies/${id}`)),{kind:'categorize',id});
  }
});

test('query exception cannot widen other routes, duplicate filters, accept arbitrary URLs or bind mutations',()=>{
  for(const path of ['/api/project?dealer=vera','/api/replies','/api/replies?dealer=vera&dealer=astrid','/api/replies?dealer=vera&token=secret','/api/replies?dealer=vera&category=','/api/replies?dealer=vera&category=../bad','/api/replies?dealer=vera&cursor=%0A','/api/replies?dealer=vera&cursor='+ 'x'.repeat(2049),`/api/replies/${id}/video?dealer=vera&cursor=abc`,`/api/replies/${id}/audio/extra?dealer=vera`,`/api/replies/${id}?dealer=prototype`,'/api/replies/item%2faudio?dealer=vera','/api/replies/reply-1?dealer=vera','/api/replies?dealer=vera#fragment'])assert.equal(isStudioRepliesReadQuery('GET',url(path)),false,path);
  for(const method of ['PATCH','POST','DELETE','PUT'])assert.equal(isStudioRepliesReadQuery(method,url('/api/replies?dealer=vera')),false);
  assert.equal(isStudioRepliesReadQuery('HEAD',url('/api/replies?dealer=vera')),false);
  assert.throws(()=>parseStudioRepliesRequest('PATCH',url('/api/replies/item?dealer=vera')));
});

test('native reply normalization preserves forwarded identity and adds only the configured API basePath',()=>{
  const request=new Request(labOrigin+'/api/replies?dealer=vera&category=player-greeting',{headers:{host:'public.example.invalid','x-forwarded-host':'public.example.invalid','x-forwarded-proto':'https',origin,'sec-fetch-site':'same-origin',cookie:'bo_jwt=fixture'}});
  const normalized=normalizeNativeStudioRequest(request,config);
  assert.equal(normalized.url,origin+'/studio/api/replies?dealer=vera&category=player-greeting');
  assert.equal(normalized.headers.get('cookie'),'bo_jwt=fixture');assert.equal(normalized.headers.get('origin'),origin);
  assert.throws(()=>normalizeNativeStudioRequest(new Request(labOrigin+'/api/replies?dealer=vera',{headers:{origin:'https://evil.invalid'}}),config));
  assert.throws(()=>normalizeNativeStudioRequest(new Request(labOrigin+'/api/project?dealer=vera'),config));
});

test('native frontend routes replies only to the configured Studio service',()=>{
  const config={publicOrigin:origin,labUiOrigin:labOrigin,backendOrigin:'https://game.example.invalid',nativeStudio:true};
  const route=platformRoute(url('/studio/api/replies?dealer=vera&cursor=abc'),config);
  assert.equal(route.kind,'lab');assert.equal(route.destination,labOrigin+'/studio/api/replies?dealer=vera&cursor=abc');
});
