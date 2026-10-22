'use client';
import {BACKGROUND_EVENT_IDS,MAX_PLAYBACK_JITTER_MS,defaultLayerRule,type BackgroundPlaybackPolicy,type BackgroundPlaybackRule,type LayerPlaybackRole} from '../../../packages/presentation/contracts/background-playback-policy.mjs';
import type {LayerAsset} from '../../../packages/presentation/contracts/studio-model.mjs';

const eventLabels=new Map([
  ['speak.blackjack','Spelaren får blackjack'],['speak.win','Spelaren vinner'],['speak.dealerblackjack','Dealern får blackjack'],
  ['speak.dealerbust','Dealern blir tjock'],['speak.push','Oavgjort'],['speak.lose','Spelaren förlorar'],['speak.sidebet','Sidospel vinner'],
  ['speak.bust','Spelaren blir tjock'],['speak.double','Dubblering'],['speak.insurance','Försäkring'],
  ['speak.goodluck','Spelet börjar'],['speak.placebets','Insatser öppnar'],['speak.greeting','Välkomsthälsning'],
] as const);
const events=BACKGROUND_EVENT_IDS.map(id=>[id,eventLabels.get(id)??id] as const);
// Role-specific Swedish copy. The noun doubles as the rule id prefix and aria-label stem.
const texts={
  background:{heading:'Bakgrundsklipp',noun:'bakgrundsklipp',layer:'bakgrunden',base:'Välj och aktivera en standardbakgrund först.',grant:'tillåten bakgrund'},
  table:{heading:'Bordsklipp',noun:'bordsklipp',layer:'bordet',base:'Välj och aktivera ett standardbord först.',grant:'tillåtet bord'},
} as const;
const MIN_EVERY_S=5,MAX_EVERY_S=300,MAX_JITTER_S=MAX_PLAYBACK_JITTER_MS/1000;
const defaults=defaultLayerRule('00000000-0000-4000-8000-000000000000','defaults').trigger as {everyMs:number;jitterMs:number};
// Swedish ordinals: 1:a, 2:a, 21:a … otherwise :e (11:e, 12:e included).
const ordinal=(n:number)=>`${n}:${[1,2].includes(n%10)&&![11,12].includes(n%100)?'a':'e'}`;
// A timer trigger keeps jitter strictly below the interval; zero jitter drops the
// field so older readers without jitter support still accept the policy.
function timerTrigger(everySeconds:number,jitterSeconds:number):{everyMs:number;jitterMs?:number}{
  const everyMs=Math.round(Math.min(MAX_EVERY_S,Math.max(MIN_EVERY_S,everySeconds)))*1000;
  const jitterMs=Math.round(Math.min(MAX_JITTER_S,everyMs/1000-1,Math.max(0,jitterSeconds)))*1000;
  return jitterMs>0?{everyMs,jitterMs}:{everyMs};
}
export function timerSummary(rule:BackgroundPlaybackRule):string{
  if(!('everyMs' in rule.trigger))return '';
  const every=rule.trigger.everyMs/1000,jitter=(rule.trigger.jitterMs??0)/1000;
  return `Spelas ungefär var ${ordinal(every)} sekund${jitter?`, ± ${jitter} s`:''}, högst ${rule.maxPerMinute} ${rule.maxPerMinute===1?'gång':'gånger'} per minut.`;
}

export function LayerPlaybackEditor({role,policy,assets,allowed,baseSelected,disabled=false,onChange,onPreview}:{
  role:LayerPlaybackRole;policy?:BackgroundPlaybackPolicy;assets:LayerAsset[];allowed:string[];baseSelected:boolean;disabled?:boolean;
  onChange:(policy:BackgroundPlaybackPolicy|undefined)=>void;onPreview:(ruleId:string)=>void;
}){
  const copy=texts[role],Noun=copy.heading;
  const rules=policy?.rules??[],videos=assets.filter(asset=>asset.role===role&&asset.contentType.startsWith('video/')&&allowed.includes(asset.id));
  function commit(next:BackgroundPlaybackRule[]){if(!disabled)onChange(next.length?{schemaVersion:1,rules:next}:undefined);}
  function update(id:string,change:(rule:BackgroundPlaybackRule)=>void){const next=structuredClone(rules),rule=next.find(row=>row.id===id);if(rule){change(rule);commit(next);}}
  function add(){
    if(disabled||!baseSelected||!videos.length||rules.length>=16)return;
    let serial=1;while(rules.some(rule=>rule.id===`${role}-${serial}`))serial++;
    commit([...rules,defaultLayerRule(videos[0].id,`${role}-${serial}`,{role})]);
  }
  function numeric(id:string,key:'maxDurationMs'|'cooldownMs'|'maxPerMinute'|'maxSecondsPerMinute',value:number,min:number,max:number,multiplier=1){
    if(!Number.isFinite(value))return;
    update(id,rule=>{rule[key]=Math.round(Math.min(max,Math.max(min,value)))*multiplier;});
  }
  function timer(id:string,everySeconds:number,jitterSeconds:number){
    if(!Number.isFinite(everySeconds)||!Number.isFinite(jitterSeconds))return;
    update(id,rule=>{rule.trigger=timerTrigger(everySeconds,jitterSeconds);});
  }
  return <section aria-label={Noun}>
    <h3>{Noun}</h3>
    <p>Spela ett ljudlöst klipp vid en spelhändelse eller med ett tidsintervall. Efter klippet återgår {copy.layer} till standardbilden eller grundloopen. Dealerns uppspelning fortsätter separat.</p>
    {!baseSelected?<p>{copy.base}</p>:null}
    {!videos.length?<p>Ladda upp MP4 eller WebM och markera videon som {copy.grant} för att lägga till ett klipp.</p>:null}
    {rules.map((rule,index)=>{
      const automatic='everyMs' in rule.trigger,available=videos.some(video=>video.id===rule.assetId);
      const everySeconds='everyMs' in rule.trigger?rule.trigger.everyMs/1000:defaults.everyMs/1000,jitterSeconds='everyMs' in rule.trigger?(rule.trigger.jitterMs??0)/1000:0;
      return <fieldset key={rule.id} disabled={disabled} aria-label={`${Noun} ${index+1}`}>
        <legend>Klipp {index+1}</legend>
        <label className="field">Video<select aria-label={`Video för ${copy.noun} ${index+1}`} value={rule.assetId} onChange={event=>{if(videos.some(video=>video.id===event.target.value))update(rule.id,next=>{next.assetId=event.target.value;});}}>
          {!available?<option value={rule.assetId}>Videon saknas eller är inte tillåten</option>:null}
          {videos.map(video=><option key={video.id} value={video.id}>{video.label}</option>)}
        </select></label>
        <label className="field">Startas av<select aria-label={`Start för ${copy.noun} ${index+1}`} value={automatic?'automatic':'event'} onChange={event=>update(rule.id,next=>{next.trigger=event.target.value==='event'?{eventId:'speak.goodluck'}:{everyMs:defaults.everyMs,jitterMs:defaults.jitterMs};})}>
          <option value="automatic">Automatiskt · tidsintervall</option><option value="event">Spelhändelse</option>
        </select></label>
        {automatic?<>
          <label className="field">Spela var (sekunder)<input aria-label={`Intervall för ${copy.noun} ${index+1}`} type="number" min={MIN_EVERY_S} max={MAX_EVERY_S} step={1} value={everySeconds} onChange={event=>timer(rule.id,event.target.valueAsNumber,jitterSeconds)}/></label>
          <label className="field">Variation ± (sekunder)<input aria-label={`Variation för ${copy.noun} ${index+1}`} type="number" min={0} max={Math.min(MAX_JITTER_S,everySeconds-1)} step={1} value={jitterSeconds} onChange={event=>timer(rule.id,everySeconds,event.target.valueAsNumber)}/></label>
          <p>{timerSummary(rule)}</p>
        </>
          :<label className="field">Spelhändelse<select aria-label={`Händelse för ${copy.noun} ${index+1}`} value={'eventId' in rule.trigger?rule.trigger.eventId:''} onChange={event=>{const id=BACKGROUND_EVENT_IDS.find(id=>id===event.target.value);if(id)update(rule.id,next=>{next.trigger={eventId:id};});}}>{events.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>}
        <details><summary>Gränser för klippet</summary>
          <label className="field">Längsta uppspelning (sekunder)<input aria-label={`Maxlängd för ${copy.noun} ${index+1}`} type="number" min={1} max={rule.maxSecondsPerMinute} step={1} value={rule.maxDurationMs/1000} onChange={event=>numeric(rule.id,'maxDurationMs',event.target.valueAsNumber,1,rule.maxSecondsPerMinute,1000)}/></label>
          <label className="field">Minsta tid mellan starter (sekunder)<input aria-label={`Minsta tid mellan starter för ${copy.noun} ${index+1}`} type="number" min={0} max={300} step={1} value={rule.cooldownMs/1000} onChange={event=>numeric(rule.id,'cooldownMs',event.target.valueAsNumber,0,300,1000)}/></label>
          <label className="field">Högst starter per minut<input aria-label={`Starter per minut för ${copy.noun} ${index+1}`} type="number" min={1} max={12} step={1} value={rule.maxPerMinute} onChange={event=>numeric(rule.id,'maxPerMinute',event.target.valueAsNumber,1,12)}/></label>
          <label className="field">Högst sekunder per minut<input aria-label={`Sekunder per minut för ${copy.noun} ${index+1}`} type="number" min={Math.ceil(rule.maxDurationMs/1000)} max={60} step={1} value={rule.maxSecondsPerMinute} onChange={event=>numeric(rule.id,'maxSecondsPerMinute',event.target.valueAsNumber,Math.ceil(rule.maxDurationMs/1000),60)}/></label>
        </details>
        <button type="button" className="sg-btn sg-btn-secondary" disabled={disabled||!available||!baseSelected} onClick={()=>{if(!disabled&&available&&baseSelected)onPreview(rule.id);}}>Prova klipp {index+1}</button>{' '}
        <button type="button" className="sg-btn sg-btn-secondary" onClick={()=>commit(rules.filter(row=>row.id!==rule.id))}>Ta bort klipp {index+1}</button>
      </fieldset>;
    })}
    <button type="button" className="sg-btn sg-btn-secondary" disabled={disabled||!baseSelected||!videos.length||rules.length>=16} onClick={add}>Lägg till {copy.noun}</button>
    {rules.length>=16?<p>Högst 16 {copy.noun} kan styras per sammansättning.</p>:null}
    <p>Prova ändrar bara förhandsvisningen. Spara sammansättningen för att behålla reglerna; publicering görs separat.</p>
  </section>;
}

// Existing imports keep working: the background editor is the layer editor bound
// to its role. Called directly so the rendered tree is the same as before.
export function BackgroundPlaybackEditor(props:Omit<Parameters<typeof LayerPlaybackEditor>[0],'role'>){
  return LayerPlaybackEditor({role:'background',...props});
}
