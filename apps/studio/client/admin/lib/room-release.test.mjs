import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import * as release from './room-release.mjs';

const {readRoomRelease,publishRoomRelease,roomReleaseBody,roomReleaseButton,roomReleaseCanPublish,roomReleaseErrorMessage,roomReleaseBlocker,roomReleaseAreas,roomReleaseReceiptText}=release;
const token='a'.repeat(64);
const preview=(patch={})=>({ok:true,operatorId:'north',roomId:'north-a',
  revisions:{package:7,project:'p-1',administration:'a-1',configVersion:null,roomGameConfigDraft:'d-1',brandingDraft:null},
  gameConfig:{language:'sv',limitPreset:'prive'},live:null,candidate:{dealerId:'dragan'},
  changes:[{area:'settings',before:null,after:{language:'sv',limitPreset:'prive'}}],changed:true,
  affectedRooms:[{id:'north-b',name:'Norr B',bound:true,rebinds:false}],ready:true,blockers:[],previewToken:token,...patch});
const receipt=(patch={})=>({ok:true,operatorId:'north',roomId:'north-a',previousPackageRevision:7,packageRevision:8,package_revision:8,
  configVersion:'room-config-1',gameConfig:{language:'sv',limitPreset:'prive'},administrationRevision:'a-2',publishedAt:'2026-10-27T20:14:00.000Z',
  actor:'jakob',changes:[],...patch});
function recorder(responses) {
  const calls=[];
  const fetchImpl=async(url,init)=>{calls.push({url:String(url),init});const next=responses.shift();if(next instanceof Error)throw next;
    return {ok:next.status>=200&&next.status<300,status:next.status,json:async()=>next.body};};
  return {calls,fetchImpl};
}

test('the preview is a GET of room-release with exactly operatorId and roomId and must name the same room',async()=>{
  const {calls,fetchImpl}=recorder([{status:200,body:preview()},{status:200,body:preview({roomId:'north-b'})}]);
  const read=await readRoomRelease({operatorId:'north',roomId:'north-a',fetchImpl});
  assert.equal(read.ok,true);assert.equal(read.preview.previewToken,token);
  const url=new URL(calls[0].url,'https://x.test');
  assert.match(url.pathname,/\/api\/admin\/room-release$/);
  assert.deepEqual([...url.searchParams.keys()].sort(),['operatorId','roomId']);
  assert.equal(calls[0].init.method,'GET');assert.equal(calls[0].init.credentials,'same-origin');
  const other=await readRoomRelease({operatorId:'north',roomId:'north-a',fetchImpl});
  assert.equal(other.ok,false,'a preview for another room is never shown');
});

test('publish sends the preview token and every expected revision once, and verifies the receipt',async()=>{
  const view=preview();
  assert.deepEqual(roomReleaseBody(view),{action:'publish-room',operatorId:'north',roomId:'north-a',gameConfig:{language:'sv',limitPreset:'prive'},
    expectedPackageRevision:7,expectedProjectRevision:'p-1',expectedAdministrationRevision:'a-1',previewToken:token});
  const {calls,fetchImpl}=recorder([{status:200,body:receipt()}]);
  const result=await publishRoomRelease({preview:view,fetchImpl});
  assert.equal(result.ok,true);assert.equal(calls.length,1);
  assert.match(calls[0].url,/\/api\/admin\/operator-package$/);assert.equal(calls[0].init.method,'POST');
  assert.deepEqual(JSON.parse(calls[0].init.body),roomReleaseBody(view));
  assert.match(roomReleaseReceiptText(result.receipt),/^Publicerat · version 8 · 27 okt\S* 21:14 · av jakob$/);
  for(const wrong of [receipt({packageRevision:9,package_revision:9}),receipt({roomId:'north-b'}),receipt({previousPackageRevision:6}),receipt({configVersion:''})]){
    const mismatch=await publishRoomRelease({preview:view,fetchImpl:recorder([{status:200,body:wrong}]).fetchImpl});
    assert.equal(mismatch.ok,false);assert.match(mismatch.error,/kvittot kunde inte bekräftas/);
  }
});

test('the error contract becomes plain Swedish per code, and a failure is never retried automatically',async()=>{
  const cases=[
    [409,{error:'studio_release_preview_stale',code:'studio_release_preview_stale'},'Något har ändrats sedan förhandsvisningen. Läs in igen.'],
    [409,{error:'studio_conflict',code:'studio_conflict',step:'package'},/Bolagets publicering har ändrats.*Inget publicerades.*Läs in igen/],
    [409,{error:'studio_conflict',code:'studio_conflict',step:'room_config_head'},/Spelinställningarna har publicerats från ett annat håll/],
    [409,{error:'studio_room_choices_draft_pending',code:'studio_room_choices_draft_pending'},/opublicerat utseendeutkast/],
    [422,{error:'studio_room_game_material_unavailable',code:'studio_room_game_material_unavailable',materialReason:'native_material_take_unrecognized'},/ingen godkänd tagning.*Röst och tal/],
    [422,{error:'studio_release_invalid',code:'studio_release_invalid',reason:'studio_release_unchanged'},'Inget skiljer sig från live, så inget publicerades.'],
    [404,{error:'studio_room_not_found',code:'studio_room_not_found'},/inte öppet hos bolaget/],
    [503,{error:'studio_room_config_storage_missing',code:'studio_room_config_storage_missing'},/saknar lagringen för spelinställningar/],
    [503,{error:'studio_presentation_runtime_update_required',code:'studio_presentation_runtime_update_required'},/Spelmotorn behöver uppdateras/],
    [503,{error:'studio_media_registry_unavailable',code:'studio_media_registry_unavailable'},/Medieregistret svarar inte/],
    [403,{error:'studio_forbidden'},/saknar behörighet/],
  ];
  for(const [status,body,text] of cases){
    const {calls,fetchImpl}=recorder([{status,body},{status:200,body:receipt()}]);
    const result=await publishRoomRelease({preview:preview(),fetchImpl});
    assert.equal(result.ok,false);assert.equal(result.status,status);
    if(typeof text==='string')assert.equal(result.error,text);else assert.match(result.error,text);
    assert.equal(calls.length,1,'one request per click, no automatic retry');
    assert.doesNotMatch(result.error,/studio_/,'a known code is never shown raw');
  }
  const {calls,fetchImpl}=recorder([new TypeError('network'),{status:200,body:receipt()}]);
  const lost=await publishRoomRelease({preview:preview(),fetchImpl});
  assert.equal(lost.ok,false);assert.match(lost.error,/Läs in igen för att se om publiceringen gick igenom/);assert.equal(calls.length,1);
  assert.equal(roomReleaseErrorMessage({status:409,code:'studio_conflict',step:'media'}),'Ett klipp har ändrats medan publiceringen förbereddes. Inget publicerades. Läs in igen.');
});

test('nothing to publish disables the button; ready:false keeps Publicera nu inactive and sends nothing',async()=>{
  assert.deepEqual(roomReleaseButton({status:'ready',preview:preview({changed:false,ready:false,changes:[]})}),
    {disabled:true,label:'Inget att publicera',hint:'Sparat läge är detsamma som live'});
  assert.equal(roomReleaseButton({status:'loading'}).disabled,true);
  assert.equal(roomReleaseButton({status:'ready',preview:preview(),blockedBy:'Spara spelbordets ändringar först'}).disabled,true);
  const open=roomReleaseButton({status:'ready',preview:preview()});
  assert.equal(open.disabled,false);assert.equal(open.label,'Publicera');assert.equal(open.hint,'1 ändring ej publicerad');
  // Hinder: rutan går att öppna för att visa dem, men publiceringen är inaktiv.
  const blocked=preview({ready:false,blockers:[{area:'settings',code:'studio_room_game_config_missing'}]});
  assert.equal(roomReleaseButton({status:'ready',preview:blocked}).disabled,false);
  assert.equal(roomReleaseCanPublish(blocked),false);assert.equal(roomReleaseCanPublish(preview({ready:false})),false);
  assert.equal(roomReleaseCanPublish(preview({changed:false})),false);assert.equal(roomReleaseCanPublish(preview()),true);
  const {calls,fetchImpl}=recorder([{status:200,body:receipt()}]);
  const refused=await publishRoomRelease({preview:blocked,fetchImpl});
  assert.equal(refused.ok,false);assert.equal(calls.length,0,'a preview with blockers is never sent');
});

test('blockers link to the place where they are fixed, and every area is listed',()=>{
  const context={roomId:'north-a',dealerId:'dragan',rooms:[{id:'north-b',name:'Norr B'}]};
  assert.deepEqual(roomReleaseBlocker({area:'speech',code:'studio_room_game_material_unavailable',materialReason:'native_material_take_unrecognized'},context),
    {text:'Tal och klipp: ingen godkänd tagning.',href:'/admin/dealers/dragan?flik=tal',linkLabel:'Öppna i Röst och tal'});
  assert.equal(roomReleaseBlocker({area:'settings',code:'studio_room_game_config_missing'},context).href,'/admin/rooms/north-a?flik=spel');
  assert.equal(roomReleaseBlocker({area:'roomChoices',code:'studio_room_choices_draft_pending'},context).href,'/admin/rooms/north-a?flik=utseende');
  const neighbour=roomReleaseBlocker({area:'rooms',code:'studio_room_game_material_unavailable',roomId:'north-b'},context);
  assert.match(neighbour.text,/^Spelbordet Norr B kan inte bindas om/);assert.equal(neighbour.href,'/admin/rooms/north-b?flik=spel');
  assert.equal(roomReleaseBlocker({area:'settings',code:'studio_room_config_storage_missing'},context).href,null);
  const areas=roomReleaseAreas(preview({changes:[
    {area:'speech',lineId:'insurance',language:'sv',before:{takeId:'t1',approvedBy:'anna'},after:{takeId:'t2',approvedBy:'jakob'}},
    {area:'clips',added:3,removed:2},{area:'placement'},{area:'settings',before:{language:'en',limitPreset:'prive'},after:{language:'sv',limitPreset:'high'}},
    {area:'roomChoices',key:'table',before:'green',after:'blue'}],affectedRooms:[{id:'north-b',name:'Norr B',bound:true,rebinds:true}]}));
  assert.deepEqual(areas.map(row=>[row.area,row.changed]),[['speech',true],['clips',true],['idle',false],['placement',true],['settings',true],['roomChoices',true],['rooms',true]]);
  assert.deepEqual(areas[0].rows,['insurance · sv: tagning t1 → tagning t2, godkänd av jakob']);
  assert.deepEqual(areas[4].rows,['Språk engelska → svenska, Insatsprofil Privé → High']);
  assert.deepEqual(areas[5].rows,['Bordsgrafik: green → blue']);assert.deepEqual(areas[6].rows,['Norr B binds om och behåller sina spelinställningar']);
});

// Steg D v2: bolagets utseendeutkast följer med publiceringen och ska synas i rutan.
const appearance=(patch={})=>({area:'appearance',draftRevision:4,changes:[
  {roomId:null,key:'dealer',before:'dragan',after:'paow'},
  {roomId:'north-a',key:'dealer',before:'dragan',after:'paow'},
  {roomId:'north-b',key:'dealer',before:'dragan',after:'paow'},
  {roomId:'north-c',key:'roomOverrides.table',before:null,after:'blue'}],affectedRooms:['north-a','north-b','north-c'],...patch});

test('an included appearance draft is its own area with company and room rows, and other affected rooms are named',()=>{
  const view=preview({changes:[{area:'settings',before:null,after:{language:'sv',limitPreset:'prive'}},appearance()],
    appearanceDraft:{revision:4,included:true}});
  const names={dragan:'Dragan',paow:'PAOW'};
  const areas=roomReleaseAreas(view,{dealerName:id=>names[id],rooms:[{id:'north-a',name:'Norr A'},{id:'north-c',name:'Norr C'}]});
  const area=areas.find(row=>row.area==='appearance');
  assert.ok(area,'the appearance area is shown');
  assert.equal(area.label,'Utseende (utkast 4)');assert.equal(area.changed,true);
  // Spelbordens ärvda dealerrader är bolagets val en gång; Norr B nämns under "Gäller även".
  assert.deepEqual(area.rows,['Bolaget · Dealer: Dragan → PAOW','Spelbordet Norr C · Bordsgrafik (eget val): – → blue','Gäller även: Norr B, Norr C']);
  assert.deepEqual(areas.map(row=>row.area),['speech','clips','idle','placement','settings','roomChoices','appearance','rooms']);
  // Två val i utkastet och en inställning; "Gäller även" är ingen ändring.
  assert.equal(release.roomReleaseChangeCount(view),3);
  assert.equal(roomReleaseButton({status:'ready',preview:view}).hint,'3 ändringar ej publicerade');
  // Bara det valda spelbordet påverkas: ingen rad "Gäller även".
  const own=roomReleaseAreas(preview({changes:[appearance({changes:[{roomId:'north-a',key:'color',before:'#111',after:'#222'}],affectedRooms:['north-a']})]}))
    .find(row=>row.area==='appearance');
  assert.deepEqual(own.rows,['Spelbordet north-a · Färg: #111 → #222']);
  assert.equal(release.roomReleaseChangeCount(preview({changes:[appearance({changes:[],affectedRooms:[]})]})),1,'an empty draft still counts once');
});

test('a draft choice that is also a roomChoices row is shown and counted once',()=>{
  const names={dragan:'Dragan',paow:'PAOW'};
  const dealer={area:'roomChoices',key:'dealer',before:'dragan',after:'paow'};
  // Ett bolag med ett spelbord: bolagets dealerval ger raden under roomChoices och två utseenderader.
  const single=preview({changes:[dealer,appearance({changes:[{roomId:null,key:'dealer',before:'dragan',after:'paow'},
    {roomId:'north-a',key:'dealer',before:'dragan',after:'paow'}],affectedRooms:['north-a']})],appearanceDraft:{revision:4,included:true}});
  const areas=roomReleaseAreas(single,{dealerName:id=>names[id]});
  assert.deepEqual(areas.find(row=>row.area==='roomChoices').rows,['Dealer: Dragan → PAOW (bolagets val i utkastet)']);
  assert.deepEqual(areas.find(row=>row.area==='appearance').rows,['Utkastet 4 publiceras samtidigt (valen står under Spelbordets val)']);
  assert.equal(release.roomReleaseChangeCount(single),1);
  assert.equal(roomReleaseButton({status:'ready',preview:single}).hint,'1 ändring ej publicerad');
  // Flera spelbord: samma val en gång, de andra spelborden under "Gäller även", eget val på ett annat bord räknas för sig.
  const many=preview({changes:[dealer,appearance()],appearanceDraft:{revision:4,included:true}});
  const manyAreas=roomReleaseAreas(many,{dealerName:id=>names[id],rooms:[{id:'north-c',name:'Norr C'}]});
  assert.deepEqual(manyAreas.find(row=>row.area==='roomChoices').rows,['Dealer: Dragan → PAOW (bolagets val i utkastet)']);
  assert.deepEqual(manyAreas.find(row=>row.area==='appearance').rows,['Spelbordet Norr C · Bordsgrafik (eget val): – → blue','Gäller även: Norr B, Norr C']);
  assert.equal(release.roomReleaseChangeCount(many),2);
  // Spelbordets eget val i utkastet: raden står under roomChoices med sitt ursprung.
  const own=preview({changes:[{area:'roomChoices',key:'table',before:'green',after:'blue'},appearance({changes:[{roomId:'north-a',key:'table',before:'green',after:'blue'}],affectedRooms:['north-a']})]});
  assert.deepEqual(roomReleaseAreas(own).find(row=>row.area==='roomChoices').rows,['Bordsgrafik: green → blue (eget val i utkastet)']);
  assert.equal(release.roomReleaseChangeCount(own),1);
  // Bolagets val når inte det valda spelbordet när det har ett eget val: båda räknas.
  const kept=preview({changes:[{area:'roomChoices',key:'dealer',before:'dragan',after:'mira'},appearance({changes:[{roomId:null,key:'dealer',before:'dragan',after:'paow'},
    {roomId:'north-a',key:'dealer',before:'dragan',after:'mira'},{roomId:'north-b',key:'dealer',before:'dragan',after:'paow'}],affectedRooms:['north-a','north-b']})]});
  assert.deepEqual(roomReleaseAreas(kept,{dealerName:id=>names[id]}).find(row=>row.area==='appearance').rows,['Bolaget · Dealer: Dragan → PAOW','Gäller även: Norr B']);
  assert.equal(release.roomReleaseChangeCount(kept),2);
});

test('an included draft without change rows still shows the area, and a draft that is not included shows none',()=>{
  const included=roomReleaseAreas(preview({changes:[],appearanceDraft:{revision:6,included:true}})).find(row=>row.area==='appearance');
  assert.deepEqual([included.label,included.changed,included.rows],['Utseende (utkast 6)',true,['Utkastet 6 publiceras samtidigt']]);
  assert.equal(roomReleaseAreas(preview({appearanceDraft:{revision:6,included:false}})).some(row=>row.area==='appearance'),false);
});

test('a server without step D v2 (no appearance area, no appearanceDraft) reads and renders as before',async()=>{
  const old=preview();
  assert.equal('appearanceDraft' in old,false);
  const read=await readRoomRelease({operatorId:'north',roomId:'north-a',fetchImpl:recorder([{status:200,body:old}]).fetchImpl});
  assert.equal(read.ok,true);
  assert.equal(roomReleaseAreas(read.preview).some(row=>row.area==='appearance'),false);
  assert.equal(release.roomReleaseChangeCount(read.preview),1);
  // Trasiga eller saknade fält i området fäller inte rutan.
  const broken=roomReleaseAreas(preview({changes:[{area:'appearance'},{area:'appearance',changes:[null,{key:7}],affectedRooms:'north-b'}],appearanceDraft:'x'}))
    .find(row=>row.area==='appearance');
  assert.deepEqual([broken.label,broken.rows],['Utseende (utkast)',['Utkastet publiceras samtidigt']]);
});

test('the room_choices step and the draft_invalid reason have their own text, linking to Utseende',()=>{
  assert.equal(roomReleaseErrorMessage({status:409,code:'studio_conflict',step:'room_choices'}),
    'Utseendeutkastet har ändrats sedan förhandsvisningen. Inget publicerades. Läs in igen.');
  assert.equal(roomReleaseErrorMessage({status:422,code:'studio_release_invalid',reason:'studio_room_choices_draft_invalid'}),
    'Utseendeutkastet passar inte med de sparade miljöerna. Inget publicerades.');
  assert.deepEqual(roomReleaseBlocker({area:'roomChoices',code:'studio_release_invalid',reason:'studio_room_choices_draft_invalid'},{roomId:'north-a'}),
    {text:'Utseendeutkastet passar inte med de sparade miljöerna.',href:'/admin/rooms/north-a?flik=utseende',linkLabel:'Öppna Utseende'});
});

test('the Publicera button renders inactive before the comparison is read and for a room that cannot be published',async()=>{
  const require=createRequire(import.meta.url),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{transformSync}=require('esbuild');
  const tsx=path=>transformSync(readFileSync(new URL(path,import.meta.url),'utf8'),{loader:'tsx',format:'cjs',jsx:'automatic'}).code;
  const load=(path,extra={})=>{const module={exports:{}};
    runInNewContext(tsx(path),{module,exports:module.exports,require:dep=>Object.hasOwn(extra,dep)?extra[dep]:require(dep)});return module.exports;};
  const kit=load('../components/ui/kit.tsx');
  const navigation={__esModule:true,default:props=>React.createElement('a',props)};
  const {RoomRelease}=load('../components/studio/room-release.tsx',{'../ui/kit':kit,'../ui/dialog':load('../components/ui/dialog.tsx',{'./kit':kit}),
    '../../../runtime/navigation':navigation,'../../lib/room-release.mjs':release});
  const html=props=>renderToStaticMarkup(React.createElement(RoomRelease,{operatorId:'north',roomId:'north-a',roomName:'Norr A',...props}));
  for(const out of [html({eligible:true}),html({eligible:false})]){
    const button=out.match(/<button[^>]*data-action="room-release"[^>]*>([^<]*)</);
    assert.ok(button,out);assert.match(button[0],/\sdisabled=""/);assert.equal(button[1],'Publicera');
  }
  assert.doesNotMatch(html({eligible:true}),/Publicera nu/,'the dialog is closed until the button is used');
});

test('a 5xx without a known code leaves the outcome open; only a known code refused before commit says Inget publicerades',async()=>{
  for(const [status,body] of [[503,null],[502,{error:'bad_gateway'}],[500,{error:'internal_error'}],[504,'<html>']]){
    const result=await publishRoomRelease({preview:preview(),fetchImpl:recorder([{status,body}]).fetchImpl});
    assert.equal(result.ok,false);assert.doesNotMatch(result.error,/Inget publicerades/,String(status));
    assert.match(result.error,/Läs in igen för att se om publiceringen gick igenom/,String(status));
  }
  const known=await publishRoomRelease({preview:preview(),fetchImpl:recorder([{status:503,body:{error:'studio_media_registry_unavailable',code:'studio_media_registry_unavailable'}}]).fetchImpl});
  assert.match(known.error,/Medieregistret svarar inte.*Inget publicerades/,'a known code refused before commit');
  // Förhandsvisningen publicerar inget: ett 5xx där säger bara att jämförelsen inte kunde läsas.
  const read=await readRoomRelease({operatorId:'north',roomId:'north-a',fetchImpl:recorder([{status:503,body:null}]).fetchImpl});
  assert.equal(read.ok,false);assert.equal(read.error,'Jämförelsen med live kunde inte läsas. Läs in igen.');
});

test('an aborted read rejects instead of becoming an error message, and blockers stop ready:true',async()=>{
  const controller=new AbortController();
  const fetchImpl=async(url,init)=>{controller.abort();assert.equal(init.signal,controller.signal);throw new DOMException('aborted','AbortError');};
  await assert.rejects(readRoomRelease({operatorId:'north',roomId:'north-a',fetchImpl,signal:controller.signal}),{name:'AbortError'});
  const lost=await readRoomRelease({operatorId:'north',roomId:'north-a',fetchImpl:recorder([new TypeError('network')]).fetchImpl,signal:new AbortController().signal});
  assert.equal(lost.ok,false,'a network error without abort is still shown');
  const inconsistent=preview({ready:true,blockers:[{area:'settings',code:'studio_room_game_config_missing'}]});
  assert.equal(roomReleaseCanPublish(inconsistent),false,'ready:true with a blocker never publishes');
  const {calls,fetchImpl:never}=recorder([{status:200,body:receipt()}]);
  assert.equal((await publishRoomRelease({preview:inconsistent,fetchImpl:never})).ok,false);assert.equal(calls.length,0);
});

test('the room choices name the dealer from the registry; other ids stay as they are',()=>{
  const view=preview({changes:[{area:'roomChoices',key:'dealer',before:'dragan',after:'paow'},{area:'roomChoices',key:'table',before:null,after:'blue'}]});
  const names={dragan:'Dragan',paow:'PAOW'};
  assert.deepEqual(roomReleaseAreas(view,{dealerName:id=>names[id]}).find(row=>row.area==='roomChoices').rows,['Dealer: Dragan → PAOW','Bordsgrafik: – → blue']);
  assert.deepEqual(roomReleaseAreas(view).find(row=>row.area==='roomChoices').rows,['Dealer: dragan → paow','Bordsgrafik: – → blue']);
});

// ---- RoomRelease med fejkade hooks: knapparna klickas, svaren styrs och effekterna körs i ordning.
function fakeHooks(React){
  const slots=[],effects=[];let cursor=0;
  const react={...React,
    useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next;}];},
    useRef(value){return slots[cursor++]??={current:value};},
    useEffect(effect,deps){const i=cursor++,previous=slots[i];if(!previous||!deps||deps.some((value,index)=>value!==previous.deps[index]))effects.push(()=>{previous?.cleanup?.();slots[i]={deps,cleanup:effect()};});}};
  return {react,reset(){cursor=0;},flush(){for(const effect of effects.splice(0))effect();}};
}
const elements=(node,predicate)=>{
  if(Array.isArray(node))return node.flatMap(child=>elements(child,predicate));
  if(!node||typeof node!=='object'||!node.props)return [];
  return [...(predicate(node)?[node]:[]),...Object.values(node.props).flatMap(value=>elements(value,predicate))];
};
const text=node=>Array.isArray(node)?node.map(text).join(''):node==null||typeof node==='boolean'?'':typeof node!=='object'?String(node):text(node.props?.children);
const settle=async()=>{for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve));};
function mountRelease(props,responses){
  const require=createRequire(import.meta.url),React=require('react'),{transformSync}=require('esbuild'),hooks=fakeHooks(React);
  const calls=[],fetchImpl=async(url,init)=>{calls.push({url:String(url),method:init.method});const next=responses.shift();
    if(typeof next==='function')return next();return {ok:next.status>=200&&next.status<300,status:next.status,json:async()=>next.body};};
  const lib={...release,readRoomRelease:input=>release.readRoomRelease({...input,fetchImpl}),publishRoomRelease:input=>release.publishRoomRelease({...input,fetchImpl})};
  const stub=()=>null;
  const module={exports:{}};
  runInNewContext(transformSync(readFileSync(new URL('../components/studio/room-release.tsx',import.meta.url),'utf8'),{loader:'tsx',format:'cjs',jsx:'automatic'}).code,
    {module,exports:module.exports,AbortController,require:name=>name==='react'?hooks.react:name==='../../lib/room-release.mjs'?lib
      :name==='../ui/kit'?{Button:stub,cn:(...names)=>names.filter(Boolean).join(' '),TechnicalDetails:stub}:name==='../ui/dialog'?{Dialog:stub}
      :name==='../../../runtime/navigation'?{__esModule:true,default:stub}:require(name)});
  const busy=[],published=[],focused=[];
  const render=()=>{hooks.reset();const tree=module.exports.RoomRelease({operatorId:'north',roomId:'north-a',roomName:'Norr A',eligible:true,
    onBusyChange:value=>busy.push(value),onPublished:value=>published.push(value),...props});
    // React fäster ref före effekterna; här får kvittots ref en nod som noterar fokus.
    for(const node of elements(tree,node=>node.props.tabIndex===-1&&node.props.ref))node.props.ref.current??={focus:()=>focused.push(true)};
    hooks.flush();return tree;};
  const find=action=>elements(render(),node=>node.props['data-action']===action)[0];
  render();
  // Som React: rendera om efter ett klick så att effekterna startar, vänta på svaren och rendera igen.
  const idle=async()=>{render();await settle();render();};
  return {render,find,idle,calls,busy,published,focused,responses,
    dialog:()=>elements(render(),node=>node.props.title==='Det här ändras jämfört med live')[0],
    reloadButton:()=>elements(render(),node=>text(node.props.children)==='Läs in igen'&&typeof node.props.onClick==='function')[0],
    announced:()=>text(elements(render(),node=>node.props.role==='status'&&node.props.className==='sr-only')[0].props.children),
    receipt:()=>elements(render(),node=>node.props['data-release-receipt']==='')[0]};
}

test('Publicera nu sends one request for a double click, reports busy, and after an error waits for a new read',async()=>{
  let answer;
  const h=mountRelease({},[{status:200,body:preview()}]);
  await h.idle();
  assert.equal(h.announced(),'1 ändring ej publicerad');
  assert.equal(h.receipt().props.role,'status','the receipt region exists before any receipt');
  h.responses.push({status:200,body:preview()});h.find('room-release').props.onClick();
  assert.equal(h.announced(),'1 ändring ej publicerad','a re-read does not announce Jämför med live…');
  await h.idle();assert.equal(h.dialog().props.open,true);
  h.responses.push(()=>new Promise(resolve=>{answer=resolve;}));
  const confirm=h.find('room-release-confirm');assert.equal(confirm.props.disabled,false);
  confirm.props.onClick();confirm.props.onClick();await h.idle();
  assert.equal(h.calls.filter(call=>call.method==='POST').length,1,'the second click is held by the lock');
  assert.deepEqual(h.busy,[true]);assert.equal(h.find('room-release-confirm').props.disabled,true,'inactive while publishing');
  answer({ok:false,status:409,json:async()=>({error:'studio_conflict',code:'studio_conflict',step:'package'})});await h.idle();
  assert.deepEqual(h.busy,[true,false]);
  assert.match(text(elements(h.dialog().props.children,node=>node.props.role==='alert')[0]?.props.children),/Bolagets publicering har ändrats/);
  assert.equal(h.find('room-release-confirm').props.disabled,true,'an error requires a new read first');
  h.find('room-release-confirm').props.onClick();await h.idle();
  assert.equal(h.calls.filter(call=>call.method==='POST').length,1,'no second POST before the preview is read again');
  h.responses.push({status:200,body:preview()});h.reloadButton().props.onClick();await h.idle();
  assert.equal(h.find('room-release-confirm').props.disabled,false,'a fresh preview unlocks Publicera nu');
  h.responses.push({status:200,body:receipt()},{status:200,body:preview({changed:false,changes:[]})});
  h.find('room-release-confirm').props.onClick();await h.idle();
  assert.equal(h.published.length,1);assert.equal(h.dialog().props.open,false);
  assert.match(text(h.receipt().props.children),/^Publicerat · version 8/);assert.deepEqual(h.focused,[true],'focus moves to the receipt');
  await h.idle();assert.equal(h.calls.at(-1).method,'GET','the comparison is read again after the receipt');
  assert.equal(h.announced(),'Sparat läge är detsamma som live');
});
