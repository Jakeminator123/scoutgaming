import test from 'node:test';
import assert from 'node:assert/strict';
import {createLayerPacksRoute} from '../services/game/layer-packs.mjs';
test('native/cloud legacy layer preview is gone even with its old cookie and missing local files',async()=>{
  for(const env of [{CROUPIER_STUDIO_NEON_POLICY:'1'},{CROUPIER_CLOUD_RUNTIME:'1'}])for(const method of ['GET','HEAD']){
    const route=createLayerPacksRoute({env,previewRoot:'missing-tree'}),response={writeHead(status,headers){this.status=status;this.headers=headers;},end(body){this.body=body;}};
    assert.equal(await route({method,headers:{cookie:'croupier_layer_preview=1'}},response,'/layer-packs/astrid/manifest.json'),true);assert.equal(response.status,410);assert.equal(method==='HEAD'?response.body===undefined:JSON.parse(response.body).error==='legacy_layer_preview_retired',true);
    assert.equal(await route({method,headers:{}},response,'/composition-runtime/compositor.js'),false);
  }
});
