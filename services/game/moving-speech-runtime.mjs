import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { Readable } from 'node:stream';
import { createRequire } from 'node:module';
import { createRegisteredMovingSpeech, assertMovingSpeechSource } from './moving-speech-bank.mjs';
import { createMovingBankDownloads } from './moving-speech-bank-artifacts.mjs';
import { MOVING_SPEECH_MAX_PCM_BYTES, movingSpeechPcmFrameCount } from './moving-speech-timing.mjs';
import {createMovingDealReservations,prepareMovingDealPlan,presentationFingerprint} from './moving-speech-deal-plan.mjs';
import {prepareMovingIdleSource,prepareMovingIdlePlan} from './moving-speech-idle-plan.mjs';
import {SPEECH_PREPARATION_FAILURE_CODES} from '../../packages/presentation/contracts/chat-response.mjs';
import { createMovingSpeechRoomRelay } from './moving-speech-room-relay.mjs';
const {WebSocketServer,WebSocket}=createRequire(new URL('../astrid-gpu-worker/gateway/package.json',import.meta.url))('ws');

const digest = value => createHash('sha256').update(value).digest('hex');
const fail = code => {throw Object.assign(Error(code),{code,statusCode:503});};
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const STREAM_FAILURE_CODES = new Set([
  'moving_speech_cancelled', 'moving_speech_not_authorized', 'moving_speech_transport_consumed',
  'invalid_moving_speech_transport', 'moving_speech_client_backpressure', 'moving_speech_client_closed',
  'moving_speech_invalid_credit', 'moving_speech_credit_timeout', 'moving_speech_consumer_timeout',
  'moving_speech_playback_timeout', 'moving_speech_context_changed', 'moving_deal_changed', 'moving_speech_no_listeners',
  'generated_speech_profile_changed', 'generated_speech_reference_changed', 'generated_speech_moving_reference_unavailable',
  'generated_speech_cancelled', 'generated_speech_moving_release_timeout', 'generated_speech_moving_endpoint_mismatch',
  'generated_speech_moving_job_not_accepted',
  'moving_worker_release_changed', 'moving_worker_release_unverified', 'moving_worker_release_mismatch',
  'moving_worker_binding_requires_owned_release', 'moving_worker_attestation_mismatch', 'moving_worker_incompatible',
  'moving_worker_plan_padding_mismatch', 'moving_worker_wrong_reply', 'moving_worker_reported_error',
  'moving_worker_empty_result', 'moving_worker_incomplete_result', 'moving_worker_invalid_chunk',
  'moving_worker_wrong_frame', 'moving_worker_expected_binary', 'moving_worker_expected_metadata', 'moving_worker_invalid_json',
  'moving_worker_lifetime_exceeded', 'moving_worker_closed', 'moving_worker_socket_error', 'moving_worker_disconnected',
  'moving_worker_metadata_too_large', 'moving_worker_backpressure', 'moving_worker_concurrent_read',
  'moving_worker_startup_timeout', 'moving_worker_read_timeout', 'moving_worker_not_connected',
  'moving_worker_send_failed', 'moving_worker_write_timeout',
]);
const STREAM_PHASES = new Set(['current', 'ready', 'audio', 'dispatch', 'credit', 'chunk-current', 'chunk-send', 'done', 'played', 'client-message']);

const PREPARATION_FAILURE_CODES = new Set([...SPEECH_PREPARATION_FAILURE_CODES,...STREAM_FAILURE_CODES,'moving_idle_source_mismatch']);
const PREPARATION_PHASES = new Set(['guard','profile-voice','publication','deal-plan','source','admission','submit','worker-ready','current','voice','plan']);

function safeFailureCode(error, codes) {
  let code = 'moving_speech_unavailable';
  try {
    const candidate = error?.code;
    if (codes.has(candidate)) code = candidate;
    else {
      const message = error?.message;
      if (codes.has(message)) code = message;
      else if (error?.name === 'AbortError') code = 'moving_speech_cancelled';
    }
  } catch {}
  return code;
}

/** Server-only receipt. Never copy exception details or arbitrary correlation fields. */
export function movingSpeechFailureReceipt({error, phase, streamId, requestId}) {
  return {event:'moving_speech_stream_interrupted', code:safeFailureCode(error,STREAM_FAILURE_CODES),
    phase:STREAM_PHASES.has(phase) ? phase : 'unknown',
    streamId:typeof streamId === 'string' && streamId.length === 32 && /^[a-f0-9]{32}$/.test(streamId) ? streamId : null,
    requestId:typeof requestId === 'string' && ID.test(requestId) && requestId.trim() === requestId ? requestId : null};
}
export function movingSpeechPreparationFailureReceipt({error, phase, streamId, requestId}) {
  return {event:'moving_speech_preparation_failed',code:safeFailureCode(error,PREPARATION_FAILURE_CODES),
    phase:PREPARATION_PHASES.has(phase) ? phase : 'unknown',
    streamId:typeof streamId === 'string' && streamId.length === 32 && /^[a-f0-9]{32}$/.test(streamId) ? streamId : null,
    requestId:typeof requestId === 'string' && ID.test(requestId) && requestId.trim() === requestId ? requestId : null};
}
const same = (a,b) => typeof a === 'string' && typeof b === 'string'
  && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a),Buffer.from(b));
const publicPlan = plan => JSON.parse(JSON.stringify(plan));

/** Opt-in moving path, one lane per dealer with a verified bank: its own
 * sessions (endpoint), drift admission and bank capabilities. A dealer without
 * a lane is unsupported. The existing chat/Director still selects exact text.
 * All authorities and paid work stay here; the browser gets one spent ticket.
 * Idle speech follows the publication's own baseline with exact source frames.
 * readEvidence(context, mediaId, bank) reads the publication for that bank. */
export function createMovingSpeechRuntime({server, origin, workerOrigin = origin, ticketSecret, lanes, releaseSha256,
  dealerRuntime, resolveOwner, readEvidence, readRegistry, readRest, bankRead,
  bankOptions, readPresentation, publicVideo, now = Date.now, connectionMs = 15000,
  onStreamFailure = receipt => console.warn(JSON.stringify(receipt)),
  onPreparationFailure = receipt => console.warn(JSON.stringify(receipt)),
  onCleanupError = () => console.warn(JSON.stringify({event:'moving_speech_cleanup_requires_recovery'}))} = {}) {
  if (!server || typeof ticketSecret !== 'string' || ticketSecret.length < 32
    || !/^[a-f0-9]{64}$/.test(releaseSha256 ?? '') || !Array.isArray(lanes) || !lanes.length || lanes.length > 8
    || lanes.some(lane => typeof lane?.sessions?.admit !== 'function'
      || lane.admissionCheck !== undefined && typeof lane.admissionCheck !== 'function')
    || typeof dealerRuntime?.prepareMoving !== 'function' || [resolveOwner,readEvidence,readRegistry,readRest].some(fn=>typeof fn !== 'function')) fail('moving_speech_configuration');
  // Each bank is validated by its downloads; its source set names the dealer.
  const dealers = new Map(lanes.map(({bank,sessions,admissionCheck}) => {
    const downloads = createMovingBankDownloads({origin:workerOrigin,bank,read:bankRead,options:bankOptions,now});
    return [bank.sourceSet.dealerId,Object.freeze({bank,sessions,admissionCheck,downloads})];
  }));
  if (dealers.size !== lanes.length) fail('moving_speech_configuration');
  const records = new Map(), pending = new Set();
  // PR 4: a room answer is one GPU session with one buffer that every listener at the table reads (room relay).
  const relay = createMovingSpeechRoomRelay({ticketSecret,resolveOwner,now,ticketMs:connectionMs});
  const deals=createMovingDealReservations({now});
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
      if (!record.delivered) record.broadcast?.fail();
      record.pcm?.fill(0); record.input?.cancel();
      record.reservation?.finish();
      return await record.session?.cancel();
    }).catch(()=>{
      try {onCleanupError();} catch {}
      return {cancelled:false,recoveryRequired:true};
    }).finally(()=>records.delete(record.id));
    return record.cancelled;
  }
  // asker:false (room pump only): the answer belongs to the table, not to the asker, so the asker's own chat freshness
  // is not checked per chunk. Session, voice profile and publication evidence (the dealer's freshness) still are.
  async function current(record,{checkSession=true,submissionPhase=false,asker=true}={}) {
    record.signal.throwIfAborted(); if(asker) await record.beforeCostly();
    if(checkSession) await record.session?.assertCurrent?.({submissionPhase});
    await record.voice.assertFresh();
    if(record.deal){
      record.reservation.assertCurrent();
      const receipt=await readPresentation(record.playerId);
      if(!receipt||presentationFingerprint(receipt)!==record.deal.fingerprint)fail('moving_deal_changed');
    }
    const {bank} = record.lane;
    const evidence = await readEvidence(record.context,bank.sourceSet.rest.videoId,bank);
    if (evidence.projectRevision !== record.evidence.projectRevision
      || JSON.stringify(evidence.mediaReferences) !== JSON.stringify(record.evidence.mediaReferences)) fail('moving_speech_context_changed');
    if(record.idle&&prepareMovingIdleSource({frozenContext:evidence.frozenContext,sourceSet:bank.sourceSet,
      publicVideo:id=>publicVideo(evidence.frozenContext,id)}).fingerprint!==record.idle.fingerprint)fail('moving_speech_context_changed');
    record.signal.throwIfAborted();
    // A newer committed deal may replace the reservation during either read.
    // Keep this final check synchronous after every awaited freshness check.
    if(record.deal)record.reservation.assertCurrent();
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
  function readyMessage(record) {
    const {bank} = record.lane;
    const {videoId,sha256,fps,frameCount,width,height,bytes} = bank.sourceSet.clips.find(c=>c.videoId===bank.sourceSet.rest.videoId);
    return JSON.stringify({t:'ready',protocol:1,id:record.id,attemptId:record.binding.attemptId,nonce:record.binding.nonce,
      plan:publicPlan(record.input.plan),rest:{videoId,sha256,fps,frameCount,width,height,bytes,sourceFrame:bank.sourceSet.rest.frame,url:`/api/moving-speech/${record.id}/rest`},
      ...(record.sequence?{sequence:record.sequence}:{}),
      audio:{format:'s16le',sampleRate:24000,channels:1,byteLength:record.pcm.length}});
  }
  // Room answer: the worker streams into the relay at once, never waiting for a listener's credit. Every chunk
  // passes the dealer's freshness (session, voice, publication) once, however many listeners read it; the asker
  // leaving the table or a new round does not end it for the others. Nobody listening and no ticket left to
  // redeem stops the GPU at the next chunk.
  async function pump(record) {
    const broadcast=record.broadcast;let phase='dispatch';
    try {
      await record.session.dispatch(record.input,{onChunk:async (meta,bytes)=>{
        phase='chunk-current'; if(!broadcast.listened())fail('moving_speech_no_listeners'); await current(record,{asker:false});
        phase='chunk-send'; if(!broadcast.push([[JSON.stringify(meta),false],[bytes,true]],meta.rutor.length))fail('moving_speech_cancelled');
        phase='dispatch';
      }});
      phase='done';
      broadcast.push([[JSON.stringify({t:'done',id:record.input.plan.start.id,frames:record.input.plan.timeline.length}),false]]);
      record.delivered=true; broadcast.end();
    } catch(error) {
      try {Promise.resolve(onStreamFailure(movingSpeechFailureReceipt({error,phase,streamId:record.id,requestId:record.requestId}))).catch(()=>{});} catch {}
    } finally {await cancel(record);}
  }
  async function stream(record,ws) {
    record.ws = ws; clearTimeout(record.timer);
    let credit = 0, sent = 0, wake = null, done = false, played=false, sentDone=false;
    let phase = 'current', reported = false;
    const report = (error, failurePhase = phase) => {
      if (reported) return;
      reported = true;
      try {
        const receipt = movingSpeechFailureReceipt({error,phase:failurePhase,streamId:record.id,requestId:record.requestId});
        Promise.resolve(onStreamFailure(receipt)).catch(()=>{});
      } catch {}
    };
    const stop = () => {wake?.(); if (!done) void cancel(record);};
    ws.on('close',stop); ws.on('error',stop);
    ws.on('message',(data,binary)=>{
      try {
        if (binary) fail('moving_speech_invalid_credit');
        const value = JSON.parse(data.toString('utf8'));
        if(record.deal&&value.t==='played'&&value.id===record.input.plan.start.id&&sentDone
          &&Object.keys(value).sort().join(',')==='id,t'){played=true;done=true;wake?.();return;}
        if (value.t === 'abort' && value.id === record.id && Object.keys(value).sort().join(',') === 'id,t') {void cancel(record); return;}
        if (Object.keys(value).sort().join(',') !== 'frames,id,t' || value.t !== 'credit'
          || value.id !== record.input.plan.start.id || !Number.isSafeInteger(value.frames)
          || value.frames < 1 || value.frames > 48 || credit + value.frames > 48
          || sent + credit + value.frames > record.input.plan.timeline.length + 48) fail('moving_speech_invalid_credit');
        credit += value.frames; wake?.();
      } catch (error) {report(error,'client-message');void cancel(record);}
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
      phase = 'ready';
      await send(ws,readyMessage(record));
      phase = 'audio';
      await send(ws,JSON.stringify({t:'pcm',id:record.id,byteLength:record.pcm.length}));
      await send(ws,record.pcm,true);
      phase = 'dispatch';
      await record.session.dispatch(record.input,{onChunk:async (meta,bytes)=>{
        phase = 'credit'; await waitCredit(meta.rutor.length);
        phase = 'chunk-current'; await current(record);
        phase = 'chunk-send';
        await send(ws,JSON.stringify(meta)); await send(ws,bytes,true);
        phase = 'dispatch';
      }});
      phase = 'done';
      await send(ws,JSON.stringify({t:'done',id:record.input.plan.start.id,frames:record.input.plan.timeline.length}));
      sentDone=true;
      if(record.deal){
        phase = 'played';
        const deadline=now()+45000;
        while(!played){
          if(now()>deadline)fail('moving_speech_playback_timeout');
          await new Promise(resolve=>{const timer=setTimeout(resolve,500);wake=()=>{clearTimeout(timer);resolve();};});
          wake=null;await current(record);
        }
      }
      done = true; record.delivered=true; ws.close(1000,'Complete');
      const drain=setTimeout(()=>ws.terminate(),2000);drain.unref?.();ws.once('close',()=>clearTimeout(drain));
    } catch (error) {
      report(error);
      if (ws.readyState === WebSocket.OPEN) await send(ws,JSON.stringify({t:'error',code:'moving_speech_unavailable'})).catch(()=>{});
    }
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
      if (Object.hasOwn(claim,'r')) {
        // A room listener's own ticket: owner, socket and freshness are the relay's checks; a failure spends only this ticket.
        const listener=await relay.redeem(ticket,req);
        if (socket.destroyed) return;
        wss.handleUpgrade(req,socket,head,ws=>{void relay.attach(listener,ws);});
        return;
      }
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
  const active = () => [...new Set([...pending,...records.values()])];
  const api = {
    supports: dealerId => typeof dealerId === 'string' && dealers.has(dealerId),
    observeCommitted(observation) {
      deals.committed(observation);
      // Invalidate active output even when the worker is stalled between chunks.
      for(const record of new Set([...pending,...records.values()])){
        if(record.playerId!==observation.playerId||!record.reservation)continue;
        try {record.reservation.assertCurrent();} catch {void cancel(record);}
      }
    },
    normalPresentation: (playerId,version)=>deals.normal(playerId,version),
    // {room:true}: a shared-room answer (no presentationVersion), served to every listener through the relay.
    forContext: (context,presentationVersion,sessionRevision,{room=false}={}) => ({
      prepare:input=>api.prepare({...input,context,presentationVersion,sessionRevision,...(room&&presentationVersion===undefined?{room:true}:{})}),
      ...(room?{issue:api.issue}:{})}),
    // One more listener for a room answer: the same descriptor with that recipient's own single-use ticket, or null
    // once the answer's buffer is gone (that listener keeps the text).
    issue(descriptor,recipient) {
      const broadcast=relay.get(descriptor?.id);
      if (!broadcast||descriptor.attemptId!==broadcast.attemptId||descriptor.nonce!==broadcast.nonce) return null;
      const issued=broadcast.issue(recipient);
      return issued&&Object.freeze({...descriptor,...issued});
    },
    async prepare(input) {
      if (closing || !input) fail('moving_speech_input');
      if (!api.supports(input.dealerId)) fail('moving_speech_dealer_unavailable');
      // Solo and shared-room contexts both name the published dealer; evidence is read with that
      // context, so it must be this dealer's. A room context has no presentationVersion:
      // speech follows its published idle baseline without a deal reservation.
      if (!input.context || typeof input.context !== 'object' || input.context.dealerId !== input.dealerId) fail('moving_speech_input');
      if (!ID.test(input.requestId ?? '') || !input.owner
        || typeof input.beforeCostly !== 'function' || typeof input.text !== 'string' || !input.text
        || input.text !== input.text.trim() || input.text.length > 500 || /[\u0000-\u001f\u007f-\u009f]/.test(input.text)) fail('moving_speech_input');
      const lane=dealers.get(input.dealerId),{bank,sessions}=lane;
      // A room answer follows the asker's request signal only while it is prepared; once the descriptor is out it
      // belongs to everyone at the table, and the asker's HTTP request ending must not cut the others off.
      const controller=new AbortController(),follow=()=>controller.abort(input.signal.reason);
      const signal=input.room?controller.signal:AbortSignal.any([controller.signal,...(input.signal ? [input.signal]:[])]);
      if(input.room&&input.signal){input.signal.addEventListener('abort',follow,{once:true});if(input.signal.aborted)follow();}
      const record={...input,lane,controller,signal,state:'preparing'}; pending.add(record);
      let phase='guard';
      try {
        await input.beforeCostly(); signal.throwIfAborted();
        record.driftAdmission=await lane.admissionCheck?.();
        signal.throwIfAborted();
        phase='profile-voice';
        record.voice=await dealerRuntime.prepareMoving({...input,signal,sourceSet:bank.sourceSet});
        phase='publication';
        record.evidence=await readEvidence(input.context,bank.sourceSet.rest.videoId,bank);
        if(input.presentationVersion!==undefined){
          phase='deal-plan';
          if(typeof readPresentation!=='function'||typeof publicVideo!=='function')fail('moving_deal_unavailable');
          record.reservation=deals.claim(input.playerId,input.dealerId,input.presentationVersion,
            {ownerHash:digest(input.owner),context:input.context,sessionRevision:input.sessionRevision});
          record.deal=prepareMovingDealPlan({receipt:await readPresentation(input.playerId),version:input.presentationVersion,
            frozenContext:record.evidence.frozenContext,sourceSet:bank.sourceSet,
            publicVideo:id=>publicVideo(record.evidence.frozenContext,id)});
          record.sequence={version:record.deal.version,steps:record.deal.steps,sources:record.deal.sources,
            frames:record.deal.frames.map(row=>({take:'clip-'+row.videoId,frame:row.frame,
              sourceSha256:bank.sourceSet.clips.find(c=>c.videoId===row.videoId).sha256}))};
        }else record.idle=prepareMovingIdleSource({frozenContext:record.evidence.frozenContext,sourceSet:bank.sourceSet,
          publicVideo:typeof publicVideo==='function'?id=>publicVideo(record.evidence.frozenContext,id):undefined});
        phase='source';
        const expected=bank.sourceSet.clips.find(c=>c.videoId===bank.sourceSet.rest.videoId);
        assertMovingSpeechSource((await readRegistry()).videos.find(v=>v.id===expected.videoId),input.dealerId,expected);
        const registered=createRegisteredMovingSpeech({readRegistry,verifyBank:async()=>{
          // Ready has already compared this exact receipt with the worker that
          // verified the private archive, source set and loaded geometry.
          await record.session.ready();
          return {dealerId:input.dealerId,workerAvatar:bank.sourceSet.workerAvatar,
            sourceSetSha256:bank.sourceSet.sourceSetSha256,avatarSha256:bank.archive.sha256};
        }});
        // Room answers (PR 4) start TTS as soon as submit is done, in parallel with worker-ready, but only when the
        // admission saw a warm worker; a cold admission waits for ready as solo does, so a cold start (up to 296 s,
        // possibly aborted) never pays for voice. A refused admission never starts TTS. Starting after submit means a
        // TTS failure can abort only ready, never a submit in flight (which would lock the budget as uncertain).
        const collect=async(options)=>{
          const chunks=[];let size=0;
          for await (const chunk of record.voice.source({text:input.text,signal,beforeCostly:()=>current(record,options)})) {
            size+=chunk.byteLength;if(size>MOVING_SPEECH_MAX_PCM_BYTES)fail('moving_speech_audio_limit');chunks.push(Buffer.from(chunk));
          }
          const pcm=Buffer.concat(chunks);chunks.forEach(chunk=>chunk.fill(0));return pcm;
        };
        let speaking=null;
        try {
        phase='admission';
        record.session=await sessions.admit({ownerHash:digest(input.owner),userId:digest(input.owner),requestId:input.requestId,
          fingerprint:digest(JSON.stringify([input.text,input.dealerId,input.context,record.voice.profileRevision,bank.archive.sha256,record.deal?.fingerprint??record.idle?.fingerprint??null])),
          binding:{releaseSha256,dealerId:input.dealerId,workerAvatar:bank.sourceSet.workerAvatar,profileRevision:record.voice.profileRevision,
            sourceSetSha256:bank.sourceSet.sourceSetSha256,avatarSha256:bank.archive.sha256,bankReceiptSha256:bank.receipt.sha256},
          mediaReferences:record.evidence.mediaReferences,projectRevision:record.evidence.projectRevision,
          driftAdmission:record.driftAdmission,
          // Session guards already check SQL after product freshness, including
          // submission_started at the final dispatch. Avoid recursively applying
          // the ordinary reserved/running check inside that callback.
          beforeCostly:()=>current(record,{checkSession:false}),signal,
          bankDownload:async({sessionSignal,ttlMs})=>{record.download=lane.downloads.issue({
            signal:AbortSignal.any([signal,sessionSignal]),ttlMs,authorize:()=>current(record,{submissionPhase:true})});return record.download.descriptor;}});
        record.id=record.session.sessionId;record.binding=record.session.binding; records.set(record.id,record);
        phase='submit'; await record.session.submit();
        if(input.room&&record.session.warm===true){speaking=collect().catch(error=>{record.voiceFailure=error;controller.abort();throw error;});speaking.catch(()=>{});}
        phase='worker-ready'; await record.session.ready();
        phase='current'; await current(record);
        } catch(error) {if(record.voiceFailure){phase='voice';throw record.voiceFailure;}throw error;}
        phase='voice';
        record.pcm=await (speaking??collect());
        const frameCount=movingSpeechPcmFrameCount(record.pcm.length);
        if(record.idle)record.sequence=prepareMovingIdlePlan(record.idle,frameCount);
        const frames=Array.from({length:frameCount},(_,k)=>record.idle
          ?{videoId:record.idle.source.videoId,frame:record.sequence.frames[k].frame}
          :record.deal?.frames[k]??({...bank.sourceSet.rest,still:true}));
        phase='plan';
        record.input=await registered.prepare({sourceSet:bank.sourceSet,avatarSha256:bank.archive.sha256,frozenContext:record.evidence.frozenContext,
          binding:{sessionId:record.id,talkId:input.requestId,revision:1,profileRevision:record.voice.profileRevision,textSha256:digest(input.text),audioSha256:digest(record.pcm)},
          frames,audio:{pcm:record.pcm,format:'s16le',sampleRate:24000,channels:1},signal});
        phase='current'; await current(record);
        if(input.room){
          record.broadcast=relay.open({id:record.id,attemptId:record.binding.attemptId,nonce:record.binding.nonce,planId:record.input.plan.start.id,
            frames:record.input.plan.timeline.length,owner:input.owner,playerId:input.playerId,dealerId:input.dealerId,data:record.evidence});
          record.broadcast.push([[readyMessage(record),false]]);
          record.broadcast.push([[JSON.stringify({t:'pcm',id:record.id,byteLength:record.pcm.length}),false],[record.pcm,true]]);
          // The asker is the first listener; the chat route issues one more ticket per room socket.
          const issued=record.broadcast.issue({owner:input.owner,playerId:input.playerId,check:()=>input.beforeCostly()});
          record.expiresAt=issued.expiresAt;record.ticket=issued.ticket;
        } else record.expiresAt=now()+connectionMs;
        const body=Buffer.from(JSON.stringify({sessionId:record.id,exp:record.expiresAt,attemptId:record.binding.attemptId,nonce:record.binding.nonce})).toString('base64url');
        record.descriptor=Object.freeze({schemaVersion:1,kind:'moving-speech-stream',id:record.id,requestId:input.requestId,dealerId:input.dealerId,
          exactText:input.text,textSha256:digest(input.text),reviewStatus:'pending',url:'/moving-speech-stream',ticket:record.ticket??body+'.'+sign(body),expiresAt:record.expiresAt,
          profileRevision:record.voice.profileRevision,avatarSha256:bank.archive.sha256,attemptId:record.binding.attemptId,nonce:record.binding.nonce,compositing:record.voice.compositing??null,
          ...(record.sequence?{...(record.deal?{presentationVersion:record.deal.version}:{sequenceKind:'idle'}),
            sequenceSha256:digest(JSON.stringify(record.sequence))}:{})});
        if(input.room){record.state='pumping';void pump(record);return record.descriptor;}
        record.state='prepared';record.timer=setTimeout(()=>void cancel(record),connectionMs);record.timer.unref?.();
        return record.descriptor;
      } catch(error) {
        // Observability must neither delay cleanup nor replace the first failure.
        try {
          const receipt=movingSpeechPreparationFailureReceipt({error,phase,streamId:record.id,requestId:record.requestId});
          Promise.resolve(onPreparationFailure(receipt)).catch(()=>{});
        } catch {}
        await cancel(record);throw error;
      }
      finally {pending.delete(record);input.signal?.removeEventListener('abort',follow);}
    },
    async handleHttp(req,res) {
      const path=new URL(req.url,origin).pathname;
      if (!path.startsWith('/api/moving-speech/')) return false;
      let response;
      try {
        const request=new Request(origin+req.url,{method:req.method,headers:req.headers});
        // A capability no bank issued gets the ordinary denial of the first bank.
        const issuers=[...dealers.values()];
        response=await (issuers.find(lane=>lane.downloads.owns(request))??issuers[0]).downloads.response(request);
        if (!response) {
          const match=/^\/api\/moving-speech\/([a-f0-9]{32})\/rest$/.exec(path);
          if (!match || !['GET','HEAD'].includes(req.method) || new URL(req.url,origin).search) fail('moving_speech_rest_unavailable');
          if (relay.get(match[1])) response=await readRest(await relay.authorizeRest(match[1],req),request);
          else {
            const record=records.get(match[1]);
            if (!record) fail('moving_speech_rest_unavailable');
            await owner(record,req);
            response=await readRest(record.evidence,request);
          }
        }
      } catch {response=new Response(null,{status:403,headers:{'Cache-Control':'private, no-store'}});}
      res.writeHead(response.status,Object.fromEntries(response.headers));
      if (!response.body) res.end(); else {const stream=Readable.fromWeb(response.body);res.once('close',()=>stream.destroy());stream.once('error',()=>res.destroy());stream.pipe(res);}
      return true;
    },
    cancelActive: ()=>{relay.close();return Promise.all(active().map(cancel));},
    // A dealer's drift Off drains only that dealer's endpoint and attempts.
    cancelDealer: dealerId=>{relay.cancel(b=>b.dealerId===dealerId);return Promise.all(active().filter(r=>r.dealerId===dealerId).map(cancel));},
    cancelOwner: value=>{relay.cancel(b=>b.owner===value);return Promise.all(active().filter(r=>r.owner===value).map(cancel));},
    cancelPlayer: value=>{relay.cancel(b=>b.playerId===value);return Promise.all(active().filter(r=>r.playerId===value).map(cancel));},
    async close() {closing=true;server.off('upgrade',upgrade);relay.close();for(const lane of dealers.values())lane.downloads.close();await Promise.all(active().map(cancel));wss.close();},
  };
  return Object.freeze(api);
}
