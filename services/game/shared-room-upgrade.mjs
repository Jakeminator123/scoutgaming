import { createRequire } from 'node:module';
import { PARTNER_ROOM_REFUSALS } from './partner-operator.mjs';
import { ROOM_CONFIG_MISSING } from './shared-room-access.mjs';

// Refusals the browser sees by name in a 1008 close: a partner key's company, and a room without
// published game settings. Every other refusal keeps its plain HTTP status.
const NAMED_REFUSALS=new Set([...PARTNER_ROOM_REFUSALS,ROOM_CONFIG_MISSING]);

const requireGateway=createRequire(new URL('../astrid-gpu-worker/gateway/package.json',import.meta.url));
const unavailable=()=>Object.assign(Error('shared_room_upgrade_unavailable'),{statusCode:503});
const exactOrigin=value=>{let url;try{url=new URL(value);}catch{throw unavailable();}
  if(!['https:','http:'].includes(url.protocol)||url.origin!==value)throw unavailable();return url;};
const owned=path=>typeof path==='string'&&(path==='/shared-room'||/^\/shared-room[/?#]/.test(path));
const strictPath=path=>typeof path==='string'&&/^\/shared-room\/[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(path);
const protectedHeaders=new Set(['host','origin','upgrade','connection','sec-websocket-key','sec-websocket-version','sec-websocket-protocol']);
function duplicateHeader(request) {
  const seen=new Set();
  for(let index=0;index<(request.rawHeaders?.length??0);index+=2){const name=String(request.rawHeaders[index]).toLowerCase();
    if(protectedHeaders.has(name)&&seen.has(name))return true;seen.add(name);}
  return false;
}
function asRequest(request,engineOrigin,signal) {
  const headers=new Headers();
  for(const [name,value] of Object.entries(request.headers)) {
    // Host authority was checked separately. Forwarded headers never establish it.
    if(name==='forwarded'||name.startsWith('x-forwarded-'))continue;
    if(value!==undefined)headers.set(name,Array.isArray(value)?value.join(', '):value);
  }
  return new Request(engineOrigin+request.url,{method:'GET',headers,signal});
}

/** Admission for an existing HTTP server's SINGLE upgrade dispatcher. No listener
 * or port is installed here: await handleUpgrade(req,socket,head), then dispatch
 * elsewhere only when false. The enclosing gateway must already validate private
 * ingress; this boundary checks the configured engine Host and browser Origin.
 * channel.prepare authenticates before ws emits 101; only a partner refused by name for its
 * key's company then gets 101 and an immediate 1008 close. No tickets, commands, actor
 * ids, application registry or authentication fallback are introduced here.
 */
export function createSharedRoomUpgrade({engineOrigin,origin,channel,WebSocketServer,
  handshakeMs=2000,maxPayload=1024,maxPending=128,closeGraceMs=1000}={}) {
  const engine=exactOrigin(engineOrigin);exactOrigin(origin);
  if(typeof channel?.prepare!=='function'||typeof channel?.close!=='function'
    ||!Number.isSafeInteger(handshakeMs)||handshakeMs<1||handshakeMs>30000
    ||!Number.isSafeInteger(maxPayload)||maxPayload<1||maxPayload>16384
    ||!Number.isSafeInteger(maxPending)||maxPending<1||maxPending>1024
    ||!Number.isSafeInteger(closeGraceMs)||closeGraceMs<0||closeGraceMs>10000)throw unavailable();
  const Server=WebSocketServer??requireGateway('ws').WebSocketServer;
  const wss=new Server({noServer:true,perMessageDeflate:false,maxPayload,handleProtocols:()=>false});
  const pending=new Set(),clients=new Set(),seen=new WeakSet(),rejecting=new Set();
  let stopped=false,closing;
  function reject(socket,status) {
    if(socket.destroyed)return;
    // Destroy after flushing the fixed response; a peer cannot keep a rejected
    // half-open connection alive. Keep an error handler until its actual close.
    rejecting.add(socket);
    const error=()=>socket.destroy();
    const timeout=setTimeout(error,1000);timeout.unref?.();
    const cleanup=()=>{clearTimeout(timeout);socket.off('error',error);rejecting.delete(socket);};
    socket.once('error',error);socket.once('close',cleanup);
    try {socket.end(`HTTP/1.1 ${status} Rejected\r\nConnection: close\r\nCache-Control: private, no-store\r\nContent-Length: 0\r\n\r\n`,()=>socket.destroy());}
    catch {socket.destroy();}
  }
  // A signed-in partner refused for its key's company (docs/plans/NYCKEL-BOLAG.md) must learn why:
  // a browser sees a rejected handshake only as 1006 and retries for a minute. This socket opens
  // and closes at once with 1008 and the fixed code as reason; it never carries a room frame.
  function refuse(request,socket,head,code) {
    let upgraded=false;
    wss.handleUpgrade(request,socket,head,ws=>{
      upgraded=true;
      const broken=()=>ws.terminate();
      clients.add(ws);ws.on('error',broken);ws.once('close',()=>{clients.delete(ws);ws.off('error',broken);});
      try {ws.close(1008,code);socket.resume();}catch {ws.terminate();}
    });
    if(!upgraded)socket.resume();
  }
  function handleUpgrade(request,socket,head) {
    if(!owned(request?.url))return false;
    if(seen.has(socket))return true;seen.add(socket);
    if(stopped){reject(socket,503);return true;}
    if(request.method!=='GET'||!strictPath(request.url)||request.headers?.host!==engine.host
      ||request.headers.origin!==origin||typeof request.headers.upgrade!=='string'||request.headers.upgrade.toLowerCase()!=='websocket'
      ||typeof request.headers.connection!=='string'||!request.headers.connection.toLowerCase().split(',').map(v=>v.trim()).includes('upgrade')
      ||request.headers['sec-websocket-protocol']!==undefined||duplicateHeader(request)
      ||!Buffer.isBuffer(head)||head.length>maxPayload+14){reject(socket,403);return true;}
    if(pending.size>=maxPending){reject(socket,503);return true;}
    if(socket.destroyed||socket.readableEnded||!socket.readable||!socket.writable||request.aborted)return true;
    const bufferedHead=Buffer.from(head),controller=new AbortController();
    let active=true,timer,cancel=()=>{};
    const record={socket,cancel:()=>{if(active){controller.abort();cancel();}}};pending.add(record);
    const abort=()=>{record.cancel();socket.destroy();};
    socket.once('close',abort);socket.once('end',abort);socket.once('error',abort);request.once('aborted',abort);
    socket.pause();
    const cancelled=new Promise(resolve=>{cancel=()=>resolve(null);timer=setTimeout(()=>{record.cancel();reject(socket,504);},handshakeMs);});
    const prepared=Promise.resolve().then(()=>active&&!controller.signal.aborted?channel.prepare(asRequest(request,engineOrigin,controller.signal)):null);
    return Promise.race([prepared,cancelled]).then(admission=>{
      if(!active||controller.signal.aborted||stopped||socket.destroyed||socket.readableEnded||!socket.readable||!socket.writable||request.aborted)return true;
      if(typeof admission?.attach!=='function')throw unavailable();
      let upgraded=false;
      wss.handleUpgrade(request,socket,bufferedHead,ws=>{
        upgraded=true;
        if(!active||stopped||controller.signal.aborted||socket.destroyed){ws.terminate();return;}
        const broken=()=>ws.terminate();
        clients.add(ws);ws.on('error',broken);ws.once('close',()=>{clients.delete(ws);ws.off('error',broken);});
        try {admission.attach(ws);socket.resume();}
        catch {ws.terminate();}
      });
      // ws owns malformed handshake rejection; never write a second response.
      if(!upgraded)socket.resume();
      return true;
    }).catch(error=>{
      if(!active||controller.signal.aborted||socket.destroyed)return true;
      if(error?.statusCode===403&&NAMED_REFUSALS.has(error.code)&&!stopped&&socket.writable&&!request.aborted){refuse(request,socket,bufferedHead,error.code);return true;}
      reject(socket,[401,403,409,429].includes(error?.statusCode)?error.statusCode:503);return true;})
      .finally(()=>{active=false;clearTimeout(timer);pending.delete(record);
        socket.off('close',abort);socket.off('end',abort);socket.off('error',abort);request.off('aborted',abort);});
  }
  function close() {
    if(closing)return closing;stopped=true;
    for(const record of pending){record.cancel();record.socket.destroy();}
    for(const socket of rejecting)socket.destroy();
    try {channel.close();}catch { /* Still release every transport after an application close failure. */ }
    // The channel's close frame (1012 on restart) must reach the browser: an immediate
    // terminate would discard it and leave 1006. Each socket gets closeGraceMs to finish
    // its closing handshake, then the transport goes regardless.
    const closed=[...clients].map(client=>new Promise(resolve=>{
      if(client.readyState===3){resolve();return;}
      const timer=setTimeout(()=>client.terminate(),closeGraceMs);timer.unref?.();
      client.once('close',()=>{clearTimeout(timer);resolve();});
      if(client.readyState===1)try{client.close(1012,'shared_room_restart');}catch{client.terminate();}
    }));
    return closing=Promise.all(closed).then(()=>new Promise(resolve=>wss.close(resolve)));
  }
  return Object.freeze({handleUpgrade,close});
}
