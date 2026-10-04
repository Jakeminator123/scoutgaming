// Default-off integration only. No private import or filesystem access occurs
// until the exact named QA service, scope and explicit source pin are verified.
import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import {lstat,open,realpath} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {projectOpenClawGameStatus} from './openclaw-chat.mjs';
import {normalizeProductSpeechEnvelope} from '../open-claw/lab/src/product-speech.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
const need=(ok,code)=>{if(!ok)throw Object.assign(Error(code),{code,statusCode:503});};
async function ownedFile(path,{privateFile=false}={}){
  const info=await lstat(path);
  need(info.isFile()&&!info.isSymbolicLink()&&info.nlink===1&&info.size<=1048576
    &&!(info.mode&0o022)&&(!privateFile||info.uid===1000&&!(info.mode&0o077))
    &&await realpath(path)===path,'native_p6_qa_source_file_invalid');
  const file=await open(path,constants.O_RDONLY|(constants.O_NOFOLLOW||0));
  try{const actual=await file.stat();need(actual.dev===info.dev&&actual.ino===info.ino&&actual.isFile(),'native_p6_qa_source_file_changed');
    return await file.readFile();}finally{await file.close();}
}
async function pinnedFile(path,pin){
  need(typeof pin==='string'&&/^[a-f0-9]{64}$/.test(pin),'native_p6_qa_source_pin_required');
  const bytes=await ownedFile(path);need(hash(bytes)===pin,'native_p6_qa_source_pin_changed');return bytes;
}
async function privateJson(path){const bytes=await ownedFile(path,{privateFile:true});return{bytes,value:JSON.parse(bytes)};}

export async function initializeNativeP6QaRouter(env=process.env){
  if (env.CROUPIER_P6_QA_ROUTER === undefined || env.CROUPIER_P6_QA_ROUTER === '' || env.CROUPIER_P6_QA_ROUTER === '0') return null;
  const {nativeP6QaRouterConfig,REPOSITORY}=await import('../ops/cloud/config.mjs');
  const qa=nativeP6QaRouterConfig(env);if(!qa)return null;
  need(env===process.env&&process.platform==='linux'&&process.getuid?.()===1000&&process.getgid?.()===1000
    &&REPOSITORY==='/app'&&resolve(process.argv[1]??'')===join(REPOSITORY,'web/server.mjs'),'native_p6_qa_actual_web_required');
  const rootInfo=await lstat(qa.stateRoot);
  need(rootInfo.isDirectory()&&!rootInfo.isSymbolicLink()&&rootInfo.uid===1000&&!(rootInfo.mode&0o077)
    &&await realpath(qa.stateRoot)===qa.stateRoot,'native_p6_qa_private_root_required');
  if(env.CROUPIER_P6_BOUNDED_TEST==='1') {
    const {initializeBoundedAiQa}=await import('./native-ai-qa-runtime.mjs');
    const middleware=await initializeBoundedAiQa(qa,env);
    middleware.readOwnedPlaybackContext=createNativeP6OwnedPlaybackContextReader({ownLinkedPlayerSha256:middleware.ownLinkedPlayerSha256});
    return middleware;
  }
  const [{value:manifest},{bytes:contextBytes,value:context},{value:workerManifest}]=await Promise.all([
    privateJson(qa.stateRoot+'/router-manifest.json'),privateJson(qa.stateRoot+'/authority-context.json'),privateJson(qa.stateRoot+'/manifest.json')]);
  need(manifest.runId===qa.runId&&manifest.deploymentId===qa.deploymentId
    &&manifest.sourceContext?.routingSourceSha256===qa.sourceSha256
    &&workerManifest.runId===manifest.runId&&workerManifest.campaignId===manifest.campaignId
    &&workerManifest.planBindingSha256===manifest.planBindingSha256
    &&hash(contextBytes)===workerManifest.authorityBridgeContextSha256,'native_p6_qa_exact_staged_context');
  const base=join(REPOSITORY,'lab/data/platform-private'),s=manifest.sourceContext.workerSourceContext;
  // Verify every private code dependency before importing any ignored source.
  await Promise.all([
    pinnedFile(join(base,'native-p6-qa-router.mjs'),qa.sourceSha256),
    pinnedFile(join(base,'native-p6-sdk-worker.mjs'),s.workerSourceSha256),
    pinnedFile(join(base,'native-p6-sdk-admission.mjs'),s.sdkSourceContext.admissionSourceSha256),
    pinnedFile(join(base,'native-cloud-browser-qa.mjs'),s.policySourceSha256),
    pinnedFile(join(base,'native-p6-authority-bridge.mjs'),context.authorityBridgeImplementationSha256),
    pinnedFile(join(base,'native-p6-budget-authority.mjs'),context.numericAuthoritySourceSha256),
    pinnedFile(join(base,'native-p6-phase-attestation.mjs'),context.phaseSourceSha256),
  ]);
  const router=await import(pathToFileURL(join(base,'native-p6-qa-router.mjs')).href);
  const bridge=await import(pathToFileURL(join(base,'native-p6-authority-bridge.mjs')).href);
  router.validateNativeP6QaRouterEnvironment(manifest,env);
  const authorityBridge=await bridge.createNativeP6RunnerAuthorityBridge({runId:manifest.runId,campaignId:manifest.campaignId,
    planBindingSha256:manifest.planBindingSha256,stateRoot:qa.stateRoot,target:manifest.target,humanAnchor:manifest.humanAnchor,
    bridgeContextSha256:hash(contextBytes)});
  const middleware=router.createNativeP6QaRouter({manifest,authorityBridge});
  middleware.readOwnedPlaybackContext=createNativeP6OwnedPlaybackContextReader({ownLinkedPlayerSha256:context.ownLinkedPlayerSha256});
  return middleware;
}

// Installed only by the verified ownQA initialization above. All inputs here
// are server callbacks; no client owner, revision or policy is accepted.
export function createNativeP6OwnedPlaybackContextReader({ownLinkedPlayerSha256,now=Date.now}={}){
  need(/^[a-f0-9]{64}$/.test(ownLinkedPlayerSha256??''),'native_p6_qa_playback_linked_player_required');
  const canonical=value=>value===null||typeof value!=='object'?JSON.stringify(value)
    :Array.isArray(value)?`[${value.map(canonical).join(',')}]`
      :`{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  const policyHash=project=>hash(canonical(project));
  return async({playerId,owner,readOwner,readStatus,readProject,project})=>{
    need(typeof playerId==='string'&&hash(playerId)===ownLinkedPlayerSha256&&typeof owner==='string'
      &&owner.length>0&&typeof readOwner==='function'&&typeof readStatus==='function'&&typeof readProject==='function'
      &&project&&typeof project==='object'&&!Array.isArray(project),'native_p6_qa_playback_actual_callbacks_required');
    const policySha256=policyHash(project),status=await readStatus();
    need(status?.dealerId==='astrid'&&status.sessionRevision===hash(owner)&&typeof status.roundRevision==='string'
      &&status.roundRevision.length>0&&status.roundRevision.length<=128,'native_p6_qa_playback_current_state_required');
    const currentStatus=await readStatus(),currentProject=await readProject(),currentOwner=await readOwner();
    need(currentOwner===owner&&policyHash(currentProject)===policySha256&&currentStatus?.dealerId==='astrid'
      &&currentStatus.sessionRevision===status.sessionRevision&&currentStatus.roundRevision===status.roundRevision,
      'native_p6_qa_playback_state_changed');
    return{actorSha256:ownLinkedPlayerSha256,ownerSessionSha256:hash(owner),sessionRevision:status.sessionRevision,
      roundRevision:status.roundRevision,policySha256,observedAtMs:now()};
  };
}
export async function nativeP6OwnedPlaybackContext(router,args){
  need(typeof router?.readOwnedPlaybackContext==='function','native_p6_qa_playback_context_unavailable');
  return router.readOwnedPlaybackContext(args);
}

// Used only at the trusted existing /chat and operator decision call sites.
// readStatus/readOwner remain the existing live authority and cancellation checks.
export function nativeP6OwnedSpeechFetch(router,{request,status,playerId,owner,readStatus,readOwner,signal,model='gateway-default',
  operatorAttempt,operatorCampaignId,streamRequested=false}){
  if(!router)return null;
  need(typeof readStatus==='function'&&typeof readOwner==='function','native_p6_qa_actual_owner_callbacks_required');
  return router.fetchForOwnedRequest({playerId,owner,readOwner,signal,streamRequested:streamRequested===true,
    ...(operatorAttempt===undefined?{}:{operatorAttempt,operatorCampaignId}),
    readEnvelope:async()=>{
      const current=await readStatus();
      // The caller's readStatus checks the memory policy/profile/forget epoch.
      // Its return lacks this optional projection, so retain that checked recall.
      const projected=projectOpenClawGameStatus({...current,...(status.conversationMemory===undefined?{}:{conversationMemory:status.conversationMemory})});
      return normalizeProductSpeechEnvelope({request,status:projected,...(model==='gateway-default'?{}:{model})});
    }});
}

// Bound by the real authenticated presentation request. The registry snapshots
// the exact projected Director body when the existing caller sends it, and
// re-reads the saved policy and session before a stage can reach the worker.
export function nativeP6OwnedDirectorFetch(router,{playerId,owner,readOwner,readStatus,readProject,project,signal}){
  if(!router)return null;
  need(typeof readOwner==='function'&&typeof readStatus==='function'&&typeof readProject==='function',
    'native_p6_qa_actual_director_callbacks_required');
  const ownedFetch=router.fetchForOwnedDirectorRequest({playerId,owner,readOwner,readStatus,readProject,project,signal});
  ownedFetch.cacheScope=hash(JSON.stringify([owner,project]));
  return ownedFetch;
}
