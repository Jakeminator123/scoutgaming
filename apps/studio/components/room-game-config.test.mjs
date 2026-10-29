import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url),{transformSync}=require('next/dist/build/swc');
function render({dirty=false,stale=false,ready=true,reason,materialReason,dealers}={}) {
 const state={context:{operatorId:'op',roomId:'room'},fields:{language:'sv',limitPreset:'high'},busy:false,stale,error:'',message:'',receipt:{draft:{revision:'draft-2'},published:{configVersion:'config-1'},packageRevision:4,publication:{ready,reason,materialReason}}};
 const controller={subscribe:()=>()=>{},getSnapshot:()=>state,dirty:()=>dirty};
 const module={exports:{}};
 vm.runInNewContext(transformSync(readFileSync(new URL('./room-game-config.tsx',import.meta.url),'utf8'),{filename:'room-game-config.tsx',jsc:{parser:{syntax:'typescript',tsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}}).code,
 {module,exports:module.exports,require:name=>name==='../lib/room-game-config-client.mjs'?{createRoomGameConfigController:()=>controller}:name.endsWith('.css')?{default:{}}:require(name)});
 return renderToStaticMarkup(React.createElement(module.exports.RoomGameConfig,{operatorId:'op',roomId:'room',roomName:'Kvällsbord',dealers}));
}
test('room form presents fixed demo timers, selected saved fields and separate save/publish actions',()=>{
 const html=render();assert.match(html,/Kvällsbord/);assert.match(html,/<option value="sv" selected="">Svenska/);assert.match(html,/<input type="radio"[^>]*name="limit-preset-room" checked="" value="high"/);
 assert.equal((html.match(/type="radio"/g)??[]).length,3);assert.doesNotMatch(html,/<option value="(casual|prive|high)"|>casual<|>prive<|>high</);
 assert.match(html,/Insatstid: 20 sekunder/);assert.match(html,/Beslutstid: 15 sekunder/);assert.doesNotMatch(html,/<input(?![^>]*type="radio")|workerURL/);
 assert.match(html,/>Spara spelinställningar/);assert.match(html,/>Publicera spelinställningar/);assert.match(html,/config-1/);
});
test('bet profiles are stake cards with the engine numbers and one line on the difference, without place names or pictures',()=>{
 const html=render();
 for(const label of ['Casual','Privé','High'])assert.match(html,new RegExp('>'+label+'</strong>'));
 assert.doesNotMatch(html,/<img|Studion|Salongen|Loungen|room-(studion|salongen|loungen)\.png/,'the room picture is the miljöbild, never the bet profile');
 const n=value=>value.toLocaleString('sv-SE');
 assert.ok(html.includes(n(100)+'–'+n(25000)));assert.ok(html.includes(n(50000)+' spelpengar'));assert.ok(html.includes('>'+n(200)+'<'));
 assert.match(html,/Samma spel och regler\. Skillnaden är insatsnivå, marker och påfyllning/);assert.match(html,/<legend[^>]*>Insatsprofil<\/legend>/);
});
test('unsaved fields, conflicts and unavailable media each keep publication disabled',()=>{
 for(const options of [{dirty:true},{stale:true},{ready:false}])assert.match(render(options),/<button[^>]+disabled=""[^>]*>Publicera spelinställningar/);
 assert.match(render({ready:false}),/exakt inspelat material/);
});
test('verified material reasons explain the next action while publication stays disabled',()=>{
 const expected=[
  ['native_material_measurement_missing',/Mät omätta klipp/],['native_material_measurement_mismatch',/Mät omätta klipp/],
  ['native_material_speech_slot_missing',/godkänd talreplik för valt språk/],['native_material_speech_unbound',/godkänd talreplik för valt språk/],
  ['native_material_bank_incomplete',/klippbanken är ofullständig/],['native_material_idle_missing',/klippbanken är ofullständig/],
  ['native_material_profile_missing',/Dealern saknar filmad profil \(landningar\)\. Välj <em>Använd PAOW:s landningar<\/em> för dealers från dealer-fabriken, eller mät\. Öppna <a href="\/admin\/dealers">Dealers › Landningar<\/a>/],['native_material_contract_unsupported',/filmprofilen saknar stöd/],
  ['native_material_speech_timing_mismatch',/Kontrollera inspelningen/],['native_material_take_audio_truncated',/övergång behöver rättas och granskas/],
  ['native_material_timing_limit',/för långa uppspelningssekvenser/],
 ];
 for(const [materialReason,action] of expected){
  const html=render({ready:false,reason:'studio_room_game_material_unavailable',materialReason});
  assert.match(html,action);assert.doesNotMatch(html,/native_material_/);
  assert.match(html,/<button[^>]+disabled=""[^>]*>Publicera spelinställningar/);
 }
 const measurement=render({ready:false,reason:'studio_room_game_material_unavailable',materialReason:'native_material_measurement_missing'});
 assert.match(measurement,/Publicera sedan i spelbordet/);assert.match(measurement,/inget nytt bild- eller talgodkännande/);
 assert.match(measurement,/Öppna Dealers › dealern i spelbordet och välj Mät omätta klipp/);assert.doesNotMatch(measurement,/Mät speltid/);
 const linked=render({ready:false,reason:'studio_room_game_material_unavailable',materialReason:'native_material_measurement_missing',dealers:[{id:'paow',name:'PAOW'}]});
 assert.match(linked,/Öppna <span><a [^>]*href="\/admin\/dealers\/paow\?flik=klipp"[^>]*>Dealers › PAOW<\/a><\/span> och välj Mät omätta klipp\./);
});
test('draft requirement is separate and unknown or mismatched reasons remain neutral',()=>{
 assert.match(render({ready:false,reason:'studio_room_game_draft_required'}),/Spara spelinställningarna som utkast/);
 for(const options of [
  {reason:'studio_room_game_material_unavailable',materialReason:'unknown_private_detail'},
  {reason:'studio_room_game_material_unavailable',materialReason:'__proto__'},
  {reason:'unknown_private_detail',materialReason:'native_material_measurement_missing'},
  {materialReason:'native_material_measurement_missing'},
 ]){
  const html=render({ready:false,...options});assert.match(html,/Kontrollera rummets miljö/);
  assert.doesNotMatch(html,/unknown_private_detail|__proto__|Mät speltid/);
 }
 const ready=render({reason:'studio_room_game_material_unavailable',materialReason:'native_material_measurement_missing'});
 assert.doesNotMatch(ready,/Mät speltid|Kontrollera rummets miljö/);
});
