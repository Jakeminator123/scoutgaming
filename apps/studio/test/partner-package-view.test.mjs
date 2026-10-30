import test from 'node:test';
import assert from 'node:assert/strict';
import {adminLayerAdjustments,effectivePartnerAdjustments,partnerLaneState,partnerLayerChoices} from '../lib/partner-package-view.mjs';
import {resolveRoomBranding} from '../../../packages/operators/contracts/branding.mjs';
import { defaultPresentationLane } from '../../../packages/presentation/contracts/studio-model.mjs';
import { defaultCompositionSettings } from '../../../packages/presentation/contracts/composition-settings.mjs';
import { layerAssetPath, validatePresentationPackage } from '../../../packages/presentation/contracts/presentation-layers.mjs';

const tableId='11111111-1111-4111-8111-111111111111', backgroundId='22222222-2222-4222-8222-222222222222';
function makePresentation(layered=true,schemaVersion=2) {
  const dealerIds=schemaVersion===1?['astrid']:['astrid','elin'];
  const assets=[['table',tableId,'Bordbild','image/png'],['background',backgroundId,'Bakgrundsfilm','video/webm']].map(([role,id,label,contentType])=>{
    const asset={schemaVersion:1,id,role,label,contentType,sha256:'a'.repeat(64),size:32,width:1920,height:1080};
    return {...asset,pathname:layerAssetPath(asset)};
  });
  const lane={...defaultPresentationLane('astrid'),label:'Tilldelad presentation',dealers:dealerIds,operatorAdjustable:['table','table.color','background','dealer','branding'],
    layers:{table:{enabled:true,default:tableId,allowed:[tableId],colors:['#112233']},background:{enabled:true,mode:'video',default:backgroundId,allowed:[backgroundId]},dealer:{enabled:true,default:'astrid',allowed:dealerIds}},
    ...(layered?{composition:defaultCompositionSettings()}: {})};
  return validatePresentationPackage({schemaVersion,projectRevision:'test-r1',lanes:[lane],assets,...(schemaVersion===2?{registeredDealers:[{id:'elin',label:'Elin',idle:null}]}:{})});
}

test('assigned layers keep their exact image/video formats and published defaults',()=>{
  const presentation=makePresentation();
  const profile=partnerLaneState(presentation.lanes[0],{lane:presentation.lanes[0].id,dealer:'elin'},presentation.assets,presentation.registeredDealers);
  assert.equal(profile.layers.dealer.selected,'elin');
  assert.equal(profile.layers.table.contentType,'image/png');
  assert.equal(profile.layers.background.contentType,'video/webm');
  assert.equal(profile.layers.table.selected,tableId);
  assert.equal(profile.compatibility,'per-clip');
  const state=partnerLaneState(presentation.lanes[0],{lane:'foreign-lane',dealer:'elin'},presentation.assets);
  assert.equal(state.layers.dealer.selected,'astrid');
});
test('full-frame fallback suppresses incompatible independent layer adjustments',()=>{
  const presentation=makePresentation(false);
  assert.deepEqual(effectivePartnerAdjustments(presentation.lanes[0]),['dealer','branding']);
  assert.equal(partnerLaneState(presentation.lanes[0]).compatibility,'full-frame');
});


test('registered dealer label comes from the frozen package while selection keeps the ID',()=>{
  const lane=structuredClone(makePresentation().lanes[0]);
  lane.dealers=['linnea'];lane.layers.dealer={enabled:true,default:'linnea',allowed:['linnea']};
  const presentation={schemaVersion:2,lanes:[lane],assets:[],registeredDealers:[{id:'linnea',label:'Linnea Studio',idle:null}]};
  const state=partnerLaneState(lane,{lane:lane.id},presentation.assets,presentation.registeredDealers);
  assert.equal(state.layers.dealer.selected,'linnea');assert.equal(state.layers.dealer.label,'Linnea Studio');
});

test('the published layers of one room follow its exact overrides (Spelbord list cards)',()=>{
  const presentation=makePresentation();presentation.lanes.push({...structuredClone(presentation.lanes[0]),id:'second',label:'Second composition'});
  const branding={lane:'mobile-phone',dealer:'astrid',roomOverrides:{vip:{dealer:'elin'}}};
  const vip=partnerLaneState(presentation.lanes[0],resolveRoomBranding(branding,'vip','mobile-phone'),presentation.assets,presentation.registeredDealers);
  assert.equal(vip.layers.dealer.selected,'elin');assert.equal(vip.layers.dealer.label,'Elin');
  assert.equal(vip.layers.table.selected,tableId);assert.equal(vip.layers.background.selected,backgroundId);
  const main=partnerLaneState(presentation.lanes[0],resolveRoomBranding(branding,'main','mobile-phone'),presentation.assets,presentation.registeredDealers);
  assert.equal(main.layers.dealer.selected,'astrid');
});

test('Admin may choose every allowed layer of a layered composition while material compatibility still applies',()=>{
  const layered=makePresentation().lanes[0];
  assert.deepEqual(effectivePartnerAdjustments({...layered,operatorAdjustable:['table.color']}),['table.color'],'the company keeps its narrow gate');
  assert.deepEqual(adminLayerAdjustments({...layered,operatorAdjustable:['table.color']}),['table.color','table','background','dealer']);
  assert.deepEqual(adminLayerAdjustments({...layered,operatorAdjustable:[]}),['table','background','dealer']);
  const baked=structuredClone(layered);baked.layers.background={enabled:true,mode:'baked',default:null,allowed:[]};baked.operatorAdjustable=['branding'];
  assert.deepEqual(adminLayerAdjustments(baked),['table','dealer','branding'],'a baked background cannot be chosen separately');
  const empty=structuredClone(layered);empty.layers.table={enabled:true,default:null,allowed:[]};empty.operatorAdjustable=[];
  assert.deepEqual(adminLayerAdjustments(empty),['background','dealer'],'a layer without allowed material offers no choice');
  const fullFrame=makePresentation(false).lanes[0];
  assert.deepEqual(adminLayerAdjustments({...fullFrame,operatorAdjustable:[]}),['dealer'],'legacy full-frame clips bake table and background');
  assert.deepEqual(adminLayerAdjustments(undefined),[]);
});

test('Admin table choices exclude tablePlayback clips and a branding naming one shows the default table',()=>{
  const clipId='33333333-3333-4333-8333-333333333333';
  const lane={...defaultPresentationLane('astrid'),composition:defaultCompositionSettings(),
    layers:{table:{enabled:true,default:tableId,allowed:[tableId,clipId]},background:{enabled:true,mode:'video',default:backgroundId,allowed:[backgroundId]},dealer:{enabled:true,default:'astrid',allowed:['astrid']}},
    tablePlayback:{schemaVersion:1,rules:[{id:'living',assetId:clipId,trigger:{everyMs:25000},maxDurationMs:10000,cooldownMs:25000,maxPerMinute:2,maxSecondsPerMinute:20}]}};
  assert.deepEqual(partnerLayerChoices(lane,'table'),[tableId]);
  assert.deepEqual(partnerLayerChoices(lane,'background'),[backgroundId],'background choices are unchanged');
  assert.equal(partnerLaneState(lane,{lane:lane.id,table:clipId}).layers.table.selected,tableId);
  const {tablePlayback:_policy,...plain}=lane;
  assert.deepEqual(partnerLayerChoices(plain,'table'),[tableId,clipId],'without tablePlayback nothing changes');
  assert.equal(partnerLaneState(plain,{lane:lane.id,table:clipId}).layers.table.selected,clipId);
});
