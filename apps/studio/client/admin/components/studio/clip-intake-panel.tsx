"use client"
import { useEffect, useImperativeHandle, useRef, useState, type DragEvent, type Ref } from 'react';
import { Check, FolderOpen, GripVertical, RefreshCw, Upload, X } from 'lucide-react';
import { uploadNativeVideo } from '../../../../lib/upload-native-video.mjs';
import { uploadMediaBatch } from '../../../../lib/media-upload-batch.mjs';
import { labUrl, importClassification, importContentType, importErrorMessage, importRowPoses, slotAcceptsPoses, compatibleImportSlot,
  CLIP_POSE_VARIANTS, clipPosesForVariant, clipVariantForPoses, type ImportCatalog } from '../../lib/dealer-import.mjs';
import { INTAKE_DRAG_TYPE, applyIntakeProposals, collectDroppedFiles, intakeConfidenceLabel, intakeDescriptors, intakeDestination, intakeDropCheck, intakeRole, intakeRowIssue, intakeSummary, intakeUploadRows, placeIntakeRow, planIntakeFiles,
  type IntakeEntry, type IntakeProposal, type IntakeRow } from '../../lib/clip-intake.mjs';
import type { ClipGroup } from '../../lib/studio-layout.mjs';
import type { VideoInventory } from '../../lib/connected-studio.mjs';

export type ClipIntakeHandle = {
  addFiles(entries:IntakeEntry[],slotId?:string):void;
  place(rowId:string,slotId:string):void;
  dropCheck(rowId:string,slotId:string):{accepted:boolean;reason:string};
};
type Props = {
  ref?:Ref<ClipIntakeHandle>;
  dealer:{id:string;label:string}|null;
  groups:ClipGroup[];
  active:boolean;
  blocked:boolean;
  hasStandard:(slotId:string)=>boolean;
  onBusyChange:(busy:boolean)=>void;
  onPendingChange:(count:number)=>void;
  onInventory:(inventory:VideoInventory)=>void;
  onDragChange:(rowId:string|null)=>void;
  onBind:(slotId:string,videoId:string,asAlternative:boolean)=>void;
  onOpenSlot:(slotId:string)=>void;
  onChooseDealer:()=>void;
};
type Answer = {dealerId:string|null;intent:string;rows:IntakeProposal[];assistantMessage?:string;source?:string;warnings?:string[]};

async function jsonRequest<T>(path:string, options:RequestInit = {}):Promise<T> {
  const response = await fetch(labUrl(path), {...options, credentials:'same-origin', cache:'no-store', redirect:'error',
    headers:{accept:'application/json', ...(options.body ? {'Content-Type':'application/json'} : {}), ...options.headers}});
  let value;
  try { value = await response.json(); } catch { throw Error('Studio gav inget giltigt svar. Kontrollera din inloggning.'); }
  if (!response.ok) throw Error([401,403].includes(response.status) ? 'Din interna session behöver förnyas. Öppna administrationen igen.' : value.error || 'Studio kunde inte slutföra begäran.');
  return value;
}
function validateCatalog(value:ImportCatalog) {
  if (!value || !Array.isArray(value.dealers) || !Array.isArray(value.slots) || !value.limits
    || !Number.isInteger(value.limits.maxFiles) || value.limits.maxFiles < 1 || value.limits.maxFiles > 30
    || !Number.isInteger(value.limits.maxFileBytes) || value.limits.maxFileBytes > 134217728) throw Error('Importkatalogen kunde inte verifieras.');
  return value;
}

// A still from the first frame; the row text carries the meaning.
function IntakeThumb({file,kind}:{file:File;kind:string}) {
  const [url,setUrl]=useState('');
  useEffect(()=>{const next=URL.createObjectURL(file);setUrl(next);return()=>URL.revokeObjectURL(next);},[file]);
  return <div className="studio-intake-thumb" aria-hidden="true">{!url?null:kind==='video'?<video src={url+'#t=0.1'} muted playsInline preload="metadata" tabIndex={-1}/>:kind==='image'?<img src={url} alt=""/>:<span>{kind==='audio'?'Ljud':'Fil'}</span>}</div>;
}

export function ClipIntakePanel({ref,dealer,groups,active,blocked,hasStandard,onBusyChange,onPendingChange,onInventory,onDragChange,onBind,onOpenSlot,onChooseDealer}:Props) {
  const [catalog,setCatalog]=useState<ImportCatalog|null>(null),[loadCount,setLoadCount]=useState(0),[loading,setLoading]=useState(true);
  const [rows,setRows]=useState<IntakeRow[]>([]),[context,setContext]=useState(''),[background,setBackground]=useState<'green-screen'|'alpha'>('green-screen');
  const [busy,setBusy]=useState<'propose'|'upload'|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[dragging,setDragging]=useState(''),[dropHover,setDropHover]=useState(false);
  const busyRef=useRef(false),controller=useRef<AbortController|null>(null),rowsRef=useRef(rows),catalogRef=useRef(catalog);
  const fileInput=useRef<HTMLInputElement>(null),folderInput=useRef<HTMLInputElement>(null);
  rowsRef.current=rows;catalogRef.current=catalog;
  const dealerId=dealer?.id??'';
  const dealerKnown=Boolean(catalog&&dealer&&catalog.dealers.some(row=>row.id===dealer.id));
  const summary=catalog&&dealer?intakeSummary(rows,dealer.id,catalog):null;

  useEffect(()=>{
    if(!active)return;
    const abort=new AbortController();setLoading(true);
    jsonRequest<ImportCatalog>('/api/dealers/import-proposal',{signal:abort.signal})
      .then(value=>{if(!abort.signal.aborted){setCatalog(validateCatalog(value));setError('');}})
      .catch(cause=>{if(!abort.signal.aborted){setCatalog(null);setError(cause instanceof Error?cause.message:'Importkatalogen kunde inte läsas.');}})
      .finally(()=>{if(!abort.signal.aborted)setLoading(false);});
    return()=>abort.abort();
  },[loadCount,active]);
  useEffect(()=>()=>controller.current?.abort(),[]);
  useEffect(()=>{onBusyChange(busy!==null);},[busy,onBusyChange]);
  useEffect(()=>{onPendingChange(rows.filter(row=>row.state!=='saved').length);},[rows,onPendingChange]);

  function update(id:string,patch:Partial<IntakeRow>) {setRows(items=>items.map(row=>row.id===id?{...row,...patch}:row));}
  async function propose(targets:IntakeRow[]) {
    const current=catalogRef.current;
    if(busyRef.current||!current||!dealer||!targets.length)return;
    if(!current.dealers.some(row=>row.id===dealer.id)){setError('Dealern är inte aktiv i importkatalogen. Läs om katalogen och välj dealer igen.');return;}
    busyRef.current=true;setBusy('propose');setError('');
    const abort=new AbortController();controller.current=abort;
    try {
      const response=await jsonRequest<Answer>('/api/dealers/import-proposal',{method:'POST',signal:abort.signal,
        body:JSON.stringify({intent:'mapping',dealerId:dealer.id,files:intakeDescriptors(targets),context})});
      if(response.dealerId!==dealer.id||response.intent!=='mapping'||!Array.isArray(response.rows))throw Error('Förslaget kunde inte verifieras. Dina filer finns kvar; välj fack själv eller försök igen.');
      setRows(items=>applyIntakeProposals(items,response.rows,current));
      setNotice(response.source==='ai'?'Förslagen är klara. Granska varje fack; dra om i kartan om något är fel.':'Förslagen bygger på filnamn och mappar. Granska varje fack; dra om i kartan om något är fel.');
    } catch(cause) {if(!abort.signal.aborted)setError(cause instanceof Error?cause.message:'Förslaget kunde inte hämtas. Dina filer finns kvar.');}
    finally {busyRef.current=false;setBusy(null);controller.current=null;}
  }
  function addFiles(entries:IntakeEntry[],slotId='') {
    if(busyRef.current||!entries.length)return;
    const current=catalogRef.current;
    if(!dealer){setError('Välj dealer i raden ovanför kartan innan du lägger till klipp.');onChooseDealer();return;}
    const planned=planIntakeFiles(entries,rowsRef.current,current?.limits,{slotId,background});
    const kept=rowsRef.current.filter(row=>row.state!=='saved'||!planned.rows.length);
    const next=[...kept,...planned.rows];
    rowsRef.current=next;setRows(next);
    const notes=[planned.duplicates?`${planned.duplicates} filer fanns redan i listan.`:'',planned.overflow?`${planned.overflow} filer fick inte plats: högst ${planned.maxFiles} osparade filer per omgång.`:''].filter(Boolean);
    setError(notes.join(' '));
    const unplaced=planned.rows.filter(row=>row.state==='ready'&&!row.slotId);
    if(unplaced.length&&current)void propose(unplaced);
    else if(!current)setNotice('Filerna är tillagda. Importkatalogen läses in innan förslag kan hämtas.');
  }
  function place(rowId:string,slotId:string) {
    const current=catalogRef.current;
    if(busyRef.current||!current)return;
    const next=placeIntakeRow(rowsRef.current,rowId,slotId,current);
    rowsRef.current=next;setRows(next);setNotice('');
  }
  useImperativeHandle(ref,()=>({addFiles,place,dropCheck:(rowId,slotId)=>intakeDropCheck(rowsRef.current.find(row=>row.id===rowId),catalogRef.current?.slots.find(slot=>slot.id===slotId))}));

  async function save() {
    if(busyRef.current||!catalog||!dealer||!summary)return;
    if(summary.issues.length){setError(`${summary.issues[0].row.file.name}: ${summary.issues[0].message}`);return;}
    const uploads=intakeUploadRows(rows);
    if(!uploads.length)return;
    busyRef.current=true;setBusy('upload');setError('');setNotice('');
    const abort=new AbortController();controller.current=abort;
    try {
      const fresh=validateCatalog(await jsonRequest<ImportCatalog>('/api/dealers/import-proposal',{signal:abort.signal}));
      const prepared=uploads.map(row=>({row,classification:importClassification(row,dealer.id,fresh)}));
      if(prepared.some(({row,classification})=>JSON.stringify(classification)!==JSON.stringify(importClassification(row,dealer.id,catalog))))throw Error('Fackens betydelse har ändrats. Läs om katalogen och granska placeringarna igen.');
      const capability=await jsonRequest<{uploadMode?:string}>('/api/videos',{signal:abort.signal});
      if(capability.uploadMode!=='private-client-blob')throw Error('Den privata medielagringen är inte ansluten.');
      const count=await uploadMediaBatch(prepared,{signal:abort.signal,onChange:(id,patch)=>update(id,patch),
        upload:async(file,classification,onUploadProgress)=>{
          const result=await uploadNativeVideo(file,classification,importContentType(file.name),{signal:abort.signal,onUploadProgress});
          const item=prepared.find(entry=>entry.row.file===file);if(item)update(item.row.id,{videoId:result.id});
          return result;
        }});
      const inventory=await jsonRequest<VideoInventory>('/api/videos',{signal:abort.signal});
      if(Array.isArray(inventory.videos))onInventory(inventory);
      setNotice(`${count} av ${prepared.length} klipp sparades hos ${dealer.label}. De ligger som tagningar i sina fack; koppla dem till utkastet nedan eller i kortet.`);
    } catch(cause) {if(!abort.signal.aborted)setError(cause instanceof Error?cause.message:'Uppladdningen kunde inte slutföras. Filerna finns kvar i listan.');}
    finally {busyRef.current=false;setBusy(null);controller.current=null;}
  }
  function startDrag(event:DragEvent<HTMLElement>,row:IntakeRow) {
    event.dataTransfer.setData(INTAKE_DRAG_TYPE,row.id);event.dataTransfer.setData('text/plain',row.file.name);event.dataTransfer.effectAllowed='move';
    setDragging(row.id);onDragChange(row.id);
  }
  function endDrag() {setDragging('');onDragChange(null);}
  async function dropFiles(event:DragEvent<HTMLElement>) {
    event.preventDefault();setDropHover(false);
    if(!event.dataTransfer.types.includes('Files'))return;
    const result=await collectDroppedFiles(event.dataTransfer);
    addFiles(result.files);
    if(result.truncated)setError(`Bara de första ${result.files.length} filerna lästes från mappen.`);
  }
  const locked=blocked||Boolean(busy)||loading;
  const unsaved=rows.filter(row=>row.state!=='saved');
  const groupTitle=(slotId:string)=>intakeDestination(slotId,catalog,groups)?.title??'Övrigt';
  return <section className="studio-intake" aria-label="Lägg till klipp">
    <p className="studio-intake-intro">Dra in filer eller en hel mapp. Du får ett förslag på fack per klipp, kan dra om kortet till rätt kategori i kartan och godkänner sedan. Bara MP4 och WebM sparas.</p>
    {!dealer&&<p role="alert" className="studio-intake-alert">Välj dealer i raden ovanför kartan. <button type="button" className="studio-button" onClick={onChooseDealer}>Välj dealer</button></p>}
    <div className={`studio-intake-drop ${dropHover?'is-hover':''}`} onDragOver={event=>{if(event.dataTransfer.types.includes('Files')){event.preventDefault();setDropHover(true);}}} onDragLeave={()=>setDropHover(false)} onDrop={event=>{void dropFiles(event);}}>
      <Upload size={22} aria-hidden="true"/>
      <strong>{dealer?`Släpp klipp till ${dealer.label} här`:'Släpp klipp här'}</strong>
      <p>{catalog?`${unsaved.length} av ${catalog.limits.maxFiles} platser i omgången används.`:'Importkatalogen läses in…'} Undermappar följer med som ledtråd, till exempel repliker/sv.</p>
      <div className="studio-intake-pick">
        <button type="button" className="studio-button" disabled={locked||!dealer} onClick={()=>fileInput.current?.click()}><Upload size={15}/>Välj filer</button>
        <button type="button" className="studio-button" disabled={locked||!dealer} onClick={()=>folderInput.current?.click()}><FolderOpen size={15}/>Välj mapp</button>
      </div>
      <input ref={fileInput} aria-label="Välj klippfiler" type="file" hidden multiple accept=".mp4,.webm,.mp3,.wav,.png,.jpg,.jpeg,.webp" disabled={locked||!dealer} onChange={event=>{addFiles(Array.from(event.target.files??[]));event.target.value='';}}/>
      <input ref={folderInput} aria-label="Välj en mapp med klipp" type="file" hidden multiple disabled={locked||!dealer} {...({webkitdirectory:''} as Record<string,string>)} onChange={event=>{addFiles(Array.from(event.target.files??[]).map(file=>({file,path:file.webkitRelativePath})));event.target.value='';}}/>
    </div>
    <div className="studio-intake-settings">
      <label className="studio-field">Bakgrund i filmerna<select value={background} disabled={locked} onChange={event=>{const next=event.target.value as typeof background;setBackground(next);setRows(items=>items.map(row=>row.state==='ready'?{...row,background:next}:row));}}>
        <option value="green-screen">Grön bakgrund</option><option value="alpha">Transparent · spärrad för import</option></select></label>
      {background==='alpha'&&<p className="studio-intake-warning">Transparenta klipp är spärrade för import (serverregel). Välj grön bakgrund för att kunna spara, eller ta bort filerna.</p>}
      <details className="studio-intake-context"><summary>Beskriv materialet · valfritt</summary>
        <label className="studio-field">Din beskrivning<textarea value={context} maxLength={4000} rows={3} disabled={locked} placeholder="Exempel: Mappen sv är svenska repliker. pos1–pos7 är spelarplatserna från vänster." onChange={event=>setContext(event.target.value)}/></label>
        <button type="button" className="studio-button" disabled={locked||!dealerKnown||!unsaved.some(row=>row.state==='ready')} onClick={()=>void propose(rows.filter(row=>row.state==='ready'))}><RefreshCw size={14}/>Föreslå placering igen</button>
      </details>
    </div>
    {error&&<p role="alert" className="studio-intake-alert">{importErrorMessage(error)} {!catalog&&!loading&&<button type="button" className="studio-button" onClick={()=>setLoadCount(value=>value+1)}>Försök igen</button>}</p>}
    {notice&&<p role="status" className="studio-intake-notice">{notice}</p>}
    {busy==='propose'&&<p role="status" className="studio-intake-notice">Hämtar förslag på placering…</p>}
    {rows.length>0&&catalog&&dealer&&<ol className="studio-intake-rows" aria-label="Klipp att placera">{rows.map(row=>{
      const slot=catalog.slots.find(item=>item.id===row.slotId),destination=intakeDestination(row.slotId,catalog,groups);
      const role=intakeRole(row,catalog,dealer.id,hasStandard),issue=intakeRowIssue(row,dealer.id,catalog);
      const editable=row.state==='ready'&&!row.blocked&&!busy&&!blocked;
      const poses=slot&&row.kind==='video'?importRowPoses(row,slot):null;
      const choices=catalog.slots.filter(item=>!item.pose&&compatibleImportSlot(row.file,item));
      const choiceGroups=[...new Set(choices.map(item=>groupTitle(item.id)))];
      const folder=row.path?row.path.slice(0,row.path.length-row.file.name.length-1):'';
      return <li key={row.id} className={`studio-intake-row is-${row.state} ${row.blocked?'is-blocked':''} ${dragging===row.id?'is-dragging':''}`} draggable={editable} onDragStart={event=>{if(editable)startDrag(event,row);else event.preventDefault();}} onDragEnd={endDrag} aria-grabbed={editable?dragging===row.id:undefined}>
        <IntakeThumb file={row.file} kind={row.kind}/>
        <div className="studio-intake-body">
          <header><GripVertical size={16} aria-hidden="true" className="studio-intake-grip"/><strong title={row.file.name}>{row.file.name}</strong>{folder&&<small title={row.path}>{folder}/</small>}
            <button type="button" className="studio-intake-remove" aria-label={`Ta bort ${row.file.name} ur listan`} disabled={locked||row.state==='saving'} onClick={()=>{if(!busyRef.current&&!blocked&&!loading)setRows(items=>items.filter(item=>item.id!==row.id));}}><X size={15}/>Ta bort ur listan</button></header>
          {!row.blocked&&<p className="studio-intake-destination">{destination?<><span className="studio-intake-eyebrow">Fack</span><strong>{destination.label}</strong></>:<strong className="studio-intake-unsure">Osäker · välj fack</strong>}
            {role&&<span className={`studio-intake-badge is-${role}`}>{role==='standard'?'Standard':'Variant'}</span>}
            <span className={`studio-intake-badge is-${row.slotId?row.confidence??'proposed':'low'}`}>{intakeConfidenceLabel(row)}</span></p>}
          {row.reason&&!row.blocked&&<p className="studio-intake-reason">{row.reason}</p>}
          {(row.language||row.take!==undefined)&&<p className="studio-intake-meta">{row.language&&<span>Språk {row.language}</span>}{row.take!==undefined&&<span>Tagning {row.take}</span>}</p>}
          {poses&&<p className="studio-intake-meta"><span className="studio-pose-chain">Poskedja <strong>{poses.start} → {poses.end}</strong></span></p>}
          {editable&&row.alternatives&&row.alternatives.length>0&&<div className="studio-intake-alternatives" role="group" aria-label={`Snabbval för ${row.file.name}`}>{row.alternatives.map(alternative=>{const target=intakeDestination(alternative.slotId,catalog,groups);return <button key={alternative.slotId} type="button" className="studio-button" title={alternative.reason||undefined} onClick={()=>place(row.id,alternative.slotId)}>Lägg i {target?.label??alternative.slotId}</button>;})}</div>}
          {editable&&<div className="studio-intake-fields">
            <label className="studio-field">Byt fack<select aria-label={`Fack för ${row.file.name}`} value={row.slotId} onChange={event=>{if(event.target.value)place(row.id,event.target.value);else update(row.id,{slotId:'',reason:'Inget fack valt.',confidence:undefined});}}>
              <option value="">Välj fack…</option>{choiceGroups.map(title=><optgroup key={title} label={title}>{choices.filter(item=>groupTitle(item.id)===title).map(item=><option key={item.id} value={item.id}>{intakeDestination(item.id,catalog,groups)?.caption??item.label}</option>)}</optgroup>)}
            </select></label>
            {slot&&row.kind==='video'&&slotAcceptsPoses(slot)&&slot.eventId!=='transition.shoe'&&<label className="studio-field">Händernas läge<select aria-label={`Poskedja för ${row.file.name}`} value={clipVariantForPoses(row.poses)??''} onChange={event=>{const next=clipPosesForVariant(event.target.value);setRows(items=>items.map(item=>{if(item.id!==row.id)return item;const {poses:_old,...rest}=item;return next?{...rest,poses:next}:rest;}));}}>
              <option value="">Okänd · inget sparas</option>{Object.entries(CLIP_POSE_VARIANTS).map(([id,variant])=><option key={id} value={id}>{variant.label}</option>)}</select></label>}
          </div>}
          {slot?.category==='speech'&&row.state!=='saved'&&!row.blocked&&<p className="studio-intake-meta">Sparas som tagning i talfacket. Text, ljud och godkännande av talet granskas separat under Röst &amp; tal.</p>}
          {row.warnings?.filter(Boolean).map((warning,index)=><p key={index} className="studio-intake-warning">{warning}</p>)}
          <p className={`studio-intake-status ${issue?'is-issue':row.state==='saved'?'is-saved':''}`} role="status">{row.state==='saving'?`Laddar upp ${row.progress??0} %…`:row.state==='saved'?<><Check size={13}/> Sparad i {destination?.label??'facket'}</>:issue||'Klar att godkänna.'}</p>
          {row.state==='saved'&&row.videoId&&row.slotId&&<div className="studio-intake-receipt">
            {!hasStandard(row.slotId)?<button type="button" className="studio-button" disabled={blocked||Boolean(busy)} onClick={()=>onBind(row.slotId,row.videoId!,false)}>Sätt som standard i facket</button>
              :slot?.eventId==='transition.shoe'?<button type="button" className="studio-button" disabled={blocked||Boolean(busy)} onClick={()=>onBind(row.slotId,row.videoId!,true)}>Lägg som variant</button>:null}
            <button type="button" className="studio-button" disabled={blocked||Boolean(busy)} onClick={()=>onOpenSlot(row.slotId)}>Öppna facket i kartan</button>
          </div>}
        </div>
      </li>;})}</ol>}
    {rows.length>0&&summary&&dealer&&<footer className="studio-intake-footer">
      {summary.issues.length>0&&<p className="studio-intake-warning">{summary.issues.length===1?'1 fil behöver rättas':`${summary.issues.length} filer behöver rättas`} innan du godkänner. Bild- och ljudfiler tas bort ur listan; osäkra klipp får ett fack genom att dras till kartan.</p>}
      {summary.saved>0&&<p className="studio-intake-meta">Kopplingar du gör här hamnar i projektutkastet. Välj Spara utkast när du är klar.</p>}
      <div className="studio-intake-actions">
        <button type="button" className="studio-button studio-save" disabled={locked||!dealerKnown||summary.ready===0||summary.issues.length>0} onClick={()=>void save()}><Check size={15}/>{busy==='upload'?'Sparar klippen…':`Godkänn och spara ${summary.ready} klipp hos ${dealer.label}`}</button>
        <button type="button" className="studio-button" disabled={Boolean(busy)||!rows.length} onClick={()=>{if(unsaved.length&&!confirm('Töm listan? Redan sparade klipp finns kvar i klippbanken.'))return;setRows([]);setNotice('');setError('');}}>Töm listan</button>
      </div>
      <p className="studio-intake-meta">Filer med fel försöks inte om automatiskt. Kontrollera facket i kartan innan du lägger till filen igen.</p>
    </footer>}
  </section>;
}
