import {createServer} from 'node:http';
import {createHash,createHmac,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createPublicationChain, company, compositionId} from './admin-publication-chain.mjs';
import {createStudioNativeAuth} from '../../packages/studio-access/studio-native-auth.mjs';
import {createStudioDocumentApi} from '../../apps/studio/lib/studio-document-api.mjs';
import {createStudioAdminApi} from '../../apps/studio/lib/studio-admin-api.mjs';
import {createOperatorPackageApi} from '../../apps/studio/lib/operator-package-api.mjs';
import {createResourceLifecycleApi} from '../../apps/studio/lib/resource-lifecycle-api.mjs';
import {createPresentationRoomController, createPresentationRoomClient} from '../../apps/studio/lib/presentation-room-client.mjs';
import {validateProject} from '../../packages/presentation/contracts/studio-model.mjs';
import {platformRoute} from '../../packages/navigation/server/platform-routing.mjs';

// Actual publication component, document CAS, cookie/role checks and package
// writers; only accounts, media metadata and SQL storage are synthetic.
// No real user, media bytes, provider, game server or database is accessed.
const root = fileURLToPath(new URL('../..', import.meta.url));
const require = createRequire(new URL('../../apps/studio/package.json', import.meta.url));
let bundled;
async function bundle() {
  return bundled ??= require('esbuild').build({
    stdin: {contents: `
      import React from 'react';
      import {createRoot} from 'react-dom/client';
      import {AdminPublicationPage} from './apps/studio/components/admin-publication-page.tsx';
      import './apps/studio/client/admin/app/studio.css';
      async function mount(){
        const response=await fetch('/fixture-workspace');
        if(!response.ok)throw Error('Fixture session rejected');
        const props=await response.json(),q=new URLSearchParams(location.search);
        createRoot(document.getElementById('root')).render(<AdminPublicationPage {...props}
          initialOperatorId={q.get('operator')??undefined} initialLaneId={q.get('composition')??undefined}
          initialRoomId={q.get('room')??q.get('table')??undefined}/>);
      }
      mount().catch(error=>{document.getElementById('root').textContent=error.message;throw error;});
    `, resolveDir: root, loader: 'tsx'},
    bundle: true, write: false, format: 'esm', platform: 'browser', jsx: 'automatic',
    outfile: resolve(root, 'fixture.js'), external: ['/composition-runtime/compositor.js'],
    nodePaths: [resolve(root, 'apps/studio/node_modules')],
    alias: {'react': resolve(root, 'apps/studio/node_modules/react'), 'react-dom': resolve(root, 'apps/studio/node_modules/react-dom'),
      'next/link': resolve(root, 'apps/studio/client/runtime/navigation.tsx'),
      'next/navigation': resolve(root, 'apps/studio/client/runtime/navigation.tsx'),
      'next/image': resolve(root, 'apps/studio/client/runtime/image.ts')},
    define: {'process.env.NODE_ENV': '"production"', 'process.env.NEXT_PUBLIC_LAB_BASE_PATH': '"/studio"',
      'process.env.NEXT_PUBLIC_ADMIN_WORKSPACE': '"1"'}, logLevel: 'silent',
  });
}

export async function startPublicationWorkspace() {
  const built = await bundle(), errors = [], requests = [];
  const js = built.outputFiles.find(file=>file.path.endsWith('.js')).text;
  const css = built.outputFiles.find(file=>file.path.endsWith('.css'))?.text ?? '';
  let origin, chain, authorize, documents, admin, packages;
  const server = createServer(async (incoming,outgoing)=>{
    try {
      const chunks=[];for await(const chunk of incoming)chunks.push(chunk);
      const body=Buffer.concat(chunks),request=new Request(origin+incoming.url,{
        method:incoming.method,headers:incoming.headers,...(body.length?{body}:{})});
      const path=new URL(request.url).pathname;
      let response;
      if(/^\/(?:studio\/)?control\/(?:rooms|companies|lanes)$/.test(path)){
        const route=platformRoute(new URL(request.url),{nativeStudio:false,publicOrigin:origin,labUiOrigin:origin,backendOrigin:origin},request);
        response=route.kind==='redirect'?Response.redirect(route.destination,307):new Response(null,{status:404});
      }
      else if(path==='/admin/publication')response=new Response('<!doctype html><html lang="sv" class="preview-admin"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><div class="admin-workspace-tool" id="root"></div><script type="module" src="/fixture.js"></script></html>',{headers:{'content-type':'text/html; charset=utf-8'}});
      else if(path==='/fixture.js')response=new Response(js,{headers:{'content-type':'application/javascript'}});
      else if(path==='/fixture.css')response=new Response(css+'\nbody{margin:0;background:var(--sg-bg);color:var(--sg-text);font:14px system-ui}*{box-sizing:border-box}a{color:inherit}button,input,select{font:inherit}button{cursor:pointer}button:disabled{cursor:default}p,h1,h2{margin-top:0}',{headers:{'content-type':'text/css'}});
      else if(path==='/fixture-workspace'){
        await authorize(request);
        response=Response.json({initialProject:(await chain.repository.readDocument('project')).value,
          initialVideos:{videos:[]},initialStatus:{configured:true},operators:await packages.listOperators(),storeAvailable:true});
      }
      else if(path==='/studio/api/project')response=await documents.handle(request);
      else if(['/studio/api/admin/operator-package','/studio/api/admin/resource-lifecycle'].includes(path))response=await admin.handle(request);
      else if(path==='/favicon.ico')response=new Response(null,{status:204});
      else response=await chain.handle(request);
      if(request.method!=='GET')requests.push({path,body:body.length?JSON.parse(body.toString()):null,status:response.status});
      outgoing.writeHead(response.status,Object.fromEntries(response.headers));outgoing.end(Buffer.from(await response.arrayBuffer()));
    }catch(error){
      const status=error.statusCode??500;
      if(status===500)errors.push(error.stack??error.message);
      outgoing.writeHead(status);outgoing.end('Isolated fixture request rejected');
    }
  });
  await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});
  origin='http://127.0.0.1:'+server.address().port;
  try {
    chain=await createPublicationChain(origin);
    authorize=createStudioNativeAuth(chain.config);
    const videoRegistry={async loadCaptured(snapshot){return {videos:snapshot.mediaRows.map(row=>({
      id:row.id,dealer:row.classification.dealerId,sha256:row.sha256,bytes:row.size,
      classification:row.classification,available:true,integrity:'verified'}))};},async verifyCapturedMedia(){}};
    packages=createOperatorPackageApi({pool:chain.operators,scope:chain.config.scope,repository:chain.repository,videoRegistry,
      storeFactory:async()=>chain.store,now:chain.config.now});
    const lifecycle=createResourceLifecycleApi({repository:chain.repository,scope:chain.config.scope,now:chain.config.now});
    admin=createStudioAdminApi({authorize,allowedOrigins:chain.config.allowedOrigins,publicHosts:chain.config.publicHosts,
      handlers:new Map([...packages.handlers,...lifecycle.handlers]),preparations:packages.preparations,
      mutationTransaction:work=>chain.repository.transaction(work)});
    documents=createStudioDocumentApi({repository:chain.repository,authorize,config:chain.config,
      validateProjectBindings:async project=>validateProject(project),mutationTransaction:work=>chain.repository.transaction(work)});
    const client=createPresentationRoomClient({fetchImpl:async(path,options)=>chain.handle(new Request(new URL(path,origin),{
      ...options,headers:{...options?.headers,cookie:chain.auth.admin,...(options?.method==='POST'?{origin,'sec-fetch-site':'same-origin'}:{})}}))});
    const controller=createPresentationRoomController({client});
    const previousBase=process.env.NEXT_PUBLIC_LAB_BASE_PATH;
    process.env.NEXT_PUBLIC_LAB_BASE_PATH='/studio';
    let receipt;
    try{
      await controller.configure(chain.props);controller.setName('J01 provrum');
      await controller.create(controller.getSnapshot().key);receipt=controller.getSnapshot().receipt;
      if(!receipt)throw Error('Publication fixture room could not be created: '+JSON.stringify(controller.getSnapshot()));
    }finally{controller.cancel();if(previousBase===undefined)delete process.env.NEXT_PUBLIC_LAB_BASE_PATH;else process.env.NEXT_PUBLIC_LAB_BASE_PATH=previousBase;}
    return {origin,chain,requests,errors,room:receipt.room,
      // A new synthetic signed session for the same account, never a product login endpoint.
      async newAdminSession(){
        const account=chain.auth.users[0],issuedAt=Math.floor(chain.config.now()/1000);
        const signer=await chain.auth.boDb.prepare("SELECT v FROM meta WHERE k='jwt_secret'").get();
        const header=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
        const body=Buffer.from(JSON.stringify({sub:account.username,role:account.role,aud:'backoffice',
          iat:issuedAt,exp:issuedAt+3600,jti:randomUUID(),auth_epoch:account.epoch,
          source_stamp:createHash('sha256').update(account.salt+':'+account.hash).digest('hex')})).toString('base64url');
        const signature=createHmac('sha256',Buffer.from(signer.v,'hex')).update(header+'.'+body).digest('base64url');
        return 'bo_jwt='+header+'.'+body+'.'+signature;
      },
      url:origin+'/admin/publication?'+new URLSearchParams({operator:company.id,composition:compositionId,room:receipt.room.id,dealer:'astrid',game:'blackjack'})+'#publication',
      async close(){server.closeIdleConnections();await new Promise((yes,no)=>server.close(error=>error?no(error):yes()));},
      async request(path,{method='GET',body,cookie=chain.auth.admin}={}){
        return fetch(origin+path,{method,headers:{cookie,...(method!=='GET'?{origin,'sec-fetch-site':'same-origin','content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
      },
    };
  }catch(error){await new Promise(resolve=>server.close(resolve));throw error;}
}
