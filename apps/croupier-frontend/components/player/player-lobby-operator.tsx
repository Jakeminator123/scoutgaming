'use client';

import {useEffect,useState,type MouseEvent} from 'react';
import {OPERATOR_STORAGE_KEY,operatorChoice} from '@/lib/player-operator.mjs';
import {readChoices} from '@/lib/player-choices.mjs';
import {loadOperatorCatalogue,loadRoomCatalogue,rememberRoomSelection,roomLaunch,roomSelection,type RoomSelection,type OperatorCatalogueResult} from '@/lib/player-lobby.mjs';
import {dealerPortrait,loadRoomPreview,type RoomPreviewResult} from '@/lib/player-room-preview.mjs';
import {PlayerRoomPreview,PreviewImage,EnvironmentChoices} from './player-room-preview';
import type {PublicOperatorRooms,PublicOperatorRoom} from '../../../../web/public/operator-rooms-contract.mjs';

type Operator={slug:string;name:string};
type CatalogueState={status:'loading'|'unscoped'|'not-found'|'unavailable';slug:string}|{status:'ready';slug:string;catalog:PublicOperatorRooms};
const selectClass='mt-2 block min-h-12 w-full rounded-xl border border-white/20 bg-[#171b1c] px-4 py-3 text-sm text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d4f83a]';
const focusClass='focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d4f83a]';
const initials=(name:string)=>Array.from(name.trim()).slice(0,2).join('').toLocaleUpperCase('sv');

// Image-led studio layout; choices and launch always come from the published room.
export function PlayerRoomCard({catalog,room,stored,directPlay}:{catalog:PublicOperatorRooms;room:PublicOperatorRoom;stored:Partial<RoomSelection>;directPlay:boolean}) {
  const [selected,setSelected]=useState(()=>roomSelection(room,stored));
  const [error,setError]=useState('');
  const [previews,setPreviews]=useState<Record<string,RoomPreviewResult>>({});
  useEffect(()=>{
    const controller=new AbortController();let active=true;const pending=[...room.dealers];
    // Four bounded readers. Cards never discover dealers outside this room.
    async function worker(){while(active&&pending.length){const row=pending.shift()!;const result=await loadRoomPreview(catalog,room,row.id,{signal:controller.signal});if(active)setPreviews(current=>({...current,[row.id]:result}));}}
    void Promise.all(Array.from({length:Math.min(4,pending.length)},worker));
    return()=>{active=false;controller.abort();};
  },[catalog,room]);
  if(!selected)return null;
  const dealer=room.dealers.find(row=>row.id===selected.dealer)!;
  const launch=roomLaunch(catalog,room.id,selected,{directPlay});
  if(!launch)return null;
  function choose(patch:Partial<RoomSelection>){setSelected(current=>roomSelection(room,{...current,...patch}));setError('');}
  function remember(event:MouseEvent<HTMLAnchorElement>) {
    try {if(rememberRoomSelection(window.localStorage,catalog.operator.slug,launch!.choices))return;}
    catch {if(!launch!.choices.tableAsset&&!launch!.choices.background)return;}
    event.preventDefault();setError('Dina miljöval kunde inte sparas. Tillåt lokal lagring i webbläsaren och försök igen.');
  }
  const current=previews[dealer.id];const preview=current?.status==='ready'?current.preview:null;
  return <article className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,.85fr)] xl:gap-10" aria-labelledby={room.id+'-title'}>
    <PlayerRoomPreview key={dealer.id} result={current} dealerId={dealer.id} dealerLabel={dealer.label} roomName={room.name} operatorName={catalog.operator.name} tableAsset={selected.tableAsset} background={selected.background}/>
    <div className="min-w-0 rounded-3xl border border-white/10 bg-[#111516] p-5 sm:p-7">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#d4f83a]">03 / Gör bordet till ditt</p>
      <h3 id={room.id+'-title'} className="mt-3 text-2xl font-medium tracking-tight">{room.name}</h3>
      <p className="mt-2 text-sm text-white/45">{room.presentation.label}</p>
      <fieldset className="mt-7"><legend className="text-base font-medium">Välj dealer</legend>
        <div className="mt-3 grid grid-cols-2 gap-3" role="radiogroup" aria-label="Dealer">
          {room.dealers.map(row=>{const data=previews[row.id];return <label key={row.id} className={'group relative min-w-0 cursor-pointer overflow-hidden rounded-xl border transition-colors focus-within:outline-2 focus-within:outline-offset-4 focus-within:outline-[#d4f83a] '+(row.id===selected.dealer?'border-[#d4f83a] bg-[#d4f83a]/5':'border-white/10 bg-white/[.025] hover:border-white/35')}>
            <PreviewImage key={data?.status==='ready'?data.preview.media.dealer?.src??row.id:row.id} portrait={dealerPortrait(row.id)} media={data?.status==='ready'?data.preview.media.dealer:null} label={row.label} className="aspect-[4/3] w-full object-cover object-top transition-transform duration-300 motion-safe:group-hover:scale-[1.025]"/>
            <span className="flex min-h-16 items-center justify-between gap-2 p-3"><span className="min-w-0"><span className="block break-words text-sm font-medium">{row.label}</span><span className="mt-1 block text-[10px] text-white/45">{row.independentLayers?'Valbar bordsmiljö':'Egen bordsmiljö'}</span></span><input type="radio" name={room.id+'-dealer'} value={row.id} checked={row.id===selected.dealer} onChange={()=>choose({dealer:row.id})} className="h-4 w-4 shrink-0 accent-[#d4f83a]"/></span>
          </label>})}
        </div>
      </fieldset>
      {!dealer.independentLayers?<p className="mt-7 rounded-xl border border-white/10 p-4 text-sm leading-relaxed text-white/55">Bord och bakgrund ingår i {dealer.label}s dealerfilm.</p>:<>
       {dealer.background.enabled&&dealer.background.allowed.length>0?<EnvironmentChoices legend="Bakgrund" name={room.id+'-background'} items={dealer.background.allowed} media={preview?.media.backgrounds} selected={selected.background} allowEmpty={dealer.background.default===null} onChange={id=>choose({background:id})}/>:null}
       {dealer.table.enabled&&dealer.table.allowed.length>0?<EnvironmentChoices legend="Bordets utseende" name={room.id+'-table'} items={dealer.table.allowed} media={preview?.media.tables} selected={selected.tableAsset} allowEmpty={dealer.table.default===null} onChange={id=>choose({tableAsset:id})}/>:null}
       {!dealer.table.allowed.length&&!dealer.background.allowed.length?<p className="mt-7 text-sm text-white/55">Bolagets valda miljö används i det här rummet.</p>:null}
      </>}
      <div className="mt-8 border-t border-white/10 pt-6">
        {error?<p role="alert" className="mb-3 text-sm text-amber-200">{error}</p>:null}
        <a href={launch.href} onClick={remember} onAuxClick={remember} className={'flex min-h-14 items-center justify-between gap-4 rounded-xl bg-[#d4f83a] px-5 py-4 text-base font-semibold text-[#14180a] transition-colors hover:bg-[#e0ff66] '+focusClass}><span>{directPlay?'Spela med ':'Logga in och spela med '}{dealer.label}</span><span aria-hidden="true">↗</span></a>
        <p className="mt-3 text-xs leading-relaxed text-white/40">Dina val följer med när bordet öppnas. Demo utan riktiga pengar.</p>
      </div>
    </div>
  </article>;
}

export function PlayerRoomCatalogue({catalog,stored={},directPlay}:{catalog:PublicOperatorRooms;stored?:Partial<RoomSelection>;directPlay:boolean}) {
  const [roomId,setRoomId]=useState(catalog.rooms[0]?.id??'');
  const room=catalog.rooms.find(row=>row.id===roomId)??catalog.rooms[0];
  if(!room)return <p role="status" className="mt-6 rounded-2xl border border-white/15 p-6 text-white/60">{catalog.operator.name} har inga öppna spelrum ännu.</p>;
  return <section className="mt-8" aria-label="Spelrum">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#d4f83a]">02 / Spelrum</p><h2 className="mt-2 text-2xl font-medium text-[#f2f1ed]">Välj din plats vid bordet.</h2></div>
      <span className="text-xs text-white/45">{catalog.rooms.length} spelrum · Blackjack</span>
    </div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {catalog.rooms.map(row=><button key={row.id} type="button" aria-pressed={row.id===room.id} onClick={()=>setRoomId(row.id)}
        className={'flex min-w-0 items-center justify-between gap-3 rounded-2xl border p-5 text-left transition-colors '+focusClass+(row.id===room.id?' border-[#d4f83a]/60 bg-[#d4f83a]/5':' border-white/10 bg-white/[0.02] hover:border-white/30')}>
        <span className="min-w-0"><span className="block break-words text-base font-medium text-[#f2f1ed]">{row.name}</span><span className="mt-1 block text-xs text-white/50">{row.dealers.length} {row.dealers.length===1?'dealer':'dealers'} att välja bland</span></span>
        <span className="text-[#d4f83a]" aria-hidden="true">{row.id===room.id?'✓':'↗'}</span>
      </button>)}
    </div>
    <PlayerRoomCard key={catalog.operator.slug+':'+catalog.packageRevision+':'+room.id} catalog={catalog} room={room} stored={stored} directPlay={directPlay}/>
  </section>;
}

type OperatorDirectoryState=OperatorCatalogueResult|{status:'loading'};
export function PlayerOperatorChooser({state,current,onChoose,onRetry,filter='',onFilter}:{
  state:OperatorDirectoryState;current:Operator|null;onChoose:(slug:string)=>void;onRetry:()=>void;filter?:string;onFilter?:(value:string)=>void;
}) {
  if(state.status==='loading')return <p role="status" className="mt-6 text-white/60">Hämtar spelbolag…</p>;
  if(state.status==='unavailable')return <div className="mt-6 rounded-2xl border border-white/15 p-6"><p role="alert" className="text-amber-200">Spelbolagen kan inte hämtas just nu.</p>
    <button type="button" className={'mt-4 min-h-11 rounded-lg border border-white/25 px-4 py-2 text-white '+focusClass} onClick={onRetry}>Hämta bolagen igen</button></div>;
  if(!state.operators.length)return <p role="status" className="mt-6 rounded-2xl border border-white/15 p-6 text-white/60">Inga spelbolag har öppna spelrum ännu. Välkommen tillbaka snart.</p>;
  const visible=state.operators.filter(row=>row.name.toLocaleLowerCase('sv').includes(filter.trim().toLocaleLowerCase('sv')));
  return <section aria-label="Välj spelbolag" className="mt-8">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#d4f83a]">01 / Spelbolag</p><h2 className="mt-2 text-2xl font-medium text-[#f2f1ed]">Var vill du spela?</h2><p className="mt-2 text-sm text-white/50">Varje bolag har sina egna spelrum, dealers och miljöer.</p></div>
      {state.operators.length>6&&onFilter?<label className="w-full text-xs text-white/60 sm:w-64">Sök spelbolag<input value={filter} onChange={event=>onFilter(event.target.value)} type="search" className={selectClass} placeholder="Bolagets namn" /></label>:null}
    </div>
    <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {visible.map((row,index)=><button key={row.slug} type="button" onClick={()=>onChoose(row.slug)}
        className={'group relative min-w-0 overflow-hidden rounded-2xl border border-white/15 bg-[#131819] p-6 text-left transition-colors hover:border-[#d4f83a]/60 hover:bg-[#1b2520] '+focusClass}>
        <div className="flex items-start justify-between"><span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#d4f83a]/20 bg-[#d4f83a]/5 text-lg font-medium text-[#d4f83a]">{initials(row.name)}</span><span aria-hidden="true" className="font-mono text-xs text-white/25">{String(index+1).padStart(2,'0')}</span></div>
        <h3 className="mt-7 break-words text-xl font-medium text-[#f2f1ed]">{row.name}</h3>
        <p className="mt-2 text-sm text-white/45">Blackjack · välj rum och dealer</p>
        <span className="mt-7 flex items-center justify-between border-t border-white/10 pt-4 text-sm font-medium text-[#d4f83a]">Utforska spelrummen <span aria-hidden="true">↗</span></span>
      </button>)}
    </div>
    {!visible.length?<p role="status" className="mt-6 text-white/60">Inget spelbolag matchar din sökning.</p>:null}
  </section>;
}

export function PlayerLobbyOperator({initial,directPlay}:{
  initial:Operator|null;playHref:string;playLabel:string;directPlay:boolean;
}) {
  const [state,setState]=useState<CatalogueState>({status:initial?'loading':'unscoped',slug:initial?.slug??''});
  const [stored,setStored]=useState<Partial<RoomSelection>>({});
  const [retry,setRetry]=useState(0);
  const [filter,setFilter]=useState('');
  const [directory,setDirectory]=useState<OperatorDirectoryState>({status:'loading'});
  useEffect(()=>{
    const controller=new AbortController();let active=true;
    setDirectory({status:'loading'});
    void loadOperatorCatalogue({signal:controller.signal}).then(result=>{if(active)setDirectory(result);});
    return()=>{active=false;controller.abort();};
  },[retry]);
  useEffect(()=>{
    // The public entrance always offers company choice. A stored operator must
    // not silently skip it; only this page's explicit URL scopes the catalogue.
    const slug=operatorChoice({search:window.location.search});
    if(!slug){setState({status:'unscoped',slug:''});return;}
    const controller=new AbortController();let active=true;
    setState({status:'loading',slug});
    try{setStored(readChoices(window.localStorage,slug));}catch{setStored({});}
    void loadRoomCatalogue(slug,{signal:controller.signal}).then(result=>{
      if(!active)return;
      setState({...result,slug});
      if(result.status==='ready')try{window.localStorage.setItem(OPERATOR_STORAGE_KEY,result.catalog.operator.slug);}catch{}
    });
    return()=>{active=false;controller.abort();};
  },[initial?.slug,retry]);
  function chooseOperator(slug:string){
    if(directory.status!=='ready'||!directory.operators.some(row=>row.slug===slug))return;
    window.location.assign('/play?'+new URLSearchParams({operator:slug}).toString());
  }
  function clearOperator(){
    try{window.localStorage.removeItem(OPERATOR_STORAGE_KEY);}catch{}
    window.location.assign('/play');
  }
  const operator=state.status==='ready'?state.catalog.operator:initial?.slug===state.slug?initial:null;
  return <div>
    <ol aria-label="Dina steg" className="flex flex-wrap gap-x-7 gap-y-3 border-y border-white/10 py-5 text-xs">
      {['Bolag','Spelrum','Dealer & miljö'].map((step,index)=><li key={step} className={(index===0&&!state.slug||index>0&&state.status==='ready')?'text-[#d4f83a]':'text-white/45'}><span className="mr-2 font-mono opacity-50">0{index+1}</span>{step}</li>)}
    </ol>
    {state.slug?<div className="mt-7 flex flex-wrap items-center justify-between gap-4">
      <p className="text-white/60" data-operator>Spelar hos: <strong className="text-[#f2f1ed]">{operator?.name??(state.status==='loading'?'Hämtar bolag…':'Spelbolaget är inte tillgängligt')}</strong></p>
      <button type="button" className={'min-h-11 rounded-lg border border-white/20 px-4 py-2 text-sm text-white/75 hover:border-[#d4f83a]/60 '+focusClass} onClick={clearOperator}>← Byt spelbolag</button>
    </div>:<PlayerOperatorChooser state={directory} current={null} onChoose={chooseOperator} onRetry={()=>setRetry(value=>value+1)} filter={filter} onFilter={setFilter}/>}
    {state.status==='loading'?<p role="status" className="mt-8 text-white/60">Hämtar publicerade spelrum…</p>:null}
    {state.status==='not-found'?<p role="status" className="mt-8 text-white/60">Det här spelbolagets lobby är inte tillgänglig. Kontrollera länken från spelbolaget eller välj ett annat bolag.</p>:null}
    {state.status==='unavailable'?<div className="mt-8"><p role="alert" className="text-amber-200">Spelrummen kan inte hämtas just nu. Försök igen om en stund.</p><button type="button" className={'mt-3 min-h-11 rounded-lg border border-white/25 px-4 py-2 text-white '+focusClass} onClick={()=>setRetry(value=>value+1)}>Försök igen</button></div>:null}
    {state.status==='ready'?<PlayerRoomCatalogue key={state.catalog.operator.slug+':'+state.catalog.packageRevision} catalog={state.catalog} stored={stored} directPlay={directPlay}/>:null}
  </div>;
}
