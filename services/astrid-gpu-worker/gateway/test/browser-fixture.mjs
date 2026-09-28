// Isolated synthetic codec/transport check; never calls RunPod or a real TTS API.
// Usage: node test/browser-fixture.mjs <absolute-ffmpeg-path>
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import WebSocket from 'ws';
import { attachSpeechRelay } from '../relay.mjs';
import { issueTicket, ticketAuthenticator } from '../auth.mjs';

const dir = await mkdtemp(join(tmpdir(), 'astrid-browser-'));
async function removeFixtureDirectory() {
  const target = resolve(dir);
  if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith('astrid-browser-')) throw new Error('Unsafe fixture cleanup target');
  await rm(target, { recursive: true, force: true });
}
const output = join(dir, 'synthetic.mp4');
const ffmpeg = spawn(process.argv[2] || 'ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=320x240:rate=24', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=24000', '-t', '3', '-c:v', 'libx264', '-profile:v', 'high', '-level:v', '4.2', '-pix_fmt', 'yuv420p', '-g', '12', '-bf', '0', '-c:a', 'aac', '-b:a', '64k', '-movflags', 'empty_moov+default_base_moof+frag_keyframe', '-frag_duration', '500000', output], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
let stderr = ''; ffmpeg.stderr.on('data', d => { stderr += d; });
const [code] = await once(ffmpeg, 'exit');
if (code) { await removeFixtureDirectory(); throw new Error(stderr); }
const media = await readFile(output);
const secret = randomBytes(32).toString('hex'), tickets = randomBytes(32).toString('hex');
let origin, relay, result = null, timers = new Set();
const server = createServer(async (req, res) => {
  if (req.url === '/browser-player.mjs') { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(await readFile(new URL('../browser-player.mjs', import.meta.url))); return; }
  if (req.url === '/result' && req.method === 'POST') {
    let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 8192) { res.writeHead(413); res.end(); return; } }
    result = JSON.parse(body); console.log(JSON.stringify({ browserResult: result })); res.end('ok'); return;
  }
  if (req.url === '/result') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(result)); return; }
  if (req.url !== '/') { res.writeHead(404); res.end(); return; }
  const ticket = issueTicket(tickets, { userId: 'fixture', sessionId: 'fixture' });
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end(`<!doctype html><meta charset="utf-8"><title>Astrid streaming fixture</title>
<h1>Synthetic streaming codec check</h1><p>Local FFmpeg test pattern and sine tone; no dealer or external service.</p>
<button id="start">Start playback</button><video controls playsinline width="640"></video><pre id="status">Ready</pre>
<script type="module">
import {SpeechStreamPlayer} from '/browser-player.mjs';
const state = {firstFrameBeforeDone:false, frames:0, done:false, currentTime:0, bufferedEnd:0, error:null};
const video = document.querySelector('video'), status = document.querySelector('#status');
let began, player;
function show() { status.textContent = JSON.stringify(state,null,2); }
function frame(_, info) { state.frames++; state.currentTime=video.currentTime; show(); if (!video.ended) video.requestVideoFrameCallback(frame); }
document.querySelector('#start').onclick = async () => {
 document.querySelector('#start').disabled=true; began=performance.now();
 try {
 player = new SpeechStreamPlayer(video, {onFirstFrame(info) { state.firstFrameMs=Math.round(performance.now()-began); state.firstFrameBeforeDone=!state.done; video.requestVideoFrameCallback(frame); show(); }, onAutoplayBlocked(error) {state.error='Autoplay blocked: '+error.message; show();} });
 await player.connect(${JSON.stringify(origin.replace('http:', 'ws:') + '/speech-stream')}, ${JSON.stringify(ticket)});
 await player.done; state.done=true; state.doneMs=Math.round(performance.now()-began); state.bufferedEnd=video.buffered.length?video.buffered.end(0):0; show();
 await fetch('/result',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(state)});
 } catch(error) {state.error=error.message; show(); await fetch('/result',{method:'POST',body:JSON.stringify(state)});}
};
window.addEventListener('pagehide',()=>player?.abort());
</script>`);
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
origin = `http://127.0.0.1:${server.address().port}`;
relay = attachSpeechRelay(server, { workerSecret: secret, allowedOrigins: [origin], authenticateClient: ticketAuthenticator(tickets), onSessionReady(identity) {
  const source = relay.openSource({ ...identity, rate: 24000 });
  source.writePCM(new Uint8Array(4800)).then(() => source.end());
} });
const worker = new WebSocket(origin.replace('http:', 'ws:') + '/lipsync-worker', { headers: { Authorization: `Bearer ${secret}`, 'X-Worker-Id': 'synthetic-fixture' } });
worker.on('message', (data, binary) => {
  if (binary) return;
  const m = JSON.parse(data.toString());
  if (m.t === 'start') {
    worker.send(JSON.stringify({ t: 'stream', id: m.id, mime: 'video/mp4; codecs="avc1.64002a, mp4a.40.2"' }));
    let offset = 0;
    const interval = setInterval(() => {
      if (offset >= media.length) { clearInterval(interval); timers.delete(interval); return; }
      worker.send(media.subarray(offset, offset + 8192)); offset += 8192;
    }, 30); timers.add(interval);
    const done = setTimeout(() => { worker.send(JSON.stringify({t:'done',id:m.id,frames:72,ms:4500})); timers.delete(done); }, 4500); timers.add(done);
  } else if (m.t === 'abort') { for (const t of timers) clearTimeout(t); timers.clear(); worker.send(JSON.stringify({t:'done',id:m.id,aborted:true})); }
});
await once(worker, 'open');
console.log(JSON.stringify({ fixtureUrl: origin, bytes: media.length, autoStopSeconds: 600 }));
let stopping = false;
async function stop() {
  if (stopping) return; stopping = true;
  for (const t of timers) clearTimeout(t);
  worker.terminate(); relay.close();
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  await removeFixtureDirectory(); process.exit(0);
}
process.on('SIGINT', stop); process.on('SIGTERM', stop);
setTimeout(stop, 600000).unref();
