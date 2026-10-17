'use client';
import {useState} from 'react';
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
  async function save(){
    if(disabled||busy)return;setBusy(true);onBusyChange?.(true);setError('');setNotice('');
    try{
      if(value.compositing?.mode==='alpha')await inspectAlphaSource(video.previewUrl,value.mediaType==='image'?'image/png':'video/webm');
      const next=await requestJson<VideoInventory>('/api/videos/classify',{method:'POST',body:JSON.stringify({id:video.id,sha256:video.sha256,previous:video.classification??null,metadata:{...value,compositing:effectiveDealerCompositing(value.compositing)}})});
      onSaved(next);setNotice(value.game==='roulette'?'Filinställningarna är sparade för rouletteprov. Ingen automatisk spelkoppling.':'Filinställningarna är sparade. Publicera paketet igen för att använda dem i spelet.');
    }catch(cause){setError(cause instanceof Error?cause.message:'Inställningarna kunde inte sparas.');}
    finally{setBusy(false);onBusyChange?.(false);}
  }
  if(!video.classification||video.classification.mediaType==='audio')return null;
  return <details onToggle={event=>setOpen(event.currentTarget.open)}><summary>Bildformat och bakgrund · ändra</summary>{open?<fieldset disabled={disabled||busy} style={{minWidth:0,border:0,padding:0}}>
    <VideoCompositingFields value={value.compositing} onChange={compositing=>setValue({...value,compositing})}/>
    <p>Granska kanterna med vald friläggning. Originalfilen och dess bildmått behålls.</p>
    {value.game==='roulette'&&value.mediaType!=='image'?<RoulettePoseFields value={value} onChange={next=>setValue({...next,framing:next.framing??value.framing})}/>:null}
    <DealerFramingFields value={value.framing} onChange={framing=>setValue({...value,framing})}/>
    <DealerClipPreview mediaType={value.mediaType==='image'?'image':undefined} url={video.previewUrl} framing={value.framing} compositing={value.compositing}/>
    <button type="button" disabled={busy||disabled||!video.available} onClick={()=>void save()}>{busy?'Sparar…':'Spara bildformat och bakgrund'}</button>
  </fieldset>:null}{error?<p role="alert">{error}</p>:null}{notice?<p role="status">{notice}</p>:null}</details>;
}
