'use client';
import {useEffect,useRef,useState} from 'react';
import {DEFAULT_DEALER_FRAMING} from '../../../packages/presentation/contracts/dealer-framing.mjs';
import {effectiveDealerCompositing} from '../../../packages/presentation/contracts/dealer-compositing.mjs';
import {VideoCompositingFields,DealerFramingFields,RoulettePoseFields} from './video-metadata-fields';
import {DealerClipPreview} from './dealer-video-surface';
import { requestJson } from './studio-types';
import type { VideoEntry, VideoInventory } from '../../../packages/presentation/contracts/media-inventory.mjs';
import {inspectAlphaSource} from '../lib/media-alpha-browser.mjs';

export function DealerFileSettings({video,disabled=false,onSaved,onBusyChange}:{video:VideoEntry;disabled?:boolean;onSaved:(inventory:VideoInventory)=>void;onBusyChange?:(busy:boolean)=>void}){
  const [value,setValue]=useState(()=>({...video.classification!,framing:video.classification?.framing??{...DEFAULT_DEALER_FRAMING}}));
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[open,setOpen]=useState(false);
  const identity=JSON.stringify([video.id,video.sha256,video.revision]),latest=useRef({identity,disabled});
  latest.current={identity,disabled};
  type Operation={identity:string;controller?:AbortController;release:()=>void};
  const operation=useRef<Operation|null>(null);
  useEffect(()=>()=>{const pending=operation.current;operation.current=null;pending?.controller?.abort();pending?.release();},[]);
  function begin(){
    if(disabled||latest.current.disabled||latest.current.identity!==identity||operation.current)return null;
    const pending:Operation={identity,release:()=>onBusyChange?.(false)};
    operation.current=pending;setBusy(true);onBusyChange?.(true);setError('');setNotice('');return pending;
  }
  function current(pending:Operation){return operation.current===pending&&latest.current.identity===pending.identity;}
  function finish(pending:Operation){if(operation.current===pending){operation.current=null;setBusy(false);pending.release();}}
  const canMeasure=video.available&&video.contentType==='video/mp4'&&!!video.revision
    &&!!video.classification&&!video.classification.mediaType&&!video.retainedBank
    &&!video.familyId&&!video.classification.familyId&&!video.classification.archived&&!video.deletion;
  async function save(){
    const pending=begin();if(!pending)return;
    try{
      if(value.compositing?.mode==='alpha')await inspectAlphaSource(video.previewUrl,value.mediaType==='image'?'image/png':'video/webm');
      if(!current(pending))return;
      const next=await requestJson<VideoInventory>('/api/videos/classify',{method:'POST',body:JSON.stringify({id:video.id,sha256:video.sha256,previous:video.classification??null,metadata:{...value,compositing:effectiveDealerCompositing(value.compositing)}})});
      if(current(pending)){setNotice(value.game==='roulette'?'Filinställningarna är sparade för rouletteprov. Ingen automatisk spelkoppling.':'Filinställningarna är sparade. Publicera paketet igen för att använda dem i spelet.');onSaved(next);}
    }catch(cause){if(current(pending))setError(cause instanceof Error?cause.message:'Inställningarna kunde inte sparas.');}
    finally{finish(pending);}
  }
  async function measure(){
    if(!canMeasure)return;
    const pending=begin();if(!pending)return;
    let saved=false;
    try{
      pending.controller=new AbortController();
      const signal=pending.controller.signal;
      await requestJson('/api/videos/measure-timing',{method:'POST',signal,body:JSON.stringify({id:video.id,sha256:video.sha256,expectedRevision:video.revision})});
      saved=true;if(!current(pending))return;
      const next=await requestJson<VideoInventory>('/api/videos',{signal,cache:'no-store'});
      if(current(pending)){setNotice('Speltiden är sparad. Publicera paketet igen för att använda den i spelet. Mätningen ger inget nytt bild- eller talgodkännande.');onSaved(next);}
    }catch(cause){
      if(current(pending)){
        const status=(cause as {statusCode?:number}|null)?.statusCode;
        setError(saved?'Speltiden sparades, men listan kunde inte uppdateras. Läs in filerna igen innan du fortsätter.'
          :status===409?'Filen har ändrats eller kan inte mätas i sitt nuvarande läge. Läs in filerna igen.'
          :status===401||status===403?'Du saknar behörighet eller behöver logga in igen.'
          :status===422?'Filens speltid kunde inte fastställas säkert. Den här MP4-filen stöds inte för mätning.'
          :status===408?'Mätningen tog för lång tid. Läs in filerna igen innan du försöker på nytt.'
          :status===503?'Tidsmätningen är inte tillgänglig just nu.'
          :'Speltiden kunde inte mätas. Läs in filerna igen innan du försöker på nytt.');
      }
    }finally{finish(pending);}
  }
  if(!video.classification||video.classification.mediaType==='audio')return null;
  return <details onToggle={event=>setOpen(event.currentTarget.open)}><summary>Bildformat och bakgrund · ändra</summary>{open?<fieldset disabled={disabled||busy} style={{minWidth:0,border:0,padding:0}}>
    <VideoCompositingFields value={value.compositing} onChange={compositing=>setValue({...value,compositing})}/>
    <p>Granska kanterna med vald friläggning. Originalfilen och dess bildmått behålls.</p>
    {value.game==='roulette'&&value.mediaType!=='image'?<RoulettePoseFields value={value} onChange={next=>setValue({...next,framing:next.framing??value.framing})}/>:null}
    <DealerFramingFields value={value.framing} onChange={framing=>setValue({...value,framing})}/>
    <DealerClipPreview mediaType={value.mediaType==='image'?'image':undefined} url={video.previewUrl} framing={value.framing} compositing={value.compositing}/>
    <button type="button" disabled={busy||disabled||!video.available} onClick={()=>void save()}>{busy?'Sparar…':'Spara bildformat och bakgrund'}</button>
    {canMeasure?<button type="button" disabled={busy||disabled} onClick={()=>void measure()}>Mät speltid</button>:null}
    {video.mediaTiming?<p>Sparad sluttid: {(video.mediaTiming.endUs/1_000_000).toLocaleString('sv-SE',{maximumFractionDigits:6})} s. Publicera paketet igen för att använda mätningen i spelet. Mätningen ger inget nytt bild- eller talgodkännande.</p>:null}
  </fieldset>:null}{error?<p role="alert">{error}</p>:null}{notice?<p role="status">{notice}</p>:null}</details>;
}
