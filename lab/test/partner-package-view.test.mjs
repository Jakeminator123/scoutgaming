import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {effectivePartnerAdjustments,partnerLaneState,partnerPackageProfiles} from '../lib/partner-package-view.mjs';
import {PartnerPackageView} from '../components/partner-package-view.mjs';
import { defaultPresentationLane } from '../../packages/presentation/contracts/studio-model.mjs';
import { defaultCompositionSettings } from '../../packages/presentation/contracts/composition-settings.mjs';
import { layerAssetPath, validatePresentationPackage } from '../../packages/presentation/contracts/presentation-layers.mjs';

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
  const [profile]=partnerPackageProfiles(presentation,{dealer:'elin'},'op-1');
  assert.equal(profile.operatorId,'op-1');
  assert.equal(profile.dealer,'elin');
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
  const snapshot={operator:{slug:'north'},presentation};
  const html=renderToStaticMarkup(React.createElement(PartnerPackageView,{snapshot,view:'theme'}));
  assert.match(html,/Fullbildsklipp/);
  assert.match(html,/Inbakat i dealerklippet/);
  assert.doesNotMatch(html,/Tre separata lager/);
});
test('real preview links to the actual scoped player and contains no invented table or wallet',()=>{
  const html=renderToStaticMarkup(React.createElement(PartnerPackageView,{snapshot:{operator:{slug:'north'},presentation:makePresentation(true,1)},view:'test'}));
  assert.match(html,/Tre separata lager/);
  assert.match(html,/Bordbild/);
  assert.match(html,/Bakgrundsfilm/);
  assert.doesNotMatch(html,/image\/png|video\/webm/);
  assert.match(html,/\/play\/blackjack\?operator=north&amp;lane=mobile-phone/);
  assert.doesNotMatch(html,/<svg|<iframe|1,000|10 000|localStorage/);
});
test('old package requests republication rather than pretending that prototype assets are assigned',()=>{
  const html=renderToStaticMarkup(React.createElement(PartnerPackageView,{snapshot:{operator:{slug:'north'}},view:'design'}));
  assert.match(html,/saknar det publicerade trelagersformatet/);
  assert.doesNotMatch(html,/Öppna spelbord|<svg|Dark Hall/);
});

for (const schemaVersion of [1,2]) test('owned room preview ignores guessed runtime lanes with presentation v'+schemaVersion,()=>{
  const presentation=makePresentation(true,schemaVersion);
  presentation.lanes[0].id='presentation-distinct-from-runtime';
  const row=(id,operatorId,status='active')=>({id,name:id,operatorId,status,presentationId:presentation.lanes[0].id});
  const snapshot={operator:{id:'north-id',slug:'north'},roomBindings:'operator-owned-v2',presentation,tables:[
    row('room-live','north-id'),row('room-other-owner','south-id'),row('room-preview','north-id','preview'),
    {...row('room-other-presentation','north-id'),presentationId:'other'}]};
  const html=renderToStaticMarkup(React.createElement(PartnerPackageView,{snapshot,view:'test'}));
  assert.match(html,/\/play\/blackjack\?operator=north&amp;table=room-live/);
  assert.doesNotMatch(html,/lane=|room-other-owner|room-preview|room-other-presentation/);
  const empty=renderToStaticMarkup(React.createElement(PartnerPackageView,{snapshot:{...snapshot,tables:[]},view:'test'}));
  assert.match(empty,/Inget publicerat spelrum/);
  assert.doesNotMatch(empty,/\/play\/blackjack/);
});

test('registered dealer label comes from the frozen package while selection keeps the ID',()=>{
  const lane=structuredClone(makePresentation().lanes[0]);
  lane.dealers=['linnea'];lane.layers.dealer={enabled:true,default:'linnea',allowed:['linnea']};
  const presentation={schemaVersion:2,lanes:[lane],assets:[],registeredDealers:[{id:'linnea',label:'Linnea Studio',idle:null}]};
  const state=partnerPackageProfiles(presentation,{},'north-id')[0];
  assert.equal(state.dealer,'linnea');assert.equal(state.layers.dealer.label,'Linnea Studio');
  const html=renderToStaticMarkup(React.createElement(PartnerPackageView,{snapshot:{operator:{id:'north-id',slug:'north'},presentation},view:'design'}));
  assert.match(html,/Linnea Studio/);
});

test('compact published summary follows the selected owned room and its exact overrides',()=>{
  const presentation=makePresentation();presentation.lanes.push({...structuredClone(presentation.lanes[0]),id:'second',label:'Second composition'});
  const snapshot={operator:{id:'north-id',slug:'north'},packageRevision:9,roomBindings:'operator-owned-v2',presentation,
    branding:{lane:'mobile-phone',dealer:'astrid',roomOverrides:{vip:{dealer:'elin'}}},tables:[{id:'vip',name:'VIP',operatorId:'north-id',status:'active',presentationId:'mobile-phone'}]};
  const sv=renderToStaticMarkup(React.createElement(PartnerPackageView,{snapshot,view:'test',roomId:'vip'}));
  assert.match(sv,/VIP/);assert.match(sv,/Elin/);assert.match(sv,/table=vip/);assert.match(sv,/Version 9/);
  assert.doesNotMatch(sv,/Second composition|image\/png|video\/webm|lane=/);
  const en=renderToStaticMarkup(React.createElement(PartnerPackageView,{snapshot,view:'test',roomId:'vip',language:'en'}));
  assert.match(en,/Published composition/);assert.match(en,/Three separate layers/);assert.doesNotMatch(en,/<dt>Bakgrund|Provspela|Publicerat/);
});
