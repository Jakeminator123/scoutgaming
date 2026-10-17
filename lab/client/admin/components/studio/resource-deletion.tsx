import {useEffect,useState,type ReactNode} from 'react';
import {createResourceDeletionClient,resourceAnchor,type ResourceDeletionTree,type ResourceNode,type ResourceRef,type DeletionRoom,type DeletionMedia,type ResourceKind,type PublishedRoomChoices} from '../../lib/resource-deletion.mjs';

const client=createResourceDeletionClient();
const gameName=(id:string|null)=>id==='blackjack'?'Blackjack':id==='roulette'?'Roulette':id||'Spel ej angivet i registret';
const mediaName={video:'Film',image:'Bild',audio:'Ljud'};
const resourceHref=(kind:ResourceKind,id:string)=>'#'+resourceAnchor(kind,id);
function ResourceIdentity({id}:{id:string}) {
  return <details className="text-sm text-sg-muted"><summary>Register-ID</summary><code className="break-all">{id}</code></details>;
}
function RegistryRows<T extends ResourceNode>({rows,render,columns=false}:{rows:T[];render:(row:T)=>ReactNode;columns?:boolean}) {
  return <div className="space-y-5">{[
    {label:'Aktuella poster',rows:rows.filter(row=>!row.archived)},
    {label:'Arkiverade poster',rows:rows.filter(row=>row.archived)},
  ].filter(group=>group.rows.length).map(group=><section key={group.label}>
    <p className="mb-3 text-sm font-medium text-sg-muted">{group.label} · {group.rows.length}</p>
    <ul className={columns?'grid gap-3 lg:grid-cols-2':'space-y-4'}>{group.rows.map(render)}</ul>
  </section>)}</div>;
}
function State({row}:{row:ResourceNode}){
  return row.missing?<span className="text-amber-300">Post saknas i registret</span>:row.publishedOnly?<span className="text-sg-muted">Finns i publicerat paket; saknas i sparat register</span>:row.archived?<span className="text-sg-muted">Arkiverad</span>:null;
}
function Uses({rows}:{rows:ResourceRef[]}){
  return rows.length?<ul className="space-y-1">{rows.map(row=><li key={row.kind+':'+row.id+':'+row.relation}>
    <a className="underline" href={resourceHref(row.kind,row.id)}>{row.label}</a>{row.relation&&<span className="text-sg-muted"> · {row.relation}</span>}
  </li>)}</ul>:<p className="text-sg-muted">Inga synliga användningar i denna läsning.</p>;
}
function MediaRows({rows}:{rows:DeletionMedia[]}){
  return <ul className="divide-y divide-sg-line">{rows.map(row=><li key={row.id} id={resourceAnchor('media',row.id)} className="scroll-mt-6 py-3">
    <div className="flex flex-wrap items-baseline gap-2"><h4 className="font-medium">{row.label}</h4><span className="text-xs text-sg-muted">{mediaName[row.kind]}{row.game?' · '+gameName(row.game):''}</span><State row={row}/></div>
    <ResourceIdentity id={row.id}/>
    {row.eventId&&<p className="mt-1 text-sm">{row.eventId}{row.situation?' · '+row.situation:''}</p>}
    {!row.missing&&!row.available&&<p className="text-sm text-amber-300">Filen är inte tillgänglig enligt registret.</p>}
    {row.ownerIds.length>1&&<p className="text-sm text-amber-300">Motstridigt ägarskap: {row.ownerIds.join(', ')}.</p>}
    <div className="mt-2 text-sm"><Uses rows={row.uses}/></div>
  </li>)}</ul>;
}
function PublishedChoices({publication}:{publication:PublishedRoomChoices}){
  return <section className="mt-4 border-t border-sg-line pt-3" aria-label="Publicerade spelval">
    <h5 className="font-semibold">Publicerade spelval · paket {publication.packageRevision}</h5>
    <ul className="mt-2 space-y-3">{publication.dealers.map(dealer=><li key={dealer.id}>
      <p><a className="underline" href={resourceHref('dealer',dealer.id)}>{dealer.label}</a>{publication.dealerDefault===dealer.id?' (rummets förval)':''}</p>
      {!dealer.independentLayers&&<p className="text-sm text-sg-muted">Miljön följer dealerfilmen; separata lager är inte valbara.</p>}
      <dl className="ml-4 mt-1 space-y-1 text-sm">{(['background','table'] as const).map(role=>{
        const layer=dealer[role];
        return <div key={role}><dt className="font-medium">{role==='background'?'Bakgrund':'Bord'}{!layer.enabled?' · inte valbart':''}</dt>
          <dd>{layer.allowed.length?layer.allowed.map((asset,index)=><span key={asset.id}>{index>0?', ':''}<a className="underline" href={resourceHref('material',asset.id)}>{asset.label}</a>{layer.defaultId===asset.id?' (rummets förval)':''}</span>):role==='background'&&layer.mode==='baked'?'Inbakad miljö':'Inga publicerade val'}</dd></div>;
      })}</dl>
    </li>)}</ul>
  </section>;
}
function RoomBranch({room,tree}:{room:DeletionRoom;tree:ResourceDeletionTree}){
  const composition=tree.compositions.find(row=>row.id===room.compositionId);
  const query=new URLSearchParams({operator:room.operatorId,table:room.id,...room.compositionId?{composition:room.compositionId}:{},...room.game?{game:room.game}:{}});
  return <li className="admin-system-card scroll-mt-6" id={resourceAnchor('room',room.id)}>
    <h4 className="font-semibold">{room.label}</h4><p className="text-sm"><State row={room}/>{!room.archived&&(room.published?'Publicerat rum':'Rum utan aktuell publicering')}</p>
    <ResourceIdentity id={room.id}/>
    {composition?<p className="mt-3 text-sm">Sparad mall: <a className="underline" href={resourceHref('composition',composition.id)}>{composition.label}</a></p>:<p>Ingen sparad sammansättning angiven.</p>}
    {composition?.layers&&<ol className="mt-3 space-y-2 border-l border-sg-line pl-4" aria-label="Lager i sparad mall">
      {(['background','dealer','table'] as const).map(role=>{
        const layer=composition.layers![role],name=role==='background'?'Bakgrund':role==='dealer'?'Dealer':'Bord';
        return <li key={role}><span className="font-medium">{name}</span>{!layer.enabled&&<span className="text-sg-muted"> · avstängt</span>}
          <div className="text-sm">{layer.ids.length?layer.ids.map((id,index)=>{
            const row=role==='dealer'?tree.dealers.find(item=>item.id===id):tree.materials.find(item=>item.id===id);
            return <span key={id}>{index>0?', ':''}<a className="underline" href={resourceHref(role==='dealer'?'dealer':'material',id)}>{row?.label??id}</a>{layer.defaultId===id?' (förval)':''}</span>;
          }):'Inga sparade val'}</div></li>;
      })}
    </ol>}
    {room.published&&<p className="mt-3 text-sm">Publicerade dealer-val: {room.publishedDealerIds.length?room.publishedDealerIds.map((id,index)=><span key={id}>{index>0?', ':''}<a className="underline" href={resourceHref('dealer',id)}>{tree.dealers.find(row=>row.id===id)?.label??id}</a></span>):'Inga angivna'}</p>}
    {room.publication?<PublishedChoices publication={room.publication}/>:<p className="mt-3 text-sm text-sg-muted">Publicerade bakgrunds- och bordsval är inte tillgängliga i denna läsning.</p>}
    {tree.operators.some(row=>row.id===room.operatorId)&&<a className="studio-button mt-3" href={'/admin/publication?'+query}>Öppna bolagets rum</a>}
  </li>;
}
export function ResourceDeletion(){
  const [tree,setTree]=useState<ResourceDeletionTree|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[refresh,setRefresh]=useState(0);
  useEffect(()=>{const abort=new AbortController();setLoading(true);setError('');setTree(null);
    void client.load(abort.signal).then(value=>{if(!abort.signal.aborted)setTree(value);})
      .catch(cause=>{if(!abort.signal.aborted)setError(cause instanceof Error?cause.message:'Registren kunde inte läsas.');})
      .finally(()=>{if(!abort.signal.aborted)setLoading(false);});
    return()=>abort.abort();
  },[refresh]);
  return <section className="admin-system-page" id={resourceAnchor('project','saved')} aria-labelledby="resource-deletion-title" onClick={event=>{if((event.target as Element).closest('a')?.getAttribute('href')?.startsWith('#'))event.stopPropagation();}}>
    <header className="admin-system-header"><div><p className="sg-eyebrow">System · Beroenden</p><h1 id="resource-deletion-title">Användning &amp; beroenden</h1>
      <p>Se var bolag, rum, dealers och material används.</p></div><button className="studio-button" type="button" disabled={loading} onClick={()=>setRefresh(value=>value+1)}>Uppdatera</button></header>
    <p className="text-sm text-sg-muted">Ändringar och arkivering görs i respektive register.</p>
    <nav className="admin-system-actions" aria-label="Delar i beroendeträdet"><a className="studio-button" href="#deletion-companies">Bolag och rum</a><a className="studio-button" href="#deletion-dealers">Dealers och filer</a><a className="studio-button" href="#deletion-materials">Bord och bakgrunder</a><a className="studio-button" href="#deletion-compositions">Sammansättningar</a></nav>
    {loading&&<p role="status">Läser aktuella register…</p>}{error&&<p role="alert">{error} Använd Uppdatera för att försöka igen.</p>}
    {tree&&<>
      {!tree.lifecycleAvailable&&<p role="alert" className="rounded border border-amber-500 p-3">Bolagens och rummens arkiv kunde inte läsas. Trädet är ofullständigt. Uppdatera för att försöka igen.</p>}
      {tree.warnings.length>0&&<ul role="status" className="space-y-1 text-amber-300">{tree.warnings.map(warning=><li key={warning}>{warning}</li>)}</ul>}
      <section id="deletion-companies" className="scroll-mt-6 space-y-4"><h2 className="text-xl font-semibold">Bolag → spel → rum</h2>
        <p className="text-sm text-sg-muted">Bolaget äger rummet. Bakgrunden är en separat fil som kan användas av flera rum.</p>
        {!tree.operators.length&&<p>Inga bolag i det lästa registret.</p>}
        <RegistryRows rows={tree.operators} render={operator=>{
          const rooms=tree.rooms.filter(room=>room.operatorId===operator.id),games=[...new Set(rooms.map(room=>room.game))];
          return <li key={operator.id} id={resourceAnchor('operator',operator.id)} className="admin-system-card scroll-mt-6"><h3 className="font-semibold">{operator.label}</h3><State row={operator}/>{!operator.archived&&operator.status!=='active'&&<p className="text-sm text-sg-muted">Avstängt bolag</p>}
            <ResourceIdentity id={operator.id}/>
            <a className="studio-button my-2" href={'/admin/companies?'+new URLSearchParams({operator:operator.id})}>Öppna bolaget</a>
            {rooms.length?<ul className="space-y-4 border-l border-sg-line pl-4">{games.map(game=><li key={game??'unknown'}><h4 className="my-2 font-medium">{gameName(game)}</h4><ul className="grid gap-3 lg:grid-cols-2">{rooms.filter(room=>room.game===game).map(room=><RoomBranch key={room.id} room={room} tree={tree}/>)}</ul></li>)}</ul>:<p>Inga rum i de lästa registren.</p>}
          </li>;
        }}/>
        {tree.unownedRoomIds.length>0&&<div className="space-y-3"><h3 className="font-semibold text-amber-300">Rum där bolaget saknas</h3><ul className="grid gap-3 lg:grid-cols-2">{tree.rooms.filter(room=>tree.unownedRoomIds.includes(room.id)).map(room=><RoomBranch key={room.id} room={room} tree={tree}/>)}</ul></div>}
      </section>
      <section id="deletion-dealers" className="scroll-mt-6 space-y-4"><h2 className="text-xl font-semibold">Dealers → klipp och registrerade filer</h2>
        <p className="text-sm text-sg-muted">Varje fil visas en gång. Dealers kan användas i flera bolags rum.</p>
        {!tree.dealers.length&&<p>Inga dealers i de lästa registren.</p>}
        <RegistryRows rows={tree.dealers} render={dealer=>{
          const owned=tree.media.filter(row=>row.primaryOwnerId===dealer.id),borrowed=tree.media.filter(row=>row.primaryOwnerId!==dealer.id&&(row.ownerIds.includes(dealer.id)||row.uses.some(use=>use.kind==='dealer'&&use.id===dealer.id)));
          return <li key={dealer.id} id={resourceAnchor('dealer',dealer.id)} className="admin-system-card scroll-mt-6"><h3 className="font-semibold">{dealer.label}</h3><State row={dealer}/><ResourceIdentity id={dealer.id}/>
            {!dealer.missing&&!dealer.publishedOnly&&<a className="studio-button my-2" href={'/admin/dealers?'+new URLSearchParams({dealer:dealer.id})}>Öppna dealern</a>}
            <div className="my-3 text-sm"><Uses rows={dealer.uses}/></div>
            {owned.length?<MediaRows rows={owned}/>:<p>Inga egna filer i det lästa klippregistret.</p>}
            {borrowed.length>0&&<div className="mt-3 text-sm"><h4 className="font-medium">Filreferenser som visas på annan plats</h4><ul>{borrowed.map(row=><li key={row.id}><a className="underline" href={resourceHref('media',row.id)}>{row.label}</a></li>)}</ul></div>}
          </li>;
        }}/>
        {tree.media.some(row=>!row.primaryOwnerId)&&<div className="admin-system-card"><h3 className="font-semibold">Filer och referenser utan registrerad dealerägare</h3><MediaRows rows={tree.media.filter(row=>!row.primaryOwnerId)}/></div>}
      </section>
      <section id="deletion-materials" className="scroll-mt-6 space-y-4"><h2 className="text-xl font-semibold">Bord och bakgrunder</h2>
        <a className="studio-button" href="/admin/assets">Öppna materialbiblioteket</a>
        <RegistryRows rows={tree.materials} columns render={row=><li key={row.id} id={resourceAnchor('material',row.id)} className="admin-system-card scroll-mt-6">
          <h3 className="font-semibold">{row.label}</h3><p className="text-sm">{row.role==='background'?'Bakgrund':'Bord'}{row.game?' · '+gameName(row.game):''}</p><State row={row}/><ResourceIdentity id={row.id}/>
          <div className="mt-3 text-sm"><Uses rows={row.uses}/></div>
        </li>}/>{!tree.materials.length&&<p>Inga bord eller bakgrunder i de lästa registren.</p>}
      </section>
      <section id="deletion-compositions" className="scroll-mt-6 space-y-4"><h2 className="text-xl font-semibold">Sammansättningar</h2>
        <p className="text-sm text-sg-muted">Sparade mallar som kan användas av flera rum.</p>
        <RegistryRows rows={tree.compositions} render={row=><li key={row.id} id={resourceAnchor('composition',row.id)} className="admin-system-card scroll-mt-6">
          <h3 className="font-semibold">{row.label}</h3><State row={row}/><ResourceIdentity id={row.id}/>
          <div className="my-3 space-y-3 text-sm"><Uses rows={row.uses}/>
            {row.publishedTo!==null&&<div><p className="font-medium">Aktuell publicering</p>{row.publishedTo.length?<Uses rows={row.publishedTo}/>:<p className="text-sg-muted">Ingen aktuell bolagspublicering i registret.</p>}</div>}
            <p>Historiska paketreferenser: {row.historicalPackageReferences===null?'okänt':row.historicalPackageReferences}{row.historicalPackageReferences!==null?' · registerläsningen är komplett':''}</p>
          </div>
          {row.layers&&<dl className="space-y-2 text-sm">{(['background','dealer','table'] as const).map(role=><div key={role}><dt className="font-medium">{role==='background'?'Bakgrund':role==='dealer'?'Dealer':'Bord'}{row.layers![role].enabled?'':' · avstängt'}</dt>
            <dd>{row.layers![role].ids.length?row.layers![role].ids.map((id,index)=><span key={id}>{index>0?', ':''}<a className="underline" href={resourceHref(role==='dealer'?'dealer':'material',id)}>{(role==='dealer'?tree.dealers:tree.materials).find(item=>item.id===id)?.label??id}</a>{row.layers![role].defaultId===id?' (förval)':''}</span>):'Inga sparade val'}</dd></div>)}</dl>}
          {!row.missing&&!row.archived&&<a className="studio-button mt-3" href={'/admin/compositions?'+new URLSearchParams({composition:row.id})}>Öppna sammansättningen</a>}
        </li>}/>{!tree.compositions.length&&<p>Inga sammansättningar i det lästa registret.</p>}
      </section>
      <details className="admin-system-card text-sm text-sg-muted"><summary>Vad läsningen omfattar</summary><p className="mt-2">Historikräkning: {tree.historyCoverage==='complete'?'komplett registerläsning':tree.historyCoverage==='incomplete'?'ofullständig':'inte tillgänglig'}.</p><ul className="mt-2 list-disc space-y-2 pl-5">{tree.coverage.map(item=><li key={item}>{item}</li>)}</ul>
        <p className="mt-3">Läst {new Date(tree.readAt).toLocaleString('sv-SE')} · Projekt {tree.projectRevision}</p>
      </details>
    </>}
  </section>;
}
