import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {availablePartnerRooms,initialPartnerRoomSelection} from '../lib/partner-room-selection.mjs';
import {partnerCopy} from '../components/kevin-bo/partner-copy.mjs';
const require=createRequire(import.meta.url);
const {PartnerRoomWorkspace}=require('../components/kevin-bo/views/rooms.jsx');
const operator={id:'north',slug:'north-casino',name:'North'};
const snapshot={operator,presentations:[],tables:[
  {id:'main-room',name:'Main',operatorId:'north',status:'active'},
  {id:'vip-room',name:'VIP',operatorId:'north',status:'active'},
  {id:'paused-room',name:'Paused',operatorId:'north',status:'paused'},
  {id:'archived-room',name:'Archived',operatorId:'north',status:'archived'},
  {id:'foreign-room',name:'Foreign',operatorId:'south',status:'active'},
]};
test('room deep links resolve exact registered ownership and active status without fallback',()=>{
  assert.deepEqual(availablePartnerRooms(snapshot).map(room=>room.id),['main-room','vip-room']);
  assert.deepEqual(initialPartnerRoomSelection(snapshot,'vip-room'),{roomId:'vip-room',unavailable:false});
  assert.deepEqual(initialPartnerRoomSelection(snapshot),{roomId:'main-room',unavailable:false});
  for(const room of ['foreign-room','paused-room','archived-room','missing','', '../main-room',['main-room','vip-room']])
    assert.deepEqual(initialPartnerRoomSelection(snapshot,room),{roomId:'',unavailable:true});
});
test('unavailable room links render no default preview or appearance controls',()=>{
  for(const initialRoomId of ['foreign-room','missing',['main-room','vip-room']]){
    const html=renderToStaticMarkup(React.createElement(PartnerRoomWorkspace,{snapshot,copy:partnerCopy('sv'),language:'sv',initialRoomId,apiBase:'/studio/api/partner/snapshot'}));
    assert.match(html,/Det begärda rummet är inte tillgängligt/);
    assert.doesNotMatch(html,/Hämtar utseende|kevin-package/);
  }
});
test('the exact room is selected in server markup before client hydration',()=>{
  const html=renderToStaticMarkup(React.createElement(PartnerRoomWorkspace,{snapshot,copy:partnerCopy('sv'),language:'sv',initialRoomId:'vip-room',apiBase:'/studio/api/partner/snapshot'}));
  assert.match(html,/<option value="vip-room" selected="">VIP<\/option>/);
  assert.doesNotMatch(html,/Foreign|Paused|Archived|Rummet är inte tillgängligt/);
  assert.match(html,/Hämtar utseende/);
});
