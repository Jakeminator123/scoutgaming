'use client';
import {BACKGROUND_EVENT_IDS,defaultBackgroundRule,type BackgroundPlaybackPolicy,type BackgroundPlaybackRule} from '../../packages/presentation/contracts/background-playback-policy.mjs';
import type {LayerAsset} from '../../packages/presentation/contracts/studio-model.mjs';

const eventLabels=new Map([
  ['speak.blackjack','Spelaren får blackjack'],['speak.win','Spelaren vinner'],['speak.dealerblackjack','Dealern får blackjack'],
  ['speak.dealerbust','Dealern blir tjock'],['speak.push','Oavgjort'],['speak.lose','Spelaren förlorar'],['speak.sidebet','Sidospel vinner'],
  ['speak.bust','Spelaren blir tjock'],['speak.double','Dubblering'],['speak.insurance','Försäkring'],
  ['speak.goodluck','Spelet börjar'],['speak.placebets','Insatser öppnar'],['speak.greeting','Välkomsthälsning'],
] as const);
const events=BACKGROUND_EVENT_IDS.map(id=>[id,eventLabels.get(id)??id] as const);

export function BackgroundPlaybackEditor({policy,assets,allowed,baseSelected,disabled=false,onChange,onPreview}:{
  policy?:BackgroundPlaybackPolicy;assets:LayerAsset[];allowed:string[];baseSelected:boolean;disabled?:boolean;
  onChange:(policy:BackgroundPlaybackPolicy|undefined)=>void;onPreview:(ruleId:string)=>void;
}){
  const rules=policy?.rules??[],videos=assets.filter(asset=>asset.role==='background'&&asset.contentType.startsWith('video/')&&allowed.includes(asset.id));
  function commit(next:BackgroundPlaybackRule[]){if(!disabled)onChange(next.length?{schemaVersion:1,rules:next}:undefined);}
  function update(id:string,change:(rule:BackgroundPlaybackRule)=>void){const next=structuredClone(rules),rule=next.find(row=>row.id===id);if(rule){change(rule);commit(next);}}
  function add(){
    if(disabled||!baseSelected||!videos.length||rules.length>=16)return;
    let serial=1;while(rules.some(rule=>rule.id===`background-${serial}`))serial++;
    commit([...rules,defaultBackgroundRule(videos[0].id,`background-${serial}`)]);
  }
  function numeric(id:string,key:'maxDurationMs'|'cooldownMs'|'maxPerMinute'|'maxSecondsPerMinute',value:number,min:number,max:number,multiplier=1){
    if(!Number.isFinite(value))return;
    update(id,rule=>{rule[key]=Math.round(Math.min(max,Math.max(min,value)))*multiplier;});
  }
  return <section aria-label="Bakgrundsklipp">
    <h3>Bakgrundsklipp</h3>
    <p>Spela ett ljudlöst klipp vid en spelhändelse eller med ett tidsintervall. Efter klippet återgår bakgrunden till standardbilden eller grundloopen. Dealerns uppspelning fortsätter separat.</p>
    {!baseSelected?<p>Välj och aktivera en standardbakgrund först.</p>:null}
    {!videos.length?<p>Ladda upp MP4 eller WebM och markera videon som tillåten bakgrund för att lägga till ett klipp.</p>:null}
    {rules.map((rule,index)=>{
      const automatic='everyMs' in rule.trigger,available=videos.some(video=>video.id===rule.assetId);
      return <fieldset key={rule.id} disabled={disabled} aria-label={`Bakgrundsklipp ${index+1}`}>
        <legend>Klipp {index+1}</legend>
        <label className="field">Video<select aria-label={`Video för bakgrundsklipp ${index+1}`} value={rule.assetId} onChange={event=>{if(videos.some(video=>video.id===event.target.value))update(rule.id,next=>{next.assetId=event.target.value;});}}>
          {!available?<option value={rule.assetId}>Videon saknas eller är inte tillåten</option>:null}
          {videos.map(video=><option key={video.id} value={video.id}>{video.label}</option>)}
        </select></label>
        <label className="field">Startas av<select aria-label={`Start för bakgrundsklipp ${index+1}`} value={automatic?'automatic':'event'} onChange={event=>update(rule.id,next=>{next.trigger=event.target.value==='event'?{eventId:'speak.goodluck'}:{everyMs:25000};})}>
          <option value="automatic">Automatiskt · tidsintervall</option><option value="event">Spelhändelse</option>
        </select></label>
        {automatic?<label className="field">Spela var (sekunder)<input aria-label={`Intervall för bakgrundsklipp ${index+1}`} type="number" min={5} max={300} step={1} value={'everyMs' in rule.trigger?rule.trigger.everyMs/1000:25} onChange={event=>{const value=event.target.valueAsNumber;if(Number.isFinite(value))update(rule.id,next=>{next.trigger={everyMs:Math.round(Math.min(300,Math.max(5,value)))*1000};});}}/></label>
          :<label className="field">Spelhändelse<select aria-label={`Händelse för bakgrundsklipp ${index+1}`} value={'eventId' in rule.trigger?rule.trigger.eventId:''} onChange={event=>{const id=BACKGROUND_EVENT_IDS.find(id=>id===event.target.value);if(id)update(rule.id,next=>{next.trigger={eventId:id};});}}>{events.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>}
        <details><summary>Gränser för klippet</summary>
          <label className="field">Längsta uppspelning (sekunder)<input aria-label={`Maxlängd för bakgrundsklipp ${index+1}`} type="number" min={1} max={rule.maxSecondsPerMinute} step={1} value={rule.maxDurationMs/1000} onChange={event=>numeric(rule.id,'maxDurationMs',event.target.valueAsNumber,1,rule.maxSecondsPerMinute,1000)}/></label>
          <label className="field">Minsta tid mellan starter (sekunder)<input aria-label={`Minsta tid mellan starter för bakgrundsklipp ${index+1}`} type="number" min={0} max={300} step={1} value={rule.cooldownMs/1000} onChange={event=>numeric(rule.id,'cooldownMs',event.target.valueAsNumber,0,300,1000)}/></label>
          <label className="field">Högst starter per minut<input aria-label={`Starter per minut för bakgrundsklipp ${index+1}`} type="number" min={1} max={12} step={1} value={rule.maxPerMinute} onChange={event=>numeric(rule.id,'maxPerMinute',event.target.valueAsNumber,1,12)}/></label>
          <label className="field">Högst sekunder per minut<input aria-label={`Sekunder per minut för bakgrundsklipp ${index+1}`} type="number" min={Math.ceil(rule.maxDurationMs/1000)} max={60} step={1} value={rule.maxSecondsPerMinute} onChange={event=>numeric(rule.id,'maxSecondsPerMinute',event.target.valueAsNumber,Math.ceil(rule.maxDurationMs/1000),60)}/></label>
        </details>
        <button type="button" className="sg-btn sg-btn-secondary" disabled={disabled||!available||!baseSelected} onClick={()=>{if(!disabled&&available&&baseSelected)onPreview(rule.id);}}>Prova klipp {index+1}</button>{' '}
        <button type="button" className="sg-btn sg-btn-secondary" onClick={()=>commit(rules.filter(row=>row.id!==rule.id))}>Ta bort klipp {index+1}</button>
      </fieldset>;
    })}
    <button type="button" className="sg-btn sg-btn-secondary" disabled={disabled||!baseSelected||!videos.length||rules.length>=16} onClick={add}>Lägg till bakgrundsklipp</button>
    {rules.length>=16?<p>Högst 16 bakgrundsklipp kan styras per sammansättning.</p>:null}
    <p>Prova ändrar bara förhandsvisningen. Spara sammansättningen för att behålla reglerna; publicering görs separat.</p>
  </section>;
}
