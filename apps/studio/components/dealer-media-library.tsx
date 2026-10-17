'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import type {StudioProject} from '../../../packages/presentation/contracts/studio-model.mjs';
import {DEALER_MEDIA_CATEGORIES,dealerMediaSlots,mediaClassification,dealerLibraryVideos,draftUsesMedia,mediaMatchesSlot,dealerSlotStatus,mediaPage,mediaUsage,type DealerMediaSlot} from '../lib/dealer-media-library.mjs';
import {clipLabel} from '../lib/clip-label.mjs';
import {mediaContentType} from '../../../packages/shared/media-file-types.mjs';
import {NATIVE_MEDIA_ACCEPT,nativeMediaFileError,assertNativeMediaFiles} from '../lib/native-media-intake.mjs';
import {uploadMediaBatch} from '../lib/media-upload-batch.mjs';
import {uploadNativeVideo} from '../lib/upload-native-video.mjs';
import { requestJson, studioHref } from './studio-types';
import type { VideoEntry, VideoInventory } from '../../../packages/presentation/contracts/media-inventory.mjs';
import styles from './dealer-media-library.module.css';
import {mediaRemovalMessage} from './media-removal-feedback';
import {DEFAULT_DEALER_FRAMING,DEFAULT_GREEN_SCREEN,type DealerFraming} from '../../../packages/presentation/contracts/dealer-framing.mjs';
import type {VideoCompositing} from '../../../packages/presentation/contracts/video-intake.mjs';
import {VideoCompositingFields,DealerFramingFields} from './video-metadata-fields';
import {DealerClipPreview} from './dealer-video-surface';
import {DealerFileSettings} from './dealer-file-settings';

type IntakeRow={id:string;file:File;label:string;slotId:string;state:'ready'|'saving'|'saved'|'error';message?:string;progress?:number;framing?:DealerFraming;compositing?:VideoCompositing};
function LocalPreview({file,framing,compositing}:{file:File;framing?:DealerFraming;compositing?:VideoCompositing}){
  const [url,setUrl]=useState('');
  useEffect(()=>{const next=URL.createObjectURL(file);setUrl(next);return()=>URL.revokeObjectURL(next);},[file]);
  return mediaContentType(file.name).startsWith('audio/')?<audio src={url} controls preload="metadata"/>:url?<DealerClipPreview mediaType={file.type.startsWith('image/')?'image':undefined} url={url} framing={framing} compositing={compositing}/>:null;
}
function IntakePreview({row,disabled,update}:{row:IntakeRow;disabled:boolean;update:(id:string,patch:Partial<IntakeRow>)=>void}){
  const [open,setOpen]=useState(row.slotId==='idle.ready/');
  return <details open={open} onToggle={event=>setOpen(event.currentTarget.open)}><summary>{row.file.name} · {(row.file.size/1024/1024).toFixed(1)} MB · bildformat och bakgrund</summary>
    {open&&!nativeMediaFileError(row.file)?<fieldset disabled={disabled}>{row.framing?<><VideoCompositingFields value={row.compositing} onChange={compositing=>update(row.id,{compositing})}/><DealerFramingFields value={row.framing} onChange={framing=>update(row.id,{framing})}/></>:null}
      <LocalPreview file={row.file} framing={row.framing} compositing={row.compositing}/></fieldset>:null}
  </details>;
}
export function DealerMediaLibrary({project,inventory,dealerId,onInventory,onProjectSaved,onLifecycleChange,onPendingChange,onConfigureSlot,onCategoryChange,initialSlotId='',disabled=false,archivedDealer=false,removalDisabledReason='',category:controlledCategory,slotId:controlledSlotId,onSlotChange,categoryIds,slotEditor}:{project:StudioProject;inventory:VideoInventory;dealerId:string;onInventory:(value:VideoInventory)=>void;onProjectSaved:(value:StudioProject)=>void;onLifecycleChange:(pending:boolean)=>void;onPendingChange:(value:boolean)=>void;onConfigureSlot?:(eventId:string,situation:string)=>void;onCategoryChange?:(category:string)=>void;initialSlotId?:string;category?:string;slotId?:string;onSlotChange?:(slotId:string)=>void;categoryIds?:string[];slotEditor?:ReactNode;disabled?:boolean;archivedDealer?:boolean;removalDisabledReason?:string}){
  const [localCategory,setCategory]=useState(dealerMediaSlots(project).find(row=>row.id===initialSlotId)?.category??'all'),[archived,setArchived]=useState(archivedDealer),[queue,setQueue]=useState<IntakeRow[]>([]);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[removing,setRemoving]=useState<VideoEntry|null>(null);
  const [purging,setPurging]=useState<VideoEntry|null>(null),[deleteCheck,setDeleteCheck]=useState<{allowed:boolean;reason?:string;retryAfterMs?:number}|null>(null);
  const [localSlotId,setSlotId]=useState(initialSlotId),[page,setPage]=useState(1);
  const category=controlledCategory??localCategory,slotId=controlledSlotId??localSlotId;
  useEffect(()=>{setPage(1);},[category,slotId]);
  const controller=useRef<AbortController|null>(null),busyRef=useRef(false),input=useRef<HTMLInputElement>(null);
  const pending=queue.some(row=>row.state!=='saved');
  useEffect(()=>{onPendingChange(pending||busy);},[pending,busy,onPendingChange]);
  useEffect(()=>{if(!pending)return;const prevent=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',prevent);return()=>window.removeEventListener('beforeunload',prevent);},[pending]);
  useEffect(()=>()=>controller.current?.abort(),[]);
  const allSlots=dealerMediaSlots(project),slots=dealerMediaSlots(project,category);
  const selectedSlot=allSlots.find(row=>row.id===slotId);
  const displayed=dealerLibraryVideos(project,inventory,dealerId,category,archived).filter(row=>!selectedSlot||mediaMatchesSlot(row,selectedSlot));
  const paged=mediaPage(displayed,page);
  const status=(slot:DealerMediaSlot)=>dealerSlotStatus(project,inventory,dealerId,slot);
  function chooseCategory(value:string){setCategory(value);setSlotId('');setPage(1);onCategoryChange?.(value);}
  function chooseSlot(value:string){setSlotId(value);setPage(1);onSlotChange?.(value);}
  function settings(slot:DealerMediaSlot){if(slot.eventId.startsWith('roulette.'))return <small>Rouletteprov · kopplas inte automatiskt till spel.</small>;return onConfigureSlot?<button type="button" className="sg-btn sg-btn-secondary" onClick={()=>onConfigureSlot(slot.eventId,slot.situation)}>Öppna klipp och inställningar</button>:<a href={studioHref('/control/clips',{dealerId,eventId:slot.eventId,situation:slot.situation})}>Öppna klipp och inställningar</a>;}
  const missing=allSlots.map(slot=>({slot,...status(slot)})).filter(row=>row.level==='required'||row.level==='recommended');
  function addFiles(files:FileList|null){
    if(!files||busy)return;
    const selected=Array.from(files);
    if(queue.length+selected.length>50){setError('Ladda upp högst 50 filer åt gången.');return;}
    setQueue(rows=>[...rows,...selected.map(file=>{
      const type=mediaContentType(file.name),choices=type.startsWith('audio/')?allSlots.filter(slot=>slot.category==='speech'&&(!selectedSlot||slot.id===selectedSlot.id)):(selectedSlot?[selectedSlot]:slots);
      const invalid=nativeMediaFileError(file,type);
      return {id:crypto.randomUUID(),file,label:file.name.replace(/\.[^.]+$/,'').slice(0,120),slotId:choices.length===1?choices[0].id:'',state:invalid?'error' as const:'ready' as const,message:invalid,...(!type.startsWith('audio/')?{framing:{...DEFAULT_DEALER_FRAMING},compositing:type==='image/png'?{mode:'alpha' as const}:{...DEFAULT_GREEN_SCREEN}}:{})};
    })]);setError('');if(input.current)input.current.value='';
  }
  function update(id:string,patch:Partial<IntakeRow>){setQueue(rows=>rows.map(row=>row.id===id?{...row,...patch}:row));}
  async function upload(){
    if(busyRef.current||disabled)return;
    const ready=queue.filter(row=>row.state==='ready');
    if(!ready.length)return;
    let prepared;
    try{assertNativeMediaFiles(queue.filter(row=>row.state!=='saved').map(row=>row.file));prepared=ready.map(row=>({row,classification:{...mediaClassification(project,{dealerId,slotId:row.slotId,label:row.label,contentType:mediaContentType(row.file.name)}),...(row.framing?{framing:row.framing,compositing:row.compositing}:{})}}));}
    catch(cause){setError(cause instanceof Error?cause.message:'Kontrollera facken.');return;}
    busyRef.current=true;setBusy(true);setError('');setNotice('');
    const abort=new AbortController();controller.current=abort;
    let count=0;
    try{
      const capability=await requestJson<VideoInventory & {uploadMode?:string}>('/api/videos',{signal:abort.signal});
      if(capability.uploadMode!=='private-client-blob')throw Error('Bulkuppladdning kräver den anslutna molnvyn i Control.');
      count=await uploadMediaBatch(prepared,{signal:abort.signal,onChange:update,upload:(file,classification,onUploadProgress)=>uploadNativeVideo(file,classification,mediaContentType(file.name),{signal:abort.signal,onUploadProgress})});
      onInventory(await requestJson<VideoInventory>('/api/videos',{signal:abort.signal}));
      setNotice(count+' filer sparade med dealer och exakt fack. Koppla önskade klipp till spelet via fackets inställningar.');
    }catch(cause){setError(cause instanceof Error?cause.message:'Biblioteket kunde inte uppdateras.');}
    finally{busyRef.current=false;setBusy(false);controller.current=null;}
  }
  async function archive(video:VideoEntry,value:boolean){
    if(busyRef.current||disabled||removalDisabledReason||archivedDealer||!video.classification||video.deletion)return;
    busyRef.current=true;setBusy(true);setError('');
    try{
      const next=await requestJson<VideoInventory>('/api/videos/archive',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:video.id,sha256:video.sha256,previous:video.classification,archived:value})});
      onInventory(next);setRemoving(null);setNotice(value?'Filen ligger i papperskorgen och kan återställas.':'Filen är återställd i sitt fack.');
    }catch(cause){const message=cause instanceof Error?cause.message:'';setError(message.includes('studio_media_in_use')?'Filen används av sparade inställningar. Koppla loss den och spara projektet först.':message||'Filen kunde inte ändras.');}
    finally{busyRef.current=false;setBusy(false);}
  }
  async function checkDeletion(video:VideoEntry){
    if(busyRef.current||disabled||removalDisabledReason||!video.revision)return;
    setPurging(video);setRemoving(null);setDeleteCheck(null);setError('');
    busyRef.current=true;setBusy(true);
    try{setDeleteCheck(await requestJson<{allowed:boolean;reason?:string;retryAfterMs?:number}>('/api/videos/delete-check',{method:'POST',body:JSON.stringify({id:video.id,sha256:video.sha256,expectedRevision:video.revision})}));}
    catch(cause){setDeleteCheck({allowed:false,reason:cause instanceof Error?cause.message:undefined});}
    finally{busyRef.current=false;setBusy(false);}
  }
  async function deletePermanently(video:VideoEntry){
    if(busyRef.current||disabled||removalDisabledReason||!video.revision||!deleteCheck?.allowed||purging?.id!==video.id)return;
    busyRef.current=true;setBusy(true);onLifecycleChange(true);setError('');
    try{
      const next=await requestJson<{project:StudioProject;inventory:VideoInventory}>('/api/videos/delete',{method:'POST',body:JSON.stringify({id:video.id,sha256:video.sha256,expectedRevision:video.revision})});
      onInventory(next.inventory);onProjectSaved(next.project);setPurging(null);setDeleteCheck(null);setNotice('Filen har raderats permanent från lagringen.');
    }catch(cause){setError(mediaRemovalMessage(cause));setDeleteCheck(null);try{const [saved,inventory]=await Promise.all([requestJson<{project:StudioProject}>('/api/project'),requestJson<VideoInventory>('/api/videos')]);onProjectSaved(saved.project);onInventory(inventory);}catch{/* Keep the original failure visible. */}}
    finally{busyRef.current=false;setBusy(false);onLifecycleChange(false);}
  }
  return <section className={styles.library} aria-label="Dealerns mediebibliotek">
    <div className={styles.heading}><div><h2>Media för {project.dealers.find(row=>row.id===dealerId)?.label??project.dealerTrash?.find(row=>row.dealer.id===dealerId)?.dealer.label}</h2><p>{archived?'Återställ filer eller granska dem inför permanent radering.':'Välj kategori, lägg in filer och välj ett fack för varje klipp.'}</p></div><button className="sg-btn sg-btn-secondary" disabled={busy||archivedDealer} onClick={()=>{setArchived(value=>!value);setRemoving(null);setPurging(null);setPage(1);}}>{archived?archivedDealer?'Dealerns papperskorg':'Till biblioteket':'Papperskorg'}</button></div>
    <div className={styles.categories} role="group" aria-label="Mediekategori">{DEALER_MEDIA_CATEGORIES.filter(item=>!categoryIds||categoryIds.includes(item.id)).map(item=><button key={item.id} aria-pressed={category===item.id} onClick={()=>chooseCategory(item.id)}>{item.id==='idle'?'Grundloop':item.id==='deal'?'Utdelning':item.label}{!archived&&missing.some(row=>row.slot.category===item.id)?<small className={styles[missing.some(row=>row.slot.category===item.id&&row.level==='required')?'required':'recommended']}>{item.id==='idle'?'Krävs':'Rekommenderas'}</small>:null}<span>{dealerLibraryVideos(project,inventory,dealerId,item.id,archived).length}</span></button>)}</div>
    {!archived?<>
      <div className={styles.legend}><span className={styles.required}>Krävs: en vald grundloop</span><span className={styles.recommended}>Rekommenderas: klipp för varje deal-fack och övergång</span><span>Övriga fack är valfria. Status visar filer och val, inte ett godkänt uppspelningstest.</span></div>
      <div className={styles.slotBar}><label>Fack<select aria-label="Filtrera på fack" value={slotId} onChange={event=>chooseSlot(event.target.value)}><option value="">Alla fack i kategorin</option>{slots.map(slot=><option key={slot.id} value={slot.id}>{slot.label} · {status(slot).label}</option>)}</select></label>{selectedSlot&&!slotEditor?settings(selectedSlot):null}</div>
      {selectedSlot?<p className={styles[status(selectedSlot).level]} role="status">{status(selectedSlot).label}. Flera klipp i samma fack kan användas som varianter. Välj dem och deras villkor i fackets inställningar.</p>:<div className={styles.slots}>{slots.filter(slot=>category!=='all'||['idle','deal','transition'].includes(slot.category)).map(slot=>{const state=status(slot);return <button type="button" className={styles.slot} key={slot.id} onClick={()=>chooseSlot(slot.id)}><strong>{slot.label}</strong><span className={styles[state.level]}>{state.label}</span><small>Öppna klipp och varianter</small></button>;})}</div>}
    </>:<div className={styles.slotBar}><label>Fack<select aria-label="Filtrera på fack" value={slotId} onChange={event=>chooseSlot(event.target.value)}><option value="">Alla fack i kategorin</option>{slots.map(slot=><option key={slot.id} value={slot.id}>{slot.label}</option>)}</select></label></div>}
    {!archived?slotEditor:null}
    {error?<p className={styles.error} role="alert">{error}</p>:null}{notice?<p role="status">{notice}</p>:null}
    {!archived?<><div className={styles.dropzone} onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();if(!disabled)addFiles(event.dataTransfer.files);}}>
      <strong>Lägg in flera filer samtidigt</strong><p>Dra hit filer eller välj från datorn. MP4 och WebM · högst 128 MB per fil. PNG och ljud kräver en senare databasuppdatering.</p>
      <label className={"sg-btn sg-btn-primary "+styles.fileButton}>Välj filer<input aria-label="Välj filer att ladda upp" ref={input} type="file" multiple accept={NATIVE_MEDIA_ACCEPT} disabled={busy||disabled} onChange={event=>addFiles(event.target.files)} /></label>
    </div>{queue.length?<section className={styles.intake} aria-label="Filer att mappa"><div className={styles.heading}><h3>Mappa {queue.length} filer</h3><button disabled={busy} onClick={()=>setQueue([])}>Töm listan</button></div>
      <p>Dealer och kategori följer med. För Deal väljer du exakt box; för tal väljer du repliken. Sparade filer laddas inte upp igen.</p>
      {queue.map(row=><article key={row.id} className={styles.intakeRow}>
        <IntakePreview row={row} disabled={busy||disabled||row.state!=='ready'} update={update}/>
        <label>Namn<input aria-label={'Namn för '+row.file.name} value={row.label} maxLength={120} disabled={busy||row.state!=='ready'} onChange={event=>update(row.id,{label:event.target.value})}/></label>
        <label>Fack<select aria-label={'Fack för '+row.file.name} value={row.slotId} disabled={busy||row.state!=='ready'} onChange={event=>update(row.id,{slotId:event.target.value})}><option value="">Välj ett fack…</option>{DEALER_MEDIA_CATEGORIES.filter(item=>item.id!=='all').map(group=>{
          const options=allSlots.filter(slot=>slot.category===group.id&&(!mediaContentType(row.file.name).startsWith('audio/')||slot.category==='speech'));
          return options.length?<optgroup key={group.id} label={group.label}>{options.map(slot=><option key={slot.id} value={slot.id}>{slot.label}</option>)}</optgroup>:null;
        })}</select></label>
        <div role="status">{row.state==='saving'?'Laddar upp '+row.progress+' %':row.message??'Klar att mappa'}</div>
        <button aria-label={'Ta bort '+row.file.name+' ur listan'} disabled={busy} onClick={()=>setQueue(rows=>rows.filter(item=>item.id!==row.id))}>Ta bort</button>
      </article>)}<button className="sg-btn sg-btn-primary" disabled={busy||disabled||!queue.some(row=>row.state==='ready')||queue.some(row=>row.state!=='saved'&&nativeMediaFileError(row.file))||queue.some(row=>row.state==='ready'&&(!row.slotId||!row.label.trim()))} onClick={()=>void upload()}>{busy?'Sparar…':'Ladda upp och spara facken'}</button>
    </section>:null}</>:null}
    <div className={styles.heading}><h3>{archived?'Papperskorg':'Filer i kategorin'} · {displayed.length}</h3><button disabled={busy} onClick={()=>void requestJson<VideoInventory>('/api/videos').then(onInventory).catch(cause=>setError(cause.message))}>Uppdatera</button></div>
    {archived&&removalDisabledReason?<p role="status">{removalDisabledReason}</p>:null}
    {archivedDealer?<p>Återställ dealern ovan för att återställa dess klipp tillsammans.</p>:null}
    {displayed.length?<div className={styles.grid}>{paged.items.map(video=>{
      const metadata=video.classification,eventId=metadata?.eventId??video.eventId??video.suggestedEventId,situation=metadata?.situation??video.situation;
      const slot=allSlots.find(row=>row.eventId===eventId&&(row.situation===(situation??'')||row.eventId==='idle.ready'));
      const used=draftUsesMedia(project,video.id),editable=video.source==='upload'&&Boolean(metadata);
      return <article className={styles.card} key={video.id}>
        {video.deletion?<div className={styles.empty}>Radering påbörjad · filen kan inte återställas</div>:metadata?.mediaType==='audio'?<audio src={video.previewUrl} controls preload="none"/>:<DealerClipPreview mediaType={metadata?.mediaType==='image'?'image':undefined} url={video.previewUrl} framing={metadata?.framing} compositing={metadata?.compositing} label={`Förhandsvisa ${video.label}`}/>}
        <h4>{clipLabel({id:video.id,label:video.label,familyId:video.familyId,role:video.role},project.clipLabels)}</h4><p>{slot?.label??'Ej kategoriserad'} · {metadata?.mediaType==='audio'?'Ljud':metadata?.mediaType==='image'?'VILA-bild':'Video'}</p>
        <small>{mediaUsage(project,video,dealerId)}{!video.available?' · Otillgänglig':''}</small>
        {editable&&!archived&&!video.deletion?<DealerFileSettings key={video.id+JSON.stringify(metadata)} video={video} disabled={busy||disabled} onSaved={onInventory} onBusyChange={onLifecycleChange}/>:null}
        <div className={styles.actions}>{!archived&&slot?settings(slot):null}
          {editable?<>
            {!archivedDealer&&!video.deletion?<button disabled={busy||disabled||Boolean(removalDisabledReason)||(!archived&&used)} title={removalDisabledReason||(used?'Koppla loss filen och spara projektet först.':undefined)} onClick={()=>archived?void archive(video,false):setRemoving(video)}>{archived?'Återställ':'Flytta till papperskorgen'}</button>:null}
            {archived?<button className={styles.deleteButton} disabled={busy||disabled||Boolean(removalDisabledReason)||!video.revision} onClick={()=>void checkDeletion(video)}>{video.deletion?'Slutför radering':'Radera permanent…'}</button>:null}
          </>:<small>Skyddat original</small>}</div>
        {removing?.id===video.id?<div className={styles.confirm}><p>Flytta klippet till papperskorgen? Filen behålls och kan återställas.</p><button disabled={busy||disabled||Boolean(removalDisabledReason)} onClick={()=>void archive(video,true)}>Flytta till papperskorgen</button><button disabled={busy} onClick={()=>setRemoving(null)}>Avbryt</button></div>:null}
        {purging?.id===video.id?<div className={styles.confirm} role="group" aria-label="Permanent radering">
          <strong>Radera filen permanent?</strong>
          <p>Detta tar bort filen från lagringen och kan inte ångras.</p>
          {!deleteCheck?<p role="status">{busy?'Kontrollerar beroenden…':'Kontrollen behöver göras om. Välj Radera permanent igen.'}</p>:!deleteCheck.allowed?<p role="status">{mediaRemovalMessage(deleteCheck.reason)}{deleteCheck.retryAfterMs?` Försök igen om cirka ${Math.max(1,Math.ceil(deleteCheck.retryAfterMs/60000))} minuter.`:''}</p>:<p>Kontrollen tillåter radering. Beroenden kontrolleras igen när du bekräftar.</p>}
          <button className={styles.deleteButton} disabled={busy||disabled||Boolean(removalDisabledReason)||!deleteCheck?.allowed} onClick={()=>void deletePermanently(video)}>Radera permanent</button>
          <button disabled={busy} onClick={()=>{setPurging(null);setDeleteCheck(null);}}>Avbryt</button>
        </div>:null}
      </article>;
    })}</div>:<div className={styles.empty}>{archived?'Papperskorgen är tom i den här kategorin.':'Inga filer här ännu. Lägg in filer ovan för den här dealern.'}</div>}
    {paged.total>0?<nav className={styles.pagination} aria-label="Sidor med klipp"><button type="button" disabled={paged.page<=1} onClick={()=>setPage(paged.page-1)}>← Föregående</button><span role="status">Sida {paged.page} av {paged.pages} · {paged.total} filer · 6 per sida</span><button type="button" disabled={paged.page>=paged.pages} onClick={()=>setPage(paged.page+1)}>Nästa →</button></nav>:null}
  </section>;
}
