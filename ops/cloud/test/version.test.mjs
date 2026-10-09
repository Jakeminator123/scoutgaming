import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { once } from 'node:events';
import { createCloudGateway } from '../gateway.mjs';
import { readVercelIngressConfig } from '../vercel-ingress.mjs';

const sha = 'ABCDEF0123456789ABCDEF0123456789ABCDEF01';
const publicOrigin = 'https://version.example.test';
const transportOrigin = 'https://isolated.onrender.com';
const config = {singleOrigin:true, gameOrigin:publicOrigin, boOrigin:publicOrigin, labOrigin:publicOrigin};
const ingress = readVercelIngressConfig({CROUPIER_VERCEL_TRANSPORT_ORIGIN:transportOrigin,
  CROUPIER_PUBLIC_ORIGIN:publicOrigin, CROUPIER_VERCEL_INGRESS_SECRET:'version-fixture-secret-'.repeat(3)});

async function fixture(t, renderGitCommit, transport) {
  const options = {labInternalSecret:'version-lab-fixture-secret-'.repeat(3), renderGitCommit,
    vercelIngress:transport ? ingress : null, webPort:9, labPort:9};
  const server = createCloudGateway(config, options);
  server.listen(0,'127.0.0.1'); await once(server,'listening');
  t.after(async()=>{server.closeAllConnections();await new Promise(done=>server.close(done));});
  const get = (path='/__cloud/version', method='GET', headers={})=>new Promise((resolve,reject)=>{
    const req=request({host:'127.0.0.1',port:server.address().port,path,method,
      headers:{host:new URL(transport ? transportOrigin : publicOrigin).host,...headers}},res=>{
      let body='';res.on('data',chunk=>body+=chunk);
      res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body}));
    });
    req.on('error',reject);req.setTimeout(2000,()=>req.destroy(Error('fixture timeout')));req.end();
  });
  return {get,options};
}

for (const transport of [false,true]) {
  test('version gateway freezes hosting SHA and rejects client overrides; transport='+transport,async t=>{
    const {get,options}=await fixture(t,sha,transport);
    options.renderGitCommit='0'.repeat(40);
    const result=await get('/__cloud/version','GET',{'x-render-git-commit':'1'.repeat(40),
      'x-commit-sha':'2'.repeat(40),cookie:'fixture-private',authorization:'Bearer fixture-private'});
    assert.equal(result.status,200);
    assert.deepEqual(JSON.parse(result.body),{schemaVersion:1,provider:'render',commitSha:sha.toLowerCase()});
    assert.equal(result.headers['cache-control'],'no-store');
    assert.equal(result.headers['x-content-type-options'],'nosniff');
    assert.equal(result.headers['content-type'],'application/json');
    const head=await get('/__cloud/version','HEAD');
    assert.equal(head.status,200);assert.equal(head.body,'');assert.equal(head.headers['cache-control'],'no-store');
    for(const path of ['/__cloud/version?commitSha='+sha,'/__cloud/version/','/__cloud/%76ersion','/__cloud/version/nested']) {
      assert.equal((await get(path)).status,421,path);
    }
    for(const method of ['POST','PUT','DELETE','OPTIONS'])assert.equal((await get('/__cloud/version',method)).status,421,method);
    assert.equal((await get('/__cloud/version','GET',{host:'evil.test'})).status,421);
    assert.equal((await get('/__cloud/version','GET',{connection:'Upgrade',upgrade:'websocket'})).status,421);
    assert.equal((await get('/api/table')).status,transport ? 421 : 502,'no broader anonymous ingress');
    const health=await get('/__cloud/health');assert.equal(health.status,200);assert.equal(health.body,'ok');
  });
  for(const value of [undefined,'','a'.repeat(39),'a'.repeat(41),'g'.repeat(40),sha+'\n',123]) {
    test('version unavailable for invalid hosting SHA '+JSON.stringify(value)+'; transport='+transport,async t=>{
      const {get}=await fixture(t,value,transport);
      const result=await get('/__cloud/version','GET',{'x-render-git-commit':sha});
      assert.equal(result.status,503);assert.deepEqual(JSON.parse(result.body),{error:'render_version_unavailable'});
      assert.equal(result.headers['cache-control'],'no-store');assert.equal(result.headers['x-content-type-options'],'nosniff');
      const head=await get('/__cloud/version','HEAD');assert.equal(head.status,503);assert.equal(head.body,'');
    });
  }
}
