import test from 'node:test';
import assert from 'node:assert/strict';
import {createStudioRepliesApi} from '../lib/studio-replies-api.mjs';

const origin='https://public.example.invalid',labOrigin='https://studio.example.invalid';
const scope={environment:'test',workspaceId:'studio-test'};
const config={scope,allowedOrigins:[origin,labOrigin],publicHosts:['public.example.invalid','studio.example.invalid'],apiBase:'/studio/api/admin',authBase:'/studio/api/auth'};
const id='2d892414-d620-4b72-9b33-cfa85e1a4a0b',otherId='6baaacb4-64a6-4265-95a5-a21e8993a600';
const media=kind=>({available:true,sha256:'a'.repeat(64),contentType:kind==='audio'?'audio/wav':'video/mp4',size:128});
const item=(changes={})=>({id,dealerId:'vera',exactText:'Welcome to the table.',language:'en',createdAt:'2026-10-12T00:00:00.000Z',profileRevision:'b'.repeat(64),revision:1,categories:[],reviewStatus:'pending',media:{audio:media('audio'),video:media('video')},...changes});
const failure=(code,statusCode)=>Object.assign(new Error('secret-provider-detail'),{code,statusCode});
const request=(path='?dealer=vera',options={})=>new Request(origin+'/studio/api/replies'+path,options);
const patch=(body={},options={})=>request('/'+id,{method:'PATCH',headers:{origin,'sec-fetch-site':'same-origin','content-type':'application/json',...options.headers},body:JSON.stringify({dealerId:'vera',categories:['game-win'],expectedRevision:1,...body})});
function setup(overrides={}) {
  const calls=[];
  const replyLibrary={
    async list(input){calls.push(['list',input]);return {items:[item()],nextCursor:null};},
    async get(input){calls.push(['get',input]);return item();},
    async categorize(input){calls.push(['categorize',input]);await input.stillAuthorized();return item({categories:input.categories,revision:2});},
    async media(input){calls.push(['media',input]);return new Response('wav',{headers:{'content-type':'audio/wav'}});},
    ...overrides.replyLibrary,
  };
  const authorize=overrides.authorize??(async()=>({user:'Editor',role:'admin',scope}));
  return {api:createStudioRepliesApi({config,authorize,replyLibrary}),calls};
}

test('authenticated list and item are dealer-bound and return only public fields with private cache headers',async()=>{
  const privateItem=item({url:'https://private.invalid',pathname:'private-blob',etag:'private-etag',token:'private-token'});
  privateItem.media.audio.url='https://audio.private.invalid';
  const {api,calls}=setup({replyLibrary:{async list(input){calls.push(['list',input]);return {items:[privateItem],nextCursor:'opaque/page:2='};}}});
  const response=await api.handle(request('?dealer=vera&category=game-win&cursor=opaque%2Fpage%3A1%3D'));
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');
  assert.deepEqual(calls,[['list',{dealerId:'vera',category:'game-win',cursor:'opaque/page:1='}]]);
  const body=await response.json();assert.deepEqual(body,{items:[item()],nextCursor:'opaque/page:2='});
  const current=await api.handle(request('/'+id+'?dealer=vera'));
  assert.equal(current.status,200);assert.deepEqual(await current.json(),{item:item()});
});

test('N1 login, role, workspace and environment are checked before any Blob read',async()=>{
  for(const [session,status] of [[null,403],[{user:'Editor',role:'reader',scope},403],[{user:'Editor',role:'admin',scope:{...scope,workspaceId:'other'}},403],[{user:'Editor',role:'admin',scope:{...scope,environment:'production'}},403],[{user:'',role:'admin',scope},403]]){
    const {api,calls}=setup({authorize:async()=>session});const response=await api.handle(request());
    assert.equal(response.status,status);assert.deepEqual(calls,[]);
  }
  const {api,calls}=setup({authorize:async()=>{throw failure('studio_login_required',401);}});
  const response=await api.handle(request());assert.equal(response.status,401);assert.deepEqual(calls,[]);
});

test('revoked or changed identities cannot receive list or item metadata after the provider read',async()=>{
  for(const kind of ['list','item']){
    let count=0;
    const {api}=setup({authorize:async()=>({user:++count===1?'Editor':'Other editor',role:'admin',scope})});
    const response=await api.handle(request(kind==='list'?'?dealer=vera':'/'+id+'?dealer=vera'));
    assert.equal(response.status,403);assert.equal((await response.text()).includes('Welcome'),false);
  }
});

test('categorization enforces same-origin, exact body fields, category ids and a positive integer revision',async()=>{
  const {api,calls}=setup();
  const denied=[
    patch({}, {headers:{origin:'https://evil.invalid'}}),patch({}, {headers:{'sec-fetch-site':'cross-site'}}),
    request('/'+id,{method:'PATCH',headers:{'content-type':'application/json'},body:'{}'}),
    patch({exactText:'changed'}),patch({expectedRevision:0}),patch({expectedRevision:1.5}),patch({expectedRevision:'1'}),
    patch({categories:['unknown']}),patch({categories:['game-win','game-win']}),patch({dealerId:'prototype'}),
    request('/'+id+'?dealer=vera',{method:'PATCH',headers:{origin,'sec-fetch-site':'same-origin','content-type':'application/json'},body:'{}'}),
  ];
  for(const value of denied){assert.ok([400,403].includes((await api.handle(value)).status));}
  assert.deepEqual(calls,[]);
  const response=await api.handle(patch());assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{item:item({categories:['game-win'],revision:2})});
  const input=calls[0][1];assert.equal(input.id,id);assert.equal(input.dealerId,'vera');assert.equal(input.expectedRevision,1);assert.equal(typeof input.stillAuthorized,'function');
});

test('an account revoked after metadata read is rejected by the pre-CAS authorization callback',async()=>{
  let authorized=true,writes=0;
  const {api}=setup({authorize:async()=>{if(!authorized)throw failure('studio_login_required',401);return {user:'Editor',role:'admin',scope};},replyLibrary:{async categorize(input){authorized=false;await input.stillAuthorized();writes++;return item();}}});
  assert.equal((await api.handle(patch())).status,401);assert.equal(writes,0);
});

test('stale category revisions return 409 without retry or a leaked backend message',async()=>{
  let writes=0;const {api}=setup({replyLibrary:{async categorize(){writes++;throw failure('reply_library_revision_conflict',409);}}});
  const response=await api.handle(patch());assert.equal(response.status,409);assert.equal(writes,1);
  assert.deepEqual(await response.json(),{error:'reply_library_revision_conflict',code:'reply_library_revision_conflict'});
});

test('dealer or identity mismatches in a provider result fail closed',async()=>{
  for(const [path,methods] of [['?dealer=vera',{async list(){return {items:[item({dealerId:'astrid'})],nextCursor:null};}}],['/'+id+'?dealer=vera',{async get(){return item({id:otherId});}}]]){
    const {api}=setup({replyLibrary:methods});const response=await api.handle(request(path));assert.equal(response.status,503);assert.equal((await response.text()).includes('Welcome'),false);
  }
});

test('private media preserves GET Range and HEAD while stripping provider response headers',async()=>{
  for(const method of ['GET','HEAD']){
    let actual;
    const {api}=setup({replyLibrary:{async media(input){actual=input;return new Response(method==='HEAD'?null:'1234',{status:206,headers:{'content-type':'audio/wav','content-length':'4','content-range':'bytes 0-3/128','accept-ranges':'bytes','cache-control':'public','location':'https://private.invalid','x-blob-token':'private-token','set-cookie':'secret=token'}});}}});
    const response=await api.handle(request('/'+id+'/audio?dealer=vera',{method,headers:{range:'bytes=0-3'}}));
    assert.equal(response.status,206);assert.equal(actual.dealerId,'vera');assert.equal(actual.kind,'audio');assert.equal(actual.request.headers.get('range'),'bytes=0-3');
    assert.equal(response.headers.get('content-range'),'bytes 0-3/128');assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.headers.get('cross-origin-resource-policy'),'same-origin');
    for(const name of ['location','x-blob-token','set-cookie'])assert.equal(response.headers.get(name),null);
    assert.equal(await response.text(),method==='HEAD'?'':'1234');
  }
});

test('revocation after a media fetch cancels the stream and does not return bytes',async()=>{
  let count=0,cancelled=false;
  const {api}=setup({authorize:async()=>{if(++count>1)throw failure('studio_login_required',401);return {user:'Editor',role:'admin',scope};},replyLibrary:{async media(){return new Response(new ReadableStream({cancel(){cancelled=true;}}));}}});
  const response=await api.handle(request('/'+id+'/video?dealer=vera'));
  assert.equal(response.status,401);assert.equal(cancelled,true);
});

test('transport rejects arbitrary forwarded origins and mutations other than categories',async()=>{
  const {api,calls}=setup();
  for(const value of [request('?dealer=vera',{headers:{'x-forwarded-host':'evil.invalid'}}),request('?dealer=vera',{method:'DELETE'}),request('/'+id+'/audio?dealer=vera',{method:'PATCH'}),request('/'+id+'?dealer=vera&token=secret')])assert.ok([400,403].includes((await api.handle(value)).status));
  assert.deepEqual(calls,[]);
});

test('unknown provider failures never return their message, URL or token',async()=>{
  const {api}=setup({replyLibrary:{async list(){throw new Error('token=secret https://private.invalid/blob');}}});
  const response=await api.handle(request());assert.equal(response.status,503);
  assert.equal((await response.text()).includes('secret'),false);
});
