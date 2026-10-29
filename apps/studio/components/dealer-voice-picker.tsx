'use client';
import {DEALER_VOICE_PRESETS,dealerVoiceDraft,dealerVoicePreset,matchingDealerVoicePreset,suggestedDealerVoicePreset,type DealerVoiceDraft} from '../../../packages/presentation/contracts/dealer-voice-catalog.mjs';

// Pure controlled UI shared by Control and Admin. No account query, effect,
// saved-voice reassignment or generation happens when this panel is opened.
export function DealerVoicePicker({dealer,value,onChange,fieldClass='field'}:{dealer:{id:string;label?:string};value:DealerVoiceDraft;onChange:(value:DealerVoiceDraft)=>void;fieldClass?:string}) {
  const selected=matchingDealerVoicePreset(value),suggested=suggestedDealerVoicePreset(dealer);
  const custom=Boolean(value.provider||value.voiceId||value.modelId)&&!selected;
  const edit=(patch:Partial<DealerVoiceDraft>)=>onChange({...value,...patch});
  const editIdentity=(patch:Partial<DealerVoiceDraft>)=>onChange({...value,customSettings:false,stability:'',similarity:'',style:'',speakerBoost:'',...patch});
  function choose(id:string){
    if(id==='custom'){onChange({...dealerVoiceDraft(null),provider:'elevenlabs'});return;}
    onChange(id?dealerVoiceDraft(dealerVoicePreset(id,/^[a-z]{2}$/.test(value.language)?value.language:'sv')):dealerVoiceDraft(null));
  }
  return <div className="space-y-3" aria-label="Dealerns röst">
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12}}>
      <label className={fieldClass}>Röst<select data-field="voice-preset" value={selected??(custom?'custom':'')} onChange={event=>choose(event.target.value)}>
        <option value="">Välj röst</option>
        <optgroup label="Originalröster · ElevenLabs">{DEALER_VOICE_PRESETS.filter(row=>row.provider==='elevenlabs').map(row=><option key={row.id} value={row.id}>{row.label}{suggested===row.id?' · föreslagen':''}</option>)}</optgroup>
        <optgroup label="Cartesia">{DEALER_VOICE_PRESETS.filter(row=>row.provider==='cartesia').map(row=><option key={row.id} value={row.id}>{row.label}</option>)}</optgroup>
        <option value="custom">Annan röst · egna inställningar</option>
      </select></label>
      <label className={fieldClass}>Röstspråk<select data-field="voice-language" value={value.language||'sv'} disabled={value.provider==='cartesia'} onChange={event=>selected?onChange(dealerVoiceDraft(dealerVoicePreset(selected,event.target.value))):edit({language:event.target.value})}>
        <option value="sv">Svenska</option><option value="en">English</option>{value.language&&!['sv','en'].includes(value.language)&&<option value={value.language}>{value.language.toUpperCase()}</option>}
      </select></label>
    </div>
    {selected&&<p className="text-xs text-muted-foreground">Röstens ID och modell är ifyllda. Inställningarna följer det valda språket.</p>}
    <details open={custom||undefined}><summary>Detaljer · röstinställningar</summary>
      {selected==='paow'&&<p className="text-xs text-muted-foreground">Paow använder Eleven v3 på svenska och Multilingual v2 på andra språk.</p>}
      <label className={fieldClass}>Röstleverantör<select data-field="provider" value={value.provider} onChange={event=>onChange({...dealerVoiceDraft(null),provider:event.target.value as DealerVoiceDraft['provider']})}><option value="">Inte vald</option><option value="cartesia">Cartesia</option><option value="elevenlabs">ElevenLabs</option></select></label>
      <label className={fieldClass}>Voice-ID<input data-field="voice-id" value={value.voiceId} onChange={event=>editIdentity({voiceId:event.target.value})} maxLength={128} autoComplete="off" spellCheck={false} placeholder="Röstens ID, ingen API-nyckel"/></label>
      <label className={fieldClass}>Röstmodell<input data-field="model" placeholder="Modellens ID" value={value.modelId} onChange={event=>editIdentity({modelId:event.target.value})} maxLength={128} autoComplete="off"/></label>
      {value.provider==='elevenlabs'&&<>
        <label className={fieldClass}>Språkkod<input data-field="language-code" value={value.language} onChange={event=>edit({language:event.target.value.toLowerCase()})} maxLength={2}/></label>
        <label><input type="checkbox" data-field="custom-settings" checked={value.customSettings} onChange={event=>edit({customSettings:event.target.checked})}/> Egna röstinställningar</label>
        {value.customSettings&&<>
          <label className={fieldClass}>Stabilitet (0–1)<input data-field="stability" type="number" min={0} max={1} step={value.modelId==='eleven_v3'?.5:.01} value={value.stability} onChange={event=>edit({stability:event.target.value})}/></label>
          <label className={fieldClass}>Röstlikhet (0–1)<input data-field="similarity" type="number" min={0} max={1} step={.01} value={value.similarity} onChange={event=>edit({similarity:event.target.value})}/></label>
          <label className={fieldClass}>Stil (0–1)<input data-field="style" type="number" min={0} max={1} step={.01} value={value.style} onChange={event=>edit({style:event.target.value})}/></label>
          <label className={fieldClass}>Speaker boost<select data-field="speaker-boost" value={value.speakerBoost} onChange={event=>edit({speakerBoost:event.target.value})}><option value="">Leverantörens standard</option><option value="true">På</option><option value="false">Av</option></select></label>
        </>}
      </>}
      <p className="text-xs text-muted-foreground">Servern kontrollerar åtkomst till den exakta rösten före tal. API-nycklar stannar på servern. Språket i Eleven v3 och Multilingual v2 styrs av svarstexten.</p>
    </details>
  </div>;
}
