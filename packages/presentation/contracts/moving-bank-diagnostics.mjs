// Internal response metadata: the gateway consumes and strips this header.
// Only finite codes are permitted; messages, tokens, URLs and identities never pass.
import {SPEECH_PREPARATION_FAILURE_CODES} from './chat-response.mjs';
export const MOVING_BANK_DIAGNOSTIC_HEADER='x-croupier-moving-bank-diagnostic';
const stages=new Set(['authorization','read','metadata']);
const codes=new Set([...SPEECH_PREPARATION_FAILURE_CODES,'rejected','aborted','drift_not_admitting','drift_executor_stale',
 'generated_speech_moving_session_inactive','generated_speech_stale_fence',
 'generated_speech_moving_binding_changed','generated_speech_moving_endpoint_mismatch',
 'generated_speech_profile_changed','generated_speech_reference_changed',
 'generated_speech_moving_bank_source_changed','moving_speech_context_changed',
 'moving_speech_publication_changed','moving_speech_bank_source_missing',
 'stale_chat_session','chat_cancelled','studio_scope_mismatch','studio_revision_conflict']);
export function movingBankDiagnostic(stage,error){
 if(!stages.has(stage))return null;
 let code='rejected';
 try{if(codes.has(error?.code))code=error.code;else if(codes.has(error?.message))code=error.message;else if(error?.name==='AbortError')code='aborted';}catch{}
 return stage+':'+code;
}
export function readMovingBankDiagnostic(value){
 if(typeof value!=='string'||value.length>120)return null;
 const [stage,code,...extra]=value.split(':');
 return !extra.length&&stages.has(stage)&&codes.has(code)?{stage,code}:null;
}
