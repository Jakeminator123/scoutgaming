import {createHash} from 'node:crypto';
import {readFile,lstat,readdir,open,mkdir,rmdir,realpath} from 'node:fs/promises';
import {join,resolve} from 'node:path';

export const AI_QA_ORIGINAL=Object.freeze({
  campaignId:'f2c28b62-9ae7-4cd6-abcd-e2137f2206d6',
  authorizationId:'e62a36d8-5fb0-4f73-bcc7-0d8ddf7c3045',
  anchorSha256:'d1a8f8fedb96008369a9ec87091744718d03f2678a465a80d147101271f6c523',
  authoritySha256:'e6be846be83e49c7056845b4ed5272ebcefa22a599176e75564bc73c4799e2a0',
  records:Object.freeze(['0f097e9947a2b5ffa10525292255490693778b20f33a367fcaf7928362e311c4',
    '93575497ebdf74235247b03150dfcf9f19390c25028bd9ee06d6bda757796154']),
  capMicroUsd:10000000,retainedMicroUsd:5251152,remainingMicroUsd:4748848,
});
export const AI_QA_LIMITS=Object.freeze({generations:2,sdkCalls:3,ttsCalls:2,gpuSubmissions:2,
  gpuWorkers:1,textChars:120,outputTokens:512,requestBytes:32768,lifetimeMs:1800000,automaticRetry:false});
export const AI_QA_CONTINUATION_COUNTS=Object.freeze({generation:1,sdk:2,tts:1,gpu:1});
export const AI_QA_CONTINUATION_REMAINING=Object.freeze({generation:1,sdk:1,tts:1,gpu:1});
export const AI_QA_SIX_LIMITS=Object.freeze({...AI_QA_LIMITS,generations:6,sdkCalls:7,ttsCalls:5,gpuSubmissions:6});
export const AI_QA_SIX_AUTHORIZATION=Object.freeze({userMessageId:'01a10672-0761-7b81-a27a-e5b56ac94b76',
  answerSha256:'32901a48a0deeee610b880147dd5259b305554bffab715e71676fe0988d4434e',
  firstClosedRecordCount:21,firstClosedJournalSha256:'6cd7efa091f1769bec9034b37d14c4a396fb1ce85aa22c160502683d0b982e47'});
export const aiQaWindowClosed=s=>s.windowClosed??s.closed;
export const aiQaNextWindowCounts=s=>Object.fromEntries(Object.entries(s.counts).map(([k,v])=>[k,v+1]));
export const sha256=v=>createHash('sha256').update(v).digest('hex');
export const aiQaNeed=(v,code)=>{if(!v)throw Object.assign(Error(code),{code,safeCode:code,statusCode:503});};
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const int=v=>Number.isSafeInteger(v)&&v>=0;
const sameCounts=(a,b)=>a&&Object.keys(b).every(k=>a[k]===b[k])&&Object.keys(a).length===Object.keys(b).length;
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const prefix='bounded-ai-qa-';

// Historical bytes, their authority and reservation are immutable. A manually
// approved continuation adds one window while retaining all cumulative counters.
export function inspectAiQaRecords(raws,{original=AI_QA_ORIGINAL}={}){
  aiQaNeed(Array.isArray(raws)&&raws.length>=2&&raws.length<=1000,'ai_qa_original_journal_required');
  let previous=null,at=0,exception=null,activeWindow=null,continuation=null,closed=false,windowClosed=false;
  const additionalWindows=[],closedWindows=[];let firstClosedHead=null;
  const dispatches=new Map(),counts={generation:0,sdk:0,tts:0,gpu:0};
  const records=raws.map((bytes,sequence)=>{
    let r;try{r=JSON.parse(bytes);}catch{aiQaNeed(false,'ai_qa_journal_invalid');}
    aiQaNeed(r.format==='native-p6-total-budget-event-v1'&&r.sequence===sequence&&r.previousSha256===previous
      &&r.approvalRawSha256===original.anchorSha256&&int(r.atMs)&&r.atMs>=at,'ai_qa_journal_chain_changed');
    const digest=sha256(bytes);previous=digest;at=r.atMs;
    if(sequence<2){
      aiQaNeed(digest===original.records[sequence]&&r.authoritySourceSha256===original.authoritySha256,'ai_qa_original_records_changed');
      if(sequence===0)aiQaNeed(r.event.kind==='short-text-probe'&&r.event.campaignId===original.campaignId
        &&r.event.upperBoundMicroUsd===original.retainedMicroUsd,'ai_qa_original_reservation_changed');
      else aiQaNeed(r.event.kind==='short-text-probe-outcome'&&r.event.outcome==='response-observed','ai_qa_original_outcome_unresolved');
    }else{
      const e=r.event;
      aiQaNeed(e?.kind?.startsWith(prefix)&&e.campaignId===original.campaignId&&hash(e.manifestSha256)
        &&hash(r.authoritySourceSha256),'ai_qa_extension_invalid');
      if(e.kind===prefix+'tariff-exception'){
        aiQaNeed(!exception&&sequence===2&&e.reserveMicroUsd===original.remainingMicroUsd
          &&e.originalRetainedMicroUsd===original.retainedMicroUsd&&e.actualCostUsd===null
          &&e.automaticRetry===false&&e.gpuWorkers===1&&e.generations===2
          &&int(e.expiresAtMs)&&e.expiresAtMs>r.atMs&&e.expiresAtMs-r.atMs<=AI_QA_LIMITS.lifetimeMs,
          'ai_qa_exception_invalid');
        exception={...e,authoritySourceSha256:r.authoritySourceSha256};
        activeWindow={...exception,continuation:false};
      }else if(e.kind===prefix+'continuation'){
        aiQaNeed(exception&&!continuation&&!closed&&r.atMs>=activeWindow.expiresAtMs
          &&sameCounts(counts,AI_QA_CONTINUATION_COUNTS)
          &&[...dispatches.values()].every(d=>d.outcome==='response-observed'),'ai_qa_continuation_not_drained');
        aiQaNeed(e.predecessorRecordCount===sequence&&e.predecessorJournalSha256===r.previousSha256
          &&e.previousManifestSha256===activeWindow.manifestSha256
          &&e.previousAuthoritySourceSha256===activeWindow.authoritySourceSha256
          &&e.previousRunId===activeWindow.runId&&e.previousExpectedSha===activeWindow.expectedSha
          &&e.manifestSha256!==activeWindow.manifestSha256&&hash(e.rootReviewedIntentSha256)&&hash(e.preflightSha256)
          &&hash(e.streamRequestIdSha256)&&/^[a-f0-9]{40}$/.test(e.expectedSha??'')
          &&/^[a-f0-9-]{36}$/.test(e.runId??'')&&e.runId!==activeWindow.runId
          &&int(e.expiresAtMs)&&e.expiresAtMs>r.atMs&&e.expiresAtMs-r.atMs<=AI_QA_LIMITS.lifetimeMs
          &&equal(e.limits,AI_QA_LIMITS)&&sameCounts(e.remaining,AI_QA_CONTINUATION_REMAINING)
          &&e.automaticRetry===false&&e.extraReserveMicroUsd===0&&e.refundMicroUsd===0&&e.actualCostUsd===null,
          'ai_qa_continuation_binding_changed');
        continuation={...e,authoritySourceSha256:r.authoritySourceSha256};
        activeWindow={...continuation,continuation:true};
      }else if(e.kind===prefix+'additional-window'){
        const cap={generation:6,sdk:7,tts:5,gpu:6};
        aiQaNeed(exception&&closed&&windowClosed&&r.atMs>=activeWindow.expiresAtMs
          &&sequence>=21&&firstClosedHead===(original.closedJournalSha256??AI_QA_SIX_AUTHORIZATION.firstClosedJournalSha256)
          &&[...dispatches.values()].every(d=>d.outcome==='response-observed')
          &&counts.generation<6,'ai_qa_additional_predecessor_not_closed');
        aiQaNeed(e.predecessorRecordCount===sequence&&e.predecessorJournalSha256===r.previousSha256
          &&e.previousManifestSha256===activeWindow.manifestSha256&&e.previousAuthoritySourceSha256===activeWindow.authoritySourceSha256
          &&e.previousRunId===activeWindow.runId&&e.previousExpectedSha===activeWindow.expectedSha
          &&e.manifestSha256!==activeWindow.manifestSha256&&hash(e.rootReviewedIntentSha256)&&hash(e.preflightSha256)
          &&hash(e.streamRequestIdSha256)&&/^[a-f0-9]{40}$/.test(e.expectedSha??'')&&/^[a-f0-9-]{36}$/.test(e.runId??'')
          &&e.runId!==activeWindow.runId&&int(e.expiresAtMs)&&e.expiresAtMs>r.atMs&&e.expiresAtMs-r.atMs<=AI_QA_LIMITS.lifetimeMs
          &&equal(e.limits,AI_QA_SIX_LIMITS)&&equal(e.humanAuthorization,AI_QA_SIX_AUTHORIZATION)
          &&sameCounts(e.previousCounts,counts)&&sameCounts(e.limitCounts,aiQaNextWindowCounts({counts}))
          &&Object.keys(cap).every(k=>e.limitCounts[k]<=cap[k])&&e.globalRemainingGenerations===6-counts.generation
          &&e.windowGenerations===1&&e.streamOnly===true&&e.automaticRetry===false
          &&e.extraReserveMicroUsd===0&&e.refundMicroUsd===0&&e.actualCostUsd===null,'ai_qa_additional_binding_changed');
        activeWindow={...e,authoritySourceSha256:r.authoritySourceSha256,additional:true};additionalWindows.push(activeWindow);
        windowClosed=false; // The historical closed flag and closed-window receipts stay immutable.
      }else{
        aiQaNeed(exception&&e.manifestSha256===activeWindow.manifestSha256&&r.authoritySourceSha256===activeWindow.authoritySourceSha256,
          'ai_qa_extension_binding_changed');
        if(e.kind===prefix+'dispatch'){
          aiQaNeed(!windowClosed&&r.atMs<activeWindow.expiresAtMs&&Object.hasOwn(counts,e.resource)
            &&hash(e.operationSha256)&&!dispatches.has(e.operationSha256),'ai_qa_retry_or_expired');
          counts[e.resource]++;
          const max=activeWindow.additional?activeWindow.limitCounts:{generation:2,sdk:3,tts:2,gpu:2};
          aiQaNeed(counts[e.resource]<=max[e.resource],'ai_qa_dispatch_limit');
          aiQaNeed(![...dispatches.values()].some(x=>x.resource!=='generation'&&!x.outcome),'ai_qa_pending_dispatch');
          dispatches.set(e.operationSha256,{...e,outcome:null});
        }else if(e.kind===prefix+'outcome'){
          const d=dispatches.get(e.operationSha256);
          aiQaNeed(d&&!d.outcome&&['response-observed','uncertain','cancelled'].includes(e.outcome)
            &&e.actualCostUsd===null,'ai_qa_outcome_invalid');
          d.outcome=e.outcome;d.measurements=e.measurements;
          if(e.outcome==='uncertain'){closed=true;windowClosed=true;}
        }else if(e.kind===prefix+'closed'){
          aiQaNeed(!windowClosed&&e.actualCostUsd===null,'ai_qa_closed_invalid');closed=true;windowClosed=true;
          closedWindows.push({runId:activeWindow.runId,manifestSha256:activeWindow.manifestSha256,recordCount:sequence+1,journalSha256:digest,atMs:r.atMs});
          if(sequence===20)firstClosedHead=digest;
        }else aiQaNeed(false,'ai_qa_unknown_event');
      }
    }
    return{sequence,rawSha256:digest,kind:r.event.kind};
  });
  return{records,previousSha256:previous,lastAtMs:at,exception,activeWindow,continuation,closed,windowClosed,closedWindows,additionalWindows,counts,
    unresolved:[...dispatches.values()].filter(x=>x.resource!=='generation'&&!x.outcome).length,
    dispatches:[...dispatches.values()],capMicroUsd:original.capMicroUsd,
    retainedMicroUsd:original.retainedMicroUsd,totalEncumberedMicroUsd:exception?original.capMicroUsd:original.retainedMicroUsd,
    unencumberedMicroUsd:exception?0:original.remainingMicroUsd,refundMicroUsd:0,actualCostUsd:null};
}
export async function createAiQaBudget({directory,anchorPath,manifest,manifestRawSha256,
  authoritySourceSha256,now=Date.now,original=AI_QA_ORIGINAL,appendOpen=open}={}){
  aiQaNeed(hash(manifestRawSha256)&&hash(authoritySourceSha256)&&manifest.campaignId===original.campaignId,
    'ai_qa_budget_binding_required');
  aiQaNeed(sha256(await readFile(anchorPath))===original.anchorSha256,'ai_qa_original_anchor_changed');
  async function transaction(work,{allowContinuation=false}={}){
    const info=await lstat(directory);
    aiQaNeed(info.isDirectory()&&!info.isSymbolicLink()&&(process.platform==='win32'?resolve(await realpath(directory)).toLowerCase()===resolve(directory).toLowerCase():await realpath(directory)===directory),'ai_qa_original_directory_required');
    const lock=join(directory,'write.lock');
    await mkdir(lock,{mode:0o700}).catch(()=>aiQaNeed(false,'ai_qa_budget_locked'));
    let certain=true;
    try{
      aiQaNeed(sha256(await readFile(anchorPath))===original.anchorSha256,'ai_qa_original_anchor_changed');
      const names=(await readdir(directory)).filter(n=>n!=='write.lock').sort();
      aiQaNeed(names.every((n,i)=>n===String(i).padStart(6,'0')+'.json'),'ai_qa_journal_sequence');
      const raws=await Promise.all(names.map(n=>readFile(join(directory,n))));
      let state=inspectAiQaRecords(raws,{original});
      if(state.exception&&!allowContinuation)aiQaNeed(state.activeWindow.manifestSha256===manifestRawSha256
        &&state.activeWindow.authoritySourceSha256===authoritySourceSha256,'ai_qa_existing_run_changed');
      async function append(event){
        const atMs=now();aiQaNeed(int(atMs)&&atMs>=state.lastAtMs,'ai_qa_clock_regressed');
        const record={format:'native-p6-total-budget-event-v1',sequence:state.records.length,previousSha256:state.previousSha256,
          approvalRawSha256:original.anchorSha256,authoritySourceSha256,atMs,
          event:{...event,campaignId:original.campaignId,manifestSha256:manifestRawSha256}};
        const bytes=JSON.stringify(record),next=inspectAiQaRecords([...raws,bytes],{original});
        certain=false;
        const f=await appendOpen(join(directory,String(record.sequence).padStart(6,'0')+'.json'),'wx',0o600);
        try{await f.writeFile(bytes);await f.sync();}finally{await f.close();}
        if(process.platform==='linux'){const d=await open(directory,'r');try{await d.sync();}finally{await d.close();}}
        certain=true;raws.push(bytes);state=next;return state;
      }
      return await work(state,append);
    }finally{if(certain)await rmdir(lock);}
  }
  return Object.freeze({
    inspect:()=>transaction(s=>s),
    activate:()=>transaction(async(s,append)=>{
      aiQaNeed(!manifest.continuation&&now()<manifest.expiresAtMs&&!s.closed,'ai_qa_manifest_expired');
      if(s.exception)return s;
      return append({kind:prefix+'tariff-exception',reserveMicroUsd:original.remainingMicroUsd,
        originalRetainedMicroUsd:original.retainedMicroUsd,actualCostUsd:null,priceEvidence:'account-tariffs-backlog',
        authority:'direct-human-bounded-functional-test',generations:2,gpuWorkers:1,automaticRetry:false,
        expiresAtMs:manifest.expiresAtMs,expectedSha:manifest.expectedSha,runId:manifest.runId});
    }),
    continueOnce:({approvedIntentSha256,preflightSha256}={})=>transaction((s,append)=>{
      const c=manifest.continuation;
      aiQaNeed(c&&hash(approvedIntentSha256)&&c.rootReviewedIntentSha256===approvedIntentSha256
        &&hash(preflightSha256)&&c.preflightSha256===preflightSha256,'ai_qa_manual_continuation_required');
      aiQaNeed(s.previousSha256===c.predecessorJournalSha256&&s.records.length===c.predecessorRecordCount,
        'ai_qa_continuation_cas_changed');
      return append({...c,kind:prefix+'continuation',expectedSha:manifest.expectedSha,runId:manifest.runId,
        expiresAtMs:manifest.expiresAtMs,limits:AI_QA_LIMITS,remaining:AI_QA_CONTINUATION_REMAINING,
        automaticRetry:false,extraReserveMicroUsd:0,refundMicroUsd:0,actualCostUsd:null});
    },{allowContinuation:true}),
    openAdditionalWindow:({approvedIntentSha256,preflightSha256}={})=>transaction((s,append)=>{
      const c=manifest.additionalWindow;
      aiQaNeed(c&&hash(approvedIntentSha256)&&c.rootReviewedIntentSha256===approvedIntentSha256
        &&hash(preflightSha256)&&c.preflightSha256===preflightSha256,'ai_qa_manual_additional_window_required');
      aiQaNeed(s.closed&&aiQaWindowClosed(s)&&s.previousSha256===c.predecessorJournalSha256
        &&s.records.length===c.predecessorRecordCount,'ai_qa_additional_cas_changed');
      return append({...c,kind:prefix+'additional-window',expectedSha:manifest.expectedSha,runId:manifest.runId,
        expiresAtMs:manifest.expiresAtMs,limits:AI_QA_SIX_LIMITS,humanAuthorization:AI_QA_SIX_AUTHORIZATION,
        automaticRetry:false,extraReserveMicroUsd:0,refundMicroUsd:0,actualCostUsd:null});
    },{allowContinuation:true}),
    dispatch:(resource,id,measurements={})=>transaction(async(s,append)=>{
      aiQaNeed(s.exception&&!aiQaWindowClosed(s)&&now()<manifest.expiresAtMs,'ai_qa_active_exception_required');
      // Original operation namespace survives authority/manifest changes.
      const operationSha256=sha256(JSON.stringify([s.exception.manifestSha256,resource,id]));
      await append({kind:prefix+'dispatch',resource,operationSha256,measurements,actualCostUsd:null});
      return operationSha256;
    }),
    outcome:(operationSha256,outcome,measurements={})=>transaction((s,append)=>append({kind:prefix+'outcome',
      operationSha256,outcome,measurements,actualCostUsd:null})),
    close:()=>transaction((s,append)=>aiQaWindowClosed(s)?s:append({kind:prefix+'closed',actualCostUsd:null,refundMicroUsd:0})),
  });
}
