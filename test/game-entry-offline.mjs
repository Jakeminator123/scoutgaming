import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:net';
import {existsSync} from 'node:fs';
import {startLocalComparison} from '../tools/start-local-comparison.mjs';
async function freePort(host){const server=createServer();await new Promise(resolve=>server.listen(0,host,resolve));const port=server.address().port;await new Promise(resolve=>server.close(resolve));return port;}
test('offline startup never resurrects local profiles or their raw asset routes',async()=>{
 const fixture=await startLocalComparison({startLab:false,gamePort:await freePort('localhost'),labPort:await freePort('127.0.0.1')});
 try{
  for(const dealer of ['astrid','vera','amira','mei'])for(const path of ['/','/game']){
   const response=await fetch(fixture.gameUrl+path+'?dealer='+dealer+'&rehearsal=1');
   assert.equal(response.status,503);const html=await response.text();
   assert.match(html,/Ingen presentation vald/);assert.doesNotMatch(html,/data-game-dealer=|<video|src="app.mjs"/);
  }
  for(const path of ['/dealer/streams/index.json','/dealers/astrid/streams/index.json','/dealers/amira/audio/en/bank.json','/dealers/mei/poster.jpg','/Dealers/AsTrId/streams/index.json','/dealers./vera./poster.jpg','/%64ealers/%61strid/streams/index.json']){
   const response=await fetch(fixture.gameUrl+path);assert.equal(response.status,410);assert.deepEqual(await response.json(),{error:'local_dealer_retired'});
  }
  assert.equal((await fetch(fixture.gameUrl+'/api/auth/session')).status,200);
 }finally{await fixture.stop();}
 assert.equal(existsSync(fixture.runDir),false);
});
