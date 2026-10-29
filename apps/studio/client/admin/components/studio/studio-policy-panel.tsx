"use client"

import { useEffect, useRef, useState } from 'react';
import type { StudioProject, MediaVariantPolicy } from '../../../../../../packages/presentation/contracts/studio-model.mjs';
import type { IdlePolicy, IdleVariantPolicy, IdleVariantUse, IdleAutomaticPolicy } from '../../../../../../packages/presentation/runtime/idle-policy.mjs';
import { readIdleVideoDuration } from '../../../../lib/idle-video-duration.mjs';
import { selectionFor } from '../../../../../../packages/presentation/contracts/video-intake.mjs';
import type { VideoInventory, ClipSlot } from '../../lib/connected-studio.mjs';
import { addStudioIdleClip, applyStudioIdlePolicy, applyStudioVariantPolicy, setStudioBaseWeight, studioPolicyContext, studioClipUsage, applyStudioIdleEventRule, applyStudioIdleVariantPolicy, studioIdleEventRule, prepareStudioIdleRotation, savedIdleRotationSelection, keepIdleRotationChoices, IDLE_DESCRIPTION_MAX, IDLE_EVENT_RULES, type StudioPolicyContext } from '../../lib/studio-policy.mjs';
import type { PreparedIdleRotationClip } from '../../../../lib/idle-rotation-sources.mjs';
import { Field, Input, Switch } from '../ui/form';

export type StudioPolicyPanelProps = {
  project:StudioProject; inventory:VideoInventory; dealerId:string; slot:ClipSlot; selectedVideoId?:string; selectedVariantId?:string; blocked:boolean;
  onEdit:(project:StudioProject)=>void; onBusyChange?:(busy:boolean)=>void;
};
// The four ways a silent behaviour clip can start. Labels match the user guide.
export const IDLE_USES:readonly {id:IdleVariantUse;label:string;hint:string}[]=Object.freeze([
  {id:'manual',label:'Av',hint:'Spelas bara vid manuellt prov. Grundloopen fortsätter.'},
  {id:'automatic',label:'Ibland · intervall',hint:'Startar av sig själv med jämna mellanrum medan dealern väntar, och återgår sedan till grundloopen.'},
  {id:'rules',label:'Vid spelhändelse',hint:'Startar efter en vald spelhändelse när rummet kör klippvalsläget Regler.'},
  {id:'openclaw',label:'OpenClaw',hint:'OpenClaw får välja klippet vid tur, resultat eller chatt när scenmallens vila står på OpenClaw. Beskriv vad klippet visar.'},
]);
const automatic:IdleAutomaticPolicy={averageEveryMs:25000,jitterMs:5000,cooldownMs:15000,maxPerMinute:3};
const seconds=(ms:number)=>(ms/1000).toLocaleString('sv-SE',{maximumFractionDigits:1});
export function scheduleSummary(a:IdleAutomaticPolicy) {
  const every=a.averageEveryMs%1000===0?`var ${a.averageEveryMs/1000}:e sekund`:`var ${seconds(a.averageEveryMs)} sekund`;
  const jitter=a.jitterMs>0?`, ± ${seconds(a.jitterMs)} s`:'';
  const pause=a.cooldownMs>0?`Minst ${seconds(a.cooldownMs)} s paus och högst`:'Högst';
  return `Spelas i snitt ${every}${jitter}. ${pause} ${a.maxPerMinute} ${a.maxPerMinute===1?'gång':'gånger'} per minut. Spelhändelser kan skjuta upp starten.`;
}
// Pose, phase and kind of one clip in the dealer's frozen idle source.
export function rotationClipText(row:PreparedIdleRotationClip) {
  const pose=row.from===row.to?(row.from==='clasped'?'knäppta händer':'vila'):row.to==='clasped'?'vila → knäppta händer':'knäppta händer → vila';
  const phase=row.phase==='bets'?' · insatsfas':row.phase==='decide'?' · spelarens beslut':'';
  return pose+phase+(row.baseline?' · basklipp':row.head?' · huvudrörelse':row.calm?' · lugn':'');
}

export function StudioPolicyPanel(props:StudioPolicyPanelProps) {
  const {project,inventory,dealerId,slot,selectedVideoId,selectedVariantId,blocked,onEdit,onBusyChange}=props;
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[addId,setAddId]=useState(''),[selected,setSelected]=useState(''),[excluded,setExcluded]=useState<string[]>([]);
  const operation=useRef<AbortController|null>(null), latest=useRef(props), busyCallback=useRef(onBusyChange);
  latest.current=props;busyCallback.current=onBusyChange;
  useEffect(()=>{
    setError('');setBusy(false);setAddId('');setSelected('');setExcluded([]);
    return ()=>{operation.current?.abort();operation.current=null;busyCallback.current?.(false);};
  },[dealerId,slot.id,selectedVideoId,selectedVariantId]);
  useEffect(()=>()=>{operation.current?.abort();busyCallback.current?.(false);},[]);
  let scope:StudioPolicyContext|null=null, scopeError='';
  try{scope=studioPolicyContext(project,inventory,dealerId,slot);}catch(cause){scopeError=cause instanceof Error?cause.message:'Kortplatsen kan inte redigeras.';}
  const locked=blocked||busy;
  const label=(id:string)=>project.clipLabels?.[id]||scope?.clips.find(video=>video.id===id)?.label||`Saknat klipp · ${id.slice(0,8)}`;
  function edit(action:()=>StudioProject){if(locked)return;try{const next=action();setError('');onEdit(next);}catch(cause){setError(cause instanceof Error?cause.message:'Inställningen kunde inte ändras.');}}
  function idle(policy:IdlePolicy){edit(()=>applyStudioIdlePolicy(project,inventory,dealerId,slot,policy));}
  async function add(asBase:boolean){
    if(locked||operation.current||!scope||scope.kind!=='idle')return;
    const video=scope.clips.find(row=>row.id===addId);if(!video)return;
    const original=latest.current, videoSignature=JSON.stringify(video), projectSignature=JSON.stringify(project), controller=new AbortController();operation.current=controller;
    setBusy(true);setError('');onBusyChange?.(true);
    try{
      const durationMs=await readIdleVideoDuration(video.previewUrl,{signal:controller.signal});
      const current=latest.current;
      if(controller.signal.aborted||current.blocked||current.project!==original.project||current.inventory!==original.inventory
        ||current.dealerId!==original.dealerId||current.slot.id!==original.slot.id||JSON.stringify(current.project)!==projectSignature
        ||JSON.stringify(current.inventory.videos.find(row=>row.id===video.id))!==videoSignature)return;
      const next=addStudioIdleClip(current.project,current.inventory,current.dealerId,current.slot,video.id,durationMs,asBase);
      current.onEdit(next);setAddId('');
    }catch(cause){if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:'Klipplängden kunde inte läsas.');}
    finally{if(operation.current===controller){operation.current=null;setBusy(false);busyCallback.current?.(false);}}
  }
  const policy=scope?.policy;
  // The whole source with each clip's status; a saved sequence keeps its own subset.
  const rotationSource=scope?prepareStudioIdleRotation(project,inventory,dealerId,slot):null;
  const savedRotation=rotationSource&&policy?.rotation?savedIdleRotationSelection(rotationSource,policy):null;
  const rotationSelection=savedRotation?savedRotation.ids:rotationSource?rotationSource.clips.filter(row=>!excluded.includes(row.id)).map(row=>row.id):[];
  const rotationCandidate=rotationSource?prepareStudioIdleRotation(project,inventory,dealerId,slot,rotationSelection):null;
  function toggleRotationClip(id:string,checked:boolean){
    if(locked||!rotationSource)return;
    if(!savedRotation){setExcluded(current=>[...current.filter(row=>row!==id),...checked?[]:[id]]);return;}
    const prepared=prepareStudioIdleRotation(project,inventory,dealerId,slot,checked?[...rotationSelection,id]:rotationSelection.filter(row=>row!==id));
    if(prepared?.policy)idle(keepIdleRotationChoices(prepared.policy,policy));else setError(prepared?.error??'Urvalet kunde inte kopplas.');
  }
  // OpenClaw may also propose a saved sequence clip that starts and ends at rest.
  const rotationRule=(row:PreparedIdleRotationClip)=>savedRotation&&policy?.rotation&&!row.baseline&&row.from==='rest'&&row.to==='rest'
    ?policy.variants.find(item=>item.videoId===row.videoId)??null:null;
  const variantEditFor=(videoId:string)=>(patch:Partial<IdleVariantPolicy>)=>edit(()=>applyStudioIdleVariantPolicy(project,inventory,dealerId,slot,videoId,patch));
  const choices=scope?.family?scope.clips.filter(video=>scope!.family!.variantIds.includes(video.id)).map(video=>({id:video.id,label:label(video.id)}))
    :scope?.line.variants.filter(row=>row.id!==scope!.line.baselineVariantId&&scope!.clips.some(video=>video.id===row.videoGenerationId)).map(row=>({id:row.id,label:row.label}))??[];
  const preferredId=scope?.family?selectedVideoId:scope?.line.variants.find(row=>row.id===selectedVariantId&&row.videoGenerationId===selectedVideoId)?.id
    ??scope?.line.variants.find(row=>row.videoGenerationId===selectedVideoId)?.id;
  const selectedId=choices.some(row=>row.id===selected)?selected:choices.some(row=>row.id===preferredId)?preferredId!:selectedVideoId?'':choices[0]?.id??'';
  const media=scope?.family?project.mediaPolicy?.find(row=>row.familyId===scope!.family!.id)?.variants.find(row=>row.videoId===selectedId)
    ??{videoId:selectedId,selection:{rules:false,model:false,random:false},priority:10,triggerIds:[]}:null;
  const lineVariant=scope?.line.variants.find(row=>row.id===selectedId);
  const variant=media??lineVariant;
  const selection=media?.selection??(lineVariant?selectionFor(lineVariant):{rules:false,model:false,random:false});
  function variantEdit(patch:Partial<Omit<MediaVariantPolicy,'videoId'>>){edit(()=>applyStudioVariantPolicy(project,inventory,dealerId,slot,selectedId,patch));}
  const saved=scope?.family?project.mediaPolicy?.find(row=>row.familyId===scope!.family!.id)?.variants??[]:[];
  const percent=media?.frequencyPercent??0,total=saved.reduce((sum,row)=>sum+(row.frequencyPercent??0),0);
  const unavailableShare=saved.filter(row=>!scope?.clips.some(video=>video.id===row.videoId)).reduce((sum,row)=>sum+(row.frequencyPercent??0),0);
  const activeFrequency=saved.filter(row=>(row.frequencyPercent??0)>0).length;
  const legacyFrequency=Boolean(scope?.frequency&&!saved.some(row=>row.frequencyPercent!==undefined)&&saved.some(row=>Object.values(row.selection).some(Boolean)));
  const addChoices=scope?.clips.filter(video=>!policy||![...policy.base,...policy.variants].some(row=>row.videoId===video.id))??[];
  const baseAllowed=(id:string)=>!scope?.global||Boolean(scope.family?.standardIds.includes(id));
  const variationAllowed=(id:string)=>!scope?.global||Boolean(scope.family?.variantIds.includes(id));
  // Plain-language reading of the saved rule for the chosen variant. Read-only.
  const variantVideoId=scope?.family?selectedId:lineVariant?.videoGenerationId??'';
  const usage=scope&&scope.kind!=='idle'&&variant&&variantVideoId?studioClipUsage(project,inventory,dealerId,slot,variantVideoId,scope.family?undefined:selectedId):null;
  const caption=slot.eventId==='idle.ready'?'Vila (idle)':slot.title;

  return <section aria-label={`Policy för ${slot.title}`} className="studio-policy-panel">
    <header><h2>Körregler · {caption}</h2><p>Ändrar denna situation i projektutkastet. Rummet får ändringen först när utkastet sparas och rummet publiceras. OpenClaw väljer bara bland klipp markerade OpenClaw, och bara när scenmallens vila står på OpenClaw.</p></header>
    {scopeError?<p role="alert" className="studio-policy-error">{scopeError}</p>:scope&&<fieldset disabled={locked} className="studio-policy-body" aria-busy={busy}>
      {scope.kind==='idle'?<>
        {rotationSource&&rotationCandidate&&<section className="studio-policy-section" aria-label="Vilosekvens">
          <h3>Sammanhängande vilosekvens</h3>
          <p>{savedRotation&&policy?.rotation?`${policy.rotation.clips.length} klipp är kopplade i utkastet.`:`Koppla Kevins urval för dealern. Befintliga original återanvänds.`} {rotationSource.matched} av {rotationSource.total} original finns i biblioteket (källa {rotationSource.ref.slice(0,8)}).</p>
          <p>Knäppta händer följer insatsfasen. Händerna mot bordet följer spelarens beslut. Övergångsklipp spelas färdigt före nästa pose. Bocka ur ett klipp för att lämna det utanför sekvensen.</p>
          {savedRotation&&<p>Ett kopplat klipp som börjar och slutar i vila kan också föreslås av OpenClaw vid tur och resultat. Det spelas då en gång och sekvensen fortsätter.</p>}
          <div className="studio-policy-triggers" role="group" aria-label="Klipp i vilosekvensen">{rotationSource.clips.map(row=>{const rule=rotationRule(row);return <div key={row.id} className="grid gap-2">
            <label className="studio-policy-trigger">
              <input type="checkbox" checked={rotationSelection.includes(row.id)} disabled={locked||row.baseline} onChange={event=>toggleRotationClip(row.id,event.target.checked)}/>
              <span><strong>{row.id}</strong> · {rotationClipText(row)}{row.status!=='registered'&&<> · <em>{row.status==='missing'?'saknas i biblioteket':'flera original matchar'}</em></>}</span>
            </label>
            {rule&&<RotationClipRule item={rule} label={row.id} onChange={variantEditFor(rule.videoId)}/>}
          </div>;})}</div>
          {savedRotation&&savedRotation.outside>0&&<p className="studio-policy-warning">{savedRotation.outside} kopplade klipp finns inte i dealerns vilokälla och tas bort när du ändrar urvalet.</p>}
          {rotationCandidate.error&&<p role="alert" className="studio-policy-error">{rotationCandidate.error}</p>}
          {!savedRotation?<button type="button" className="studio-button" disabled={locked||!rotationCandidate.policy} onClick={()=>{if(rotationCandidate.policy)idle(rotationCandidate.policy);}}>Koppla {rotationCandidate.selected} viloklipp</button>
            :<><p>Ändringen når spelet efter Spara utkast och Publicera i spelbordet. Ett spelbord utan Publicera (roulette eller ej öppet) får den via Avancerat › Publicera igen under bolagets tilldelning.</p>
              <div className="studio-policy-actions">
                {savedRotation.outside>0&&<button type="button" className="studio-button" disabled={locked||!rotationCandidate.policy} onClick={()=>{if(rotationCandidate.policy)idle(keepIdleRotationChoices(rotationCandidate.policy,policy));}}>Uppdatera till urvalet</button>}
                <button type="button" className="studio-button" disabled={locked} onClick={()=>{if(!policy)return;const {rotation,...rest}=policy;setExcluded([]);idle({...rest,variants:[]});}}>Återgå till enbart basklippet</button>
              </div></>}
        </section>}
        {!policy?.rotation&&<>
        <section className="studio-policy-section" aria-label="Basloop"><h3>Basloop</h3>
          <p>Loopar hela tiden när inget annat spelas. Flera basklipp turas om enligt sina andelar.</p>
          {policy?policy.base.map((item,index)=><div key={item.videoId} className="studio-policy-clip">
            <div className="studio-policy-clip-head"><strong>{label(item.videoId)}</strong><span>{seconds(item.durationMs)} s</span>
              {index===0?<span className="studio-policy-tag">Huvudklipp</span>:<button type="button" className="studio-policy-link" onClick={()=>idle({...policy,base:[item,...policy.base.filter(row=>row.videoId!==item.videoId)]})}>Gör till huvudklipp</button>}
            </div>
            {policy.base.length>1&&<>
              <Numeric label={`Andel av basloopen (%)`} value={item.weight} min={1} max={100-policy.base.length+1}
                onChange={weight=>{try{idle(setStudioBaseWeight(policy,item.videoId,weight));}catch(cause){setError(cause instanceof Error?cause.message:'Ogiltig andel.');}}}/>
              <button type="button" className="studio-policy-link is-remove" onClick={()=>{
                const base=policy.base.filter(row=>row.videoId!==item.videoId).map(row=>({...row}));base[0].weight+=item.weight;idle({...policy,base});
              }}>Ta bort ur basloopen</button>
            </>}
          </div>):<p className="studio-policy-hint">Välj ett registrerat grundloopsklipp för att skapa schemat.</p>}
        </section>
        <section className="studio-policy-section" aria-label="Beteendeklipp"><h3>Beteendeklipp</h3>
          <p>Korta tysta rörelser som startar från vilan och återgår till den: blickar, nickningar, att klia sig. Klipp med tal hör till Talade repliker.</p>
          {policy&&!policy.variants.length&&<p className="studio-policy-hint">Inga beteendeklipp i schemat ännu.</p>}
          {policy?.variants.map(item=><BehaviourClip key={item.videoId} item={item} label={label(item.videoId)} rule={studioIdleEventRule(project,dealerId,item.videoId)}
            onRule={rule=>edit(()=>applyStudioIdleEventRule(project,inventory,dealerId,slot,item.videoId,rule))}
            onChange={patch=>edit(()=>applyStudioIdleVariantPolicy(project,inventory,dealerId,slot,item.videoId,patch))}
            onRemove={()=>idle({...policy,variants:policy.variants.filter(row=>row.videoId!==item.videoId)})}/>)}
        </section>
        <section className="studio-policy-section" aria-label="Lägg till klipp i schemat"><h3>Lägg till klipp i schemat</h3>
          <label className="studio-field"><span>Registrerat klipp</span><select value={addId} onChange={event=>setAddId(event.target.value)}>
            <option value="">Välj registrerat klipp…</option>{addChoices.map(video=><option key={video.id} value={video.id}>{label(video.id)}</option>)}
          </select></label>
          <div className="studio-policy-actions"><button type="button" className="studio-button" disabled={!addId||!baseAllowed(addId)||(policy?.base.length??0)>=4} onClick={()=>void add(true)}>{busy?'Läser längd…':'Lägg till i basloopen'}</button>
            {policy&&<button type="button" className="studio-button" disabled={!addId||!variationAllowed(addId)} onClick={()=>void add(false)}>Lägg till som beteendeklipp</button>}
          </div><p className="studio-policy-hint">Klippets längd läses från videons metadata. Högst fyra basklipp.</p>
        </section>
        </>}
      </>:<>
        {choices.length?<>
          <label className="studio-field"><span>Variant</span><select value={selectedId} onChange={event=>setSelected(event.target.value)}>{!selectedId&&<option value="">Välj en alternativ tagning…</option>}{choices.map(choice=><option key={choice.id} value={choice.id}>{choice.label}</option>)}</select></label>
          {!selectedId?<p className="studio-policy-hint">Den valda tagningen saknar en redigerbar alternativregel. Standardklippets urval är fast; ett okopplat klipp måste kopplas först.</p>:scope.frequency?<section className="studio-policy-section" aria-label="Frekvens">
            <h3>Hur ofta väljs varianten?</h3>
            {legacyFrequency&&<p className="studio-policy-warning">Första frekvensändringen ersätter det äldre urvalet för just denna plats.</p>}
            <Numeric label="Frekvens (%)" value={percent} min={0} max={percent===0&&activeFrequency>=4?0:100-total+percent} onChange={frequencyPercent=>variantEdit({frequencyPercent})}/>
            <p className="studio-policy-hint">0 % = endast manuellt prov. Högst fyra aktiva varianter.{!legacyFrequency&&` Standardens andel: ${100-total+unavailableShare} %.`}</p>
          </section>:variant?<>
            <section className="studio-policy-section" aria-label="Urval"><h3>Hur väljs varianten?</h3>
              <div className="studio-chip-row">{([['rules','Regler','Väljs när villkoren nedan stämmer.'],['random','Slump','Kan väljas slumpmässigt i stället för standardklippet.'],['model','OpenClaw','OpenClaw får välja varianten utifrån chatt och persona.']] as const).map(([key,title,hint])=><label key={key} className="studio-chip" title={hint}><input type="checkbox" checked={selection[key]} onChange={event=>variantEdit({selection:{...selection,[key]:event.target.checked}})}/>{title}</label>)}</div>
              <p className="studio-policy-hint">Alla av = endast manuellt prov. Standardklippet finns alltid som reserv. Rummets publicerade automatikläge avgör vilket urval som används.</p>
              <button type="button" className="studio-policy-link" onClick={()=>variantEdit({selection:{rules:false,model:false,random:false}})}>Endast manuell</button>
            </section>
            {usage&&<div className="studio-policy-summary" role="status" aria-label="Så används varianten">{usage.rules.map(rule=><p key={rule}>{rule}</p>)}</div>}
            <details className="studio-policy-section studio-policy-details"><summary>Villkor &amp; prioritet</summary>
              <Numeric label="Prioritet" value={variant.priority} min={-100} max={100} onChange={priority=>variantEdit({priority})}/>
              <div className="studio-policy-triggers">{project.triggers.map(trigger=><label key={trigger.id} className="studio-policy-trigger"><input type="checkbox" checked={variant.triggerIds.includes(trigger.id)} onChange={event=>variantEdit({triggerIds:event.target.checked?[...variant.triggerIds,trigger.id]:variant.triggerIds.filter(id=>id!==trigger.id)})}/><span>{trigger.label}</span></label>)}</div>
            </details>
          </>:null}
        </>:<p className="studio-policy-hint">Inga kopplade klippvarianter i detta fack. Standardklippet behåller sitt fasta urval.</p>}
      </>}
    </fieldset>}
    {error&&<p role="alert" className="studio-policy-error">{error}</p>}
  </section>;
}

function Numeric({label,value,min,max,disabled=false,onChange}:{label:string;value:number;min:number;max:number;disabled?:boolean;onChange:(value:number)=>void}){
  return <label className="studio-field"><span>{label}</span><input type="number" value={value} min={min} max={max} step={1} disabled={disabled} onChange={event=>{if(Number.isFinite(event.target.valueAsNumber))onChange(event.target.valueAsNumber);}}/></label>;
}
const SCHEDULE_FIELDS:readonly [keyof IdleAutomaticPolicy,string,number,number][]=[['averageEveryMs','Ungefär var (s)',5,300],['jitterMs','Variation ± (s)',0,60],['cooldownMs','Minsta paus (s)',0,300],['maxPerMinute','Högst per minut',1,12]];
function BehaviourClip({item,label,rule,onRule,onChange,onRemove}:{item:IdleVariantPolicy;label:string;rule:string;onRule:(rule:string)=>void;onChange:(patch:Partial<IdleVariantPolicy>)=>void;onRemove:()=>void}){
  const use=IDLE_USES.find(row=>row.id===item.use)??IDLE_USES[0];
  return <div className="studio-policy-clip">
    <div className="studio-policy-clip-head"><strong>{label}</strong><span>{seconds(item.durationMs)} s</span></div>
    <div className="studio-segmented" role="group" aria-label={`Hur spelas ${label}?`}>
      {IDLE_USES.map(row=><button key={row.id} type="button" aria-pressed={item.use===row.id} onClick={()=>{if(item.use!==row.id)onChange({use:row.id,automatic:row.id==='automatic'?item.automatic??{...automatic}:null});}}>{row.label}</button>)}
    </div>
    <p className="studio-policy-hint">{use.hint}</p>
    {item.use==='openclaw'&&<DescriptionField item={item} label={label} onChange={onChange}/>}
    {item.use==='rules'&&<>
      <label className="studio-field"><span>Spelhändelse</span><select value={rule} onChange={event=>onRule(event.target.value)}>
        {!rule&&<option value="">Egna villkor · välj för att ersätta</option>}
        {IDLE_EVENT_RULES.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}
      </select></label>
      <p className="studio-policy-hint">Väntar tills kort och tal är klara och byter vid viloklippets slut.</p>
    </>}
    {item.use==='automatic'&&item.automatic&&<>
      <div className="studio-schedule">
        {SCHEDULE_FIELDS.map(([key,title,min,max])=><Numeric key={key} label={title} value={key==='maxPerMinute'?item.automatic![key]:item.automatic![key]/1000} min={min} max={max} onChange={value=>onChange({automatic:{...item.automatic!,[key]:key==='maxPerMinute'?value:value*1000}})}/>)}
      </div>
      <p className="studio-policy-summary" role="status">{scheduleSummary(item.automatic)}</p>
    </>}
    <button type="button" className="studio-policy-link is-remove" onClick={onRemove}>Ta bort ur schemat</button>
  </div>;
}
// The text OpenClaw reads when it chooses: what the clip shows, not when to play it.
function DescriptionField({item,label,onChange}:{item:IdleVariantPolicy;label:string;onChange:(patch:Partial<IdleVariantPolicy>)=>void}){
  return <Field label="Vad klippet visar" hint={`Högst ${IDLE_DESCRIPTION_MAX} tecken. OpenClaw väljer klippet utifrån beskrivningen.`}>
    <Input value={item.description??''} maxLength={IDLE_DESCRIPTION_MAX} aria-label={`Vad ${label} visar`} placeholder="Till exempel: ler och nickar mot spelaren"
      onChange={event=>onChange({description:event.target.value})}/>
  </Field>;
}
// Körregel of a saved sequence clip at rest: the sequence only, or also OpenClaw's proposal.
function RotationClipRule({item,label,onChange}:{item:IdleVariantPolicy;label:string;onChange:(patch:Partial<IdleVariantPolicy>)=>void}){
  const openclaw=item.use==='openclaw';
  return <div className="grid gap-2 pl-6">
    <label className="inline-flex items-center gap-2 text-[13px] text-sg-text">
      <Switch checked={openclaw} aria-label={`OpenClaw får föreslå ${label}`} onCheckedChange={checked=>onChange({use:checked?'openclaw':'rotation'})}/>
      OpenClaw får föreslå klippet
    </label>
    {openclaw&&<DescriptionField item={item} label={label} onChange={onChange}/>}
  </div>;
}
