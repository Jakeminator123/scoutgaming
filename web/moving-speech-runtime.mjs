import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { Readable } from 'node:stream';
import { createRequire } from 'node:module';
import { createRegisteredMovingSpeech, assertMovingSpeechSource } from './moving-speech-bank.mjs';
import { createMovingBankDownloads } from './moving-speech-bank-artifacts.mjs';
const {WebSocketServer,WebSocket}=createRequire(new URL('../services/astrid-gpu-worker/gateway/package.json',import.meta.url))('ws');

const digest = value => createHash('sha256').update(value).digest('hex');
const fail = code => {throw Object.assign(Error(code),{code,statusCode:503});};
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const same = (a,b) => typeof a === 'string' && typeof b === 'string'
  && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a),Buffer.from(b));
const publicPlan = plan => JSON.parse(JSON.stringify(plan));

/** Opt-in Dragan path. The existing chat/Director still selects exact text.
 * All authorities and paid work stay here; the browser gets one spent ticket.
 * Initial playback is the bank's explicit rest frame between card sequences. */
export function createMovingSpeechRuntime({server, origin, workerOrigin = origin, ticketSecret, bank, releaseSha256,
  sessions, dealerRuntime, resolveOwner, readEvidence, readRegistry, readRest, bankRead,
  bankOptions, now = Date.now, connectionMs = 15000,
  onCleanupError = () => console.warn(JSON.stringify({event:'moving_speech_cleanup_requires_recovery'}))} = {}) {
  if (!server || typeof ticketSecret !== 'string' || ticketSecret.length < 32
    || !/^[a-f0-9]{64}$/.test(releaseSha256 ?? '') || typeof sessions?.admit !== 'function'
    || typeof dealerRuntime?.prepareMoving !== 'function' || [resolveOwner,readEvidence,readRegistry,readRest].some(fn=>typeof fn !== 'function')) fail('moving_speech_configuration');
  const downloads = createMovingBankDownloads({origin:workerOrigin,bank,read:bankRead,options:bankOptions,now});
  const records = new Map(), pending = new Set();
  const wss = new WebSocketServer({noServer:true,maxPayload:2048,perMessageDeflate:false,
    handleProtocols: protocols=>protocols.has('moving-v1') ? 'moving-v1' : false});
  let closing = false;
  const sign = body => createHmac('sha256',ticketSecret).update(body).digest('base64url');
  const reject = socket => socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
  async function cancel(record) {
    if (record.cancelled) return record.cancelled;
    // Publish the promise before abort/close callbacks can re-enter cleanup.
    // An uncertain provider/journal result retains its durable reservation for
    // reconciliation, but must never crash the product server on disconnect.
    record.cancelled = Promise.resolve().then(async()=>{
      record.controller.abort(); clearTimeout(record.timer); record.download?.revoke();
      if (!record.delivered) record.ws?.terminate();
      record.pcm?.fill(0); record.input?.cancel();
      return await record.session?.cancel();
    }).catch(()=>{
      try {onCleanupError();} catch {}
      return {cancelled:false,recoveryRequired:true};
    }).finally(()=>records.delete(record.id));
    return record.cancelled;
  }
  async function current(record) {
    record.signal.throwIfAborted(); await record.beforeCostly();
    await record.voice.assertFresh();
    const evidence = await readEvidence(record.context,bank.sourceSet.rest.videoId);
    if (evidence.projectRevision !== record.evidence.projectRevision
      || JSON.stringify(evidence.mediaReferences) !== JSON.stringify(record.evidence.mediaReferences)) fail('moving_speech_context_changed');
    record.signal.throwIfAborted();
    return evidence;
  }
  async function owner(record,req) {
    if (!same(await resolveOwner(req,record.playerId),record.owner)) fail('moving_speech_owner_changed');
    try {await current(record);} catch(error) {await cancel(record);throw error;}
  }
  function send(ws,value,binary=false) {
    return new Promise((resolve,rejectSend)=>{
      if (ws.readyState !== WebSocket.OPEN || ws.bufferedAmount + Buffer.byteLength(value) > 4*1024*1024) return rejectSend(Error('moving_speech_client_backpressure'));
      ws.send(value,{binary},error=>error ? rejectSend(Error('moving_speech_client_closed')) : resolve());
    });
  }
  async function stream(record,ws) {
    record.ws = ws; clearTimeout(record.timer);
    let credit = 0, sent = 0, wake = null, done = false;
    const stop = () => {wake?.(); if (!done) void cancel(record);};
    ws.on('close',stop); ws.on('error',stop);
    ws.on('message',(data,binary)=>{
      try {
        if (binary) fail('moving_speech_invalid_credit');
        const value = JSON.parse(data.toString('utf8'));
        if (value.t === 'abort' && value.id === record.id && Object.keys(value).sort().join(',') === 'id,t') {void cancel(record); return;}
        if (Object.keys(value).sort().join(',') !== 'frames,id,t' || value.t !== 'credit'
          || value.id !== record.input.plan.start.id || !Number.isSafeInteger(value.frames)
          || value.frames < 1 || value.frames > 48 || credit + value.frames > 48
          || sent + credit + value.frames > record.input.plan.timeline.length + 48) fail('moving_speech_invalid_credit');
        credit += value.frames; wake?.();
      } catch {void cancel(record);}
    });
    const waitCredit = async frames => {
      while (credit < frames) {
        record.signal.throwIfAborted();
        await new Promise((resolve,rejectWait)=>{
          const timeout = setTimeout(()=>finish(Error('moving_speech_credit_timeout')),12000);
          const abort = () => finish(Error('moving_speech_cancelled'));
          const finish = error => {clearTimeout(timeout);record.signal.removeEventListener('abort',abort);wake=null;error ? rejectWait(error):resolve();};
          wake = () => finish(); record.signal.addEventListener('abort',abort,{once:true});
          if (record.signal.aborted) abort();
        });
      }
      credit -= frames; sent += frames;
    };
    try {
      await current(record);
      const source = bank.sourceSet.clips.find(c=>c.videoId===bank.sourceSet.rest.videoId);
      const {videoId,sha256,fps,frameCount,width,height,bytes} = source;
      await send(ws,JSON.stringify({t:'ready',protocol:1,id:record.id,attemptId:record.binding.attemptId,nonce:record.binding.nonce,
        plan:publicPlan(record.input.plan),rest:{videoId,sha256,fps,frameCount,width,height,bytes,sourceFrame:bank.sourceSet.rest.frame,url:`/api/moving-speech/${record.id}/rest`},
        audio:{format:'s16le',sampleRate:24000,channels:1,byteLength:record.pcm.length}}));
      await send(ws,JSON.stringify({t:'pcm',id:record.id,byteLength:record.pcm.length}));
      await send(ws,record.pcm,true);
      await record.session.dispatch(record.input,{onChunk:async (meta,bytes)=>{
        await waitCredit(meta.rutor.length); await current(record);
        await send(ws,JSON.stringify(meta)); await send(ws,bytes,true);
      }});
      await send(ws,JSON.stringify({t:'done',id:record.input.plan.start.id,frames:record.input.plan.timeline.length}));
      done = true; record.delivered=true; ws.close(1000,'Complete');
      const drain=setTimeout(()=>ws.terminate(),2000);drain.unref?.();ws.once('close',()=>clearTimeout(drain));
    } catch {if (ws.readyState === WebSocket.OPEN) await send(ws,JSON.stringify({t:'error',code:'moving_speech_unavailable'})).catch(()=>{});}
    finally {await cancel(record);}
  }
  async function upgrade(req,socket,head) {
    let path; try {path=new URL(req.url,origin).pathname;} catch {return;}
    if (path.startsWith('/lipsync-moving/')) {
      for (const record of records.values()) if (record.session?.handleUpgrade(req,socket,head)) return;
      reject(socket); return;
    }
    if (path !== '/moving-speech-stream') return;
    let claimed;
    try {
      if (req.headers.origin !== origin || new URL(req.url,origin).search) fail('moving_speech_origin');
      const protocols=String(req.headers['sec-websocket-protocol']??'').split(',').map(v=>v.trim());
      if (protocols.length !== 2 || !protocols.includes('moving-v1')) fail('moving_speech_ticket');
      const ticket=protocols.find(v=>v.startsWith('ticket.'))?.slice(7);
      if (!ticket || ticket.length > 4096) fail('moving_speech_ticket');
      const [body,signature,extra]=ticket.split('.');
      if (extra || !same(signature,sign(body))) fail('moving_speech_ticket');
      const claim=JSON.parse(Buffer.from(body,'base64url').toString());
      const record=records.get(claim.sessionId);
      if (!record || record.used || record.state !== 'prepared' || record.expiresAt <= now()
        || !same(ticket,record.descriptor.ticket)) fail('moving_speech_ticket');
      record.used=true;claimed=record;
      await owner(record,req);
      if (socket.destroyed) {await cancel(record); return;}
      wss.handleUpgrade(req,socket,head,ws=>{void stream(record,ws);});
    } catch {if (claimed) await cancel(claimed);if (!socket.destroyed) reject(socket);}
  }
  server.on('upgrade',upgrade);
  const api = {
    supports: dealerId => dealerId === bank.sourceSet.dealerId,
    forContext: context => ({prepare:input=>api.prepare({...input,context})}),
    async prepare(input) {
      if (closing || !api.supports(input?.dealerId) || !ID.test(input.requestId ?? '') || !input.owner
        || typeof input.beforeCostly !== 'function' || typeof input.text !== 'string' || !input.text
        || input.text !== input.text.trim() || input.text.length > 500 || /[\u0000-\u001f\u007f-\u009f]/.test(input.text)) fail('moving_speech_input');
      const controller=new AbortController(),signal=AbortSignal.any([controller.signal,...(input.signal ? [input.signal]:[])]);
      const record={...input,controller,signal,state:'preparing'}; pending.add(record);
      try {
        await input.beforeCostly(); signal.throwIfAborted();
        record.voice=await dealerRuntime.prepareMoving({...input,signal,sourceSet:bank.sourceSet});
        record.evidence=await readEvidence(input.context,bank.sourceSet.rest.videoId);
        const expected=bank.sourceSet.clips.find(c=>c.videoId===bank.sourceSet.rest.videoId);
        assertMovingSpeechSource((await readRegistry()).videos.find(v=>v.id===expected.videoId),input.dealerId,expected);
        const registered=createRegisteredMovingSpeech({readRegistry,verifyBank:async()=>{
          // Ready has already compared this exact receipt with the worker that
          // verified the private archive, source set and loaded geometry.
          await record.session.ready();
          return {dealerId:input.dealerId,workerAvatar:bank.sourceSet.workerAvatar,
            sourceSetSha256:bank.sourceSet.sourceSetSha256,avatarSha256:bank.archive.sha256};
        }});
        record.session=await sessions.admit({ownerHash:digest(input.owner),userId:digest(input.owner),requestId:input.requestId,
          fingerprint:digest(JSON.stringify([input.text,input.dealerId,input.context,record.voice.profileRevision,bank.archive.sha256])),
          binding:{releaseSha256,dealerId:input.dealerId,workerAvatar:bank.sourceSet.workerAvatar,profileRevision:record.voice.profileRevision,
            sourceSetSha256:bank.sourceSet.sourceSetSha256,avatarSha256:bank.archive.sha256,bankReceiptSha256:bank.receipt.sha256},
          mediaReferences:record.evidence.mediaReferences,projectRevision:record.evidence.projectRevision,
          beforeCostly:()=>current(record),signal,
          bankDownload:async()=>{record.download=downloads.issue({signal,authorize:()=>current(record)});return record.download.descriptor;}});
        record.id=record.session.sessionId;record.binding=record.session.binding; records.set(record.id,record);
        await record.session.submit(); await record.session.ready(); await current(record);
        const chunks=[];let size=0;
        for await (const chunk of record.voice.source({text:input.text,signal,beforeCostly:()=>current(record)})) {
          size+=chunk.byteLength;if(size>1200000)fail('moving_speech_audio_limit');chunks.push(Buffer.from(chunk));
        }
        record.pcm=Buffer.concat(chunks);chunks.forEach(chunk=>chunk.fill(0));
        const frames=Array.from({length:Math.floor((size/2+18000)/1000)},()=>({...bank.sourceSet.rest,still:true}));
        record.input=await registered.prepare({sourceSet:bank.sourceSet,avatarSha256:bank.archive.sha256,frozenContext:record.evidence.frozenContext,
          binding:{sessionId:record.id,talkId:input.requestId,revision:1,profileRevision:record.voice.profileRevision,textSha256:digest(input.text),audioSha256:digest(record.pcm)},
          frames,audio:{pcm:record.pcm,format:'s16le',sampleRate:24000,channels:1},signal});
        await current(record);
        record.expiresAt=now()+connectionMs;
        const body=Buffer.from(JSON.stringify({sessionId:record.id,exp:record.expiresAt,attemptId:record.binding.attemptId,nonce:record.binding.nonce})).toString('base64url');
        record.descriptor=Object.freeze({schemaVersion:1,kind:'moving-speech-stream',id:record.id,requestId:input.requestId,dealerId:input.dealerId,
          exactText:input.text,textSha256:digest(input.text),reviewStatus:'pending',url:'/moving-speech-stream',ticket:body+'.'+sign(body),expiresAt:record.expiresAt,
          profileRevision:record.voice.profileRevision,avatarSha256:bank.archive.sha256,attemptId:record.binding.attemptId,nonce:record.binding.nonce,compositing:record.voice.compositing??null});
        record.state='prepared';record.timer=setTimeout(()=>void cancel(record),connectionMs);record.timer.unref?.();
        return record.descriptor;
      } catch(error) {await cancel(record);throw error;}
      finally {pending.delete(record);}
    },
    async handleHttp(req,res) {
      const path=new URL(req.url,origin).pathname;
      if (!path.startsWith('/api/moving-speech/')) return false;
      let response;
      try {
        const request=new Request(origin+req.url,{method:req.method,headers:req.headers});
        response=await downloads.response(request);
        if (!response) {
          const match=/^\/api\/moving-speech\/([a-f0-9]{32})\/rest$/.exec(path);
          const record=match && records.get(match[1]);
          if (!record || !['GET','HEAD'].includes(req.method) || new URL(req.url,origin).search) fail('moving_speech_rest_unavailable');
          await owner(record,req);
          response=await readRest(record.evidence,request);
        }
      } catch {response=new Response(null,{status:403,headers:{'Cache-Control':'private, no-store'}});}
      res.writeHead(response.status,Object.fromEntries(response.headers));
      if (!response.body) res.end(); else {const stream=Readable.fromWeb(response.body);res.once('close',()=>stream.destroy());stream.once('error',()=>res.destroy());stream.pipe(res);}
      return true;
    },
    cancelOwner: value=>Promise.all([...new Set([...pending,...records.values()])].filter(r=>r.owner===value).map(cancel)),
    cancelPlayer: value=>Promise.all([...new Set([...pending,...records.values()])].filter(r=>r.playerId===value).map(cancel)),
    async close() {closing=true;server.off('upgrade',upgrade);downloads.close();await Promise.all([...new Set([...pending,...records.values()])].map(cancel));wss.close();},
  };
  return Object.freeze(api);
}
