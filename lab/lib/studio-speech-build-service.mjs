import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {STUDIO_ASTRID_VOICE,STUDIO_SPEECH_TEMPLATE_REVISION,studioSpeechLines,studioSpeechBuildCompatibility} from '../../web/public/studio-speech.mjs';
import {canonicalStudioJson,validateActor,validateStudioScope} from '../../packages/studio-registry/server/document-contract.mjs';
import {normalizeSpeechPackage} from '../../web/public/speech-package.mjs';
import {assertNativeStudioRequest,nativeStudioAdminEnabled,studioNativeRuntime} from './studio-native-runtime.mjs';
import {normalizeNativeStudioRequest} from './studio-native-request.mjs';
import {readStudioDocumentJson} from './studio-document-api.mjs';

const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin'};
const json=(value,status=200)=>Response.json(value,{status,headers});
const fail=(code,statusCode=400)=>{throw Object.assign(Error(code),{code,statusCode});};
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===[...keys].sort().join(',');
const safeError=error=>/^(?:studio_speech_|generated_speech_|invalid_generated_speech_)[a-z_]+$/.test(error?.code??'')?error.code:'studio_speech_build_failed';

async function verifyAstridVoice({signal,env=process.env,fetchImpl=fetch}={}){
  const key=env.CARTESIA_API_KEY;if(typeof key!=='string'||!key||/\s/.test(key))fail('studio_speech_voice_unavailable',503);
  const response=await fetchImpl('https://api.cartesia.ai/voices/'+encodeURIComponent(STUDIO_ASTRID_VOICE.voiceId),{method:'GET',redirect:'error',signal:AbortSignal.any([signal??new AbortController().signal,AbortSignal.timeout(10000)]),headers:{authorization:`Bearer ${key}`,'Cartesia-Version':'2026-08-14'}});
  if(!response.ok||!response.headers.get('content-type')?.includes('application/json')||!response.body?.getReader()){await response.body?.cancel();fail('studio_speech_voice_unavailable',503);}
  const reader=response.body.getReader(),chunks=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>131072)fail('studio_speech_voice_unavailable',503);chunks.push(Buffer.from(value));}const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(value.id!==STUDIO_ASTRID_VOICE.voiceId||value.status!=='active'||typeof value.name!=='string'||!value.name.trim()||value.name.length>100||/[\u0000-\u001f]/.test(value.name))fail('studio_speech_voice_unavailable',503);return {name:value.name,voiceId:value.id,verified:true};}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}

// A prepared plan is an actor-bound, expiring review receipt. It never changes
// policy, registers clips or approves media. The existing speech service owns
// durable paid-request reservations and artifact storage; no new ledger exists.
export function createStudioSpeechBuildApi(runtime,{serviceLookup=()=>runtime?.speechBuildDriver??null,verifyVoice=verifyAstridVoice,clock=Date.now,secret=runtime?.speechReceiptKey}={}) {
  if(!runtime?.authorize||!runtime.repository?.readDocument||!runtime.mutationTransaction||!runtime.config)fail('studio_speech_unavailable',503);
  if(!(secret instanceof Uint8Array)||secret.byteLength!==32)fail('studio_speech_signer_unavailable',503);
  // Capture a private copy rather than trusting mutable runtime/test buffers.
  secret=Buffer.from(secret);
  const scope=validateStudioScope(runtime.config.scope),base=runtime.config.apiBase==='/api/admin'?'/api/speech-build':'/studio/api/speech-build';
  const sign=value=>createHmac('sha256',secret).update(value).digest('hex');
  const driver=()=>{try{return serviceLookup();}catch{return null;}};
  const selectedLines=(language,ids)=>{try{return studioSpeechLines(language,ids);}catch{fail('studio_speech_selection_invalid',400);}};
  async function principal(request){const value=await runtime.authorize(request);if(!value||!['admin','superadmin'].includes(value.role)||canonicalStudioJson(validateStudioScope(value.scope))!==canonicalStudioJson(scope))fail('studio_speech_access_denied',403);return {actor:validateActor(value.user),role:value.role,accountId:value.accountId??null};}
  async function saved(){const row=await runtime.repository.readDocument('project');if(!row?.value||typeof row.revision!=='string')fail('studio_speech_project_unavailable',503);return {...row.value,revision:row.revision};}
  const ownerFor=actor=>canonicalStudioJson({scope,...actor});
  async function stillCurrent(request,actor,revision,dealerId){const current=await principal(request);if(ownerFor(current)!==ownerFor(actor))fail('studio_speech_access_changed',403);const project=await saved();if(project.revision!==revision)fail('studio_speech_revision_conflict',409);const match=studioSpeechBuildCompatibility(project,dealerId);if(!match.supported)fail('studio_speech_profile_unsupported',422);request.signal.throwIfAborted();return project;}
  function decode(token,owner){if(typeof token!=='string'||token.length>24000)fail('studio_speech_plan_invalid');const [encoded,signature,...extra]=token.split('.');if(extra.length||!/^[a-f0-9]{64}$/.test(signature??''))fail('studio_speech_plan_invalid');if(!timingSafeEqual(Buffer.from(sign(encoded),'hex'),Buffer.from(signature,'hex')))fail('studio_speech_plan_invalid');let payload;try{payload=JSON.parse(Buffer.from(encoded,'base64url').toString());}catch{fail('studio_speech_plan_invalid');}if(payload.owner!==owner||payload.expiresAt<clock())fail('studio_speech_plan_expired',409);return payload;}
  return Object.freeze({async handle(original){
    try{
      let transport=original,transportUrl=new URL(original.url);
      if(![base,'/api/speech-build'].includes(transportUrl.pathname))fail('studio_speech_route_unknown',404);
      // Explicit bounded media query, independently authorized on every read.
      const media=transportUrl.searchParams.get('media'),kind=transportUrl.searchParams.get('kind');
      if(transportUrl.search){if(!['GET','HEAD'].includes(original.method)||[...transportUrl.searchParams.keys()].sort().join(',')!=='kind,media'||!/^[a-f0-9]{32}$/.test(media??'')||!['audio','video'].includes(kind))fail('studio_speech_media_unknown',404);transportUrl.search='';transport=new Request(transportUrl,original);}
      // Next may omit the configured basePath for this new exact namespace.
      if(base==='/studio/api/speech-build'&&transportUrl.pathname==='/api/speech-build'){transportUrl.pathname=base;transport=new Request(transportUrl,transport);}
      let request=normalizeNativeStudioRequest(transport,runtime.config),url=new URL(request.url);
      if(url.pathname!==base)fail('studio_speech_route_unknown',404);
      assertNativeStudioRequest(request,runtime.config);
      const actor=await principal(request),owner=ownerFor(actor);
      if(media){const service=driver();if(!service)fail('studio_speech_driver_unavailable',503);const result=await service.media({id:media,kind,owner,request});if(ownerFor(await principal(request))!==owner)fail('studio_speech_access_changed',403);if(result instanceof Response)return new Response(request.method==='HEAD'?null:result.body,{status:result.status,headers:{...headers,'Content-Type':result.headers.get('content-type')??'application/octet-stream'}});return new Response(request.method==='HEAD'?null:new Uint8Array(result.bytes),{headers:{...headers,'Content-Type':result.contentType,'Content-Length':String(result.bytes.length)}});}
      if(request.method==='GET'){const configured=Boolean(driver());return json({configured,voice:STUDIO_ASTRID_VOICE,capability:{code:configured?'studio_speech_driver_ready':'studio_speech_driver_unavailable',nativeDriverBound:configured},message:configured?'Filbyggaren använder den befintliga beständiga Astrid/Victoria-kedjan.':'Denna Studio-miljö saknar en ansluten filbyggare med beständig kostnadsjournal. Strömmande dealerprofiler och Runway ger inte denna koppling.'});}
      if(request.method!=='POST')return json({error:'studio_speech_method_invalid'},405);
      if(request.headers.get('origin')!==url.origin||!['same-origin','none'].includes(request.headers.get('sec-fetch-site')))fail('studio_speech_access_denied',403);
      const body=await readStudioDocumentJson(request);
      if(body.operation==='prepare'){
        if(!exact(body,['operation','dealerId','expectedRevision','language','lineIds']))fail('studio_speech_request_invalid');
        const project=await saved();if(project.revision!==body.expectedRevision)fail('studio_speech_revision_conflict',409);
        const match=studioSpeechBuildCompatibility(project,body.dealerId);if(!match.supported)fail('studio_speech_profile_unsupported',422);
        const lines=selectedLines(body.language,body.lineIds),expiresAt=clock()+300000;
        const configured=Boolean(driver()),verifiedVoice=configured?await verifyVoice({signal:request.signal}):null;
        if(configured&&(!verifiedVoice?.verified||verifiedVoice.voiceId!==STUDIO_ASTRID_VOICE.voiceId))fail('studio_speech_voice_unavailable',503);
        await stillCurrent(request,actor,project.revision,body.dealerId);
        const payload={owner,dealerId:body.dealerId,revision:project.revision,language:body.language,lineIds:body.lineIds,templateRevision:STUDIO_SPEECH_TEMPLATE_REVISION,expiresAt,nonce:randomBytes(16).toString('hex')};
        const encoded=Buffer.from(canonicalStudioJson(payload)).toString('base64url');
        return json({state:'prepared',plan:{token:encoded+'.'+sign(encoded),dealerId:body.dealerId,revision:project.revision,language:body.language,lines,expiresAt,templateRevision:STUDIO_SPEECH_TEMPLATE_REVISION,voice:{...STUDIO_ASTRID_VOICE,...(verifiedVoice?{name:verifiedVoice.name}:{}),verified:Boolean(verifiedVoice)},configured,message:match.message}});
      }
      if(body.operation!=='build'||!exact(body,['operation','token']))fail('studio_speech_request_invalid');
      const plan=decode(body.token,owner);if(plan.templateRevision!==STUDIO_SPEECH_TEMPLATE_REVISION)fail('studio_speech_plan_expired',409);
      const service=driver();if(!service?.generate)fail('studio_speech_driver_unavailable',503);
      const lines=selectedLines(plan.language,plan.lineIds),results=[];
      const fresh=()=>runtime.mutationTransaction(()=>stillCurrent(request,actor,plan.revision,plan.dealerId));
      await fresh();
      const verifiedVoice=await verifyVoice({signal:request.signal});if(!verifiedVoice?.verified||verifiedVoice.voiceId!==STUDIO_ASTRID_VOICE.voiceId)fail('studio_speech_voice_unavailable',503);await fresh();
      // One line at a time. A failed or uncertain paid request stops this batch;
      // repeated submission of this receipt keeps the exact durable request IDs.
      for(const line of lines){try{
        const requestId='studio-'+createHash('sha256').update(body.token+'\0'+line.id).digest('hex');
        const value=normalizeSpeechPackage(await service.generate({requestId,text:line.exactText,dealerId:plan.dealerId,owner,signal:request.signal,beforeCostly:fresh}));
        await fresh();if(value.dealerId!==plan.dealerId||value.exactText!==line.exactText||value.source.voiceId!==STUDIO_ASTRID_VOICE.voiceId||value.generation?.modelId!==STUDIO_ASTRID_VOICE.modelId||value.generation?.profileRevision!==STUDIO_ASTRID_VOICE.profileRevision||value.generation?.textSha256!==createHash('sha256').update(line.exactText).digest('hex')||value.reviewStatus!=='pending')fail('studio_speech_output_mismatch',502);
        const id=value.packageId.replace(/^generated-/,'');
        results.push({lineId:line.id,language:line.language,exactText:value.exactText,state:'succeeded',packageId:value.packageId,audioUrl:`${base}?media=${id}&kind=audio`,videoUrl:`${base}?media=${id}&kind=video`,audioSha256:value.audio.sha256,videoSha256:value.video.sha256,textSha256:value.generation.textSha256,frameCount:value.video.frameCount,fps:value.video.fps,audioDelayMs:value.audioDelayMs,calibrationRevision:value.calibrationRevision,reviewStatus:'pending'});
      }catch(error){results.push({lineId:line.id,language:line.language,exactText:line.exactText,state:'failed',error:safeError(error)});return json({state:'failed',results,error:safeError(error)});}}
      return json({state:'succeeded',results});
    }catch(error){return json({error:safeError(error)},[400,403,404,409,413,415,422,429,502,503].includes(error?.statusCode)?error.statusCode:503);}
  }});
}
let apiPromise;
export async function studioSpeechBuildEndpoint(request){if(!nativeStudioAdminEnabled())return json({error:'studio_speech_native_required'},503);try{apiPromise??=studioNativeRuntime().then(runtime=>createStudioSpeechBuildApi(runtime)).catch(error=>{apiPromise=null;throw error;});return await(await apiPromise).handle(request);}catch{return json({error:'studio_speech_unavailable'},503);}}
