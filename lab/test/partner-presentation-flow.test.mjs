import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultPresentationLane} from '../lib/studio-model.mjs';
import {defaultCompositionSettings} from '../../web/public/composition-settings.mjs';
import {layerAssetPath} from '../../web/presentation-layers.mjs';
import {withPackagePresentation,readPackagePresentation} from '../../web/storage/presentation-package.mjs';
import {createPartnerBrandingApi} from '../lib/partner-branding-api.mjs';
import {partnerPresentationDealerChoices} from '../lib/partner-presentation-choices.mjs';
import {partnerLaneState} from '../lib/partner-package-view.mjs';
import {createGameEntrySelector} from '../../web/game-entry-operator.mjs';
import {decorateGameEntryHtml} from '../../web/public/game-entry-contract.mjs';
import {gameLaneFromDocument} from '../../web/public/game-lanes.mjs';
import {resolvePlayerSelection} from '../../web/public/player-choices.mjs';

function fixture() {
  const assets=['table','table','background','background'].map((role,index)=>{
    const asset={schemaVersion:1,id:'00000000-0000-4000-8000-'+String(index+1).padStart(12,'0'),role,label:role+' '+index,contentType:'image/png',sha256:'a'.repeat(64),size:32,width:720,height:1280};
    return {...asset,pathname:layerAssetPath(asset)};
  });
  const lanes=['first-presentation','vip-presentation'].map((id,index)=>{
    const lane={...defaultPresentationLane(),id,dealers:['astrid','vera'],operatorAdjustable:['table','table.color','background','dealer','branding'],composition:defaultCompositionSettings()};
    lane.layers.dealer={enabled:true,default:'astrid',allowed:['astrid','vera']};
    lane.layers.table={enabled:true,default:assets[index].id,allowed:assets.slice(0,2).map(row=>row.id),colors:['#112233','#445566']};
    lane.layers.background={enabled:true,mode:'image',default:assets[index+2].id,allowed:assets.slice(2).map(row=>row.id)};
    return lane;
  });
  const presentation={schemaVersion:1,projectRevision:'frozen-originals',lanes,assets};
  let pack={operatorId:'north',revision:1,lanes:lanes.map(row=>row.id),games:['blackjack'],tables:['room-first','room-vip'],branding:withPackagePresentation({name:'North',primary:'#abcdef'},presentation)};
  const gameLanes=[{schemaVersion:1,id:'indexed',label:'Indexed',renderer:'indexed-video',dealer:'astrid',mediaCollection:'legacy-dealers'},
    {schemaVersion:1,id:'portrait-astrid',label:'Astrid',renderer:'portrait-video',dealer:'astrid',mediaCollection:'astrid-presentation'}];
  const room=(id,presentationLaneId,gameLaneId='indexed',operatorId='north',state='live')=>({schemaVersion:2,id,name:id,presentationLaneId,gameLaneId,operatorId,state});
  const administration={gameLane:'indexed',gameLanes,rooms:lanes.map((row,index)=>room(index?'room-vip':'room-first',row.id))};
  const store={getCurrentPackage:async id=>id==='north'?structuredClone(pack):null,publishPackage:async input=>{
    assert.equal(input.expectedRevision,pack.revision);pack={...input,revision:pack.revision+1};return structuredClone(pack);
  }};
  const readAdministration=async()=>({revision:'admin-frozen',value:structuredClone(administration)});
  const api=createPartnerBrandingApi({store,readAdministration,readProject:()=>assert.fail('mutable project must not select N2 content'),
    withWriteContext:work=>work({store,readAdministration,reauthorize:async()=>true})});
  const select=createGameEntrySelector({policy:{readGameConfiguration(){},readSaved:async()=>({project:{lanes:[],dealers:[]},administration})},
    packages:{resolve:async()=>({operator:{id:'north',status:'active'},package:structuredClone(pack)})},log:()=>{}});
  function document(selection) {
    const html=decorateGameEntryHtml('<html lang="sv"></html>',{CROUPIER_STUDIO_NEON_POLICY:'1'},selection),dataset={};
    for(const [,attribute,value]of html.matchAll(/data-(game-[a-z-]+)="([^"]*)"/g))dataset[attribute.replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase())]=value.replaceAll('&quot;','"').replaceAll('&amp;','&').replaceAll('&#39;',"'").replaceAll('&lt;','<').replaceAll('&gt;','>');
    return gameLaneFromDocument(dataset);
  }
  return {assets,lanes,presentation,administration,api,select,room,document,pack:()=>structuredClone(pack),setBranding:branding=>{pack={...pack,branding:{...pack.branding,...branding}};},addTables:ids=>{pack.tables.push(...ids);}};
}

test('N2 frozen allowed choices save once and reach actual HTML/client with N1 geometry and room IDs intact',async()=>{
  const f=fixture(),before=f.pack();
  const saved=await f.api.write({operatorId:'north',actor:'partner',expectedRevision:1,branding:{lane:f.lanes[0].id,dealer:'vera',table:f.assets[1].id,background:f.assets[3].id,color:'#445566'}});
  assert.equal(saved.packageRevision,2);assert.deepEqual(saved.dealerChoices[f.lanes[0].id],['astrid','vera']);
  assert.deepEqual(f.pack().tables,before.tables);assert.deepEqual(readPackagePresentation(f.pack()),f.presentation);
  let {selection}=await f.select('operator=north&table=room-first');selection=f.document(selection);
  const actual=resolvePlayerSelection({choices:selection.choices,branding:selection.branding,currentDealer:selection.dealer,composition:selection.composition});
  assert.equal(actual.dealer,'vera');assert.equal(actual.navigateDealer,'vera');assert.equal(actual.tableValue,f.assets[1].id);
  assert.equal(actual.backgroundValue,f.assets[3].id);assert.equal(actual.tableColor,'#445566');assert.equal(selection.roomId,'room-first');
  assert.deepEqual(selection.composition.settings,f.lanes[0].composition);
  assert.equal((await f.select('operator=north&table=room-first&dealer=vera')).selection.dealer,'vera');
  assert.equal((await f.api.read({operatorId:'north'})).branding.dealer,'vera');
});

test('global dealer choices intersect all published compatible live rooms, excluding foreign/unpublished/inactive rooms',async()=>{
  const f=fixture(),id=f.lanes[0].id;
  f.administration.rooms.push(f.room('room-portrait',id,'portrait-astrid'));
  f.addTables(['room-portrait']);
  assert.deepEqual((await f.api.read({operatorId:'north'})).dealerChoices[id],['astrid']);
  const before=f.pack();await assert.rejects(f.api.write({operatorId:'north',actor:'partner',expectedRevision:1,branding:{lane:id,dealer:'vera'}}),error=>error.statusCode===409);
  assert.deepEqual(f.pack(),before);
  f.administration.rooms.find(row=>row.id==='room-portrait').state='preview';
  f.administration.rooms.push(f.room('room-foreign',id,'portrait-astrid','south'),f.room('room-unpublished',id,'portrait-astrid'));
  f.addTables(['room-foreign','room-missing']);
  assert.deepEqual((await f.api.read({operatorId:'north'})).dealerChoices[id],['astrid','vera']);
  f.administration.rooms=f.administration.rooms.filter(row=>row.presentationLaneId!==id||row.state!=='live'||row.operatorId!=='north'||!f.pack().tables.includes(row.id));
  assert.deepEqual((await f.api.read({operatorId:'north'})).dealerChoices[id],[]);
  await assert.rejects(f.api.write({operatorId:'north',actor:'partner',expectedRevision:1,branding:{lane:id,dealer:null}}),error=>error.statusCode===409);
});

for(const lane of ['first-presentation','vip-presentation',undefined,'unknown-presentation'])test('runtime layer overrides are bound to '+String(lane)+' while global company branding survives',async()=>{
  const f=fixture(),branding={...(lane!==undefined?{lane}:{}),dealer:'vera',table:f.assets[1].id,background:f.assets[3].id,color:'#445566',tableColor:'#445566'};
  f.setBranding(branding);const before=f.pack();
  for(const [index,table]of ['room-first','room-vip'].entries()){
    const {selection:raw}=await f.select('operator=north&table='+table),selection=f.document(raw);
    const matches=(lane??f.lanes[0].id)===f.lanes[index].id;
    const actual=resolvePlayerSelection({choices:selection.choices,branding:selection.branding,currentDealer:selection.dealer,composition:selection.composition});
    assert.equal(actual.tableValue,matches?f.assets[1].id:f.lanes[index].layers.table.default);
    assert.equal(actual.backgroundValue,matches?f.assets[3].id:f.lanes[index].layers.background.default);
    assert.equal(actual.dealer,matches?'vera':'astrid');assert.equal(actual.tableColor,matches?'#445566':null);
    assert.equal(selection.branding.name,'North');assert.equal(selection.branding.primary,'#abcdef');
    assert.deepEqual(selection.composition.settings,f.lanes[index].composition);assert.equal(selection.roomId,table);
  }
  assert.deepEqual(f.pack(),before,'selection never mutates shared package branding');
});

test('N2 lane switching clears hidden choices from the previous presentation and preserves company branding',async()=>{
  const f=fixture();f.setBranding({lane:f.lanes[0].id,dealer:'vera',table:f.assets[1].id,background:f.assets[3].id,color:'#445566'});
  const saved=await f.api.write({operatorId:'north',actor:'partner',expectedRevision:1,branding:{lane:f.lanes[1].id,background:f.assets[2].id}});
  assert.equal(saved.branding.lane,f.lanes[1].id);assert.equal(saved.branding.background,f.assets[2].id);
  for(const key of ['dealer','table','color'])assert.equal(saved.branding[key],undefined);
  assert.equal(saved.branding.name,'North');assert.equal(saved.branding.primary,'#abcdef');
  assert.equal(partnerLaneState(f.lanes[0],saved.branding,f.assets).layers.dealer.selected,'astrid');
});

test('permissions remain bound to the selected frozen presentation and fresh package CAS rejects old intent',async()=>{
  const f=fixture();const restricted=f.presentation.lanes[1];restricted.operatorAdjustable=[];
  // Reconstruct a frozen package with this N1 grant, rather than changing latest Studio.
  f.setBranding({_scoutPresentation:withPackagePresentation({},f.presentation)._scoutPresentation});
  const before=f.pack();await assert.rejects(f.api.write({operatorId:'north',actor:'partner',expectedRevision:1,branding:{lane:restricted.id,background:f.assets[2].id}}),error=>error.statusCode===422);
  assert.deepEqual(f.pack(),before);
  await f.api.write({operatorId:'north',actor:'partner',expectedRevision:1,branding:{lane:f.lanes[0].id,table:f.assets[1].id}});
  await assert.rejects(f.api.write({operatorId:'north',actor:'partner',expectedRevision:1,branding:{lane:f.lanes[0].id,table:f.assets[0].id}}),error=>error.statusCode===409);
  assert.equal(f.pack().revision,2);assert.equal(f.pack().branding.table,f.assets[1].id);
});
