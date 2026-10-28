import test from 'node:test';
import assert from 'node:assert/strict';
import {ADMIN_WORKSPACE_TOOLS,adminToolName,adminDocumentHref} from '../../../packages/navigation/admin-workspace-routes.mjs';
import {designPreviewPages} from '../lib/design-preview-paths.mjs';
import {studioLoginReturnTo} from '../lib/studio-login-client.mjs';
import {CONTROL_PREVIEW_VIEWS,workspaceSurfacePath} from '../../../packages/navigation/workspace-surfaces.mjs';
import {serveAdminWorkspaceData} from '../lib/admin-workspace-data.mjs';
import {platformRoute} from '../../../packages/navigation/server/platform-routing.mjs';
import {normalizeNativeStudioPageRequest} from '../lib/studio-native-request.mjs';

const tools=['companies','rooms','compositions','rehearsal','library','replies','clips','dealer-forge','administration','tree','videos','openclaw','activity','guide','zones','events','probe','operator-chat','preview','lanes'];
test('every existing Control tool and registered N1 view has a served Admin destination',()=>{
  for(const path of [...tools.map(tool=>'/control/'+tool),...CONTROL_PREVIEW_VIEWS.map(view=>workspaceSurfacePath('control',view))]){
    const to=adminDocumentHref(path+'?dealer=dragan&operator=nord&table=room-1&lane=portrait&game=blackjack');
    const url=new URL(to,'https://site.invalid');
    assert.ok(to.startsWith('/admin'),path);assert.ok(designPreviewPages.has(url.pathname.slice(7)),to);
    assert.equal(url.searchParams.get('dealer'),'dragan');assert.equal(url.searchParams.get('table'),'room-1');
    assert.equal(url.searchParams.get('composition'),'portrait');assert.equal(url.searchParams.has('lane'),false);
  }
  for(const key of Object.keys(ADMIN_WORKSPACE_TOOLS))assert.equal(adminToolName('/admin/'+key),key);
  assert.equal(adminToolName('/partner/companies'),null);
  assert.equal(adminDocumentHref('/control/zones'),'/admin/scenes');
  // Each retired OpenClaw entry returns to its owning resource.
  assert.equal(adminDocumentHref('/control/openclaw?tab=chat&dealer=dragan'),'/admin/dealer-agent?dealer=dragan');
  assert.equal(adminDocumentHref('/control/operator-chat?dealer=dragan'),'/admin/dealer-agent?dealer=dragan');
  assert.equal(adminDocumentHref('/control/openclaw?dealer=dragan'),'/admin/ai/models?dealer=dragan');
  assert.equal(adminDocumentHref('/control/ops'),'/admin/drift?tab=speech');
  assert.equal(adminDocumentHref('/control/players?operator=nord'),'/admin/players?operator=nord');
  assert.equal(adminDocumentHref('/control/dealer-forge?dealerId=dragan'),'/admin/dealer-studio?view=generate&dealer=dragan');
});
test('speech review retains its actual group and dealer on a served Admin document',()=>{
  const target=adminDocumentHref('/control/administration?tab=media-review&dealer=dragan&lane=portrait');
  assert.equal(target,'/admin/media-review?tab=media-review&dealer=dragan&composition=portrait');
  assert.equal(adminToolName('/admin/media-review'),'media-review');
  assert.ok(designPreviewPages.has('media-review'));
  assert.equal(studioLoginReturnTo(target),target);
});
test('legacy lanes bookmarks preserve the company tab instead of opening the rooms page',()=>{
  for(const prefix of ['/control','/studio/control']){
    assert.equal(adminDocumentHref(prefix+'/lanes?tab=companies&operator=nord&lane=portrait'),'/admin/companies?operator=nord&composition=portrait');
    assert.equal(adminDocumentHref(prefix+'/lanes?tab=publish&operator=nord&lane=portrait'),'/admin/rooms?operator=nord&composition=portrait');
  }
});
test('legacy clip dealerId bookmarks restore the dealer and retain explicit dealer precedence',()=>{
  for(const prefix of ['/control','/studio/control']){
    const target=adminDocumentHref(prefix+'/clips?dealerId=dragan&view=speech');
    assert.equal(target,'/admin/clips?panel=room&dealer=dragan');
    assert.equal(studioLoginReturnTo(target),target);
    assert.equal(adminDocumentHref(prefix+'/clips?dealer=paow&dealerId=dragan&view=clips'),'/admin/clips?dealer=paow');
  }
});
test('compatibility redirect preserves clip context and never rewrites API or authentication traffic',()=>{
  const config={nativeStudio:true,publicOrigin:'https://site.invalid'};
  const old=new URL('https://site.invalid/control/clips?dealer=dragan&view=speech&event=speak.welcome');
  assert.deepEqual(platformRoute(old,config),{kind:'redirect',destination:'https://site.invalid/admin/clips?panel=room&dealer=dragan&event=speak.welcome'});
  for(const path of ['/control/login?returnTo=x','/control/set-password?token=secret','/studio/api/videos','/api/admin','https://evil.invalid/control/clips','//evil.invalid/control/clips'])assert.equal(adminDocumentHref(path),path);
});
test('workspace reader authorizes before any runtime or catalogue access',async()=>{
  let reads=0;
  await assert.rejects(serveAdminWorkspaceData(new Request('https://site.invalid/studio/api/admin/workspace/companies'),{
    authorize:async()=>{throw Error('denied');},runtime:async()=>{reads++;},
  }),/denied/);assert.equal(reads,0);
});

test('Admin documents retain the existing navigation exception without opening API or action requests',()=>{
  const config={allowedOrigins:['https://site.invalid','https://lab.invalid'],publicHosts:['site.invalid','lab.invalid'],apiBase:'/studio/api/admin',authBase:'/studio/api/auth'};
  const headers={'sec-fetch-site':'cross-site','sec-fetch-mode':'navigate','sec-fetch-dest':'document'};
  const request=new Request('https://site.invalid/admin/replies',{headers});
  const normalized=normalizeNativeStudioPageRequest(request,config);
  assert.equal(new URL(normalized.url).pathname,'/studio/admin/replies');
  assert.equal(normalized.headers.get('sec-fetch-site'),null);
  for(const bad of [new Request(request,{method:'POST'}),new Request(request,{headers:{...headers,origin:'https://foreign.invalid'}}),new Request(request,{headers:{...headers,'next-action':'fixture'}}),new Request('https://site.invalid/studio/api/admin/workspace/companies',{headers})])assert.throws(()=>normalizeNativeStudioPageRequest(bad,config),/studio_request_rejected/);
});
test('login restores the exact Admin tool and context without accepting external returns or duplicate selectors',()=>{
  const target='/admin/rooms?operator=nord&table=room-1&composition=portrait&dealer=dragan&game=blackjack';
  assert.equal(studioLoginReturnTo('/studio'+target),target);
  assert.equal(studioLoginReturnTo('/studio/admin/publication?operator=nord&table=room-1&composition=portrait&dealer=dragan&game=blackjack'),target,'the retired publication page returns to Spelbolag & rum with the same context');
  assert.equal(studioLoginReturnTo('/admin/dealers?dealer=dragan&tool=import'),'/admin/dealers?dealer=dragan&tool=import');
  for(const invalid of ['/admin?returnTo=https://outside.invalid','/admin/clips?dealer=a&dealer=b','//outside.invalid/admin','/admin/_data/workspace?section=companies'])assert.equal(studioLoginReturnTo(invalid),'/admin');
});
test('workspace reads saved data and lists company memberships only for company tools',async()=>{
  let authorized=false,directories=0;
  const runtime=async()=>{assert.equal(authorized,true);return {gamePolicy:{readSaved:async()=>({project:{revision:'saved',dealers:[]}})},
    videoRegistry:async()=>({videos:[]}),listLaneOperators:async()=>[{id:'operator'}],listOperatorDirectory:async()=>{directories++;return [{id:'operator',members:[]}];}};};
  const options={authorize:async()=>{authorized=true;},runtime};
  const request=section=>new Request('https://site.invalid/studio/api/admin/workspace/'+section);
  const response=await serveAdminWorkspaceData(request('companies'),options),data=await response.json();
  assert.equal(data.project.revision,'saved');assert.equal(data.directory.operators[0].id,'operator');assert.equal(directories,1);
  assert.match(response.headers.get('cache-control'),/private, no-store/);
  const media=await (await serveAdminWorkspaceData(request('videos'),options)).json();assert.equal(media.directory,null);assert.equal(directories,1);
  assert.equal((await serveAdminWorkspaceData(request('unknown'),options)).status,400);
  assert.equal((await serveAdminWorkspaceData(request('companies?extra=1'),options)).status,400);
  assert.equal((await serveAdminWorkspaceData(new Request(request('companies'),{method:'POST'}),options)).status,400);
});

test('material library bookmarks share one destination and preserve their selection and context',()=>{
  for(const prefix of ['/control/library','/studio/control/library','/admin/material-library','/studio/admin/material-library']){
    const source=prefix+'?role=background&game=roulette&dealer=dragan&operator=north&room=one&room=two&lane=portrait#selected';
    const target=adminDocumentHref(source),url=new URL(target,'https://site.invalid');
    assert.equal(url.pathname,'/admin/assets');assert.equal(url.hash,'#selected');
    assert.equal(url.searchParams.get('tab'),'backgrounds');assert.equal(url.searchParams.get('game'),'roulette');
    assert.equal(url.searchParams.get('dealer'),'dragan');assert.equal(url.searchParams.get('operator'),'north');
    assert.deepEqual(url.searchParams.getAll('room'),['one','two']);assert.equal(url.searchParams.get('composition'),'portrait');
    assert.equal(url.searchParams.has('lane'),false);
    const explicit=new URL(adminDocumentHref(prefix+'?role=background&tab=tables&game=roulette'),'https://site.invalid');
    assert.equal(explicit.searchParams.get('tab'),'tables');
    assert.deepEqual(platformRoute(new URL(source,'https://site.invalid'),{nativeStudio:true,publicOrigin:'https://site.invalid'}),{kind:'redirect',destination:'https://site.invalid'+target});
  }
  assert.equal(adminToolName('/admin/material-library'),null);
});

test('duplicate selectors survive compatibility mapping for downstream validation',()=>{
  const target=adminDocumentHref('/control/clips?dealer=dragan&dealer=astrid');
  assert.deepEqual(new URL(target,'https://site.invalid').searchParams.getAll('dealer'),['dragan','astrid']);
  assert.equal(studioLoginReturnTo(target),'/admin');
});


test('retired publication bookmark mapping preserves fragments and rejects document redirects for writes',()=>{
  for(const nativeStudio of [false,true])for(const prefix of ['/control','/studio/control']){
    const config={nativeStudio,publicOrigin:'https://site.invalid',labUiOrigin:'https://lab.invalid',backendOrigin:'https://engine.invalid'};
    const url=new URL('https://site.invalid'+prefix+'/rooms?operator=north&table=room-1&lane=portrait#review');
    assert.equal(platformRoute(url,config,new Request(url)).destination,'https://site.invalid/admin/rooms?operator=north&table=room-1&composition=portrait#review');
    for(const options of [{method:'POST',body:'fixture'},{headers:{'next-action':'fixture'}}])assert.notEqual(platformRoute(url,config,new Request(url,options)).kind,'redirect');
    for(const path of ['/studio/api/admin/operator-package','/control/login','/control/set-password'])assert.notEqual(platformRoute(new URL(path,url),config).kind,'redirect');
  }
  // The merged Admin page itself: GET/HEAD follow to Spelbolag & rum with context and fragment; writes never redirect.
  for(const prefix of ['/admin','/studio/admin']){
    const config={nativeStudio:true,publicOrigin:'https://site.invalid',labUiOrigin:'https://lab.invalid',backendOrigin:'https://engine.invalid'};
    const url=new URL('https://site.invalid'+prefix+'/publication?operator=north&table=room-1&lane=portrait#review');
    for(const method of ['GET','HEAD'])assert.deepEqual(platformRoute(url,config,new Request(url,{method})),{kind:'redirect',destination:'https://site.invalid/admin/rooms?operator=north&table=room-1&composition=portrait#review'});
    for(const options of [{method:'POST',body:'fixture'},{method:'PUT',body:'fixture'},{method:'DELETE'},{headers:{'next-action':'fixture'}}])assert.notEqual(platformRoute(url,config,new Request(url,options)).kind,'redirect');
  }
  for(const path of ['/admin/publication/','/admin/publications','/admin/publication-extra'])assert.equal(adminDocumentHref(path),path);
});

test('retired tool bookmarks retain exact context and never redirect mutations',()=>{
  for(const [section,target] of [['guide','guide'],['videos','clips'],['probe','clips?panel=room'],['replies','replies'],['events','clips'],['tree','clips'],['compositions','scenes'],['rehearsal','rooms'],['preview','scenes'],['zones','scenes']])for(const nativeStudio of [false,true])for(const prefix of ['/control','/studio/control']){
    const config={nativeStudio,publicOrigin:'https://site.invalid',labUiOrigin:'https://lab.invalid',backendOrigin:'https://engine.invalid'};
    const url=new URL('https://site.invalid'+prefix+'/'+section+'?operator=north&table=room-1&lane=portrait&dealer=saga&event=idle.ready&variant=take-2&situation=dealer-hole&category=greeting#selected');
    for(const method of ['GET','HEAD'])assert.equal(platformRoute(url,config,new Request(url,{method})).destination,
      'https://site.invalid/admin/'+target+(target.includes('?')?'&':'?')+'operator=north&table=room-1&dealer=saga&event=idle.ready&variant=take-2&situation=dealer-hole&category=greeting&composition=portrait#selected');
    for(const options of [{method:'POST',body:'fixture'},{method:'PUT',body:'fixture'},{method:'DELETE'},{headers:{'next-action':'fixture'}}])assert.notEqual(platformRoute(url,config,new Request(url,options)).kind,'redirect');
  }
});

test('merged dependency bookmarks redirect to Kopplingar & användning with their selection and never for writes',()=>{
  for(const prefix of ['/admin','/studio/admin']){
    const source=prefix+'/deletion?operator=north&table=room-1&lane=portrait&dealer=saga#resource-room-726f6f6d2d31';
    const target=adminDocumentHref(source);
    assert.equal(target,'/admin/structure?operator=north&table=room-1&dealer=saga&composition=portrait#resource-room-726f6f6d2d31');
    assert.equal(studioLoginReturnTo(prefix+'/deletion?operator=north&table=room-1'),'/admin/structure?operator=north&table=room-1');
    assert.ok(designPreviewPages.has('structure'));
    const config={nativeStudio:true,publicOrigin:'https://site.invalid',labUiOrigin:'https://lab.invalid',backendOrigin:'https://engine.invalid'};
    const url=new URL('https://site.invalid'+source);
    for(const method of ['GET','HEAD'])assert.deepEqual(platformRoute(url,config,new Request(url,{method})),{kind:'redirect',destination:'https://site.invalid'+target});
    for(const options of [{method:'POST',body:'fixture'},{headers:{'next-action':'fixture'}}])assert.notEqual(platformRoute(url,config,new Request(url,options)).kind,'redirect');
  }
  for(const path of ['/admin/deletion/','/admin/deletions','/admin/structure?operator=north','/admin/deletion-extra'])assert.equal(adminDocumentHref(path),path);
  assert.equal(adminToolName('/admin/deletion'),null);assert.equal(adminToolName('/admin/structure'),null);
});

test('retired Admin editors redirect once to the owned panel with complete context',()=>{
  for(const [source,target] of [['/admin/dealer-studio?view=speech','/admin/clips?panel=room'],['/admin/dealer-studio?view=settings','/admin/clips?panel=dealer'],['/admin/videos?view=clips','/admin/clips'],['/admin/compositions?view=preview','/admin/scenes'],['/admin/probe?view=probe','/admin/clips?panel=room'],['/admin/rehearsal?view=log','/admin/rooms'],['/admin/events?event=deal.player.left','/admin/clips']]){
    for(const prefix of ['', '/studio']){
      const href=adminDocumentHref(prefix+source+'&dealer=saga&operator=north&room=one&room=two&lane=portrait#selection');
      const url=new URL(href,'https://site.invalid'),expected=new URL(target,'https://site.invalid');
      assert.equal(url.pathname,expected.pathname);assert.equal(url.searchParams.get('panel'),expected.searchParams.get('panel'));
      assert.equal(url.searchParams.get('dealer'),'saga');assert.deepEqual(url.searchParams.getAll('room'),['one','two']);
      assert.equal(url.searchParams.get('composition'),'portrait');assert.equal(url.hash,'#selection');assert.equal(adminDocumentHref(href),href);
      const config={nativeStudio:true,publicOrigin:'https://site.invalid'},old=new URL(prefix+source,'https://site.invalid');
      for(const method of ['POST','PUT','DELETE'])assert.notEqual(platformRoute(old,config,new Request(old,{method})).kind,'redirect');
    }
  }
});
