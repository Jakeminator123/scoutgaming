import test from 'node:test';
import assert from 'node:assert/strict';
import {appearanceBranding, appearanceDraftRevision, appearanceReceipt, appearanceReview, appearanceRoomStatus, changeAppearance, resetAppearanceRoom, sameAppearance} from '../components/partner-appearance-state.mjs';
test('editable projection excludes N1 metadata and unused branding, preserves independent rooms',()=>{
  assert.deepEqual(appearanceBranding({lane:'main',logo:'never-live',composition:{secret:true},roomOverrides:{vip:{dealer:'vera',lane:'foreign',logo:'no'},main:{table:'table-a'}}}),{lane:'main',roomOverrides:{main:{table:'table-a'},vip:{dealer:'vera'}}});
  assert.equal(sameAppearance({color:'#112233',dealer:'vera'},{dealer:'vera',color:'#112233'}),true);
});
test('tombstone draft revision remains monotonic after publish and controls the next CAS',()=>{
  assert.equal(appearanceDraftRevision({draft:null,draftRevision:8}),8);
  assert.equal(appearanceDraftRevision({draft:{revision:9},draftRevision:9}),9);
});
test('room reset removes only its own override without mutating the source',()=>{
  const input={color:'#112233',roomOverrides:{main:{color:'#445566'},vip:{dealer:'vera'}}};
  assert.deepEqual(resetAppearanceRoom(input,'main'),{color:'#112233',roomOverrides:{vip:{dealer:'vera'}}});assert.equal(input.roomOverrides.main.color,'#445566');
  assert.deepEqual(changeAppearance(input,{roomId:'vip',key:'lane',selection:'forbidden'}),input);
});
test('global lane change clears mismatched layer choices but preserves room overrides',()=>{
  assert.deepEqual(changeAppearance({lane:'first',color:'#112233',dealer:'vera',roomOverrides:{vip:{dealer:'astrid'}}},{key:'lane',selection:'next'}),{lane:'next',roomOverrides:{vip:{dealer:'astrid'}}});
});
test('review rejects malformed or mismatched records before publication can be offered',()=>{
  const expected={draftRevision:4,packageRevision:8,branding:{color:'#112233'}},base={...expected,reviewToken:'token',changes:[{roomId:null,key:'color',before:null,after:'#112233'}],affectedRooms:['main']};
  assert.equal(appearanceReview(base,expected),true);
  for(const changed of [{draftRevision:3},{branding:{color:'#445566'}},{changes:[{roomId:null,key:'unsafe',before:null,after:'x'}]},{affectedRooms:[3]},{hiddenTableChanges:-1},{hiddenTableChanges:1.5},{hiddenTableChanges:'2'},{tablesHidden:'yes'}])assert.equal(appearanceReview({...base,...changed},expected),false);
  assert.equal(appearanceReview({...base,changes:[],affectedRooms:[],hiddenTableChanges:2,tablesHidden:true},expected),true);
});

test('receipts accept explicit supported games and legacy rooms but reject unknown game metadata',()=>{
 const base={operatorId:'north',packageRevision:1,lanes:[],adjustable:[],branding:{},canConfigure:true,draft:null,draftRevision:0,history:[]};
 for(const game of ['blackjack','roulette',undefined,'poker',null]){
  const rooms=[{id:'main',label:'Main',presentationLaneId:'shared',...(game===undefined?{}:{game})}];
  assert.equal(appearanceReceipt({...base,rooms},'north'),game===undefined||game==='blackjack'||game==='roulette');
 }
});

test('room status follows the published choice, then the company choice for the same composition, then the composition default',()=>{
 const lane=id=>({id,layers:{background:{default:'bg-default',allowed:['bg-default','bg-two']},dealer:{default:'astrid',allowed:['astrid','vera']},table:{default:'table-default',allowed:['table-default']}}});
 const state={packageRevision:7,draftRevision:2,draft:{revision:2,basePackageRevision:7,branding:{dealer:'vera'}},
  branding:{lane:'main',background:'bg-two',roomOverrides:{vip:{dealer:'vera'}}},
  presentation:{lanes:[lane('main'),lane('other')]},rooms:[{id:'main-room',label:'Main',presentationLaneId:'main'},{id:'vip',label:'VIP',presentationLaneId:'main'},{id:'alt',label:'Alt',presentationLaneId:'other'}]};
 assert.deepEqual(appearanceRoomStatus(state,'vip'),{roomId:'vip',laneId:'main',packageRevision:7,draftRevision:2,draft:true,live:{background:'bg-two',dealer:'vera',table:'table-default'}});
 assert.deepEqual(appearanceRoomStatus(state,'main-room').live,{background:'bg-two',dealer:'astrid',table:'table-default'},'the unsaved draft dealer is not live');
 assert.deepEqual(appearanceRoomStatus(state,'alt').live,{background:'bg-default',dealer:'astrid',table:'table-default'},'another composition does not inherit company choices');
 assert.equal(appearanceRoomStatus({...state,draft:null,draftRevision:3},'vip').draft,false);
 assert.equal(appearanceRoomStatus(state,'missing'),null);
});

test('the primary action counts every differing company and table choice, ignoring unsupported fields', async () => {
  const {appearanceChangeCount} = await import('../components/partner-appearance-state.mjs');
  const live = {lane: 'main', background: 'bg-a', roomOverrides: {vip: {dealer: 'vera'}}};
  assert.equal(appearanceChangeCount(live, {...live, logo: 'never-live'}), 0);
  assert.equal(appearanceChangeCount({...live, background: 'bg-b'}, live), 1);
  assert.equal(appearanceChangeCount({...live, roomOverrides: {vip: {dealer: 'astrid', table: 'oak'}, main: {background: 'bg-c'}}}, live), 3);
  assert.equal(appearanceChangeCount({lane: 'main'}, live), 2, 'a removed override counts as a change');
});

test('choice cards get plain labels and initials; previews are never read outside the browser', async () => {
  const {choiceInitials, displayLabel, loadPreviewMedia, previewChoiceMedia} = await import('../components/partner-preview-media.mjs');
  assert.equal(displayLabel('PAOW · paow-20261027'), 'PAOW'); assert.equal(displayLabel('paow-20261027'), 'Paow'); assert.equal(displayLabel('Green felt'), 'Green felt');
  assert.equal(choiceInitials('Green felt'), 'GF'); assert.equal(choiceInitials('PAOW'), 'PA'); assert.equal(choiceInitials(''), '?');
  assert.equal(await loadPreviewMedia({operatorSlug: 'north', roomId: 'room-a', dealerId: 'astrid', packageRevision: 7}), null, 'no window, no request');
  const payload = {media: {dealer: {src: '/d', contentType: 'video/webm'}, tables: [{id: 't', src: '/t', contentType: 'image/png'}], backgrounds: []}};
  assert.deepEqual(previewChoiceMedia(payload, 'dealer'), {src: '/d', contentType: 'video/webm'});
  assert.deepEqual(previewChoiceMedia(payload, 'table', 't'), {src: '/t', contentType: 'image/png'});
  assert.equal(previewChoiceMedia(payload, 'background', 'x'), null); assert.equal(previewChoiceMedia(null, 'dealer'), null);
});
