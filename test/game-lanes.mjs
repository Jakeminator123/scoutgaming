import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_LANES, gameLaneConfiguration, validateGameLanes } from '../packages/presentation/contracts/game-lanes.mjs';
import {gameLaneSelection, gameLaneFromDocument, packageLaneIds, gamePresentationForDealer} from '../web/public/game-lanes.mjs';
import {laneDealerSelection} from '../packages/presentation/contracts/game-lanes.mjs';
import { isOperatorSlug } from '../packages/navigation/operator-slug.mjs';
import {decorateGameEntryHtml} from '../web/public/game-entry-contract.mjs';
import {playerLoginDestination} from '../packages/navigation/game-entry.mjs';
const portrait={schemaVersion:1,id:'chosen-table',label:'Chosen table',renderer:'portrait-video',dealer:'elin',mediaCollection:'elin-presentation'};
const registry=[{id:'elin',label:'Elin'},{id:'linnea',label:'Linnea'}];
const dataset={gameLane:portrait.id,gameDealer:'elin',gamePresentation:'local',gameLocalDealer:'elin',gameRegisteredDealers:JSON.stringify(registry)};
const selection={lane:portrait.id,dealer:'elin',presentation:'local',localDealer:'elin',registeredDealers:registry};
const env={CROUPIER_STUDIO_NEON_POLICY:'1'};

test('empty configuration has no local dealer or lane; layer preview is explicit',()=>{
 assert.deepEqual(GAME_LANES,[]);assert.deepEqual(gameLaneConfiguration(),{gameLanes:[],gameLane:null});
 assert.throws(()=>gameLaneSelection(''),/configured/);assert.throws(()=>gameLaneFromDocument({}));
 assert.deepEqual(gameLaneSelection('?lane=layer-preview&dealer=dragge'),{lane:'layer-preview',dealer:'dragge',presentation:'layered'});
});
test('saved catalogues validate identity, media ownership and explicit active lane',()=>{
 assert.deepEqual(gameLaneConfiguration({gameLanes:[portrait],gameLane:portrait.id}),{gameLanes:[portrait],gameLane:portrait.id});
 assert.deepEqual(gameLaneSelection('',portrait.id,[portrait]),{lane:portrait.id,dealer:'elin',presentation:'local'});
 for(const change of [{id:'original'},{id:'../bad'},{renderer:'remote-script'},{mediaCollection:'astrid-presentation'},{label:'<script>'}])assert.throws(()=>validateGameLanes([{...portrait,...change}]));
 assert.throws(()=>validateGameLanes([portrait,portrait]));assert.throws(()=>gameLaneConfiguration({gameLanes:[portrait],gameLane:'unknown'}));
});
test('registered dealers need the same explicit document regardless of their name',()=>{
 for(const id of ['astrid','elin','linnea','paow','nora']){
  const data={...dataset,gameDealer:id,gameLocalDealer:id,gameRegisteredDealers:JSON.stringify([{id,label:id}])};
  assert.equal(gameLaneFromDocument(data).dealer,id);
  assert.throws(()=>gameLaneFromDocument({...data,gameRegisteredDealers:'[]'}));
  assert.throws(()=>gameLaneFromDocument({...data,gameLocalDealer:undefined}));
  assert.equal(gamePresentationForDealer(id,'portrait-video'),'local');
 }
 for(const id of ['vera','mei','amira','johanna']){
  assert.throws(()=>gamePresentationForDealer(id,'portrait-video'));
  assert.throws(()=>gameLaneFromDocument({...dataset,gameDealer:id,gameLocalDealer:id,gameRegisteredDealers:JSON.stringify([{id,label:id}])}));
 }
 assert.throws(()=>gamePresentationForDealer('elin','indexed-video'));
});
test('historical indexed catalogues can be read but cannot launch',()=>{
 const legacy={...portrait,id:'old',dealer:'vera',renderer:'indexed-video',mediaCollection:'legacy-dealers'};
 assert.deepEqual(validateGameLanes([legacy]),[legacy]);
 assert.throws(()=>gameLaneSelection('','old',[legacy]),/cloud/);
 assert.throws(()=>gameLaneFromDocument({...dataset,gamePresentation:'original'}));
});
test('package lane selection intersects the saved catalogue',()=>{
 const beta={...portrait,id:'beta'},gamma={...portrait,id:'gamma'},catalogue=[portrait,beta,gamma];
 assert.deepEqual(packageLaneIds(['gamma','unknown','beta','gamma'],catalogue),['gamma','beta']);
 assert.equal(gameLaneSelection('?lane=gamma',portrait.id,catalogue,['beta','gamma']).lane,'gamma');
 assert.equal(gameLaneSelection('?lane=chosen-table',portrait.id,catalogue,['beta','gamma']).lane,'beta');
 assert.throws(()=>packageLaneIds('beta',catalogue));
});
test('an explicit unavailable dealer never silently changes identity',()=>{
 const layer={default:'elin',allowed:['elin','linnea','amira']};
 assert.equal(laneDealerSelection('',portrait,layer),'elin');
 assert.equal(laneDealerSelection('?dealer=linnea',portrait,layer),null);
 assert.equal(laneDealerSelection('?dealer=linnea',portrait,layer,{portraitDealerIds:['linnea']}),'linnea');
 for(const query of ['?dealer=vera','?dealer=mei','?dealer=amira','?dealer=johanna','?dealer=foreign','?dealer=elin&dealer=linnea'])assert.equal(laneDealerSelection(query,portrait,layer,{portraitDealerIds:['linnea','vera','mei','amira','johanna']}),null);
});
test('document attributes escape branding and reject injected identities',()=>{
 const branding={felt:'#0a5"><script>alert(1)</script>',note:'& <b>'};
 const html=decorateGameEntryHtml('<html lang="sv">',env,{...selection,operator:'sg-test',packageRevision:3,branding});
 assert.doesNotMatch(html,/<script/);assert.match(html,/data-game-local-dealer="elin"/);
 const decode=text=>text.replace(/&(amp|quot|#39|lt|gt);/g,(_,name)=>({amp:'&',quot:'"','#39':"'",lt:'<',gt:'>'})[name]);
 assert.deepEqual(JSON.parse(decode(/data-game-branding="([^"]*)"/.exec(html)[1])),branding);
 for(const change of [{dealer:'"><script>'},{dealer:'amira'},{registeredDealers:[]},{localDealer:'linnea'},{presentation:'original'}])assert.throws(()=>decorateGameEntryHtml('<html>',env,{...selection,...change}));
});
test('operator metadata is bounded and login carries only approved selectors',()=>{
 for(const slug of ['sg-test','demo-north','a'])assert.equal(isOperatorSlug(slug),true);
 for(const slug of ['','SG','sg_test','play','api',null])assert.equal(isOperatorSlug(slug),false);
 assert.equal(playerLoginDestination(new URL('https://game.invalid/blackjack?operator=sg-test&lane=chosen-table&launch=a.b.c&returnTo=https://evil.invalid')),'/player-login?lane=chosen-table&operator=sg-test');
 const d={...dataset,gameOperator:'sg-test',gamePackageRevision:'3',gameBranding:'{}'};
 assert.equal(gameLaneFromDocument(d).packageRevision,3);
 for(const change of [{gameOperator:'Bad'},{gameOperator:undefined},{gamePackageRevision:'0'},{gamePackageRevision:'1e3'},{gameBranding:'[]'},{gameBranding:'null'},{gameBranding:'{'}])assert.throws(()=>gameLaneFromDocument({...d,...change}));
});
test('layered presentation is accepted only in its explicit lane',()=>{
 for(const id of ['dragge'])assert.deepEqual(gameLaneFromDocument({gameLane:'layer-preview',gameDealer:id,gamePresentation:'layered'}),{lane:'layer-preview',dealer:id,presentation:'layered'});
 assert.throws(()=>gameLaneFromDocument({...dataset,gamePresentation:'layered'}));
 assert.throws(()=>gameLaneFromDocument({gameLane:'layer-preview',gameDealer:'astrid',gamePresentation:'layered'}));
 assert.throws(()=>gameLaneFromDocument({gameLane:'layer-preview',gameDealer:'paow',gamePresentation:'layered'}));
 assert.throws(()=>gameLaneSelection('?lane=layer-preview&dealer=paow'),/not available/);
 assert.deepEqual(gameLaneSelection('?lane=layer-preview'),{lane:'layer-preview',dealer:'dragge',presentation:'layered'});
});

test('retiring the active lane leaves an explicit empty choice even when other lanes remain',()=>{
 const configuration={gameLanes:[portrait],gameLane:null};
 assert.deepEqual(gameLaneConfiguration(configuration),configuration);
 assert.throws(()=>gameLaneSelection('',null,[portrait]),/configured/);
 assert.deepEqual(gameLaneSelection('?lane=chosen-table',null,[portrait]),{lane:portrait.id,dealer:'elin',presentation:'local'});
 assert.throws(()=>gameLaneConfiguration({gameLanes:[portrait]}),/active lane/);
 assert.throws(()=>gameLaneConfiguration({gameLanes:[],gameLane:portrait.id}),/active lane/);
});
