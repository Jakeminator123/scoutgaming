import test from 'node:test';
import assert from 'node:assert/strict';
import {assertPresentationRoomMaterials} from '../packages/presentation/contracts/presentation-material-game.mjs';
import {materialSource} from '../packages/presentation/contracts/material-catalog.mjs';
const source=materialSource('blackjack-green-felt');
const asset={id:'uploaded-layer',role:'table',...source};
const fixture=()=>({assets:[structuredClone(asset)],lanes:[{id:'scene',layers:{background:{allowed:[],default:null},table:{allowed:[asset.id],default:asset.id}}}]});
const room={presentationLaneId:'scene',game:'blackjack'};
const mismatch=error=>error.code==='studio_presentation_game_material_mismatch'&&error.statusCode===422;
test('the same supplied table is allowed for blackjack and rejected for roulette',()=>{
  const presentation=fixture(),before=structuredClone(presentation);assertPresentationRoomMaterials(presentation,room);
  assert.throws(()=>assertPresentationRoomMaterials(presentation,{...room,game:'roulette'}),mismatch);assert.deepEqual(presentation,before);
});
test('a disallowed table in the choice pool cannot bypass the default check',()=>{
  const presentation=fixture();presentation.lanes[0].layers.table.default=null;
  assert.throws(()=>assertPresentationRoomMaterials(presentation,{...room,game:'roulette'}),mismatch);
});
test('forged metadata or relabelling cannot remove the game binding of known bytes',()=>{
  for(const patch of [{label:'Roulette table'},{width:1920},{size:source.size-1},{contentType:'image/jpeg'},{role:'background'}]){
    const presentation=fixture();Object.assign(presentation.assets[0],patch);
    assert.throws(()=>assertPresentationRoomMaterials(presentation,{...room,game:'roulette'}),mismatch);
  }
});
test('a table cannot become a background by moving its reference',()=>{
  const presentation=fixture();presentation.assets[0].role='background';presentation.lanes[0].layers.background={allowed:[asset.id],default:asset.id};presentation.lanes[0].layers.table={allowed:[],default:null};
  assert.throws(()=>assertPresentationRoomMaterials(presentation,room),mismatch);
});
test('unknown historical tables remain blackjack-only without name inference',()=>{
  const presentation=fixture();presentation.assets[0].sha256='0'.repeat(64);presentation.assets[0].label='Blackjack · grön filt';
  assert.doesNotThrow(()=>assertPresentationRoomMaterials(presentation,room));
  assert.throws(()=>assertPresentationRoomMaterials(presentation,{...room,game:'roulette'}),mismatch);
});
test('explicit table game isolates unknown videos while shared backgrounds remain reusable',()=>{
  for(const contentType of ['video/mp4','video/webm']){
    const presentation=fixture();Object.assign(presentation.assets[0],{sha256:'0'.repeat(64),contentType,game:'roulette'});
    assert.doesNotThrow(()=>assertPresentationRoomMaterials(presentation,{...room,game:'roulette'}));
    assert.throws(()=>assertPresentationRoomMaterials(presentation,room),mismatch);
    presentation.assets.push({id:'background',role:'background',sha256:'1'.repeat(64),contentType});
    presentation.lanes[0].layers.background={default:'background',allowed:['background']};
    assert.doesNotThrow(()=>assertPresentationRoomMaterials(presentation,{...room,game:'roulette'}));
  }
});
test('a known blackjack hash cannot be reclassified by a forged roulette tag',()=>{
  const presentation=fixture();presentation.assets[0].game='roulette';
  for(const game of ['blackjack','roulette'])assert.throws(()=>assertPresentationRoomMaterials(presentation,{...room,game}),mismatch);
});
