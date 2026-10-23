import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Plus, RefreshCw, RotateCcw, Trash2, Upload, Users } from 'lucide-react';
import { addDealer } from '../../../../../../packages/presentation/contracts/studio-model.mjs';
import type { DealerArchiveImpact } from '../../../../lib/dealer-archive-impact.mjs';
import { createStudioClient, type Workspace } from '../../lib/connected-studio.mjs';
import { createLifecycleClient, lifecycleMessage, type DeletionPlan } from '../../lib/studio-lifecycle.mjs';
import { dealerArchivePlan, dealerDeletePlan, dealerRestorePlan } from '../../lib/lifecycle-actions.mjs';
import { navigate, useSearchParams } from '../../../runtime/navigation';
import { ConfirmAcknowledgement, ConfirmDialog } from './confirm-dialog';

const client = createStudioClient(), lifecycle = createLifecycleClient();
const dealerSlug = (name:string) => name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40).replace(/-$/,'');
// One confirmation per action. The server check runs inside the open dialog and
// is bound to one dialog request as well as its project revision and target.
type Review = { request:number; id:string; name:string; revision:string; kind:'archive'|'restore'|'delete'; checking:boolean; impact?:DealerArchiveImpact; eligibility?:DeletionPlan; acknowledged:boolean; error:string };

export function DealerDirectory({active,blocked=false,refreshKey=0,onChanged}:{active:boolean;blocked?:boolean;refreshKey?:number;onChanged:()=>void}) {
  const [workspace,setWorkspace] = useState<Workspace|null>(null);
  const [loading,setLoading] = useState(true), [busy,setBusy] = useState(false);
  const [error,setError] = useState(''), [notice,setNotice] = useState('');
  const [name,setName] = useState(''), [id,setId] = useState(''), [idEdited,setIdEdited] = useState(false);
  const [creating,setCreating] = useState(false), [review,setReview] = useState<Review|null>(null);
  const [refresh,setRefresh] = useState(0);
  const reviewSequence = useRef(0);
  const lock = useRef(false), current = useRef(workspace), createButton = useRef<HTMLButtonElement>(null);
  current.current = workspace;
  const query = useSearchParams(), selectedId = query.get('dealer') ?? '';
  const disabled = blocked || busy || loading || !workspace;
  const createRequested=query.get('view')==='create';
  useEffect(()=>{if(active&&createRequested)setCreating(true);},[active,createRequested]);
  useEffect(() => {
    if(!active)return;
    const abort = new AbortController(); setLoading(true); setReview(null); setError('');
    void client.load(abort.signal).then(value=>{if(!abort.signal.aborted)setWorkspace(value);})
      .catch(cause=>{if(!abort.signal.aborted){setWorkspace(null);setError(cause.message);}})
      .finally(()=>{if(!abort.signal.aborted)setLoading(false);});
    return ()=>abort.abort();
  },[active,refresh,refreshKey]);
  useEffect(()=>{
    const leave=(event:Event)=>{if(lock.current){event.preventDefault();if(event.type==='beforeunload')(event as BeforeUnloadEvent).returnValue='';}};
    window.addEventListener('scout:navigate',leave); window.addEventListener('beforeunload',leave);
    return ()=>{window.removeEventListener('scout:navigate',leave);window.removeEventListener('beforeunload',leave);};
  },[]);

  async function create(event:FormEvent) {
    event.preventDefault(); if(disabled || lock.current || !workspace)return;
    let next;
    try {next=addDealer(workspace.project,id.trim(),name.trim());}
    catch {setError('Ange ett namn och ett ledigt dealer-id. Id ska börja med en bokstav och bara innehålla små bokstäver, siffror och bindestreck. Kontrollera även papperskorgen.');return;}
    const targetId=id.trim(), targetName=name.trim();
    lock.current=true;setBusy(true);setError('');setNotice('');
    let confirmed=false;
    try {
      const saved=await client.save(next);
      confirmed=saved.dealers.some(row=>row.id===targetId&&row.label===targetName);
      if(!confirmed)throw Error('Den nya dealern kunde inte bekräftas.');
      setWorkspace({...workspace,project:saved});
    } catch(cause) {
      // A lost response can follow a successful write. Read; never repeat it.
      try {const fresh=await client.load();setWorkspace(fresh);confirmed=fresh.project.dealers.some(row=>row.id===targetId&&row.label===targetName);}
      catch {setWorkspace(null);}
      if(!confirmed)setError((cause as Error).message+' Läs om innan du försöker igen.');
    } finally {lock.current=false;setBusy(false);}
    if(confirmed){setName('');setId('');setIdEdited(false);setCreating(false);setNotice(`${targetName} är sparad. Välj Lägg till klipp för att börja.`);onChanged();navigate('/admin/dealers?dealer='+encodeURIComponent(targetId));}
  }
  function patchReview(request:number,patch:Partial<Review>) {
    setReview(value=>value&&value.request===request&&value.checking?{...value,checking:false,...patch}:value);
  }
  async function openReview(dealerId:string,label:string,kind:Review['kind']) {
    if(disabled || lock.current || !workspace)return;
    const revision=workspace.project.revision, request=++reviewSequence.current;
    setError('');setNotice('');
    setReview({request,id:dealerId,name:label,revision,kind,checking:kind!=='restore',acknowledged:false,error:''});
    if(kind==='restore')return;
    try {
      if(kind==='archive')patchReview(request,{impact:await lifecycle.checkDealerArchive(workspace.project,dealerId)});
      else patchReview(request,{eligibility:await lifecycle.checkDealerDeletion(workspace.project,dealerId)});
    } catch(cause){patchReview(request,{error:lifecycleMessage(cause)});}
  }
  async function applyReview() {
    if(disabled||lock.current||!workspace||!review||review.checking||review.error||review.revision!==workspace.project.revision)return;
    const target=review;
    if(target.kind==='archive'&&!target.impact)return;
    if(target.kind==='delete'&&(!target.eligibility?.allowed||deletePlan?.requiresAcknowledgement&&!target.acknowledged))return;
    lock.current=true;setBusy(true);setError('');setNotice('');
    let confirmed=false;
    const unchanged=()=>current.current?.project.revision===target.revision;
    try {
      if(target.kind==='delete')await lifecycle.deleteDealer(workspace.project,target.id,unchanged);
      else await lifecycle.dealerLifecycle(workspace.project,target.id,target.kind==='archive',target.impact,unchanged);
      confirmed=true;
    } catch(cause){setError(lifecycleMessage(cause));}
    // Reconcile success and uncertain responses through the same registered read.
    try {
      const fresh=await client.load();setWorkspace(fresh);
      const active=fresh.project.dealers.some(row=>row.id===target.id), trashed=Boolean(fresh.project.dealerTrash?.some(row=>row.dealer.id===target.id));
      confirmed=target.kind==='archive'?trashed&&!active:target.kind==='restore'?active&&!trashed:!active&&!trashed;
    } catch {setWorkspace(null);setError('Registret kunde inte läsas om. Åtgärden upprepas inte automatiskt; läs om för att se resultatet.');confirmed=false;}
    lock.current=false;setBusy(false);setReview(null);onChanged();
    if(confirmed){setError('');setNotice(target.kind==='archive'?`${target.name} har flyttats till papperskorgen.`:target.kind==='restore'?`${target.name} är återställd som utkast. Rum öppnas inte automatiskt.`:`${target.name} och dealerns egna filer är permanent raderade.`);}
  }
  const dealers=workspace?.project.dealers??[], trash=workspace?.project.dealerTrash??[];
  const trashEntry=review?trash.find(row=>row.dealer.id===review.id):undefined;
  const mediaCount=review?(workspace?.inventory.videos.filter(video=>(video.classification?.dealerId??(video as {dealer?:string}).dealer)===review.id&&(video as {deletion?:{state?:string}}).deletion?.state!=='deleted').length??0):0;
  const deletePlan=review?.kind==='delete'?dealerDeletePlan({label:review.name,mediaCount,eligibility:review.eligibility,pending:Boolean(trashEntry?.deletion)}):null;
  const plan=review?review.kind==='archive'?dealerArchivePlan({label:review.name,impact:review.impact}):review.kind==='restore'?dealerRestorePlan({label:review.name,compositions:trashEntry?.compositions??[]}):deletePlan!:null;
  const stale=Boolean(review&&workspace&&review.revision!==workspace.project.revision);
  const reviewError=stale?'Registret har ändrats sedan dialogen öppnades. Stäng och försök igen.':review?.error||plan?.error||'';
  const confirmLabel=review&&!review.checking&&!reviewError?plan?.confirmLabel:undefined;
  return <section className="dealer-import" aria-labelledby="dealer-directory-title">
    <header className="dealer-import-header"><div><p className="dealer-import-eyebrow">Studio</p><h1 id="dealer-directory-title">Dealers</h1><p>Skapa en dealer, lägg in filmklipp och se var personen används.</p></div>
      <div className="dealer-import-actions"><button ref={createButton} className="dealer-import-primary" disabled={disabled} onClick={()=>setCreating(true)}><Plus size={16}/>Skapa dealer</button><button aria-label="Uppdatera dealers" disabled={busy||loading} onClick={()=>setRefresh(value=>value+1)}><RefreshCw size={16}/></button></div>
    </header>
    {blocked&&<p role="note">Spara ditt öppna Studio-utkast eller avsluta den pågående importen innan du ändrar dealerregistret.</p>}
    {loading&&<p role="status">Läser dealers…</p>}
    {error&&<p role="alert" className="dealer-import-error">{error}</p>}
    {notice&&<p role="status" className="dealer-import-notice">{notice}</p>}
    {creating&&<form className="dealer-import-panel" onSubmit={event=>void create(event)}><h2>Skapa dealer</h2><label>Dealerns namn<input autoFocus required maxLength={120} value={name} disabled={disabled} onChange={event=>{setName(event.target.value);if(!idEdited)setId(dealerSlug(event.target.value));}}/></label>
      <details><summary>Detaljer</summary><label>Dealer-id<input required maxLength={40} pattern="[a-z][a-z0-9]*(-[a-z0-9]+)*" value={id} disabled={disabled} onChange={event=>{setIdEdited(true);setId(event.target.value);}}/></label></details>
      <div className="dealer-import-actions"><button className="dealer-import-primary" disabled={disabled||!name.trim()||!id} type="submit">{busy?'Sparar…':'Skapa och spara'}</button><button type="button" disabled={busy} onClick={()=>{setCreating(false);if(active&&!disabled)createButton.current?.focus();}}>Avbryt</button></div>
    </form>}
    {!loading&&workspace&&!dealers.length&&<p>Inga dealers ännu. Välj Skapa dealer.</p>}
    <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Registrerade dealers">{dealers.map(dealer=>{
      const rooms=workspace!.catalog.administration.rooms.filter(room=>room.state!=='archived'&&room.dealerIds.includes(dealer.id));
      const count=workspace!.inventory.videos.filter(video=>(video.classification?.dealerId??(video as {dealer?:string}).dealer)===dealer.id&&!video.classification?.archived).length;
      return <li key={dealer.id} className={'dealer-import-panel '+(selectedId===dealer.id?'border-sg-lime':'')}><h2><Users size={18}/>{dealer.label}</h2><p>{count} klipp · {rooms.length?`${rooms.length} kopplade rum`:'Inga rum kopplade ännu'}</p>
        {dealer.id==='astrid'&&<p><strong>Legacyreferens</strong> · Astrid är inkopplad via legacy och saknar trelagersversion. Befintliga OpenClaw- och talflöden kan användas som referens.</p>}
        <div className="dealer-import-actions"><a className="dealer-import-primary" href={'/admin/clips?dealer='+encodeURIComponent(dealer.id)}>Redigera dealer</a><a href={'/admin/clips?dealer='+encodeURIComponent(dealer.id)+'&panel=intake'}><Upload size={15}/>Lägg till klipp</a><button disabled={disabled} aria-haspopup="dialog" onClick={()=>void openReview(dealer.id,dealer.label,'archive')}><Trash2 size={15}/>Ta bort</button></div>
        {!!rooms.length&&<details><summary>Visa kopplingar</summary><ul>{rooms.map(room=><li key={room.id}><a href={'/admin/structure?operator='+encodeURIComponent(room.operatorId)+'&table='+encodeURIComponent(room.id)}>{workspace!.catalog.administration.operators.find(row=>row.id===room.operatorId)?.name} · {room.name}</a></li>)}</ul></details>}
      </li>;
    })}</ul>
    {workspace&&<details className="dealer-import-panel"><summary>Papperskorg ({trash.length})</summary>{!trash.length?<p>Papperskorgen är tom.</p>:<>
      <p>Återställ återför dealern som utkast. Radera permanent tar bort dealern och dess egna filer för alltid efter serverns kontroll.</p>
      <ul>{trash.map(row=><li className="dealer-import-actions" key={row.dealer.id}><span>{row.dealer.label}{row.deletion?' · radering påbörjad':''}</span>
        <button disabled={disabled||Boolean(row.deletion)} aria-haspopup="dialog" onClick={()=>void openReview(row.dealer.id,row.dealer.label,'restore')}><RotateCcw size={15}/>Återställ</button>
        <button disabled={disabled} aria-haspopup="dialog" onClick={()=>void openReview(row.dealer.id,row.dealer.label,'delete')}><Trash2 size={15}/>{row.deletion?'Slutför radering':'Radera permanent'}</button>
      </li>)}</ul></>}</details>}
    <ConfirmDialog open={review!==null} title={plan?.title??'Granska åtgärden'} description={plan?.summary} consequences={plan?.items??[]}
      checking={review?.checking??false} checkingLabel={review?.kind==='delete'?'Kontrollerar lagring och beroenden…':'Kontrollerar klipp, rum, bolag och sammansättningar…'}
      error={reviewError} busy={busy&&review!==null&&!review.checking} busyLabel={plan?.busyLabel}
      confirmLabel={confirmLabel} confirmDisabled={disabled&&!busy||Boolean(deletePlan?.requiresAcknowledgement&&!review?.acknowledged)}
      cancelLabel={stale||review?.error?'Stäng':plan?.cancelLabel} onConfirm={()=>void applyReview()} onCancel={()=>{if(!busy||review?.checking)setReview(null);}}>
      {deletePlan?.requiresAcknowledgement&&review&&!reviewError&&<ConfirmAcknowledgement checked={review.acknowledged} label={deletePlan.acknowledgement} disabled={busy} onChange={checked=>setReview(value=>value?{...value,acknowledged:checked}:value)}/>}
    </ConfirmDialog>
  </section>;
}
