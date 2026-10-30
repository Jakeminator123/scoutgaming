import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
const require=createRequire(import.meta.url),{transformSync}=require('next/dist/build/swc');
// The form renders in Admin with Admin's kit, so React, the kit and its packages all come from client/.
const client=createRequire(new URL('../client/package.json',import.meta.url)),React=client('react'),{renderToStaticMarkup}=client('react-dom/server');
function load(url,controller,hooks=React){
 const module={exports:{}},local=createRequire(url);
 vm.runInNewContext(transformSync(readFileSync(url,'utf8'),{filename:fileURLToPath(url),jsc:{parser:{syntax:'typescript',tsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}}).code,
  {module,exports:module.exports,require:name=>name==='../lib/room-game-config-client.mjs'?{createRoomGameConfigController:()=>controller}:name.endsWith('.css')?{default:{}}
   :name==='react'?hooks:/^react\//.test(name)?client(name):/^\.\.?\//.test(name)&&!/\.[cm]?js$/.test(name)?load(new URL(name+'.tsx',url),controller,hooks):local(name)});
 return module.exports;
}
function render({dirty=false,stale=false,ready=true,reason,materialReason,dealers,draft={revision:'draft-2'}}={}) {
 const state={context:{operatorId:'op',roomId:'room'},fields:{language:'sv',limitPreset:'high'},busy:false,stale,error:'',message:'',receipt:{draft,published:{configVersion:'config-1'},packageRevision:4,publication:{ready,reason,materialReason}}};
 const controller={subscribe:()=>()=>{},getSnapshot:()=>state,dirty:()=>dirty};
 return renderToStaticMarkup(React.createElement(load(new URL('./room-game-config.tsx',import.meta.url),controller).RoomGameConfig,{operatorId:'op',roomId:'room',roomName:'Kvällsbord',dealers}));
}
test('room form presents fixed demo timers and selected saved fields',()=>{
 const html=render();assert.match(html,/Kvällsbord/);assert.match(html,/<option value="sv" selected="">Svenska/);assert.match(html,/<input type="radio"[^>]*name="limit-preset-room" checked="" value="high"/);
 assert.equal((html.match(/type="radio"/g)??[]).length,3);assert.doesNotMatch(html,/<option value="(casual|prive|high)"|>casual<|>prive<|>high</);
 assert.match(html,/Insatstid: 20 sekunder/);assert.match(html,/Beslutstid: 15 sekunder/);assert.doesNotMatch(html,/<input(?![^>]*type="radio")|workerURL/);
 assert.match(html,/>Spara spelinställningar/);assert.match(html,/config-1/);
});
test('central room publication saves game settings without invoking the separate publisher',async()=>{
 const calls=[],busy=[],state={context:{operatorId:'op',roomId:'room'},fields:{language:'sv',limitPreset:'high'},busy:false,stale:false,receipt:{draft:null,packageRevision:4,publication:{ready:true}}};
 const controller={subscribe:()=>()=>{},getSnapshot:()=>state,dirty:()=>true,save:async()=>{calls.push('save');return state.receipt;},publish:async()=>{calls.push('publish');}};
 const hooks={...React,useRef:value=>({current:value}),useEffect:()=>{},useState:value=>[value,()=>{}],useSyncExternalStore:(_subscribe,get)=>get()};
 const Component=load(new URL('./room-game-config.tsx',import.meta.url),controller,hooks).RoomGameConfig;
 const tree=Component({operatorId:'op',roomId:'room',roomName:'Test',onBusyChange:value=>busy.push(value)});
 const walk=node=>node&&typeof node==='object'?[node,...[node.props?.children].flat(Infinity).flatMap(walk)]:[];
 const buttons=walk(tree);
 assert.equal(buttons.some(node=>node.props?.['data-action']==='publish-game-settings'),false);
 const save=buttons.find(node=>node.props?.['data-action']==='save-game-settings');assert.equal(save.props.disabled,false);
 save.props.onClick();await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(calls,['save']);assert.deepEqual(busy,[true,false]);
});

test('bet profiles are stake cards with the engine numbers and one line on the difference, without place names or pictures',()=>{
 const html=render();
 for(const label of ['Casual','Privé','High'])assert.match(html,new RegExp('>'+label+'</strong>'));
 assert.doesNotMatch(html,/<img|Studion|Salongen|Loungen|room-(studion|salongen|loungen)\.png/,'the room picture is the miljöbild, never the bet profile');
 const n=value=>value.toLocaleString('sv-SE');
 assert.ok(html.includes(n(100)+'–'+n(25000)));assert.ok(html.includes(n(50000)+' spelpengar'));assert.ok(html.includes('>'+n(200)+'<'));
 assert.match(html,/Samma spel och regler\. Skillnaden är insatsnivå, marker och påfyllning/);assert.match(html,/<legend[^>]*>Insatsprofil<\/legend>/);
});
test('conflicts block saving while unavailable media can still be saved for the central review',()=>{
 assert.match(render({stale:true}),/<button[^>]+data-action="save-game-settings"[^>]+disabled=""/);
 assert.doesNotMatch(render({dirty:true,ready:false}),/<button[^>]+data-action="save-game-settings"[^>]+disabled=""/);
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
 }
});
test('a missing draft can be saved and unknown material reasons stay neutral',()=>{
 // Utan utkast prövar servern standardvalen: kvittot är klart eller har ett materialskäl.
 const draftless=render({ready:true,draft:null});
 assert.doesNotMatch(draftless,/utkast som|draft_required|Något hindrar/);
 assert.doesNotMatch(draftless,/<button[^>]+data-action="save-game-settings"[^>]+disabled=""/);
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
