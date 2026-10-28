import test from 'node:test';
import assert from 'node:assert/strict';
import {ADMIN_WORKSPACE_TOOLS,adminDocumentHref} from '../../../packages/navigation/admin-workspace-routes.mjs';
import {designPreviewPages,isDesignPreviewPage} from '../lib/design-preview-paths.mjs';
import {studioLoginReturnTo} from '../lib/studio-login-client.mjs';
import {CONTROL_PREVIEW_VIEWS,workspaceSurfacePath} from '../../../packages/navigation/workspace-surfaces.mjs';
import {serveAdminWorkspaceData} from '../lib/admin-workspace-data.mjs';
import {platformRoute} from '../../../packages/navigation/server/platform-routing.mjs';
import {normalizeNativeStudioPageRequest} from '../lib/studio-native-request.mjs';

const tools=['companies','rooms','compositions','rehearsal','library','replies','clips','dealer-forge','administration','tree','videos','openclaw','activity','guide','zones','events','probe','operator-chat','preview','lanes'];
// A room nav (/admin/rooms/<id>) owns its room; table, composition, game and dealer leave the address, the company stays.
const roomNav=url=>/^\/admin\/rooms\/[^/]+$/.test(url.pathname);
test('every existing Control tool and registered N1 view has a served Admin destination',()=>{
  for(const path of [...tools.map(tool=>'/control/'+tool),...CONTROL_PREVIEW_VIEWS.map(view=>workspaceSurfacePath('control',view))]){
    const to=adminDocumentHref(path+'?dealer=dragan&operator=nord&table=room-1&lane=portrait&game=blackjack');
    const url=new URL(to,'https://site.invalid');
    assert.ok(to.startsWith('/admin'),path);assert.ok(isDesignPreviewPage(url.pathname.slice(7)),to);
    assert.equal(adminDocumentHref(to),to,'one redirect is enough: '+to);
    assert.equal(url.searchParams.has('lane'),false,to);
    const dealerNav=url.pathname.startsWith('/admin/dealers/');
    if(dealerNav)assert.equal(url.pathname,'/admin/dealers/dragan',to);else if(!roomNav(url))assert.equal(url.searchParams.get('dealer'),'dragan',to);
    if(roomNav(url)){assert.equal(url.pathname,'/admin/rooms/room-1',to);for(const key of ['table','composition','game','dealer'])assert.equal(url.searchParams.has(key),false,key+' leaves the room address: '+to);assert.equal(url.searchParams.get('operator'),'nord',to);}
    else {assert.equal(url.searchParams.get('table'),'room-1',to);assert.equal(url.searchParams.get('composition'),'portrait',to);}
  }
  // The embedded tools (Team, Svarsbibliotek, Dialogtest) are workspace sections, not pages: their old addresses open the navs.
  assert.deepEqual(Object.keys(ADMIN_WORKSPACE_TOOLS),['companies','replies','dealer-agent']);
  assert.deepEqual(Object.values(ADMIN_WORKSPACE_TOOLS).map(tool=>tool.label),['Bolag','Svarsbibliotek','Dialogtest']);
  for(const name of ['replies','dealer-agent','dealer-studio'])assert.equal(adminDocumentHref('/admin/'+name),'/admin/dealers');
  assert.equal(adminDocumentHref('/partner/companies'),'/partner/companies');
  assert.equal(adminDocumentHref('/control/zones'),'/admin/scenes?tab=mallar');
  // Each retired OpenClaw entry returns to its owning resource.
  assert.equal(adminDocumentHref('/control/openclaw?tab=chat&dealer=dragan'),'/admin/dealers/dragan?flik=tal&verktyg=dialog');
  assert.equal(adminDocumentHref('/control/operator-chat?dealer=dragan'),'/admin/dealers/dragan?flik=tal&verktyg=dialog');
  assert.equal(adminDocumentHref('/control/openclaw?dealer=dragan'),'/admin/system?flik=agenter&dealer=dragan');
  assert.equal(adminDocumentHref('/control/ops'),'/admin/dealers','Taldrift lives on the dealer; without a dealer the list opens');
  assert.equal(adminDocumentHref('/control/players?operator=nord'),'/admin/system?flik=spelare&operator=nord');
  assert.equal(adminDocumentHref('/control/dealer-forge?dealerId=dragan'),'/admin/dealers/dragan?flik=klipp&panel=generera');
});
test('retired speech review bookmarks land on Röst och tal with their dealer context',()=>{
  const target=adminDocumentHref('/control/administration?tab=media-review&dealer=dragan&lane=portrait');
  assert.equal(target,'/admin/dealers/dragan?flik=tal&composition=portrait');
  assert.equal(adminDocumentHref('/admin/media-review?dealer=dragan'),'/admin/dealers/dragan?flik=tal');
  assert.equal(studioLoginReturnTo(target),target);
  assert.equal(studioLoginReturnTo('/admin/media-review?dealer=dragan'),'/admin/dealers/dragan?flik=tal');
});
test('legacy lanes bookmarks preserve the company tab instead of opening the rooms page',()=>{
  for(const prefix of ['/control','/studio/control']){
    const company=new URL(adminDocumentHref(prefix+'/lanes?tab=companies&operator=nord&lane=portrait'),'https://site.invalid');
    assert.equal(company.pathname.startsWith('/admin/companies'),true);assert.equal(company.searchParams.get('composition'),'portrait');
    assert.equal(company.searchParams.has('tab'),false,'the company bookmark never opens the room list');
    assert.equal(adminDocumentHref(prefix+'/lanes?tab=publish&operator=nord&lane=portrait'),'/admin/companies?tab=spelbord&operator=nord&composition=portrait');
  }
});
test('a legacy company lanes bookmark opens the company nav in one redirect',()=>{
  const target=adminDocumentHref('/control/lanes?tab=companies&operator=nord&lane=portrait');
  assert.equal(target,'/admin/companies/nord?composition=portrait');assert.equal(adminDocumentHref(target),target);
});
test('legacy clip dealerId bookmarks restore the dealer and retain explicit dealer precedence',()=>{
  for(const prefix of ['/control','/studio/control']){
    const target=adminDocumentHref(prefix+'/clips?dealerId=dragan&view=speech');
    assert.equal(target,'/admin/dealers/dragan?flik=tal');
    assert.equal(studioLoginReturnTo(target),target);
    assert.equal(adminDocumentHref(prefix+'/clips?dealer=paow&dealerId=dragan&view=clips'),'/admin/dealers/paow?flik=klipp');
  }
});
test('compatibility redirect preserves clip context and never rewrites API or authentication traffic',()=>{
  const config={nativeStudio:true,publicOrigin:'https://site.invalid'};
  const old=new URL('https://site.invalid/control/clips?dealer=dragan&view=speech&event=speak.welcome');
  assert.deepEqual(platformRoute(old,config),{kind:'redirect',destination:'https://site.invalid/admin/dealers/dragan?flik=tal&event=speak.welcome'});
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
  const request=new Request('https://site.invalid/admin/dealers/dragan',{headers});
  const normalized=normalizeNativeStudioPageRequest(request,config);
  assert.equal(new URL(normalized.url).pathname,'/studio/admin/dealers/dragan');
  assert.equal(normalized.headers.get('sec-fetch-site'),null);
  for(const bad of [new Request(request,{method:'POST'}),new Request(request,{headers:{...headers,origin:'https://foreign.invalid'}}),new Request(request,{headers:{...headers,'next-action':'fixture'}}),new Request('https://site.invalid/studio/api/admin/workspace/companies',{headers})])assert.throws(()=>normalizeNativeStudioPageRequest(bad,config),/studio_request_rejected/);
});
test('login restores the exact Admin page and context without accepting external returns or duplicate selectors',()=>{
  // The room nav owns its room and dealer selection; only the company follows (Jakob 2026-10-28).
  const target='/admin/rooms/room-1?operator=nord';
  assert.equal(studioLoginReturnTo('/studio'+target),target);
  assert.equal(studioLoginReturnTo('/studio/admin/rooms/room-1?operator=nord&dealer=dragan'),target+'&dealer=dragan','a dealer written on the room nav itself is left alone');
  assert.equal(studioLoginReturnTo('/studio/admin/rooms?operator=nord&table=room-1&composition=portrait&dealer=dragan&game=blackjack'),target,'an old rooms bookmark returns to the room nav');
  assert.equal(studioLoginReturnTo('/studio/admin/publication?operator=nord&table=room-1&composition=portrait&dealer=dragan&game=blackjack'),target,'the retired publication page returns to the same room');
  assert.equal(studioLoginReturnTo('/admin/dealers?dealer=dragan&tool=import'),'/admin/dealers/dragan?flik=klipp&tool=import');
  assert.equal(studioLoginReturnTo('/admin/dealers/dragan?flik=tal&verktyg=dialog'),'/admin/dealers/dragan?flik=tal&verktyg=dialog');
  for(const invalid of ['/admin?returnTo=https://outside.invalid','/admin/clips?dealer=a&dealer=b','/admin/dealers/dragan?flik=klipp&flik=tal','//outside.invalid/admin','/admin/_data/workspace?section=companies'])assert.equal(studioLoginReturnTo(invalid),'/admin');
});
// The workspace reader serves exactly the embedded tools' sections (ADMIN_WORKSPACE_TOOLS) plus the legacy read-only ones.
test('workspace reads saved data and lists company memberships only for company tools',async()=>{
  let authorized=false,directories=0;
  const runtime=async()=>{assert.equal(authorized,true);return {gamePolicy:{readSaved:async()=>({project:{revision:'saved',dealers:[]}})},
    videoRegistry:async()=>({videos:[]}),listLaneOperators:async()=>[{id:'operator'}],listOperatorDirectory:async()=>{directories++;return [{id:'operator',members:[]}];}};};
  const options={authorize:async()=>{authorized=true;},runtime};
  const request=section=>new Request('https://site.invalid/studio/api/admin/workspace/'+section);
  const response=await serveAdminWorkspaceData(request('companies'),options);assert.equal(response.status,200);const data=await response.json();
  assert.equal(data.project.revision,'saved');assert.equal(data.directory.operators[0].id,'operator');assert.equal(directories,1);
  assert.match(response.headers.get('cache-control'),/private, no-store/);
  for(const section of ['replies','dealer-agent']){const other=await serveAdminWorkspaceData(request(section),options);assert.equal(other.status,200,section);assert.equal((await other.json()).directory,null);}
  assert.equal(directories,1);
});
test('workspace reader rejects unknown sections, queries and writes',async()=>{
  const options={authorize:async()=>{},runtime:async()=>({gamePolicy:{readSaved:async()=>({project:{revision:'saved',dealers:[]}})},videoRegistry:async()=>({videos:[]}),
    listLaneOperators:async()=>[],listOperatorDirectory:async()=>[]})};
  const request=section=>new Request('https://site.invalid/studio/api/admin/workspace/'+section);
  assert.equal((await serveAdminWorkspaceData(request('unknown'),options)).status,400);
  assert.equal((await serveAdminWorkspaceData(request('companies?extra=1'),options)).status,400);
  assert.equal((await serveAdminWorkspaceData(new Request(request('companies'),{method:'POST'}),options)).status,400);
  const media=await serveAdminWorkspaceData(request('videos'),options);assert.equal(media.status,200);assert.equal((await media.json()).directory,null);
});

test('material library bookmarks share one destination and preserve their selection and context',()=>{
  for(const prefix of ['/control/library','/studio/control/library','/admin/material-library','/studio/admin/material-library']){
    const source=prefix+'?role=background&game=roulette&dealer=dragan&operator=north&room=one&room=two&lane=portrait#selected';
    const target=adminDocumentHref(source),url=new URL(target,'https://site.invalid');
    assert.equal(url.pathname,'/admin/scenes');assert.equal(url.hash,'#selected');
    assert.equal(url.searchParams.get('tab'),'bakgrunder');assert.equal(url.searchParams.get('game'),'roulette');
    assert.equal(url.searchParams.get('dealer'),'dragan');assert.equal(url.searchParams.get('operator'),'north');
    assert.deepEqual(url.searchParams.getAll('room'),['one','two']);assert.equal(url.searchParams.get('composition'),'portrait');
    assert.equal(url.searchParams.has('lane'),false);assert.equal(url.searchParams.has('role'),false);
    const explicit=new URL(adminDocumentHref(prefix+'?role=background&tab=tables&game=roulette'),'https://site.invalid');
    assert.equal(explicit.searchParams.get('tab'),'bordsgrafik');
    assert.deepEqual(platformRoute(new URL(source,'https://site.invalid'),{nativeStudio:true,publicOrigin:'https://site.invalid'}),{kind:'redirect',destination:'https://site.invalid'+target});
  }
});

test('duplicate selectors survive compatibility mapping for downstream validation',()=>{
  const target=adminDocumentHref('/control/clips?dealer=dragan&dealer=astrid');
  assert.equal(new URL(target,'https://site.invalid').pathname,'/admin/dealers','an ambiguous dealer never picks a dealer nav');
  assert.deepEqual(new URL(target,'https://site.invalid').searchParams.getAll('dealer'),['dragan','astrid']);
  assert.equal(studioLoginReturnTo(target),'/admin');
  const rooms=adminDocumentHref('/control/rooms?table=one&room=two');
  assert.equal(new URL(rooms,'https://site.invalid').pathname,'/admin/companies','an ambiguous room never picks a room nav');
});


test('retired publication bookmark mapping preserves fragments and rejects document redirects for writes',()=>{
  for(const nativeStudio of [false,true])for(const prefix of ['/control','/studio/control']){
    const config={nativeStudio,publicOrigin:'https://site.invalid',labUiOrigin:'https://lab.invalid',backendOrigin:'https://engine.invalid'};
    const url=new URL('https://site.invalid'+prefix+'/rooms?operator=north&table=room-1&lane=portrait#review');
    assert.equal(platformRoute(url,config,new Request(url)).destination,'https://site.invalid/admin/rooms/room-1?operator=north#review');
    for(const options of [{method:'POST',body:'fixture'},{headers:{'next-action':'fixture'}}])assert.notEqual(platformRoute(url,config,new Request(url,options)).kind,'redirect');
    for(const path of ['/studio/api/admin/operator-package','/control/login','/control/set-password'])assert.notEqual(platformRoute(new URL(path,url),config).kind,'redirect');
  }
  // The retired Admin page itself: GET/HEAD follow to the room nav with its company and fragment; writes never redirect.
  for(const prefix of ['/admin','/studio/admin']){
    const config={nativeStudio:true,publicOrigin:'https://site.invalid',labUiOrigin:'https://lab.invalid',backendOrigin:'https://engine.invalid'};
    const url=new URL('https://site.invalid'+prefix+'/publication?operator=north&table=room-1&lane=portrait#review');
    for(const method of ['GET','HEAD'])assert.deepEqual(platformRoute(url,config,new Request(url,{method})),{kind:'redirect',destination:'https://site.invalid/admin/rooms/room-1?operator=north#review'});
    for(const options of [{method:'POST',body:'fixture'},{method:'PUT',body:'fixture'},{method:'DELETE'},{headers:{'next-action':'fixture'}}])assert.notEqual(platformRoute(url,config,new Request(url,options)).kind,'redirect');
  }
  for(const path of ['/admin/publication/','/admin/publications','/admin/publication-extra'])assert.equal(adminDocumentHref(path),path);
});

test('retired tool bookmarks retain exact context and never redirect mutations',()=>{
  const context='event=idle.ready&variant=take-2&situation=dealer-hole&category=greeting';
  for(const [section,target] of [['guide','/admin/guide?operator=north&table=room-1&dealer=saga&'+context+'&composition=portrait'],
    ['videos','/admin/dealers/saga?flik=klipp&operator=north&table=room-1&'+context+'&composition=portrait'],['probe','/admin/dealers/saga?flik=tal&operator=north&table=room-1&'+context+'&composition=portrait'],
    ['replies','/admin/dealers/saga?flik=tal&operator=north&table=room-1&'+context+'&composition=portrait'],['events','/admin/dealers/saga?flik=klipp&operator=north&table=room-1&'+context+'&composition=portrait'],
    ['tree','/admin/dealers/saga?flik=klipp&operator=north&table=room-1&'+context+'&composition=portrait'],['compositions','/admin/scenes?tab=mallar&operator=north&table=room-1&dealer=saga&'+context+'&composition=portrait'],
    ['rehearsal','/admin/rooms/room-1?operator=north&'+context],['preview','/admin/scenes?tab=mallar&operator=north&table=room-1&dealer=saga&'+context+'&composition=portrait'],
    ['zones','/admin/scenes?tab=mallar&operator=north&table=room-1&dealer=saga&'+context+'&composition=portrait']])for(const nativeStudio of [false,true])for(const prefix of ['/control','/studio/control']){
    const config={nativeStudio,publicOrigin:'https://site.invalid',labUiOrigin:'https://lab.invalid',backendOrigin:'https://engine.invalid'};
    const url=new URL('https://site.invalid'+prefix+'/'+section+'?operator=north&table=room-1&lane=portrait&dealer=saga&'+context+'#selected');
    for(const method of ['GET','HEAD'])assert.equal(platformRoute(url,config,new Request(url,{method})).destination,'https://site.invalid'+target+'#selected',section);
    for(const options of [{method:'POST',body:'fixture'},{method:'PUT',body:'fixture'},{method:'DELETE'},{headers:{'next-action':'fixture'}}])assert.notEqual(platformRoute(url,config,new Request(url,options)).kind,'redirect');
  }
});

test('merged dependency bookmarks redirect to System › Beroenden with their selection and never for writes',()=>{
  for(const prefix of ['/admin','/studio/admin'])for(const page of ['deletion','structure']){
    const source=prefix+'/'+page+'?operator=north&table=room-1&lane=portrait&dealer=saga#resource-room-726f6f6d2d31';
    const target=adminDocumentHref(source);
    assert.equal(target,'/admin/system?flik=beroenden&operator=north&table=room-1&dealer=saga&composition=portrait#resource-room-726f6f6d2d31');
    assert.equal(studioLoginReturnTo(prefix+'/'+page+'?operator=north&table=room-1'),'/admin/system?flik=beroenden&operator=north&table=room-1');
    assert.ok(designPreviewPages.has(page),'the retired path stays listed so the server can redirect it');
    const config={nativeStudio:true,publicOrigin:'https://site.invalid',labUiOrigin:'https://lab.invalid',backendOrigin:'https://engine.invalid'};
    const url=new URL('https://site.invalid'+source);
    for(const method of ['GET','HEAD'])assert.deepEqual(platformRoute(url,config,new Request(url,{method})),{kind:'redirect',destination:'https://site.invalid'+target});
    for(const options of [{method:'POST',body:'fixture'},{headers:{'next-action':'fixture'}}])assert.notEqual(platformRoute(url,config,new Request(url,options)).kind,'redirect');
  }
  for(const path of ['/admin/deletion/','/admin/deletions','/admin/deletion-extra','/admin/system?flik=beroenden&operator=north'])assert.equal(adminDocumentHref(path),path);
});

// Every retired Admin page (ADMIN-KARTA "Pensionerade adresser") lands on its menu page and tab in one redirect,
// with company, room, dealer, revision and fragment kept. API keys stay global until step F, so /admin/admin/api
// opens System › Integration rather than a company tab.
test('every retired Admin page lands on its new tab with its context in one redirect',()=>{
  const context='operator=north&room=room-1&revision=r7';
  const cases=[
    ['/admin/clips','/admin/dealers'],['/admin/clips?dealer=saga','/admin/dealers/saga?flik=klipp'],
    ['/admin/clips?dealer=saga&panel=room','/admin/dealers/saga?flik=tal'],['/admin/clips?dealer=saga&panel=dealer','/admin/dealers/saga?flik=installningar'],
    ['/admin/clips?dealer=saga&panel=intake','/admin/dealers/saga?flik=klipp&panel=intake'],['/admin/clips?dealer=saga&tool=import','/admin/dealers/saga?flik=klipp&tool=import'],
    ['/admin/clips?dealer=saga&panel=layers','/admin/scenes?tab=mallar&dealer=saga'],
    ['/admin/replies?dealer=saga','/admin/dealers/saga?flik=tal'],['/admin/replies','/admin/dealers'],
    ['/admin/dealer-agent?dealer=saga','/admin/dealers/saga?flik=tal&verktyg=dialog'],
    ['/admin/dealer-studio?view=generate&dealer=saga','/admin/dealers/saga?flik=klipp&panel=generera'],['/admin/dealer-studio?dealer=saga','/admin/dealers/saga?flik=klipp'],
    ['/admin/assets','/admin/scenes?tab=bordsgrafik'],['/admin/assets?tab=tables','/admin/scenes?tab=bordsgrafik'],['/admin/assets?tab=backgrounds','/admin/scenes?tab=bakgrunder'],
    ['/admin/rooms','/admin/companies?tab=spelbord'],['/admin/rooms?operator=north','/admin/companies?tab=spelbord&operator=north'],
    ['/admin/rooms?operator=north&room=room-1','/admin/rooms/room-1?operator=north'],['/admin/rooms?operator=north&table=room-1&composition=portrait&game=blackjack','/admin/rooms/room-1?operator=north'],
    ['/admin/players','/admin/system?flik=spelare'],['/admin/ekonomi','/admin/system?flik=spelare'],['/admin/admin/payments','/admin/system?flik=spelare'],['/admin/admin/players','/admin/system?flik=spelare'],
    ['/admin/admin/api','/admin/system?flik=integration'],['/admin/admin/accounts','/admin/system?flik=personal'],
    ['/admin/drift','/admin/system?flik=drift'],['/admin/drift?tab=speech','/admin/dealers'],['/admin/drift?tab=speech&dealer=saga','/admin/dealers/saga?flik=tal'],
    ['/admin/ai/models','/admin/system?flik=agenter'],['/admin/openclaw','/admin/dealers'],['/admin/openclaw?tab=models','/admin/system?flik=agenter'],['/admin/openclaw?tab=agent&dealer=saga','/admin/dealers/saga?flik=tal&verktyg=dialog'],
    ['/admin/structure','/admin/system?flik=beroenden'],['/admin/deletion','/admin/system?flik=beroenden'],
    ['/admin/tools','/admin/dealers'],['/admin/admin/log','/admin/companies'],['/admin/ai/chat','/admin'],['/admin/admin/operators','/admin/companies'],
    ['/admin/material-library','/admin/scenes?tab=bordsgrafik'],['/admin/compositions','/admin/scenes?tab=mallar'],['/admin/media-review?dealer=saga','/admin/dealers/saga?flik=tal'],
  ];
  for(const [source,target] of cases)for(const prefix of ['','/studio']){
    assert.equal(adminDocumentHref(prefix+source),target,source);
    // With a company and a room in the address, the room list becomes that room's nav and the company list that company's nav.
    const roomList=target.startsWith('/admin/companies?tab=spelbord'),companyList=target==='/admin/companies';
    const expected=new URL(roomList?'/admin/rooms/room-1':companyList?'/admin/companies/north':target,'https://site.invalid');
    const url=new URL(adminDocumentHref(prefix+source+(source.includes('?')?'&':'?')+context+'#here'),'https://site.invalid');
    assert.equal(url.pathname,expected.pathname,source+' keeps its page with context');
    for(const [key,value] of expected.searchParams)assert.equal(url.searchParams.get(key),value,source+' '+key);
    if(!companyList)assert.equal(url.searchParams.get('operator'),'north',source+' keeps the company');
    if(!/^\/admin\/rooms\//.test(url.pathname))assert.equal(url.searchParams.get('room'),'room-1',source+' keeps the room');
    assert.equal(url.searchParams.get('revision'),'r7',source+' keeps the revision');assert.equal(url.hash,'#here',source+' keeps the fragment');
    const once=url.pathname+url.search+url.hash;assert.equal(adminDocumentHref(once),once,source+' needs one redirect');
    if(url.pathname!=='/admin')assert.ok(isDesignPreviewPage(url.pathname.slice(7)),once+' is a served page');
  }
});

test('retired Admin editors redirect once to the owned panel with complete context',()=>{
  for(const [source,target] of [['/admin/dealer-studio?view=speech','/admin/dealers/saga?flik=tal'],['/admin/dealer-studio?view=settings','/admin/dealers/saga?flik=installningar'],
    ['/admin/videos?view=clips','/admin/dealers/saga?flik=klipp'],['/admin/compositions?view=preview','/admin/scenes?tab=mallar'],['/admin/probe?view=probe','/admin/dealers/saga?flik=tal'],
    ['/admin/rehearsal?view=log','/admin/companies?tab=spelbord'],['/admin/events?event=deal.player.left','/admin/dealers/saga?flik=klipp']]){
    for(const prefix of ['', '/studio']){
      const href=adminDocumentHref(prefix+source+'&dealer=saga&operator=north&room=one&room=two&lane=portrait#selection');
      const url=new URL(href,'https://site.invalid'),expected=new URL(target,'https://site.invalid');
      assert.equal(url.pathname,expected.pathname,source);
      for(const key of ['flik','tab'])assert.equal(url.searchParams.get(key),expected.searchParams.get(key),source+' '+key);
      if(!url.pathname.startsWith('/admin/dealers/'))assert.equal(url.searchParams.get('dealer'),'saga',source);
      assert.deepEqual(url.searchParams.getAll('room'),['one','two'],'two rooms stay ambiguous: '+source);
      assert.equal(url.searchParams.get('composition'),'portrait');assert.equal(url.hash,'#selection');assert.equal(adminDocumentHref(href),href);
      const config={nativeStudio:true,publicOrigin:'https://site.invalid'},old=new URL(prefix+source,'https://site.invalid');
      for(const method of ['POST','PUT','DELETE'])assert.notEqual(platformRoute(old,config,new Request(old,{method})).kind,'redirect');
    }
  }
});
