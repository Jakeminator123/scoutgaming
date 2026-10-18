import {readFile,lstat,realpath} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {AI_QA_ORIGINAL,AI_QA_LIMITS,AI_QA_SIX_LIMITS,AI_QA_SIX_AUTHORIZATION,aiQaWindowClosed,sha256,aiQaNeed as need,createAiQaBudget} from './native-ai-qa-budget.mjs';
import {registerBoundedAiQaFullfileAuthority} from './generated-speech-runtime.mjs';
export {boundedAiQaAllowsFullfile} from './generated-speech-runtime.mjs';
const repo=resolve(fileURLToPath(new URL('../..',import.meta.url)));
const safeError=e=>/^ai_qa_[a-z0-9_]+$/.test(e?.code??'')?e.code:'ai_qa_operation_failed';
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const fields=[
  'packages/presentation/contracts/speech-journal-constants.mjs','packages/presentation/contracts/speech-package.mjs','packages/presentation/contracts/astrid-voice-profile.mjs','packages/presentation/server/generated-speech-service.mjs','packages/presentation/server/generated-speech-runtime.mjs','packages/presentation/server/speech-journal-lease.mjs','services/game/native-ai-qa-runtime.mjs','services/game/native-ai-qa-budget.mjs','services/game/native-p6-qa-hook.mjs',
  'services/game/server.mjs','ops/cloud/config.mjs','ops/cloud/container-entry.mjs','ops/cloud/Dockerfile','services/game/native-ai-qa-private.mjs','services/game/generated-speech-runtime.mjs','services/game/generated-speech-stream.mjs',
  'services/game/generated-speech-session.mjs','services/game/speech-journal-runtime.mjs','packages/presentation/server/generated-speech-provider.mjs',
  'services/game/generated-speech-chat.mjs','services/game/operator-speech-qa.mjs','tools/activate-native-ai-qa.mjs',
  'services/game/public/app.mjs','services/game/public/native-p6-game-playback.mjs','services/game/public/speech-queue.mjs',
  'packages/presentation/runtime/speech-pose-gate.mjs','packages/presentation/runtime/generated-speech-player.mjs','packages/presentation/runtime/speech-stream-client.mjs'];
export const AI_QA_SOURCE_PATHS=Object.freeze(fields);
export function validateAiQaManifest(m,env,now=Date.now()){
  need(m?.purpose==='bounded-native-ai-qa-activation-v1'&&m.campaignId===AI_QA_ORIGINAL.campaignId
    &&m.expectedSha===env.RENDER_GIT_COMMIT&&m.runId===env.CROUPIER_P6_SDK_RUN_ID
    &&m.deploymentId===env.CROUPIER_P6_SDK_DEPLOYMENT_ID&&equal(m.limits,m.additionalWindow?AI_QA_SIX_LIMITS:AI_QA_LIMITS)
    &&/^[a-f0-9]{64}$/.test(m.privateSnapshotSha256??'')&&m.originalAnchorSha256===AI_QA_ORIGINAL.anchorSha256&&m.actualCostUsd===null
    &&Number.isSafeInteger(m.createdAtMs)&&m.createdAtMs<=now&&m.expiresAtMs>now
    &&m.expiresAtMs-m.createdAtMs<=AI_QA_LIMITS.lifetimeMs
    &&/^[a-f0-9]{64}$/.test(m.ownLinkedPlayerSha256),'ai_qa_exact_manifest_required');
  need(fields.every(p=>/^[a-f0-9]{64}$/.test(m.sources?.[p]??''))
    &&/^[a-f0-9]{64}$/.test(m.privateWorkerSha256??'')&&m.sdkVersion==='7.12.1'
    &&m.sdkRoot==='/var/data/native-studio-qa/abc92154cb15/p6-sdk/cb9b6b53-e7b0-4fa9-bc53-c5152ddbb1f2/node_modules/openai',
    'ai_qa_source_and_installed_sdk_required');
  if(m.continuation){const c=m.continuation;
    need(c.predecessorRecordCount===13&&['predecessorJournalSha256','previousManifestSha256','previousAuthoritySourceSha256',
      'rootReviewedIntentSha256','preflightSha256','streamRequestIdSha256'].every(k=>/^[a-f0-9]{64}$/.test(c[k]??''))
      &&/^[a-f0-9-]{36}$/.test(c.previousRunId??'')&&/^[a-f0-9]{40}$/.test(c.previousExpectedSha??'')
      &&c.previousRunId!==m.runId,'ai_qa_continuation_manifest_required');
  }
  if(m.additionalWindow){const c=m.additionalWindow;
    need(!m.continuation&&c.predecessorRecordCount>=21&&equal(c.humanAuthorization,AI_QA_SIX_AUTHORIZATION)
      &&['predecessorJournalSha256','previousManifestSha256','previousAuthoritySourceSha256','rootReviewedIntentSha256','preflightSha256','streamRequestIdSha256'].every(k=>/^[a-f0-9]{64}$/.test(c[k]??''))
      &&/^[a-f0-9-]{36}$/.test(c.previousRunId??'')&&/^[a-f0-9]{40}$/.test(c.previousExpectedSha??'')
      &&c.windowGenerations===1&&c.streamOnly===true&&c.globalRemainingGenerations>0&&c.globalRemainingGenerations<=4,
      'ai_qa_additional_manifest_required');
  }
  return m;
}
async function bytes(path,{privateFile=false}={}){
  const s=await lstat(path);need(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.size<=1048576
    &&await realpath(path)===path&&(!privateFile||s.uid===1000&&!(s.mode&0o077)),'ai_qa_source_file_denied');
  return readFile(path);
}
export async function initializeBoundedAiQa(qa,env){
  need(env===process.env&&process.platform==='linux'&&process.getuid?.()===1000&&repo==='/app'
    &&resolve(process.argv[1]??'')==='/app/services/game/server.mjs','ai_qa_actual_web_required');
  const raw=await bytes(qa.stateRoot+'/bounded-manifest.json',{privateFile:true});
  need(sha256(raw)===env.CROUPIER_P6_BOUNDED_MANIFEST_SHA256,'ai_qa_manifest_pin_changed');
  const m=validateAiQaManifest(JSON.parse(raw),env);
  await Promise.all(fields.map(async p=>need(sha256(await bytes(join(repo,p)))===m.sources[p],'ai_qa_source_changed')));
  const workerPath=join(repo,'lab/data/platform-private/native-p6-sdk-worker.mjs');
  need(sha256(await bytes(workerPath))===m.privateWorkerSha256,'ai_qa_existing_worker_changed');
  // Re-use the already installed package. Never install, copy or reset SDK state.
  need(sha256(await bytes(m.sdkRoot+'/package.json'))===m.sdkPackageSha256
    &&sha256(await bytes(m.sdkRoot+'/client.js'))===m.sdkClientSha256,'ai_qa_installed_sdk_changed');
  need(['native-cloud-browser-qa.mjs','native-p6-sdk-worker.mjs','native-p6-sdk-admission.mjs','native-p6-upstream-bounds-final.json']
    .every(p=>/^[a-f0-9]{64}$/.test(m.privateSources?.[p]??'')),'ai_qa_private_closure_required');
  await Promise.all(Object.entries(m.privateSources).map(async([p,pin])=>{
    need(/^[a-z0-9-]+\.(mjs|json)$/.test(p),'ai_qa_private_path_denied');
    need(sha256(await bytes(join(repo,'lab/data/platform-private',p)))===pin,'ai_qa_private_source_changed');
  }));
  const worker=await import(pathToFileURL(workerPath).href);
  need(equal(await worker.readNativeP6SdkWorkerSourceContext(),m.workerSourceContext),'ai_qa_prompt_context_changed');
  const sdk=await worker.readNativeP6SdkWorkerStagedSdk({runId:'cb9b6b53-e7b0-4fa9-bc53-c5152ddbb1f2'});
  need(sdk.sdk.treeSha256===m.sdkTreeSha256&&sdk.sdk.files===m.sdkFiles&&sdk.sdk.treeSha256===
    'ebbb70cbf3b784adcee13323880215dc360ac0e1c5d78891f9813368e6c3da0a','ai_qa_installed_sdk_tree_changed');
  const OpenAI=(await import(pathToFileURL(m.sdkRoot+'/index.mjs').href)).default;
  const budget=await createAiQaBudget({directory:qa.dataRoot+'/p6-budget-ledger/'+AI_QA_ORIGINAL.authorizationId,
    anchorPath:qa.dataRoot+'/native-p6-user-budget-20261003.json',manifest:m,
    manifestRawSha256:sha256(raw),authoritySourceSha256:m.sources['services/game/native-ai-qa-budget.mjs']});
  // Activation exception is installed beforehand by the operator. A web boot
  // cannot seed policy, reservation or a fresh campaign.
  const current=await budget.inspect();need(current.exception&&!aiQaWindowClosed(current),'ai_qa_installed_exception_required');
  need(m.additionalWindow?current.additionalWindows.at(-1)?.rootReviewedIntentSha256===m.additionalWindow.rootReviewedIntentSha256:Boolean(current.continuation)===Boolean(m.continuation)&&(!m.continuation||current.continuation.rootReviewedIntentSha256===m.continuation.rootReviewedIntentSha256),
    'ai_qa_manual_continuation_not_installed');
  const client=new OpenAI({apiKey:env.CROUPIER_P6_SDK_OPENAI_API_KEY,maxRetries:0,timeout:30000,
    fetch:async(url,options)=>{
      need(String(url)==='https://api.openai.com/v1/responses'&&options.method==='POST'
        &&typeof options.body==='string'&&Buffer.byteLength(options.body)<=AI_QA_LIMITS.requestBytes,
        'ai_qa_closed_sdk_transport');
      return fetch(url,{...options,redirect:'error'});
    }});
  const [speechRole,directorRole]=await Promise.all(['croupier-speech','croupier-director'].map(name=>
    readFile(join(repo,'services/openclaw/lab/deploy/runtime-bundle/roles/'+name+'.md'),'utf8')));
  return createBoundedAiQaRouter({manifest:m,budget,client,worker,speechRole,directorRole,
    readbackToken:qa.tokens.readback,endpointId:env.CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID});
}
export function createBoundedAiQaRouter({manifest:m,budget,client,worker,speechRole,directorRole,
  readbackToken,endpointId,fetchImpl=fetch,now=Date.now}={}){
  let busy=false;const allowedTexts=new Set();const streamWindow=m.additionalWindow??m.continuation;
  const owned=async({playerId,owner,readOwner,signal})=>{
    signal?.throwIfAborted();need(sha256(playerId)===m.ownLinkedPlayerSha256&&await readOwner()===owner,'ai_qa_current_owner_required');
    need(now()<m.expiresAtMs,'ai_qa_manifest_expired');
  };
  async function serial(fn){need(!busy,'ai_qa_parallel_dispatch_denied');busy=true;try{return await fn();}finally{busy=false;}}
  async function responsesCreate({logicalCallId,body,signal}){
    need(body.model==='gpt-5.6-terra'&&body.stream===false&&body.store===false
      &&body.max_output_tokens<=AI_QA_LIMITS.outputTokens&&Buffer.byteLength(JSON.stringify(body))<=AI_QA_LIMITS.requestBytes,
      'ai_qa_model_or_request_limit');
    // Counting endpoint omitted under the explicit tariff exception. Actual
    // provider usage is recorded; no free count tariff is asserted.
    const key=await budget.dispatch('sdk',logicalCallId,{model:body.model,requestBytes:Buffer.byteLength(JSON.stringify(body))});
    try{
      const r=await client.responses.create(body,{signal,maxRetries:0});
      need(r?.status==='completed','ai_qa_sdk_not_completed');
      await budget.outcome(key,'response-observed',{inputTokens:r.usage?.input_tokens??null,
        outputTokens:r.usage?.output_tokens??null,totalTokens:r.usage?.total_tokens??null});return r;
    }catch(e){await budget.outcome(key,'uncertain').catch(()=>{});throw e;}
  }
  const router=async(req,res)=>{
    if(req.url!=='/internal/p6/bounded-runtime')return false;
    if(req.method!=='GET'||sha256((req.headers.authorization??'').replace(/^Bearer /,''))!==sha256(readbackToken)){
      res.writeHead(403,{'Cache-Control':'no-store'});res.end();return true;}
    const s=await budget.inspect();res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
    res.end(JSON.stringify({purpose:'bounded-native-ai-qa-runtime-readback-v1',expectedSha:m.expectedSha,
      deploymentId:m.deploymentId,campaignId:m.campaignId,manifestSha256:s.activeWindow.manifestSha256,originalManifestSha256:s.exception.manifestSha256,
      pid:process.pid,observedAtMs:now(),limits:m.limits,busy,budget:s,actualCostUsd:null}));return true;
  };
  router.fetchForOwnedRequest=args=>async(_url,options={})=>serial(async()=>{
    await owned(args);need(!streamWindow||args.streamRequested===true,'ai_qa_continuation_stream_required');
    const envelope=await args.readEnvelope();
    need(!streamWindow||sha256(envelope.request.requestId)===streamWindow.streamRequestIdSha256,
      'ai_qa_continuation_request_required');
    need(envelope.status.dealerId==='astrid'&&!envelope.request.observation,'ai_qa_short_text_only');
    const gen=await budget.dispatch('generation',envelope.request.requestId);
    const state=await budget.inspect(),stage=state.counts.generation===1?'fullfile':'stream-1';
    try{
      await owned(args);
      const choice=await worker.runNativeP6ProductSpeech({envelope,ticket:{runId:m.runId,stage},
        roleContext:speechRole+'\nFor this bounded test, use at most 120 characters in generatedText.text.',responsesCreate,
        signal:args.signal?AbortSignal.any([args.signal,...(options.signal?[options.signal]:[])]):options.signal});
      await owned(args);
      need(choice.kind!=='generatedText'||typeof choice.text==='string'&&choice.text.length<=AI_QA_LIMITS.textChars,'ai_qa_text_limit');
      if(choice.kind==='generatedText')allowedTexts.add(sha256(choice.text));
      await budget.outcome(gen,'response-observed',{textChars:choice.text?.length??0,kind:choice.kind});
      return Response.json(choice);
    }catch(e){await budget.outcome(gen,'uncertain').catch(()=>{});throw e;}
  });
  router.fetchForOwnedDirectorRequest=args=>async(_url,options={})=>serial(async()=>{
    need(!streamWindow,'ai_qa_continuation_director_denied');
    await owned(args);const project=await args.readProject(),status=await args.readStatus();
    need(equal(project,args.project)&&status.dealerId==='astrid','ai_qa_current_director_policy');
    const envelope=worker.normalizeNativeP6DirectorEnvelope(JSON.parse(options.body));
    const result=await worker.runNativeP6Director({envelope,ticket:{runId:m.runId,stage:'text'},roleContext:directorRole,
      responsesCreate,signal:args.signal});
    await owned(args);need(equal(await args.readProject(),project)&&equal(await args.readStatus(),status),'ai_qa_director_state_changed');
    return Response.json(result);
  });
  // Provider dispatches are persisted before POST. Reads/cancellation stay
  // available after expiry, while new TTS/GPU work remains fenced.
  router.providerFetch=async(url,options={})=>{
    const u=new URL(url);let resource,id,measurements={};
    if(u.href==='https://api.cartesia.ai/tts/bytes'){
      need(options.method==='POST','ai_qa_tts_method');const body=JSON.parse(options.body),text=body.transcript;
      need(typeof text==='string'&&text.length<=AI_QA_LIMITS.textChars&&allowedTexts.has(sha256(text)),'ai_qa_owned_text_required');
      resource='tts';const textSha256=sha256(text);id=m.additionalWindow?textSha256+':'+m.additionalWindow.streamRequestIdSha256:textSha256;measurements={characters:text.length,textSha256};
    }else if(u.origin==='https://api.runpod.ai'&&u.pathname.startsWith('/v2/'+endpointId+'/')){
      const route=u.pathname.slice(('/v2/'+endpointId+'/').length);
      if(route==='run'){
        need(options.method==='POST','ai_qa_gpu_method');const body=JSON.parse(options.body);need(['session','lipsync'].includes(body?.input?.op)&&(!streamWindow||body.input.op==='session'),'ai_qa_gpu_op_denied');
        resource='gpu';id=m.additionalWindow?body.input.op+':'+m.additionalWindow.streamRequestIdSha256:body.input.op;
        measurements={requestBytes:Buffer.byteLength(options.body)};
      }else need(options.method==='GET'||options.method==='POST'&&route.startsWith('cancel/'),'ai_qa_provider_route_denied');
    }else need(false,'ai_qa_provider_host_denied');
    if(!resource)return fetchImpl(url,options);
    const key=await budget.dispatch(resource,id,measurements),started=now();
    try{const response=await fetchImpl(url,options);
      await budget.outcome(key,response.ok?'response-observed':'uncertain',{...measurements,status:response.status,elapsedMs:now()-started});return response;
    }catch(e){await budget.outcome(key,'uncertain',{elapsedMs:now()-started}).catch(()=>{});throw e;}
  };
  router.budget=budget;router.ownLinkedPlayerSha256=m.ownLinkedPlayerSha256;const validateFullfile=env=>{
    if(streamWindow)return false;
    validateAiQaManifest(m,env);return env.RENDER_SERVICE_ID==='srv-datj7l893c1s73ar3u50'
      &&env.CROUPIER_CLOUD_DATA_ROOT==='/var/data/native-studio-qa/abc92154cb15'
      &&env.CROUPIER_STUDIO_ENVIRONMENT_ID==='qa_native_abc92154cb15'
      &&env.CROUPIER_STUDIO_WORKSPACE_ID==='croupier'&&env.CROUPIER_STUDIO_NEON_POLICY==='1'
      &&env.CROUPIER_P6_QA_ROUTER==='1'&&env.CROUPIER_P6_BOUNDED_TEST==='1';
  };
  registerBoundedAiQaFullfileAuthority(router,validateFullfile);registerBoundedAiQaFullfileAuthority(router.providerFetch,validateFullfile);return router;
}
