// Real Python session -> FFmpeg -> relay -> browser. Only inference is synthetic.
// node test/python-browser-fixture.mjs <ffmpeg-path> [python-command]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { setTimeout as pause } from 'node:timers/promises';
import { attachSpeechRelay } from '../relay.mjs';
import { issueTicket, ticketAuthenticator } from '../auth.mjs';

const workerSecret = randomBytes(32).toString('hex');
const ticketSecret = randomBytes(32).toString('hex');
let origin, relay, child, result = null, inputEndAt = null;
const server = createServer(async (req, res) => {
  if (req.url === '/browser-player.mjs') {
    res.writeHead(200, {'content-type':'text/javascript'});
    res.end(await readFile(new URL('../browser-player.mjs', import.meta.url))); return;
  }
  if (req.url === '/result' && req.method === 'POST') {
    let body = '';
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 8192) { res.writeHead(413); res.end(); return; }
    }
    try {
      result = JSON.parse(body);
      result.inputEndAt = inputEndAt;
      result.firstFrameBeforeInputEnd = Number.isFinite(result.firstFrameAt) && Number.isFinite(inputEndAt) && result.firstFrameAt < inputEndAt;
      console.log(JSON.stringify({browserResult:result}));
      res.end('ok');
    } catch { res.writeHead(400); res.end(); }
    return;
  }
  if (req.url === '/result') { res.writeHead(200, {'content-type':'application/json'}); res.end(JSON.stringify(result)); return; }
  if (req.url !== '/') { res.writeHead(404); res.end(); return; }
  const ticket = issueTicket(ticketSecret, {userId:'fixture',sessionId:'fixture'});
  res.writeHead(200, {'content-type':'text/html'});
  res.end(`<!doctype html><meta charset="utf-8"><title>Python streaming fixture</title>
<h1>Python → FFmpeg → relay → browser</h1>
<p>Four seconds of synthetic PCM arrive in real time. Only model inference is mocked.</p>
<button id="start">Start full-chain check</button><video controls playsinline width="384"></video><pre id="status">Ready</pre>
<script type="module">
import {SpeechStreamPlayer} from '/browser-player.mjs';
const video=document.querySelector('video'), status=document.querySelector('#status');
const state={firstFrameBeforeDone:false,done:false,error:null}; let player;
const show=()=>status.textContent=JSON.stringify(state,null,2);
document.querySelector('#start').onclick=async()=>{
 document.querySelector('#start').disabled=true; const began=performance.now();
 try {
  player=new SpeechStreamPlayer(video,{onFirstFrame(){state.firstFrameAt=Date.now();state.firstFrameMs=Math.round(performance.now()-began);state.firstFrameBeforeDone=!state.done;show();},onAutoplayBlocked(error){state.error=error.message;show();}});
  await player.connect(${JSON.stringify(origin.replace('http:','ws:')+'/speech-stream')},${JSON.stringify(ticket)});
  const terminal=await player.done; state.done=true;state.doneMs=Math.round(performance.now()-began);state.frames=terminal.frames;state.bufferedEnd=video.buffered.length?video.buffered.end(0):0;show();
 } catch(error){state.error=error.message;show();}
 await fetch('/result',{method:'POST',body:JSON.stringify(state)});
};
window.addEventListener('pagehide',()=>player?.abort());
</script>`);
});
server.listen(0,'127.0.0.1'); await once(server,'listening');
origin=`http://127.0.0.1:${server.address().port}`;
relay=attachSpeechRelay(server,{workerSecret,allowedOrigins:[origin],authenticateClient:ticketAuthenticator(ticketSecret),
 async onSessionReady(identity){
   const source=relay.openSource({...identity,rate:24000});
   inputEndAt=null;
   try {
     for(let i=0;i<40;i++){
       const pcm=Buffer.alloc(4800);
       for(let j=0;j<2400;j++) pcm.writeInt16LE(Math.round(3000*Math.sin(2*Math.PI*440*(i*2400+j)/24000)),j*2);
       await source.writePCM(pcm);
       await pause(100,undefined,{signal:source.signal});
     }
     inputEndAt=Date.now(); source.end();
   } catch { source.abort(); }
 }});
child=spawn(process.argv[3]||'python',[fileURLToPath(new URL('../../tests/synthetic_worker.py',import.meta.url)),
 '--url',origin.replace('http:','ws:')+'/lipsync-worker','--token-env','LIPSYNC_WORKER_TOKEN','--ttl','120',
 '--ffmpeg',process.argv[2]||'ffmpeg'],{env:{...process.env,LIPSYNC_WORKER_TOKEN:workerSecret},windowsHide:true,stdio:['ignore','pipe','pipe']});
child.stdout.on('data',d=>process.stdout.write(d)); child.stderr.on('data',d=>process.stderr.write(d));
child.on('error',error=>{console.error(error.message);stop();});
let stopping=false;
async function stop(){
 if(stopping)return;stopping=true;
 relay.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
 if(child.exitCode===null){const exited=once(child,'exit');const timer=setTimeout(()=>child.kill(),5000);await exited;clearTimeout(timer);}
 process.exit(0);
}
process.on('SIGINT',stop);process.on('SIGTERM',stop);setTimeout(stop,180000).unref();
const deadline=Date.now()+10000;
while(!relay.status().workers){if(child.exitCode!==null||Date.now()>deadline){await stop();break;}await pause(50);}
console.log(JSON.stringify({fixtureUrl:origin,autoStopSeconds:180,realPython:true}));
