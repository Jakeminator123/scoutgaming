import test from 'node:test';
import assert from 'node:assert/strict';
import {createSeedProject,defaultPresentationLane} from '../../../packages/presentation/contracts/studio-model.mjs';
import {defaultCompositionSettings,defaultBlackjackTableGeometry} from '../../../packages/presentation/contracts/composition-settings.mjs';
import {layerAssetPath} from '../../../packages/presentation/contracts/layer-asset-contract.mjs';
import {AI_TABLE_MISFIT,aiImageLabel,aiPlacementHash,aiTableMisfits} from '../lib/ai-image-contract.mjs';
import {AiTableMisfitError,aiTableMisfitBody,assertAiTableChoiceFits,assertAiTablesFit} from '../lib/ai-table-publication-guard.mjs';
import {publishSavedScene,scenePublicationPreview} from '../lib/scene-publication.mjs';
import {packagePublishError} from '../lib/operator-package-client.mjs';

const REDRAW=/Rita om bordet för den här scenmallen eller välj ett annat bord\./;
const ids={ai:'00000000-0000-4000-8000-0000000000a1',manual:'00000000-0000-4000-8000-0000000000a2'};
function table(id,label) {
  const asset={schemaVersion:1,id,role:'table',game:'blackjack',label,sha256:'a'.repeat(64),size:1024,contentType:'image/webp',width:1215,height:2074};
  return {...asset,pathname:layerAssetPath(asset)};
}
// A PAOW template that shows an AI table drawn for its default placement and a manual table.
function scene({dealers=['paow'],composition=defaultCompositionSettings(),drawnFor=defaultCompositionSettings()}={}) {
  const assets=[table(ids.ai,aiImageLabel('Grön filt',{dealerId:'paow',placement:aiPlacementHash(drawnFor)})),table(ids.manual,'Blackjack · eget bord')];
  const lane={...defaultPresentationLane('astrid'),id:'paow-bord',dealers,composition};
  lane.layers.table={enabled:true,default:ids.ai,allowed:[ids.ai,ids.manual]};
  return {lane,assets};
}

test('the shared check: dealer swap and moved placement are misfits; manual material and a fitting AI table pass',()=>{
  const fits=scene();
  assert.deepEqual(aiTableMisfits([fits.lane],fits.assets),[],'drawn for this dealer and placement');
  assert.deepEqual(aiTableMisfits([scene({dealers:['dragan']}).lane],fits.assets),[],'Dragan lands where PAOW lands');
  const swapped=scene({dealers:['astrid']});
  assert.deepEqual(aiTableMisfits([swapped.lane],swapped.assets),[{compositionId:'paow-bord',assetId:ids.ai,label:swapped.assets[0].label,code:'ai_table_other_dealer',reason:AI_TABLE_MISFIT.ai_table_other_dealer}]);
  const moved=defaultCompositionSettings();moved.desktop.table={width:.5,x:0,y:.35};
  const shifted=scene({composition:moved});
  assert.deepEqual(aiTableMisfits([shifted.lane],shifted.assets).map(row=>[row.assetId,row.code]),[[ids.ai,'ai_table_other_placement']]);
  for (const reason of Object.values(AI_TABLE_MISFIT)) assert.match(reason,REDRAW);
  // Only the manual table: nothing to refuse; a disabled table layer shows no table.
  const manual=scene({dealers:['astrid'],composition:moved});manual.lane.layers.table={enabled:true,default:ids.manual,allowed:[ids.manual]};
  assert.deepEqual(aiTableMisfits([manual.lane],manual.assets),[]);
  swapped.lane.layers.table.enabled=false;assert.deepEqual(aiTableMisfits([swapped.lane],swapped.assets),[]);
});

test('the server guard throws a fixed refusal with template, material and reason code only',()=>{
  const swapped=scene({dealers:['astrid']});
  assert.throws(()=>assertAiTablesFit([swapped.lane],swapped.assets),error=>error instanceof AiTableMisfitError&&error.statusCode===422);
  try { assertAiTablesFit([swapped.lane],swapped.assets); } catch (error) {
    assert.deepEqual(aiTableMisfitBody(error),{error:'ai_table_misfit',code:'ai_table_misfit',compositionId:'paow-bord',assetId:ids.ai,reason:'ai_table_other_dealer'});
  }
  assert.equal(aiTableMisfitBody(new Error('other')),null);
  const fits=scene();assert.doesNotThrow(()=>assertAiTablesFit([fits.lane],fits.assets));
  // An operator's branding choice: the manual table always passes, the AI one only where it fits.
  assert.doesNotThrow(()=>assertAiTableChoiceFits(swapped.lane,swapped.assets,ids.manual));
  swapped.lane.layers.table.enabled=true;
  assert.throws(()=>assertAiTableChoiceFits(swapped.lane,swapped.assets,ids.ai),AiTableMisfitError);
  assert.doesNotThrow(()=>assertAiTableChoiceFits(fits.lane,fits.assets,ids.ai));assert.doesNotThrow(()=>assertAiTableChoiceFits(fits.lane,fits.assets,null));
});

// The client's scene publication: the package presentation gets the saved placement.
function publication({drawnFor}) {
  const published=scene({drawnFor}),project=createSeedProject();
  const savedLane=structuredClone(published.lane);savedLane.composition.desktop.table={width:.5,x:0,y:.35};
  savedLane.composition.blackjackTables=[defaultBlackjackTableGeometry(ids.ai)];
  project.layerAssets=published.assets;project.lanes=[savedLane];
  const presentation={schemaVersion:3,lanes:[published.lane],assets:published.assets,playback:{media:[]}};
  return {project,compositionId:'paow-bord',operatorSlug:'north',saved:savedLane.composition,
    initial:{operatorId:'op-1',packageRevision:7,lanes:['paow-bord'],branding:{},draftRevision:0,draft:null,history:[],rooms:[],presentation}};
}
test('publishing a moved placement in the client is refused with the reason, before any request',async()=>{
  const f=publication({drawnFor:defaultCompositionSettings()});
  await assert.rejects(publishSavedScene({...f,fetchImpl:()=>assert.fail('a refused publication sends nothing')}),error=>REDRAW.test(error.message)&&error.message.startsWith('AI · Grön filt'));
});
test('a fitting AI table is published, and a server refusal shows the same reason',async()=>{
  const f=publication({drawnFor:defaultCompositionSettings()});
  f.initial.presentation.assets[0].label=aiImageLabel('Grön filt',{dealerId:'paow',placement:aiPlacementHash(f.saved)});
  f.project.layerAssets=f.initial.presentation.assets;
  const expected=scenePublicationPreview(f.project,f.compositionId,f.initial.presentation),calls=[];
  const receipt={ok:true,operatorId:'op-1',compositionId:f.compositionId,projectRevision:f.project.revision,packageRevision:8,presentation:expected};
  const saved={...f.initial,packageRevision:8,presentation:expected,operatorId:'op-1'};
  const answer=(value,status=200)=>({ok:status===200,status,json:async()=>structuredClone(value)});
  await publishSavedScene({...f,fetchImpl:async(url,request)=>{calls.push({url,request});return calls.length===1?answer(receipt):answer(saved);}}).catch(()=>{});
  assert.equal(JSON.parse(calls[0].request.body).action,'publish-scene-layout','a fitting AI table reaches the server');
  const refused=publishSavedScene({...f,fetchImpl:async()=>answer({error:'ai_table_misfit',code:'ai_table_misfit',compositionId:f.compositionId,assetId:ids.ai,reason:'ai_table_other_placement'},422)});
  await assert.rejects(refused,error=>REDRAW.test(error.message)&&/annan placering/.test(error.message)&&error.message.startsWith('AI · Grön filt'));
});

test('the package publication in the client shows the server refusal as a reason, not a raw code',()=>{
  const message=packagePublishError(422,{error:'ai_table_misfit',code:'ai_table_misfit',compositionId:'paow-bord',assetId:ids.ai,reason:'ai_table_other_dealer'});
  assert.match(message,/^Scenmallen paow-bord: Bordsgrafiken är ritad för en annan dealer/);assert.match(message,REDRAW);assert.match(message,/Inget publicerades\.$/);
  assert.doesNotMatch(packagePublishError(422,{code:'ai_table_misfit',compositionId:'<script>',reason:'x'}),/script/);
});
