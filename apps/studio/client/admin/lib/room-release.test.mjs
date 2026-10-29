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
