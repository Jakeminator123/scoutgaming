import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url),module={exports:{}};
const {transformSync}=require('next/dist/build/swc');
const source=readFileSync(new URL('./studio-administration.tsx',import.meta.url),'utf8');
vm.runInNewContext(transformSync(source,{filename:'studio-administration.tsx',jsc:{parser:{syntax:'typescript',tsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}}).code,{
 module,exports:module.exports,
 require:name=>name.endsWith('.module.css')?{__esModule:true,default:{}}:name==='./dealer-video-surface'?{DealerClipPreview:()=>null}:name==='./studio-navigation'?{StudioNavigation:()=>null}:require(name),
});
function render(savedDealers){
 return renderToStaticMarkup(React.createElement(module.exports.StudioAdministrationView,{
  actor:{username:'reviewer',role:'admin'},group:'tables',busy:false,available:()=>true,command(){throw Error('Unexpected write');},onReload(){},
  resources:{config:{payload:{revision:'saved-1',gameLanes:[],gameLane:null,tiers:{classic:'amira'},rooms:[],savedDealers}}},
 }));
}
test('standard-dealer controls offer only saved identities, including new Dragan and Anna',()=>{
 const html=render([{id:'dragan',label:'Dragan'},{id:'anna',label:'Anna'}]);
 assert.match(html,/<option[^>]*value="dragan"[^>]*>Dragan<\/option>/);
 assert.match(html,/<option[^>]*value="anna"[^>]*>Anna<\/option>/);
 for(const id of ['amira','vera','mei','paow','paow-v2'])assert.doesNotMatch(html,new RegExp('<option[^>]*value="'+id+'"'));
});
test('missing and empty registered dealers never restore a fixed roster or enabled save',()=>{
 for(const savedDealers of [null,[]]){
  const html=render(savedDealers);
  assert.doesNotMatch(html,/<option[^>]*value="(?:amira|vera|astrid|mei)"/);
  assert.match(html,/<button disabled="">Spara dealer<\/button>/);
 }
});
