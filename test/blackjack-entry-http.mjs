import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from '../apps/web/tools/player-ui-build.mjs';
import { ENGINE_QA_SKIP, createEngineDatabase, freePort, startEngine } from './fixtures/engine-qa.mjs';

test('real entry serves login and preserves account/table identity across a server restart with an empty fixture database', { skip: ENGINE_QA_SKIP }, async t => {
  const directory=await mkdtemp(join(tmpdir(),'blackjack-entry-'));
  const database=await createEngineDatabase(t);
  const port=await freePort();
  const origin=`http://127.0.0.1:${port}`;
  let engine;
  const stop=async()=>{await engine?.stop();engine=null;};
  const start=async()=>{
    engine=await startEngine(t,{database,port,preload:[new URL('./fixtures/generated-speech-stream-fetch.mjs',import.meta.url).href],
      env:{NODE_ENV:'production',CROUPIER_CLOUD_RUNTIME:'1',CROUPIER_PLAYER_ACCOUNTS:'1',
        CROUPIER_CLOUD_BOOTSTRAP_ADMIN_USER:'fixtureadmin',CROUPIER_CLOUD_BOOTSTRAP_ADMIN_PASSWORD:'Synthetic-Operator-Test-Password',
        DEMO_GUEST_ACCESS:'',CROUPIER_GENERATED_SPEECH:'',CROUPIER_GENERATED_SPEECH_STREAMING:'',CROUPIER_ASTRID_CAMERA:'',
        CROUPIER_STREAM_LANE:'lissabon-stream-lane',PUBLIC_URL:'https://game.example.invalid'}});
  };
  let cookie='';
  const post=async(path,body)=>{
    const response=await fetch(origin+path,{method:'POST',headers:{'content-type':'application/json',origin,cookie},body:JSON.stringify(body)});
    if(response.headers.has('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];
    return response;
  };
  try {
    await build({origin:'https://game.example.invalid',output:pathToFileURL(join(directory,'site')+'/')});
    const landing=await readFile(join(directory,'site','index.html'),'utf8');
    assert.match(landing,/href="https:\/\/game.example.invalid\/blackjack"/);
    assert.doesNotMatch(landing,/localhost|127\.0\.0\.1|\{\{BLACKJACK_URL\}\}/);
    await start();
    const entry=await fetch(origin+'/blackjack');assert.equal(entry.status,200);assert.match(await entry.text(),/blackjack-entry.mjs/);
    const script=await fetch(origin+'/blackjack-entry.mjs'),loginScript=await script.text();assert.match(loginScript,/const destination = '\/lobby'/);assert.doesNotMatch(loginScript,/dealer=astrid&presentation=local/);
    const configuration=await(await fetch(origin+'/api/auth/session')).json();assert.equal(configuration.playerAccounts,true);assert.equal(configuration.guest,false);
    assert.equal((await post('/api/player',{})).status,401);
    const registered=await post('/api/auth/player/register',{username:'fixture-player',password:'Synthetic-Player-Test-Password',id:'forged-player'});
    assert.equal(registered.status,200);assert.match(registered.headers.get('set-cookie'),/; Secure/);
    const player=await(await post('/api/player',{id:'forged-player'})).json();
    assert.ok(player.id);assert.notEqual(player.id,'forged-player');assert.equal(player.name,'fixture-player');
    const table=await(await post('/api/table',{op:'state'})).json();assert.equal(table.error,undefined);
    assert.equal((await fetch(origin+'/api/bo/me',{headers:{cookie}})).status,404);
    assert.equal((await fetch(origin+'/api/bo/users',{headers:{cookie}})).status,404);
    await stop();await start();
    const restored=await(await post('/api/player',{})).json();assert.equal(restored.id,player.id);assert.equal(restored.balance,player.balance);
    const restoredTable=await(await post('/api/table',{op:'state'})).json();assert.deepEqual(restoredTable,table);
    assert.equal((await post('/api/auth/logout',{})).status,200);
    assert.equal((await post('/api/player',{})).status,401);
  } finally {await stop();await rm(directory,{recursive:true,force:true});}
});
