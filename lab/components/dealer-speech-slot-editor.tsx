'use client';
import {useId} from 'react';
import {speechSlotStandard,speechSlotVideoFits} from '../../web/public/speech-slot-bindings.mjs';
import {recordedSpeechForVideo} from '../../web/public/recorded-speech.mjs';
import type {StudioProject} from '../lib/studio-model.mjs';
import type {DealerMediaSlot} from '../lib/dealer-media-library.mjs';
import type {VideoInventory} from './studio-types';
import {DealerClipPreview} from './dealer-video-surface';
import styles from './dealer-speech-slot-editor.module.css';

export function DealerSpeechSlotEditor({project,inventory,dealerId,slot,blocked,onChange}:{
  project:StudioProject;inventory:VideoInventory;dealerId:string;slot:DealerMediaSlot;
  blocked:boolean;onChange:(videoId:string|null)=>void;
}) {
  const inputId=useId();
  const selection={dealerId,eventId:slot.eventId,situation:slot.situation,requireRecordedSpeech:slot.eventId==='speak.other'};
  const standard=speechSlotStandard(project,dealerId,slot.eventId,slot.situation);
  const selectedId=standard?.videoGenerationId??'';
  const choices=inventory.videos.filter(video=>speechSlotVideoFits(video,selection));
  const line=project.lines.find(row=>row.dealerId===dealerId&&row.eventId===slot.eventId);
  const olderId=slot.eventId==='speak.other'?line?.variants.find(row=>row.id===line.baselineVariantId)?.videoGenerationId:null;
  const older=inventory.videos.find(row=>row.id===olderId&&speechSlotVideoFits(row,{...selection,requireRecordedSpeech:false}));
  const video=choices.find(row=>row.id===selectedId)??(!selectedId?older:undefined);
  const recorded=video?.classification?.recordedSpeech;
  const approved=video&&recorded&&recordedSpeechForVideo(video,{dealerId,lineId:slot.situation,language:recorded.language});
  return <fieldset className={styles.editor} disabled={blocked} aria-label={'Standardklipp för '+slot.label}>
    <label htmlFor={inputId}>Standardklipp för {slot.label}</label>
    <select id={inputId} value={selectedId} onChange={event=>{
      if(blocked)return;
      const id=event.currentTarget.value;
      if(!id||choices.some(row=>row.id===id))onChange(id||null);
    }}>
      <option value="">{older?'Inget eget val · behåll äldre standard':'Inget standardklipp'}</option>
      {selectedId&&!video?<option value={selectedId} disabled>Det valda klippet är inte tillgängligt i detta fack</option>:null}
      {choices.map(row=><option key={row.id} value={row.id}>{project.clipLabels?.[row.id]??row.label}</option>)}
    </select>
    <p>Välj filmen med just denna replik och munrörelse. Spara inställningarna efter ditt val. Andra talfack påverkas inte.</p>
    {older?<p>Utan eget val används den äldre standarden {project.clipLabels?.[older.id]??older.label} för denna replik. Filens granskningskrav gäller fortfarande.</p>:null}
    {!choices.length&&!older?<p>Det finns ingen tillgänglig talfilm i detta fack. Lägg till en film i klippbiblioteket ovan.</p>:null}
    {video?<>
      <DealerClipPreview key={video.id} url={video.previewUrl} framing={video.classification?.framing} compositing={video.classification?.compositing}/>
      {recorded?<p>Replik: {recorded.exactText}</p>:null}
      <p>{approved?'Ljud och bild är granskade för den här tagningen.':recorded?.review.status==='rejected'?'Tagningen är underkänd och spelas inte i spelet.':recorded?'Ljud och bild behöver granskas innan tagningen kan spelas i ett publicerat rum.':'Detta äldre klipp saknar ett kvitto för exakt inspelat tal.'}</p>
    </>:null}
  </fieldset>;
}
