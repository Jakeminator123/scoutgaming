"use client"

import {useEffect,useRef,useState} from 'react'
import {DealerVoicePicker} from '../../../../components/dealer-voice-picker'
import {DealerVoiceProfile} from './dealer-voice-profile'
import {dealerVoiceDraft,dealerVoiceFromDraft,initialDealerVoiceDraft} from '../../../../../../packages/presentation/contracts/dealer-voice-catalog.mjs'
import type {StudioProject} from '../../../../../../packages/presentation/contracts/studio-model.mjs'
import {bindClip,clipSlots,clipsForSlot,currentClipId,type ClipSlot,type VideoInventory} from '../../lib/connected-studio.mjs'
import {speechSlotVideoFits} from '../../../../../../packages/presentation/contracts/speech-slot-bindings.mjs'
import {dealerSpeechReferenceCheck,isSpeechReferenceVideo,type DealerSpeechProfile} from '../../../../../../packages/presentation/contracts/dealer-speech-profile.mjs'
import {STUDIO_SPEECH_LINES,studioSpeechLineIds,applyStudioSpeechProfile,studioSpeechLines,studioSpeechBuildCompatibility,studioSpeechMediaUrl,studioRecordedSpeech,studioRecordedSpeechGroups,studioRecordedSpeechStatus,studioRecordedSpeechPreferredTake,studioGeneratedSpeechAvailable,studioRecordedSpeechReviewRequest,type StudioRecordedSpeech,type StudioRecordedSpeechLine,type StudioRecordedSpeechVerdict,type SpeechBuildPlan,type SpeechBuildResult,type SpeechLanguage} from '../../../../../../packages/presentation/contracts/studio-speech.mjs'

export interface StudioSpeechPanelProps {
  project:StudioProject
  inventory:VideoInventory
  dealerId:string
  game?:'blackjack'|'roulette'
  active?:boolean
  blocked?:boolean
  projectDirty?:boolean
  onEdit:(project:StudioProject)=>void
  /** Dealers with a drift profile and bank hash in this environment (T5); motion references may only be enabled for these. */
  movingSpeechDealers?:readonly string[]
  /** Present where the caller accepts a server-saved project (Röstprofil). */
  onProjectSaved?:(project:StudioProject)=>void
  /** Present only where the caller replaces its inventory after a server review write. */
  onInventory?:(inventory:VideoInventory)=>void
  onBusyChange?:(busy:boolean)=>void
  onDirtyChange?:(dirty:boolean)=>void
}
const messages:Record<string,string>={studio_speech_driver_unavailable:'Den beständiga filbyggaren är inte tillgänglig här. Inga krediter har skickats från denna begäran.',studio_speech_revision_conflict:'Projektet har ändrats. Spara eller ladda om och förbered talsetet igen.',studio_speech_profile_unsupported:'Denna sparade dealerprofil saknar en matchande filbyggare.',studio_speech_plan_expired:'Förberedelsen har gått ut eller tillhör en annan inloggning. Förbered på nytt.',studio_speech_access_changed:'Behörigheten har ändrats. Inget ytterligare tal startas.'}
async function request<T>(body:unknown,signal:AbortSignal):Promise<T>{const response=await fetch('/studio/api/speech-build',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});const result=await response.json();if(!response.ok)throw Error(messages[result.error]??'Talbygget kunde inte genomföras. Kontrollera driftkopplingen och din behörighet.');return result as T}

function SpeechResultPreview({result,active}:{result:SpeechBuildResult;active:boolean}){
  const audio=useRef<HTMLAudioElement>(null),video=useRef<HTMLVideoElement>(null),[error,setError]=useState('')
  useEffect(()=>()=>{audio.current?.pause();video.current?.pause()},[])
  useEffect(()=>{if(!active){audio.current?.pause();video.current?.pause()}},[active])
  function align(){if(audio.current&&video.current)audio.current.currentTime=Math.max(0,video.current.currentTime-(result.audioDelayMs??0)/1000)}
  async function play(){const sound=audio.current;if(!sound)return;align();sound.playbackRate=video.current?.playbackRate??1;try{await sound.play();setError('')}catch{video.current?.pause();setError('Ljudet kunde inte startas. Tryck på uppspelning igen när ljud och video är laddade.')}}
  if(!studioSpeechMediaUrl(result.videoUrl)||!studioSpeechMediaUrl(result.audioUrl))return <p role="alert">Talsetets skyddade medieadresser kunde inte verifieras.</p>
  return <div><video ref={video} controls muted preload="none" playsInline src={result.videoUrl} className="max-h-52 w-full bg-black object-contain" onPlay={()=>void play()} onPause={()=>audio.current?.pause()} onEnded={()=>audio.current?.pause()} onSeeking={()=>audio.current?.pause()} onSeeked={()=>{align();if(video.current&&!video.current.paused)void play()}} onRateChange={()=>{if(audio.current&&video.current)audio.current.playbackRate=video.current.playbackRate}}/><audio ref={audio} preload="none" src={result.audioUrl}/><p className="mt-1 text-xs text-muted-foreground">Starta videon för att granska ljud och läppsynk tillsammans.</p>{error&&<p role="alert" className="text-xs text-red-400">{error}</p>}</div>
}


const recordedReview:Record<StudioRecordedSpeech['review'],string>={
  'missing-proof':'Ingen exakt text och ingen mätning av bild och ljud är registrerad ännu, så tagningen kan inte godkännas här.',
  'invalid-proof':'Granskningskvittot matchar inte den registrerade filen.',
  unavailable:'Filen är otillgänglig; godkännandet kan inte verifieras.',
  pending:'Spela tagningen med ljud och bedöm den nedan.',rejected:'En underkänd tagning spelas inte.',approved:'Godkännandet gäller exakt denna fil.',
}
const OTHER_FILES='__other'
const languageName=(code:string)=>code==='sv'?'Svenska':code==='en'?'English':code.toUpperCase()
const takeName=(row:StudioRecordedSpeech)=>row.take===null?row.label:'Tagning '+row.take
const reviewErrors:Record<string,string>={studio_speech_source_unverified:'Filens bild- och ljudspår är inte kontrollerade. Mät speltiden under filinställningarna först.',studio_speech_identity_changed:'Tagningen har ändrats sedan den visades. Läs om registret och granska den igen.',studio_speech_take_missing:'Tagningen finns inte längre i detta talfack. Läs om registret.',studio_conflict:'Filen har ändrats. Läs om registret och granska den igen.'}
async function reviewTake(body:unknown):Promise<{inventory:VideoInventory}>{const response=await fetch('/studio/api/videos/speech-review',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const result=await response.json().catch(()=>({}));if(!response.ok)throw Error(reviewErrors[result.code]??(response.status===401||response.status===403?'Du saknar behörighet eller behöver logga in igen.':'Bedömningen kunde inte sparas. Läs om registret innan du försöker igen.'));return result}

function RecordedSpeechPreview({row,active}:{row:StudioRecordedSpeech;active:boolean}){
  const player=useRef<HTMLMediaElement|null>(null),[error,setError]=useState('')
  useEffect(()=>{if(!active)player.current?.pause();return()=>{player.current?.pause()}},[active])
  if(!row.available||!row.url)return <p role="alert" className="text-sm text-red-400">Filen kan inte spelas från registret. Läs om registret eller kontrollera filen i dealerbiblioteket.</p>
  const attributes={controls:true,preload:'none',src:row.url,'aria-label':'Inspelning: '+row.label,onLoadedData:()=>setError(''),onError:()=>setError('Filen kunde inte spelas. Kontrollera den i dealerbiblioteket.')}
  return <div className="space-y-2">{row.audio?<audio ref={element=>{player.current=element}} {...attributes}/>:<video ref={element=>{player.current=element}} {...attributes} muted={false} playsInline className="max-h-52 w-full rounded-md bg-black object-contain"/>}<p className="text-xs text-muted-foreground">{row.audio?'Ljudfil · ingen talvideo i denna fil.':'Spela med ljud för att granska den valda filmens tal och bild.'}</p>{error&&<p role="alert" className="text-sm text-red-400">{error}</p>}</div>
}

export function StudioSpeechPanel(props:StudioSpeechPanelProps){
  const {project,inventory,dealerId,game='blackjack',active=true,blocked=false,projectDirty=false,onEdit,movingSpeechDealers,onProjectSaved,onInventory,onBusyChange,onDirtyChange}=props
  const dealer=project.dealers.find(row=>row.id===dealerId),saved=dealer?.speechProfile
  const [voiceDraft,setVoiceDraft]=useState(initialDealerVoiceDraft(dealer,saved?.voice))
  const [recordedId,setRecordedId]=useState(''),[lineChoice,setLineChoice]=useState(''),[languageChoice,setLanguageChoice]=useState('')
  const recordings=studioRecordedSpeech(project,inventory,dealerId,game),groups=studioRecordedSpeechGroups(recordings,game)
  // Default: first line with files, Svenska before English, highest take first.
  const pickable=[...groups.lines.filter(row=>row.languages.some(group=>group.takes.length)).map(row=>row.id),...(groups.other.length?[OTHER_FILES]:[])]
  const openLineId=pickable.includes(lineChoice)?lineChoice:pickable[0]??'',openLine=groups.lines.find(row=>row.id===openLineId)
  const openLanguage=openLine?.languages.find(group=>group.language===languageChoice&&group.takes.length)??openLine?.languages.find(group=>group.takes.length)
  const takes=openLineId===OTHER_FILES?groups.other:openLanguage?.takes??[]
  // Talfack standards go through the clip map's own bindClip path into the draft.
  let speechSlots:ClipSlot[]=[]
  try{speechSlots=game==='blackjack'?clipSlots(project,inventory,dealerId,game).filter(slot=>slot.sourceType==='speak'&&!slot.family):[]}catch{speechSlots=[]}
  const slotFor=(lineId:string)=>speechSlots.find(slot=>slot.situation===lineId)
  const standardOf=(lineId:string)=>{const slot=slotFor(lineId);if(!slot)return null;try{return currentClipId(project,dealerId,slot,undefined,inventory)}catch{return ''}}
  const standardLabel=(id:string)=>recordings.find(row=>row.id===id)?.label??inventory.videos.find(row=>row.id===id)?.label??id
  // A shown take stays selected (see the pin effect); only a new line/language or
  // a vanished take re-runs this: standard, approved, receipt awaiting review, highest number.
  const recorded=takes.find(row=>row.id===recordedId)??studioRecordedSpeechPreferredTake(takes,openLineId===OTHER_FILES?null:standardOf(openLineId))
  const [standardNotice,setStandardNotice]=useState(''),[standardError,setStandardError]=useState('')
  function standardBlocker(row:StudioRecordedSpeech){
    const slot=slotFor(row.situation),video=inventory.videos.find(item=>item.id===row.id)
    if(!slot)return 'Talfacket finns inte i projektet.'
    if(video&&clipsForSlot(inventory,dealerId,slot).some(item=>item.id===row.id)&&speechSlotVideoFits(video,{dealerId,eventId:slot.eventId,situation:slot.situation,requireRecordedSpeech:slot.eventId==='speak.other'}))return ''
    return slot.eventId==='speak.other'&&!video?.classification?.recordedSpeech?'Detta talfack kräver ett talkvitto (exakt text och inspelningsidentitet) innan tagningen kan bli standard.':'Filen passar inte detta talfack.'
  }
  function setStandard(row:StudioRecordedSpeech){const slot=slotFor(row.situation);if(!slot||blocked||busy||reviewBusy)return
    try{onEdit(bindClip(project,inventory,dealerId,slot,row.id));setStandardError('');setStandardNotice('Tagningen är standard i talfacket i utkastet. Spara utkastet och använd Publicera i spelbordet för att använda den.')}
    catch(cause){setStandardNotice('');setStandardError(cause instanceof Error?cause.message:'Standarden kunde inte sättas.')}}
  const [language,setLanguage]=useState<SpeechLanguage>('sv'),[lineId,setLineId]=useState('goodluck'),[all,setAll]=useState(false)
  const allowedLineIds=studioSpeechLineIds(game),selectedLineId=allowedLineIds.includes(lineId)?lineId:allowedLineIds[0]
  const [videoId,setVideoId]=useState(saved?.reference?.videoId??''),[offsetMs,setOffsetMs]=useState(saved?.reference?.offsetMs??0),[enabled,setEnabled]=useState(saved?.state==='enabled')
  const [kindChoice,setKindChoice]=useState<'video-frame'|'motion-video'>(saved?.reference?.kind??'video-frame')
  const [frameReviewed,setFrameReviewed]=useState(false),[durationMs,setDurationMs]=useState(0)
  const [referenceError,setReferenceError]=useState('')
  const [plan,setPlan]=useState<SpeechBuildPlan|null>(null),[results,setResults]=useState<SpeechBuildResult[]>([])
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
  const [awaitingProjectSave,setAwaitingProjectSave]=useState<string|null>(null)
  const [reviewBusy,setReviewBusy]=useState(false),[reviewError,setReviewError]=useState(''),[reviewNotice,setReviewNotice]=useState('')
  const work=useRef<AbortController|null>(null),preview=useRef<HTMLVideoElement>(null),latest=useRef(props)
  latest.current=props
  useEffect(()=>{if(!active)preview.current?.pause()},[active])
  const savedKey=JSON.stringify(saved??null)
  useEffect(()=>{setVoiceDraft(initialDealerVoiceDraft(dealer,saved?.voice));setVideoId(saved?.reference?.videoId??'');setKindChoice(saved?.reference?.kind??'video-frame');setOffsetMs(saved?.reference?.offsetMs??0);setEnabled(saved?.state==='enabled');setFrameReviewed(false);setPlan(null);setResults([]);setBusy(false);setError('');setNotice('')},[dealerId,savedKey])
  useEffect(()=>{return()=>{work.current?.abort();preview.current?.pause();latest.current.onBusyChange?.(false);latest.current.onDirtyChange?.(false)}},[])
  useEffect(()=>{return()=>{work.current?.abort();work.current=null;latest.current.onBusyChange?.(false)}},[dealerId])
  useEffect(()=>{setAwaitingProjectSave(null)},[dealerId])
  useEffect(()=>{setReviewError('');setReviewNotice('');setStandardError('');setStandardNotice('')},[dealerId,recorded?.id])
  useEffect(()=>{if(recorded&&recorded.id!==recordedId)setRecordedId(recorded.id)},[recorded?.id,recordedId])
  useEffect(()=>{if(lineId!==selectedLineId)setLineId(selectedLineId)},[game,lineId,selectedLineId])
  useEffect(()=>{if(awaitingProjectSave!==null&&project.revision!==awaitingProjectSave)setAwaitingProjectSave(null)},[project.revision,awaitingProjectSave])
  const videos=inventory.videos.filter(row=>isSpeechReferenceVideo(row,dealerId)),selected=videos.find(row=>row.id===videoId)
  const referenceCheck=dealerSpeechReferenceCheck(selected,dealerId)
  const sourceKey=selected?selected.id+':'+(selected as typeof selected&{sha256?:string}).sha256:''
  const referenceKind=kindChoice,movingBank=Boolean(movingSpeechDealers?.includes(dealerId))
  // A motion profile may be switched on only against this environment's verified bank; an already enabled one stays as saved.
  const motionBlocked=referenceKind==='motion-video'&&!movingBank&&!(saved?.state==='enabled'&&saved.reference?.kind==='motion-video')
  const referenceUnchanged=Boolean((!enabled||saved?.state==='enabled')&&selected&&saved?.reference?.videoId===selected.id&&saved.reference.kind===referenceKind&&saved.reference.sha256===(selected as typeof selected&{sha256?:string}).sha256&&saved.reference.offsetMs===offsetMs)
  const changedEnabledMotion=enabled&&saved?.state==='enabled'&&saved.reference?.kind==='motion-video'&&!referenceUnchanged
  const referenceDirty=videoId!==(saved?.reference?.videoId??'')||Boolean(videoId)&&referenceKind!==(saved?.reference?.kind??'video-frame')||offsetMs!==(saved?.reference?.offsetMs??0)||enabled!==(saved?.state==='enabled')||Boolean(selected&&saved?.reference&&(selected as typeof selected&{sha256?:string}).sha256!==saved.reference.sha256)
  const profileDirty=JSON.stringify(voiceDraft)!==JSON.stringify(dealerVoiceDraft(saved?.voice))||referenceDirty
  // Suggestions can be left untouched; applying one still requires the normal save flow.
  const formDirty=JSON.stringify(voiceDraft)!==JSON.stringify(initialDealerVoiceDraft(dealer,saved?.voice))||referenceDirty
  useEffect(()=>{onDirtyChange?.(formDirty)},[formDirty,onDirtyChange])
  useEffect(()=>{setFrameReviewed(false);setDurationMs(0);setReferenceError('')},[sourceKey])
  useEffect(()=>{setFrameReviewed(false);const video=preview.current;if(video&&video.readyState>=1)video.currentTime=offsetMs/1000},[sourceKey,offsetMs])
  useEffect(()=>{setPlan(null);setResults([])},[game])
  useEffect(()=>{setPlan(null)},[project.revision,dealerId,savedKey,language,lineId,all,profileDirty,projectDirty,game])
  async function review(verdict:StudioRecordedSpeechVerdict){if(!recorded?.speech||!onInventory||blocked||busy||reviewBusy)return;setReviewBusy(true);onBusyChange?.(true);setReviewError('');setReviewNotice('')
    try{const result=await reviewTake(studioRecordedSpeechReviewRequest(recorded,dealerId,verdict));onInventory(result.inventory);if(latest.current.dealerId===dealerId)setReviewNotice(verdict==='approved'?'Talet är godkänt. Använd Publicera i spelbordet för att använda tagningen.':verdict==='rejected'?'Tagningen är underkänd och spelas inte.':'Bedömningen är borttagen. Tagningen väntar på granskning.')}
    catch(cause){if(latest.current.dealerId===dealerId)setReviewError((cause instanceof Error?cause.message:'Bedömningen kunde inte sparas.'))}finally{setReviewBusy(false);onBusyChange?.(false)}}
  function readyFrame(){const video=preview.current;if(video&&video.readyState>=2&&!video.seeking&&Math.abs(video.currentTime*1000-offsetMs)<60){setFrameReviewed(true);setReferenceError('')}}
  function saveProfile(){try{if(blocked||busy||!dealer)return;if(changedEnabledMotion)throw Error('Stäng av Begär AI-tal innan du sparar en ändrad rörelsereferens.');if(enabled&&motionBlocked)throw Error('Rörligt tal kräver en verifierad bank för dealern i denna miljö.');if(enabled&&(!referenceCheck.canEnable||referenceError))throw Error(referenceError||referenceCheck.message);if(videoId&&!referenceUnchanged&&(!selected||!frameReviewed||durationMs<1||offsetMs>=durationMs))throw Error('Granska vald position i dealerns egen referensvideo innan du lägger profilen i utkastet.');
    const reference=referenceUnchanged?saved!.reference:selected?{kind:referenceKind,videoId:selected.id,sha256:(selected as typeof selected&{sha256:string}).sha256,offsetMs}:null
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
  const match=studioSpeechBuildCompatibility(project,dealerId),generatedVoice=studioGeneratedSpeechAvailable(project,dealerId),caption=studioSpeechLines(language,[selectedLineId])[0],previewUrl=studioSpeechMediaUrl(selected?.previewUrl)
  const lineSummary=(line:StudioRecordedSpeechLine)=>{const counts=line.languages.filter(group=>group.takes.length).map(group=>group.language.toUpperCase()+' '+group.takes.length),approved=line.languages.reduce((sum,group)=>sum+group.takes.filter(row=>row.available&&row.review==='approved').length,0);const standard=standardOf(line.id);return [counts.length?counts.join(' · ')+(approved?` · ${approved} godkända`:''):'Ingen inspelning',...(standard===null?[]:[standard?'Standard: '+standardLabel(standard):'Ingen standard'])].join(' · ')}
  const lineButton='flex w-full flex-wrap items-baseline justify-between gap-x-3 px-3 py-2 text-left text-sm disabled:opacity-60'
  const takeDetail=recorded&&<article className="space-y-2 rounded-lg border border-border p-3"><strong className="text-sm">{openLineId===OTHER_FILES?recorded.label:takeName(recorded)}{recorded.language?' · '+languageName(recorded.language.split('-')[0]):''}</strong><p className="text-xs text-muted-foreground">{recorded.label} · {recorded.contentType||'Format saknas'}{recorded.languageNoted?' · språk enligt importanteckningen':''}</p>
          <p className="text-sm font-medium" data-attestation={recorded.review==='approved'?'human':undefined}>{studioRecordedSpeechStatus(recorded)}</p><p className="text-xs text-muted-foreground">{recordedReview[recorded.review]}</p>
          {recorded.speech?.schemaVersion===2&&<p className="text-xs text-muted-foreground">Bild och ljud finns i samma MP4. {recorded.speech.source.status==='verified-embedded-av'?'Filens bild- och ljudspår är kontrollerade.':'Filkontroll återstår.'}</p>}
          <p className="text-xs text-muted-foreground">Registrerad text</p><p className="text-sm">{recorded.exactText||'Ingen exakt text registrerad. Genereringsmallar ersätter inte filmens tal.'}</p>
          <RecordedSpeechPreview key={recorded.id+':'+recorded.sha256} row={recorded} active={active}/>
          {openLineId!==OTHER_FILES&&slotFor(recorded.situation)&&(()=>{const standard=standardOf(recorded.situation),isStandard=standard===recorded.id,blocker=isStandard?'':standardBlocker(recorded)
            return <div className="space-y-1" aria-label="Standard i talfacket"><p className="text-xs text-muted-foreground">{standard?'Standard i talfacket: '+standardLabel(standard)+(isStandard?' (denna tagning)':''):'Ingen standard i talfacket ännu.'}</p>
              <button className="studio-button" type="button" data-action="set-standard" disabled={blocked||busy||reviewBusy||isStandard||Boolean(blocker)} onClick={()=>setStandard(recorded)}>Sätt som standard i talfacket</button>
              {blocker&&<p className="text-xs text-muted-foreground">{blocker}</p>}{standardNotice&&<p role="status" className="text-xs">{standardNotice}</p>}{standardError&&<p role="alert" className="text-xs text-red-400">{standardError}</p>}</div>})()}
          {recorded.speech&&onInventory&&<fieldset disabled={blocked||busy||reviewBusy} className="space-y-2" aria-label="Bedöm tagningen">
            <p className="text-xs text-muted-foreground">Spela tagningen med ljud innan du bedömer den. Godkännandet är ditt intyg om att du har sett och hört just denna fil. Det mäter inte läppsynk och publicerar inget. En underkänd tagning spelas inte.</p>
            <div className="flex flex-wrap gap-2">
              <button className="studio-button" type="button" data-action="approve" disabled={!recorded.available||recorded.speech.review.status==='approved'||(recorded.speech.schemaVersion===2?recorded.speech.source.status!=='verified-embedded-av':recorded.speech.recording.status!=='verified-recording')} onClick={()=>void review('approved')}>Godkänn tal</button>
              <button className="studio-button" type="button" data-action="reject" disabled={recorded.speech.review.status==='rejected'} onClick={()=>void review('rejected')}>Underkänn</button>
              {recorded.speech.review.status!=='pending'&&<button className="studio-button" type="button" data-action="clear-review" onClick={()=>void review(null)}>Ta bort bedömning</button>}
            </div>
            {reviewBusy&&<p role="status" className="text-xs">Sparar bedömningen…</p>}{reviewNotice&&<p role="status" className="text-xs">{reviewNotice}</p>}{reviewError&&<p role="alert" className="text-xs text-red-400">{reviewError}</p>}
          </fieldset>}
          <details className="text-xs"><summary>Detaljer · fil och granskning</summary><dl className="mt-2 space-y-1 break-all">
            <dt>Fil-ID</dt><dd>{recorded.id}</dd><dt>Video-/filhash</dt><dd>{recorded.sha256||'Saknas'}</dd>
            {recorded.speech&&<>
              <dt>Tagning</dt><dd>{recorded.speech.takeId}</dd>
              {recorded.speech.schemaVersion===2?<>
                <dt>Bildspår / ljudspår</dt><dd>{recorded.speech.videoTrackId} / {recorded.speech.audioTrackId}</dd>
                {recorded.speech.source.status==='verified-embedded-av'&&<><dt>Filkontroll · ansvarig och tid</dt><dd>{recorded.speech.source.by} · {recorded.speech.source.at}</dd></>}
              </>:<><dt>Ljudhash i kvittot</dt><dd>{recorded.speech.audioSha256}</dd><dt>Kalibrering</dt><dd>{recorded.speech.calibrationRevision}</dd></>}
              {recorded.speech.review.status!=='pending'&&<><dt>Granskare och tid</dt><dd>{recorded.speech.review.by} · {recorded.speech.review.at}</dd></>}
            </>}
          </dl></details>
        </article>
  return <section className="studio-detail-panel" aria-label={`Röst och talset för ${dealer.label}`}>
    <div><span className="text-xs uppercase tracking-wide text-muted-foreground">Tal · {dealer.label}</span><h2 className="mt-1 text-lg font-semibold">Röst &amp; tal</h2></div>
    {onProjectSaved&&<DealerVoiceProfile project={project} dealer={dealer} blocked={blocked||busy} projectDirty={projectDirty||formDirty} onSaved={onProjectSaved}/>}
    <section className="mt-4 space-y-3" aria-label="Inspelat tal">
      <h3 className="font-semibold">Inspelat tal</h3>
      {recordings.length?<><p className="text-sm">{recordings.length} filer · {recordings.filter(row=>row.available&&row.review==='approved').length} godkända. Välj replik, språk och tagning. Högsta tagningsnumret står först; förvald är standardtagningen i talfacket, annars den godkända eller granskningsbara tagningen.</p>
        <ul className="divide-y divide-border rounded-lg border border-border" aria-label="Repliker">
          {groups.lines.map(line=><li key={line.id}>
            <button type="button" className={lineButton} aria-expanded={line.id===openLineId} disabled={!pickable.includes(line.id)} onClick={()=>{setLineChoice(line.id);setRecordedId('')}}><span className="font-medium">{line.label}</span><span className="text-xs text-muted-foreground">{lineSummary(line)}</span></button>
            {line.id===openLineId&&<div className="space-y-3 border-t border-border p-3">
              <div role="tablist" aria-label={'Språk · '+line.label} className="flex flex-wrap gap-2">{line.languages.map(group=><button key={group.language} type="button" role="tab" className="studio-button" aria-selected={group===openLanguage} disabled={!group.takes.length} onClick={()=>{setLanguageChoice(group.language);setRecordedId('')}}>{languageName(group.language)} · {group.takes.length}</button>)}</div>
              <ul className="space-y-1" aria-label="Tagningar">{takes.map(row=><li key={row.id}><button type="button" aria-pressed={row===recorded} className={'flex w-full flex-wrap items-baseline justify-between gap-x-3 rounded-md border px-2 py-1 text-left text-sm '+(row===recorded?'border-foreground':'border-transparent')} onClick={()=>setRecordedId(row.id)}><span>{takeName(row)} <span className="text-xs text-muted-foreground">{row.label}</span></span><span className="text-xs">{studioRecordedSpeechStatus(row)}{row.id===standardOf(row.situation)?' · Standard':''}</span></button></li>)}</ul>
              {takeDetail}
            </div>}
          </li>)}
          {groups.other.length>0&&<li>
            <button type="button" className={lineButton} aria-expanded={openLineId===OTHER_FILES} onClick={()=>{setLineChoice(OTHER_FILES);setRecordedId('')}}><span className="font-medium">Övriga filer · {groups.other.length}</span><span className="text-xs text-muted-foreground">Utan känd replik eller språk</span></button>
            {openLineId===OTHER_FILES&&recorded&&<div className="space-y-3 border-t border-border p-3"><label className="studio-field">Fil<select data-field="file" value={recorded.id} onChange={event=>setRecordedId(event.target.value)}>{groups.other.map(row=><option key={row.id} value={row.id}>{row.label} · {row.lineLabel||'ingen replik'} · {row.language?row.language.toUpperCase():'språk okänt'} · {row.id.slice(0,8)}</option>)}</select></label>{takeDetail}</div>}
          </li>}
        </ul>
        <p className="text-xs text-muted-foreground">Vilken tagning spelbordet spelar väljs i klippkartans talfack och publiceras separat.</p></>:<p className="text-sm text-muted-foreground">Inga inspelade talfiler är registrerade för denna dealer och detta spel. En röstprofil eller textmall är ingen färdig inspelning.</p>}
    </section>
    <section className="mt-5 space-y-3 border-t border-border pt-4" aria-label="Genererat tal">
      <h3 className="font-semibold">Genererat tal · AI-röst</h3>
      {generatedVoice?<p className="text-xs text-muted-foreground">För dealers med verifierad röstprofil. Skapar nya talfilmer eller talar i realtid och ändrar inga inspelade tagningar.</p>
        :<p className="text-sm text-muted-foreground">{dealer.label} har ingen verifierad röstprofil, så ny generering, realtidstal och Testa dialog används inte.</p>}
    {match.supported?<details><summary>Ny generering · textmallar</summary><div className="mt-3"><h3 className="font-semibold">Ny generering · {allowedLineIds.length} textmallar</h3><p className="mt-1 text-xs text-muted-foreground">Detta är textmallar för nya filer, inte färdiga talvideor. Språkvalet ändrar inte texten eller godkännandet för inspelade filer.</p>{game==='roulette'&&<p className="mt-1 text-xs text-muted-foreground">Spelneutrala biblioteksrepliker. Koppling till roulettehändelser och automatisk uppspelning ingår inte.</p>}
      <fieldset disabled={blocked||busy} className="mt-3 space-y-3"><div className="grid grid-cols-2 gap-3"><label className="studio-field">Språk<select data-field="language" value={language} onChange={event=>setLanguage(event.target.value as SpeechLanguage)}><option value="sv">Svenska · SV</option><option value="en">English · EN</option></select></label><label className="studio-field">{game==='roulette'?'Biblioteksreplik':'Replikplats'}<select data-field="line" value={selectedLineId} onChange={event=>setLineId(event.target.value)}>{STUDIO_SPEECH_LINES.filter(row=>allowedLineIds.includes(row.id)).map(row=><option key={row.id} value={row.id}>{row.label}</option>)}</select></label></div><label className="studio-field">Exakt text<textarea rows={3} readOnly value={caption.exactText}/></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" data-field="all-lines" checked={all} onChange={event=>setAll(event.target.checked)}/>Förbered alla {allowedLineIds.length} repliker på {language==='sv'?'svenska':'engelska'}</label><p className="text-xs text-muted-foreground">{match.message}</p><button className="studio-button" type="button" data-action="prepare" disabled={!match.supported||projectDirty||profileDirty||awaitingProjectSave!==null} onClick={()=>void prepare()}>Förbered {all?`${allowedLineIds.length} talset`:'valt talset'}</button></fieldset>
      {(projectDirty||profileDirty||awaitingProjectSave!==null)&&<p className="mt-2 text-xs text-muted-foreground">Lägg profilen i utkastet och spara projektet innan ett bygge förbereds.</p>}
      {plan&&<div className="mt-4 space-y-2 rounded-lg border border-border p-3"><strong className="text-sm">Förberett · {plan.lines.length} talset · {plan.language.toUpperCase()}</strong><div className="max-h-48 space-y-2 overflow-auto">{plan.lines.map(line=><p key={line.id} className="text-xs"><span className="text-muted-foreground">{line.label}: </span>{line.exactText}</p>)}</div><p className="text-xs text-muted-foreground">Röst: {plan.voice.name} · {plan.voice.voiceId}. Bygget kan förbruka röst- och GPU-krediter. Varje replik byggs en gång med denna förberedelse.</p>{!plan.configured&&<p className="text-sm" role="status">Den beständiga filbyggaren är inte ansluten här. Förberedelsen har inte startat någon betald generering.</p>}<button className="studio-button" type="button" data-action="build" disabled={blocked||busy||!plan.configured||projectDirty||profileDirty||awaitingProjectSave!==null} onClick={()=>void build()}>Bygg {plan.lines.length} talset</button></div>}
    </div></details>:generatedVoice&&<p className="text-xs text-muted-foreground">Ny generering: {match.message}</p>}
    {/* Without a verified profile the form stays one click deeper: it is how a profile is prepared. */}
    <details><summary>{generatedVoice?'Realtidstal · röst och referens':'Förbered röstprofil för realtidstal'}</summary><div className="mt-3 space-y-3">
      <h3 className="font-semibold">Realtidstal</h3>
      <p className="text-sm">{saved?.state==='enabled'?'Begärt i projektutkastets profil. Drift och åtkomst är inte verifierade här.':'Inte aktiverat i projektutkastets profil.'}</p>
      <p className="text-xs text-muted-foreground">{movingBank?`Rörlig läppsynk: en driftprofil med bankhash finns för ${dealer.label} i denna miljö. Spelmotorn kontrollerar banken vid start.`:'Ingen verifierad rörlig bank för denna dealer i denna miljö.'} En sparad röstprofil startar inget talprov och visar inte att en talvideo finns.</p>
      <p className="text-sm text-muted-foreground">Välj röst och dealerns egen videoreferens. Ändringarna sparas i projektutkastet.</p>
    <fieldset disabled={blocked||busy} className="space-y-3">
      <DealerVoicePicker dealer={dealer} value={voiceDraft} onChange={value=>{setVoiceDraft(value);if(!value.provider||!value.voiceId.trim()||!value.modelId.trim())setEnabled(false);}} fieldClass="studio-field"/>
      <label className="studio-field">Dealerns egen referensvideo<select data-field="reference-video" value={videoId} onChange={event=>{setVideoId(event.target.value);if(!event.target.value)setEnabled(false);}}><option value="">Inte vald</option>{videos.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}</select></label>
      <label className="studio-field">Referenstyp<select data-field="reference-kind" value={referenceKind} disabled={enabled} onChange={event=>setKindChoice(event.target.value==='motion-video'?'motion-video':'video-frame')}><option value="video-frame">Stillbild · en ruta ur videon</option><option value="motion-video">Rörlig · dealerns bank</option></select></label>
      {referenceKind==='motion-video'&&<p className="text-xs text-muted-foreground" data-note="moving-bank">{movingBank?'Referensen ska vara ett av bankens klipp; spelmotorn avvisar annars talet. Begär AI-tal använder bankens rörelser och vilaruta.':'Ingen verifierad bank i denna miljö. Spara referensen som förberedelse: bankbygget tar vald position som vilaruta (docs/PAOW-BANK-KORNING.md).'}{offsetMs%125?' Bankbygget kräver en position i steg om 125 ms (hel ruta i 24 fps).':''}</p>}
      {!!selected&&<><label className="studio-field">Referensposition, millisekunder<input data-field="reference-offset" type="number" min={0} max={Math.max(0,durationMs-1)} step={1} value={offsetMs} onChange={event=>setOffsetMs(Number(event.target.value))}/></label>{previewUrl?<video ref={preview} src={previewUrl} controls muted playsInline preload="metadata" className="max-h-44 w-full rounded-md bg-black object-contain" onLoadedMetadata={()=>{const video=preview.current;if(video){setDurationMs(Math.round(video.duration*1000));video.currentTime=offsetMs/1000}}} onLoadedData={readyFrame} onSeeked={readyFrame} onError={()=>{setFrameReviewed(false);setReferenceError('Videoreferensen kunde inte visas. Kontrollera filen innan AI-tal aktiveras.')}} onTimeUpdate={()=>{const video=preview.current;if(video&&Math.abs(video.currentTime*1000-offsetMs)>60)setFrameReviewed(false)}}/>:<p className="text-sm">Referensen har ingen verifierad förhandsvisningsadress.</p>}<p className="text-xs text-muted-foreground">{frameReviewed?'Vald referensposition har visats.':'Visa vald position innan profilen läggs i utkastet.'}</p></>}
      {!!videoId&&<p className="text-xs text-muted-foreground" role={referenceError||!referenceCheck.canEnable?'alert':'status'}>{referenceError||referenceCheck.message}</p>}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" data-field="enable-speech" checked={enabled} disabled={!enabled&&(!referenceCheck.canEnable||Boolean(referenceError)||!voiceDraft.provider||!voiceDraft.voiceId.trim()||!voiceDraft.modelId.trim()||motionBlocked)} onChange={event=>setEnabled(event.target.checked)}/>Begär AI-tal med denna sparade profil</label>
      {changedEnabledMotion&&<p role="status" className="text-sm">Stäng av Begär AI-tal innan du sparar en ändrad rörelsereferens.</p>}
      <button className="studio-button" type="button" data-action="stage-profile" disabled={!profileDirty||changedEnabledMotion||enabled&&(!referenceCheck.canEnable||Boolean(referenceError))||Boolean(videoId&&!referenceUnchanged&&!frameReviewed)} onClick={saveProfile}>Lägg talprofil i utkast</button>
    </fieldset>
    {game==='roulette'&&<p className="mt-3 text-xs text-muted-foreground">Talprofilen hör till dealern. Dealerchatt med läppsynk är ännu inte ansluten i roulettevyn.</p>}
    </div></details>
    </section>

    {busy&&<p role="status" className="mt-3 text-sm">Behandlar talset…</p>}{notice&&<p role="status" className="mt-3 text-sm">{notice}</p>}{error&&<p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
    {results.length>0&&<div className="mt-4 space-y-4">{results.map(result=><article key={result.lineId} className="rounded-lg border border-border p-3"><strong className="text-sm">{STUDIO_SPEECH_LINES.find(row=>row.id===result.lineId)?.label} · {result.state==='succeeded'?'Granskning återstår':'Misslyckad'}</strong><p className="my-2 text-sm">{result.exactText}</p>{result.state==='succeeded'?<><SpeechResultPreview result={result} active={active}/><p className="mt-2 text-xs text-muted-foreground">{result.frameCount} bilder · {result.fps} fps · ljudfördröjning {result.audioDelayMs} ms · {result.calibrationRevision}. Granska två uppspelningar i följd. Godkännande och publicering återstår.</p><details className="mt-2 text-xs"><summary>Talsetets identitet</summary><p className="break-all">Text: {result.textSha256}<br/>Ljud: {result.audioSha256}<br/>Video: {result.videoSha256}</p></details></>:<p className="text-sm text-red-400">{messages[result.error??'']??'Ingen automatisk omkörning görs.'}</p>}</article>)}</div>}

  </section>
}
