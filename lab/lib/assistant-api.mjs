import {createHmac,timingSafeEqual} from 'node:crypto';
import {canonicalStudioJson,validateStudioScope} from '../../web/storage/studio-contract.mjs';
import {normalizeNativeStudioRequest} from './studio-native-request.mjs';
import {assertNativeStudioRequest,studioNativeRuntime} from './studio-native-runtime.mjs';
import {assistantConfiguration,ASSISTANT_MODELS,PUBLIC_KNOWLEDGE,assistantJson,askAssistant,assistantFailure as fail} from './assistant-model.mjs';
import {readAssistantContext} from './assistant-context.mjs';
import {assistantDigest,prepareAssistantAction,executeAssistantAction} from './assistant-actions.mjs';

const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin'};
const json=(value,status=200)=>Response.json(value,{status,headers});
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===[...keys].sort().join(',');
export function createAssistantLimiter({now=Date.now}={}){
  let active=0;const entries=new Map();
  return {enter(key){const time=now();for(const [id,row]of entries)if(row.until<=time)entries.delete(id);
    const row=entries.get(key)??{until:time+60000,count:0};
    if(active>=4||row.count>=8||!entries.has(key)&&entries.size>=512)fail('assistant_busy',429);
    entries.set(key,{...row,count:row.count+1});active++;let released=false;
    return()=>{if(!released){released=true;active--;}};}};
}
const limiter=createAssistantLimiter();
function chatInput(body){
  if(!exact(body,['operation','mode','message','history'])||!Object.hasOwn(ASSISTANT_MODELS,body.mode)
    ||typeof body.message!=='string'||!body.message.trim()||body.message.length>3000||!Array.isArray(body.history)||body.history.length>8||body.history.length%2)fail('assistant_invalid_request');
  let chars=0;
  for(const [i,row]of body.history.entries()){
    if(!exact(row,['role','content'])||row.role!==(i%2?'assistant':'user')||typeof row.content!=='string'||row.content.length>6000)fail('assistant_invalid_request');
    chars+=row.content.length;
  }if(chars>18000)fail('assistant_invalid_request');
  return body;
}
export function createAssistantApi({config,runtime=studioNativeRuntime,configuration=assistantConfiguration(),
  ask=askAssistant,readContext=readAssistantContext,prepare=prepareAssistantAction,execute=executeAssistantAction,limit=limiter,now=Date.now}={}){
  async function principal(native,request){
    const actor=await native.authorize(request);
    if(!actor||!['admin','superadmin'].includes(actor.role)||typeof actor.user!=='string'||!actor.user.trim()||!actor.accountId
      ||canonicalStudioJson(validateStudioScope(actor.scope))!==canonicalStudioJson(validateStudioScope(native.config.scope)))fail('assistant_n1_required',403);
    return actor;
  }
  function owner(actor,request){
    return assistantDigest({accountId:actor.accountId,user:actor.user,role:actor.role,scope:actor.scope,
      session:request.headers.get('cookie')??'',authorization:request.headers.get('authorization')??''});
  }
  const key=native=>{if(!(native.speechReceiptKey instanceof Uint8Array)||native.speechReceiptKey.length<32)fail('assistant_confirmation_unavailable',503);
    return createHmac('sha256',native.speechReceiptKey).update('adminrobot:review:v1').digest();};
  const sign=(data,native)=>createHmac('sha256',key(native)).update(data).digest('hex');
  function decode(token,native,binding){
    if(typeof token!=='string'||token.length>8000||!/^[-A-Za-z0-9_]+\.[a-f0-9]{64}$/.test(token))fail('assistant_invalid_confirmation',403);
    const [data,signature]=token.split('.');
    if(!timingSafeEqual(Buffer.from(sign(data,native),'hex'),Buffer.from(signature,'hex')))fail('assistant_invalid_confirmation',403);
    let receipt;try{receipt=JSON.parse(Buffer.from(data,'base64url'));}catch{fail('assistant_invalid_confirmation',403);}
    if(receipt.owner!==binding||!Number.isSafeInteger(receipt.expiresAt)||receipt.expiresAt<=now())fail('assistant_confirmation_expired',409);
    return receipt;
  }
  return {async handle(original){
    let request=original,release;
    try{
      request=normalizeNativeStudioRequest(request,config);assertNativeStudioRequest(request,config);
      const url=new URL(request.url),base=config.apiBase==='/api/admin'?'/api/assistant':'/studio/api/assistant';
      if(![base,config.apiBase==='/studio/api/admin'?'/api/assistant':base].includes(url.pathname))fail('assistant_route_unknown',404);
      if(!['GET','POST'].includes(request.method))return json({error:'assistant_method_invalid'},405);
      if(request.method==='GET'){
        let access='help', identity='public';
        try{if(/(?:^|;\s*)(?:bo_jwt|lab_session)=/.test(request.headers.get('cookie')??'')){const actor=await principal(await runtime(),request);access='n1';identity=owner(actor,request);}}catch(error){if(![401,403,503].includes(error?.statusCode))throw error;}
        return json({access,identity,models:ASSISTANT_MODELS,configured:Boolean(configuration)});
      }
      if(request.headers.get('origin')!==url.origin||!['same-origin','none'].includes(request.headers.get('sec-fetch-site')))fail('assistant_origin_rejected',403);
      if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get('content-type')??''))fail('assistant_json_required',415);
      const body=await assistantJson(request,32000);
      if(body.operation==='chat'){
        const input=chatInput(body);let native,actor,binding;
        if(input.mode!=='help'){native=await runtime();actor=await principal(native,request);binding=owner(actor,request);}
        // Only Vercel's trusted connection header is eligible as a public rate
        // key; other environments share a conservative anonymous bucket.
        release=limit.enter(binding??('public:'+assistantDigest(request.headers.get('x-vercel-forwarded-for')??'shared')));
        const context=native?await readContext(native,request,{mode:input.mode}):PUBLIC_KNOWLEDGE;
        if(native&&owner(await principal(native,request),request)!==binding)fail('assistant_access_changed',403);
        request.signal.throwIfAborted();
        const answer=await ask({configuration,...input,context,signal:request.signal});
        if(native&&owner(await principal(native,request),request)!==binding)fail('assistant_access_changed',403);
        if(input.mode==='help'&&answer.proposal!==null)fail('assistant_invalid_response',503);
        request.signal.throwIfAborted();
        return json({...answer,model:ASSISTANT_MODELS[input.mode],observedAt:context.observedAt??null,coverage:context.coverage??null});
      }
      const native=await runtime(),actor=await principal(native,request),binding=owner(actor,request);
      release=limit.enter(binding);
      if(body.operation==='prepare'){
        if(!exact(body,['operation','proposal']))fail('assistant_invalid_request');
        const prepared=await prepare(native,request,body.proposal);
        if(owner(await principal(native,request),request)!==binding)fail('assistant_access_changed',403);
        request.signal.throwIfAborted();
        const expiresAt=now()+300000;
        const data=Buffer.from(canonicalStudioJson({owner:binding,proposal:body.proposal,fingerprint:prepared.fingerprint,expiresAt})).toString('base64url');
        return json({review:{...prepared.review,expiresAt},token:data+'.'+sign(data,native)});
      }
      if(body.operation!=='execute'||!exact(body,['operation','token','confirmation','accepted'])||body.accepted!==true)fail('assistant_invalid_confirmation',403);
      const receipt=decode(body.token,native,binding),prepared=await prepare(native,request,receipt.proposal);
      if(prepared.fingerprint!==receipt.fingerprint)fail('assistant_review_changed',409);
      if(body.confirmation!==prepared.review.confirmation)fail('assistant_confirmation_text',403);
      // Fresh session, expiry AND fresh dependencies immediately before invoking
      // the original server API, which still owns its transactional CAS/auth.
      decode(body.token,native,binding);
      if(owner(await principal(native,request),request)!==binding)fail('assistant_access_changed',403);
      request.signal.throwIfAborted();
      await execute(native,request,prepared);
      return json({completed:true,action:prepared.review.action,targetId:prepared.review.targetId,at:new Date(now()).toISOString()});
    }catch(error){
      if(request.signal.aborted)return json({error:'assistant_cancelled'},499);
      const status=[400,401,403,404,405,409,413,415,422,429,503].includes(error?.statusCode)?error.statusCode:503;
      const code=/^assistant_[a-z_]+$/.test(error?.code??'')?error.code:status===401||status===403?'assistant_n1_required':'assistant_unavailable';
      return json({error:code},status);
    }finally{release?.();}
  }};
}
export async function assistantEndpoint(request){
  const origins=[process.env.CROUPIER_PUBLIC_ORIGIN,process.env.CROUPIER_LAB_UI_ORIGIN];
  try{
    if(origins.some(value=>!value||new URL(value).origin!==value||new URL(value).protocol!=='https:'))return json({error:'assistant_unavailable'},503);
    const config={allowedOrigins:origins,publicHosts:origins.map(value=>new URL(value).host),
      apiBase:process.env.CROUPIER_LAB_BASE_PATH==='/studio'?'/studio/api/admin':'/api/admin',authBase:process.env.CROUPIER_LAB_BASE_PATH==='/studio'?'/studio/api/auth':'/api/auth'};
    return await createAssistantApi({config}).handle(request);
  }catch{return json({error:'assistant_unavailable'},503);}
}
