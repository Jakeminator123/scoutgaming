'use client';

import {useCallback,useEffect,useMemo,useRef,useState, type MouseEvent} from 'react';
import {labUrl} from '../lib/lab-url.mjs';
import {studioNavigationHref, type StudioNavigationContext} from '../lib/studio-navigation.mjs';
import styles from './dealer-forge-page.module.css';

type Status={level:'ready'|'required'|'recommended'|'optional'|'pending'|'blocked';label:string;count?:number};
type Media={id:string;label:string;role:string;previewUrl:string|null;available:boolean;archived:boolean;mediaType:string;sha256:string};
type Job={jobId:string;slotId:string;kind:string;status:string;taskId:string|null;request:any;result:any;error:string|null;createdAt:number;updatedAt:number};
type Slot={id:string;group:string;kind:string;label:string;start?:string;end?:string;eventId?:string;situation?:string;target?:string;pose?:string;role?:string;needsEvent?:boolean;required?:boolean;media:Media[];jobs:Job[];status:Status};
type Profile={subject:string;theme:string;tableStyle:string;positions:Record<string,{cx:number;cy:number}>;anchors:Record<string,{sha256:string;width:number;height:number}>;avatar:{id:string;status:string}|null;voice:{presetId:string};language:string;revision:number|null};
type State={dealer:{id:string;label:string};profile:Profile;groups:{id:string;label:string}[];slots:Slot[];jobs:Job[];layers:any[];speechLines:Record<string,string>;migrationReady:boolean;runwayConfigured:boolean;priceChecked:string};
type Preview={plan:{model:string;mode:string;credits:number;duration:number;quality:string;ratio:string|null};prompt:string;anchors:string[];anchorsPresent:string[];slot:{needsEvent:boolean}};

const ACTIVE=new Set(['prepared','submitting','queued','running','generated','committing']);
const VOICES=['victoria','vincent','clara','drew','skye','max','morgan','felix','mia','marcus','summer','ruby','aurora','jasper','leo','adrian','nina','emma','blake','david','maya','nathan','sam','georgia','petra','adam','zach','violet','roman','luna'];
const api=(path:string)=>labUrl(`/api/forge${path}`);
const statusText:Record<string,string>={prepared:'Förbereds',submitting:'Skickas',submit_unknown:'Okänt – kontrollera Runway',queued:'I kö',running:'Genereras',generated:'Hämtar & registrerar',committing:'Registrerar',succeeded:'Klar',failed:'Misslyckades',cancelled:'Avbruten'};

async function call<T>(path:string,init?:RequestInit):Promise<T>{
  const response=await fetch(api(path),{credentials:'same-origin',...init,headers:{...(init?.body&&!(init.body instanceof Blob)?{'Content-Type':'application/json'}:{}),...(init?.headers??{})}});
  const text=await response.text();let data:any=null;try{data=text?JSON.parse(text):null;}catch{data=null;}
  if(!response.ok){const message=data?.message||data?.error||`HTTP ${response.status}`;throw Object.assign(new Error(message),{code:data?.error,status:response.status});}
  return data as T;
}
const post=<T,>(path:string,body:unknown)=>call<T>(path,{method:'POST',body:JSON.stringify(body)});

async function downsizeImage(file:File):Promise<Blob>{
  const bitmap=await createImageBitmap(file);
  const scale=Math.min(1,1080/bitmap.width,1920/bitmap.height);
  const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
  canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
  for(const quality of [0.95,0.9,0.85,0.8]){
    const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
    if(blob&&blob.size<=3.8*1024*1024)return blob;
  }
  throw new Error('Bilden kunde inte komprimeras under 4 MB.');
}

export type ForgeIndex={dealers:{id:string;label:string}[];migrationReady:boolean;runwayConfigured:boolean};

function materialError(cause:unknown) {
  const error=cause as {code?:string;status?:number;message?:string};
  if(error.status===401)return 'Din inloggning har gått ut. Logga in igen för att fortsätta. Ditt utkast finns kvar på sidan.';
  if(error.status===403)return 'Materialskapandet kunde inte öppnas med din nuvarande behörighet. Kontrollera inloggningen och försök igen.';
  if(error.code==='forge_migration_pending')return 'Materialskapandet är inte färdigkonfigurerat. Kontakta administratören.';
  if(!error.status||error.status>=500||error.code?.startsWith('studio_'))return 'Materialskapandet är tillfälligt otillgängligt. Försök ansluta igen. Ditt utkast finns kvar på sidan.';
  return error.message&&!/^[a-z_]+$/.test(error.message)?error.message:'Åtgärden kunde inte slutföras. Kontrollera uppgifterna och försök igen.';
}

export function DealerMaterialCreator({dealerId,initialIndex,initialState,active=true,disabled=false,onPendingChange,navigationContext={},onNavigate}:{dealerId:string;initialIndex?:ForgeIndex|null;initialState?:State|null;active?:boolean;disabled?:boolean;onPendingChange?:(status:{dirty:boolean;busy:boolean})=>void;navigationContext?:StudioNavigationContext;onNavigate?:(event:MouseEvent<HTMLAnchorElement>,href:string)=>void}) {
  const [meta,setMeta]=useState<{migrationReady:boolean;runwayConfigured:boolean}|null>(initialIndex?{migrationReady:initialIndex.migrationReady,runwayConfigured:initialIndex.runwayConfigured}:null);
  const [state,setState]=useState<State|null>(initialState??null);
  const [error,setError]=useState('');const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);
  const [reading,setReading]=useState(!initialState);
  const [unavailable,setUnavailable]=useState(!initialState);
  const [composer,setComposer]=useState<{slotId:string;quality:string;duration:number;mode:string;expression:string;referenceMediaId:string;prompt:string;maxCredits:number;preview:Preview|null;loading:boolean}|null>(null);
  const [profileDraft,setProfileDraft]=useState<Partial<Profile>|null>(null);
  const [showPositions,setShowPositions]=useState(false);
  const [uploadError,setUploadError]=useState('');
  const pollingRef=useRef(false);
  const actionRef=useRef(false);
  const previewRef=useRef(0);
  const mountedRef=useRef(true);
  const readRef=useRef(0);
  const dealerRef=useRef(dealerId);dealerRef.current=dealerId;
  // One idempotency key per distinct job request: a retry after a network/5xx error reuses it, so the server returns the journaled job instead of paying again.
  const attemptRef=useRef<{signature:string;requestId:string}|null>(null);
  useEffect(()=>{mountedRef.current=true;return()=>{mountedRef.current=false;readRef.current++;previewRef.current++;};},[]);

  const loadState=useCallback(async(id:string)=>{
    if(!id||!mountedRef.current)return;const request=++readRef.current;setReading(true);
    const current=()=>mountedRef.current&&request===readRef.current&&id===dealerRef.current;
    try{const data=await call<State>(`/${encodeURIComponent(id)}`);if(!current())return;setState(data);setMeta({migrationReady:data.migrationReady,runwayConfigured:data.runwayConfigured});setUnavailable(false);setError('');}
    catch(cause){if(current()){setUnavailable(true);setError(materialError(cause));}}
    finally{if(current())setReading(false);}
  },[]);
  useEffect(()=>{if(!initialState)void loadState(dealerId);},[dealerId,loadState,initialState]);
  const draftPending=Boolean(profileDraft||composer), operationPending=busy||Boolean(composer?.loading);
  useEffect(()=>{onPendingChange?.({dirty:draftPending,busy:operationPending});},[draftPending,operationPending,onPendingChange]);
  useEffect(()=>()=>onPendingChange?.({dirty:false,busy:false}),[onPendingChange]);

  // Poll active jobs one at a time; the server advances the Runway task and commits finished output.
  useEffect(()=>{
    if(!active||disabled||unavailable||!state||!dealerId)return;
    const activeJobs=state.jobs.filter(job=>ACTIVE.has(job.status)&&!(job.status==='queued'&&!job.taskId&&!job.request?.awaitingAvatar));
    if(!activeJobs.length)return;
    const timer=window.setTimeout(async()=>{
      if(pollingRef.current)return;pollingRef.current=true;
      let changed=false;
      try{
        for(const job of activeJobs){
          try{const next=await post<Job>(`/${encodeURIComponent(dealerId)}/jobs/${job.jobId}/poll`,{});if(next.status!==job.status||next.result?.progress!==job.result?.progress)changed=true;}
          catch(cause){setUnavailable(true);setError(materialError(cause));return;}
        }
      } finally{pollingRef.current=false;}
      if(changed)await loadState(dealerId);else setState(current=>current?{...current}:current);
    },5000);
    return()=>window.clearTimeout(timer);
  },[state,dealerId,loadState,active,disabled,unavailable]);

  const slotsByGroup=useMemo(()=>{const map=new Map<string,Slot[]>();for(const slot of state?.slots??[])map.set(slot.group,[...(map.get(slot.group)??[]),slot]);return map;},[state]);
  const anchorUrl=(pose:string)=>state?.profile.anchors[pose]?api(`/${encodeURIComponent(dealerId)}/anchor/${pose}`):null;
  const posterFor=(slot:Slot)=>anchorUrl(slot.start==='REDO'?'redo':'vila')??undefined;

  function actionError(cause:unknown){
    setError(materialError(cause));
    const {status,code}=cause as {status?:number;code?:string};
    if(!status||status>=500||status===401||status===403||code?.startsWith('studio_'))setUnavailable(true);
  }
  async function run(action:()=>Promise<void>,success?:string){
    if(actionRef.current||disabled||unavailable||reading||!mountedRef.current||state?.dealer.id!==dealerId)return;
    actionRef.current=true;setBusy(true);setError('');
    try{await action();if(success)setNotice(success);}
    catch(cause){actionError(cause);}
    finally{actionRef.current=false;setBusy(false);}
  }
  async function uploadAnchor(pose:'vila'|'redo',file:File|undefined){
    if(!file)return;setUploadError('');
    await run(async()=>{
      const blob=await downsizeImage(file);
      await call(`/${encodeURIComponent(dealerId)}/anchor`,{method:'POST',body:blob,headers:{'Content-Type':'image/jpeg','X-Forge-Pose':pose}});
      await loadState(dealerId);
    },pose==='vila'?'VILA-bilden är normaliserad till 1080×1920 på grönt och sparad som ankare.':'REDO-bilden är sparad som ankare.').catch(()=>{});
  }
  async function openComposer(slot:Slot,mode='keyframe',referenceMediaId=''){
    if(disabled||unavailable||reading||busy)return;
    const request=++previewRef.current;
    const quality=slot.kind==='table'||slot.kind==='pose'?'1080':'720';
    const base={slotId:slot.id,quality,duration:slot.group==='deal'||slot.group==='transition'?2:5,mode,expression:'neutral',referenceMediaId,prompt:'',maxCredits:200,preview:null as Preview|null,loading:true};
    attemptRef.current=null;setComposer(base);
    try{const preview=await post<Preview>(`/${encodeURIComponent(dealerId)}/preview`,{slotId:slot.id,quality,duration:base.duration,mode:mode==='keyframe'?undefined:mode,expression:'neutral',hasReference:Boolean(referenceMediaId)});
      if(request===previewRef.current)setComposer(current=>current&&current.slotId===slot.id?{...current,preview,prompt:preview.prompt,loading:false}:current);}
    catch(cause){if(request!==previewRef.current)return;setComposer(current=>current?{...current,loading:false}:current);actionError(cause);}
  }
  async function refreshPreview(next:NonNullable<typeof composer>){
    if(disabled||unavailable||reading||busy)return;
    const request=++previewRef.current;
    setComposer({...next,loading:true});
    try{const preview=await post<Preview>(`/${encodeURIComponent(dealerId)}/preview`,{slotId:next.slotId,quality:next.quality,duration:next.duration,mode:next.mode==='keyframe'?undefined:next.mode,expression:next.expression,hasReference:Boolean(next.referenceMediaId)});
      if(request===previewRef.current)setComposer(current=>current&&current.slotId===next.slotId?{...current,preview,prompt:current.prompt&&current.prompt!==current.preview?.prompt?current.prompt:preview.prompt,loading:false}:current);}
    catch(cause){if(request!==previewRef.current)return;setComposer(current=>current?{...current,loading:false}:current);actionError(cause);}
  }
  async function submitJob(){
    if(!composer)return;const c=composer;
    const payload={slotId:c.slotId,quality:c.quality,duration:c.duration,mode:c.mode==='keyframe'?undefined:c.mode,expression:c.expression,referenceMediaId:c.referenceMediaId||undefined,prompt:c.prompt,maxCredits:c.maxCredits};
    const signature=JSON.stringify(payload);
    if(attemptRef.current?.signature!==signature)attemptRef.current={signature,requestId:crypto.randomUUID()};
    const {requestId}=attemptRef.current;
    await run(async()=>{
      let job:Job;
      try{job=await post<Job>(`/${encodeURIComponent(dealerId)}/jobs`,{...payload,requestId});}
      catch(cause){
        // 4xx is a definite refusal (nothing paid): the next click is a new request. Otherwise keep the key.
        const status=(cause as {status?:number})?.status;if(typeof status==='number'&&status>=400&&status<500)attemptRef.current=null;
        throw cause;
      }
      attemptRef.current=null;await loadState(dealerId);
      if(job.status==='failed'||job.status==='cancelled')throw new Error(job.error||'Runway avvisade jobbet.');
      setComposer(null);
    },'Jobbet är skickat till Runway. Status uppdateras automatiskt var femte sekund.');
  }
  async function saveProfile(){
    if(!profileDraft)return;
    await run(async()=>{const patch:any={};for(const key of ['subject','theme','tableStyle','positions','language'] as const)if(profileDraft[key]!==undefined)patch[key]=profileDraft[key];if(profileDraft.voice)patch.voice={presetId:profileDraft.voice.presetId};
      await post(`/${encodeURIComponent(dealerId)}/profile`,patch);setProfileDraft(null);await loadState(dealerId);},'Profilen är sparad.');
  }
  const profile=useMemo(()=>state?.dealer.id===dealerId?{...state.profile,...(profileDraft??{})}:null,[state,profileDraft,dealerId]);

  return <section aria-label="Skapa material" className={styles.workspace}>
      <h2>Skapa material{state?` · ${state.dealer.label}`:''}</h2>
      <p className={styles.muted}>Utgå från dealerns grundbilder och skapa förslag på klipp, repliker och scenbilder. Granska resultatet i klippbiblioteket och provspela innan du använder det i en publicerad sammansättning.</p>
      {error?<div className={`${styles.banner} ${styles.bad}`} role="alert">{error} {unavailable?<button type="button" className="sg-btn" disabled={reading||busy} onClick={()=>void loadState(dealerId)}>{reading?'Ansluter…':'Försök ansluta igen'}</button>:null}</div>:null}
      {notice?<div className={`${styles.banner} ${styles.ok}`} role="status">{notice} <button type="button" className="sg-btn" onClick={()=>setNotice('')}>Ok</button></div>:null}
      {meta&&!meta.migrationReady?<div className={`${styles.banner} ${styles.warn}`}>Materialskapandet är inte färdigkonfigurerat. Kontakta administratören för att aktivera lagring av grundbilder och jobb.</div>:null}
      {meta&&!meta.runwayConfigured?<div className={`${styles.banner} ${styles.warn}`}>Genereringstjänsten är inte ansluten. Du kan förbereda grundbilder och profil. En administratör behöver ansluta tjänsten innan du skapar material.</div>:null}
      {disabled?<p className={styles.muted}>Spara dealerinställningarna och kontrollera spelanslutningen innan du skapar material.</p>:null}
      {draftPending?<p className={styles.muted}>Du har ett utkast under Skapa material. <button type="button" className="sg-btn" disabled={operationPending} onClick={()=>{previewRef.current++;setComposer(null);setProfileDraft(null);attemptRef.current=null;}}>Ångra materialutkast</button></p>:null}

      <fieldset className={styles.controls} disabled={disabled||unavailable||reading||busy}>
      {state&&profile?<>
        <div className={styles.grid}>
          <section className={styles.card} aria-labelledby="forge-anchors">
            <h2 id="forge-anchors">Grundposer · {state.dealer.label}</h2>
            <p className={styles.muted}>VILA (båda händerna i vila) laddas upp som en stående bild och normaliseras till 1080×1920 på grönt. REDO (vänster hand vid skon) genereras från VILA eller laddas upp om du har ett foto. Alla klipp utgår från dessa två bilder.</p>
            <div className={styles.anchors}>
              {(['vila','redo'] as const).map(pose=>{const slot=state.slots.find(row=>row.id===`pose/${pose}`)!;const url=anchorUrl(pose);
                return <div key={pose} className={styles.anchor}>
                  <div className={styles.anchorFrame}>{url?<img key={state.profile.anchors[pose]?.sha256} src={url} alt={`${pose.toUpperCase()}-ankare för ${state.dealer.label}`} />:<span className={styles.muted}>{pose.toUpperCase()} saknas</span>}</div>
                  <div><span className={`${styles.pill} ${styles[slot.status.level]}`}>{slot.status.label}</span></div>
                  <div className={styles.actions}>
                    <label className="sg-btn">{url?'Byt bild':'Ladda upp'}<input type="file" accept="image/png,image/jpeg,image/webp" hidden disabled={busy||!state.migrationReady} onChange={event=>void uploadAnchor(pose,event.target.files?.[0])} /></label>
                    {pose==='redo'?<button type="button" className="sg-btn sg-btn-primary" disabled={busy||!state.profile.anchors.vila||!state.runwayConfigured||!state.migrationReady} onClick={()=>void openComposer(slot)}>Generera från VILA</button>:null}
                  </div>
                  {slot.jobs.filter(job=>ACTIVE.has(job.status)).map(job=><div key={job.jobId} className={styles.job}>⏳ {statusText[job.status]} {job.result?.progress!=null?`${Math.round(job.result.progress*100)} %`:''}</div>)}
                  {pose==='redo'?slot.jobs.filter(job=>job.status==='succeeded'&&job.result?.anchor&&job.result.anchor.sha256!==state.profile.anchors.redo?.sha256).slice(0,3).map(job=><div key={job.jobId} className={styles.inlineForm}><span className={styles.small}>Kandidat {job.jobId.slice(0,8)}</span><button type="button" className="sg-btn" disabled={busy} onClick={()=>void run(async()=>{await post(`/${encodeURIComponent(dealerId)}/pose/adopt`,{jobId:job.jobId});await loadState(dealerId);},'REDO-ankaret är bytt.')}>Använd som REDO</button></div>):null}
                </div>;})}
            </div>
            {uploadError?<p className={styles.bad}>{uploadError}</p>:null}
            {composer&&composer.slotId==='pose/redo'?<Composer composer={composer} state={state} busy={busy} onChange={next=>void refreshPreview(next)} onEdit={setComposer} onSubmit={()=>void submitJob()} onClose={()=>setComposer(null)} />:null}
          </section>

          <section className={styles.card} aria-labelledby="forge-profile">
            <h2 id="forge-profile">Profil &amp; promptbas</h2>
            <div className={styles.fields}>
              <label className={styles.field}>Identitet i prompten<input value={profile.subject} onChange={event=>setProfileDraft({...profileDraft,subject:event.target.value})} placeholder="woman with dark hair, white shirt, black vest" /></label>
              <label className={styles.field}>Rumstema (bakgrund)<input value={profile.theme} onChange={event=>setProfileDraft({...profileDraft,theme:event.target.value})} /></label>
              <label className={styles.field}>Bordsmaterial<input value={profile.tableStyle} onChange={event=>setProfileDraft({...profileDraft,tableStyle:event.target.value})} /></label>
              <label className={styles.field}>Röst (Runway-avatar för repliker)<select value={profile.voice.presetId} onChange={event=>setProfileDraft({...profileDraft,voice:{presetId:event.target.value}})}>{VOICES.map(voice=><option key={voice} value={voice}>{voice}</option>)}</select></label>
              <label className={styles.field}>Replikspråk<select value={profile.language} onChange={event=>setProfileDraft({...profileDraft,language:event.target.value})}><option value="en">Engelska (replikbanken)</option><option value="sv">Svenska</option></select></label>
            </div>
            <p className={styles.muted}>Avatar: {profile.avatar?`${profile.avatar.id} · ${profile.avatar.status}`:'skapas automatiskt vid första repliken'} · Priser kontrollerade {state.priceChecked} (1 kredit = 0,01 USD).</p>
            <button type="button" className="sg-btn" onClick={()=>setShowPositions(!showPositions)}>{showPositions?'Dölj kortkoordinater':'Visa kortkoordinater'}</button>
            {showPositions?<div className={styles.positions}>{Object.entries(profile.positions).map(([name,point])=><label key={name} className={styles.field}>{name==='dealer'?'Dealer':`Plats ${name}`}<span className={styles.inlineForm}><input type="number" value={point.cx} min={0} max={1080} onChange={event=>setProfileDraft({...profileDraft,positions:{...profile.positions,[name]:{...point,cx:Number(event.target.value)}}})} /><input type="number" value={point.cy} min={0} max={1920} onChange={event=>setProfileDraft({...profileDraft,positions:{...profile.positions,[name]:{...point,cy:Number(event.target.value)}}})} /></span></label>)}</div>:null}
            <div className={styles.actions} style={{marginTop:'.75rem'}}>
              <button type="button" className="sg-btn sg-btn-primary" disabled={busy||!profileDraft||!state.migrationReady} onClick={()=>void saveProfile()}>Spara profil</button>
              {profileDraft?<button type="button" className="sg-btn" onClick={()=>setProfileDraft(null)}>Ångra</button>:null}
            </div>
          </section>
        </div>

        {state.groups.filter(group=>group.id!=='pose').map(group=>{const slots=slotsByGroup.get(group.id)??[];if(!slots.length)return null;
          const done=slots.filter(slot=>slot.status.level==='ready').length;
          return <section key={group.id} className={styles.group} aria-labelledby={`forge-group-${group.id}`}>
            <h2 id={`forge-group-${group.id}`}>{group.label} <span>{done}/{slots.length} fack har material</span></h2>
            <table className={styles.table}>
              <thead><tr><th>Fack</th><th>Status</th><th>Klipp &amp; varianter</th><th>Pågår</th><th>Åtgärd</th></tr></thead>
              <tbody>{slots.map(slot=>{const active=slot.jobs.filter(job=>ACTIVE.has(job.status)||job.status==='submit_unknown');
                return <RowFragment key={`${slot.id}:${state.profile.anchors.vila?.sha256}:${state.profile.anchors.redo?.sha256}`} slot={slot} active={active} poster={posterFor(slot)} state={state} busy={busy} dealerId={dealerId} navigationContext={navigationContext} onNavigate={onNavigate}
                  onCreate={mode=>void openComposer(slot,mode)} onVariant={mediaId=>void openComposer(slot,'reference',mediaId)}
                  onCancel={job=>void run(async()=>{await post(`/${encodeURIComponent(dealerId)}/jobs/${job.jobId}/cancel`,{});await loadState(dealerId);})}
                  onResolve={(job,taskId)=>void run(async()=>{await post(`/${encodeURIComponent(dealerId)}/jobs/${job.jobId}/resolve`,{taskId});await loadState(dealerId);},'Task-ID kopplat; pollning fortsätter.')}
                  composer={composer&&composer.slotId===slot.id?<Composer composer={composer} state={state} busy={busy} onChange={next=>void refreshPreview(next)} onEdit={setComposer} onSubmit={()=>void submitJob()} onClose={()=>setComposer(null)} slot={slot} />:null} />;})}</tbody>
            </table>
          </section>;})}

        <section className={`${styles.card} ${styles.log}`} aria-labelledby="forge-log">
          <h3 id="forge-log">Jobblogg</h3>
          {state.jobs.length?<table><thead><tr><th>Tid</th><th>Fack</th><th>Modell</th><th>Status</th><th>Krediter</th><th>Resultat / fel</th></tr></thead><tbody>
            {state.jobs.map(job=><tr key={job.jobId}><td>{new Date(job.createdAt).toLocaleString('sv-SE')}</td><td>{job.request?.slotLabel??job.slotId}</td><td>{job.request?.model??job.request?.plan?.model??'–'}</td><td>{statusText[job.status]??job.status}</td><td>{job.result?.credits??job.request?.plan?.credits??'–'}</td><td>{job.error?<span className={styles.bad}>{job.error}</span>:job.result?.mediaId?`Klipp ${job.result.mediaId.slice(0,8)} · ${job.result.role}`:job.result?.assetId?`Lager ${job.result.assetId.slice(0,8)}`:job.result?.anchor?'Posebild':job.taskId?<code>{job.taskId}</code>:'–'}</td></tr>)}
          </tbody></table>:<p className={styles.muted}>Inga jobb ännu.</p>}
        </section>
      </>:!error&&dealerId?<p className={styles.muted}>Läser dealern…</p>:null}
      </fieldset>
  </section>;
}

function RowFragment({slot,active,poster,state,busy,dealerId,navigationContext,onNavigate,onCreate,onVariant,onCancel,onResolve,composer}:{slot:Slot;active:Job[];poster?:string;state:State;busy:boolean;dealerId:string;navigationContext:StudioNavigationContext;onNavigate?:(event:MouseEvent<HTMLAnchorElement>,href:string)=>void;onCreate:(mode:string)=>void;onVariant:(mediaId:string)=>void;onCancel:(job:Job)=>void;onResolve:(job:Job,taskId:string)=>void;composer:React.ReactNode}) {
  const [taskInput,setTaskInput]=useState('');
  const canGenerate=state.runwayConfigured&&state.migrationReady&&!slot.needsEvent&&!(slot.kind==='pose'&&slot.pose==='vila');
  const videos=slot.media.filter(row=>row.mediaType!=='audio'&&!row.archived);
  const audio=slot.media.filter(row=>row.mediaType==='audio');
  const clipHref=studioNavigationHref('/control/clips?view=clips',{...navigationContext,dealerId,eventId:slot.eventId,situation:slot.situation});
  return <>
    <tr>
      <td><span className={styles.slotLabel}>{slot.label}</span><span className={styles.slotMeta}>{slot.id}{slot.start?` · ${slot.start} → ${slot.end}`:''}{slot.kind==='speech'&&state.speechLines[slot.situation??'']?` · ”${state.speechLines[slot.situation??'']}”`:''}</span></td>
      <td><span className={`${styles.pill} ${styles[slot.status.level]}`}>{slot.status.label}</span></td>
      <td>{videos.length?<div className={styles.thumbs}>{videos.map(media=><a key={media.id} className={`${styles.thumb} ${media.role!=='standard'?styles.thumbVariant:''}`} href={clipHref} onClick={event=>{if(!event.defaultPrevented&&event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey)onNavigate?.(event,clipHref);}} title={media.label}>
        <span className={styles.thumbFrame}>{poster?<img src={poster} alt="Grundpose för klippet" />:<span>Öppna klippet</span>}</span>
        <span>{media.role==='standard'?'Standard':'Variant'}{media.available?'':' · saknas'}</span></a>)}</div>
        :slot.kind==='table'||slot.kind==='background'?<span className={styles.muted}>{state.layers.filter(layer=>layer.role===slot.role).length?`${state.layers.filter(layer=>layer.role===slot.role).length} i Bord & bakgrunder`:'—'}</span>:<span className={styles.muted}>{audio.length?`${audio.length} ljudfil(er), ingen video`:'—'}</span>}</td>
      <td>{active.map(job=><div key={job.jobId} className={styles.job}>{statusText[job.status]??job.status}{job.result?.progress!=null&&job.status==='running'?` · ${Math.round(job.result.progress*100)} %`:''}{job.request?.plan?.credits?` · ~${job.request.plan.credits} kr`:''}
        {job.status==='submit_unknown'?<div className={styles.inlineForm}><input className={styles.small} placeholder="task-ID från Runway" value={taskInput} onChange={event=>setTaskInput(event.target.value)} /><button type="button" className="sg-btn" disabled={busy||!taskInput.trim()} onClick={()=>onResolve(job,taskInput.trim())}>Koppla</button><button type="button" className="sg-btn" disabled={busy} onClick={()=>onCancel(job)}>Avbryt</button></div>
          :<button type="button" className="sg-btn" disabled={busy} onClick={()=>onCancel(job)}>Avbryt</button>}</div>)}
        {!active.length&&slot.jobs.find(job=>job.status==='failed')?<div className={`${styles.job} ${styles.bad}`}>Senaste fel: {slot.jobs.find(job=>job.status==='failed')!.error}</div>:null}</td>
      <td><div className={styles.actions}>
        {slot.kind==='pose'&&slot.pose==='vila'?<span className={styles.muted}>Ladda upp ovan</span>:
          <><button type="button" className="sg-btn sg-btn-primary" disabled={busy||!canGenerate} onClick={()=>onCreate('keyframe')}>{videos.length||slot.kind==='table'||slot.kind==='background'?'Ny variant':'Skapa'}</button>
          {videos.length&&(slot.kind==='clip')?<button type="button" className="sg-btn" disabled={busy||!canGenerate} onClick={()=>onVariant(videos[0].id)}>Variant från klipp</button>:null}</>}
      </div>{slot.needsEvent?<span className={styles.slotMeta}>Aktiveras när eventet transition.shoe finns i projektet.</span>:null}</td>
    </tr>
    {composer?<tr><td colSpan={5}>{composer}</td></tr>:null}
  </>;
}

function Composer({composer,state,busy,onChange,onEdit,onSubmit,onClose,slot}:{composer:NonNullable<any>;state:State;busy:boolean;onChange:(next:any)=>void;onEdit:(next:any)=>void;onSubmit:()=>void;onClose:()=>void;slot?:Slot}) {
  const plan=composer.preview?.plan;
  const missing=(composer.preview?.anchors??[]).filter((pose:string)=>!(composer.preview?.anchorsPresent??[]).includes(pose));
  const isSpeech=slot?.kind==='speech', isLayer=slot?.kind==='table'||slot?.kind==='background'||composer.slotId==='pose/redo';
  const references=(slot?.media??[]).filter(row=>row.mediaType!=='audio'&&!row.archived);
  return <div className={styles.composer} role="group" aria-label={`Generera ${slot?.label??'REDO-pose'}`}>
    <div className={styles.fields}>
      <label className={styles.field}>Kvalitet<select value={composer.quality} onChange={event=>onChange({...composer,quality:event.target.value})}><option value="720">720p · prov/webb</option><option value="1080">1080p · master</option></select></label>
      {!isLayer?<label className={styles.field}>Längd (s)<select value={composer.duration} onChange={event=>onChange({...composer,duration:Number(event.target.value)})}>{[2,5,10].map(seconds=><option key={seconds} value={seconds}>{seconds}</option>)}</select></label>:null}
      {!isLayer?<label className={styles.field}>Läge<select value={composer.mode} onChange={event=>onChange({...composer,mode:event.target.value,referenceMediaId:event.target.value==='reference'?(composer.referenceMediaId||references[0]?.id||''):''})}>
        {isSpeech?<><option value="avatar">Avatar · läppsynk (gwm1)</option><option value="keyframe">WAN 3 · keyframes + ljud</option></>:<><option value="keyframe">Keyframes (VILA/REDO)</option>{references.length?<option value="reference">Referensklipp (variant)</option>:null}</>}</select></label>:null}
      {composer.mode==='reference'?<label className={styles.field}>Referensklipp<select value={composer.referenceMediaId} onChange={event=>onChange({...composer,referenceMediaId:event.target.value})}>{references.map(row=><option key={row.id} value={row.id}>{row.label} · {row.role}</option>)}</select></label>:null}
      {!isLayer&&!isSpeech?<label className={styles.field}>Uttryck<select value={composer.expression} onChange={event=>onChange({...composer,expression:event.target.value})}><option value="neutral">Neutralt</option><option value="smile">Lätt leende</option></select></label>:null}
      <label className={styles.field}>Max krediter<input type="number" min={1} max={2000} value={composer.maxCredits} onChange={event=>onEdit({...composer,maxCredits:Number(event.target.value)})} /></label>
    </div>
    <label className={styles.field}>Prompt (redigerbar)<textarea value={composer.prompt} onChange={event=>onEdit({...composer,prompt:event.target.value})} /></label>
    <div className={styles.estimate}>
      {plan?<><strong>~{plan.credits} krediter</strong><span>{plan.model} · {plan.mode}{plan.ratio?` · ${plan.ratio}`:''}{plan.duration?` · ${plan.duration} s`:''}</span><span className={styles.muted}>≈ {(plan.credits*0.01).toFixed(2)} USD före skatt · {state.priceChecked}</span></>:<span className={styles.muted}>{composer.loading?'Beräknar…':'Ingen uppskattning'}</span>}
      {missing.length?<span className={styles.bad}>Saknar ankare: {missing.join(', ').toUpperCase()}</span>:null}
    </div>
    <div className={styles.actions}>
      <button type="button" className="sg-btn sg-btn-primary" disabled={busy||composer.loading||!plan||missing.length>0||(plan&&plan.credits>composer.maxCredits)} onClick={onSubmit}>Starta generering{plan?` (${plan.credits} kr)`:''}</button>
      <button type="button" className="sg-btn" onClick={onClose}>Stäng</button>
    </div>
  </div>;
}
