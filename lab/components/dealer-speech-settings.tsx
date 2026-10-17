'use client';
import {useEffect,useRef,useState} from 'react';
import {DealerVoicePicker} from './dealer-voice-picker';
import {dealerVoiceFromDraft,initialDealerVoiceDraft} from '../../web/public/dealer-voice-catalog.mjs';
import type {StudioProject} from '../../packages/presentation/contracts/studio-model.mjs';
import {dealerSpeechPreparation,dealerSpeechReferenceCheck,isSpeechReferenceVideo,normalizeDealerSpeechProfile,type DealerSpeechProfile} from '../../packages/presentation/contracts/dealer-speech-profile.mjs';
import type { VideoInventory } from '../../packages/presentation/contracts/media-inventory.mjs';

export function DealerSpeechSettings({dealer,inventory,disabled=false,onEdit,expanded=false,idleReferenceId,onDraftChange}:{expanded?:boolean;idleReferenceId?:string;onDraftChange?:(dirty:boolean)=>void;dealer:StudioProject['dealers'][number];inventory?:VideoInventory;disabled?:boolean;onEdit:(edit:(current:StudioProject)=>StudioProject)=>void}) {
  const saved=dealer.speechProfile;
  const [enabled,setEnabled]=useState(saved?.state==='enabled');
  const [voiceDraft,setVoiceDraft]=useState(initialDealerVoiceDraft(dealer,saved?.voice));
  const [videoId,setVideoId]=useState(saved?.reference?.videoId??''),[kind,setKind]=useState<NonNullable<DealerSpeechProfile['reference']>['kind']>(saved?.reference?.kind??'video-frame');
  const [offsetMs,setOffsetMs]=useState(saved?.reference?.offsetMs??0),[reviewed,setReviewed]=useState(false);
  const [error,setError]=useState(''),[notice,setNotice]=useState('');
  const [durationMs,setDurationMs]=useState(0);
  const [referenceError,setReferenceError]=useState('');
  const player=useRef<HTMLVideoElement>(null);
  // A prefilled voice proposal is not a user edit, including while this tab is hidden.
  const localDirty=JSON.stringify([enabled,voiceDraft,videoId,kind,offsetMs])!==JSON.stringify([saved?.state==='enabled',initialDealerVoiceDraft(dealer,saved?.voice),saved?.reference?.videoId??'',saved?.reference?.kind??'video-frame',saved?.reference?.offsetMs??0]);
  useEffect(()=>{onDraftChange?.(localDirty);},[localDirty,onDraftChange]);
  useEffect(()=>()=>onDraftChange?.(false),[onDraftChange]);
  function restoreForm(profile: typeof saved) {
    setEnabled(profile?.state==='enabled');setVoiceDraft(initialDealerVoiceDraft(dealer,profile?.voice));
    setVideoId(profile?.reference?.videoId??'');setKind(profile?.reference?.kind??'video-frame');setOffsetMs(profile?.reference?.offsetMs??0);setReviewed(false);
  }
  const videos=(inventory?.videos??[]).filter(row=>isSpeechReferenceVideo(row,dealer.id));
  const idleReference=videos.find(row=>row.id===idleReferenceId);
  const selected=videos.find(row=>row.id===videoId);
  const referenceCheck=dealerSpeechReferenceCheck(selected,dealer.id);
  const referenceUnchanged=Boolean((!enabled||saved?.state==='enabled')&&selected&&saved?.reference?.videoId===selected.id&&saved.reference.sha256===selected.sha256&&saved.reference.offsetMs===offsetMs&&saved.reference.kind===kind);
  const sourceKey=selected?selected.id+':'+selected.sha256:'';
  useEffect(()=>{setReviewed(false);setNotice('');},[sourceKey,offsetMs]);
  useEffect(()=>{setDurationMs(0);setReferenceError('');},[sourceKey]);
  useEffect(()=>{
    const video=player.current;if(!video||!selected)return;
    setReviewed(false);
    if(video.readyState>=1)video.currentTime=offsetMs/1000;
  },[sourceKey,offsetMs]);
  function frameReady(){
    const video=player.current;
    if(video&&video.readyState>=2&&!video.seeking&&Math.abs(video.currentTime*1000-offsetMs)<60){setReviewed(true);setReferenceError('');}
  }
  function save(){
    try{
      if(!dealer||disabled)return;
      if(enabled&&(!referenceCheck.canEnable||referenceError))throw Error(referenceError||referenceCheck.message);
      if(videoId&&!referenceUnchanged&&(!selected||!reviewed||!durationMs||offsetMs>=durationMs))throw Error('Granska den valda videopositionen innan du sparar referensen.');
      const voice=dealerVoiceFromDraft(voiceDraft);
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
    <p role="status">{dealerSpeechPreparation(saved).message}</p>
    <fieldset disabled={disabled}>
      <DealerVoicePicker dealer={dealer} value={voiceDraft} onChange={value=>{setVoiceDraft(value);if(!value.provider||!value.voiceId.trim()||!value.modelId.trim())setEnabled(false);}}/>
      {idleReference?<div><button type="button" className="sg-btn sg-btn-secondary" onClick={()=>{setVideoId(idleReference.id);setOffsetMs(0);setKind('video-frame');setReviewed(false);if(videoId===idleReference.id&&offsetMs===0)frameReady();setEnabled(false);setNotice('Grundloopens första bildruta är vald. Granska bilden och använd talunderlaget i utkastet innan du sparar.');}}>Använd grundloopens första bildruta</button><p>Utgår från dealerns valda grundloop. Du kan välja en annan videoposition nedan.</p></div>:null}
      <label className="field">Dealerns referensvideo<select value={videoId} onChange={event=>{setVideoId(event.target.value);setOffsetMs(0);setReviewed(false);if(!event.target.value)setEnabled(false);}}>
        <option value="">Välj senare</option>{videos.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}
      </select></label>
      {!videos.length?<p>Lägg först in en egen video i dealerbiblioteket. Ljudfiler och andra dealers filmer kan inte användas.</p>:null}
      {selected?<div>
        <label className="field">Underlag för avatarberedning<select value={kind} onChange={event=>{setKind(event.target.value as typeof kind);setEnabled(false);}}><option value="video-frame">Stillbild från vald videoposition</option><option value="motion-video">Video med naturlig rörelse</option></select></label>
        <video key={sourceKey} ref={player} src={selected.previewUrl} muted playsInline preload="metadata" style={{width:'100%',maxWidth:420,maxHeight:440,objectFit:'contain',background:'#111'}} aria-label={'Talreferens för '+dealer.label}
          onLoadedMetadata={()=>{const video=player.current;if(video&&Number.isFinite(video.duration)&&video.duration>0){setDurationMs(Math.floor(video.duration*1000));video.currentTime=offsetMs/1000;}}} onLoadedData={frameReady} onSeeked={frameReady}
          onError={()=>{setReviewed(false);setReferenceError('Videoreferensen kunde inte visas. Kontrollera filen innan AI-tal aktiveras.');}}/>
        <label className="field">Startposition: {(offsetMs/1000).toFixed(2)} s<input type="range" min={0} max={Math.max(0,durationMs-1)} step={10} value={offsetMs} onChange={event=>{setReviewed(false);setOffsetMs(Number(event.target.value));}}/></label>
        <p>{reviewed?'Videopositionen visas.':'Laddar videopositionen…'} Välj en tydlig neutral pose med synligt ansikte. Servern verifierar den sparade videon och positionen när en talsession förbereds.</p>
        <p>{kind==='motion-video'?'Rörligt underlag måste vara förberett för just denna dealer. Servern kontrollerar kopplingen före tal. Att spara profilen startar inget talprov.':'En stillbild kan användas av en förberedd avatar. Läppsynk mot en stillbild skapar inte naturliga kroppsrörelser.'}</p>
      </div>:null}
      {videoId?<p role={referenceError||!referenceCheck.canEnable?'alert':'status'}>{referenceError||referenceCheck.message}</p>:null}
      <label><input type="checkbox" checked={enabled} disabled={!enabled&&(!referenceCheck.canEnable||Boolean(referenceError)||!voiceDraft.provider||!voiceDraft.voiceId.trim()||!voiceDraft.modelId.trim())} onChange={event=>setEnabled(event.target.checked)}/> Använd egen röst och läppsynk för chattsvar</label>
      <p>Röst-id måste finnas hos vald leverantör. Servern kontrollerar åtkomst och förbereder just denna dealer. Om det misslyckas spelas ingen annan dealers röst eller avatar.</p>
      {localDirty?<p role="status">Talformuläret har ändringar som inte lagts till i projektutkastet. Använd talunderlaget eller ångra ändringarna innan du byter dealer eller lämnar sidan.</p>:null}
      <button type="button" className="sg-btn sg-btn-secondary" onClick={save} disabled={enabled&&(!referenceCheck.canEnable||Boolean(referenceError))||Boolean(videoId)&&!referenceUnchanged&&(!selected||!reviewed||!durationMs||offsetMs>=durationMs)}>Använd talunderlag i utkastet</button>
      <button type="button" className="sg-btn sg-btn-secondary" disabled={!localDirty} onClick={()=>{restoreForm(saved);setError('');setNotice('Ändringarna i talformuläret är ångrade.');}}>Ångra ändringar i talformuläret</button>
    </fieldset>
    <p>Sparad profil är inte ett godkänt talprov. Granska uttal, läppsynk och övergången till grundloopen i spelet innan dealern används för spelare. Att spara startar ingen generation.</p>
    {notice?<p role="status">{notice}</p>:null}{error?<p role="alert">{error}</p>:null}
  </Container>;
}
