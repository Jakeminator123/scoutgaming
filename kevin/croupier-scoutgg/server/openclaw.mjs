import {randomUUID} from 'node:crypto';
import {RESPONSES,localResponse,safeModelInput,POLICY_VERSION,digest} from './dealer-policy.mjs';

// Port of Jakob's separate product-speech envelope, d321e3f5. No engine tools.
export function speechStatus(context={}) {
  return {
    dealerId:'astrid',sessionRevision:String(context.sessionRevision??'0'),roundRevision:String(context.roundRevision??'none'),
    roundPhase:context.phase??'idle',displayName:'Visitor',publishedEvents:[],
    // Deliberately omit cards: a server plan can be ahead of rendered playback.
    visibleCards:{hands:[],dealer:{cards:[],publicTotal:null}},occupiedBoxes:[],
    allowedSpeech:{recordedLines:Object.entries(RESPONSES).map(([lineId,exactText])=>({lineId,exactText,familyId:'reviewed-tts-bank',variantIds:[]})),
      generatedText:false,silence:true,mediaFamilies:[]},
  };
}
export class OpenClaw {
  constructor({url,token,timeoutMs=8000,fetchImpl=fetch,audit=()=>{}}){
    const origin=new URL(url);
    if(origin.protocol!=='https:' && !(origin.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(origin.hostname)))throw Error('OpenClaw requires HTTPS or loopback');
    if(origin.username||origin.password||origin.search||origin.hash||origin.pathname!=='/')throw Error('OpenClaw needs a bare origin');
    if(!token)throw Error('OpenClaw speech token missing');
    Object.assign(this,{url:new URL('/api/product/speech',origin).href,token,timeoutMs,fetchImpl,audit,model:'openclaw/croupier-speech'});
  }
  async reply({text,context,getContext,onText}){
    const input=safeModelInput(text),requestId=randomUUID();
    let id=localResponse(input),decision=id?'local':'openclaw';
    const initial=getContext?.()??context??{};
    const status=speechStatus(initial);
    if(!id){
      try{
        const response=await this.fetchImpl(this.url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(this.timeoutMs),
          headers:{'Content-Type':'application/json',Authorization:`Bearer ${this.token}`},
          body:JSON.stringify({request:{requestId,message:input,history:[]},status})});
        if(!response.ok)throw Error('OpenClaw unavailable');
        const reader=response.body.getReader();let bytes=0,chunks=[];
        try {while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(bytes>16384)throw Error('Oversized choice');chunks.push(Buffer.from(value));}}
        finally{await reader.cancel().catch(()=>{});}
        const choice=JSON.parse(Buffer.concat(chunks).toString('utf8'));
        const keys=['kind','requestId','dealerId','sessionRevision','roundRevision',...(choice.kind==='recordedLine'?['lineId','variantId']:[])];
        if(Object.keys(choice).length!==keys.length||keys.some(k=>!Object.hasOwn(choice,k))||choice.requestId!==requestId||choice.dealerId!=='astrid'||choice.sessionRevision!==status.sessionRevision||choice.roundRevision!==status.roundRevision)throw Error('Invalid choice');
        const current=speechStatus(getContext?.()??initial);
        if(current.sessionRevision!==status.sessionRevision||current.roundRevision!==status.roundRevision){decision='stale_choice';id='fallback';}
        else if(choice.kind==='recordedLine'&&Object.hasOwn(RESPONSES,choice.lineId)&&choice.variantId===null){id=choice.lineId;}
        else if(choice.kind==='silence'){id=null;decision='silence';}
        else throw Error('Disallowed choice');
      }catch{id='fallback';decision='provider_failure';}
    }
    const reply=id?RESPONSES[id]:null;
    this.audit({event:'dealer_reply',decision,responseId:id??'silence',policy:POLICY_VERSION,model:this.model,inputHash:digest(input),outputHash:digest(reply??''),requestId,sessionRevision:status.sessionRevision,roundRevision:status.roundRevision,room:initial.room,roundId:initial.roundId,parent:initial.parent});
    onText?.(reply);return reply;
  }
}
