'use client';
import {useEffect,useRef,useState} from 'react';
import type {StudioProject} from '../lib/studio-model.mjs';
import {dealerSpeechPreparation,isSpeechReferenceVideo,normalizeDealerSpeechProfile,type DealerSpeechProfile} from '../../web/public/dealer-speech-profile.mjs';
import type {VideoInventory} from './studio-types';

export function DealerSpeechSettings({dealer,inventory,disabled=false,onEdit}:{dealer:StudioProject['dealers'][number];inventory?:VideoInventory;disabled?:boolean;onEdit:(edit:(current:StudioProject)=>StudioProject)=>void}) {
  const saved=dealer.speechProfile;
  const [provider,setProvider]=useState(saved?.voice?.provider??'');
  const [voiceId,setVoiceId]=useState(saved?.voice?.voiceId??''),[modelId,setModelId]=useState(saved?.voice?.modelId??'');
  const [videoId,setVideoId]=useState(saved?.reference?.videoId??''),[kind,setKind]=useState<NonNullable<DealerSpeechProfile['reference']>['kind']>(saved?.reference?.kind??'video-frame');
  const [offsetMs,setOffsetMs]=useState(saved?.reference?.offsetMs??0),[reviewed,setReviewed]=useState(false);
  const [error,setError]=useState(''),[notice,setNotice]=useState('');
  const [durationMs,setDurationMs]=useState(0);
  const player=useRef<HTMLVideoElement>(null);
  const videos=(inventory?.videos??[]).filter(row=>isSpeechReferenceVideo(row,dealer.id));
  const selected=videos.find(row=>row.id===videoId);
  const sourceKey=selected?selected.id+':'+selected.sha256:'';
  useEffect(()=>{setReviewed(false);setNotice('');},[sourceKey,offsetMs]);
  useEffect(()=>{setDurationMs(0);},[sourceKey]);
  useEffect(()=>{
    const video=player.current;if(!video||!selected)return;
    setReviewed(false);
    if(video.readyState>=1)video.currentTime=offsetMs/1000;
  },[sourceKey,offsetMs]);
  function frameReady(){
    const video=player.current;
    if(video&&video.readyState>=2&&!video.seeking&&Math.abs(video.currentTime*1000-offsetMs)<60)setReviewed(true);
  }
  function save(){
    try{
      if(!dealer||disabled)return;
      if(videoId&&(!selected||!reviewed||!durationMs||offsetMs>=durationMs))throw Error('Granska den valda videopositionen innan du sparar referensen.');
      const voice=provider||voiceId||modelId?{provider,voiceId:voiceId.trim(),modelId:modelId.trim()}:null;
      const reference=selected?{kind,videoId:selected.id,sha256:selected.sha256,offsetMs}:null;
      const speechProfile=normalizeDealerSpeechProfile({schemaVersion:1,state:'preparation',voice,reference});
      onEdit(current=>({...current,dealers:current.dealers.map(row=>row.id===dealer.id?{...row,speechProfile}:row)}));
      setError('');setNotice('Talunderlaget finns i utkastet. Spara inställningarna för att behålla det. Ingen rösttjänst aktiveras.');
    }catch(cause){setError(cause instanceof Error?cause.message:'Talunderlaget kunde inte ändras.');}
  }
  return <details><summary>Talprofil – förberedelse · {dealer.label}</summary>
    <p>Grundloopen visar dealern mellan repliker. En referens till talavataren är ett separat underlag som ska passa samma dealer och scen. En lobbybild är inte en talavatar.</p>
    {dealer.id==='astrid'?<p>Astrids befintliga röstflöde behålls. Den här förberedelsen byter inte dess röst eller avatar.</p>:null}
    <p role="status">{dealerSpeechPreparation(saved).message}</p>
    <fieldset disabled={disabled}>
      <label className="field">Röstleverantör<select value={provider} onChange={event=>setProvider(event.target.value as typeof provider)}><option value="">Inte vald</option><option value="cartesia">Cartesia</option><option value="elevenlabs">ElevenLabs</option></select></label>
      <label className="field">Dealerns röst-id<input value={voiceId} onChange={event=>setVoiceId(event.target.value)} maxLength={128} autoComplete="off" placeholder="Röstens ID, ingen API-nyckel"/></label>
      <label className="field">Röstmodell<input value={modelId} onChange={event=>setModelId(event.target.value)} maxLength={128} autoComplete="off" placeholder="Modellens ID"/></label>
      <label className="field">Dealerns referensvideo<select value={videoId} onChange={event=>{setVideoId(event.target.value);setOffsetMs(0);setReviewed(false);}}>
        <option value="">Välj senare</option>{videos.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}
      </select></label>
      {!videos.length?<p>Lägg först in en egen video i dealerbiblioteket. Ljudfiler och andra dealers filmer kan inte användas.</p>:null}
      {selected?<div>
        <label className="field">Underlag för avatarberedning<select value={kind} onChange={event=>setKind(event.target.value as typeof kind)}><option value="video-frame">Stillbild från vald videoposition</option><option value="motion-video">Video med naturlig rörelse</option></select></label>
        <video key={sourceKey} ref={player} src={selected.previewUrl} muted playsInline preload="metadata" style={{width:'100%',maxWidth:420,maxHeight:440,objectFit:'contain',background:'#111'}} aria-label={'Talreferens för '+dealer.label}
          onLoadedMetadata={()=>{const video=player.current;if(video&&Number.isFinite(video.duration)&&video.duration>0){setDurationMs(Math.floor(video.duration*1000));video.currentTime=offsetMs/1000;}}} onLoadedData={frameReady} onSeeked={frameReady}
          onError={()=>{setReviewed(false);setError('Videoreferensen kunde inte visas. Ingen ny referens sparas.');}}/>
        <label className="field">Startposition: {(offsetMs/1000).toFixed(2)} s<input type="range" min={0} max={Math.max(0,durationMs-1)} step={10} value={offsetMs} onChange={event=>{setReviewed(false);setOffsetMs(Number(event.target.value));}}/></label>
        <p>{reviewed?'Videopositionen visas.':'Laddar videopositionen…'} Välj en tydlig neutral pose med synligt ansikte. Originalvideon och positionen sparas som referens, ingen ny bildfil skapas här.</p>
        <p>{kind==='motion-video'?'Rörligt underlag kan bevara andning och hållning, men kräver en worker som förberetts för just den videon. Dagens Astrid-worker använder en stillbild.':'En stillbild kan användas av en förberedd avatar. Läppsynk mot en stillbild skapar inte naturliga kroppsrörelser.'}</p>
      </div>:null}
      <button type="button" className="sg-btn sg-btn-secondary" onClick={save} disabled={Boolean(videoId)&&(!selected||!reviewed||!durationMs||offsetMs>=durationMs)}>Använd talunderlag i utkastet</button>
    </fieldset>
    <p>Talprofilen är ett förberedelseunderlag. Exakt röst, avatar, driftkoppling och övergång till grundloop behöver verifieras innan genererat tal kan aktiveras. Ingen leverantör kontaktas när du sparar.</p>
    {notice?<p role="status">{notice}</p>:null}{error?<p role="alert">{error}</p>:null}
  </details>;
}
