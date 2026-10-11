'use client';
import {useEffect,useRef,useState} from 'react';
import type {StudioProject} from '../lib/studio-model.mjs';
import {DEALER_MEDIA_CATEGORIES,dealerMediaSlots,mediaClassification,dealerLibraryVideos,draftUsesMedia,mediaMatchesSlot,dealerSlotStatus,mediaPage,mediaUsage,type DealerMediaSlot} from '../lib/dealer-media-library.mjs';
import type {LegacyClipControls} from '../lib/legacy-clip-inventory.mjs';
import {clipLabel} from '../lib/clip-label.mjs';
import {mediaContentType} from '../lib/media-file-types.mjs';
import {MAX_VIDEO_BYTES} from '../lib/video-intake.mjs';
import {uploadMediaBatch} from '../lib/media-upload-batch.mjs';
import {uploadNativeVideo} from '../lib/upload-native-video.mjs';
import {requestJson,studioHref,type VideoEntry,type VideoInventory} from './studio-types';
import styles from './dealer-media-library.module.css';

type IntakeRow={id:string;file:File;label:string;slotId:string;state:'ready'|'saving'|'saved'|'error';message?:string;progress?:number};
function LocalPreview({file}:{file:File}){
  const [url,setUrl]=useState('');
  useEffect(()=>{const next=URL.createObjectURL(file);setUrl(next);return()=>URL.revokeObjectURL(next);},[file]);
  return mediaContentType(file.name).startsWith('audio/')?<audio src={url} controls preload="metadata"/>:<video src={url} controls playsInline preload="metadata"/>;
}
export function DealerMediaLibrary({project,inventory,dealerId,onInventory,onPendingChange,onConfigureSlot,onCategoryChange,initialSlotId='',disabled=false}:{project:StudioProject;inventory:VideoInventory;dealerId:string;onInventory:(value:VideoInventory)=>void;onPendingChange:(value:boolean)=>void;onConfigureSlot?:(eventId:string,situation:string)=>void;onCategoryChange?:(category:string)=>void;initialSlotId?:string;disabled?:boolean}){
  const [category,setCategory]=useState(dealerMediaSlots(project).find(row=>row.id===initialSlotId)?.category??'all'),[archived,setArchived]=useState(false),[queue,setQueue]=useState<IntakeRow[]>([]);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[removing,setRemoving]=useState<VideoEntry|null>(null);
  const [slotId,setSlotId]=useState(initialSlotId),[page,setPage]=useState(1);
  const [legacy,setLegacy]=useState<LegacyClipControls|null>(null),[legacyError,setLegacyError]=useState('');
  useEffect(()=>{if(!['astrid','vera','amira','mei'].includes(dealerId))return;let mounted=true;requestJson<LegacyClipControls>('/api/clip-controls').then(value=>{if(mounted)setLegacy(value);}).catch(()=>{if(mounted)setLegacyError('Originalklippen kunde inte kontrolleras. Ladda om sidan för att försöka igen.');});return()=>{mounted=false;};},[dealerId]);
  const controller=useRef<AbortController|null>(null),busyRef=useRef(false),input=useRef<HTMLInputElement>(null);
  const pending=queue.some(row=>row.state!=='saved');
  useEffect(()=>{onPendingChange(pending||busy);},[pending,busy,onPendingChange]);
  useEffect(()=>{if(!pending)return;const prevent=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',prevent);return()=>window.removeEventListener('beforeunload',prevent);},[pending]);
  useEffect(()=>()=>controller.current?.abort(),[]);
  const allSlots=dealerMediaSlots(project),slots=dealerMediaSlots(project,category);
  const selectedSlot=allSlots.find(row=>row.id===slotId);
  const displayed=dealerLibraryVideos(project,inventory,dealerId,category,archived).filter(row=>!selectedSlot||mediaMatchesSlot(row,selectedSlot));
  const paged=mediaPage(displayed,page);
  const status=(slot:DealerMediaSlot)=>dealerSlotStatus(project,inventory,dealerId,slot,legacy);
  function chooseCategory(value:string){setCategory(value);setSlotId('');setPage(1);onCategoryChange?.(value);}
  function chooseSlot(value:string){setSlotId(value);setPage(1);}
  function settings(slot:DealerMediaSlot){return onConfigureSlot?<button type="button" className="sg-btn sg-btn-secondary" onClick={()=>onConfigureSlot(slot.eventId,slot.situation)}>Klippval, varianter &amp; villkor →</button>:<a href={studioHref('/control/clips',{dealerId,eventId:slot.eventId,situation:slot.situation})}>Klippval, varianter &amp; villkor →</a>;}
  const missing=allSlots.map(slot=>({slot,...status(slot)})).filter(row=>row.level==='required'||row.level==='recommended');
  function addFiles(files:FileList|null){
    if(!files||busy)return;
    const selected=Array.from(files);
    if(queue.length+selected.length>50){setError('Ladda upp högst 50 filer åt gången.');return;}
    setQueue(rows=>[...rows,...selected.map(file=>{
      const type=mediaContentType(file.name),choices=type.startsWith('audio/')?allSlots.filter(slot=>slot.category==='speech'&&(!selectedSlot||slot.id===selectedSlot.id)):(selectedSlot?[selectedSlot]:slots);
      const invalid=!type?'Välj MP4, WebM, MP3 eller WAV.':file.size<16||file.size>MAX_VIDEO_BYTES?'Filen måste vara mellan 16 byte och 128 MB.':'';
      return {id:crypto.randomUUID(),file,label:file.name.replace(/\.[^.]+$/,'').slice(0,120),slotId:choices.length===1?choices[0].id:'',state:invalid?'error' as const:'ready' as const,message:invalid};
    })]);setError('');if(input.current)input.current.value='';
  }
  function update(id:string,patch:Partial<IntakeRow>){setQueue(rows=>rows.map(row=>row.id===id?{...row,...patch}:row));}
  async function upload(){
    if(busyRef.current||disabled)return;
    const ready=queue.filter(row=>row.state==='ready');
    if(!ready.length)return;
    let prepared;
    try{prepared=ready.map(row=>({row,classification:mediaClassification(project,{dealerId,slotId:row.slotId,label:row.label,contentType:mediaContentType(row.file.name)})}));}
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
    if(busyRef.current||disabled||!video.classification)return;
    busyRef.current=true;setBusy(true);setError('');
    try{
      const next=await requestJson<VideoInventory>('/api/videos/archive',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:video.id,sha256:video.sha256,previous:video.classification,archived:value})});
      onInventory(next);setRemoving(null);setNotice(value?'Filen är borttagen från biblioteket. Du kan återställa den under Borttagna.':'Filen är återställd i sitt fack.');
    }catch(cause){const message=cause instanceof Error?cause.message:'';setError(message.includes('studio_media_in_use')?'Filen används av sparade inställningar. Koppla loss den och spara projektet först.':message||'Filen kunde inte ändras.');}
    finally{busyRef.current=false;setBusy(false);}
  }
  return <section className={styles.library} aria-label="Dealerns mediebibliotek">
    <div className={styles.heading}><div><h2>Media för {project.dealers.find(row=>row.id===dealerId)?.label}</h2><p>Välj kategori, lägg in filer och välj ett fack för varje klipp.</p></div><button className="sg-btn sg-btn-secondary" disabled={busy} onClick={()=>{setArchived(value=>!value);setRemoving(null);setPage(1);}}>{archived?'Till biblioteket':'Borttagna'}</button></div>
    <div className={styles.categories} role="group" aria-label="Mediekategori">{DEALER_MEDIA_CATEGORIES.map(item=><button key={item.id} aria-pressed={category===item.id} onClick={()=>chooseCategory(item.id)}>{item.label}{missing.some(row=>row.slot.category===item.id)?<small className={styles[missing.some(row=>row.slot.category===item.id&&row.level==='required')?'required':'recommended']}>{item.id==='idle'?'Krävs':'Rekommenderas'}</small>:null}<span>{dealerLibraryVideos(project,inventory,dealerId,item.id,archived).length}</span></button>)}</div>
    {!archived?<>
      <div className={styles.legend}><span className={styles.required}>Krävs: en vald grundloop</span><span className={styles.recommended}>Rekommenderas: klipp för varje deal-fack</span><span>Övriga fack är valfria. Status visar filer och val, inte ett godkänt uppspelningstest.</span></div>
      {legacyError?<p role="status">{legacyError}</p>:null}
      <div className={styles.slotBar}><label>Fack<select aria-label="Filtrera på fack" value={slotId} onChange={event=>chooseSlot(event.target.value)}><option value="">Alla fack i kategorin</option>{slots.map(slot=><option key={slot.id} value={slot.id}>{slot.label} · {status(slot).label}</option>)}</select></label>{selectedSlot?settings(selectedSlot):null}</div>
      {selectedSlot?<p className={styles[status(selectedSlot).level]} role="status">{status(selectedSlot).label}. Flera klipp i samma fack kan användas som varianter. Välj dem och deras villkor i fackets inställningar.</p>:<div className={styles.slots}>{slots.filter(slot=>category!=='all'||['idle','deal'].includes(slot.category)).map(slot=>{const state=status(slot);return <button type="button" className={styles.slot} key={slot.id} onClick={()=>chooseSlot(slot.id)}><strong>{slot.label}</strong><span className={styles[state.level]}>{state.label}</span><small>Visa klipp och varianter →</small></button>;})}</div>}
    </>:<div className={styles.slotBar}><label>Fack<select aria-label="Filtrera på fack" value={slotId} onChange={event=>chooseSlot(event.target.value)}><option value="">Alla fack i kategorin</option>{slots.map(slot=><option key={slot.id} value={slot.id}>{slot.label}</option>)}</select></label></div>}
    {error?<p className={styles.error} role="alert">{error}</p>:null}{notice?<p role="status">{notice}</p>:null}
    {!archived?<><div className={styles.dropzone} onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();if(!disabled)addFiles(event.dataTransfer.files);}}>
      <strong>Lägg in flera filer samtidigt</strong><p>Dra hit filer eller välj från datorn. MP4, WebM, MP3 och WAV · högst 128 MB per fil.</p>
      <label className={"sg-btn sg-btn-primary "+styles.fileButton}>Välj filer<input aria-label="Välj filer att ladda upp" ref={input} type="file" multiple accept=".mp4,.webm,.mp3,.wav" disabled={busy||disabled} onChange={event=>addFiles(event.target.files)} /></label>
    </div>{queue.length?<section className={styles.intake} aria-label="Filer att mappa"><div className={styles.heading}><h3>Mappa {queue.length} filer</h3><button disabled={busy} onClick={()=>setQueue([])}>Töm listan</button></div>
      <p>Dealer och kategori följer med. För Deal väljer du exakt box; för tal väljer du repliken. Sparade filer laddas inte upp igen.</p>
      {queue.map(row=><article key={row.id} className={styles.intakeRow}>
        <details><summary>{row.file.name} · {(row.file.size/1024/1024).toFixed(1)} MB</summary><LocalPreview file={row.file}/></details>
        <label>Namn<input aria-label={'Namn för '+row.file.name} value={row.label} maxLength={120} disabled={busy||row.state!=='ready'} onChange={event=>update(row.id,{label:event.target.value})}/></label>
        <label>Fack<select aria-label={'Fack för '+row.file.name} value={row.slotId} disabled={busy||row.state!=='ready'} onChange={event=>update(row.id,{slotId:event.target.value})}><option value="">Välj ett fack…</option>{DEALER_MEDIA_CATEGORIES.filter(item=>item.id!=='all').map(group=>{
          const options=allSlots.filter(slot=>slot.category===group.id&&(!mediaContentType(row.file.name).startsWith('audio/')||slot.category==='speech'));
          return options.length?<optgroup key={group.id} label={group.label}>{options.map(slot=><option key={slot.id} value={slot.id}>{slot.label}</option>)}</optgroup>:null;
        })}</select></label>
        <div role="status">{row.state==='saving'?'Laddar upp '+row.progress+' %':row.message??'Klar att mappa'}</div>
        <button aria-label={'Ta bort '+row.file.name+' ur listan'} disabled={busy} onClick={()=>setQueue(rows=>rows.filter(item=>item.id!==row.id))}>Ta bort</button>
      </article>)}<button className="sg-btn sg-btn-primary" disabled={busy||disabled||!queue.some(row=>row.state==='ready')||queue.some(row=>row.state==='ready'&&(!row.slotId||!row.label.trim()))} onClick={()=>void upload()}>{busy?'Sparar…':'Ladda upp och spara facken'}</button>
    </section>:null}</>:null}
    <div className={styles.heading}><h3>{archived?'Borttagna filer':'Filer i kategorin'} · {displayed.length}</h3><button disabled={busy} onClick={()=>void requestJson<VideoInventory>('/api/videos').then(onInventory).catch(cause=>setError(cause.message))}>Uppdatera</button></div>
    {displayed.length?<div className={styles.grid}>{paged.items.map(video=>{
      const metadata=video.classification,eventId=metadata?.eventId??video.eventId??video.suggestedEventId,situation=metadata?.situation??video.situation;
      const slot=allSlots.find(row=>row.eventId===eventId&&(row.situation===(situation??'')||row.eventId==='idle.ready'));
      const used=draftUsesMedia(project,video.id),editable=video.source==='upload'&&Boolean(metadata);
      return <article className={styles.card} key={video.id}>
        {metadata?.mediaType==='audio'?<audio src={video.previewUrl} controls preload="none"/>:<video src={video.previewUrl} controls playsInline preload="none"/>}
        <h4>{clipLabel({id:video.id,label:video.label,familyId:video.familyId,role:video.role},project.clipLabels)}</h4><p>{slot?.label??'Ej kategoriserad'} · {metadata?.mediaType==='audio'?'Ljud':'Video'}</p>
        <small>{mediaUsage(project,video,dealerId)}{!video.available?' · Otillgänglig':''}</small>
        <div className={styles.actions}>{!archived&&slot?settings(slot):null}
          {editable?<button disabled={busy||disabled||(!archived&&used)} title={used?'Koppla loss filen och spara projektet först.':undefined} onClick={()=>archived?void archive(video,false):setRemoving(video)}>{archived?'Återställ':'Ta bort'}</button>:<small>Gemensamt original</small>}</div>
        {removing?.id===video.id?<div className={styles.confirm}><p>Ta bort från biblioteket? Filen behålls för historik och kan återställas.</p><button disabled={busy} onClick={()=>void archive(video,true)}>Ta bort från biblioteket</button><button disabled={busy} onClick={()=>setRemoving(null)}>Avbryt</button></div>:null}
      </article>;
    })}</div>:<div className={styles.empty}>{archived?'Inga borttagna filer i kategorin.':'Inga filer här ännu. Lägg in filer ovan för den här dealern.'}</div>}
    {paged.total>0?<nav className={styles.pagination} aria-label="Sidor med klipp"><button type="button" disabled={paged.page<=1} onClick={()=>setPage(paged.page-1)}>← Föregående</button><span role="status">Sida {paged.page} av {paged.pages} · {paged.total} filer · 6 per sida</span><button type="button" disabled={paged.page>=paged.pages} onClick={()=>setPage(paged.page+1)}>Nästa →</button></nav>:null}
  </section>;
}
