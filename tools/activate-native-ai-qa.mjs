// Runs only inside the named isolated QA service. No package installation,
// provider dispatch, account creation, reset, refund or production cutover.
import {readFile,lstat,mkdir,open,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {AI_QA_ORIGINAL,AI_QA_LIMITS,sha256,aiQaNeed as need,createAiQaBudget} from '../web/native-ai-qa-budget.mjs';
import {buildAiQaPrivateSnapshot} from '../web/native-ai-qa-private.mjs';
import {AI_QA_SOURCE_PATHS} from '../web/native-ai-qa-runtime.mjs';
import {NATIVE_P6_QA} from '../ops/cloud/config.mjs';
const repo=resolve(fileURLToPath(new URL('..',import.meta.url)));
const sdkRoot=NATIVE_P6_QA.dataRoot+'/p6-sdk/cb9b6b53-e7b0-4fa9-bc53-c5152ddbb1f2/node_modules/openai';
const privateDependencies=['native-cloud-browser-qa.mjs','native-p6-sdk-worker.mjs','native-p6-sdk-admission.mjs',
  'native-p6-upstream-bounds-final.json'];
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
  if(process.argv.slice(2).join(' ')==='--install'){
    try{let raw='';for await(const c of process.stdin){raw+=c;need(raw.length<=16384,'ai_qa_install_input_size');}
      const receipt=await installBoundedAiQa(JSON.parse(raw));console.log(JSON.stringify(receipt));
    }catch(e){console.log(JSON.stringify({purpose:'bounded-native-ai-qa-install-denied-v1',code:e.safeCode??'ai_qa_install_failed',noRawError:true}));process.exitCode=1;}
  }else console.log(JSON.stringify({purpose:'bounded-native-ai-qa-installer-contract-v1',target:NATIVE_P6_QA,
    originalCampaignId:AI_QA_ORIGINAL.campaignId,limits:AI_QA_LIMITS,requires:'Explicit physical isolated-QA --install with current release SHA and existing operator/player',providerCalls:0}));
}
