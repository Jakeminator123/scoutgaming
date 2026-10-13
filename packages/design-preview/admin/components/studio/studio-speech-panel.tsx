"use client"

import {useEffect,useRef,useState} from 'react'
import {DealerVoicePicker} from '../../../../../lab/components/dealer-voice-picker'
import {dealerVoiceDraft,dealerVoiceFromDraft,initialDealerVoiceDraft} from '../../../../../web/public/dealer-voice-catalog.mjs'
import type {StudioProject} from '../../../../../lab/lib/studio-model.mjs'
import type {VideoInventory} from '../../lib/connected-studio.mjs'
import {isSpeechReferenceVideo,type DealerSpeechProfile} from '../../../../../web/public/dealer-speech-profile.mjs'
import {STUDIO_SPEECH_LINES,studioSpeechLineIds,applyStudioSpeechProfile,studioSpeechLines,studioSpeechBuildCompatibility,studioSpeechMediaUrl,type SpeechBuildPlan,type SpeechBuildResult,type SpeechLanguage} from '../../../../../web/public/studio-speech.mjs'

export interface StudioSpeechPanelProps {
  project:StudioProject
  inventory:VideoInventory
  dealerId:string
  game?:'blackjack'|'roulette'
  blocked?:boolean
  projectDirty?:boolean
  onEdit:(project:StudioProject)=>void
  onBusyChange?:(busy:boolean)=>void
  onDirtyChange?:(dirty:boolean)=>void
}
const messages:Record<string,string>={studio_speech_driver_unavailable:'Den beständiga filbyggaren är inte tillgänglig i denna miljö. Inga krediter har skickats från denna begäran.',studio_speech_revision_conflict:'Projektet har ändrats. Spara eller ladda om och förbered talsetet igen.',studio_speech_profile_unsupported:'Denna sparade dealerprofil saknar en matchande filbyggare.',studio_speech_plan_expired:'Förberedelsen har gått ut eller tillhör en annan inloggning. Förbered på nytt.',studio_speech_access_changed:'Behörigheten har ändrats. Inget ytterligare tal startas.'}
async function request<T>(body:unknown,signal:AbortSignal):Promise<T>{const response=await fetch('/studio/api/speech-build',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});const result=await response.json();if(!response.ok)throw Error(messages[result.error]??'Talbygget kunde inte genomföras. Kontrollera driftkopplingen och din behörighet.');return result as T}

function SpeechResultPreview({result}:{result:SpeechBuildResult}){
  const audio=useRef<HTMLAudioElement>(null),video=useRef<HTMLVideoElement>(null),[error,setError]=useState('')
  useEffect(()=>()=>{audio.current?.pause();video.current?.pause()},[])
  function align(){if(audio.current&&video.current)audio.current.currentTime=Math.max(0,video.current.currentTime-(result.audioDelayMs??0)/1000)}
  async function play(){const sound=audio.current;if(!sound)return;align();sound.playbackRate=video.current?.playbackRate??1;try{await sound.play();setError('')}catch{video.current?.pause();setError('Ljudet kunde inte startas. Tryck på uppspelning igen när ljud och video är laddade.')}}
  if(!studioSpeechMediaUrl(result.videoUrl)||!studioSpeechMediaUrl(result.audioUrl))return <p role="alert">Talsetets skyddade medieadresser kunde inte verifieras.</p>
  return <div><video ref={video} controls muted preload="none" playsInline src={result.videoUrl} className="max-h-52 w-full bg-black object-contain" onPlay={()=>void play()} onPause={()=>audio.current?.pause()} onEnded={()=>audio.current?.pause()} onSeeking={()=>audio.current?.pause()} onSeeked={()=>{align();if(video.current&&!video.current.paused)void play()}} onRateChange={()=>{if(audio.current&&video.current)audio.current.playbackRate=video.current.playbackRate}}/><audio ref={audio} preload="none" src={result.audioUrl}/><p className="mt-1 text-xs text-muted-foreground">Starta videon för att granska ljud och läppsynk tillsammans.</p>{error&&<p role="alert" className="text-xs text-red-400">{error}</p>}</div>
}

export function StudioSpeechPanel(props:StudioSpeechPanelProps){
  const {project,inventory,dealerId,game='blackjack',blocked=false,projectDirty=false,onEdit,onBusyChange,onDirtyChange}=props
  const dealer=project.dealers.find(row=>row.id===dealerId),saved=dealer?.speechProfile
  const [voiceDraft,setVoiceDraft]=useState(initialDealerVoiceDraft(dealer,saved?.voice))
  const [language,setLanguage]=useState<SpeechLanguage>('sv'),[lineId,setLineId]=useState('goodluck'),[all,setAll]=useState(false)
  const allowedLineIds=studioSpeechLineIds(game),selectedLineId=allowedLineIds.includes(lineId)?lineId:allowedLineIds[0]
  const [videoId,setVideoId]=useState(saved?.reference?.videoId??''),[offsetMs,setOffsetMs]=useState(saved?.reference?.offsetMs??0),[enabled,setEnabled]=useState(saved?.state==='enabled')
  const [frameReviewed,setFrameReviewed]=useState(false),[durationMs,setDurationMs]=useState(0)
  const [plan,setPlan]=useState<SpeechBuildPlan|null>(null),[results,setResults]=useState<SpeechBuildResult[]>([])
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
  const [awaitingProjectSave,setAwaitingProjectSave]=useState<string|null>(null)
  const work=useRef<AbortController|null>(null),preview=useRef<HTMLVideoElement>(null),latest=useRef(props)
  latest.current=props
  const savedKey=JSON.stringify(saved??null)
  useEffect(()=>{setVoiceDraft(initialDealerVoiceDraft(dealer,saved?.voice));setVideoId(saved?.reference?.videoId??'');setOffsetMs(saved?.reference?.offsetMs??0);setEnabled(saved?.state==='enabled');setFrameReviewed(false);setPlan(null);setResults([]);setBusy(false);setError('');setNotice('')},[dealerId,savedKey])
  useEffect(()=>{return()=>{work.current?.abort();preview.current?.pause();latest.current.onBusyChange?.(false);latest.current.onDirtyChange?.(false)}},[])
  useEffect(()=>{return()=>{work.current?.abort();work.current=null;latest.current.onBusyChange?.(false)}},[dealerId])
  useEffect(()=>{setAwaitingProjectSave(null)},[dealerId])
  useEffect(()=>{if(lineId!==selectedLineId)setLineId(selectedLineId)},[game,lineId,selectedLineId])
  useEffect(()=>{if(awaitingProjectSave!==null&&project.revision!==awaitingProjectSave)setAwaitingProjectSave(null)},[project.revision,awaitingProjectSave])
  const videos=inventory.videos.filter(row=>isSpeechReferenceVideo(row,dealerId)),selected=videos.find(row=>row.id===videoId)
  const sourceKey=selected?selected.id+':'+(selected as typeof selected&{sha256?:string}).sha256:''
  const referenceUnchanged=Boolean((!enabled||saved?.state==='enabled')&&selected&&saved?.reference?.videoId===selected.id&&saved.reference.sha256===(selected as typeof selected&{sha256?:string}).sha256&&saved.reference.offsetMs===offsetMs)
  const profileDirty=JSON.stringify(voiceDraft)!==JSON.stringify(dealerVoiceDraft(saved?.voice))||videoId!==(saved?.reference?.videoId??'')||offsetMs!==(saved?.reference?.offsetMs??0)||enabled!==(saved?.state==='enabled')
  useEffect(()=>{onDirtyChange?.(profileDirty)},[profileDirty,onDirtyChange])
  useEffect(()=>{setFrameReviewed(false);setDurationMs(0)},[sourceKey])
  useEffect(()=>{setFrameReviewed(false);const video=preview.current;if(video&&video.readyState>=1)video.currentTime=offsetMs/1000},[sourceKey,offsetMs])
  useEffect(()=>{setPlan(null);setResults([])},[game])
  useEffect(()=>{setPlan(null)},[project.revision,dealerId,savedKey,language,lineId,all,profileDirty,projectDirty,game])
  function readyFrame(){const video=preview.current;if(video&&video.readyState>=2&&!video.seeking&&Math.abs(video.currentTime*1000-offsetMs)<60)setFrameReviewed(true)}
  function saveProfile(){try{if(blocked||busy||!dealer)return;if(videoId&&!referenceUnchanged&&(!selected||!frameReviewed||durationMs<1||offsetMs>=durationMs))throw Error('Granska vald position i dealerns egen referensvideo innan du lägger profilen i utkastet.');
    const reference=referenceUnchanged?saved!.reference:selected?{kind:'video-frame',videoId:selected.id,sha256:(selected as typeof selected&{sha256:string}).sha256,offsetMs}:null
    const voice=dealerVoiceFromDraft(voiceDraft)
    onEdit(applyStudioSpeechProfile(project,inventory,dealerId,{schemaVersion:2,state:enabled?'enabled':'preparation',voice,reference}))
    setAwaitingProjectSave(project.revision)
    setNotice('Talprofilen ligger i utkastet. Spara projektet för att behålla den.');setError('')
  }catch(cause){setError(cause instanceof Error?cause.message:'Profilen kunde inte ändras.')}}
  async function prepare(){if(blocked||busy||projectDirty||profileDirty||awaitingProjectSave!==null)return;const controller=new AbortController();work.current=controller;setBusy(true);onBusyChange?.(true);setError('');setResults([])
    try{const value=await request<{plan:SpeechBuildPlan}>({operation:'prepare',dealerId,expectedRevision:project.revision,language,lineIds:all?allowedLineIds:[selectedLineId]},controller.signal);if(!controller.signal.aborted&&(latest.current.game??'blackjack')===game&&!latest.current.projectDirty&&latest.current.dealerId===value.plan.dealerId&&latest.current.project.revision===value.plan.revision)setPlan(value.plan)}catch(cause){if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:'Förberedelsen misslyckades.')}finally{if(work.current===controller)work.current=null;if(!controller.signal.aborted){setBusy(false);onBusyChange?.(false)}}}
  async function build(){if(!plan?.configured||blocked||busy||projectDirty||profileDirty||awaitingProjectSave!==null)return;const controller=new AbortController();work.current=controller;setBusy(true);onBusyChange?.(true);setError('');setNotice('Bygger valda talset i ordning. En misslyckad eller osäker begäran stoppar resten av batchen.')
    try{const value=await request<{state:string;results:SpeechBuildResult[];error?:string}>({operation:'build',token:plan.token},controller.signal);if(!controller.signal.aborted){setResults(value.results);setPlan(null);setNotice(value.state==='succeeded'?'Talseten är klara för granskning.':'Bygget stoppades. Klara talset finns kvar nedan.');if(value.error)setError(messages[value.error]??'Bygget misslyckades. Ingen automatisk omkörning görs.')}}catch(cause){if(!controller.signal.aborted){setPlan(null);setError(cause instanceof Error?cause.message:'Bygget misslyckades.')}}finally{if(work.current===controller)work.current=null;if(!controller.signal.aborted){setBusy(false);onBusyChange?.(false)}}}
  if(!dealer)return <section className="studio-detail-panel"><p>Välj en registrerad dealer.</p></section>
  const match=studioSpeechBuildCompatibility(project,dealerId),caption=studioSpeechLines(language,[selectedLineId])[0],previewUrl=studioSpeechMediaUrl(selected?.previewUrl)
  return <section className="studio-detail-panel" aria-label={`Röst och talset för ${dealer.label}`}>
    <div><span className="text-xs uppercase tracking-wide text-muted-foreground">Tal · {dealer.label}</span><h2 className="mt-1 text-lg font-semibold">Röst och läppsynk</h2></div>
    <p className="text-sm text-muted-foreground">Välj röst och dealerns egen videoreferens. Ändringarna sparas i projektutkastet.</p>
    <fieldset disabled={blocked||busy} className="space-y-3">
      <DealerVoicePicker dealer={dealer} value={voiceDraft} onChange={value=>{setVoiceDraft(value);if(!value.provider||!value.voiceId.trim()||!value.modelId.trim())setEnabled(false);}} fieldClass="studio-field"/>
      <label className="studio-field">Dealerns egen referensvideo<select value={videoId} onChange={event=>{setVideoId(event.target.value);if(!event.target.value)setEnabled(false);}}><option value="">Inte vald</option>{videos.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}</select></label>
      {!!selected&&<><label className="studio-field">Referensposition, millisekunder<input type="number" min={0} max={Math.max(0,durationMs-1)} step={1} value={offsetMs} onChange={event=>setOffsetMs(Number(event.target.value))}/></label>{previewUrl?<video ref={preview} src={previewUrl} controls muted playsInline preload="metadata" className="max-h-44 w-full rounded-md bg-black object-contain" onLoadedMetadata={()=>{const video=preview.current;if(video){setDurationMs(Math.round(video.duration*1000));video.currentTime=offsetMs/1000}}} onLoadedData={readyFrame} onSeeked={readyFrame} onTimeUpdate={()=>{const video=preview.current;if(video&&Math.abs(video.currentTime*1000-offsetMs)>60)setFrameReviewed(false)}}/>:<p className="text-sm">Referensen har ingen verifierad förhandsvisningsadress.</p>}<p className="text-xs text-muted-foreground">{frameReviewed?'Vald referensposition har visats.':'Visa vald position innan profilen läggs i utkastet.'}</p></>}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={enabled} disabled={!selected||!voiceDraft.provider||!voiceDraft.voiceId.trim()||!voiceDraft.modelId.trim()||Boolean(saved?.reference?.kind==='motion-video'&&referenceUnchanged)} onChange={event=>setEnabled(event.target.checked)}/>Begär AI-tal med denna sparade profil</label>
      <button className="studio-button" type="button" disabled={!profileDirty||Boolean(videoId&&!referenceUnchanged&&!frameReviewed)} onClick={saveProfile}>Lägg talprofil i utkast</button>
    </fieldset>
    {game==='roulette'&&<p className="mt-3 text-xs text-muted-foreground">Talprofilen hör till dealern. Dealerchatt med läppsynk är ännu inte ansluten i roulettevyn.</p>}
    <details className="mt-5 border-t border-border pt-4"><summary>Talbibliotek · inspelade repliker</summary><div className="mt-3"><h3 className="font-semibold">{game==='roulette'?'Gemensamt talbibliotek':'Exakta repliker'} · {allowedLineIds.length} {game==='roulette'?'repliker':'platser'}</h3><p className="mt-1 text-xs text-muted-foreground">SV och EN är separata genereringsmallar. Befintligt inspelat material behåller sin ursprungliga text och sitt godkännande.</p>{game==='roulette'&&<p className="mt-1 text-xs text-muted-foreground">Spelneutrala biblioteksrepliker. Koppling till roulettehändelser och automatisk uppspelning ingår inte.</p>}
      <fieldset disabled={blocked||busy} className="mt-3 space-y-3"><div className="grid grid-cols-2 gap-3"><label className="studio-field">Språk<select value={language} onChange={event=>setLanguage(event.target.value as SpeechLanguage)}><option value="sv">Svenska · SV</option><option value="en">English · EN</option></select></label><label className="studio-field">{game==='roulette'?'Biblioteksreplik':'Replikplats'}<select value={selectedLineId} onChange={event=>setLineId(event.target.value)}>{STUDIO_SPEECH_LINES.filter(row=>allowedLineIds.includes(row.id)).map(row=><option key={row.id} value={row.id}>{row.label}</option>)}</select></label></div><label className="studio-field">Exakt text<textarea rows={3} readOnly value={caption.exactText}/></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={all} onChange={event=>setAll(event.target.checked)}/>Förbered alla {allowedLineIds.length} repliker på {language==='sv'?'svenska':'engelska'}</label><p className="text-xs text-muted-foreground">{match.message}</p><button className="studio-button" type="button" disabled={!match.supported||projectDirty||profileDirty||awaitingProjectSave!==null} onClick={()=>void prepare()}>Förbered {all?`${allowedLineIds.length} talset`:'valt talset'}</button></fieldset>
      {(projectDirty||profileDirty||awaitingProjectSave!==null)&&<p className="mt-2 text-xs text-muted-foreground">Lägg profilen i utkastet och spara projektet innan ett bygge förbereds.</p>}
      {plan&&<div className="mt-4 space-y-2 rounded-lg border border-border p-3"><strong className="text-sm">Förberett · {plan.lines.length} talset · {plan.language.toUpperCase()}</strong><div className="max-h-48 space-y-2 overflow-auto">{plan.lines.map(line=><p key={line.id} className="text-xs"><span className="text-muted-foreground">{line.label}: </span>{line.exactText}</p>)}</div><p className="text-xs text-muted-foreground">Röst: {plan.voice.name} · {plan.voice.voiceId}. Bygget kan förbruka röst- och GPU-krediter. Varje replik byggs en gång med denna förberedelse.</p>{!plan.configured&&<p className="text-sm" role="status">Den beständiga filbyggaren är inte ansluten i denna miljö. Förberedelsen har inte startat någon betald generering.</p>}<button className="studio-button" type="button" disabled={blocked||busy||!plan.configured||projectDirty||profileDirty||awaitingProjectSave!==null} onClick={()=>void build()}>Bygg {plan.lines.length} talset</button></div>}
    </div></details>
    {busy&&<p role="status" className="mt-3 text-sm">Behandlar talset…</p>}{notice&&<p role="status" className="mt-3 text-sm">{notice}</p>}{error&&<p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
    {results.length>0&&<div className="mt-4 space-y-4">{results.map(result=><article key={result.lineId} className="rounded-lg border border-border p-3"><strong className="text-sm">{STUDIO_SPEECH_LINES.find(row=>row.id===result.lineId)?.label} · {result.state==='succeeded'?'Granskning återstår':'Misslyckad'}</strong><p className="my-2 text-sm">{result.exactText}</p>{result.state==='succeeded'?<><SpeechResultPreview result={result}/><p className="mt-2 text-xs text-muted-foreground">{result.frameCount} bilder · {result.fps} fps · ljudfördröjning {result.audioDelayMs} ms · {result.calibrationRevision}. Granska två uppspelningar i följd. Godkännande och publicering återstår.</p><details className="mt-2 text-xs"><summary>Talsetets identitet</summary><p className="break-all">Text: {result.textSha256}<br/>Ljud: {result.audioSha256}<br/>Video: {result.videoSha256}</p></details></>:<p className="text-sm text-red-400">{messages[result.error??'']??'Ingen automatisk omkörning görs.'}</p>}</article>)}</div>}

  </section>
}
