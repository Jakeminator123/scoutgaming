import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from '../apps/web/tools/player-ui-build.mjs';

test('real entry serves login and preserves account/table identity across a server restart with empty fixture databases', async () => {
  const directory=await mkdtemp(join(tmpdir(),'blackjack-entry-'));
  const portServer=createServer();
  await new Promise(resolve=>portServer.listen(0,'127.0.0.1',resolve));
  const port=portServer.address().port;
  await new Promise(resolve=>portServer.close(resolve));
  const origin=`http://127.0.0.1:${port}`;
  let child;
  const stop=async()=>{if(child && child.exitCode===null){const stopped=once(child,'exit');child.kill();await stopped;}child=null;};
  const start=async()=>{
    const env=Object.fromEntries(['PATH','Path','SystemRoot','SYSTEMROOT','TEMP','TMP'].filter(key=>process.env[key]).map(key=>[key,process.env[key]]));
    Object.assign(env,{HOST:'127.0.0.1',PORT:String(port),NODE_ENV:'production',CROUPIER_DATA_DIR:join(directory,'players'),
      CROUPIER_CLOUD_RUNTIME:'1',CROUPIER_PLAYER_ACCOUNTS:'1',
      CROUPIER_CLOUD_BOOTSTRAP_ADMIN_USER:'fixtureadmin',CROUPIER_CLOUD_BOOTSTRAP_ADMIN_PASSWORD:'Synthetic-Operator-Test-Password',
      DEMO_GUEST_ACCESS:'',CROUPIER_GENERATED_SPEECH:'',CROUPIER_GENERATED_SPEECH_STREAMING:'',CROUPIER_ASTRID_CAMERA:'',
      CROUPIER_STREAM_LANE:'lissabon-stream-lane',PUBLIC_URL:'https://game.example.invalid'});
    child=spawn(process.execPath,['--import',new URL('./fixtures/generated-speech-stream-fetch.mjs',import.meta.url).href,fileURLToPath(new URL('../services/game/server.mjs',import.meta.url))],{
      cwd:fileURLToPath(new URL('../services/game/',import.meta.url)),env,windowsHide:true,stdio:['ignore','pipe','pipe'],
    });
    // Startup may contain credentials in older environments; never surface it.
    child.stderr.on('data',()=>{});
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('Isolated product fixture did not start')),10000);
      child.once('error',error=>{clearTimeout(timer);reject(error);});
      child.once('exit',()=>{clearTimeout(timer);reject(Error('Isolated product fixture exited'));});
      child.stdout.on('data',data=>{if(String(data).includes('croupier demo on')){clearTimeout(timer);resolve();}});
    });
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
