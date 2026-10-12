'use client';
import { useState, type FormEvent } from 'react';
import { kindForEvent, situationsForEvent } from '../lib/video-intake.mjs';
import type { VideoMetadata } from '../lib/video-intake.mjs';
import type { StudioProject } from '../lib/studio-model.mjs';
import { requestJson, type VideoEntry, type VideoInventory } from './studio-types';
import { VideoMetadataFields } from './video-metadata-fields';
import {effectiveDealerCompositing} from '../../web/public/dealer-compositing.mjs';

export function VideoClassification({project,video,dealerId,eventId,onSaved}:{project:StudioProject;video:VideoEntry;dealerId:string;eventId:string;onSaved:(next:VideoInventory)=>void}) {
  const [value,setValue]=useState<VideoMetadata>(()=>{
    const event=project.events.find(e=>e.id===(video.suggestedEventId ?? eventId)) ?? project.events.find(e=>e.id===eventId)!;
    return video.classification ?? {label:video.label,dealerId:video.dealer ?? dealerId as VideoMetadata['dealerId'],eventId:event.id,kind:kindForEvent(event),role:'standard',situation:situationsForEvent(event)[0] ?? '',notes:'',playback:'once'};
  });
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  async function submit(e:FormEvent) {
    e.preventDefault(); if(busy)return;
    setBusy(true);setError('');setNotice('');
    try { onSaved(await requestJson<VideoInventory>('/api/videos/classify',{method:'POST',body:JSON.stringify({id:video.id,sha256:video.sha256,previous:video.classification ?? null,metadata:value.mediaType==='audio'?value:{...value,compositing:effectiveDealerCompositing(value.compositing)}})}));setNotice('Kategorisering sparad. Videofilen är oförändrad.'); }
    catch(cause){setError(cause instanceof Error?cause.message:'Kunde inte spara.');}
    finally{setBusy(false);}
  }
  return <details open={!video.classification}><summary>{video.classification?'Ändra kategorisering':'Kategorisera för labbet'}</summary><form onSubmit={submit}><fieldset disabled={busy} style={{border:0,padding:0}}><VideoMetadataFields project={project} value={value} onChange={setValue}/><p className="helper">Kontrollera innehållet i filmen. Förslag från arkivet är inte verifierade. Kategorisering sparas direkt; kopplingar sparas med Spara projekt.</p><button className="primary-button" type="submit" disabled={busy || !video.available}>{busy?'Sparar…':'Spara kategorisering'}</button></fieldset>{error?<p role="alert">{error}</p>:null}{notice?<p role="status">{notice}</p>:null}</form></details>;
}
