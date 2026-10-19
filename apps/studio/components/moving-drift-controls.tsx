'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import type {MovingDriftAdminStatus,MovingDriftMode} from '../../../packages/presentation/contracts/moving-drift-admin.mjs';
import type {StudioAdminActor} from './studio-administration';
import {readMovingDriftStatus,driftDraft,driftView,driftCommand,driftModeLabel,type DriftDraft} from '../client/admin/lib/moving-drift-ui.mjs';
import styles from './moving-drift-controls.module.css';

export interface MovingDriftTransport {
  available(method:string,action:string):boolean;
  request(method:'GET'|'POST',action:string,body?:Record<string,unknown>,signal?:AbortSignal,expectedActor?:StudioAdminActor):Promise<{actor:StudioAdminActor;payload:Record<string,unknown>}>;
}
const modeChoices:[MovingDriftMode,string,string][]=[['off','Av','Inga nya taljobb'],['saving','Sparläge','Förbered vid talbehov'],['warm','Varm','Redo under en vald tid']];
const time=(value:number)=>new Intl.DateTimeFormat('sv-SE',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(value));
const failureMessages:Record<number,string>={401:'Sessionen har gått ut. Läs om sidan och logga in igen.',403:'Behörigheten eller sessionen har ändrats. Läs om sidan.',409:'Driftläget har ändrats eller valet är inte tillgängligt. Läs om status.',422:'Valet kunde inte sparas. Kontrollera läge och GPU-profil.'};
const failureMessage=(error:unknown)=>failureMessages[(error as {status?:number})?.status??0]??'Åtgärden kunde inte bekräftas. Läs om status innan du försöker igen.';

export function MovingDriftControls({client,expectedActor}:{client:MovingDriftTransport;expectedActor:StudioAdminActor}) {
  const [status,setStatus]=useState<MovingDriftAdminStatus|null>(null),[draft,setDraft]=useState<DriftDraft|null>(null);
  const [clock,setClock]=useState(0),[sourceAt,setSourceAt]=useState(0),[reading,setReading]=useState(false),[busy,setBusy]=useState(false);
  const [error,setError]=useState(''),[notice,setNotice]=useState('');
  const alive=useRef(false),sequence=useRef(0),writing=useRef(false),active=useRef<AbortController|null>(null);
  const current=useRef<MovingDriftAdminStatus|null>(null),local=useRef<DriftDraft|null>(null),actor=useRef<StudioAdminActor|null>(null),readAt=useRef(0),authFailed=useRef(false);
  const canRead=client.available('GET','moving-drift'),canWrite=client.available('POST','moving-drift');
  function replaceDraft(next:DriftDraft|null) {local.current=next;setDraft(next);}
  function accept(value:unknown,requestedAt:number,reset=false) {
    const next=readMovingDriftStatus(value);
    if(current.current&&next.revision<current.current.revision)throw Object.assign(new Error('stale_response'),{status:503});
    // Include the whole request and JSON parsing time in snapshot age.
    const now=performance.now();current.current=next;readAt.current=requestedAt;setStatus(next);setSourceAt(requestedAt);setClock(now);
    if(reset||!local.current?.dirty)replaceDraft(driftDraft(next));
  }
  function clearStatus(cause:unknown) {
    current.current=null;setStatus(null);
    if([401,403].includes((cause as {status?:number})?.status??0)){authFailed.current=true;actor.current=null;replaceDraft(null);}
    setNotice('');setError(failureMessage(cause));
  }
  async function refresh() {
    if(!alive.current||writing.current||!canRead||authFailed.current)return;
    const ticket=++sequence.current;active.current?.abort();const controller=new AbortController();active.current=controller;const requestedAt=performance.now();setReading(true);
    try {
      const result=await client.request('GET','moving-drift',undefined,controller.signal,actor.current??undefined);
      if(!alive.current||ticket!==sequence.current||controller.signal.aborted)return;
      accept(result.payload,requestedAt);actor.current=result.actor;setError('');
    }catch(cause){if(alive.current&&ticket===sequence.current&&!controller.signal.aborted)clearStatus(cause);}
    finally{if(alive.current&&ticket===sequence.current)setReading(false);}
  }
  useEffect(()=>{
    alive.current=true;writing.current=false;authFailed.current=false;current.current=null;actor.current=expectedActor;local.current=null;setBusy(false);setReading(false);setStatus(null);setDraft(null);setError('');setNotice('');
    if(!canRead)return()=>{alive.current=false;++sequence.current;active.current?.abort();};
    void refresh();
    const tick=window.setInterval(()=>{if(current.current)setClock(performance.now());},1000);
    const poll=window.setInterval(()=>{if(document.visibilityState!=='hidden'&&!authFailed.current)void refresh();},10000);
    const visible=()=>{if(document.visibilityState!=='hidden')void refresh();};
    const leave=(event:BeforeUnloadEvent)=>{if(local.current?.dirty||writing.current){event.preventDefault();event.returnValue='';}};
    document.addEventListener('visibilitychange',visible);window.addEventListener('beforeunload',leave);
    return()=>{alive.current=false;++sequence.current;active.current?.abort();window.clearInterval(tick);window.clearInterval(poll);document.removeEventListener('visibilitychange',visible);window.removeEventListener('beforeunload',leave);};
    // Each transport/session owns its own response sequence and unsaved revision.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[client,canRead,expectedActor.username,expectedActor.role]);
  function change(patch:Partial<Pick<DriftDraft,'mode'|'profileId'|'durationSeconds'>>) {
    if(!local.current||writing.current)return;replaceDraft({...local.current,...patch,dirty:true});setNotice('');setError('');
  }
  async function apply(stop=false) {
    const source=current.current,editing=local.current,expectedActor=actor.current;
    if(writing.current||!source||!editing||!expectedActor||!canWrite||(!stop&&!editing.dirty))return;
    if(!driftView(source,performance.now()-readAt.current).recent){setError('Status är för gammal. Uppdatera den före ändringen.');return;}
    let command;
    try{command=driftCommand(source,stop?{...driftDraft(source),mode:'off',dirty:true}:editing,crypto.randomUUID());}
    catch(cause){setError(failureMessage(cause));return;}
    writing.current=true;setBusy(true);setReading(false);setError('');setNotice('');
    const ticket=++sequence.current;active.current?.abort();const controller=new AbortController();active.current=controller;const requestedAt=performance.now();
    try{
      const result=await client.request('POST','moving-drift',{...command},controller.signal,expectedActor);
      if(!alive.current||ticket!==sequence.current||controller.signal.aborted)return;
      if(result.actor.username!==expectedActor.username||result.actor.role!==expectedActor.role)throw Object.assign(new Error('actor_changed'),{status:403});
      accept(result.payload,requestedAt,true);setNotice('Önskat läge sparat. Faktisk drift visas ovan.');
    }catch(cause){if(alive.current&&ticket===sequence.current&&!controller.signal.aborted)clearStatus(cause);}
    finally{if(ticket===sequence.current){writing.current=false;if(alive.current)setBusy(false);}}
  }
  function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();void apply();}
  const view=status?driftView(status,Math.max(0,clock-sourceAt)):null;
  const conflict=Boolean(status&&draft?.dirty&&draft.revision!==status.revision);
  const modeAllowed=Boolean(status&&draft&&status.capabilities.allowedModes.includes(draft.mode));
  const profileValid=Boolean(status&&draft&&(draft.mode==='off'||status.profiles.some(row=>row.id===draft.profileId)));
  const canApply=canWrite&&!busy&&Boolean(view?.recent&&draft?.dirty)&&modeAllowed&&profileValid&&!conflict;
  const stopVisible=Boolean(status&&status.desired.mode!=='off');
  return <section className={styles.card} aria-labelledby="moving-drift-title">
    <header className={styles.header}><div><p className={styles.eyebrow}>Taldrift</p><h2 id="moving-drift-title">Driftläge</h2></div>
      {canRead&&<button type="button" className="studio-button" disabled={busy||reading} onClick={()=>authFailed.current?window.location.reload():void refresh()}>{reading?'Läser…':'Uppdatera status'}</button>}
    </header>
    {!canRead?<p>Driftstyrningen är inte tillgänglig för den här sessionen.</p>:<>
      <div className={styles.status} role="status"><span className={view?.ready?styles.ready:styles.pending} aria-hidden="true"/><strong>Faktisk drift: {view?.label??'Okänd'}</strong>
        {status&&<span>Sparat önskemål: {driftModeLabel(status.desired.mode)}</span>}</div>
      {error&&<p className={styles.error} role="alert">{error}</p>}{notice&&<p className={styles.notice} role="status">{notice}</p>}
      {status&&draft&&<form onSubmit={submit}>
        <fieldset className={styles.modes} disabled={busy||!canWrite}><legend>Välj driftläge</legend>
          {modeChoices.map(([mode,label,description])=><label key={mode} className={styles.mode} data-selected={draft.mode===mode}>
            <input type="radio" name="moving-drift-mode" value={mode} checked={draft.mode===mode} disabled={!status.capabilities.allowedModes.includes(mode)} onChange={()=>change({mode})}/>
            <span><strong>{label}</strong><small>{description}</small></span>
          </label>)}
        </fieldset>
        {!status.capabilities.connected?<p className={styles.helper}>Driftstyrningen är inte ansluten. Endast önskat Av kan sparas.</p>
          :!status.capabilities.allowedModes.includes('warm')&&<p className={styles.helper}>Varm drift kräver automatisk avstängning och kostnadsunderlag.</p>}
        <div className={styles.fields}>
          <label>GPU-profil<select value={draft.profileId} disabled={busy||!canWrite||draft.mode==='off'} onChange={event=>change({profileId:event.target.value})}>
            <option value="">Välj GPU-profil…</option>{status.profiles.map(profile=><option key={profile.id} value={profile.id}>{profile.label}</option>)}
          </select></label>
          {draft.mode==='warm'&&<label>Tid för ny varmperiod<select value={draft.durationSeconds} disabled={busy||!canWrite||!modeAllowed} onChange={event=>change({durationSeconds:Number(event.target.value) as DriftDraft['durationSeconds']})}>
            <option value={1800}>30 minuter</option><option value={7200}>2 timmar</option><option value={86400}>24 timmar</option>
          </select></label>}
          <dl className={styles.facts}><div><dt>Faktisk GPU</dt><dd>{view?.fresh?status.actual.gpu??'Ej bekräftad':'Ej bekräftad'}</dd></div><div><dt>Timpris för nytt val</dt><dd>Okänt</dd></div></dl>
        </div>
        {status.desired.mode==='warm'&&status.desired.endsAtMs!==null&&<p>Sluttid: <time dateTime={new Date(status.desired.endsAtMs).toISOString()}>{time(status.desired.endsAtMs)}</time>{view?.expired?' · avstängning måste bekräftas':''}</p>}
        {conflict&&<p className={styles.error} role="alert">Det sparade valet har ändrats. Dina fält har behållit sin tidigare revision.</p>}
        <div className={styles.actions}>
          <button className="studio-button primary" type="submit" disabled={!canApply}>{busy?'Skickar…':draft.mode==='off'&&!status.capabilities.connected?'Spara önskat Av':'Använd läge'}</button>
          {stopVisible&&<button className="studio-button" type="button" disabled={busy||!canWrite||!view?.recent} onClick={()=>void apply(true)}>{status.capabilities.connected?'Stoppa drift':'Spara önskat Av'}</button>}
          {draft.dirty&&<button className="studio-button" type="button" disabled={busy} onClick={()=>{replaceDraft(driftDraft(status));setError('');setNotice('');}}>Läs in sparat val</button>}
        </div>
        <p className={styles.helper}>Läget gäller miljöns taldrift. Ett sparat önskemål är inte en driftbekräftelse.</p>
        <details className={styles.details}><summary>Detaljer</summary><dl className={styles.facts}>
          <div><dt>Revision</dt><dd>{status.revision}</dd></div><div><dt>Senast observerad</dt><dd>{status.observed.atMs===null?'Saknas':time(status.observed.atMs)}</dd></div>
          <div><dt>Offert för sparad varmperiod</dt><dd>{view?.costLabel??'Okänd'}</dd></div>
          <div><dt>Observerad profil</dt><dd>{status.profiles.find(row=>row.id===status.actual.profileId)?.label??'Ej bekräftad'}</dd></div>
          <div><dt>Statuskod</dt><dd><code>{status.observed.reasonCode??status.capabilities.reasonCode??'Ingen'}</code></dd></div>
        </dl></details>
      </form>}
    </>}
  </section>;
}