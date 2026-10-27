import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAssetsManifest} from '../services/game/partner-presentation.mjs';
import {createHmac} from 'node:crypto';
import {Readable} from 'node:stream';
import {installPartnerApi as asyncApi} from '../services/game/storage/async-partner-api.mjs';
// Postgres-shaped api_keys rows; only the statements the partner API issues are answered.
function apiKeysDb(){
  const keys=[];
  const statements={
    'INSERT INTO api_keys (id,name,key,secret,scopes,wallet_url,ip_allow,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?)':(id,name,key,secret,scopes,wallet_url,ip_allow,created_by,created_at)=>{
      if(keys.some(row=>row.id===id||row.key===key))throw Object.assign(Error('duplicate key value'),{code:'23505'});
      keys.push({id,name,key,secret,scopes,wallet_url,ip_allow,created_by,created_at,last_used:null,revoked_at:null});return {changes:1};},
    'SELECT * FROM api_keys WHERE key=? AND revoked_at IS NULL':key=>keys.filter(row=>row.key===key&&row.revoked_at===null),
    'UPDATE api_keys SET last_used=? WHERE id=?':(at,id)=>{const hit=keys.filter(row=>row.id===id);for(const row of hit)row.last_used=at;return {changes:hit.length};},
  };
  return {keys,prepare(sql){const answer=statements[sql];if(!answer)throw Error('unexpected SQL: '+sql);
    return {get:async(...args)=>structuredClone(answer(...args)[0]),all:async(...args)=>structuredClone(answer(...args)),run:async(...args)=>answer(...args)};}};
}
test('partner assets use injected exact metadata and preview existence without a local tree',async()=>{
  const calls=[],key='idle-1/speak/goodluck',documents={
    'dealers/astrid/streams/index.json':{codec:'avc1',width:1920,height:1080,clips:{[key]:{file:'speech.h264',fps:30,frameCount:60}}},
    'dealers/astrid-hands/streams/index.json':{width:1920,height:1080,clips:{[key]:{file:'hands.h264'}}},
    'dealers/astrid/audio/en/bank.json':{goodluck:{text:'Exact recorded words.'}},
    'dealers/astrid/lipsync-overrides.json':{goodluck:17},
    'dealers/astrid/performance/manifest.json':{takes:[{id:'take',action:'deal-left',status:'approved',media:{src:'dealer.mp4',fps:30},events:{land:30}}]},
  };
  const result=await buildAssetsManifest('missing-local-tree','astrid','https://game.invalid',{readMetadata:async path=>{calls.push(path);return documents[path];},hasPublicMedia:async path=>path==='dealers/astrid/preview/goodluck.mp4'});
  assert.equal(calls.length,5);assert.equal(result.streams[0].audio.text,'Exact recorded words.');assert.equal(result.streams[0].audio.delayMs,17);
  assert.equal(result.streams[0].handsMatte.url,'https://game.invalid/dealers/astrid-hands/streams/hands.h264');assert.equal(result.streams[0].preview,'https://game.invalid/dealers/astrid/preview/goodluck.mp4');assert.equal(result.deals[0].landAtMs,1000);
});
test('catalog errors propagate instead of producing an empty disk fallback',async()=>{
  await assert.rejects(buildAssetsManifest('missing-local-tree','astrid','',{readMetadata:async()=>{throw Object.assign(Error('catalog unavailable'),{statusCode:503});}}),{statusCode:503});
  assert.throws(()=>buildAssetsManifest('missing-local-tree','unknown'),/unknown dealer/);
});
test('Postgres contract signed assets awaits catalog and redacts read failure',async()=>{
  const db=apiKeysDb();
  let failure=false,calls=0;const api=asyncApi({db,boDb:db,root:'missing-local-tree',publicUrl:'https://game.invalid',nativeMode:true,readMetadata:async path=>{await new Promise(resolve=>setImmediate(resolve));calls++;if(failure)throw Error('private database diagnostic');return path.endsWith('/bank.json')?{goodluck:{text:'Saved in Neon'}}:null;}});
  const key=await api.keys.create({name:'catalog',scopes:['lobby']});
  const invoke=async(path='/api/v1/assets')=>{const body='{}',ts=String(Math.floor(Date.now()/1000)),req=Readable.from([body]);req.method='POST';req.headers={'x-api-key':key.key,'x-timestamp':ts,'x-signature':createHmac('sha256',key.secret).update(`${ts}.POST.${path}.${body}`).digest('hex')};const res={writeHead(status){this.status=status;},end(value){this.body=JSON.parse(value);}};await api.handle(req,res,path);return res;};
  const good=await invoke();assert.equal(good.status,200);assert.equal(good.body.speech[0].text,'Saved in Neon');assert.equal(calls,5);
  failure=true;const bad=await invoke();assert.equal(bad.status,503);assert.deepEqual(bad.body,{error:'assets unavailable'});
  const retired=await invoke('/api/v1/lobby');assert.equal(retired.status,410);assert.deepEqual(retired.body,{error:'legacy_lobby_retired',url:'/lobby'});
});
