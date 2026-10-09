import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {effectivePartnerAdjustments,partnerLaneState,partnerPackageProfiles} from '../lib/partner-package-view.mjs';
import {PartnerPackageView} from '../components/partner-package-view.mjs';
import { defaultPresentationLane } from '../lib/studio-model.mjs';
import { defaultCompositionSettings } from '../../web/public/composition-settings.mjs';
import { layerAssetPath, validatePresentationPackage } from '../../web/presentation-layers.mjs';

const tableId='11111111-1111-4111-8111-111111111111', backgroundId='22222222-2222-4222-8222-222222222222';
function makePresentation(layered=true) {
  const assets=[['table',tableId,'Bordbild','image/png'],['background',backgroundId,'Bakgrundsfilm','video/webm']].map(([role,id,label,contentType])=>{
    const asset={schemaVersion:1,id,role,label,contentType,sha256:'a'.repeat(64),size:32,width:1920,height:1080};
    return {...asset,pathname:layerAssetPath(asset)};
  });
  const lane={...defaultPresentationLane(),label:'Tilldelad presentation',dealers:['astrid','vera'],operatorAdjustable:['table','table.color','background','dealer','branding'],
    layers:{table:{enabled:true,default:tableId,allowed:[tableId],colors:['#112233']},background:{enabled:true,mode:'video',default:backgroundId,allowed:[backgroundId]},dealer:{enabled:true,default:'astrid',allowed:['astrid','vera']}},
    ...(layered?{composition:defaultCompositionSettings()}: {})};
  return validatePresentationPackage({schemaVersion:1,projectRevision:'test-r1',lanes:[lane],assets});
}

test('assigned layers keep their exact image/video formats and published defaults',()=>{
  const presentation=makePresentation();
  const [profile]=partnerPackageProfiles(presentation,{dealer:'vera'},'op-1');
  assert.equal(profile.operatorId,'op-1');
  assert.equal(profile.dealer,'vera');
  assert.equal(profile.layers.table.contentType,'image/png');
  assert.equal(profile.layers.background.contentType,'video/webm');
  assert.equal(profile.layers.table.selected,tableId);
  assert.equal(profile.compatibility,'per-clip');
  const state=partnerLaneState(presentation.lanes[0],{lane:'foreign-lane',dealer:'vera'},presentation.assets);
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
  const html=renderToStaticMarkup(React.createElement(PartnerPackageView,{snapshot:{operator:{slug:'north'},presentation:makePresentation()},view:'test'}));
  assert.match(html,/Tre separata lager/);
  assert.match(html,/Bordbild/);
  assert.match(html,/Bakgrundsfilm/);
  assert.match(html,/image\/png/);
  assert.match(html,/video\/webm/);
  assert.match(html,/\/play\/blackjack\?operator=north&amp;lane=mobile-phone/);
  assert.doesNotMatch(html,/<svg|<iframe|1,000|10 000|localStorage/);
});
test('old package requests republication rather than pretending that prototype assets are assigned',()=>{
  const html=renderToStaticMarkup(React.createElement(PartnerPackageView,{snapshot:{operator:{slug:'north'}},view:'design'}));
  assert.match(html,/saknar det publicerade trelagersformatet/);
  assert.doesNotMatch(html,/Öppna spelbord|<svg|Dark Hall/);
});

for (const schemaVersion of [1,2]) test('owned room preview ignores guessed runtime lanes with presentation v'+schemaVersion,()=>{
  const presentation={...makePresentation(),schemaVersion,...(schemaVersion===2?{registeredDealers:[]}: {})};
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
  lane.dealers=['johanna'];lane.layers.dealer={enabled:true,default:'johanna',allowed:['johanna']};
  const presentation={schemaVersion:2,lanes:[lane],assets:[],registeredDealers:[{id:'johanna',label:'Johanna Studio',idle:null}]};
  const state=partnerPackageProfiles(presentation,{},'north-id')[0];
  assert.equal(state.dealer,'johanna');assert.equal(state.layers.dealer.label,'Johanna Studio');
  const html=renderToStaticMarkup(React.createElement(PartnerPackageView,{snapshot:{operator:{id:'north-id',slug:'north'},presentation},view:'design'}));
  assert.match(html,/Johanna Studio/);
});
