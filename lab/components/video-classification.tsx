'use client';
import { useState, type FormEvent } from 'react';
import { kindForEvent, situationsForEvent } from '../../packages/presentation/contracts/video-intake.mjs';
import type { VideoMetadata } from '../../packages/presentation/contracts/video-intake.mjs';
import type { StudioProject } from '../../packages/presentation/contracts/studio-model.mjs';
import { requestJson } from './studio-types';
import type { VideoEntry, VideoInventory } from '../../packages/presentation/contracts/media-inventory.mjs';
import { VideoMetadataFields } from './video-metadata-fields';
import {effectiveDealerCompositing} from '../../packages/presentation/contracts/dealer-compositing.mjs';
import {inspectAlphaSource} from '../lib/media-alpha-browser.mjs';
import {dealerMediaEvents,rouletteMediaDefaults,rouletteMediaEvent} from '../../packages/presentation/contracts/roulette-media.mjs';

export function VideoClassification({project,video,dealerId,eventId,onSaved}:{project:StudioProject;video:VideoEntry;dealerId:string;eventId:string;onSaved:(next:VideoInventory)=>void}) {
  const [value,setValue]=useState<VideoMetadata>(()=>{
    const events=dealerMediaEvents(project),event=events.find(e=>e.id===(video.suggestedEventId ?? eventId)) ?? events.find(e=>e.id===eventId)!;
    const situation=situationsForEvent(event)[0] ?? '';
    return video.classification ?? {label:video.label,dealerId:video.dealer ?? dealerId as VideoMetadata['dealerId'],eventId:event.id,kind:kindForEvent(event),role:'standard',situation,notes:'',playback:'once',...(rouletteMediaEvent(event.id)?rouletteMediaDefaults(event.id,situation):{})};
  });
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  async function submit(e:FormEvent) {
    e.preventDefault(); if(busy)return;
    setBusy(true);setError('');setNotice('');
    try {
      if(value.compositing?.mode==='alpha')await inspectAlphaSource(video.previewUrl,value.mediaType==='image'?'image/png':'video/webm');
      onSaved(await requestJson<VideoInventory>('/api/videos/classify',{method:'POST',body:JSON.stringify({id:video.id,sha256:video.sha256,previous:video.classification ?? null,metadata:value.mediaType==='audio'?value:{...value,compositing:effectiveDealerCompositing(value.compositing)}})}));setNotice('Kategorisering sparad. Videofilen är oförändrad.'); }
    catch(cause){setError(cause instanceof Error?cause.message:'Kunde inte spara.');}
    finally{setBusy(false);}
  }
  return <details open={!video.classification}><summary>{video.classification?'Ändra kategorisering':'Kategorisera för labbet'}</summary><form onSubmit={submit}><fieldset disabled={busy} style={{border:0,padding:0}}><VideoMetadataFields project={project} value={value} onChange={setValue}/><p className="helper">Kontrollera innehållet i filmen. Förslag från arkivet är inte verifierade. Kategorisering sparas direkt; kopplingar sparas med Spara projekt.</p><button className="primary-button" type="submit" disabled={busy || !video.available}>{busy?'Sparar…':'Spara kategorisering'}</button></fieldset>{error?<p role="alert">{error}</p>:null}{notice?<p role="status">{notice}</p>:null}</form></details>;
}
