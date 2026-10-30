import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Plus, RefreshCw, Upload } from 'lucide-react';
import { addDealer } from '../../../../../../packages/presentation/contracts/studio-model.mjs';
import type { DealerArchiveImpact } from '../../../../lib/dealer-archive-impact.mjs';
import { createStudioClient, type Workspace } from '../../lib/connected-studio.mjs';
import { createLifecycleClient, lifecycleMessage, type DeletionPlan } from '../../lib/studio-lifecycle.mjs';
import { dealerArchivePlan, dealerDeletePlan, dealerRestorePlan } from '../../lib/lifecycle-actions.mjs';
import { dealerCoverage, dealerStill, dealerTemplates, dealerUses } from '../../lib/dealer-coverage.mjs';
import { dealerIdFromName } from '../../lib/dealer-directory.mjs';
import Link, { navigate, useSearchParams } from '../../../runtime/navigation';
import { ConfirmAcknowledgement, ConfirmDialog, Dialog, DialogSteps } from '../ui/dialog';
import { DealerAvatar } from './dealer-identity-portrait';
import { HubPage, Card, Chip, ActionMenu, Empty } from '../ui/hub';
import { Button, cn, focusRing, plural } from '../ui/kit';
import { toast } from '../ui/toast';

const client = createStudioClient(), lifecycle = createLifecycleClient();
const dealerHref=(id:string,flik='klipp',extra:Record<string,string>={})=>'/admin/dealers/'+encodeURIComponent(id)+'?'+new URLSearchParams({flik,...extra});
// One confirmation per action. The server check runs inside the open dialog and
// is bound to one dialog request as well as its project revision and target.
type Review = { request:number; id:string; name:string; revision:string; kind:'archive'|'restore'|'delete'; checking:boolean; impact?:DealerArchiveImpact; eligibility?:DeletionPlan; acknowledged:boolean; error:string };

export function DealerDirectory({active,blocked=false,refreshKey=0,onChanged}:{active:boolean;blocked?:boolean;refreshKey?:number;onChanged:()=>void}) {
  const [workspace,setWorkspace] = useState<Workspace|null>(null);
  const [loading,setLoading] = useState(true), [busy,setBusy] = useState(false);
  const [error,setError] = useState(''), [notice,setNotice] = useState('');
  const [name,setName] = useState(''), [created,setCreated] = useState<{id:string;name:string}|null>(null);
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
    // The id is made from the name (dealerIdFromName) by the same rule addDealer validates.
    const targetName=name.trim();
    let next, targetId='';
    try {targetId=dealerIdFromName(workspace.project,targetName);next=addDealer(workspace.project,targetId,targetName);}
    catch {setError('Dealern kunde inte skapas med det namnet. Prova ett annat namn.');return;}
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
    // The dialog turns into its last step and offers the next one in the dealer flow: Lägg till klipp.
    if(confirmed){setName('');setCreated({id:targetId,name:targetName});onChanged();}
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
  const closeCreate=()=>{if(busy)return;setCreating(false);setCreated(null);setName('');setError('');if(active&&!disabled)createButton.current?.focus();};
  const openNext=(href:string)=>{const done=created;setCreating(false);setCreated(null);if(done)toast(`${done.name} är sparad.`);navigate(href);};
  const warn='mb-4 rounded-lg bg-sg-warn-bg px-3.5 py-2.5 text-[13px] text-sg-warn';
  return <HubPage title="Dealers" intro="Dealern bär allt innehåll: klipp, tal och landningar. En dealer vars klipp och tal räcker för spel kan tilldelas bolag."
    actions={<><Button ref={createButton} variant="primary" data-action="create" disabled={disabled} onClick={()=>{setCreated(null);setError('');setCreating(true);}}><Plus aria-hidden="true"/>Ny dealer</Button><Button size="icon" aria-label="Uppdatera dealers" title="Uppdatera" disabled={busy||loading} onClick={()=>setRefresh(value=>value+1)}><RefreshCw aria-hidden="true"/></Button></>}>
    {blocked&&<p role="note" className={warn}>Spara det öppna utkastet i klippkartan eller avsluta den pågående importen innan du ändrar dealers.</p>}
    {error&&!creating&&<p role="alert" className={warn}>{error}</p>}
    {notice&&<p role="status" className="mb-4 rounded-lg bg-sg-accent-bg px-3.5 py-2.5 text-[13px] text-sg-text">{notice}</p>}
    {loading&&!workspace&&<ul aria-label="Läser dealers…" className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4 p-0">{[0,1,2].map(index=><li key={index} className="h-[188px] animate-pulse rounded-xl border border-sg-border bg-sg-surface-2"/>)}</ul>}
    {!loading&&workspace&&!dealers.length&&<Empty chip={null} title="Inga dealers ännu" text="Välj Ny dealer för att skapa den första."/>}
    <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4 p-0" aria-label="Registrerade dealers">{dealers.map(dealer=>{
      const coverage=dealerCoverage(workspace!.project,workspace!.inventory,dealer.id),uses=dealerUses(workspace!.catalog,dealer.id),templates=dealerTemplates(workspace!.project,dealer.id);
      const parts=[['Giv',coverage.deal],['Tal',coverage.speech],['Vila',coverage.idle]] as const;
      return <li key={dealer.id} className="relative grid gap-4 rounded-xl border border-sg-border bg-sg-surface p-5 shadow-sg transition-shadow hover:shadow-md">
        <div className="flex items-center gap-3.5">
          <DealerAvatar dealer={dealer} still={dealerStill(workspace!.project,workspace!.inventory,dealer.id)} size={56}/>
          <div className="min-w-0 flex-1"><Link href={dealerHref(dealer.id)} className="block truncate text-base font-semibold text-sg-text no-underline after:absolute after:inset-0 after:rounded-xl hover:underline">{dealer.label}</Link>
            <div className="text-[12.5px] text-sg-muted">{templates.length?`Tillåten i ${plural(templates.length,'miljö','miljöer')}`:'Ingen miljö ännu'}</div></div>
          <span className="relative z-10"><ActionMenu small name={dealer.label} actions={[
            {id:'open',label:'Öppna dealern',onSelect:()=>navigate(dealerHref(dealer.id))},
            {id:'intake',label:'Lägg till klipp',onSelect:()=>navigate(dealerHref(dealer.id,'klipp',{panel:'intake'}))},
            {id:'archive',label:'Arkivera',tone:'danger',disabled:disabled?'Vänta tills registret är läst':undefined,onSelect:()=>void openReview(dealer.id,dealer.label,'archive')},
          ]}/></span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip tone={coverage.complete?'ok':'warn'} dot>{coverage.complete?'Redo för spel':'Klipp saknas'}</Chip>
          <Chip tone={coverage.speechProfile?'ok':''}>{coverage.speechProfile?'Röstprofil finns':'Ingen röstprofil'}</Chip>
        </div>
        <div className="grid grid-cols-3 gap-3">{parts.map(([label,part])=>{const share=part.total?part.bound/part.total:0;return <div key={label} className="grid gap-1.5">
          <div className="flex items-baseline justify-between text-xs text-sg-muted"><span>{label}</span><b className="font-semibold tabular-nums text-sg-text">{part.bound}/{part.total}</b></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-sg-hover"><div className={share>=1?'h-full rounded-full bg-sg-ok':'h-full rounded-full bg-sg-warn'} style={{width:`${Math.round(share*100)}%`}}/></div></div>;})}</div>
        <div className="border-t border-sg-line-2 pt-3 text-[12.5px] text-sg-muted">{uses.operators.length?`Används av ${uses.operators.map(row=>row.name).join(', ')} · ${plural(uses.rooms.length,'spelbord','spelbord')}`:'Inte tilldelad något bolag'}</div>
      </li>;
    })}</ul>
    {workspace&&<Card title={<span className="inline-flex items-center gap-2">Papperskorg<span className="rounded-full bg-sg-hover px-1.5 text-[11px] font-semibold tabular-nums text-sg-muted">{trash.length}</span></span>} className="mt-8" aside="Återställ, eller radera permanent efter serverns kontroll">
      {!trash.length?<p className="m-0 text-[12.5px] text-sg-muted">Papperskorgen är tom.</p>:<ul className="m-0 grid list-none p-0">{trash.map(row=><li className="flex flex-wrap items-center gap-3 border-t border-sg-line-2 py-3 first:border-t-0 first:pt-0" key={row.dealer.id}><div className="min-w-0 flex-1"><div className="font-semibold">{row.dealer.label}</div>{row.deletion&&<div className="text-[13px] text-sg-muted">radering påbörjad</div>}</div>
        <div className="flex flex-wrap gap-2"><Button size="sm" data-action="restore" disabled={disabled||Boolean(row.deletion)} aria-haspopup="dialog" onClick={()=>void openReview(row.dealer.id,row.dealer.label,'restore')}>Återställ</Button>
        <Button size="sm" variant="danger" data-action="delete" disabled={disabled} aria-haspopup="dialog" onClick={()=>void openReview(row.dealer.id,row.dealer.label,'delete')}>{row.deletion?'Slutför radering':'Radera permanent'}</Button></div>
      </li>)}</ul>}
    </Card>}
    <Dialog open={creating} title={created?`${created.name} är sparad`:'Ny dealer'} onClose={closeCreate} busy={busy}
      description={created?'Nästa steg är dealerns klipp. Tal och landningar lägger du till på dealerns sida.':'Ge dealern ett namn. Klipp, tal och landningar lägger du till efteråt.'}
      footer={created?<><Button onClick={closeCreate}>Stäng</Button><Button variant="primary" data-action="intake" onClick={()=>openNext(dealerHref(created.id,'klipp',{panel:'intake'}))}><Upload aria-hidden="true"/>Lägg till klipp</Button></>
        :<><Button data-action="cancel" disabled={busy} onClick={closeCreate}>Avbryt</Button><Button variant="primary" type="submit" form="dealer-create" disabled={disabled||!name.trim()}>{busy?'Sparar…':'Skapa dealer'}{!busy&&<ArrowRight aria-hidden="true"/>}</Button></>}>
      <DialogSteps steps={['Namn','Klipp','Tal och landningar']} current={created?1:0}/>
      {!created?<form id="dealer-create" className="grid gap-4" onSubmit={event=>void create(event)}>
        <div className="flex items-center gap-4">
          <DealerAvatar dealer={{id:'new',label:name.trim()||'?'}} size={64}/>
          <label className="grid min-w-0 flex-1 gap-1.5 text-[13px] font-semibold text-sg-text">Namn<input autoFocus required maxLength={120} value={name} disabled={disabled} placeholder="Till exempel Nora" onChange={event=>setName(event.target.value)}
            className={cn('h-10 rounded-lg border border-sg-border bg-sg-surface px-3 text-[14px] font-normal text-sg-text placeholder:text-sg-faint',focusRing)}/></label>
        </div>
        {error&&<p role="alert" className="m-0 rounded-lg bg-sg-warn-bg px-3 py-2 text-[13px] text-sg-warn">{error}</p>}
      </form>:<div className="flex items-center gap-4 rounded-xl border border-sg-border bg-sg-surface-2 p-4">
        <DealerAvatar dealer={{id:created.id,label:created.name}} size={56}/>
        <div className="min-w-0 text-[13.5px] text-sg-muted"><div className="font-semibold text-sg-text">{created.name}</div>Ingen miljö och inget bolag ännu. Dealern kan tilldelas när klipp och tal räcker för spel.</div>
      </div>}
    </Dialog>
    <ConfirmDialog open={review!==null} title={plan?.title??'Granska åtgärden'} description={plan?.summary} consequences={plan?.items??[]}
      checking={review?.checking??false} checkingLabel={review?.kind==='delete'?'Kontrollerar lagring och beroenden…':'Kontrollerar klipp, spelbord, bolag och miljöer…'}
      error={reviewError} busy={busy&&review!==null&&!review.checking} busyLabel={plan?.busyLabel}
      confirmLabel={confirmLabel} confirmDisabled={disabled&&!busy||Boolean(deletePlan?.requiresAcknowledgement&&!review?.acknowledged)}
      cancelLabel={stale||review?.error?'Stäng':plan?.cancelLabel} onConfirm={()=>void applyReview()} onCancel={()=>{if(!busy||review?.checking)setReview(null);}}>
      {deletePlan?.requiresAcknowledgement&&review&&!reviewError&&<ConfirmAcknowledgement checked={review.acknowledged} label={deletePlan.acknowledgement} disabled={busy} onChange={checked=>setReview(value=>value?{...value,acknowledged:checked}:value)}/>}
    </ConfirmDialog>
  </HubPage>;
}
