'use client';

import {useEffect,useState,type MouseEvent} from 'react';
import {OPERATOR_STORAGE_KEY,operatorChoice} from '@/lib/player-operator.mjs';
import {readChoices} from '@/lib/player-choices.mjs';
import {loadOperatorCatalogue,loadRoomCatalogue,rememberRoomSelection,roomLaunch,roomSelection,type RoomSelection,type OperatorCatalogueResult} from '@/lib/player-lobby.mjs';
import type {PublicOperatorRooms,PublicOperatorRoom} from '../../../../web/public/operator-rooms-contract.mjs';

type Operator={slug:string;name:string};
type CatalogueState={status:'loading'|'unscoped'|'not-found'|'unavailable';slug:string}|{status:'ready';slug:string;catalog:PublicOperatorRooms};
const selectClass='mt-2 block min-h-12 w-full rounded-xl border border-white/20 bg-[#171b1c] px-4 py-3 text-sm text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d4f83a]';
const focusClass='focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d4f83a]';
const initials=(name:string)=>Array.from(name.trim()).slice(0,2).join('').toLocaleUpperCase('sv');

// Visual hierarchy inspired by Kevin's Table Studio (233c65a4): a scene beside
// ordered choices. Data, permissions and launch remain the existing main flow.
export function PlayerRoomCard({catalog,room,stored,directPlay}:{catalog:PublicOperatorRooms;room:PublicOperatorRoom;stored:Partial<RoomSelection>;directPlay:boolean}) {
  const [selected,setSelected]=useState(()=>roomSelection(room,stored));
  const [error,setError]=useState('');
  if(!selected)return null;
  const dealer=room.dealers.find(row=>row.id===selected.dealer)!;
  const launch=roomLaunch(catalog,room.id,selected,{directPlay});
  if(!launch)return null;
  function choose(patch:Partial<RoomSelection>){setSelected(current=>roomSelection(room,{...current,...patch}));setError('');}
  function remember(event:MouseEvent<HTMLAnchorElement>) {
    try {
      if(rememberRoomSelection(window.localStorage,catalog.operator.slug,launch!.choices))return;
    } catch {if(!launch!.choices.tableAsset&&!launch!.choices.background)return;}
    event.preventDefault();setError('Dina miljöval kunde inte sparas. Tillåt lokal lagring i webbläsaren och försök igen.');
  }
  const table=dealer.table.allowed.find(row=>row.id===selected.tableAsset);
  const background=dealer.background.allowed.find(row=>row.id===selected.background);
  return <article className="mt-6 grid overflow-hidden rounded-3xl border border-white/10 bg-[#111516] lg:grid-cols-[0.85fr_1.15fr]" aria-labelledby={room.id+'-title'}>
    <div className="relative flex min-w-0 flex-col justify-between overflow-hidden bg-gradient-to-br from-[#1c3931] via-[#132724] to-[#0b1615] p-6 sm:p-9">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#d4f83a]">Blackjack · {catalog.operator.name}</p>
        <h3 id={room.id+'-title'} className="mt-4 break-words text-3xl font-medium tracking-tight text-[#f2f1ed]">{room.name}</h3>
        <p className="mt-2 text-sm text-white/55">{room.presentation.label}</p>
      </div>
      <div aria-hidden="true" className="relative my-10 hidden h-40 items-center justify-center sm:flex sm:h-48">
        <div className="absolute h-40 w-64 rounded-[50%] border border-[#d4f83a]/15 sm:h-48 sm:w-80" />
        <div className="-mr-4 flex h-32 w-24 -rotate-12 flex-col justify-between rounded-xl bg-[#e9e8de] p-3 text-3xl text-[#18231f] shadow-xl"><span>A</span><span className="self-end">♠</span></div>
        <div className="mt-5 flex h-32 w-24 rotate-12 flex-col justify-between rounded-xl border border-white/20 bg-[#24483c] p-3 text-3xl text-[#d4f83a] shadow-xl"><span>K</span><span className="self-end">♣</span></div>
      </div>
      <div className="relative border-t border-white/15 pt-5" aria-live="polite" aria-atomic="true">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">Dina val</p>
        <p className="mt-2 text-2xl text-[#f2f1ed]">{dealer.label}</p>
        <p className="mt-2 text-sm leading-relaxed text-white/65">{[table?.label,background?.label].filter(Boolean).join(' · ')||'Dealerns befintliga miljö'}</p>
        <p className="mt-4 text-xs text-white/40">Bordets slutliga utseende visas när spelet öppnas.</p>
      </div>
    </div>
    <div className="min-w-0 p-6 sm:p-9">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#d4f83a]">03 / Gör bordet till ditt</p>
      <fieldset className="mt-6">
        <legend className="text-lg font-medium text-[#f2f1ed]">Välj dealer</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Dealer">
          {room.dealers.map(row=><label key={row.id}
            className={'flex min-h-20 min-w-0 cursor-pointer items-center gap-3 rounded-xl border p-4 text-left transition-colors focus-within:outline-2 focus-within:outline-offset-4 focus-within:outline-[#d4f83a] '+(row.id===selected.dealer?' border-[#d4f83a] bg-[#d4f83a]/8':' border-white/10 bg-white/[0.025] hover:border-white/35')}>
            <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs text-[#d4f83a]">{initials(row.label)}</span>
            <span className="min-w-0 flex-1 break-words text-sm font-medium text-[#f2f1ed]">{row.label}</span>
            <input type="radio" name={room.id+"-dealer"} value={row.id} checked={row.id===selected.dealer} onChange={()=>choose({dealer:row.id})} className="h-4 w-4 shrink-0 accent-[#d4f83a]" />
          </label>)}
        </div>
      </fieldset>
      <fieldset className="mt-7 space-y-4">
        <legend className="mb-3 text-lg font-medium text-[#f2f1ed]">Din miljö</legend>
        {!dealer.independentLayers?<p className="rounded-xl border border-white/10 bg-white/[0.025] p-4 text-sm leading-relaxed text-white/60">Bord och bakgrund ingår i {dealer.label}s dealerfilm.</p>:<>
          {dealer.table.enabled&&dealer.table.allowed.length>0?<label className="block text-sm text-white/65">Bordets utseende
            <select className={selectClass} value={selected.tableAsset??''} onChange={event=>choose({tableAsset:event.target.value})}>
              {dealer.table.default===null?<option value="">Inget bord</option>:null}
              {dealer.table.allowed.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}
            </select>
          </label>:null}
          {dealer.background.enabled&&dealer.background.allowed.length>0?<label className="block text-sm text-white/65">Bakgrund
            <select className={selectClass} value={selected.background??''} onChange={event=>choose({background:event.target.value})}>
              {dealer.background.default===null?<option value="">Ingen bakgrund</option>:null}
              {dealer.background.allowed.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}
            </select>
            <span className="mt-2 block text-xs text-white/40">{dealer.background.mode==='video'?'Bakgrunden loopas under spelet.':'Bakgrundsbild under spelet.'}</span>
          </label>:null}
          {!dealer.table.allowed.length&&!dealer.background.allowed.length?<p className="text-sm text-white/60">Bolagets valda miljö används i det här rummet.</p>:null}
        </>}
      </fieldset>
      <div className="mt-8 border-t border-white/10 pt-6">
        {error?<p role="alert" className="mb-3 text-sm text-amber-200">{error}</p>:null}
        <a href={launch.href} onClick={remember} onAuxClick={remember} className={'flex min-h-14 items-center justify-between gap-4 rounded-xl bg-[#d4f83a] px-5 py-4 text-base font-semibold text-[#14180a] transition-colors hover:bg-[#e0ff66] '+focusClass}>
          <span>{directPlay?'Spela med ':'Logga in och spela med '}{dealer.label}</span><span aria-hidden="true">↗</span>
        </a>
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
