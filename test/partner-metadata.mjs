import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAssetsManifest} from '../services/game/partner-presentation.mjs';
import {DatabaseSync} from 'node:sqlite';
import {createHmac} from 'node:crypto';
import {Readable} from 'node:stream';
import {installPartnerApi as sqliteApi} from '../services/game/partner-api.mjs';
import {installPartnerApi as asyncApi} from '../services/game/storage/async-partner-api.mjs';
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
for(const [name,factory,async] of [['SQLite',sqliteApi,false],['Postgres contract',asyncApi,true]])test(`${name} signed assets awaits catalog and redacts read failure`,async t=>{
  const sqlite=new DatabaseSync(':memory:');t.after(()=>sqlite.close());
  sqlite.exec('CREATE TABLE api_keys(id TEXT PRIMARY KEY,name TEXT,key TEXT UNIQUE,secret TEXT,scopes TEXT,wallet_url TEXT,ip_allow TEXT,created_by TEXT,created_at TEXT,last_used TEXT,revoked_at TEXT);');
  const db=async?{prepare(sql){const statement=sqlite.prepare(sql);return Object.fromEntries(['get','all','run'].map(method=>[method,async(...args)=>statement[method](...args)]));}}:sqlite;
  let failure=false,calls=0;const api=factory({db,boDb:db,root:'missing-local-tree',publicUrl:'https://game.invalid',nativeMode:true,readMetadata:async path=>{await new Promise(resolve=>setImmediate(resolve));calls++;if(failure)throw Error('private database diagnostic');return path.endsWith('/bank.json')?{goodluck:{text:'Saved in Neon'}}:null;}});
  const key=await api.keys.create({name:'catalog',scopes:['lobby']});
  const invoke=async(path='/api/v1/assets')=>{const body='{}',ts=String(Math.floor(Date.now()/1000)),req=Readable.from([body]);req.method='POST';req.headers={'x-api-key':key.key,'x-timestamp':ts,'x-signature':createHmac('sha256',key.secret).update(`${ts}.POST.${path}.${body}`).digest('hex')};const res={writeHead(status){this.status=status;},end(value){this.body=JSON.parse(value);}};await api.handle(req,res,path);return res;};
  const good=await invoke();assert.equal(good.status,200);assert.equal(good.body.speech[0].text,'Saved in Neon');assert.equal(calls,5);
  failure=true;const bad=await invoke();assert.equal(bad.status,503);assert.deepEqual(bad.body,{error:'assets unavailable'});
  const retired=await invoke('/api/v1/lobby');assert.equal(retired.status,410);assert.deepEqual(retired.body,{error:'legacy_lobby_retired',url:'/lobby'});
});
