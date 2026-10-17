// Only synthetic fixtures; never reads a player database or generates speech.
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { probeFixtures } from '../packages/presentation/contracts/probe-fixtures.mjs';
import { requestProductProbe, PROBE_MODEL_IDS } from '../packages/director/product-probe.mjs';
import { readSettings } from '../lab/lib/director-settings.mjs';

const output=process.argv[process.argv.indexOf('--output')+1];
if(!process.argv.includes('--output')||!output)throw new Error('Use --output <synthetic-results.json>.');
const settings=readSettings({envFiles:[resolve('.env'),resolve('lab/.env.local')]});
const fixtures=probeFixtures(),results=[];
let blocked=null;
if(settings.remoteUrl && settings.remoteToken){
  try {
    const response=await fetch(new URL('/api/status',settings.remoteUrl),{headers:{Authorization:`Bearer ${settings.remoteToken}`},redirect:'error',signal:AbortSignal.timeout(10000)});
    if(response.ok && !(await response.json()).capabilities?.includes('product-probe-v1'))blocked='probe_relay_needs_deployment';
  }catch{blocked='probe_status_unreachable';}
}
for(const model of PROBE_MODEL_IDS.filter(id=>id!=='gateway-default')){
  if(blocked)break;
  for(const [index,fixture] of fixtures.entries()){
    try{
      const result=await requestProductProbe({version:1,requestId:randomUUID(),purpose:'probe',model,reasoning:'gateway-default',context:fixture.context},settings);
      results.push({model,caseId:fixture.id,expected:fixture.expected,firstRequest:index===0,...result});
      console.log(`${model} ${fixture.id}: ${result.choice.speak?'speech text':'silence'} (${result.metrics?.modelMs??'?'} ms)`);
    }catch(error){
      const code=error.code??'probe_unavailable';
      results.push({model,caseId:fixture.id,error:code});
      console.error(`${model} ${fixture.id}: ${code}`);
      // A rejected model answer is a measured failure, not a reason to hide
      // the remaining candidates. Never retry a generation automatically.
      if(['probe_http_401','probe_http_403','probe_relay_needs_deployment','probe_unreachable'].includes(code)){blocked=code;break;}
    }
  }
  if(blocked)break;
}
const quantile=(rows,q)=>rows.length?rows.toSorted((a,b)=>a-b)[Math.min(rows.length-1,Math.ceil(rows.length*q)-1)]:null;
const summary=PROBE_MODEL_IDS.filter(id=>id!=='gateway-default').map(model=>{
  const rows=results.filter(row=>row.model===model && row.metrics),warm=rows.filter(row=>!row.firstRequest && row.metrics.modelMs>0).map(row=>row.metrics.modelMs);
  return {model,completed:rows.length,failed:results.filter(row=>row.model===model&&row.error).length,firstRequestMs:rows.find(row=>row.firstRequest)?.metrics.modelMs??null,p50Ms:quantile(warm,.5),p95Ms:quantile(warm,.95),
    unexpectedSpeech:rows.filter(row=>row.expected==='silence'&&row.choice.speak).length};
});
await writeFile(resolve(output),JSON.stringify({at:new Date().toISOString(),scope:'synthetic-text-only',blocked,summary,results,
  limitations:['Small sample; manually assess grounding and naturalness.','Requested model is not proof of loaded Gateway configuration.','Gateway reasoning default; no claim of none/low.','Token usage and billed cost unavailable from this relay.','First request is measured separately; not guaranteed to be a true provider cold start.']},null,2)+'\n');
if(blocked){console.error(`Comparison blocked: ${blocked}`);process.exitCode=1;}
