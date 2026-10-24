import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCardView,cardViewDepth} from '../packages/presentation/contracts/card-view.mjs';
import {defaultBlackjackTableGeometry,defaultCompositionSettings,validateCompositionSettings} from '../packages/presentation/contracts/composition-settings.mjs';
import {mountSharedRoomPresentation} from '../services/game/public/shared-room-presentation.mjs';
test('saved card display validates each table format and survives round-trip',()=>{
 const board=defaultBlackjackTableGeometry('00000000-0000-4000-8000-000000000002');
 board.mobile.cardView='table';board.desktop.cardView='raised';
 const settings={...defaultCompositionSettings(),blackjackTables:[board]};
 const saved=validateCompositionSettings(JSON.parse(JSON.stringify(settings)));
 assert.equal(saved.blackjackTables[0].mobile.cardView,'table');assert.equal(saved.blackjackTables[0].desktop.cardView,'raised');
 assert.equal(cardViewDepth(saved.blackjackTables[0].mobile.cardView),.62);assert.equal(cardViewDepth(saved.blackjackTables[0].desktop.cardView),1);
 for(const invalid of ['other',null,{},true]){const next=structuredClone(settings);next.blackjackTables[0].mobile.cardView=invalid;assert.throws(()=>validateCompositionSettings(next));}
 assert.equal(normalizeCardView('invalid'),'raised');
});

test('shared rooms use the published card display and the same default in every layout path',async t=>{
 for(const compact of [false,true])for(const mode of ['fallback','film','table-default','table','raised'])await t.test(`${compact?'mobile':'desktop'} / ${mode}`,async()=>{
  const format=compact?'mobile':'desktop',board=defaultBlackjackTableGeometry('00000000-0000-4000-8000-000000000002');
  if(mode==='table'||mode==='raised')board[format].cardView=mode;
  const width=compact?390:960,height=compact?844:540,rect={x:0,y:0,width,height};
  const plane=mode==='fallback'?null:mode==='film'?{x:0,y:0,scale:.4}:{rect,tableGeometry:board,tableLayout:format};
  const host={getBoundingClientRect:()=>({left:0,top:0,width,height})};
  let projected;
  const presentation=await mountSharedRoomPresentation({
   document:{getElementById:id=>id==='scene'||id==='table2d'?host:null},
   window:{matchMedia:()=>({matches:compact}),addEventListener(){},removeEventListener(){},fetch(){assert.fail('layout must not request data');}},
   selection:{presentation:'local',dealer:'test-dealer',localDealer:'test-dealer',registeredDealers:[{id:'test-dealer',label:'Test'}]},
   onReady(){},onError(error){assert.fail(error);},
   createComposition:()=>plane?{referencePlane:()=>plane,onGeometryChange:()=>()=>{},close(){}}:null,
   loadAdapters:async()=>[
    {PerformancePlayer:class {dispose(){}}},
    {createLocalPresentation:async()=>({start(){},close(){}})},
    {createLocalCardOverlay:()=>({setProjection:value=>{projected=value;},close(){}})},
   ],
  });
  try {
   const seats=Array.from({length:7},()=>({style:{setProperty(){}}}));
   presentation.layout({snapshot:{round:null,me:{seats:[3]}},seats});
   assert.equal(projected.cardView,mode==='raised'?'raised':'table');
   assert.deepEqual(projected.boxes,compact?[2,3,4]:[0,1,2,3,4,5,6]);
  } finally {presentation.close();}
 });
});
