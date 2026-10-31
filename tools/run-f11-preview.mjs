// Explicit preview-only client. Import/help/read never construct network ports.
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { F11_TARGET, createF11Observer, validateF11Ownership } from './shared-room-f11-observer.mjs';
import { parseSharedRoomCommand } from '../services/game/shared-room-command-contract.mjs';
import { projectSharedRoomSnapshot } from '../services/game/shared-room-channel.mjs';

export const f11Hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const f11Need = (value, code) => { if (!value) throw Object.assign(Error(`f11_${code}`), {code:`f11_${code}`}); };
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);
const safeCode = error => /^f11_[a-z_]+$/.test(error?.code) ? error.code : 'f11_operation_failed';
const integer = value => Number.isSafeInteger(value) && value >= 0;
const actorName = (runId, i) => `${runId}-${i ? 'b' : 'a'}`;

export function validateF11Plan(value) {
  f11Need(value?.schemaVersion === 1 && value.syntheticOnly === true
    && Object.entries(F11_TARGET).every(([key, expected]) => value[key] === expected), 'target_mismatch');
  f11Need(/^f11-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.runId) && value.runId.length <= 28
    && /^[a-f0-9]{40}$/.test(value.sha) && uuid(value.roomKey), 'plan_identity_invalid');
  f11Need(/^[a-z][a-z0-9-]{0,63}$/.test(value.sourceLaneId)
    && ['en','sv'].includes(value.gameConfig?.language)
    && /^[a-z][a-z0-9-]{0,31}$/.test(value.gameConfig?.limitPreset)
    && Number.isFinite(value.chip) && value.chip > 0 && value.chip <= 100
    && integer(value.durationMs) && value.durationMs >= 120000 && value.durationMs <= 780000, 'plan_invalid');
  return Object.freeze({...F11_TARGET,schemaVersion:1,syntheticOnly:true,runId:value.runId,sha:value.sha,roomKey:value.roomKey,
    sourceLaneId:value.sourceLaneId,gameConfig:{language:value.gameConfig.language,limitPreset:value.gameConfig.limitPreset},
    chip:value.chip,durationMs:value.durationMs});
}

export function f11FixtureIdentity(plan) {
  const hex = f11Hash([plan.environment,plan.workspaceId,plan.runId,plan.roomKey.toLowerCase()]);
  return {operatorId:plan.runId,roomId:`room-${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`,
    usernames:[actorName(plan.runId,0),actorName(plan.runId,1)]};
}

function targetEvidence(value, plan) {
  f11Need(value && Object.entries(F11_TARGET).every(([key, expected]) => value[key] === expected)
    && value.source === 'provider-api' && value.engineSha === plan.sha && value.vercelSha === plan.sha
    && value.ready === true && value.suspended === false && value.healthStatus === 200, 'provider_identity_invalid');
  return {...F11_TARGET,source:'provider-api',engineSha:value.engineSha,vercelSha:value.vercelSha,
    ready:true,suspended:false,healthStatus:200};
}

export async function prepareF11Fixture(plan, ports, {run = false} = {}) {
  f11Need(run === true, 'explicit_run_required');
  plan = validateF11Plan(plan);
  const identity = f11FixtureIdentity(plan);
  const provider = targetEvidence(await ports.provider(plan),plan);
  const before = await ports.inspect(plan,identity);
  f11Need(before && integer(before.at) && before.database === plan.database
    && ['operators','accounts','rooms','packages'].every(key => before.absent?.[key] === 0), 'fixture_already_exists');
  f11Need(before.sourceReady === true && typeof before.unchangedHash === 'string', 'existing_media_required');
  const journal={...F11_TARGET,runId:plan.runId,...identity,sha:plan.sha,checkedAt:before.at,absent:before.absent,
    preexistingStateHash:before.unchangedHash,steps:[]};
  const record=async (action,state,extra={})=>{journal.steps.push({action,state,at:ports.now(),...extra});await ports.save('creation.json',journal);};
  await ports.adminLogin();
  // Only the fresh f11 operator can be mutated. No update/upsert endpoint is used.
  await record('operator-create','requested');
  const company = await ports.http('admin','POST','/studio/api/admin/operator-create',{slug:plan.runId,name:plan.runId});
  f11Need(company.ok && company.operator?.id === identity.operatorId && company.operator.slug === plan.runId
    && company.operator.status === 'active' && company.missingRoles?.length === 0, 'operator_creation_unverified');
  await record('operator-create','verified');
  const q = new URLSearchParams({operatorId:identity.operatorId,presentationLaneId:plan.sourceLaneId,game:'blackjack'});
  const prepared = await ports.http('admin','GET',`/studio/api/admin/presentation-room?${q}`);
  f11Need(prepared.ok && prepared.ready && prepared.operator?.id === identity.operatorId && prepared.packageRevision === null
    && prepared.rooms?.length === 0 && prepared.presentationLaneId === plan.sourceLaneId, 'room_preflight_rejected');
  const payload = {operatorId:identity.operatorId,presentationLaneId:plan.sourceLaneId,name:plan.runId,
    idempotencyKey:plan.roomKey,expectedProjectRevision:prepared.projectRevision,
    expectedAdministrationRevision:prepared.administrationRevision,expectedPackageRevision:null,gameConfig:plan.gameConfig};
  await record('room-create','requested');
  const created = await ports.http('admin','POST','/studio/api/admin/presentation-room',payload);
  f11Need(created.ok && created.duplicate === false && created.room?.id === identity.roomId
    && created.room.operatorId === identity.operatorId && created.room.presentationLaneId === plan.sourceLaneId
    && created.packageRevision === 1 && created.published, 'room_creation_unverified');
  await record('room-create','verified');
  const actors = [];
  for (let i=0;i<2;i++) {
    await record(`account-${i}`,'requested');
    const player = await ports.register(i,identity.usernames[i]);
    f11Need(uuid(player?.id) && !actors.includes(player.id), 'account_creation_unverified'); actors.push(player.id);
    await record(`account-${i}`,'verified',{actorId:player.id});
  }
  const after = await ports.inspect(plan,identity);
  f11Need(after.unchangedHash === before.unchangedHash && after.room?.id === identity.roomId
    && after.room.operatorId === identity.operatorId && after.room.presentationLaneId === plan.sourceLaneId
    && after.packageRevision === 1 && after.roomCount === 1 && after.accounts?.length === 2, 'fixture_readback_invalid');
  const accounts = actors.map((actorId,i) => {
    const row = after.accounts.find(row => row.actorId === actorId && row.username === identity.usernames[i]);
    f11Need(row && row.createdAt >= before.at && row.createdAt <= after.at && row.status === 'active'
      && row.openings?.length === 1 && row.balanceCents === 100000, 'account_readback_invalid');
    const opening = row.openings[0];
    f11Need(opening.type === 'open' && opening.amountCents === 100000 && opening.currency === 'USD'
      && opening.sourceKey === null && opening.fingerprint === null, 'opening_readback_invalid');
    return {actorId,username:row.username,createdAt:row.createdAt,openingId:opening.id,
      openingCents:opening.amountCents,currency:opening.currency,openingAt:opening.at};
  });
  const ownership = {schemaVersion:1,source:'preview-api-created',runId:plan.runId,operatorId:identity.operatorId,
    roomId:identity.roomId,checkedAt:before.at,verifiedAt:after.at,absent:before.absent,
    readback:{...F11_TARGET,operatorId:identity.operatorId,roomId:identity.roomId,configVersion:after.configVersion,
      packageRevision:after.packageRevision,roomCount:after.roomCount,accountCount:accounts.length},accounts};
  ownership.digest=f11Hash(ownership);
  validateF11Ownership(ownership,{...plan,roomId:identity.roomId,actors,startedAt:ports.now()});
  await ports.save('ownership.json',ownership);
  return {plan,identity,actors,ownership,provider};
}

// Commands use only server snapshots, including seat/member generations and the
// exact round/turn sequence. No client clock changes, card choices or wallet writes.
export function nextF11Command(snapshot, {seat, chip, draining=false, bothSeated=true, elapsedMs=0} = {}) {
  const s=snapshot, me=s?.me;
  if (!me || !['bets','round','settled'].includes(s.phase)) return null;
  const mine=s.owners?.[seat] === me.id, player=s.players?.find(row=>row.id===me.id);
  // Scheduling only: retain the original serverNow in every evidence frame.
  const serverNow=s.serverNow+Math.max(0,elapsedMs);
  const turnOpen=serverNow >= (s.plan?.turnAt ?? 0) && (!s.actionDeadline || serverNow < s.actionDeadline);
  if (s.phase==='round') {
    if (me.insuranceDue && turnOpen) return {op:'insurance',roundId:s.roundId,phase:'insurance',take:false};
    const hand=s.round?.hands?.[s.round.active];
    if (turnOpen && hand && s.owners[hand.box]===me.id && s.round.legalActions?.includes('stand'))
      return {op:'act',roundId:s.roundId,turnSeq:s.turnSeq,box:hand.box,handIndex:s.round.active,action:'stand'};
    return null;
  }
  if (s.phase==='settled') return {op:'next',roundId:s.roundId};
  if (draining) {
    if (mine && s.bets[seat].main > 0 && !player?.ready) return {op:'clear',windowId:s.windowId};
    return me.active && mine ? {op:'leave',memberGen:me.memberGen} : null;
  }
  if (me.pausedUntil > serverNow || player?.leaving || player?.ready || s.deadline && serverNow >= s.deadline) return null;
  if (!mine) return s.owners?.[seat] === null ? {op:'join',memberGen:me.memberGen,seats:[seat],seatGens:{[seat]:s.seatGen[seat]}} : null;
  if (!bothSeated) return null;
  if (!s.settings?.chips?.includes(chip) || chip < s.settings.limits.min || chip > s.settings.limits.max) return null;
  if (!s.bets[seat].main) return {op:'bet',windowId:s.windowId,seat,field:'main',chip};
  return {op:'ready',windowId:s.windowId};
}

export function correlateF11Log(receipt, connection, plan) {
  f11Need(receipt?.source === 'render-api-capture' && receipt.serviceId === plan.serviceId
    && receipt.deployment?.serviceId === plan.serviceId && receipt.deployment?.commit?.id === plan.sha
    && typeof receipt.deployment.id === 'string' && receipt.deployment.id.startsWith('dep-'), 'provenance_required');
  const log=receipt.log;
  let payload;try { payload=JSON.parse(log?.message); } catch { f11Need(false,'provenance_required'); }
  const labels=Array.isArray(log.labels) ? Object.fromEntries(log.labels.map(x=>[x.name,x.value])) : log.labels;
  f11Need(payload?.event==='shared_room_socket_identity' && payload.processId===connection.processId
    && payload.socketNonce===connection.nonce && integer(payload.at) && Math.abs(payload.at-connection.at)<=2000
    && typeof log.id==='string' && /^[a-zA-Z0-9_.:-]{1,128}$/.test(log.id)
    && typeof labels?.instance==='string' && labels.instance.startsWith(`${plan.serviceId}-`)
    && labels.resource===plan.serviceId && labels.type==='app'
    && Math.abs(Date.parse(log.timestamp)-payload.at)<=2000, 'socket_log_mismatch');
  return {source:'render-app-log',logId:log.id,instanceId:labels.instance,connectionNonce:connection.nonce,
    serviceId:plan.serviceId,sha:plan.sha,at:payload.at};
}

export async function runF11Preview(input, ports, {run=false}={}) {
  f11Need(run===true,'explicit_run_required');const plan=validateF11Plan(input);
  const connections=[],events=[],latest=[null,null],receivedAt=[0,0],pending=[null,null],current=[null,null];
  let fixture, startedAt, stopping=false, reconnectSeen=false, lastMoney=0, lastProbe=0, stateBytes=0, failure=null, restartReady=false, endedAt;
  const add=(type,at,data)=>{const event={...data,type,at};stateBytes+=Buffer.byteLength(JSON.stringify(event));
    f11Need(events.length<99000 && stateBytes<28*1024*1024,'capture_limit');events.push(event);};
  const sample=async stage=>{const money=await ports.money(fixture.identity.roomId,fixture.actors);
    add('money',ports.now(),{...F11_TARGET,...money,source:'preview-sql',stage,roomId:fixture.identity.roomId,actors:fixture.actors});return money;};
  async function connect(index) {
    const c={id:randomUUID(),index,actorId:fixture.actors[index],at:ports.now(),closed:false,frame:null};
    connections.push(c);
    c.socket=await ports.socket(index,fixture.identity.roomId,{
      identity(value){f11Need(/^v1\.([a-f0-9-]{36})\.([a-f0-9-]{36})$/.test(value),'runtime_identity_required');
        const [,processId,nonce]=value.split('.');f11Need(uuid(processId)&&uuid(nonce),'runtime_identity_required');Object.assign(c,{processId,nonce,at:ports.now()});},
      frame(frame){try {if(frame?.type==='shared-room-chat'&&frame.roomId===fixture.identity.roomId)return;
        f11Need(frame?.type==='shared-room-state' && frame.roomId===fixture.identity.roomId
          && frame.snapshot?.me?.id===c.actorId,'socket_scope_invalid');
        frame={type:frame.type,roomId:frame.roomId,snapshot:projectSharedRoomSnapshot(frame.snapshot,{roomId:fixture.identity.roomId,actorId:c.actorId}),presentation:frame.presentation};
        c.frame=frame;if(!latest[index] || frame.snapshot.version>=latest[index].version) {latest[index]=frame.snapshot;receivedAt[index]=ports.now();}
        add('frame',ports.now(),{connectionId:c.id,frame});}catch(error){failure=error;}},
      close(code){if(c.closed)return;c.closed=true;try{add('close',ports.now(),{connectionId:c.id,code});}catch(error){failure=error;}if(code===1012)c.restarted=true;},
    });
    f11Need(c.processId && c.nonce,'runtime_identity_required');current[index]=c;return c;
  }
  async function command(index,draining) {
    const s=latest[index];if(!s || current[index]?.closed)return;
    const bothSeated=fixture.actors.every((actor,i)=>latest.some(view=>view?.owners?.[i]===actor));
    const intent=nextF11Command(s,{seat:index,chip:plan.chip,draining,bothSeated,elapsedMs:ports.now()-receivedAt[index]});
    if(!pending[index] && intent)pending[index]={...intent,commandId:randomUUID()};
    const body=pending[index];if(!body)return;
    parseSharedRoomCommand(fixture.identity.roomId,body);
    let result;try {result=await ports.command(index,fixture.identity.roomId,body);}catch{return;} // unknown outcome: same bytes/ID next attempt
    if(result.status===503 || result.status===429)return;
    pending[index]=null;
    f11Need([200,409].includes(result.status),'game_command_rejected');
    if(result.body?.snapshot?.me?.id===fixture.actors[index] && result.body.snapshot.version >= (latest[index]?.version??0)) {
      latest[index]=result.body.snapshot;receivedAt[index]=ports.now();
    }
  }
  async function drain() {
    stopping=true;const until=ports.now()+45000;
    while(ports.now()<until) {
      for(let i=0;i<2;i++) {if(current[i]?.closed)await connect(i);await command(i,true);}
      const row=await sample('during');
      if(row.hands===0 && row.reservations.length===0)return true;
      await ports.sleep(500);
    }
    return false;
  }
  try {
    fixture=await prepareF11Fixture(plan,ports,{run});startedAt=ports.now();
    add('target',startedAt,{...fixture.provider,roomId:fixture.identity.roomId,actors:fixture.actors,syntheticOnly:true});
    await sample('before');const original=await connect(0);await connect(1);
    const deadline=startedAt+plan.durationMs;
    while(ports.now()<deadline) {
      if(failure)throw failure;
      for(let i=0;i<2;i++) if(current[i].closed && !stopping) {
        const previous=current[i];const c=await connect(i);if(previous===original && previous.restarted && c.processId!==original.processId)reconnectSeen=true;
      }
      if(!original.closed && current[1].processId===original.processId && ports.now()-lastProbe>=5000) {
        lastProbe=ports.now();const previous=current[1];await connect(1);await previous.socket.close();
      }
      for(let i=0;i<2;i++)await command(i,false);
      if(ports.now()-lastMoney>=2000){lastMoney=ports.now();const money=await sample('during');
        if(!restartReady && money.hands>0 && fixture.actors.every((actor,i)=>latest[i]?.owners?.[i]===actor)) {
          restartReady=true;ports.progress({status:'awaiting-external-restart',runHash:f11Hash(plan.runId),remainingMs:deadline-ports.now()});
        }
      }
      if(reconnectSeen && ports.now()-startedAt>=120000)break;
      await ports.sleep(200);
    }
    f11Need(await drain(),'own_fixture_needs_settlement');
    f11Need(reconnectSeen,'restart_not_observed');
    const wrong=await ports.negative(0,`f11-missing-${plan.runId}`,'wrong-room');
    add('negative',ports.now(),{...wrong,source:'socket-capture',probe:'wrong-room',actorId:fixture.actors[0],roomId:`f11-missing-${plan.runId}`});
    await ports.revoke(1);
    const revoked=await ports.negative(1,fixture.identity.roomId,'revoked-session');
    add('negative',ports.now(),{...revoked,source:'socket-capture',probe:'revoked-session',actorId:fixture.actors[1],roomId:fixture.identity.roomId});
    ports.progress({status:'awaiting-provider-final',runHash:f11Hash(plan.runId)});
    const provider=targetEvidence(await ports.provider(plan),plan);
    const finalSocket=await connect(0), finalDeadline=ports.now()+4000;
    while(!finalSocket.frame && ports.now()<finalDeadline)await ports.sleep(50);
    f11Need(finalSocket.frame,'final_snapshot_required');
    for(const c of connections)if(c.socket)await c.socket.close();
    await sample('after');
    endedAt=ports.now();add('target',endedAt,{...provider,roomId:fixture.identity.roomId,actors:fixture.actors,syntheticOnly:true});
    for(const c of connections)if(c.processId) {
      const receipt=await ports.provenance(c,plan);
      const proof=correlateF11Log(receipt,c,plan);
      add('open',c.at,{connectionId:c.id,connectionNonce:c.nonce,actorId:c.actorId,roomId:fixture.identity.roomId,instanceProof:proof});
    }
    const manifest={...plan,roomId:fixture.identity.roomId,actors:fixture.actors,ownership:fixture.ownership,startedAt,endedAt};
    events.sort((a,b)=>a.at-b.at || (a.type==='open'?-1:b.type==='open'?1:0));
    await ports.save('manifest.json',manifest);await ports.save('capture.ndjson',events);
    const observer=createF11Observer(manifest);for(const event of events)observer.observe(event);
    const review=observer.finish();await ports.save('review.json',review);return review;
  } catch(error) {
    let obligationsCleared=false;
    if(fixture && !stopping)try {obligationsCleared=await drain();}catch{}
    const review={status:'unverifiable',acceptance:false,code:safeCode(error),runHash:f11Hash(plan.runId),
      fixtureCreated:Boolean(fixture),obligationsCleared,requiresOwnFixtureReview:true};
    await ports.save('review.json',review);
    if(events.length)await ports.save('capture.ndjson',events.sort((a,b)=>a.at-b.at));
    return review;
  } finally {
    stopping=true;
    for(const c of connections)try{await c.socket?.close();}catch{}
    await ports.close();
  }
}

export const F11_PREVIEW_HELP=`Preview-only F11 client; no deployment function. Import/help/read are inert.
  node tools/run-f11-preview.mjs --read private-plan.json
  node tools/run-f11-preview.mjs --run private-plan.json --output NEW-private-directory --provenance private-render-logs.ndjson --credentials-stdin
stdin JSON: {admin:{user,pass},databaseUrl}. No Render/Vercel credentials.
Never put credential values on command lines. Only read stdin after explicit --run.
Plan: schemaVersion=1, syntheticOnly=true, ${JSON.stringify(F11_TARGET)}, sha=<full frozen SHA>,
  runId=f11-<unique>, roomKey=<fresh UUID>, sourceLaneId=<existing registered lane>,
  gameConfig={language:en|sv,limitPreset:<existing>}, chip=<allowed chip <=100>, durationMs=120000..780000.
Source lane must already have its deterministic room-lane; no global game setting is created.
Both Vercel and Render must already serve the instrumented SHA. Root restarts Render externally.
The private provenance NDJSON file is appended by the operator; every line must end with a newline.
  Before run and after restart append a fresh (<60s) provider API receipt:
  {source:provider-api-capture,at:<epoch ms>,service:{id,branch:preview,suspended:not_suspended,serviceDetails:{url}},
   deployment:{id,serviceId,status:live,commit:{id:SHA}},vercel:{id,projectId,readyState:READY,meta:{githubCommitSha:SHA}}}.
  The second receipt must name a different live Render deployment at the SAME SHA.
  Append socket log receipts: source=render-api-capture, serviceId,
  deployment={id,serviceId,commit:{id:SHA}}, log={id,timestamp,message,
    labels:[{name:resource,value:<serviceId>},{name:instance,value:<serviceId>-...},{name:type,value:app}]}.
message must be the real shared_room_socket_identity app log matching the SAME socket header.
Retain Render API captures for independent review. Manual IDs alone are not provenance.
Outputs contain synthetic captures/ownership and acceptance:false; keep the directory private.
No account/package/media deletion, no GPU/speech/chat/payment call. New own fixtures remain for review.
On failure stop new bets, inspect the own fixture for outstanding hands; never delete evidence.
`;

export async function runF11PreviewCli(args,{read=readFile,input=process.stdin,output=console.log,portsFactory}={}) {
  if(args.length===1&&args[0]==='--help'){output(F11_PREVIEW_HELP);return 0;}
  try {
    if(args.length===2&&args[0]==='--read') {
      const text=await read(args[1],'utf8');f11Need(text.length<=16384,'plan_too_large');
      const plan=validateF11Plan(JSON.parse(text));
      output(JSON.stringify({status:'plan-valid-no-actions',acceptance:false,runHash:f11Hash(plan.runId)}));return 0;
    }
    f11Need(args.length===7&&args[0]==='--run'&&args[2]==='--output'&&args[4]==='--provenance'&&args[6]==='--credentials-stdin','explicit_run_required');
    const text=await read(args[1],'utf8');f11Need(text.length<=16384,'plan_too_large');
    const plan=validateF11Plan(JSON.parse(text));
    let bytes='';for await(const chunk of input){bytes+=chunk.toString();f11Need(bytes.length<=16384,'credentials_too_large');}
    const credentials=JSON.parse(bytes);bytes='';
    const create=portsFactory??(await import('./f11-preview-ports.mjs')).createF11LivePorts;
    const ports=await create({run:true,plan,credentials,outputDirectory:args[3],provenanceFile:args[5],progress:output});
    const review=await runF11Preview(plan,ports,{run:true});output(JSON.stringify(review));return review.status==='evidence-complete-review-required'?0:1;
  } catch(error){output(JSON.stringify({status:'unverifiable',acceptance:false,code:safeCode(error)}));return 1;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)
  process.exitCode=await runF11PreviewCli(process.argv.slice(2));
