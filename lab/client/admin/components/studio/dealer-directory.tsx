import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Plus, RefreshCw, Trash2, Upload, Users } from 'lucide-react';
import { addDealer } from '../../../../../packages/presentation/contracts/studio-model.mjs';
import type { DealerArchiveImpact } from '../../../../../lab/lib/dealer-archive-impact.mjs';
import { createStudioClient, type Workspace } from '../../lib/connected-studio.mjs';
import { createLifecycleClient, lifecycleMessage } from '../../lib/studio-lifecycle.mjs';
import { navigate, useSearchParams } from '../../../runtime/navigation';

const client = createStudioClient(), lifecycle = createLifecycleClient();
const dealerSlug = (name:string) => name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40).replace(/-$/,'');
type Review = { id:string; name:string; revision:string; archived:boolean; impact?:DealerArchiveImpact };

export function DealerDirectory({active,blocked=false,refreshKey=0,onChanged}:{active:boolean;blocked?:boolean;refreshKey?:number;onChanged:()=>void}) {
  const [workspace,setWorkspace] = useState<Workspace|null>(null);
  const [loading,setLoading] = useState(true), [busy,setBusy] = useState(false);
  const [error,setError] = useState(''), [notice,setNotice] = useState('');
  const [name,setName] = useState(''), [id,setId] = useState(''), [idEdited,setIdEdited] = useState(false);
  const [creating,setCreating] = useState(false), [review,setReview] = useState<Review|null>(null);
  const [refresh,setRefresh] = useState(0);
  const lock = useRef(false), current = useRef(workspace), createButton = useRef<HTMLButtonElement>(null);
  current.current = workspace;
  const query = useSearchParams(), selectedId = query.get('dealer') ?? '';
  const disabled = blocked || busy || loading || !workspace;
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
    if(confirmed){setName('');setId('');setIdEdited(false);setCreating(false);setNotice(`${targetName} är sparad. Välj Ladda upp klipp för att börja.`);onChanged();navigate('/admin/dealers?dealer='+encodeURIComponent(targetId));}
  }
  async function reviewRemoval(dealerId:string,label:string,archived:boolean) {
    if(disabled || lock.current || !workspace)return;
    lock.current=true;setBusy(true);setReview(null);setError('');setNotice('');
    const revision=workspace.project.revision;
    try {
      const impact=archived?await lifecycle.checkDealerArchive(workspace.project,dealerId):undefined;
      if(current.current?.project.revision===revision)setReview({id:dealerId,name:label,revision,archived,impact});
    } catch(cause){setError(lifecycleMessage(cause));}
    finally{lock.current=false;setBusy(false);}
  }
  async function applyRemoval() {
    if(disabled||lock.current||!workspace||!review||review.revision!==workspace.project.revision)return;
    const target=review;lock.current=true;setBusy(true);setError('');setReview(null);setNotice('');
    let confirmed=false;
    try {
      await lifecycle.dealerLifecycle(workspace.project,target.id,target.archived,target.impact,()=>current.current?.project.revision===target.revision);
      confirmed=true;
    } catch(cause){setError(lifecycleMessage(cause));}
    // Reconcile success and uncertain responses through the same registered read.
    try {
      const fresh=await client.load();setWorkspace(fresh);
      confirmed=target.archived?Boolean(fresh.project.dealerTrash?.some(row=>row.dealer.id===target.id))&&!fresh.project.dealers.some(row=>row.id===target.id)
        :fresh.project.dealers.some(row=>row.id===target.id)&&!fresh.project.dealerTrash?.some(row=>row.dealer.id===target.id);
    } catch {setWorkspace(null);setError('Registret kunde inte läsas om. Åtgärden upprepas inte automatiskt; läs om för att se resultatet.');confirmed=false;}
    lock.current=false;setBusy(false);onChanged();
    if(confirmed){setError('');setNotice(target.archived?`${target.name} har flyttats till papperskorgen.`:`${target.name} är återställd som utkast. Rum öppnas inte automatiskt.`);}
  }
  const dealers=workspace?.project.dealers??[], trash=workspace?.project.dealerTrash??[];
  const restoreCompositions=review&&!review.archived?trash.find(row=>row.dealer.id===review.id)?.compositions??[]:[];
  return <section className="dealer-import" aria-labelledby="dealer-directory-title">
    <header className="dealer-import-header"><div><p className="dealer-import-eyebrow">Nivå 1 · Bibliotek</p><h1 id="dealer-directory-title">Dealers</h1><p>Skapa en dealer, lägg in filmklipp och se var personen används.</p></div>
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
        <div className="dealer-import-actions"><a className="dealer-import-primary" href={'/admin/dealers?dealer='+encodeURIComponent(dealer.id)+'&tool=import'}><Upload size={15}/>Ladda upp klipp</a><button disabled={disabled} onClick={()=>void reviewRemoval(dealer.id,dealer.label,true)}><Trash2 size={15}/>Ta bort</button></div>
        {!!rooms.length&&<details><summary>Visa kopplingar</summary><ul>{rooms.map(room=><li key={room.id}><a href={'/admin/structure?operator='+encodeURIComponent(room.operatorId)+'&table='+encodeURIComponent(room.id)}>{workspace!.catalog.administration.operators.find(row=>row.id===room.operatorId)?.name} · {room.name}</a></li>)}</ul></details>}
      </li>;
    })}</ul>
    {workspace&&<details className="dealer-import-panel"><summary>Papperskorg ({trash.length})</summary>{!trash.length?<p>Papperskorgen är tom.</p>:<ul>{trash.map(row=><li className="dealer-import-actions" key={row.dealer.id}><span>{row.dealer.label}</span><button disabled={disabled||Boolean(row.deletion)} onClick={()=>void reviewRemoval(row.dealer.id,row.dealer.label,false)}>Återställ</button></li>)}</ul>}</details>}
    {review&&<section className="dealer-import-panel dealer-import-review" aria-labelledby="dealer-review-title"><h2 id="dealer-review-title">{review.archived?'Ta bort':'Återställ'} {review.name}?</h2>
      {review.archived?<><p>Dealern, klippen, klippkategorierna och berörda sammansättningar flyttas till papperskorgen. AI-tal stängs av och berörda rum och bolagspubliceringar kopplas loss. Källfiler och publiceringshistorik bevaras.</p>
        <p>{review.impact?.mediaCount} klipp påverkas.</p><ul>{review.impact?.operators.map(row=><li key={'operator:'+row.id}>Spelbolag: {row.name}</li>)}{review.impact?.rooms.map(row=><li key={'room:'+row.id}>Rum: {row.name}</li>)}{review.impact?.compositions.map(row=><li key={'composition:'+row.id}>Sammansättning: {row.label}</li>)}</ul></>:<><p>Dealern, materialet och sparade sammansättningar återförs som utkast. AI-tal förblir avstängt. Rum återställs eller öppnas inte automatiskt.</p><p>Sparade sammansättningar ({restoreCompositions.length})</p>{restoreCompositions.length>0&&<ul>{restoreCompositions.map(row=><li key={row.id}>{row.label}</li>)}</ul>}</>}
      <div className="dealer-import-actions"><button disabled={disabled} onClick={()=>void applyRemoval()}>{review.archived?'Flytta till papperskorgen':'Bekräfta återställning'}</button><button disabled={busy} onClick={()=>setReview(null)}>Avbryt</button></div>
    </section>}
  </section>;
}
