import {RESPONSES,SELECTOR_PROMPT,localResponse,safeModelInput,selectedResponse,POLICY_VERSION,digest} from './dealer-policy.mjs';
export const SYSTEM=SELECTOR_PROMPT;

// The model selects an ID. Provider output is never forwarded to text or speech.
export class Gemini {
 constructor({key,model='gemini-3.5-flash-lite',timeoutMs=12000,audit=()=>{},fetchImpl=fetch}){
  Object.assign(this,{key,model,timeoutMs,audit,fetchImpl});
 }
 async reply({text,onText}){
  const input=safeModelInput(text);
  let id=localResponse(input),decision=id?'local':'model';
  if(!id){
   try{
    const res=await this.fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`,{
     method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':this.key},signal:AbortSignal.timeout(this.timeoutMs),
     body:JSON.stringify({systemInstruction:{parts:[{text:SELECTOR_PROMPT}]},contents:[{role:'user',parts:[{text:input}]}],generationConfig:{maxOutputTokens:20,temperature:0}}),
    });
    if(!res.ok)throw new Error('Provider unavailable');
    const data=await res.json(),raw=data.candidates?.[0]?.content?.parts?.map(p=>p.text??'').join('');
    id=selectedResponse(raw);if(id==='fallback')decision='safe_fallback';
   }catch{id='fallback';decision='provider_failure';}
  }
  const reply=RESPONSES[id];
  this.audit({event:'dealer_reply',decision,responseId:id,policy:POLICY_VERSION,model:this.model,inputHash:digest(input),outputHash:digest(reply)});
  onText?.(reply);return reply;
 }
}
// Kept for existing integrations importing the plain-text normalizer.
export const clean=s=>String(s).replace(/[*_#`"“”]/g,'').replace(/\s+/g,' ').trim();
