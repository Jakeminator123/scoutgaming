import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url),{transformSync}=require('next/dist/build/swc');
function render({dirty=false,stale=false,ready=true}={}) {
 const state={context:{operatorId:'op',roomId:'room'},fields:{language:'sv',limitPreset:'high'},busy:false,stale,error:'',message:'',receipt:{draft:{revision:'draft-2'},published:{configVersion:'config-1'},packageRevision:4,publication:{ready}}};
 const controller={subscribe:()=>()=>{},getSnapshot:()=>state,dirty:()=>dirty};
 const module={exports:{}};
 vm.runInNewContext(transformSync(readFileSync(new URL('./room-game-config.tsx',import.meta.url),'utf8'),{filename:'room-game-config.tsx',jsc:{parser:{syntax:'typescript',tsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}}).code,
 {module,exports:module.exports,require:name=>name==='../lib/room-game-config-client.mjs'?{createRoomGameConfigController:()=>controller}:name.endsWith('.css')?{default:{}}:require(name)});
 return renderToStaticMarkup(React.createElement(module.exports.RoomGameConfig,{operatorId:'op',roomId:'room',roomName:'Kvällsbord'}));
}
test('room form presents fixed demo timers, selected saved fields and separate save/publish actions',()=>{
 const html=render();assert.match(html,/Kvällsbord/);assert.match(html,/<option value="sv" selected="">Svenska/);assert.match(html,/<option value="high" selected="">/);
 assert.match(html,/Insatstid: 20 sekunder/);assert.match(html,/Beslutstid: 15 sekunder/);assert.doesNotMatch(html,/<input|workerURL/);
 assert.match(html,/>Spara spelinställningar/);assert.match(html,/>Publicera spelinställningar/);assert.match(html,/config-1/);
});
test('unsaved fields, conflicts and unavailable media each keep publication disabled',()=>{
 for(const options of [{dirty:true},{stale:true},{ready:false}])assert.match(render(options),/<button[^>]+disabled=""[^>]*>Publicera spelinställningar/);
 assert.match(render({ready:false}),/exakt inspelat material/);
});
