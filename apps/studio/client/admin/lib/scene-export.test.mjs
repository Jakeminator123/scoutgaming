import test from 'node:test';
import assert from 'node:assert/strict';
import {SCENE_EXPORT_PATH,exportSceneIllustration,sceneExportBody,sceneExportMessage} from './scene-export.mjs';

const project={revision:'project-8',lanes:[],layerAssets:[]};
function fetcher(calls,response=Response.json({ok:true,id:'00000000-0000-4000-8000-0000000000a1',label:'Studion · miljöbild v1',skipped:[],project})){
  return async(url,init)=>{calls.push({url,init,body:JSON.parse(init.body)});return response.clone();};
}

test('the export posts the saved environment, its revision and one dealer frame, same-origin and uncached',async()=>{
  const calls=[],captured=[];
  const result=await exportSceneIllustration({laneId:'studion',expectedRevision:'project-7',video:{id:'00000000-0000-4000-8000-0000000000d1',previewUrl:'/studio/api/videos/x'},
    fetchImpl:fetcher(calls),capture:async url=>{captured.push(url);return 'data:image/webp;base64,AAAA';}});
  assert.deepEqual(captured,['/studio/api/videos/x']);
  assert.equal(calls[0].url,SCENE_EXPORT_PATH);
  assert.equal(calls[0].init.method,'POST');assert.equal(calls[0].init.credentials,'same-origin');assert.equal(calls[0].init.cache,'no-store');
  assert.deepEqual(calls[0].body,{laneId:'studion',expectedRevision:'project-7',dealer:{videoId:'00000000-0000-4000-8000-0000000000d1',frame:'data:image/webp;base64,AAAA'}});
  assert.equal(result.dealer,'included');assert.equal(result.label,'Studion · miljöbild v1');assert.deepEqual(result.project,project);
});

test('an unreadable clip leaves the dealer out and says so; no clip sends no dealer field',async()=>{
  const calls=[];
  const missing=await exportSceneIllustration({laneId:'studion',expectedRevision:'project-7',video:{id:'v',previewUrl:'/v'},fetchImpl:fetcher(calls),capture:async()=>{throw Error('tainted');}});
  assert.equal(missing.dealer,'missing');assert.equal(Object.hasOwn(calls[0].body,'dealer'),false);
  const none=await exportSceneIllustration({laneId:'studion',expectedRevision:'project-7',fetchImpl:fetcher(calls)});
  assert.equal(none.dealer,'none');
  assert.deepEqual(sceneExportBody({laneId:'a',expectedRevision:'b'}),{laneId:'a',expectedRevision:'b'});
});

test('server codes become short Swedish messages and nothing is returned',async()=>{
  for(const [code,status,pattern] of [['scene_export_stale',409,/sparats om/],['studio_presentation_runtime_update_required',503,/Spelservern/],['scene_export_dealer_invalid',422,/viloklipp/]]){
    await assert.rejects(exportSceneIllustration({laneId:'studion',expectedRevision:'project-7',fetchImpl:fetcher([],Response.json({error:code,code},{status}))}),
      error=>pattern.test(error.message)&&error.code===code);
  }
  await assert.rejects(exportSceneIllustration({laneId:'studion',expectedRevision:'project-7',fetchImpl:fetcher([],new Response('nope',{status:502}))}),/kunde inte sparas/);
  assert.match(sceneExportMessage('unknown'),/kunde inte sparas/);
});
