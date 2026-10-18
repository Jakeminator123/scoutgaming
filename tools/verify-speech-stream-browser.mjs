// Isolated integration fixture. No game database, paid API or GPU is used.
// node tools/verify-speech-stream-browser.mjs <ffmpeg-path> [python-command]
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as pause } from 'node:timers/promises';
import { createGeneratedSpeechStreamService } from '../services/game/generated-speech-stream.mjs';

const directory = await mkdtemp(join(tmpdir(), 'croupier-stream-qa-'));
const workerSecret = randomBytes(32).toString('hex'), ticketSecret = randomBytes(32).toString('hex');
const modules = new Map([
  ...['generated-speech-player','speech-stream-client'].map(name => [name+'.mjs','services/game/public/'+name+'.mjs']),
  ...['speech-package','astrid-voice-profile'].flatMap(name => [
    [name+'.mjs','packages/presentation/contracts/'+name+'.mjs'],
    ['packages/presentation/contracts/'+name+'.mjs','packages/presentation/contracts/'+name+'.mjs'],
  ]),
]);
const runs = [];
let service, origin, child, stopping = false, currentInputEnd = null;
const server = createServer(async (req,res) => {
  try {
    const name = req.url.slice(1);
    if (modules.has(name)) { res.writeHead(200, {'content-type':'text/javascript'});res.end(await readFile(new URL('../'+modules.get(name),import.meta.url)));return; }
    if (req.url === '/prepare' && req.method === 'POST') {
      const requestId=randomUUID();
      const descriptor=await service.prepare({requestId,dealerId:'astrid',text:'Synthetic integration check.',owner:'fixture-owner',playerId:'fixture-player',beforeCostly:async()=>{}});
      res.writeHead(200, {'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(descriptor));return;
    }
    if (req.url === '/result' && req.method === 'POST') {
      let body='';for await(const chunk of req){body+=chunk;if(body.length>16384){res.writeHead(413);res.end();return;}}
      const value=JSON.parse(body);value.inputEndAt=currentInputEnd;
      value.firstFrameBeforeInputEnd=Number.isFinite(value.firstFrameAt)&&Number.isFinite(currentInputEnd)&&value.firstFrameAt<currentInputEnd;
      runs.push(value);console.log(JSON.stringify({browserResult:value}));res.end('ok');return;
    }
    if (req.url === '/results') { res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(runs));return; }
    if (req.url === '/stop' && req.method === 'POST') { res.end('stopping');setTimeout(stop,100);return; }
    if (req.url !== '/') { res.writeHead(404);res.end();return; }
    res.writeHead(200,{'content-type':'text/html'});
    res.end(`<!doctype html><meta charset="utf-8"><title>Croupier streaming integration</title>
<h1>Shared Croupier player · two consecutive streams</h1>
<p>Real application service, Python session and FFmpeg. Synthetic audio and face frames.</p>
<button id="start">Play twice</button><div id="scene" style="position:relative;width:384px;height:384px;background:#234"></div><pre id="status">Ready</pre>
<script type="module">
import {playGeneratedSpeech} from '/generated-speech-player.mjs';
const scene=document.querySelector('#scene'),status=document.querySelector('#status');const results=[];
document.querySelector('#start').onclick=async()=>{
 document.querySelector('#start').disabled=true;
 for(let run=1;run<=2;run++){
  const result={run,receipts:[],gateChecks:0,error:null};const began=performance.now();
  const observer=new MutationObserver(()=>{const video=scene.querySelector('video');if(video&&!result.watched){result.watched=true;result.audible=!video.muted;video.requestVideoFrameCallback(()=>{result.firstFrameAt=Date.now();result.firstFrameMs=Math.round(performance.now()-began);status.textContent=JSON.stringify([...results,result],null,2);});}});
  observer.observe(scene,{childList:true,subtree:true});
  try{
   const response=await fetch('/prepare',{method:'POST'});if(!response.ok)throw Error('Preparation failed');const descriptor=await response.json();
   await playGeneratedSpeech(descriptor,{exactText:descriptor.exactText,dealerId:'astrid',requestId:descriptor.requestId,mount:scene,beforeStart:async()=>{result.gateChecks++;},onReceipt:value=>result.receipts.push(value.state)});
   result.endedMs=Math.round(performance.now()-began);result.cleaned=scene.childElementCount===0;
  }catch(error){result.error=error.message;}finally{observer.disconnect();}
  results.push(result);status.textContent=JSON.stringify(results,null,2);await fetch('/result',{method:'POST',body:JSON.stringify(result)});
  if(result.error)break;
 }
};
</script>`);
  } catch(error){res.writeHead(500,{'content-type':'application/json'});res.end(JSON.stringify({error:error.code||'fixture_failed'}));}
});
server.listen(0,'127.0.0.1');await once(server,'listening');origin=`http://127.0.0.1:${server.address().port}`;
service=await createGeneratedSpeechStreamService(server,{directory,origin,workerSecret,ticketSecret,voiceId:'fixture',modelId:'fixture'},
 {resolveOwner:async()=>'fixture-owner',async *pcmSource({signal,beforeCostly}){
   await beforeCostly();currentInputEnd=null;
   for(let i=0;i<30;i++){
     const pcm=Buffer.alloc(4800);for(let j=0;j<2400;j++)pcm.writeInt16LE(Math.round(3000*Math.sin(2*Math.PI*440*(i*2400+j)/24000)),j*2);
     yield pcm;await pause(100,undefined,{signal});
   }
   currentInputEnd=Date.now();
 }});
child=spawn(process.argv[3]||'python',[fileURLToPath(new URL('../services/astrid-gpu-worker/tests/synthetic_worker.py',import.meta.url)),
 '--url',origin.replace('http:','ws:')+'/lipsync-worker','--token-env','LIPSYNC_WORKER_TOKEN','--ttl','180','--ffmpeg',process.argv[2]||'ffmpeg'],
 {env:{...process.env,LIPSYNC_WORKER_TOKEN:workerSecret},windowsHide:true,stdio:['ignore','pipe','pipe']});
child.stdout.on('data',d=>process.stdout.write(d));child.stderr.on('data',d=>process.stderr.write(d));
child.on('error',error=>{console.error(error.message);void stop();});
async function stop(){
 if(stopping)return;stopping=true;service.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
 if(child.exitCode===null){const exited=once(child,'exit');const timer=setTimeout(()=>child.kill(),5000);await exited;clearTimeout(timer);}
 const target=resolve(directory);if(dirname(target)!==resolve(tmpdir())||!basename(target).startsWith('croupier-stream-qa-'))throw Error('Unsafe cleanup target');
 await rm(target,{recursive:true,force:true});process.exit(0);
}
process.on('SIGINT',stop);process.on('SIGTERM',stop);setTimeout(stop,240000).unref();
const deadline=Date.now()+10000;while(!service.status().workers){if(child.exitCode!==null||Date.now()>deadline){await stop();break;}await pause(50);}
console.log(JSON.stringify({fixtureUrl:origin,autoStopSeconds:240}));
