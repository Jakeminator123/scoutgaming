// Runs only inside the named isolated QA service. No package installation,
// provider dispatch, account creation, reset, refund or production cutover.
import {readFile,lstat,mkdir,open,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {AI_QA_ORIGINAL,AI_QA_LIMITS,AI_QA_CONTINUATION_COUNTS,AI_QA_SIX_LIMITS,AI_QA_SIX_AUTHORIZATION,aiQaWindowClosed,aiQaNextWindowCounts,sha256,aiQaNeed as need,createAiQaBudget} from '../web/native-ai-qa-budget.mjs';
import {buildAiQaPrivateSnapshot} from '../web/native-ai-qa-private.mjs';
import {AI_QA_SOURCE_PATHS} from '../web/native-ai-qa-runtime.mjs';
import {NATIVE_P6_QA} from '../ops/cloud/config.mjs';
const repo=resolve(fileURLToPath(new URL('..',import.meta.url)));
const sdkRoot=NATIVE_P6_QA.dataRoot+'/p6-sdk/cb9b6b53-e7b0-4fa9-bc53-c5152ddbb1f2/node_modules/openai';
const privateDependencies=['native-cloud-browser-qa.mjs','native-p6-sdk-worker.mjs','native-p6-sdk-admission.mjs',
  'native-p6-upstream-bounds-final.json'];
const additionalPolicyJobs=new WeakMap();
async function small(path){const s=await lstat(path);need(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.size<=1048576,'ai_qa_install_source_file');return readFile(path);}
async function newFile(path,value){const f=await open(path,'wx',0o600);try{await f.writeFile(JSON.stringify(value));await f.sync();}finally{await f.close();}}
export async function buildAiQaManifest({expectedSha,deploymentId,runId,ownLinkedPlayerSha256,now=Date.now()}={}){
  need(/^[a-f0-9]{40}$/.test(expectedSha??'')&&/^dep-[a-z0-9]+$/.test(deploymentId??'')
    &&/^[a-f0-9-]{36}$/.test(runId??'')&&/^[a-f0-9]{64}$/.test(ownLinkedPlayerSha256??''),'ai_qa_install_inputs');
  const sources=Object.fromEntries(await Promise.all(AI_QA_SOURCE_PATHS.map(async p=>[p,sha256(await small(join(repo,p)))])));
  const privateSources=Object.fromEntries(await Promise.all(privateDependencies.map(async p=>[p,sha256(await small(join(repo,'lab/data/platform-private',p)))])));
  const worker=await import(pathToFileURL(join(repo,'lab/data/platform-private/native-p6-sdk-worker.mjs')).href);
  const workerSourceContext=await worker.readNativeP6SdkWorkerSourceContext();
  const sdk=await worker.readNativeP6SdkWorkerStagedSdk({runId:'cb9b6b53-e7b0-4fa9-bc53-c5152ddbb1f2'});
  need(sdk.sdk.treeSha256==='ebbb70cbf3b784adcee13323880215dc360ac0e1c5d78891f9813368e6c3da0a'&&sdk.sdk.files===2962,'ai_qa_original_sdk_tree_changed');
  const pkg=await small(sdkRoot+'/package.json');need(JSON.parse(pkg).version==='7.12.1','ai_qa_installed_sdk_version');
  const snapshot=await buildAiQaPrivateSnapshot({directory:join(repo,'lab/data/platform-private'),pins:privateSources});
  return{privateSnapshotSha256:sha256(snapshot),purpose:'bounded-native-ai-qa-activation-v1',runId,campaignId:AI_QA_ORIGINAL.campaignId,expectedSha,deploymentId,
    ownLinkedPlayerSha256,workerSourceContext,createdAtMs:now,expiresAtMs:now+AI_QA_LIMITS.lifetimeMs,limits:AI_QA_LIMITS,sources,privateSources,
    privateWorkerSha256:privateSources['native-p6-sdk-worker.mjs'],sdkVersion:'7.12.1',sdkRoot,sdkPackageSha256:sha256(pkg),
    sdkClientSha256:sha256(await small(sdkRoot+'/client.js')),sdkTreeSha256:sdk.sdk.treeSha256,sdkFiles:sdk.sdk.files,originalAnchorSha256:AI_QA_ORIGINAL.anchorSha256,
    actualCostUsd:null,tariffException:'direct-human-bounded-functional-test-account-prices-backlog'};
}
export async function installAiQaPolicy({pool,manifest,manifestRawSha256,operatorId,username,playerId,now=Date.now}={}){
  const c=await pool.connect();let began=false;
  try{
    await c.query('BEGIN ISOLATION LEVEL SERIALIZABLE');began=true;
    await c.query("SET LOCAL statement_timeout='5000ms'; SET LOCAL lock_timeout='3000ms'; SET LOCAL idle_in_transaction_session_timeout='10000ms'");
    const physical=(await c.query('SELECT current_database() AS database,current_user AS role')).rows[0];
    need(physical.database===NATIVE_P6_QA.database&&physical.role===NATIVE_P6_QA.database,'ai_qa_install_physical_database');
    await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['croupier:speech:'+NATIVE_P6_QA.environmentId]);
    const operator=(await c.query('SELECT id::text AS id,username,role FROM croupier_auth.users WHERE id::text=$1 FOR UPDATE',[operatorId])).rows[0];
    need(operator?.id===operatorId&&operator.username===username&&['admin','superadmin'].includes(operator.role),'ai_qa_existing_operator_required');
    const player=(await c.query('SELECT p.id FROM croupier_game.players p JOIN croupier_game.craig_player_links l ON l.player_id=p.id WHERE p.id=$1 AND l.craig_user_id=$2',[playerId,operatorId])).rows[0];
    need(player?.id===playerId&&sha256(playerId)===manifest.ownLinkedPlayerSha256,'ai_qa_existing_linked_player_required');
    const counts=(await c.query(`SELECT
      (SELECT count(*) FROM croupier_studio.gpu_budget_policies WHERE environment_id=$1)::int AS gpu_policy,
      (SELECT count(*) FROM croupier_studio.fullfile_budget_policies WHERE environment_id=$1)::int AS file_policy,
      (SELECT count(*) FROM croupier_studio.operator_qa_campaigns WHERE environment_id=$1)::int AS campaigns,
      (SELECT count(*) FROM croupier_studio.operator_qa_gate WHERE environment_id=$1)::int AS gates,
      (SELECT count(*) FROM croupier_studio.operator_qa_attempts WHERE environment_id=$1)::int AS attempts,
      (SELECT count(*) FROM croupier_studio.speech_requests WHERE environment_id=$1)::int AS requests,
      (SELECT count(*) FROM croupier_studio.gpu_sessions WHERE environment_id=$1)::int AS sessions,
      (SELECT count(*) FROM croupier_studio.gpu_reservations WHERE environment_id=$1)::int AS gpu_reservations,
      (SELECT count(*) FROM croupier_studio.fullfile_reservations WHERE environment_id=$1)::int AS fullfile_reservations,
      (SELECT count(*) FROM croupier_studio.speech_execution_leases WHERE environment_id=$1 AND (recovery_only OR expires_at_ms>$2))::int AS active_leases`,
      [NATIVE_P6_QA.environmentId,now()])).rows[0];
    need(counts&&Object.values(counts).every(n=>Number(n)===0),'ai_qa_install_nonempty_policy_or_jobs');
    const clock=Number((await c.query('SELECT (extract(epoch FROM clock_timestamp())*1000)::bigint AS now_ms')).rows[0].now_ms);
    need(Math.abs(clock-now())<30000&&manifest.expiresAtMs>clock,'ai_qa_install_clock_or_expired');
    const env=NATIVE_P6_QA.environmentId,workspace=NATIVE_P6_QA.workspaceId;
    // These are suballocations of the held original budget, never tariff quotes.
    await c.query('INSERT INTO croupier_studio.gpu_budget_policies(environment_id,version,daily_budget_micro_usd,created_at_ms) VALUES($1,1,$2,$3)',[env,4748848,clock]);
    await c.query('INSERT INTO croupier_studio.fullfile_budget_policies(environment_id,version,reserve_micro_usd,reservation_window_ms,created_at_ms) VALUES($1,1,$2,$3,$4)',[env,1000000,720000,clock]);
    for(const table of ['operator_qa_campaigns','operator_qa_gate'])await c.query(`INSERT INTO croupier_studio.${table}(environment_id,workspace_id,campaign_id,created_at_ms,expires_at_ms,source_sha256) VALUES($1,$2,$3,$4,$5,$6)`,
      [env,workspace,AI_QA_ORIGINAL.campaignId,manifest.createdAtMs,manifest.expiresAtMs,manifestRawSha256]);
    await c.query("INSERT INTO croupier_studio.speech_execution_leases(environment_id,resource,holder_id,fence,expires_at_ms,recovery_only) VALUES($1,'operator-qa',$2,1,0,false)",[env,'bounded-ai-qa-'+manifest.runId]);
    need((await c.query('COMMIT')).command==='COMMIT','ai_qa_install_commit_uncertain');began=false;
    return{policyCreated:1,fullfilePolicyCreated:1,originalCampaignId:AI_QA_ORIGINAL.campaignId,attemptsCreated:0,
      identityMutations:0,accountMutations:0,journalReset:false,before:counts,actualCostUsd:null};
  }finally{if(began)await c.query('ROLLBACK').catch(()=>{});c.release();}
}
export async function installBoundedAiQa(input){
  need(process.platform==='linux'&&process.getuid?.()===1000&&process.getgid?.()===1000&&repo==='/app'
    &&process.env.RENDER_SERVICE_ID===NATIVE_P6_QA.serviceId&&process.env.RENDER_GIT_COMMIT===input.expectedSha
    &&process.env.CROUPIER_CLOUD_DATA_ROOT===NATIVE_P6_QA.dataRoot
    &&process.env.CROUPIER_STUDIO_ENVIRONMENT_ID===NATIVE_P6_QA.environmentId
    &&process.env.CROUPIER_STUDIO_WORKSPACE_ID===NATIVE_P6_QA.workspaceId,'ai_qa_install_exact_physical_service');
  const db=new URL(process.env.CROUPIER_GAME_DATABASE_URL);
  need(db.hostname.endsWith('.neon.tech')&&db.username===NATIVE_P6_QA.database&&db.pathname==='/'+NATIVE_P6_QA.database
    &&db.searchParams.get('sslmode')==='require','ai_qa_install_database_binding');
  const manifest=await buildAiQaManifest({...input,ownLinkedPlayerSha256:sha256(input.playerId)}),raw=JSON.stringify(manifest),pin=sha256(raw);
  const stateRoot=NATIVE_P6_QA.dataRoot+'/p6-sdk/'+manifest.runId;
  await mkdir(stateRoot,{mode:0o700});
  const snapshot=await buildAiQaPrivateSnapshot({directory:join(repo,'lab/data/platform-private'),pins:manifest.privateSources});
  need(sha256(snapshot)===manifest.privateSnapshotSha256,'ai_qa_install_private_snapshot_changed');
  const snapshotFile=await open(stateRoot+'/bounded-private-snapshot.json','wx',0o600);
  try{await snapshotFile.writeFile(snapshot);await snapshotFile.sync();}finally{await snapshotFile.close();}
  await newFile(stateRoot+'/bounded-manifest.json',manifest);
  for(const name of ['worker','router','entry','authority'])await newFile(stateRoot+'/'+name+'-context.json',{
    purpose:'bounded-native-ai-qa-'+name+'-context-v1',expectedSha:manifest.expectedSha,manifestRawSha256:pin,
    sources:manifest.sources,privateSources:manifest.privateSources,sdkPackageSha256:manifest.sdkPackageSha256,
    sdkClientSha256:manifest.sdkClientSha256,originalAnchorSha256:manifest.originalAnchorSha256,
    campaignId:manifest.campaignId,expiresAtMs:manifest.expiresAtMs,actualCostUsd:null});
  const stagedDirectory=await open(stateRoot,'r');try{await stagedDirectory.sync();}finally{await stagedDirectory.close();}
  const budget=await createAiQaBudget({directory:NATIVE_P6_QA.dataRoot+'/p6-budget-ledger/'+AI_QA_ORIGINAL.authorizationId,
    anchorPath:NATIVE_P6_QA.dataRoot+'/native-p6-user-budget-20261003.json',manifest,manifestRawSha256:pin,
    authoritySourceSha256:manifest.sources['web/native-ai-qa-budget.mjs']});
  const before=await budget.inspect();need(before.records.length===2,'ai_qa_install_previous_campaign_consumed');
  const {Pool}=createRequire('/app/web/package.json')('pg'),pool=new Pool({connectionString:process.env.CROUPIER_GAME_DATABASE_URL,max:1,connectionTimeoutMillis:8000});
  try{
    // Append the explicit exception before installing SQL policy. A failed install
    // retains this reservation and is never silently started again.
    await budget.activate();
    const policy=await installAiQaPolicy({pool,manifest,manifestRawSha256:pin,operatorId:input.operatorId,username:input.username,playerId:input.playerId});
    const after=await budget.inspect();
    const receipt={purpose:'bounded-native-ai-qa-installed-v1',expectedSha:manifest.expectedSha,deploymentId:manifest.deploymentId,
      runId:manifest.runId,campaignId:manifest.campaignId,stateRoot,manifestRawSha256:pin,manifest,
      budgetBefore:before,budgetAfter:after,policy,providerCalls:0,installedSdkReused:true,originalJournalPreserved:true,
      fullP6Passed:false,productionCutover:false};
    await newFile(stateRoot+'/install-receipt.json',receipt);return receipt;
  }finally{await pool.end();}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  if(['--install','--continue','--additional'].includes(process.argv.slice(2).join(' '))){
    try{let raw='';for await(const c of process.stdin){raw+=c;need(raw.length<=65536,'ai_qa_install_input_size');}
      const input=JSON.parse(raw),receipt=await (process.argv[2]==="--additional"?installBoundedAiQaAdditionalWindow(input):process.argv[2]==="--continue"?installBoundedAiQaContinuation(input):installBoundedAiQa(input));console.log(JSON.stringify(receipt));
    }catch(e){console.log(JSON.stringify({purpose:'bounded-native-ai-qa-install-denied-v1',code:e.safeCode??'ai_qa_install_failed',noRawError:true}));process.exitCode=1;}
  }else console.log(JSON.stringify({purpose:'bounded-native-ai-qa-installer-contract-v1',target:NATIVE_P6_QA,
    originalCampaignId:AI_QA_ORIGINAL.campaignId,limits:AI_QA_LIMITS,requires:'Explicit physical isolated-QA --install with current release SHA and existing operator/player',providerCalls:0}));
}

// Read existing policies/jobs only. Expired operator gates remain historical;
// ordinary /chat uses cookie ownership, its execution lease and the runtime quota.
export async function readAiQaContinuationPolicy({pool,previousManifest,previousManifestRawSha256,fullfile,operatorId,username,playerId,now=Date.now}={}){
  const c=await pool.connect();let began=false;
  try{
    await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');began=true;
    await c.query("SET LOCAL statement_timeout='5000ms'; SET LOCAL idle_in_transaction_session_timeout='10000ms'");
    const physical=(await c.query('SELECT current_database() AS database,current_user AS role')).rows[0];
    need(physical.database===NATIVE_P6_QA.database&&physical.role===NATIVE_P6_QA.database,'ai_qa_continuation_physical_database');
    const operator=(await c.query('SELECT id::text AS id,username,role FROM croupier_auth.users WHERE id::text=$1',[operatorId])).rows[0];
    need(operator?.id===operatorId&&operator.username===username&&['admin','superadmin'].includes(operator.role),'ai_qa_existing_operator_required');
    const player=(await c.query('SELECT p.id FROM croupier_game.players p JOIN croupier_game.craig_player_links l ON l.player_id=p.id WHERE p.id=$1 AND l.craig_user_id=$2',[playerId,operatorId])).rows[0];
    need(player?.id===playerId&&sha256(playerId)===previousManifest.ownLinkedPlayerSha256,'ai_qa_existing_linked_player_required');
    const clock=Number((await c.query('SELECT (extract(epoch FROM clock_timestamp())*1000)::bigint AS now_ms')).rows[0].now_ms);
    need(Math.abs(clock-now())<30000&&clock>=previousManifest.expiresAtMs,'ai_qa_continuation_clock_or_old_window_active');
    const tables={};for(const table of ['gpu_budget_policies','fullfile_budget_policies','operator_qa_campaigns','operator_qa_gate','operator_qa_attempts',
      'speech_requests','gpu_sessions','gpu_reservations','fullfile_reservations','speech_execution_leases']){
      tables[table]=(await c.query('SELECT * FROM croupier_studio.'+table+' WHERE environment_id=$1 ORDER BY to_jsonb('+table+')::text LIMIT 11',[NATIVE_P6_QA.environmentId])).rows;
      need(tables[table].length<=10,'ai_qa_continuation_bounded_sql_rows');
    }
    for(const name of ['operator_qa_campaigns','operator_qa_gate']){const rows=tables[name],r=rows[0];
      need(rows.length===1&&r.campaign_id===AI_QA_ORIGINAL.campaignId&&r.workspace_id===NATIVE_P6_QA.workspaceId
        &&Number(r.created_at_ms)===previousManifest.createdAtMs&&Number(r.expires_at_ms)===previousManifest.expiresAtMs
        &&r.source_sha256===previousManifestRawSha256,'ai_qa_continuation_original_campaign_changed');}
    const gpu=tables.gpu_budget_policies[0],file=tables.fullfile_budget_policies[0];
    need(tables.gpu_budget_policies.length===1&&Number(gpu.version)===1&&Number(gpu.daily_budget_micro_usd)===AI_QA_ORIGINAL.remainingMicroUsd
      &&tables.fullfile_budget_policies.length===1&&Number(file.version)===1&&Number(file.reserve_micro_usd)===1000000
      &&Number(file.reservation_window_ms)===720000,'ai_qa_continuation_original_policy_changed');
    const requests=tables.speech_requests,request=requests[0];
    need(requests.length===1&&request.capability==='fullfile'&&request.state==='completed'&&request.request_key===fullfile.requestKey
      &&request.package_id===fullfile.packageId&&sha256(JSON.stringify(request.package_metadata))===fullfile.packageMetadataSha256,
      'ai_qa_continuation_fullfile_not_completed');
    const reservations=tables.fullfile_reservations;
    need(reservations.length===1&&reservations[0].request_key===request.request_key&&Number(reservations[0].reserved_micro_usd)===1000000,
      'ai_qa_continuation_retained_fullfile_reservation_changed');
    need(tables.operator_qa_attempts.length===0&&tables.gpu_sessions.length===0&&tables.gpu_reservations.length===0
      &&tables.speech_execution_leases.every(r=>r.recovery_only===false&&Number(r.expires_at_ms)<=clock),'ai_qa_continuation_not_drained');
    need((await c.query('COMMIT')).command==='COMMIT','ai_qa_continuation_read_commit_unavailable');began=false;
    return{purpose:'bounded-native-ai-qa-continuation-policy-read-v1',physical,observedAtMs:clock,originalCampaignId:AI_QA_ORIGINAL.campaignId,
      expiredOperatorGateRetained:true,operatorAttempts:0,activeLeases:0,sessions:0,fullfile,
      fingerprints:Object.fromEntries(Object.entries(tables).map(([name,rows])=>[name,{rows:rows.length,sha256:sha256(JSON.stringify(rows))}])),sqlMutations:0};
  }finally{if(began)await c.query('ROLLBACK').catch(()=>{});c.release();}
}

export function validateAiQaContinuationIntent({raw,approvedIntentSha256,previousManifest,previousManifestRawSha256,state,expectedSha,deploymentId,runId}={}){
  need(typeof raw==='string'&&Buffer.byteLength(raw)<=32768&&sha256(raw)===approvedIntentSha256,'ai_qa_continuation_reviewed_intent_changed');
  let i;try{i=JSON.parse(raw);}catch{need(false,'ai_qa_continuation_intent_invalid');}
  need(i.purpose==='bounded-native-ai-qa-continuation-intent-v1'&&i.campaignId===AI_QA_ORIGINAL.campaignId
    &&i.expectedSha===expectedSha&&i.deploymentId===deploymentId&&i.runId===runId
    &&i.previousManifestSha256===previousManifestRawSha256&&i.previousAuthoritySourceSha256===previousManifest.sources['web/native-ai-qa-budget.mjs']
    &&i.previousRunId===previousManifest.runId&&i.previousExpectedSha===previousManifest.expectedSha
    &&i.predecessorRecordCount===13&&state.records.length===13&&i.predecessorJournalSha256===state.previousSha256
    &&JSON.stringify(state.counts)===JSON.stringify(AI_QA_CONTINUATION_COUNTS)&&!state.closed&&!state.continuation
    &&state.dispatches.every(d=>d.outcome==='response-observed')&&state.unresolved===0,
    'ai_qa_continuation_predecessor_changed');
  need(JSON.stringify(i.limits)===JSON.stringify(AI_QA_LIMITS)&&i.actualCostUsd===null&&i.extraReserveMicroUsd===0&&i.refundMicroUsd===0
    &&typeof i.streamRequestId==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(i.streamRequestId)
    &&/^[a-f0-9]{64}$/.test(i.fullfile?.requestKey??'')&&/^generated-[a-f0-9]{32}$/.test(i.fullfile?.packageId??'')
    &&/^[a-f0-9]{64}$/.test(i.fullfile?.packageMetadataSha256??''),'ai_qa_continuation_caps_or_package_changed');
  return i;
}

export async function installBoundedAiQaContinuation(input){
  need(process.platform==='linux'&&process.getuid?.()===1000&&process.getgid?.()===1000&&repo==='/app'
    &&process.env.RENDER_SERVICE_ID===NATIVE_P6_QA.serviceId&&process.env.RENDER_GIT_COMMIT===input.expectedSha
    &&process.env.CROUPIER_CLOUD_DATA_ROOT===NATIVE_P6_QA.dataRoot
    &&process.env.CROUPIER_STUDIO_ENVIRONMENT_ID===NATIVE_P6_QA.environmentId&&process.env.CROUPIER_STUDIO_WORKSPACE_ID===NATIVE_P6_QA.workspaceId,
    'ai_qa_continuation_exact_physical_service');
  need(['CROUPIER_P6_QA_ROUTER','CROUPIER_P6_BOUNDED_TEST','CROUPIER_GENERATED_SPEECH','CROUPIER_GENERATED_SPEECH_STREAMING']
    .every(k=>process.env[k]===undefined||process.env[k]==='0'),'ai_qa_continuation_requires_off_process');
  const db=new URL(process.env.CROUPIER_GAME_DATABASE_URL);
  need(db.hostname.endsWith('.neon.tech')&&db.username===NATIVE_P6_QA.database&&db.pathname==='/'+NATIVE_P6_QA.database&&db.searchParams.get('sslmode')==='require',
    'ai_qa_continuation_database_binding');
  need(/^[a-f0-9-]{36}$/.test(input.previousRunId??''),'ai_qa_continuation_previous_run_required');
  const previousRaw=await small(NATIVE_P6_QA.dataRoot+'/p6-sdk/'+input.previousRunId+'/bounded-manifest.json'),previousManifest=JSON.parse(previousRaw),previousPin=sha256(previousRaw);
  need(previousManifest.runId===input.previousRunId&&previousManifest.campaignId===AI_QA_ORIGINAL.campaignId
    &&Date.now()>=previousManifest.expiresAtMs,'ai_qa_continuation_previous_manifest_required');
  const oldBudget=await createAiQaBudget({directory:NATIVE_P6_QA.dataRoot+'/p6-budget-ledger/'+AI_QA_ORIGINAL.authorizationId,
    anchorPath:NATIVE_P6_QA.dataRoot+'/native-p6-user-budget-20261003.json',manifest:previousManifest,manifestRawSha256:previousPin,
    authoritySourceSha256:previousManifest.sources['web/native-ai-qa-budget.mjs']});
  const before=await oldBudget.inspect(),intent=validateAiQaContinuationIntent({raw:input.intentRaw,approvedIntentSha256:input.approvedIntentSha256,
    ...input,previousManifest,previousManifestRawSha256:previousPin,state:before});
  const endpoint=intent.endpointEvidence;
  need(endpoint?.endpointId==='zsudl8tmzcmiv1'&&endpoint.workersMax===1&&endpoint.activeWorkersSetting===0&&endpoint.gpuCount===1
    &&Number.isSafeInteger(endpoint.observedAtMs)&&Date.now()-endpoint.observedAtMs>=0&&Date.now()-endpoint.observedAtMs<300000,
    'ai_qa_continuation_fresh_one_worker_evidence');
  need(typeof input.providerReadApiKey==='string'&&input.providerReadApiKey.length>0&&!/\s/.test(input.providerReadApiKey),'ai_qa_continuation_existing_provider_read_key');
  const {Pool}=createRequire('/app/web/package.json')('pg'),pool=new Pool({connectionString:process.env.CROUPIER_GAME_DATABASE_URL,max:1,connectionTimeoutMillis:8000});
  try{
    const policy=await readAiQaContinuationPolicy({pool,previousManifest,previousManifestRawSha256:previousPin,fullfile:intent.fullfile,
      operatorId:input.operatorId,username:input.username,playerId:input.playerId});
    const response=await fetch('https://api.runpod.ai/v2/zsudl8tmzcmiv1/health',{method:'GET',headers:{authorization:'Bearer '+input.providerReadApiKey},redirect:'error',signal:AbortSignal.timeout(15000)});
    need(response.ok,'ai_qa_continuation_provider_read_unavailable');const rawHealth=await response.text();need(rawHealth.length<=8192,'ai_qa_continuation_provider_read_size');const health=JSON.parse(rawHealth);
    need(health.jobs?.inQueue===0&&health.jobs?.inProgress===0&&health.workers?.running===0,'ai_qa_continuation_provider_not_drained');
    let retained=null;for(const name of(await readdir('/var/data/speech')).filter(n=>/^gpu-session-[a-f0-9]{32}\.reservation\.json$/.test(n))){const path='/var/data/speech/'+name,info=await lstat(path);
      if(info.isFile()&&!info.isSymbolicLink()&&info.size===209&&sha256(await readFile(path))==='8e8e8731e5e473fe6d0642ff8e4f313ba089336167aad54c1f9dd49daf885798')retained={sha256:sha256(await readFile(path)),size:209,mtimeMs:info.mtimeMs};}
    need(retained?.mtimeMs===1790945260179.6155,'ai_qa_continuation_original_gpu_changed');
    const manifest=await buildAiQaManifest({...input,ownLinkedPlayerSha256:sha256(input.playerId)});
    const preflight={purpose:'bounded-native-ai-qa-continuation-preflight-v1',originalRecords:before.records,counts:before.counts,policy,
      endpointEvidence:endpoint,provider:{httpStatus:response.status,jobs:health.jobs,workers:health.workers},retainedOriginalGpu:retained,
      previousManifestSha256:previousPin,installedSdkPackageSha256:manifest.sdkPackageSha256,installedSdkClientSha256:manifest.sdkClientSha256};
    const preflightSha256=sha256(JSON.stringify(preflight));
    manifest.continuation={predecessorRecordCount:13,predecessorJournalSha256:before.previousSha256,previousManifestSha256:previousPin,
      previousAuthoritySourceSha256:previousManifest.sources['web/native-ai-qa-budget.mjs'],previousRunId:previousManifest.runId,
      previousExpectedSha:previousManifest.expectedSha,rootReviewedIntentSha256:input.approvedIntentSha256,preflightSha256,
      streamRequestIdSha256:sha256(intent.streamRequestId)};
    const pin=sha256(JSON.stringify(manifest)),stateRoot=NATIVE_P6_QA.dataRoot+'/p6-sdk/'+manifest.runId;
    await mkdir(stateRoot,{mode:0o700});
    const snapshot=await buildAiQaPrivateSnapshot({directory:join(repo,'lab/data/platform-private'),pins:manifest.privateSources});
    need(sha256(snapshot)===manifest.privateSnapshotSha256,'ai_qa_continuation_snapshot_changed');
    const snapshotFile=await open(stateRoot+'/bounded-private-snapshot.json','wx',0o600);try{await snapshotFile.writeFile(snapshot);await snapshotFile.sync();}finally{await snapshotFile.close();}
    const reviewed=await open(stateRoot+'/continuation-intent.json','wx',0o600);try{await reviewed.writeFile(input.intentRaw);await reviewed.sync();}finally{await reviewed.close();}
    await newFile(stateRoot+'/continuation-preflight.json',preflight);await newFile(stateRoot+'/bounded-manifest.json',manifest);
    for(const name of ['worker','router','entry','authority'])await newFile(stateRoot+'/'+name+'-context.json',{
      purpose:'bounded-native-ai-qa-'+name+'-context-v1',expectedSha:manifest.expectedSha,manifestRawSha256:pin,sources:manifest.sources,
      privateSources:manifest.privateSources,sdkPackageSha256:manifest.sdkPackageSha256,sdkClientSha256:manifest.sdkClientSha256,
      originalAnchorSha256:manifest.originalAnchorSha256,campaignId:manifest.campaignId,expiresAtMs:manifest.expiresAtMs,
      predecessorManifestSha256:previousPin,rootReviewedIntentSha256:input.approvedIntentSha256,actualCostUsd:null});
    const d=await open(stateRoot,'r');try{await d.sync();}finally{await d.close();}
    const budget=await createAiQaBudget({directory:NATIVE_P6_QA.dataRoot+'/p6-budget-ledger/'+AI_QA_ORIGINAL.authorizationId,
      anchorPath:NATIVE_P6_QA.dataRoot+'/native-p6-user-budget-20261003.json',manifest,manifestRawSha256:pin,authoritySourceSha256:manifest.sources['web/native-ai-qa-budget.mjs']});
    const after=await budget.continueOnce({approvedIntentSha256:input.approvedIntentSha256,preflightSha256});
    const receipt={purpose:'bounded-native-ai-qa-continuation-installed-v1',expectedSha:manifest.expectedSha,deploymentId:manifest.deploymentId,
      runId:manifest.runId,campaignId:manifest.campaignId,manifestRawSha256:pin,manifest,previousManifestSha256:previousPin,
      preflightSha256,budgetBefore:before,budgetAfter:after,policy,providerJobPosts:0,providerReads:1,sqlMutations:0,
      extraReserveMicroUsd:0,refundMicroUsd:0,actualCostUsd:null,installedSdkReused:true,originalJournalPreserved:true,
      automaticActivation:false,automaticRetry:false,fullP6Passed:false};
    await newFile(stateRoot+'/continuation-install-receipt.json',receipt);return receipt;
  }finally{input.providerReadApiKey='';await pool.end();}
}

// A new human-authorized window is a successor, never a reset of the closed campaign.
export function validateAiQaAdditionalIntent(raw,pin,state){
  need(typeof raw==='string'&&Buffer.byteLength(raw)<=32768&&sha256(raw)===pin,'ai_qa_additional_review_changed');
  let i;try{i=JSON.parse(raw);}catch{need(false,'ai_qa_additional_intent_invalid');}
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),c=state.counts,w=state.activeWindow;
  need(i.purpose==='bounded-native-ai-qa-additional-intent-v1'&&i.campaignId===AI_QA_ORIGINAL.campaignId
    &&state.closed&&aiQaWindowClosed(state)&&state.unresolved===0&&state.records.length>=21
    &&state.records[20].rawSha256===AI_QA_SIX_AUTHORIZATION.firstClosedJournalSha256&&state.closedWindows?.length>=1
    &&state.dispatches.every(d=>d.outcome==='response-observed')&&c.generation>=2&&c.generation<6
    &&i.predecessorRecordCount===state.records.length&&i.predecessorJournalSha256===state.previousSha256
    &&i.previousRunId===w.runId&&i.previousManifestSha256===w.manifestSha256
    &&i.previousAuthoritySourceSha256===w.authoritySourceSha256&&i.previousExpectedSha===w.expectedSha,
    'ai_qa_additional_closed_history_changed');
  need(same(i.humanAuthorization,AI_QA_SIX_AUTHORIZATION)&&same(i.limits,AI_QA_SIX_LIMITS)
    &&same(i.previousCounts,c)&&same(i.limitCounts,aiQaNextWindowCounts(state))
    &&i.globalRemainingGenerations===6-c.generation&&i.windowGenerations===1&&i.streamOnly===true
    &&i.actualCostUsd===null&&i.extraReserveMicroUsd===0&&i.refundMicroUsd===0&&i.automaticRetry===false
    &&/^[a-f0-9]{40}$/.test(i.expectedSha??'')&&/^dep-[a-z0-9]+$/.test(i.deploymentId??'')
    &&/^[a-f0-9-]{36}$/.test(i.runId??'')&&i.runId!==w.runId&&typeof i.streamRequestId==='string'
    &&i.streamRequestId.length<=128&&/^[a-f0-9]{64}$/.test(i.reviewPreflightSha256??''),
    'ai_qa_additional_scope_changed');return i;
}
export async function readAiQaAdditionalPolicy({pool,operatorId,username,playerId,fullfile,now=Date.now}={}){
  const c=await pool.connect();let began=false;
  try{
    await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');began=true;
    const physical=(await c.query('SELECT current_database() AS database,current_user AS role')).rows[0];
    need(physical.database===NATIVE_P6_QA.database&&physical.role===NATIVE_P6_QA.database,'ai_qa_additional_physical_database');
    const actor=(await c.query('SELECT id,username,role FROM croupier_auth.users WHERE id=$1 AND username=$2',[operatorId,username])).rows[0];
    need(actor&&['admin','superadmin'].includes(actor.role),'ai_qa_additional_existing_operator');
    const player=(await c.query('SELECT p.id FROM croupier_game.players p JOIN croupier_game.craig_player_links l ON l.player_id=p.id WHERE p.id=$1 AND l.craig_user_id=$2',[playerId,operatorId])).rows[0];
    need(player?.id===playerId,'ai_qa_additional_existing_player');
    const time=Number((await c.query('SELECT (extract(epoch FROM clock_timestamp())*1000)::bigint AS now_ms')).rows[0].now_ms);
    need(Math.abs(time-now())<30000,'ai_qa_additional_clock');
    const tables={};for(const name of ['speech_execution_leases','speech_requests','gpu_sessions','gpu_reservations','fullfile_reservations','gpu_budget_policies','fullfile_budget_policies','operator_qa_campaigns','operator_qa_gate']){
      tables[name]=(await c.query('SELECT * FROM croupier_studio.'+name+' AS t WHERE environment_id=$1 ORDER BY to_jsonb(t)::text LIMIT 11',[NATIVE_P6_QA.environmentId])).rows;
      need(tables[name].length<=10,'ai_qa_additional_bounded_rows');
    }
    need(tables.speech_execution_leases.every(r=>r.recovery_only===false&&Number(r.expires_at_ms)<=time)
      &&tables.gpu_sessions.every(r=>r.state==='terminal'&&r.released_at_ms!==null&&['COMPLETED','CANCELLED','FAILED','TIMED_OUT'].includes(r.terminal_status)&&r.terminal_reason==='provider')
      &&tables.speech_requests.every(r=>['completed','failed'].includes(r.state)),'ai_qa_additional_not_drained');
    for(const name of ['operator_qa_campaigns','operator_qa_gate'])need(tables[name].length===1
      &&tables[name][0].campaign_id===AI_QA_ORIGINAL.campaignId&&tables[name][0].source_sha256==='f5687e76c2611fb664937ff1b7076e0aef368d488be163294eb43cd3c7912c1e','ai_qa_additional_campaign_changed');
    const gpu=tables.gpu_budget_policies[0],file=tables.fullfile_budget_policies[0];
    need(tables.gpu_budget_policies.length===1&&Number(gpu.version)===1
      &&Number(gpu.daily_budget_micro_usd)===AI_QA_ORIGINAL.remainingMicroUsd,'ai_qa_additional_funding_policy_changed');
    need(tables.fullfile_budget_policies.length===1&&Number(file.version)===1
      &&Number(file.reserve_micro_usd)===1000000&&Number(file.reservation_window_ms)===720000,'ai_qa_additional_fullfile_policy_changed');
    const saved=tables.speech_requests.find(r=>r.request_key===fullfile?.requestKey);
    need(saved?.state==='completed'&&saved.capability==='fullfile'&&saved.package_id===fullfile.packageId
      &&sha256(JSON.stringify(saved.package_metadata))===fullfile.packageMetadataSha256,'ai_qa_additional_fullfile_changed');
    need(tables.fullfile_reservations.length===1&&tables.fullfile_reservations[0].request_key===fullfile.requestKey
      &&Number(tables.fullfile_reservations[0].reserved_micro_usd)===1000000&&tables.gpu_sessions.length>=1
      &&tables.gpu_reservations.length===tables.gpu_sessions.length&&tables.gpu_reservations.every(r=>Number(r.reserved_micro_usd)===1000000
        &&tables.gpu_sessions.some(x=>x.session_id===r.session_id)),'ai_qa_additional_retained_reservation_binding');
    const reserved=[...tables.gpu_reservations,...tables.fullfile_reservations].reduce((n,r)=>n+Number(r.reserved_micro_usd),0);
    need(Number.isSafeInteger(reserved)&&reserved>=2000000&&reserved+1000000<=AI_QA_ORIGINAL.remainingMicroUsd,
      'ai_qa_additional_retained_reservations_exhausted');
    need((await c.query('COMMIT')).command==='COMMIT','ai_qa_additional_read_commit');began=false;
    const proof={purpose:'bounded-native-ai-qa-additional-policy-read-v1',physical,observedAtMs:time,originalCampaignId:AI_QA_ORIGINAL.campaignId,
      reservedSqlMicroUsd:reserved,nextWindowGpuReserveMicroUsd:1000000,qaReservedPoolMicroUsd:AI_QA_ORIGINAL.remainingMicroUsd,
      fingerprints:Object.fromEntries(Object.entries(tables).map(([n,v])=>[n,{rows:v.length,sha256:sha256(JSON.stringify(v))}])),sqlMutations:0};
    Object.defineProperty(proof,'knownJobIds',{value:tables.gpu_sessions.map(r=>r.job_id)});
    additionalPolicyJobs.set(proof,tables.gpu_sessions.map(r=>({...r})));return proof;
  }finally{if(began)await c.query('ROLLBACK').catch(()=>{});c.release();}
}
export async function readAiQaAdditionalProvider({policy,providerReadApiKey,fetchImpl=fetch}={}){
  const sessions=additionalPolicyJobs.get(policy);need(sessions,'ai_qa_additional_verified_policy_required');
  need(typeof providerReadApiKey==='string'&&providerReadApiKey.length>0,'ai_qa_additional_existing_read_key');
  const base='https://api.runpod.ai/v2/zsudl8tmzcmiv1',get=route=>fetchImpl(base+'/'+route,
    {method:'GET',redirect:'error',headers:{authorization:'Bearer '+providerReadApiKey},signal:AbortSignal.timeout(10000)});
  const read=async r=>{need(r.ok,'ai_qa_additional_provider_read');const raw=await r.text();need(raw.length<=8192,'ai_qa_additional_provider_read_size');return JSON.parse(raw);};
  const response=await get('health');need(response.status===200,'ai_qa_additional_provider_read');
  const health=await read(response);need(health.jobs?.inQueue===0&&health.jobs?.inProgress===0&&health.workers?.running===0,'ai_qa_additional_provider_not_drained');
  const knownJobs=[];for(const session of sessions){
    const id=session.job_id;need(/^[A-Za-z0-9_-]{1,128}$/.test(id??''),'ai_qa_additional_known_job_required');
    const r=await get('status/'+id);
    if(r.status===404){
      // RunPod may expire status records. This proves only retained database terminality, never a new provider acknowledgement.
      need(session.state==='terminal'&&session.released_at_ms!==null&&Number.isSafeInteger(Number(session.released_at_ms))
        &&Number(session.released_at_ms)>=0&&Number(session.released_at_ms)<=policy.observedAtMs
        &&['COMPLETED','CANCELLED','FAILED','TIMED_OUT'].includes(session.terminal_status)&&session.terminal_reason==='provider',
        'ai_qa_additional_known_job_not_terminal');
      knownJobs.push({jobIdSha256:sha256(id),status:session.terminal_status,statusSource:'retained-database',providerStatusHttp:404});continue;
    }
    const j=await read(r);need(j.id===id&&['COMPLETED','CANCELLED','FAILED','TIMED_OUT'].includes(j.status),'ai_qa_additional_known_job_not_terminal');
    knownJobs.push({jobIdSha256:sha256(id),status:j.status});
  }
  return{health,knownJobs};
}
export async function installBoundedAiQaAdditionalWindow(input){
  need(process.platform==='linux'&&process.getuid?.()===1000&&process.env.RENDER_SERVICE_ID===NATIVE_P6_QA.serviceId
    &&process.env.RENDER_GIT_COMMIT===input.expectedSha&&process.env.CROUPIER_STUDIO_ENVIRONMENT_ID===NATIVE_P6_QA.environmentId
    &&process.env.CROUPIER_STUDIO_WORKSPACE_ID===NATIVE_P6_QA.workspaceId,'ai_qa_additional_actual_off_service');
  need(['CROUPIER_P6_QA_ROUTER','CROUPIER_P6_BOUNDED_TEST','CROUPIER_GENERATED_SPEECH_STREAMING'].every(k=>process.env[k]===undefined||process.env[k]==='0'),'ai_qa_additional_requires_off');
  const previousRaw=await small(NATIVE_P6_QA.dataRoot+'/p6-sdk/'+input.previousRunId+'/bounded-manifest.json'),previous=JSON.parse(previousRaw);
  const options={directory:NATIVE_P6_QA.dataRoot+'/p6-budget-ledger/'+AI_QA_ORIGINAL.authorizationId,
    anchorPath:NATIVE_P6_QA.dataRoot+'/native-p6-user-budget-20261003.json'};
  const oldBudget=await createAiQaBudget({...options,manifest:previous,manifestRawSha256:sha256(previousRaw),authoritySourceSha256:previous.sources['web/native-ai-qa-budget.mjs']});
  const before=await oldBudget.inspect(),intent=validateAiQaAdditionalIntent(input.intentRaw,input.approvedIntentSha256,before);
  need(intent.expectedSha===input.expectedSha&&intent.runId===input.runId&&intent.deploymentId===input.deploymentId,'ai_qa_additional_live_binding');
  const e=intent.endpointEvidence;need(e?.endpointId==='zsudl8tmzcmiv1'&&e.workersMax===1&&e.activeWorkersSetting===0&&e.gpuCount===1
    &&Date.now()>=e.observedAtMs&&Date.now()-e.observedAtMs<300000,'ai_qa_additional_fresh_one_worker');
  const db=new URL(process.env.CROUPIER_GAME_DATABASE_URL);need(db.pathname==='/'+NATIVE_P6_QA.database&&decodeURIComponent(db.username)===NATIVE_P6_QA.database&&db.searchParams.get('sslmode')==='require','ai_qa_additional_db_binding');
  const{Pool}=createRequire(join(repo,'web/package.json'))('pg'),pool=new Pool({connectionString:process.env.CROUPIER_GAME_DATABASE_URL,max:1,connectionTimeoutMillis:8000});
  try{
    const policy=await readAiQaAdditionalPolicy({...input,pool,fullfile:intent.fullfile});
    need(JSON.stringify(policy.fingerprints)===JSON.stringify(intent.policyFingerprints),'ai_qa_additional_policy_cas_changed');
    const {health,knownJobs}=await readAiQaAdditionalProvider({policy,providerReadApiKey:input.providerReadApiKey});
    const names=(await readdir('/var/data/speech')).filter(n=>/^gpu-session-[a-f0-9]{32}\.reservation\.json$/.test(n));
    need(names.length<=100,'ai_qa_additional_retained_inventory_size');let retained=null;
    for(const name of names){const path='/var/data/speech/'+name,raw=await small(path);if(sha256(raw)==='8e8e8731e5e473fe6d0642ff8e4f313ba089336167aad54c1f9dd49daf885798'){
      const stat=await lstat(path);need(!retained&&stat.size===209&&stat.mtimeMs===1790945260179.6155,'ai_qa_additional_old_reservation_changed');retained={sha256:sha256(raw),size:stat.size,mtimeMs:stat.mtimeMs};}}
    need(retained,'ai_qa_additional_old_reservation_missing');
    const manifest=await buildAiQaManifest({...input,ownLinkedPlayerSha256:sha256(input.playerId)});manifest.limits=AI_QA_SIX_LIMITS;
    const preflight={purpose:'bounded-native-ai-qa-additional-preflight-v1',budget:before,policy,knownJobs,health,
      retainedOriginalGpu:retained,providerJobPosts:0,sqlMutations:0};
    manifest.additionalWindow={predecessorRecordCount:before.records.length,predecessorJournalSha256:before.previousSha256,
      previousManifestSha256:sha256(previousRaw),previousAuthoritySourceSha256:previous.sources['web/native-ai-qa-budget.mjs'],previousRunId:previous.runId,previousExpectedSha:previous.expectedSha,
      rootReviewedIntentSha256:input.approvedIntentSha256,preflightSha256:sha256(JSON.stringify(preflight)),streamRequestIdSha256:sha256(intent.streamRequestId),
      humanAuthorization:AI_QA_SIX_AUTHORIZATION,previousCounts:before.counts,limitCounts:aiQaNextWindowCounts(before),globalRemainingGenerations:6-before.counts.generation,windowGenerations:1,streamOnly:true};
    const pin=sha256(JSON.stringify(manifest)),stateRoot=NATIVE_P6_QA.dataRoot+'/p6-sdk/'+manifest.runId;await mkdir(stateRoot,{mode:0o700});
    const snapshot=await buildAiQaPrivateSnapshot({directory:join(repo,'lab/data/platform-private'),pins:manifest.privateSources});need(sha256(snapshot)===manifest.privateSnapshotSha256,'ai_qa_additional_snapshot_changed');
    const snapshotFile=await open(stateRoot+'/bounded-private-snapshot.json','wx',0o600);try{await snapshotFile.writeFile(snapshot);await snapshotFile.sync();}finally{await snapshotFile.close();}
    await newFile(stateRoot+'/additional-intent.json',intent);await newFile(stateRoot+'/additional-preflight.json',preflight);await newFile(stateRoot+'/bounded-manifest.json',manifest);
    for(const name of ['entry','router','worker','authority'])await newFile(stateRoot+'/'+name+'-context.json',{purpose:'bounded-native-ai-qa-'+name+'-context-v1',expectedSha:manifest.expectedSha,manifestRawSha256:pin,sources:manifest.sources,privateSources:manifest.privateSources,sdkPackageSha256:manifest.sdkPackageSha256,sdkClientSha256:manifest.sdkClientSha256,originalAnchorSha256:manifest.originalAnchorSha256,campaignId:manifest.campaignId,expiresAtMs:manifest.expiresAtMs,actualCostUsd:null});
    const directory=await open(stateRoot,'r');try{await directory.sync();}finally{await directory.close();}
    const budget=await createAiQaBudget({...options,manifest,manifestRawSha256:pin,authoritySourceSha256:manifest.sources['web/native-ai-qa-budget.mjs']});
    const after=await budget.openAdditionalWindow({approvedIntentSha256:input.approvedIntentSha256,preflightSha256:manifest.additionalWindow.preflightSha256});
    const receipt={purpose:'bounded-native-ai-qa-additional-installed-v1',expectedSha:manifest.expectedSha,deploymentId:manifest.deploymentId,runId:manifest.runId,campaignId:manifest.campaignId,
      manifestRawSha256:pin,manifest,budgetBefore:before,budgetAfter:after,preflight,providerJobPosts:0,sqlMutations:0,extraReserveMicroUsd:0,refundMicroUsd:0,actualCostUsd:null,installedSdkReused:true,originalJournalPreserved:true};
    await newFile(stateRoot+'/additional-install-receipt.json',receipt);return receipt;
  }finally{await pool.end();}
}
