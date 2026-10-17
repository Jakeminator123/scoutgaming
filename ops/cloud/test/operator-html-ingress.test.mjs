import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import { once } from 'node:events';
import { createCloudGateway } from '../gateway.mjs';
import { readVercelIngressConfig } from '../vercel-ingress.mjs';
import { platformBackendHeaders, platformConfiguration } from '../../../packages/navigation/server/platform-routing.mjs';
import { platformUiDocument } from '../../../apps/croupier-frontend/lib/server-ui.mjs';

const env = {CROUPIER_VERCEL_UI:'1',CROUPIER_VERCEL_UNIFIED_UI:'1',CROUPIER_STUDIO_NATIVE_ADMIN:'1',
  CROUPIER_STUDIO_NEON_POLICY:'1',CROUPIER_PUBLIC_ORIGIN:'https://operator.example.test',
  CROUPIER_BACKEND_ORIGIN:'https://isolated.onrender.com',CROUPIER_VERCEL_TRANSPORT_ORIGIN:'https://isolated.onrender.com',
  CROUPIER_VERCEL_INGRESS_SECRET:'operator-ingress-fixture-secret-'.repeat(3)};
const config = platformConfiguration(env);
const cookie = 'fixture-player-session=existing';
const query = 'operator=johns-spelbolag&table=room-06f0722d-74bf-49ca-8546-f6328ac69909';
const entryPath = '/blackjack?'+query;

async function fixture(t, canonical = true) {
  let htmlRequests = 0;
  const web = createServer((req,res)=>{
    assert.equal(req.headers.host,'operator.example.test');
    assert.equal(req.headers['x-croupier-vercel-secret'],undefined);
    assert.equal(req.headers['x-croupier-public-origin'],undefined);
    assert.equal(req.headers.cookie,cookie);
    if(req.url==='/api/auth/session') {
      res.writeHead(200,{'Content-Type':'application/json'});res.end('{"authenticated":true}');return;
    }
    const url = new URL(req.url,env.CROUPIER_PUBLIC_ORIGIN);
    assert.equal(url.pathname,'/blackjack');
    assert.equal(url.searchParams.get('operator'),'johns-spelbolag');
    assert.ok([null,'room-06f0722d-74bf-49ca-8546-f6328ac69909'].includes(url.searchParams.get('table')));
    assert.equal(url.searchParams.has('launch'),false);
    assert.equal(req.headers.accept,'text/html');
    htmlRequests++;res.writeHead(200,{'Content-Type':'text/html'});res.end(req.method==='HEAD'?undefined:'<html><body>Frozen Johanna fixture</body></html>');
  });
  web.listen(0,'127.0.0.1');await once(web,'listening');
  const ingress = readVercelIngressConfig({...env,CROUPIER_STUDIO_NEON_POLICY:canonical?'1':'0'});
  const gateway = createCloudGateway({singleOrigin:true,gameOrigin:env.CROUPIER_PUBLIC_ORIGIN,
    boOrigin:env.CROUPIER_PUBLIC_ORIGIN,labOrigin:env.CROUPIER_PUBLIC_ORIGIN},{
    vercelIngress:ingress,webPort:web.address().port,labPort:9,labInternalSecret:'operator-lab-fixture-secret-'.repeat(3)});
  gateway.listen(0,'127.0.0.1');await once(gateway,'listening');
  t.after(async()=>{for(const server of [gateway,web]){server.closeAllConnections();await new Promise(done=>server.close(done));}});
  const send=(path=entryPath,method='GET',overrides={})=>new Promise((resolve,reject)=>{
    const headers={...Object.fromEntries(platformBackendHeaders(new Headers({Accept:'text/html',Cookie:cookie}),config)),
      host:'isolated.onrender.com',...overrides};
    for(const name of Object.keys(headers))if(headers[name]===undefined)delete headers[name];
    const req=httpRequest({host:'127.0.0.1',port:gateway.address().port,path,method,headers},res=>{
      let body='';res.on('data',chunk=>body+=chunk);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body}));
    });req.on('error',reject);req.setTimeout(2000,()=>req.destroy(Error('fixture timeout')));req.end();
  });
  const fetchImpl=async(url,init={})=>{
    const target=new URL(url),headers=Object.fromEntries(init.headers);
    const result=await send(target.pathname+target.search,init.method??'GET',headers);
    return new Response(init.method==='HEAD'?null:result.body,{status:result.status,headers:result.headers});
  };
  return {send,fetchImpl,count:()=>htmlRequests};
}

test('real canonical UI proxy and platformBackendHeaders cross gateway for operator GET/HEAD without launch',async t=>{
  const f=await fixture(t);
  for(const method of ['GET','HEAD']) {
    const result=await platformUiDocument(new Request(env.CROUPIER_PUBLIC_ORIGIN+'/play/blackjack?'+query,
      {method,headers:{cookie}}),{env,fetchImpl:f.fetchImpl});
    assert.equal(result.status,200);
    assert.equal(result.headers.get('cache-control'),'private, no-store');
    const body=await result.text();assert.equal(method==='HEAD'?body:body.includes('Frozen Johanna fixture'),method==='HEAD'?'':true);
  }
  assert.equal(f.count(),2);
});

test('operator HTML remains signed, exact, read-only, and restricted to approved operator selectors',async t=>{
  const f=await fixture(t);
  assert.equal((await f.send()).status,200);
  assert.equal((await f.send('/blackjack?operator=johns-spelbolag')).status,200);
  const initial=f.count();
  for(const headers of [
    {'x-croupier-vercel-secret':undefined},{'x-croupier-vercel-secret':'wrong'},
    {'x-croupier-vercel-secret':'z'.repeat(config.secret.length)},
    {'x-croupier-public-origin':'https://evil.test'},{'x-forwarded-host':'evil.test'},
    {'x-forwarded-proto':'http'},{host:'operator.example.test'},{host:'evil.test'},
    {accept:'application/json'},{connection:'Upgrade',upgrade:'websocket'}]) {
    assert.equal((await f.send(entryPath,'GET',headers)).status,421);
  }
  for(const method of ['POST','PUT','DELETE','OPTIONS'])assert.equal((await f.send(entryPath,method)).status,421,method);
  for(const path of [
    '/blackjack','/blackjack?table=room-one','/blackjack?operator=invalid_slug',
    '/blackjack?operator=johns-spelbolag&operator=johns-spelbolag',
    '/blackjack?operator=johns-spelbolag&table=room-one&table=room-two',
    entryPath+'&unknown=1',entryPath+'&dealer=invalid_dealer',
    '/blackjack/?'+query,'/%62lackjack?'+query,'/blackjack/../blackjack?'+query,
    '/BLACKJACK?'+query,'/game?'+query,'/v2?'+query,'/other?'+query]) {
    assert.equal((await f.send(path)).status,421,path);
  }
  assert.equal(f.count(),initial,'rejections never reach Web');
});

test('operator HTML exception stays disabled outside canonical game mode',async t=>{
  const f=await fixture(t,false);
  for(const method of ['GET','HEAD'])assert.equal((await f.send(entryPath,method)).status,421);
  assert.equal(f.count(),0);
});
