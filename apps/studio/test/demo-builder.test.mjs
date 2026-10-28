import test from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_KEY_SCOPES,DEMO_STEPS,DemoError,chooseCompany,chooseDealer,chooseRoom,creditDemo,demoCompanies,demoCreditReceipt,demoCredits,demoDealers,demoDisplayName,demoErrorMessage,demoKeyName,demoLaunchLink,demoPermissions,demoReceipt,demoRooms,
  editDemo,expiryText,goToStep,initialDemoState,launchDemo,nextLabel,nextStep,previousStep,reachableStep,readCreditAmount,readDemoCatalog,revokeDemoKey,stepRequirement} from '../client/admin/lib/demo-builder.mjs';
import {approvedPartnerLaunchUrl} from '../lib/partner-launch-url.mjs';
import {designPreviewPages,designPreviewReturnTo} from '../lib/design-preview-paths.mjs';
import {meetsStudioAdminActionRole,studioAdminActionPolicy} from '../lib/studio-access-policy.mjs';

const ORIGIN='https://game.fixture.invalid';
const catalog=()=>({schemaVersion:1,source:'registered',readAt:'2026-10-28T10:00:00.000Z',administration:{revisions:{project:'p1',administration:'a1'},
  operators:[
    {id:'op-johns',slug:'johns-bet',name:'Johns Bet',status:'active',packageRevision:11,archivedAt:null},
    {id:'op-acme',slug:'acme-play',name:'Acme Play',status:'active',packageRevision:null,archivedAt:null},
    {id:'op-old',slug:'old-casino',name:'Old Casino',status:'active',packageRevision:3,archivedAt:'2026-10-01T00:00:00.000Z'},
    {id:'op-paused',slug:'paused-bets',name:'Paused Bets',status:'suspended',packageRevision:2,archivedAt:null},
  ],
  rooms:[
    {id:'room-paow',name:'PAOW Blackjack',operatorId:'op-johns',game:'blackjack',state:'live',published:true,playable:true,dealerIds:['paow'],dealers:[{id:'paow',name:'PAOW'}],playUrl:'/play/blackjack?operator=johns-bet&table=room-paow'},
    {id:'room-duo',name:'Två dealers',operatorId:'op-johns',game:'blackjack',state:'live',published:true,playable:true,dealerIds:['paow','dragan'],dealers:[{id:'paow',name:'PAOW'},{id:'dragan',name:'Dragan'}],playUrl:'/play/blackjack?operator=johns-bet&table=room-duo'},
    {id:'room-paused',name:'Pausat bord',operatorId:'op-johns',game:'blackjack',state:'pending',published:true,playable:false,dealerIds:['paow'],dealers:[{id:'paow',name:'PAOW'}],playUrl:null},
    {id:'room-draft',name:'Opublicerat',operatorId:'op-johns',game:'blackjack',state:'live',published:false,playable:false,dealerIds:['dragan'],dealers:[{id:'dragan',name:'Dragan'}],playUrl:null},
    {id:'room-roulette',name:'Roulette',operatorId:'op-johns',game:'roulette',state:'live',published:true,playable:true,dealerIds:['paow'],dealers:[{id:'paow',name:'PAOW'}],playUrl:'/play/roulette?operator=johns-bet&table=room-roulette'},
    {id:'room-gone',name:'Arkiverat',operatorId:'op-johns',game:'blackjack',state:'archived',published:false,playable:false,dealerIds:[],dealers:[],playUrl:null},
  ],
  dealers:[{id:'paow',name:'PAOW',archived:false},{id:'dragan',name:'Dragan',archived:false},{id:'viktor',name:'Viktor',archived:false},{id:'astrid',name:'Astrid',archived:true}],
  compositions:[]}});
const administration=()=>readDemoCatalog(catalog());
const adminSession=()=>({username:'jakob',role:'admin',gameOrigin:ORIGIN,availableActions:['GET apikeys','GET room-game-config','POST apikeys/create','POST apikeys/launch','POST apikeys/credit','POST apikeys/revoke']});
// Admin-servern projicerar launch-svaret (#516): bara ok, url, playerId, playerRef, balance, currency och expiresIn når webbläsaren.
const launchPayload=(extra={})=>({ok:true,url:`${ORIGIN}/game?launch=aaa.bbb.ccc`,playerRef:'p-77',playerId:'test-1a2b3c',balance:1000,currency:'EUR',expiresIn:21600,...extra});

test('steps: each step demands its choice, names the next step and never skips ahead',()=>{
  let state=initialDemoState();
  assert.equal(DEMO_STEPS.map(step=>step.label).join(' → '),'Bolag → Spelbord → Dealer → Lansera');
  assert.deepEqual(stepRequirement(state),{ready:false,missing:'Välj ett bolag.'});
  assert.equal(nextLabel(1),'Nästa: Välj spelbord');
  assert.equal(nextStep(state).step,1,'Nästa är inaktiv tills ett bolag valts');
  assert.equal(goToStep(state,3).step,1,'stegraden kan inte hoppa förbi ovalda steg');
  state=chooseCompany(state,'op-johns');
  assert.equal(stepRequirement(state).ready,true);
  state=nextStep(state);assert.equal(state.step,2);
  assert.deepEqual(stepRequirement(state),{ready:false,missing:'Välj ett spelbart spelbord.'});
  assert.equal(nextLabel(2),'Nästa: Välj dealer');
  const rooms=demoRooms(administration(),'op-johns');
  state=chooseRoom(state,rooms.find(room=>room.id==='room-paow'));
  assert.equal(state.dealerId,'paow','ett spelbord med en dealer ger dealern direkt');
  assert.equal(reachableStep(state),4);
  state=chooseRoom(state,rooms.find(room=>room.id==='room-duo'));
  assert.equal(state.dealerId,null,'flera dealers kräver ett val');
  assert.equal(reachableStep(state),3);
  state=nextStep(state);assert.equal(state.step,3);
  assert.deepEqual(stepRequirement(state),{ready:false,missing:'Välj en dealer.'});
  assert.equal(nextLabel(3),'Nästa: Lansera');
  state=nextStep(chooseDealer(state,'dragan'));assert.equal(state.step,4);
  assert.deepEqual(stepRequirement(state),{ready:false,missing:'Ge demon ett namn.'});
  assert.equal(nextLabel(4),'Skapa demolänk');
  state=editDemo(state,'name','Demo Johns Bet');
  assert.equal(stepRequirement(state).ready,true);
  assert.equal(stepRequirement(editDemo(state,'displayName','x'.repeat(41))).ready,false,'visningsnamn över 40 tecken stoppar');
  assert.equal(stepRequirement(editDemo(state,'displayName','Bad\u0007name')).missing,'Visningsnamnet får vara högst 40 tecken utan styrtecken.');
  assert.equal(editDemo(state,'currency','GBP').form.currency,'EUR','okänd valuta ignoreras');
  assert.equal(editDemo(state,'language','de').form.language,'en','okänt språk ignoreras');
  assert.equal(previousStep(state).step,3);
  const changed=chooseCompany(goToStep(state,1),'op-acme');
  assert.deepEqual([changed.step,changed.roomId,changed.dealerId],[1,null,null],'Ändra bolag nollställer spelbord och dealer');
  assert.equal(reachableStep(changed),2);
});

test('catalog: only active companies, playable live blackjack rooms and the room\'s published dealers are selectable',()=>{
  const view=administration();
  assert.deepEqual(demoCompanies(view).map(row=>[row.slug,row.rooms,row.playable,row.packageRevision]),[['acme-play',0,0,null],['johns-bet',5,3,11]]);
  const rooms=demoRooms(view,'op-johns');
  assert.deepEqual(rooms.map(row=>[row.id,row.selectable]),[['room-paow',true],['room-duo',true],['room-paused',false],['room-draft',false],['room-roulette',false]]);
  assert.match(rooms.find(row=>row.id==='room-paused').reason,/pausat/);
  assert.match(rooms.find(row=>row.id==='room-draft').reason,/publicerade paket/);
  assert.match(rooms.find(row=>row.id==='room-roulette').reason,/bara blackjack/);
  const dealers=demoDealers(view,rooms.find(row=>row.id==='room-paow'));
  assert.deepEqual(dealers.selectable,[{id:'paow',name:'PAOW'}]);
  assert.deepEqual(dealers.others.map(row=>row.id),['dragan','viktor'],'arkiverade dealers och paketets dealers listas inte som "fler"');
  assert.deepEqual(demoDealers(view,null),{selectable:[],others:[{id:'dragan',name:'Dragan'},{id:'paow',name:'PAOW'},{id:'viktor',name:'Viktor'}]});
  assert.throws(()=>readDemoCatalog({schemaVersion:2}),DemoError);
  assert.throws(()=>readDemoCatalog({schemaVersion:1,source:'fixture',administration:{operators:[],rooms:[],dealers:[],compositions:[]}}),DemoError);
});

test('link: the engine address must be the approved game start; company, room and dealer are appended',()=>{
  const context={gameOrigin:ORIGIN,operatorSlug:'johns-bet',roomId:'room-paow',dealerId:'paow'};
  assert.equal(demoLaunchLink(launchPayload(),context),`${ORIGIN}/game?launch=aaa.bbb.ccc&operator=johns-bet&table=room-paow&dealer=paow`);
  assert.equal(demoLaunchLink(launchPayload(),{...context,dealerId:null}),`${ORIGIN}/game?launch=aaa.bbb.ccc&operator=johns-bet&table=room-paow`);
  assert.equal(demoLaunchLink(launchPayload({url:`${ORIGIN}/blackjack?dealer=astrid&launch=aaa.bbb.ccc`}),context),`${ORIGIN}/blackjack?launch=aaa.bbb.ccc&operator=johns-bet&table=room-paow&dealer=paow`,'en äldre dealer=astrid-adress ersätts med vald dealer');
  for (const url of ['https://evil.invalid/game?launch=aaa.bbb.ccc',`http://${ORIGIN.slice(8)}/game?launch=aaa.bbb.ccc`,`${ORIGIN}/lobby?launch=aaa.bbb.ccc`,`${ORIGIN}/game?launch=aaa.bbb.ccc&returnTo=x`,`${ORIGIN}/game?launch=not-a-token`,`${ORIGIN}/game`,`${ORIGIN}/game?launch=aaa.bbb.ccc#x`]) {
    assert.throws(()=>demoLaunchLink(launchPayload({url}),context),/godkända speladressen/,url);
  }
  assert.throws(()=>demoLaunchLink({ok:false,url:`${ORIGIN}/game?launch=aaa.bbb.ccc`},context),/bekräftade inte/);
  assert.throws(()=>demoLaunchLink(launchPayload(),{...context,gameOrigin:null}),/godkända speladressen/);
  assert.throws(()=>demoLaunchLink(launchPayload(),{...context,operatorSlug:'Johns Bet'}),/ogiltigt id/);
  assert.throws(()=>demoLaunchLink(launchPayload(),{...context,dealerId:'vera'}),/ogiltigt id/,'pensionerade dealer-id:n avvisas');
  assert.deepEqual(demoReceipt(launchPayload({balance:-1,currency:'GBP',expiresIn:'6h',playerRef:'bad\u0000ref'})),{playerRef:null,playerId:'test-1a2b3c',balance:null,currency:null,expiresIn:null});
  assert.equal(expiryText(21600),'6 timmar');assert.equal(expiryText(3600),'1 timme');assert.equal(expiryText(900),'15 minuter');assert.equal(expiryText(null),'okänd tid');
});

test('permissions: the wrong role is refused by the server policy and the page says it needs admin',()=>{
  assert.equal(studioAdminActionPolicy('apikeys/launch').minimumRole,'admin');
  assert.equal(studioAdminActionPolicy('apikeys/create').minimumRole,'admin');
  assert.equal(meetsStudioAdminActionRole('admin','apikeys/launch'),true);
  for (const role of ['staff','partner','viewer',null,undefined]) assert.equal(meetsStudioAdminActionRole(role,'apikeys/launch'),false,String(role));
  const admin=demoPermissions(adminSession());
  assert.deepEqual(admin,{gameOrigin:ORIGIN,canCreate:true,canLaunch:true,canCredit:true,canRevoke:true,canReadConfig:true,blocker:''});
  const limited=demoPermissions({...adminSession(),availableActions:['GET apikeys','GET room-game-config']});
  assert.equal(limited.canLaunch,false);assert.equal(limited.canCredit,false);assert.match(limited.blocker,/rollen admin/);
  assert.equal(studioAdminActionPolicy('apikeys/credit').minimumRole,'admin');
  for (const role of ['staff','partner','viewer',null]) assert.equal(meetsStudioAdminActionRole(role,'apikeys/credit'),false,String(role));
  const noOrigin=demoPermissions({...adminSession(),gameOrigin:'http://game.fixture.invalid'});
  assert.equal(noOrigin.canLaunch,false);assert.equal(noOrigin.gameOrigin,null);assert.match(noOrigin.blocker,/adress saknas/);
  assert.equal(demoPermissions(null).canLaunch,false);
  assert.match(demoErrorMessage('launch',403,null),/^Testsessionen kunde inte startas: .*rollen admin/);
  assert.match(demoErrorMessage('create',409,null),/^Nyckeln kunde inte skapas: .*Läs in sidan/);
  assert.equal(demoErrorMessage('launch',503,{code:'studio_presentation_runtime_update_required'}),'Testsessionen kunde inte startas: spelmotorn eller nyckeltjänsten är tillfälligt otillgänglig. Inget skapades lokalt. (studio_presentation_runtime_update_required)');
  assert.equal(demoErrorMessage('revoke',503,{code:'<script>'}).includes('<'),false,'okända koder visas inte');
});

test('credits: the refill is read from the published limit preset, never invented',()=>{
  assert.deepEqual(demoCredits({ok:true,operatorId:'op-johns',roomId:'room-paow',published:{configVersion:'v9',gameConfig:{language:'sv',limitPreset:'casual'}},draft:null}),{preset:'casual',label:'Casual',refill:500,language:'sv',configVersion:'v9'});
  assert.equal(demoCredits({ok:true,published:{configVersion:'v1',gameConfig:{language:'en',limitPreset:'prive'}}}).refill,1000);
  assert.equal(demoCredits({ok:true,published:{configVersion:'v1',gameConfig:{language:'en',limitPreset:'high'}}}).refill,50000);
  assert.equal(demoCredits({ok:true,published:null}),null);
  assert.equal(demoCredits(null),null);
});

test('demo key: minimal scopes, a demo- name and purpose demo; never wallet, history, lobby or events',()=>{
  assert.deepEqual([...DEMO_KEY_SCOPES],['launch','play']);
  assert.equal(Object.isFrozen(DEMO_KEY_SCOPES),true);
  for (const scope of ['wallet','history','lobby','events']) assert.equal(DEMO_KEY_SCOPES.includes(scope),false,scope);
  const form=name=>({name,displayName:'',language:'en',currency:'EUR'});
  assert.equal(demoKeyName(form(' Johns Bet ')),'demo-Johns Bet');
  assert.equal(demoKeyName(form('Demo- Acme Play')),'demo-Acme Play','ett inskrivet prefix dubbleras inte');
  assert.equal(demoKeyName(form('demo-')),'');
  assert.equal(demoDisplayName(form('demo-Johns Bet')),'Johns Bet','visningsnamnet får inte nyckelns prefix');
  let ready=nextStep(chooseCompany(initialDemoState(),'op-johns'));
  ready=nextStep(nextStep(chooseRoom(ready,demoRooms(administration(),'op-johns')[0])));
  assert.equal(ready.step,4);
  assert.equal(stepRequirement(editDemo(ready,'name','demo-')).missing,'Ge demon ett namn.');
  assert.equal(stepRequirement(editDemo(ready,'name','x'.repeat(75))).ready,false,'utan visningsnamn blir 75 tecken ett för långt visningsnamn');
  assert.equal(stepRequirement(editDemo(editDemo(ready,'name','x'.repeat(75)),'displayName','X')).ready,true,'demo- plus 75 tecken ryms i nyckelns 80');
  assert.equal(stepRequirement(editDemo(ready,'name','x'.repeat(76))).missing,'Demons namn får vara högst 75 tecken.');
  assert.equal(stepRequirement(editDemo(editDemo(ready,'name','Bad\u0007name'),'displayName','X')).missing,'Demons namn får inte innehålla styrtecken.');
});

test('launch: creates a demo key that the server answers without key or secret, launches on it and keeps no credential',async()=>{
  const calls=[];
  const fetchImpl=async(url,init)=>{
    calls.push({url,method:init.method,body:JSON.parse(init.body),origin:init.credentials});
    if(url.endsWith('/apikeys/create'))return new Response(JSON.stringify({ok:true,key:{id:'key-1',name:'demo-Johns Bet'}}),{status:200});
    if(url.endsWith('/apikeys/launch'))return new Response(JSON.stringify(launchPayload()),{status:200});
    throw new Error('unexpected '+url);
  };
  const phases=[];
  const result=await launchDemo({fetchImpl,form:{name:' Johns Bet ',displayName:'',language:'sv',currency:'SEK'},permissions:demoPermissions(adminSession()),operatorSlug:'johns-bet',roomId:'room-paow',dealerId:'paow',onPhase:phase=>phases.push(phase)});
  assert.deepEqual(phases,['create','launch']);
  assert.deepEqual(calls.map(call=>[call.url,call.method,call.body]),[
    ['/studio/api/admin/apikeys/create','POST',{name:'demo-Johns Bet',scopes:['launch','play'],purpose:'demo'}],
    ['/studio/api/admin/apikeys/launch','POST',{id:'key-1',displayName:'Johns Bet',currency:'SEK',language:'sv'}],
  ]);
  assert.ok(calls.every(call=>call.origin==='same-origin'));
  assert.deepEqual(result.key,{id:'key-1',name:'demo-Johns Bet'});
  // Även en server som felaktigt skickar med nyckel och hemlighet får dem aldrig vidare.
  const leaky=async url=>url.endsWith('/apikeys/create')?new Response(JSON.stringify({ok:true,key:{id:'key-9',name:'demo-Johns Bet',key:'ck_live_'+'k'.repeat(24),secret:'cs_'+'x'.repeat(43)}}),{status:200}):new Response(JSON.stringify(launchPayload()),{status:200});
  const kept=await launchDemo({fetchImpl:leaky,form:{name:'Johns Bet',displayName:'',language:'en',currency:'EUR'},permissions:demoPermissions(adminSession()),operatorSlug:'johns-bet',roomId:'room-paow',dealerId:'paow'});
  assert.deepEqual(kept.key,{id:'key-9',name:'demo-Johns Bet'});
  for (const value of [result,kept]) {assert.equal(JSON.stringify(value).includes('cs_'),false);assert.equal(JSON.stringify(value).includes('ck_live'),false);}
  assert.equal(result.link,`${ORIGIN}/game?launch=aaa.bbb.ccc&operator=johns-bet&table=room-paow&dealer=paow`);
  assert.deepEqual(result.receipt,{playerRef:'p-77',playerId:'test-1a2b3c',balance:1000,currency:'EUR',expiresIn:21600});
});

test('launch: server errors are readable and a key created before a failed launch travels with the error',async()=>{
  const forbidden=async()=>new Response(JSON.stringify({error:'Access denied'}),{status:403});
  await assert.rejects(launchDemo({fetchImpl:forbidden,form:{name:'Demo',displayName:'',language:'en',currency:'EUR'},permissions:demoPermissions(adminSession()),operatorSlug:'johns-bet',roomId:'room-paow',dealerId:'paow'}),
    error=>error instanceof DemoError&&error.status===403&&/Nyckeln kunde inte skapas: .*rollen admin/.test(error.message)&&error.key===undefined);
  const engineDown=async url=>url.endsWith('/apikeys/create')?new Response(JSON.stringify({ok:true,key:{id:'key-2',name:'Demo'}}),{status:200}):new Response(JSON.stringify({error:'Action unavailable'}),{status:503});
  await assert.rejects(launchDemo({fetchImpl:engineDown,form:{name:'Demo',displayName:'',language:'en',currency:'EUR'},permissions:demoPermissions(adminSession()),operatorSlug:'johns-bet',roomId:'room-paow',dealerId:'paow'}),
    error=>error.status===503&&/Testsessionen kunde inte startas: spelmotorn/.test(error.message)&&error.key.id==='key-2');
  const foreign=async url=>url.endsWith('/apikeys/create')?new Response(JSON.stringify({ok:true,key:{id:'key-3',name:'Demo'}}),{status:200}):new Response(JSON.stringify(launchPayload({url:'https://evil.invalid/game?launch=aaa.bbb.ccc'})),{status:200});
  await assert.rejects(launchDemo({fetchImpl:foreign,form:{name:'Demo',displayName:'',language:'en',currency:'EUR'},permissions:demoPermissions(adminSession()),operatorSlug:'johns-bet',roomId:'room-paow',dealerId:'paow'}),/godkända speladressen/);
  const revoked=[];
  await revokeDemoKey({fetchImpl:async(url,init)=>{revoked.push([url,JSON.parse(init.body)]);return new Response(JSON.stringify({ok:true,authority:'render'}),{status:200});},keyId:'key-2'});
  assert.deepEqual(revoked,[['/studio/api/admin/apikeys/revoke',{id:'key-2'}]]);
  await assert.rejects(revokeDemoKey({fetchImpl:async()=>new Response(JSON.stringify({error:'Conflict'}),{status:409}),keyId:'key-2'}),/Nyckeln kunde inte återkallas/);
});

// Samma matris som Integrationers projektion: demon godtar exakt de adresser som
// lib/partner-launch-url.mjs godtar och bygger då länken på den adressen.
const LAUNCH_URLS=[`${ORIGIN}/game?launch=a.b.c`,`${ORIGIN}/blackjack?launch=a.b.c`,`${ORIGIN}/game?dealer=astrid&launch=a.b.c`,`${ORIGIN}/game?launch=a.b.c&dealer=dragan`,
  `${ORIGIN}/game?dealer=Wrong&launch=a.b.c`,`${ORIGIN}/game?dealer=&launch=a.b.c`,`${ORIGIN}/game?operator=north&launch=a.b.c`,`${ORIGIN}/game?launch=a.b.c&launch=a.b.c`,
  `${ORIGIN}/game?dealer=astrid&dealer=astrid&launch=a.b.c`,`${ORIGIN}/game?launch=bad`,`${ORIGIN}/game?launch=a.b.c#x`,`${ORIGIN}/game`,`${ORIGIN}/lobby?launch=a.b.c`,
  'http://game.fixture.invalid/game?launch=a.b.c','https://user:pw@game.fixture.invalid/game?launch=a.b.c','https://evil.invalid/game?launch=a.b.c',
  'https://game.fixture.invalid:8443/game?launch=a.b.c',`${ORIGIN}/game?launch=${'a'.repeat(16400)}.b.c`,'not a url'];
test('link: the demo applies Integrationer\'s launch-address rule from lib/partner-launch-url.mjs',()=>{
  const context={gameOrigin:ORIGIN,operatorSlug:'johns-bet',roomId:'room-paow',dealerId:'paow'};
  let accepted=0;
  for (const url of LAUNCH_URLS) {
    const approved=approvedPartnerLaunchUrl(url,ORIGIN);
    if(approved){accepted++;assert.equal(demoLaunchLink(launchPayload({url}),context),`${approved.origin}${approved.pathname}?launch=a.b.c&operator=johns-bet&table=room-paow&dealer=paow`,url);}
    else assert.throws(()=>demoLaunchLink(launchPayload({url}),context),/godkända speladressen/,url);
  }
  assert.equal(accepted,4);
  for (const origin of [`${ORIGIN}/`,'http://game.fixture.invalid',undefined,null,'']) assert.equal(approvedPartnerLaunchUrl(`${ORIGIN}/game?launch=a.b.c`,origin),null,String(origin));
  assert.equal(approvedPartnerLaunchUrl(['https://game.fixture.invalid/game?launch=a.b.c'],ORIGIN),null,'bara en sträng är en adress');
});

test('top-up: the amount is checked first, the credit goes to the receipt\'s demo player and the saldo after is read honestly',async()=>{
  assert.deepEqual(readCreditAmount('500'),{amount:500,missing:''});
  assert.deepEqual(readCreditAmount(' 1 000,50 '),{amount:1000.5,missing:''});
  assert.equal(readCreditAmount('100000').amount,100000);
  for (const [value,missing] of [['','Ange ett belopp.'],['0','Beloppet måste vara större än 0.'],['0,00','Beloppet måste vara större än 0.'],
    ['-5','Beloppet ska vara ett tal med högst två decimaler.'],['1e3','Beloppet ska vara ett tal med högst två decimaler.'],['12.345','Beloppet ska vara ett tal med högst två decimaler.'],
    ['abc','Beloppet ska vara ett tal med högst två decimaler.'],['100000.01','Högst 100 000 per påfyllning.'],['2000000','Högst 100 000 per påfyllning.']]) {
    assert.deepEqual(readCreditAmount(value),{amount:null,missing},value);
  }
  const calls=[];
  const ok=async(url,init)=>{calls.push([url,init.method,JSON.parse(init.body)]);return new Response(JSON.stringify({ok:true,authority:'render',playerId:'test-1a2b3c',balance:1500,currency:'EUR'}),{status:200});};
  assert.deepEqual(await creditDemo({fetchImpl:ok,keyId:'key-1',playerId:'test-1a2b3c',amount:500}),{balance:1500,currency:'EUR'});
  assert.deepEqual(calls,[['/studio/api/admin/apikeys/credit','POST',{id:'key-1',playerId:'test-1a2b3c',amount:500}]]);
  // Saknas saldot för just den spelaren visar sidan "skickat" i stället för en påhittad siffra.
  const noBalance=async()=>new Response(JSON.stringify({ok:true}),{status:200});
  assert.deepEqual(await creditDemo({fetchImpl:noBalance,keyId:'key-1',playerId:'test-1a2b3c',amount:5}),{balance:null,currency:null});
  assert.deepEqual(demoCreditReceipt({ok:true,playerId:'other',balance:9,currency:'EUR'},'test-1a2b3c'),{balance:null,currency:null});
  assert.deepEqual(demoCreditReceipt({ok:true,playerId:'test-1a2b3c',balance:-1,currency:'EUR'},'test-1a2b3c'),{balance:null,currency:null});
  assert.deepEqual(demoCreditReceipt({ok:true,playerId:'test-1a2b3c',balance:12,currency:'GBP'},'test-1a2b3c'),{balance:12,currency:null});
  let fetched=0;const never=async()=>{fetched++;return new Response('{}');};
  for (const input of [{keyId:'key-1',playerId:null,amount:5},{keyId:'',playerId:'p',amount:5},{keyId:'key-1',playerId:'p',amount:0},{keyId:'key-1',playerId:'p',amount:100001},{keyId:'key-1',playerId:'p',amount:Number.NaN}]) {
    await assert.rejects(creditDemo({fetchImpl:never,...input}),DemoError,JSON.stringify(input));
  }
  assert.equal(fetched,0,'ogiltiga påfyllningar når aldrig servern');
  const status=code=>async()=>new Response(JSON.stringify({error:'rejected'}),{status:code});
  const input={keyId:'key-1',playerId:'test-1a2b3c',amount:5};
  await assert.rejects(creditDemo({fetchImpl:status(400),...input}),error=>error.status===400&&error.message==='Demosaldot kunde inte fyllas på: servern avvisade beloppet eller demospelaren.');
  await assert.rejects(creditDemo({fetchImpl:status(403),...input}),error=>error.status===403&&/^Demosaldot kunde inte fyllas på: .*rollen admin/.test(error.message));
  await assert.rejects(creditDemo({fetchImpl:status(409),...input}),error=>error.status===409&&/Läs in sidan igen/.test(error.message));
  await assert.rejects(creditDemo({fetchImpl:status(503),...input}),error=>error.status===503&&/nyckeln är återkallad\. Kontrollera saldot i spelet/.test(error.message));
  await assert.rejects(creditDemo({fetchImpl:async()=>{throw new TypeError('offline');},...input}),/Demosaldot kunde inte fyllas på: svaret kunde inte bekräftas/);
});

test('/admin/demo is a served Admin page and a valid return address',()=>{
  assert.equal(designPreviewPages.has('demo'),true);
  assert.equal(designPreviewReturnTo('/admin/demo'),'/admin/demo');
  assert.equal(designPreviewReturnTo('/studio/admin/demo?operator=johns-bet'),'/admin/demo?operator=johns-bet');
});
