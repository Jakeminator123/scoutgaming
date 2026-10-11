'use client';
import {useEffect,useRef,useState} from 'react';
import type {StudioProject} from '../lib/studio-model.mjs';
import {dealerSpeechPreparation,isSpeechReferenceVideo,normalizeDealerSpeechProfile,type DealerSpeechProfile} from '../../web/public/dealer-speech-profile.mjs';
import type {VideoInventory} from './studio-types';

export function DealerSpeechSettings({dealer,inventory,disabled=false,onEdit,expanded=false,idleReferenceId,onDraftChange}:{expanded?:boolean;idleReferenceId?:string;onDraftChange?:(dirty:boolean)=>void;dealer:StudioProject['dealers'][number];inventory?:VideoInventory;disabled?:boolean;onEdit:(edit:(current:StudioProject)=>StudioProject)=>void}) {
  const saved=dealer.speechProfile;
  const existingDealer=['vera','astrid','amira','mei'].includes(dealer.id);
  const [enabled,setEnabled]=useState(saved?.state==='enabled');
  const [provider,setProvider]=useState(saved?.voice?.provider??'');
  const [voiceId,setVoiceId]=useState(saved?.voice?.voiceId??''),[modelId,setModelId]=useState(saved?.voice?.modelId??'');
  const [language,setLanguage]=useState(saved?.voice?.language??'');
  const [customSettings,setCustomSettings]=useState(Boolean(saved?.voice?.settings));
  const [stability,setStability]=useState(String(saved?.voice?.settings?.stability??''));
  const [similarity,setSimilarity]=useState(String(saved?.voice?.settings?.similarity_boost??''));
  const [style,setStyle]=useState(String(saved?.voice?.settings?.style??''));
  const [speakerBoost,setSpeakerBoost]=useState(saved?.voice?.settings?.use_speaker_boost===undefined?'':String(saved.voice.settings.use_speaker_boost));
  const [videoId,setVideoId]=useState(saved?.reference?.videoId??''),[kind,setKind]=useState<NonNullable<DealerSpeechProfile['reference']>['kind']>(saved?.reference?.kind??'video-frame');
  const [offsetMs,setOffsetMs]=useState(saved?.reference?.offsetMs??0),[reviewed,setReviewed]=useState(false);
  const [error,setError]=useState(''),[notice,setNotice]=useState('');
  const [durationMs,setDurationMs]=useState(0);
  const player=useRef<HTMLVideoElement>(null);
  const savedValues=[saved?.state==='enabled',saved?.voice?.provider??'',saved?.voice?.voiceId??'',saved?.voice?.modelId??'',saved?.voice?.language??'',Boolean(saved?.voice?.settings),String(saved?.voice?.settings?.stability??''),String(saved?.voice?.settings?.similarity_boost??''),String(saved?.voice?.settings?.style??''),saved?.voice?.settings?.use_speaker_boost===undefined?'':String(saved.voice.settings.use_speaker_boost),saved?.reference?.videoId??'',saved?.reference?.kind??'video-frame',saved?.reference?.offsetMs??0];
  const localDirty=JSON.stringify([enabled,provider,voiceId,modelId,language,customSettings,stability,similarity,style,speakerBoost,videoId,kind,offsetMs])!==JSON.stringify(savedValues);
  useEffect(()=>{onDraftChange?.(localDirty);},[localDirty,onDraftChange]);
  useEffect(()=>()=>onDraftChange?.(false),[onDraftChange]);
  function restoreForm(profile: typeof saved) {
    setEnabled(profile?.state==='enabled');setProvider(profile?.voice?.provider??'');setVoiceId(profile?.voice?.voiceId??'');setModelId(profile?.voice?.modelId??'');setLanguage(profile?.voice?.language??'');setCustomSettings(Boolean(profile?.voice?.settings));
    setStability(String(profile?.voice?.settings?.stability??''));setSimilarity(String(profile?.voice?.settings?.similarity_boost??''));setStyle(String(profile?.voice?.settings?.style??''));setSpeakerBoost(profile?.voice?.settings?.use_speaker_boost===undefined?'':String(profile.voice.settings.use_speaker_boost));
    setVideoId(profile?.reference?.videoId??'');setKind(profile?.reference?.kind??'video-frame');setOffsetMs(profile?.reference?.offsetMs??0);setReviewed(false);
  }
  const videos=(inventory?.videos??[]).filter(row=>isSpeechReferenceVideo(row,dealer.id));
  const idleReference=videos.find(row=>row.id===idleReferenceId);
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
      const settings={...(stability.trim()?{stability:Number(stability)}:{}),...(similarity.trim()?{similarity_boost:Number(similarity)}:{}),
        ...(style.trim()?{style:Number(style)}:{}),...(speakerBoost?{use_speaker_boost:speakerBoost==='true'}:{})};
      const voice=provider||voiceId||modelId?{provider,voiceId:voiceId.trim(),modelId:modelId.trim(),
        ...(provider==='elevenlabs'&&language.trim()?{language:language.trim()}:{}),
        ...(provider==='elevenlabs'&&customSettings?{settings}:{})}:null;
      const reference=selected?{kind,videoId:selected.id,sha256:selected.sha256,offsetMs}:null;
      const speechProfile=normalizeDealerSpeechProfile({schemaVersion:2,state:enabled?'enabled':'preparation',voice,reference});
      onEdit(current=>({...current,dealers:current.dealers.map(row=>row.id===dealer.id?{...row,speechProfile}:row)}));
      restoreForm(speechProfile);
      setError('');setNotice('Talprofilen finns i utkastet. Spara inställningarna för att behålla den. Sparandet startar inget talprov.');
    }catch(cause){setError(cause instanceof Error?cause.message:'Talunderlaget kunde inte ändras.');}
  }
  const Container=expanded?'section':'details', Heading=expanded?'h3':'summary';
  return <Container><Heading>Röst och läppsynk · {dealer.label}</Heading>
    <p>Grundloopen visar dealern mellan repliker. En referens till talavataren är ett separat underlag som ska passa samma dealer och scen. En lobbybild är inte en talavatar.</p>
    {existingDealer?<p>Den här standarddealerns befintliga talflöde behålls. Egen talprofil kan förberedas här.</p>:null}
    <p role="status">{dealerSpeechPreparation(saved).message}</p>
    <fieldset disabled={disabled}>
      <label className="field">Röstleverantör<select value={provider} onChange={event=>setProvider(event.target.value as typeof provider)}><option value="">Inte vald</option><option value="cartesia">Cartesia</option><option value="elevenlabs">ElevenLabs</option></select></label>
      <label className="field">Dealerns röst-id<input value={voiceId} onChange={event=>setVoiceId(event.target.value)} maxLength={128} autoComplete="off" placeholder="Röstens ID, ingen API-nyckel"/></label>
      <label className="field">Röstmodell<input value={modelId} onChange={event=>setModelId(event.target.value)} maxLength={128} autoComplete="off" placeholder="Modellens ID"/></label>
      {provider==='elevenlabs'?<details><summary>Avancerade röstinställningar</summary>
        <label className="field">Språkkod<input value={language} onChange={event=>setLanguage(event.target.value.toLowerCase())} maxLength={2} placeholder="Exempel: sv"/></label>
        <p>Språkval skickas bara när modellen stöder det. Eleven v3 och Multilingual v2 använder svarstexten för språkval.</p>
        <label><input type="checkbox" checked={customSettings} onChange={event=>setCustomSettings(event.target.checked)}/> Spara egna röstinställningar</label>
        {customSettings?<>
          <label className="field">Stabilitet (0–1)<input type="number" min={0} max={1} step={modelId==='eleven_v3'?.5:.01} value={stability} onChange={event=>setStability(event.target.value)} placeholder="Leverantörens standard"/></label>
          <label className="field">Röstlikhet (0–1)<input type="number" min={0} max={1} step={.01} value={similarity} onChange={event=>setSimilarity(event.target.value)} placeholder="Leverantörens standard"/></label>
          <label className="field">Stil (0–1)<input type="number" min={0} max={1} step={.01} value={style} onChange={event=>setStyle(event.target.value)} placeholder="Leverantörens standard"/></label>
          <label className="field">Speaker boost<select value={speakerBoost} onChange={event=>setSpeakerBoost(event.target.value)}><option value="">Leverantörens standard</option><option value="true">På</option><option value="false">Av</option></select></label>
          <p>Endast ifyllda värden används. Modellernas stöd skiljer sig; använd de inställningar som provats för just denna röst.</p>
        </>:null}
      </details>:null}
      {idleReference?<div><button type="button" className="sg-btn sg-btn-secondary" onClick={()=>{setVideoId(idleReference.id);setOffsetMs(0);setKind('video-frame');setReviewed(false);if(videoId===idleReference.id&&offsetMs===0)frameReady();setEnabled(false);setNotice('Grundloopens första bildruta är vald. Granska bilden och använd talunderlaget i utkastet innan du sparar.');}}>Använd grundloopens första bildruta</button><p>Utgår från dealerns valda grundloop. Du kan välja en annan videoposition nedan.</p></div>:null}
      <label className="field">Dealerns referensvideo<select value={videoId} onChange={event=>{setVideoId(event.target.value);setOffsetMs(0);setReviewed(false);}}>
        <option value="">Välj senare</option>{videos.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}
      </select></label>
      {!videos.length?<p>Lägg först in en egen video i dealerbiblioteket. Ljudfiler och andra dealers filmer kan inte användas.</p>:null}
      {selected?<div>
        <label className="field">Underlag för avatarberedning<select value={kind} onChange={event=>{setKind(event.target.value as typeof kind);setEnabled(false);}}><option value="video-frame">Stillbild från vald videoposition</option><option value="motion-video">Video med naturlig rörelse – endast förberedelse</option></select></label>
        <video key={sourceKey} ref={player} src={selected.previewUrl} muted playsInline preload="metadata" style={{width:'100%',maxWidth:420,maxHeight:440,objectFit:'contain',background:'#111'}} aria-label={'Talreferens för '+dealer.label}
          onLoadedMetadata={()=>{const video=player.current;if(video&&Number.isFinite(video.duration)&&video.duration>0){setDurationMs(Math.floor(video.duration*1000));video.currentTime=offsetMs/1000;}}} onLoadedData={frameReady} onSeeked={frameReady}
          onError={()=>{setReviewed(false);setError('Videoreferensen kunde inte visas. Ingen ny referens sparas.');}}/>
        <label className="field">Startposition: {(offsetMs/1000).toFixed(2)} s<input type="range" min={0} max={Math.max(0,durationMs-1)} step={10} value={offsetMs} onChange={event=>{setReviewed(false);setOffsetMs(Number(event.target.value));}}/></label>
        <p>{reviewed?'Videopositionen visas.':'Laddar videopositionen…'} Välj en tydlig neutral pose med synligt ansikte. Servern tar fram en stillbild från exakt den sparade videon och positionen när en talsession förbereds.</p>
        <p>{kind==='motion-video'?'Rörligt underlag kan sparas för senare. Den gemensamma talmotorn stöder ännu bara en stillbild, så AI-tal kan inte aktiveras med detta val.':'En stillbild kan användas av en förberedd avatar. Läppsynk mot en stillbild skapar inte naturliga kroppsrörelser.'}</p>
      </div>:null}
      <label><input type="checkbox" checked={enabled} disabled={existingDealer||kind!=='video-frame'||!selected||!provider||!voiceId.trim()||!modelId.trim()} onChange={event=>setEnabled(event.target.checked)}/> Använd egen röst och läppsynk för chattsvar</label>
      <p>Röst-id måste finnas hos vald leverantör. Servern kontrollerar åtkomst och förbereder just denna dealer. Om det misslyckas spelas ingen annan dealers röst eller avatar.</p>
      {localDirty?<p role="status">Talformuläret har ändringar som inte lagts till i projektutkastet. Använd talunderlaget eller ångra ändringarna innan du byter dealer eller lämnar sidan.</p>:null}
      <button type="button" className="sg-btn sg-btn-secondary" onClick={save} disabled={Boolean(videoId)&&(!selected||!reviewed||!durationMs||offsetMs>=durationMs)}>Använd talunderlag i utkastet</button>
      <button type="button" className="sg-btn sg-btn-secondary" disabled={!localDirty} onClick={()=>{restoreForm(saved);setError('');setNotice('Ändringarna i talformuläret är ångrade.');}}>Ångra ändringar i talformuläret</button>
    </fieldset>
    <p>Sparad profil är inte ett godkänt talprov. Granska uttal, läppsynk och övergången till grundloopen i spelet innan dealern används för spelare. Att spara startar ingen generation.</p>
    {notice?<p role="status">{notice}</p>:null}{error?<p role="alert">{error}</p>:null}
  </Container>;
}
