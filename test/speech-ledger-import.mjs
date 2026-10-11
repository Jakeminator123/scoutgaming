import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { prepareLegacySpeechLedgerSnapshot } from '../ops/neon-studio/speech-ledger-snapshot.mjs';
import { applyLegacySpeechLedgerSnapshot } from '../ops/neon-studio/speech-ledger-import.mjs';
import { createSpeechJournal, speechRequestKey } from '../web/postgres-speech-journal.mjs';
import { planStudioMigrations } from '../ops/neon-studio/migrations.mjs';
import { ASTRID_VOICE_PROFILE } from '../web/public/astrid-voice-profile.mjs';
import { mediaBlobPath } from '../lab/lib/cloud-media-store.mjs';
import { createPostgresOperatorSpeechQa } from '../web/postgres-operator-speech-qa.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex'), observedAt='2026-10-04T01:00:00.000Z', stamp=Date.parse(observedAt);
const ownerHash=hash('legacy-owner'), fingerprint=hash('opaque-legacy-fingerprint'), originalRequest='legacy-original', key=speechRequestKey(ownerHash,originalRequest), sessionId='a'.repeat(32);
const target={database:'postgres',role:'studio_qa',address:'127.0.0.1',port:55432};
const installed={target,schemaPresent:true,toApply:[],applied:['001','002','003','004','005','006'].map(version=>({version,checksum:hash(version),structureChecksum:hash(`structure-${version}`)}))};
const packet=(name,value)=>{const bytes=Buffer.from(JSON.stringify(value));return {name,bytes,sha256:hash(bytes),updatedAt:observedAt};};
function prepared(scope={environment:'import-qa',workspaceId:'croupier'},extras=[]) {
  return prepareLegacySpeechLedgerSnapshot({scope,endpointId:'legacy-endpoint',observedAt,
    sources:[packet('gpu-budget-policy.json',{version:1,dailyBudgetMicroUsd:9940000,createdAt:stamp-86400000}),
      packet(`gpu-session-${sessionId}.reservation.json`,{id:sessionId,endpointId:'legacy-endpoint',workerId:`croupier-${sessionId}`,
        createdAt:Date.parse('2026-10-03T23:59:00Z'),days:['2026-10-03','2026-10-04'],reservedMicroUsd:200000}),
      packet(`${key}.request.json`,{ownerHash,fingerprint}),...extras],
    confirmation:'verified-frozen-complete-speech-ledger',drainProof:{observedAt,workers:0,busy:0,available:0},
    lockState:{fullfileProvider:'stopped',streamSession:'stopped',operatorQa:'disabled'}});
}
const proof=source=>({scope:source.snapshot.scope,sourceId:source.sourceId,checksum:source.checksum,observedAt:source.snapshot.observedAt,
  sourceHashes:source.snapshot.sourceHashes,complete:true,providersStopped:true,relayDrained:true,operatorQaRetained:true});
const args=(pool,source=prepared())=>({pool,prepared:source,expectedScope:source.snapshot.scope,expectedChecksum:source.checksum,
  expectedTarget:target,actor:'isolated-import-operator',confirmation:'verified-frozen-speech-ledger-import',freezeProof:proof(source),schemaCheck:async()=>structuredClone(installed)});
const campaignId='01a0ff15-75de-7681-847a-9f4ca7a9aa68';
function qaPackets({gate=false,campaign=true,attempts=2,at=stamp}={}) {
  const value={id:campaignId,createdAt:at-600000,expiresAt:at+600000};
  return [...(campaign?[packet(`operator-qa-${campaignId}.campaign.json`,value)]:[]),
    ...(gate?[packet('operator-qa.json',value)]:[]),
    ...Array.from({length:attempts},(_,i)=>packet(`operator-qa-${campaignId}.attempt-${i+1}.json`,{campaignId,attempt:i+1,turn:i%2+1,reservedAt:at-500000+i}))];
}

function memoryPool() {
  let state={fullfilePolicies:[],fullfileReservations:[],leases:[],policy:[],requests:[],sessions:[],reservations:[],operatorCampaigns:[],operatorAttempts:[],operatorGates:[],markers:[],history:['preserved-preexisting-document-history']},tail=Promise.resolve(),failure=null;
  const trace=[],counts={connects:0,releases:0};
  const rows=value=>({rows:structuredClone(value??[])});
  return {
    async connect() {counts.connects++;let snapshot=null,unlock=null;
      return {async query(sql,p=[]) {
        const tag=/\/\* speech-import:([^*]+) \*\//.exec(sql)?.[1]??sql;trace.push(tag);
        if(failure?.tag===tag&&!failure.afterCommit){failure=null;throw Error('PRIVATE DSN postgresql://secret@host');}
        if(sql.startsWith('BEGIN')||sql.startsWith('SET LOCAL'))return rows();
        if(tag==='migration_lock'){const previous=tail;tail=new Promise(resolve=>{unlock=resolve;});await previous;snapshot=structuredClone(state);return rows();}
        if(tag==='cost_lock')return rows();
        if(tag==='target')return rows([target]);
        if(tag==='schema')return rows(installed.applied.map(row=>({version:row.version,checksum:row.checksum,structure_checksum:row.structureChecksum})));
        if(tag.startsWith('read_'))return rows(state[tag.slice(5)].filter(row=>row.environment_id===p[0]));
        if(tag==='markers')return rows(state.markers.filter(row=>row.environment_id===p[0]).map(({workspace_id,event_id,revision})=>({workspace_id,event_id,revision})));
        if(tag==='insert_lease')state.leases.push({environment_id:p[0],resource:p[1],holder_id:p[2],fence:String(p[3]),expires_at_ms:String(p[4]),recovery_only:p[5]});
        else if(tag==='insert_policy')state.policy.push({environment_id:p[0],version:p[1],daily_budget_micro_usd:String(p[2]),created_at_ms:String(p[3])});
        else if(tag==='insert_request')state.requests.push({environment_id:p[0],request_key:p[1],owner_hash:p[2],request_id:p[3],fingerprint:p[4],capability:p[5],state:p[6],lease_resource:p[7],holder_id:p[8],lease_fence:String(p[9]),package_id:p[10],package_metadata:p[11]===null?null:JSON.parse(p[11]),safe_error:p[12],created_at_ms:String(p[13]),updated_at_ms:String(p[14])});
        else if(tag==='insert_session')state.sessions.push({environment_id:p[0],session_id:p[1],endpoint_id:p[2],worker_id:p[3],holder_id:p[4],lease_fence:String(p[5]),state:p[6],job_id:p[7],created_at_ms:String(p[8]),cancel_requested_at_ms:p[9]===null?null:String(p[9]),terminal_status:p[10],terminal_reason:p[11],released_at_ms:p[12]===null?null:String(p[12])});
        else if(tag==='insert_reservation')state.reservations.push({environment_id:p[0],session_id:p[1],day:p[2],reserved_micro_usd:String(p[3])});
        else if(tag==='insert_operator_campaign')state.operatorCampaigns.push({environment_id:p[0],workspace_id:p[1],campaign_id:p[2],created_at_ms:String(p[3]),expires_at_ms:String(p[4]),source_sha256:p[5]});
        else if(tag==='insert_operator_attempt')state.operatorAttempts.push({environment_id:p[0],workspace_id:p[1],campaign_id:p[2],attempt:p[3],turn:p[4],reserved_at_ms:String(p[5]),actor:p[6],source_sha256:p[7]});
        else if(tag==='insert_operator_gate')state.operatorGates.push({environment_id:p[0],workspace_id:p[1],campaign_id:p[2],created_at_ms:String(p[3]),expires_at_ms:String(p[4]),source_sha256:p[5]});
        else if(tag==='record')state.markers.push({environment_id:p[0],workspace_id:p[1],event_id:p[2],revision:p[3],actor:p[4]});
        else if(sql==='COMMIT'){snapshot=null;unlock?.();unlock=null;if(failure?.tag==='COMMIT'){failure=null;throw Error('PRIVATE lost commit acknowledgement');}return {command:'COMMIT',rows:[]};}
        else if(sql==='ROLLBACK'){if(snapshot)state=snapshot;snapshot=null;unlock?.();unlock=null;return rows();}
        else throw Error(`unsupported fixture SQL:${tag}`);
        return rows();
      },release(){assert.equal(snapshot,null);assert.equal(unlock,null);counts.releases++;}};
    },get state(){return state;},trace,counts,failNext:(tag,afterCommit=false)=>{failure={tag,afterCommit};},
  };
}

test('explicit import preserves saved budget, opaque spent key, uncertain submit, both UTC days and unrelated history',async()=>{
  const pool=memoryPool(),input=args(pool),result=await applyLegacySpeechLedgerSnapshot(input);
  assert.equal(result.replayed,false);assert.deepEqual(result.imported,{requests:1,sessions:1,reservations:2});
  assert.equal(pool.state.policy[0].daily_budget_micro_usd,'9940000');assert.equal(pool.state.requests[0].request_key,key);
  assert.equal(pool.state.requests[0].request_id,`legacy-key:${key}`);assert.equal(pool.state.requests[0].state,'submission_uncertain');
  assert.equal(pool.state.sessions[0].job_id,null);assert.equal(pool.state.sessions[0].state,'submission_uncertain');
  assert.deepEqual(pool.state.reservations.map(row=>[row.day,row.reserved_micro_usd]),[['2026-10-03','200000'],['2026-10-04','200000']]);
  assert.deepEqual(pool.state.history,['preserved-preexisting-document-history']);assert.equal(pool.state.markers.length,1);
  const replay=await applyLegacySpeechLedgerSnapshot(input);assert.equal(replay.replayed,true);assert.equal(pool.state.markers.length,1);
  assert.equal(pool.counts.connects,pool.counts.releases);
});

test('simultaneous explicit imports serialize and replay exactly without duplicate reservations',async()=>{
  const pool=memoryPool(),input=args(pool),results=await Promise.all([applyLegacySpeechLedgerSnapshot(input),applyLegacySpeechLedgerSnapshot(input)]);
  assert.deepEqual(results.map(row=>row.replayed).sort(),[false,true]);assert.equal(pool.state.reservations.length,2);assert.equal(pool.state.markers.length,1);
});

test('legacy import never invents fullfile policy or merges later fullfile costs on replay',async()=>{
  for(const kind of ['fullfilePolicies','fullfileReservations']){
    const pool=memoryPool();await applyLegacySpeechLedgerSnapshot(args(pool));
    assert.deepEqual(pool.state[kind],[]);
    pool.state[kind].push({environment_id:'import-qa'});
    const before=structuredClone(pool.state);
    await assert.rejects(applyLegacySpeechLedgerSnapshot(args(pool)),{code:'studio_speech_import_target_conflict'});
    assert.deepEqual(pool.state,before);
  }
});

test('scope/checksum/frozen proof/schema confirmation mismatches stop before write transaction',async()=>{
  for(const patch of [{confirmation:'automatic'},{expectedChecksum:'0'.repeat(64)},{expectedScope:{environment:'other',workspaceId:'croupier'}},
    {freezeProof:{...proof(prepared()),complete:false}},{freezeProof:{...proof(prepared()),relayDrained:false}},
    {expectedTarget:{...target,role:'wrong'}},{schemaCheck:async()=>({...installed,toApply:[{version:'002'}],applied:installed.applied.slice(0,1)})}]){
    const pool=memoryPool();await assert.rejects(applyLegacySpeechLedgerSnapshot({...args(pool),...patch}));assert.equal(pool.trace.length,0);
  }
});

test('preexisting budget, spent cost, any lease/QA history, another workspace/snapshot or post-import consumption cannot be merged/reset',async()=>{
  for(const kind of ['policy','leases','sessions','reservations','requests','operatorCampaigns','operatorAttempts','operatorGates']){
    const pool=memoryPool();const env=args(pool).expectedScope.environment;
    const template=memoryPool();await applyLegacySpeechLedgerSnapshot(args(template,prepared(undefined,qaPackets({gate:true}))));pool.state[kind].push({...template.state[kind][0],environment_id:env});
    const before=structuredClone(pool.state);await assert.rejects(applyLegacySpeechLedgerSnapshot(args(pool)),{code:'studio_speech_import_target_not_empty'});assert.deepEqual(pool.state,before);
  }
  const pool=memoryPool(),input=args(pool);await applyLegacySpeechLedgerSnapshot(input);
  pool.state.leases[0].expires_at_ms=String(stamp+1000);const before=structuredClone(pool.state);
  await assert.rejects(applyLegacySpeechLedgerSnapshot(input),{code:'studio_speech_import_target_conflict'});assert.deepEqual(pool.state,before);
  pool.state.leases[0].expires_at_ms='0';pool.state.markers[0].workspace_id='another-workspace';
  await assert.rejects(applyLegacySpeechLedgerSnapshot(input),{code:'studio_speech_import_target_conflict'});
});

test('every failed insert/audit rolls back complete import; lost commit replays only on later explicit invocation',async()=>{
  for(const tag of ['insert_lease','insert_policy','insert_request','insert_session','insert_reservation','insert_operator_campaign','insert_operator_attempt','insert_operator_gate','record']){
    const pool=memoryPool(),before=structuredClone(pool.state);pool.failNext(tag);await assert.rejects(applyLegacySpeechLedgerSnapshot(args(pool,prepared(undefined,qaPackets({gate:true})))),{code:'studio_storage_unavailable'});assert.deepEqual(pool.state,before);assert.equal(pool.counts.connects,pool.counts.releases);
  }
  const pool=memoryPool(),input=args(pool);pool.failNext('COMMIT',true);
  await assert.rejects(applyLegacySpeechLedgerSnapshot(input),{code:'studio_storage_unavailable'});assert.equal(pool.state.markers.length,1);
  assert.equal((await applyLegacySpeechLedgerSnapshot(input)).replayed,true);assert.equal(pool.state.reservations.length,2);
});

test('retained operator histories persist original timestamps/raw hashes with no actor or fresh gate; exact active gate can derive campaign',async()=>{
  for(const options of [{gate:false},{gate:true},{gate:true,campaign:false,attempts:0}]) {
    const sources=qaPackets(options),source=prepared(undefined,sources),pool=memoryPool(),input=args(pool,source);
    await applyLegacySpeechLedgerSnapshot(input);assert.equal(pool.state.operatorCampaigns.length,1);assert.equal(pool.state.operatorAttempts.length,options.attempts??2);
    assert.equal(pool.state.operatorGates.length,options.gate?1:0);assert.equal(pool.state.operatorCampaigns[0].created_at_ms,String(stamp-600000));
    for(const row of pool.state.operatorAttempts){assert.equal(row.actor,null);assert.equal(row.source_sha256,sources.find(s=>s.name.endsWith(`.attempt-${row.attempt}.json`)).sha256);}
    assert.equal(pool.state.leases.find(row=>row.resource==='operator-qa').expires_at_ms,'0');
    assert.equal((await applyLegacySpeechLedgerSnapshot(input)).replayed,true);assert.equal(pool.state.operatorAttempts.length,options.attempts??2);
    if(pool.state.operatorAttempts.length)pool.state.operatorAttempts[0].reserved_at_ms=String(stamp-300000);
    else pool.state.operatorGates[0].expires_at_ms=String(stamp+700000);
    await assert.rejects(applyLegacySpeechLedgerSnapshot(input),{code:'studio_speech_import_target_conflict'});
  }
});

test('operator QA missing campaign, stale gate mismatch, retained attempt holes and overlong campaign fail closed before SQL',async()=>{
  const mismatched=qaPackets({gate:true});const gate=mismatched.find(row=>row.name==='operator-qa.json');
  mismatched[mismatched.indexOf(gate)]=packet('operator-qa.json',{id:campaignId,createdAt:stamp-500000,expiresAt:stamp+600000});
  for(const sources of [qaPackets({campaign:false}),qaPackets().filter(row=>!row.name.endsWith('.attempt-1.json')),mismatched,
    [packet(`operator-qa-${campaignId}.campaign.json`,{id:campaignId,createdAt:stamp-1800001,expiresAt:stamp})]]){
    const pool=memoryPool();await assert.rejects(async()=>applyLegacySpeechLedgerSnapshot(args(pool,prepared(undefined,sources))));assert.equal(pool.trace.length,0);
  }
});

function completedFixture(scope,extras=[]) {
  const artifactId='b'.repeat(32),requestId='completed-legacy-request',text='Exact historical synthetic reply.';
  const audio=Buffer.from(`exact historical audio:${text}`),video=Buffer.from(`exact historical video:${text}`),audioHash=hash(audio),videoHash=hash(video);
  const speechPackage={schemaVersion:2,packageId:`generated-${artifactId}`,revision:`generated-${hash(text+audioHash+videoHash)}`,dealerId:'astrid',exactText:text,
    source:{kind:'generatedText',voiceId:ASTRID_VOICE_PROFILE.voiceId},audio:{url:`/api/generated-speech/${artifactId}/audio`,sha256:audioHash,durationMs:2000},
    video:{videoId:`generated-${artifactId}.video`,url:`/api/generated-speech/${artifactId}/video`,sha256:videoHash,fps:24,frameCount:48,presentation:'lipsync'},
    audioDelayMs:0,entryPose:'standard-idle',exitPose:'standard-idle',calibrationRevision:'unreviewed-fixed-24fps',reviewStatus:'pending',
    generation:{requestId,provider:ASTRID_VOICE_PROFILE.provider,modelId:ASTRID_VOICE_PROFILE.modelId,avatarId:'astrid_spel2x',profileRevision:ASTRID_VOICE_PROFILE.profileRevision,textSha256:hash(text),audioSha256:audioHash}};
  const requestKey=speechRequestKey(ownerHash,requestId),fingerprint=hash(JSON.stringify({ownerHash,text,dealerId:'astrid',voiceId:ASTRID_VOICE_PROFILE.voiceId,modelId:ASTRID_VOICE_PROFILE.modelId,profile:ASTRID_VOICE_PROFILE.profileRevision}));
  const source=prepared(scope,[packet(`${requestKey}.request.json`,{ownerHash,fingerprint}),packet(`${requestKey}.done.json`,{id:artifactId}),packet(`${artifactId}/metadata.json`,{ownerHash,speechPackage}),...extras]);
  const uuid=`${artifactId.slice(0,8)}-${artifactId.slice(8,12)}-${artifactId.slice(12,16)}-${artifactId.slice(16,20)}-${artifactId.slice(20)}`;
  const ref=(kind,bytes,ext,mime)=>({provider:'vercel-blob',pathname:mediaBlobPath(`dealers/astrid/runtime/generated/${ownerHash}`,uuid,hash(bytes),ext),sha256:hash(bytes),size:bytes.length,contentType:mime});
  const metadata={speechPackage,artifacts:{schemaVersion:1,artifactId,ownerHash,audio:ref('audio',audio,'wav','audio/wav'),video:ref('video',video,'mp4','video/mp4')}};
  const verifyCompletedPackage=async value=>{assert.equal(value.ownerHash,ownerHash);assert.equal(value.metadata.artifacts.audio.sha256,hash(audio));assert.equal(value.metadata.artifacts.video.sha256,hash(video));
    return {verified:true,artifactId,ownerHash,textSha256:hash(text),audioSha256:hash(audio),audioSize:audio.length,videoSha256:hash(video),videoSize:video.length};};
  return {source,metadata,requestKey,verifyCompletedPackage};
}

test('completed legacy packages block atomically until exact private references and actual byte-verification callback match',async()=>{
  const f=completedFixture(),pool=memoryPool(),base=args(pool,f.source),completedPackages=[{requestKey:f.requestKey,metadata:f.metadata}];
  for(const patch of [{},{completedPackages},{completedPackages,verifyCompletedPackage:async()=>({verified:false})},
    {completedPackages:[{requestKey:f.requestKey,metadata:{...f.metadata,artifacts:{...f.metadata.artifacts,ownerHash:'f'.repeat(64)}}}],verifyCompletedPackage:f.verifyCompletedPackage}]){
    await assert.rejects(applyLegacySpeechLedgerSnapshot({...base,...patch}));assert.equal(pool.trace.length,0);
  }
  const result=await applyLegacySpeechLedgerSnapshot({...base,completedPackages,verifyCompletedPackage:f.verifyCompletedPackage});assert.equal(result.imported.requests,2);
  const saved=pool.state.requests.find(row=>row.request_key===f.requestKey);assert.deepEqual(saved.package_metadata,f.metadata);assert.equal(saved.state,'completed');
  assert.equal((await applyLegacySpeechLedgerSnapshot({...base,completedPackages,verifyCompletedPackage:f.verifyCompletedPackage})).replayed,true);
});

test('import contains only inserted cost rows and one scoped receipt, no schema/game/identity reset or provider client',async()=>{
  const code=await readFile(new URL('../ops/neon-studio/speech-ledger-import.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(code,/\b(?:DELETE\s+FROM|UPDATE\s+croupier|ALTER\s+TABLE|DROP\s+|TRUNCATE\s+|CREATE\s+TABLE)\b/i);
  assert.doesNotMatch(code,/croupier_game\.|croupier_auth\.|fetch\(|process\.env|api\.runpod|cartesia\.ai/);
});

// Parent's isolated runner can invoke this after installing exact 001/002/003/004/005.
// The target guard runs before any mutation; no environment or live URL lookup.
export async function runSpeechLedgerImportSqlChecks({pool,restart}={}) {
  const actual=(await pool.query("SELECT host(inet_server_addr()) AS address,current_user AS role,current_database() AS database,current_setting('listen_addresses') AS listeners")).rows[0];
  assert.deepEqual(actual,{address:'127.0.0.1',role:'studio_qa',database:'postgres',listeners:'127.0.0.1'});
  const plan=await planStudioMigrations({pool}),scope={environment:`journal_import_qa_${randomBytes(5).toString('hex')}`,workspaceId:'croupier'};
  const retained=qaPackets(),f=completedFixture(scope,retained);let input={...args(pool,f.source),schemaCheck:planStudioMigrations,expectedTarget:plan.target,
    completedPackages:[{requestKey:f.requestKey,metadata:f.metadata}],verifyCompletedPackage:f.verifyCompletedPackage};
  const concurrent=await Promise.all([applyLegacySpeechLedgerSnapshot(input),applyLegacySpeechLedgerSnapshot(input)]);
  assert.deepEqual(concurrent.map(row=>row.replayed).sort(),[false,true]);
  assert.equal((await applyLegacySpeechLedgerSnapshot(input)).replayed,true);
  const importedQa=(await pool.query('SELECT attempt,actor,source_sha256 FROM croupier_studio.operator_qa_attempts WHERE environment_id=$1 ORDER BY attempt',[scope.environment])).rows;
  assert.deepEqual(importedQa,retained.filter(row=>row.name.includes('.attempt-')).map((row,i)=>({attempt:i+1,actor:null,source_sha256:row.sha256})));
  assert.deepEqual(await createPostgresOperatorSpeechQa({pool,scope}).state(),{gate:null,attempts:0});
  assert.equal((await pool.query('SELECT count(*)::int n FROM croupier_studio.operator_qa_gate WHERE environment_id=$1',[scope.environment])).rows[0].n,0);
  if(restart){pool=await restart();input={...input,pool};assert.equal((await applyLegacySpeechLedgerSnapshot(input)).replayed,true);}
  const journal=await createSpeechJournal({pool,environmentId:scope.environment});
  assert.equal((await journal.getBudgetPolicy({currentBudgetMicroUsd:10000000})).dailyBudgetMicroUsd,9940000);
  const old=await journal.findRequest({ownerHash,requestId:originalRequest,fingerprint,capability:'fullfile'});assert.equal(old.state,'submission_uncertain');assert.equal(old.key,key);
  assert.equal((await journal.claimRequest({ownerHash,requestId:originalRequest,fingerprint,capability:'fullfile'})).status,'alreadyAttempted');
  await assert.rejects(journal.acquireLease({resource:'fullfile-provider',holderId:'new-owner'}),{code:'generated_speech_recovery_required'});
  const saved=await journal.getCompletedPackageById({ownerHash,packageId:f.metadata.speechPackage.packageId});assert.deepEqual(saved.packageMetadata,f.metadata);
  assert.equal((await pool.query('SELECT sum(reserved_micro_usd)::text spent FROM croupier_studio.gpu_reservations WHERE environment_id=$1',[scope.environment])).rows[0].spent,'400000');
  const receipt=(await pool.query("SELECT count(*)::int n FROM croupier_studio.audit_events WHERE environment_id=$1 AND subject='speech-ledger'",[scope.environment])).rows[0].n;assert.equal(receipt,1);
  await pool.query('UPDATE croupier_studio.speech_execution_leases SET expires_at_ms=$1 WHERE environment_id=$2 AND resource=$3',[Date.now()+10000,scope.environment,'stream-session']);
  await assert.rejects(applyLegacySpeechLedgerSnapshot(input),{code:'studio_speech_import_target_conflict'});

  const activeScope={...scope,environment:`${scope.environment}_active`},activeSource=prepared(activeScope,qaPackets({gate:true}));
  const activeInput={...args(pool,activeSource),schemaCheck:planStudioMigrations,expectedTarget:plan.target};
  await applyLegacySpeechLedgerSnapshot(activeInput);
  // A fixed synthetic campaign clock exercises the actual adapter/SQL without
  // relying on wall-clock movement or creating a live operator campaign.
  const operator=createPostgresOperatorSpeechQa({pool,scope:activeScope,now:()=>stamp}),state=await operator.state();
  assert.equal(state.attempts,2);assert.equal(state.gate.id,campaignId);
  await assert.rejects(operator.reserve({gate:state.gate,turn:1,authorize:async()=>null}),{code:'operator_speech_qa_auth_required'});
  assert.equal((await operator.state()).attempts,2);
  const reserved=await operator.reserve({gate:state.gate,turn:2,authorize:async()=>({actor:'actual-synthetic-admin'})});
  assert.equal(reserved.attempt,3);assert.equal(await reserved.check(),true);await reserved.release();
  assert.equal((await operator.state()).attempts,3);
  await assert.rejects(operator.reserve({gate:state.gate,turn:1,authorize:async()=>({actor:'actual-synthetic-admin'})}),{code:'operator_speech_qa_attempt_limit'});
  const newAttempt=(await pool.query('SELECT actor,source_sha256 FROM croupier_studio.operator_qa_attempts WHERE environment_id=$1 AND attempt=3',[activeScope.environment])).rows[0];
  assert.deepEqual(newAttempt,{actor:'actual-synthetic-admin',source_sha256:null});
  await assert.rejects(applyLegacySpeechLedgerSnapshot(activeInput),{code:'studio_speech_import_target_conflict'});

  const rollbackScope={...scope,environment:`${scope.environment}_rollback`},rollbackSource=prepared(rollbackScope,qaPackets({gate:true}));
  const rollbackInput={...args(pool,rollbackSource),schemaCheck:planStudioMigrations,expectedTarget:plan.target};
  const injectedFailurePool={async connect(){const client=await pool.connect();return {release:()=>client.release(),query:async(sql,values)=>{
    if(sql.startsWith('/* speech-import:record */'))throw Error('synthetic-final-receipt-failure');return client.query(sql,values);
  }};}};
  await assert.rejects(applyLegacySpeechLedgerSnapshot({...rollbackInput,pool:injectedFailurePool,schemaCheck:async()=>planStudioMigrations({pool})}),{code:'studio_storage_unavailable'});
  for(const table of ['speech_execution_leases','gpu_budget_policies','speech_requests','gpu_sessions','gpu_reservations','operator_qa_campaigns','operator_qa_attempts','operator_qa_gate','audit_events']){
    assert.equal((await pool.query(`SELECT count(*)::int n FROM croupier_studio.${table} WHERE environment_id=$1`,[rollbackScope.environment])).rows[0].n,0,`${table}: atomic rollback`);
  }
  assert.equal((await applyLegacySpeechLedgerSnapshot(rollbackInput)).replayed,false);
  assert.equal((await applyLegacySpeechLedgerSnapshot(rollbackInput)).replayed,true);
  return {pool,checks:['explicit frozen SQL import preserves budget/two-day charges/opaque request replay fences/completed private refs',
    'concurrent import and exact restart replay append no duplicate cost/audit',
    'retained operator QA timestamps/raw hashes survive restart; missing active gate stays disabled',
    'actual operator adapter appends only remaining third attempt with current actor and never resets campaign',
    'final SQL receipt failure atomically rolls back cost and all operator rows; explicit later apply/replay succeeds',
    'post-import lease/consumption rejects import merge/reset']};
}
