import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url),{transformSync}=require('next/dist/build/swc');
function render({dirty=false,stale=false,ready=true,reason,materialReason,dealers,draft={revision:'draft-2'}}={}) {
 const state={context:{operatorId:'op',roomId:'room'},fields:{language:'sv',limitPreset:'high'},busy:false,stale,error:'',message:'',receipt:{draft,published:{configVersion:'config-1'},packageRevision:4,publication:{ready,reason,materialReason}}};
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
test('conflicts and unavailable media keep publication disabled; Publicera saves unsaved fields itself',()=>{
 for(const options of [{stale:true},{ready:false}])assert.match(render(options),/<button[^>]+disabled=""[^>]*>Publicera spelinställningar/);
 assert.doesNotMatch(render({dirty:true,ready:false}),/<button[^>]+disabled=""[^>]*>Publicera spelinställningar/);
 assert.match(render({ready:false}),/Något hindrar publiceringen\./);
});
test('every material reason is one Swedish sentence with a button, never a raw code',()=>{
 const expected=[
  ['native_material_measurement_missing',/Klippen saknar aktuell tidsmätning\./,/data-action="blocker-measure"[^>]*>Mät omätta klipp</],
  ['native_material_speech_slot_missing',/En replik saknar godkänt tal på svenska\./,/href="\/admin\/dealers\/paow\?flik=tal"[^>]*>Öppna Röst och tal</],
  ['native_material_bank_incomplete',/PAOW saknar klipp för ett fack\./,/href="\/admin\/dealers\/paow\?flik=klipp"[^>]*>Öppna Klippkartan</],
  ['native_material_profile_missing',/Dealern saknar filmad profil \(landningar\)\. Välj Använd PAOW:s landningar för dealers från dealer-fabriken, eller mät\./,/href="\/admin\/dealers\/paow\?flik=landningar"[^>]*>Öppna Landningar</],
  ['native_material_take_audio_truncated',/Ett klipp är tekniskt fel: ljudet fortsätter efter klippbytet\./,/>Öppna Klippkartan</],
 ];
 for(const [materialReason,text,action] of expected){
  const html=render({ready:false,reason:'studio_room_game_material_unavailable',materialReason,dealers:[{id:'paow',name:'PAOW'}]});
  assert.match(html,text);assert.match(html,action);assert.doesNotMatch(html,/[a-z]+_[a-z]+_[a-z_]+/,materialReason);
  assert.match(html,/<button[^>]+disabled=""[^>]*>Publicera spelinställningar/);
 }
});
test('a missing draft is no blocker: Publicera saves it, and unknown reasons stay neutral',()=>{
 // Utan utkast prövar servern det som Publicera sparar (#662): kvittot är klart eller har ett materialskäl.
 const draftless=render({ready:true,draft:null});
 assert.doesNotMatch(draftless,/utkast som|draft_required|Något hindrar/);
 assert.doesNotMatch(draftless,/<button[^>]+disabled=""[^>]*>Publicera spelinställningar/);
 for(const options of [
  {reason:'unknown_private_detail',materialReason:'native_material_measurement_missing'},
  {materialReason:'native_material_measurement_missing'},
 ]){
  const html=render({ready:false,...options});assert.match(html,/Något hindrar publiceringen/);
  assert.doesNotMatch(html,/unknown_private_detail|__proto__|Mät omätta/);
 }
 for(const materialReason of ['unknown_private_detail','__proto__'])
  assert.doesNotMatch(render({ready:false,reason:'studio_room_game_material_unavailable',materialReason}),/unknown_private_detail|__proto__|Mät omätta/);
 const ready=render({reason:'studio_room_game_material_unavailable',materialReason:'native_material_measurement_missing'});
 assert.doesNotMatch(ready,/Mät omätta|Något hindrar/);
});
