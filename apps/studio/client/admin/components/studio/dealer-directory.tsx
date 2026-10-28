import { useEffect, useRef, useState, type FormEvent } from 'react';
import { addDealer } from '../../../../../../packages/presentation/contracts/studio-model.mjs';
import type { DealerArchiveImpact } from '../../../../lib/dealer-archive-impact.mjs';
import { createStudioClient, type Workspace } from '../../lib/connected-studio.mjs';
import { createLifecycleClient, lifecycleMessage, type DeletionPlan } from '../../lib/studio-lifecycle.mjs';
import { dealerArchivePlan, dealerDeletePlan, dealerRestorePlan } from '../../lib/lifecycle-actions.mjs';
import { dealerCoverage, dealerTemplates, dealerUses } from '../../lib/dealer-coverage.mjs';
import Link, { navigate, useSearchParams } from '../../../runtime/navigation';
import { ConfirmAcknowledgement, ConfirmDialog } from './confirm-dialog';
import { DealerIdentityPortrait } from './dealer-identity-portrait';
import { HubPage, Card, Chip, ActionMenu, Empty } from '../ui/hub';

const client = createStudioClient(), lifecycle = createLifecycleClient();
const dealerSlug = (name:string) => name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40).replace(/-$/,'');
const dealerHref=(id:string,flik='klipp',extra:Record<string,string>={})=>'/admin/dealers/'+encodeURIComponent(id)+'?'+new URLSearchParams({flik,...extra});
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
  const query = useSearchParams();
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
    // The new dealer opens on Lägg till klipp: the next step in the dealer flow.
    if(confirmed){setName('');setId('');setIdEdited(false);setCreating(false);setNotice(`${targetName} är sparad.`);onChanged();navigate(dealerHref(targetId,'klipp',{panel:'intake'}));}
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
    if(confirmed){setError('');setNotice(target.kind==='archive'?`${target.name} har flyttats till papperskorgen.`:target.kind==='restore'?`${target.name} är återställd som utkast. Spelbord öppnas inte automatiskt.`:`${target.name} och dealerns egna filer är permanent raderade.`);}
  }
  const dealers=workspace?.project.dealers??[], trash=workspace?.project.dealerTrash??[];
  const trashEntry=review?trash.find(row=>row.dealer.id===review.id):undefined;
  const mediaCount=review?(workspace?.inventory.videos.filter(video=>(video.classification?.dealerId??(video as {dealer?:string}).dealer)===review.id&&(video as {deletion?:{state?:string}}).deletion?.state!=='deleted').length??0):0;
  const deletePlan=review?.kind==='delete'?dealerDeletePlan({label:review.name,mediaCount,eligibility:review.eligibility,pending:Boolean(trashEntry?.deletion)}):null;
  const plan=review?review.kind==='archive'?dealerArchivePlan({label:review.name,impact:review.impact}):review.kind==='restore'?dealerRestorePlan({label:review.name,compositions:trashEntry?.compositions??[]}):deletePlan!:null;
  const stale=Boolean(review&&workspace&&review.revision!==workspace.project.revision);
  const reviewError=stale?'Registret har ändrats sedan dialogen öppnades. Stäng och försök igen.':review?.error||plan?.error||'';
  const confirmLabel=review&&!review.checking&&!reviewError?plan?.confirmLabel:undefined;
  return <HubPage wide title="Dealers" intro="Dealern är arbetsobjektet för allt innehåll: klipp, tal, landningar och godkännande. En dealer med klipp och tal som räcker för spel kan tilldelas bolag under Bolag › Tilldelning."
    actions={<><button ref={createButton} type="button" className="hub-btn primary" disabled={disabled} onClick={()=>setCreating(true)}>Ny dealer</button><button type="button" className="hub-btn" aria-label="Uppdatera dealers" disabled={busy||loading} onClick={()=>setRefresh(value=>value+1)}>Uppdatera</button></>}>
    {blocked&&<p role="note" className="hub-note warn">Spara det öppna utkastet i klippkartan eller avsluta den pågående importen innan du ändrar dealers.</p>}
    {loading&&<p role="status" className="hub-muted">Läser dealers…</p>}
    {error&&<p role="alert" className="hub-note warn">{error}</p>}
    {notice&&<p role="status" className="hub-note accent">{notice}</p>}
    {creating&&<Card title="Ny dealer" aside={<button type="button" className="hub-btn ghost small" disabled={busy} onClick={()=>{setCreating(false);if(active&&!disabled)createButton.current?.focus();}}>Avbryt</button>} className="hub-mt">
      <form className="dealer-import-panel" style={{border:0,padding:0,background:'transparent'}} onSubmit={event=>void create(event)}>
        <div className="hub-grid c2"><label>Namn<input autoFocus required maxLength={120} value={name} disabled={disabled} onChange={event=>{setName(event.target.value);if(!idEdited)setId(dealerSlug(event.target.value));}}/></label>
        <label>Id<input required maxLength={40} pattern="[a-z][a-z0-9]*(-[a-z0-9]+)*" value={id} disabled={disabled} onChange={event=>{setIdEdited(true);setId(event.target.value);}}/><span className="hub-small hub-muted">små bokstäver; används i Blob-sökvägen dealers/&lt;id&gt;/</span></label></div>
        <p className="hub-small hub-muted hub-mt">Det här är hela steget: dealers[] får id och namn. Klipp, tal och landningar läggs till på dealerns sida.</p>
        <div className="hub-actions hub-mt"><button className="hub-btn primary" disabled={disabled||!name.trim()||!id} type="submit">{busy?'Sparar…':'Skapa och gå till Lägg till klipp'}</button></div>
      </form>
    </Card>}
    {!loading&&workspace&&!dealers.length&&<Empty chip={null} title="Inga dealers ännu" text="Välj Ny dealer för att skapa den första."/>}
    <ul className="hub-grid c3 hub-mt-l" style={{listStyle:'none',padding:0,margin:0}} aria-label="Registrerade dealers">{dealers.map(dealer=>{
      const coverage=dealerCoverage(workspace!.project,workspace!.inventory,dealer.id),uses=dealerUses(workspace!.catalog,dealer.id),templates=dealerTemplates(workspace!.project,dealer.id);
      return <li key={dealer.id} className="hub-card" style={{display:'grid',gap:12}}>
        <div style={{display:'flex',gap:12,alignItems:'center'}}>
          <span className="hub-portrait big"><DealerIdentityPortrait dealer={dealer} className="h-14 w-14"/></span>
          <div style={{minWidth:0}}><Link href={dealerHref(dealer.id)} className="hub-strong" style={{fontSize:16}}>{dealer.label}</Link><div className="hub-small hub-muted"><code>{dealer.id}</code> · {templates.length} scenmallar</div></div>
          <span style={{marginLeft:'auto'}}><ActionMenu small name={dealer.label} actions={[
            {id:'open',label:'Öppna dealern',onSelect:()=>navigate(dealerHref(dealer.id))},
            {id:'intake',label:'Lägg till klipp',onSelect:()=>navigate(dealerHref(dealer.id,'klipp',{panel:'intake'}))},
            {id:'archive',label:'Arkivera',disabled:disabled?'Vänta tills registret är läst':undefined,onSelect:()=>void openReview(dealer.id,dealer.label,'archive')},
          ]}/></span>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <Chip tone={coverage.complete?'ok':'warn'} dot>{coverage.complete?'Klipp och tal räcker för spel':'Inte godkänd'}</Chip>
          <Chip tone={coverage.speechProfile?'ok':''}>{coverage.speechProfile?'röstprofil finns':'ingen röstprofil'}</Chip>
        </div>
        <div className="hub-coverage"><span>Giv <b>{coverage.deal.bound}/{coverage.deal.total}</b></span><span>Tal <b>{coverage.speech.bound}/{coverage.speech.total}</b></span><span>Vila <b>{coverage.idle.bound}/{coverage.idle.total}</b></span></div>
        <div className="hub-small hub-muted">{uses.operators.length?`Används av ${uses.operators.map(row=>row.name).join(', ')} · ${uses.rooms.length} spelbord`:'Inte tilldelad något bolag'}</div>
      </li>;
    })}</ul>
    {workspace&&<Card title={`Papperskorg (${trash.length})`} className="hub-mt-l" aside="återställ eller radera permanent efter serverns kontroll">
      {!trash.length?<p className="hub-muted hub-small">Papperskorgen är tom.</p>:<ul className="hub-rows" style={{listStyle:'none',padding:0,margin:0}}>{trash.map(row=><li className="hub-row" key={row.dealer.id}><div/><div className="hub-row-copy"><div className="hub-row-title">{row.dealer.label}</div>{row.deletion&&<div className="hub-row-text">radering påbörjad</div>}</div>
        <div className="hub-actions"><button type="button" className="hub-btn small" disabled={disabled||Boolean(row.deletion)} aria-haspopup="dialog" onClick={()=>void openReview(row.dealer.id,row.dealer.label,'restore')}>Återställ</button>
        <button type="button" className="hub-btn small danger" disabled={disabled} aria-haspopup="dialog" onClick={()=>void openReview(row.dealer.id,row.dealer.label,'delete')}>{row.deletion?'Slutför radering':'Radera permanent'}</button></div>
      </li>)}</ul>}
    </Card>}
    <ConfirmDialog open={review!==null} title={plan?.title??'Granska åtgärden'} description={plan?.summary} consequences={plan?.items??[]}
      checking={review?.checking??false} checkingLabel={review?.kind==='delete'?'Kontrollerar lagring och beroenden…':'Kontrollerar klipp, spelbord, bolag och scenmallar…'}
      error={reviewError} busy={busy&&review!==null&&!review.checking} busyLabel={plan?.busyLabel}
      confirmLabel={confirmLabel} confirmDisabled={disabled&&!busy||Boolean(deletePlan?.requiresAcknowledgement&&!review?.acknowledged)}
      cancelLabel={stale||review?.error?'Stäng':plan?.cancelLabel} onConfirm={()=>void applyReview()} onCancel={()=>{if(!busy||review?.checking)setReview(null);}}>
      {deletePlan?.requiresAcknowledgement&&review&&!reviewError&&<ConfirmAcknowledgement checked={review.acknowledged} label={deletePlan.acknowledgement} disabled={busy} onChange={checked=>setReview(value=>value?{...value,acknowledged:checked}:value)}/>}
    </ConfirmDialog>
  </HubPage>;
}
