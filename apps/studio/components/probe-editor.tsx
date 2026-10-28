'use client';
import { useEffect, useState } from 'react';
import { PROBE_MODELS, PROBE_REASONS, type ProbePolicy } from '../../../packages/presentation/contracts/probe-policy.mjs';
import { probeFixtures, type ProbeFact } from '../../../packages/presentation/contracts/probe-fixtures.mjs';
import { requestJson } from './studio-types';
import type { ActivityDraft } from '../lib/activity-log.mjs';
import styles from './probe-editor.module.css';

type Result={reason:string;choice:{speak:boolean;text:string;memoryIds:string[];topicId:string;reason:string}|null;metrics:Record<string,unknown>;usedMemories:ProbeFact[]};
export function ProbeEditor({policy,onChange,onActivity}:{policy:ProbePolicy;onChange:(policy:ProbePolicy)=>void;onActivity?:(entry:ActivityDraft)=>void}){
  const [caseId,setCaseId]=useState('name');
  const [fixtures,setFixtures]=useState<ReturnType<typeof probeFixtures>>([]);
  const [forgotten,setForgotten]=useState<string[]>([]);
  const [result,setResult]=useState<Result|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [productOrigin,setProductOrigin]=useState<string|null>(null);
  useEffect(()=>{let current=true;requestJson<{origin:string|null}>('/api/inputs/reference').then(data=>{
    if(!data.origin)return;const url=new URL(data.origin);
    if(current && ['localhost','127.0.0.1','[::1]'].includes(url.hostname) && ['http:','https:'].includes(url.protocol))setProductOrigin(url.origin);
  }).catch(()=>{});return()=>{current=false;};},[]);
  useEffect(()=>{setFixtures(probeFixtures());},[]);
  const fixture=fixtures.find(row=>row.id===caseId);
  const edit=(change:Partial<ProbePolicy>)=>{onChange({...policy,...change});setResult(null);};
  async function run(){
    setBusy(true);setError('');setResult(null);
    try{
      const response=await requestJson<Result>('/api/probe',{method:'POST',body:JSON.stringify({caseId,policy,forgotten})});
      setResult(response);
      onActivity?.({source:'config',stage:'decision',status:'completed',title:'AI-småprat vid inaktivitet · textprov',owner:'Astrids talroll',
        reason:PROBE_REASONS[response.reason]??response.reason,data:{caseId,model:policy.model,choice:response.choice,metrics:response.metrics}});
    }catch(cause){setError(cause instanceof Error?cause.message:'Provet misslyckades.');}
    finally{setBusy(false);}
  }
  return <section className={styles.panel} aria-label="AI-småprat vid inaktivitet för Astrid">
    <div><span className="eyebrow">ASTRID · EGNA TALINITIATIV</span><h2>Astrids talinitiativ</h2><p>En kort personlig replik när spelaren är inaktiv och bordet är lugnt. Astrid kan också välja att vara tyst.</p></div>
    <div className={styles.modes} role="group" aria-label="Läge för AI-småprat vid inaktivitet">{([['off','Av'],['text','Textprov'],['automatic','Automatiskt · OpenClaw']] as const).map(([mode,label])=><button type="button" key={mode} aria-pressed={policy.mode===mode} onClick={()=>edit({mode})}>{label}</button>)}</div>
    <div className={styles.grid}>
      <label className="field">Inaktivitet före ett initiativ (sekunder)<input type="number" min={1} max={3600} value={policy.inactivityMs/1000} onChange={e=>edit({inactivityMs:Number(e.target.value)*1000})}/></label>
      <label className="field">Minsta paus mellan initiativ (sekunder)<input type="number" min={1} max={86400} value={policy.cooldownMs/1000} onChange={e=>edit({cooldownMs:Number(e.target.value)*1000})}/></label>
      <label className="field">AI-modell<select value={policy.model} onChange={e=>edit({model:e.target.value as ProbePolicy['model']})}>{PROBE_MODELS.map(model=><option key={model.id} value={model.id}>{model.label}</option>)}</select><small>Samma modell används för Astrids chatt och talinitiativ.</small></label>
    </div>
    <details><summary>Snabbinställning och uppspelningshjälp</summary>
      <button type="button" className="text-button" onClick={()=>edit({mode:'automatic',inactivityMs:5000,cooldownMs:15000,probability:1,maxPerHour:12})}>Snabbt inaktivitetsprov</button>
      <p>Väljer Automatiskt, 5 sekunders inaktivitet, 15 sekunders paus, 100 % sannolikhet och högst 12 initiativ per timme. Spara för att använda värdena i spelet. Du kan också välja en egen väntetid, ned till 1 sekund.</p>
      <p>Tiden anger när Astrid får börja förbereda svaret. Att skapa repliken, rösten och talfilmen tar ytterligare tid. Ha spelfliken synlig, ljudet på och Tillåt Astrids egna talinitiativ ikryssat under Minne. Efter ett obesvarat initiativ väntar hon tills du blir aktiv igen; hon kan även välja tystnad om ett lämpligt minne saknas.</p>
    </details>
    <details><summary>Avancerat · urval och minne</summary><div className={styles.grid}>
      <label className="field">Sannolikhet per tillfälle (%)<input type="number" min={0} max={100} value={Math.round(policy.probability*100)} onChange={e=>edit({probability:Number(e.target.value)/100})}/></label>
      <label className="field">Högst initiativ per timme<input type="number" min={1} max={12} value={policy.maxPerHour} onChange={e=>edit({maxPerHour:Number(e.target.value)})}/></label>
      <label className="field">Paus för samma anekdot (dagar)<input type="number" min={1} max={30} value={policy.anecdoteCooldownDays} onChange={e=>edit({anecdoteCooldownDays:Number(e.target.value)})}/></label>
      <label className="field">Minnets livslängd (dagar)<input type="number" min={1} max={30} value={policy.memoryDays} onChange={e=>edit({memoryDays:Number(e.target.value)})}/></label>
      <label className="field">Högst sparade fakta<input type="number" min={1} max={20} value={policy.maxFacts} onChange={e=>edit({maxFacts:Number(e.target.value)})}/></label>
      <label><input type="checkbox" checked={policy.memoryEnabled} onChange={e=>edit({memoryEnabled:e.target.checked})}/> Använd belagda långtidsminnen</label>
    </div><p>Högst ett obesvarat initiativ tills spelaren blir aktiv igen. Korttidsminnet rymmer 30 meddelanden, totalt högst 8 000 tecken.</p><p>Reasoning använder Gatewayns nivå. Installerad version 2026.9.5 stöder modellval per anrop, men saknar HTTP-stöd för att välja reasoning-nivå.</p></details>
    <details className={styles.trial}><summary>Prova text och tal</summary><p>Textprovet använder syntetiska spelare. Det skapar varken röst eller video.</p>
      <label className="field">Spelarkontext<select value={caseId} onChange={e=>{setCaseId(e.target.value);setForgotten([]);setResult(null);}}>{fixtures.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}</select></label>
      <button type="button" className="primary-button" disabled={busy||policy.mode==='off'} onClick={()=>void run()}>{busy?'Astrid funderar…':'Prova text'}</button>
      {policy.mode==='off'?<p>Välj Textprov för att prova repliker.</p>:null}
      {error?<p role="alert" className="feedback error">{error}</p>:null}
      <div aria-live="polite"><h3>Senaste beslut</h3><p>{result?.choice?.speak ? 'Textförslag klart · inte uppspelat' : result ? PROBE_REASONS[result.reason]??'Astrid valde tystnad' : 'Inget textprov gjort ännu'}</p>{result?.choice?.speak?<blockquote>{result.choice.text}</blockquote>:null}</div>
      <h3>Källminnen i provet</h3>{fixture?.context.memories.filter(row=>!forgotten.includes(row.id)).length ? <ul>{fixture.context.memories.filter(row=>!forgotten.includes(row.id)).map(fact=><li key={fact.id}><strong>{fact.type==='hand'?'Avslutade serverhänder':'Spelarens uppgift'}</strong><p>{fact.content}</p><small>Källa: {String(fact.source.messageId??fact.source.kind)} · {new Date(fact.createdAt).toLocaleDateString('sv-SE')} · utgår {new Date(fact.expiresAt).toLocaleDateString('sv-SE')}{result?.usedMemories.some(row=>row.id===fact.id)?' · Använd i repliken':''}</small><button type="button" className="text-button" onClick={()=>{setForgotten([...forgotten,fact.id]);setResult(null);}}>Glöm i detta prov</button></li>)}</ul>:<p>Inga anekdoter i denna provkontext.</p>}
      <p>Spelarens riktiga minnen och ”Glöm” finns under Minne i den anslutna spelfliken.</p>
      {productOrigin?<a className="text-button" href={`${productOrigin}/?dealer=astrid&presentation=local&rehearsal=1&probeCase=${encodeURIComponent(caseId)}&probeModel=${encodeURIComponent(policy.model)}`} target="_blank" rel="noreferrer">Öppna separat talprov i Astrids spelare ↗</a>:<p>Anslut ett lokalt referensspel för att öppna det separata talprovet.</p>}
      <details><summary>Modellbeslut och mätvärden</summary><pre>{JSON.stringify(result??{},null,2)}</pre><p>Ett textbeslut är inget uppspelningskvitto. Talprov kräver ett uttryckligt knapptryck i spelfliken och använder Victoria samt den vanliga läppsynkvägen.</p></details>
    </details>
    <p>Spara för att använda inställningarna i spelet. Spelaren behöver också tillåta egna talinitiativ.</p>
  </section>;
}
