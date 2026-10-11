'use client';

import {useEffect,useState,type MouseEvent} from 'react';
import {OPERATOR_STORAGE_KEY,clearedOperatorLocation,operatorChoice} from '@/lib/player-operator.mjs';
import {readChoices} from '@/lib/player-choices.mjs';
import {loadOperatorCatalogue,loadRoomCatalogue,rememberRoomSelection,roomLaunch,roomSelection,type RoomSelection,type OperatorCatalogueResult} from '@/lib/player-lobby.mjs';
import type {PublicOperatorRooms,PublicOperatorRoom} from '../../../../web/public/operator-rooms-contract.mjs';

type Operator={slug:string;name:string};
type CatalogueState={status:'loading'|'unscoped'|'not-found'|'unavailable';slug:string}|{status:'ready';slug:string;catalog:PublicOperatorRooms};
const selectClass='mt-2 block w-full rounded-lg border border-white/20 bg-[#14252d] px-3 py-3 text-white';

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
  return <article className="rounded-2xl border border-white/15 bg-white/5 p-5 sm:p-6" aria-labelledby={room.id+'-title'}>
    <p className="text-xs uppercase tracking-widest text-emerald-300">Blackjack · spelrum</p>
    <h3 id={room.id+'-title'} className="mt-2 text-2xl font-semibold">{room.name}</h3>
    <p className="mt-1 text-sm text-slate-400">Miljö: {room.presentation.label}</p>
    <fieldset className="mt-5 space-y-4"><legend className="sr-only">Välj dealer och miljö i {room.name}</legend>
      <label className="block text-sm text-slate-200">Dealer
        <select className={selectClass} value={selected.dealer} onChange={event=>choose({dealer:event.target.value})}>
          {room.dealers.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}
        </select>
      </label>
      {!dealer.independentLayers?<p className="rounded-lg bg-black/20 p-3 text-sm text-slate-300">Bord och bakgrund ingår i {dealer.label}s dealerfilm.</p>:<>
        {dealer.table.enabled&&dealer.table.allowed.length>0?<label className="block text-sm text-slate-200">Bordets utseende
          <select className={selectClass} value={selected.tableAsset??''} onChange={event=>choose({tableAsset:event.target.value})}>
            {dealer.table.default===null?<option value="">Inget bord</option>:null}
            {dealer.table.allowed.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}
          </select>
        </label>:null}
        {dealer.background.enabled&&dealer.background.allowed.length>0?<label className="block text-sm text-slate-200">Bakgrund
          <select className={selectClass} value={selected.background??''} onChange={event=>choose({background:event.target.value})}>
            {dealer.background.default===null?<option value="">Ingen bakgrund</option>:null}
            {dealer.background.allowed.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}
          </select>
          <span className="mt-1 block text-xs text-slate-400">{dealer.background.mode==='video'?'Bakgrunden loopas under spelet.':'Bakgrundsbild under spelet.'}</span>
        </label>:null}
      </>}
    </fieldset>
    <p className="mt-5 border-t border-white/10 pt-4 text-sm text-slate-300" aria-live="polite">
      {dealer.label}{table?' · '+table.label:''}{background?' · '+background.label:''}
    </p>
    {error?<p role="alert" className="mt-3 text-sm text-amber-200">{error}</p>:null}
    <a href={launch.href} onClick={remember} onAuxClick={remember} className="mt-4 block rounded-lg bg-emerald-300 px-5 py-3 text-center font-semibold text-slate-950">
      {directPlay?'Spela med ':'Logga in och spela med '}{dealer.label}
    </a>
    <p className="mt-2 text-xs text-slate-400">Dealern börjar i grundloop när spelrummet öppnas.</p>
  </article>;
}

export function PlayerRoomCatalogue({catalog,stored={},directPlay}:{catalog:PublicOperatorRooms;stored?:Partial<RoomSelection>;directPlay:boolean}) {
  return catalog.rooms.length?<div className="mt-6 grid gap-5 lg:grid-cols-2">
    {catalog.rooms.map(room=><PlayerRoomCard key={catalog.operator.slug+':'+catalog.packageRevision+':'+room.id} catalog={catalog} room={room} stored={stored} directPlay={directPlay}/>)}
  </div>:<p role="status" className="mt-6 rounded-xl border border-white/15 p-5 text-slate-300">
    {catalog.operator.name} har inga öppna spelrum ännu.
  </p>;
}

type OperatorDirectoryState=OperatorCatalogueResult|{status:'loading'};
export function PlayerOperatorChooser({state,current,onChoose,onRetry}:{
  state:OperatorDirectoryState;current:Operator|null;onChoose:(slug:string)=>void;onRetry:()=>void;
}) {
  if(state.status==='loading')return <p role="status" className="mt-4 text-slate-300">Hämtar spelbolag…</p>;
  if(state.status==='unavailable')return <div className="mt-4"><p role="alert" className="text-amber-200">Spelbolagen kan inte hämtas just nu.</p>
    <button type="button" className="mt-3 rounded-lg border border-white/25 px-4 py-2" onClick={onRetry}>Hämta bolagen igen</button></div>;
  if(!state.operators.length)return <p role="status" className="mt-4 text-slate-300">Inga spelbolag har öppna spelrum ännu.</p>;
  return <label className="mt-4 block text-sm text-slate-200">Välj spelbolag
    <select className={selectClass} value={current?.slug??''} onChange={event=>onChoose(event.target.value)}>
      <option value="" disabled>Välj ett bolag för att se dess spelrum</option>
      {current&&!state.operators.some(row=>row.slug===current.slug)?<option value={current.slug}>{current.name}</option>:null}
      {state.operators.map(row=><option key={row.slug} value={row.slug}>{row.name}</option>)}
    </select>
  </label>;
}

export function PlayerLobbyOperator({initial,directPlay}:{
  initial:Operator|null;playHref:string;playLabel:string;directPlay:boolean;
}) {
  const [state,setState]=useState<CatalogueState>({status:initial?'loading':'unscoped',slug:initial?.slug??''});
  const [stored,setStored]=useState<Partial<RoomSelection>>({});
  const [retry,setRetry]=useState(0);
  const [directory,setDirectory]=useState<OperatorDirectoryState>({status:'loading'});
  useEffect(()=>{
    const controller=new AbortController();let active=true;
    setDirectory({status:'loading'});
    void loadOperatorCatalogue({signal:controller.signal}).then(result=>{if(active)setDirectory(result);});
    return()=>{active=false;controller.abort();};
  },[retry]);

  useEffect(()=>{
    let savedOperator:string|null=null;
    try{savedOperator=window.localStorage.getItem(OPERATOR_STORAGE_KEY);}catch{}
    const slug=operatorChoice({search:window.location.search,stored:savedOperator??initial?.slug??null});
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
    window.location.assign(clearedOperatorLocation(window.location.href));
  }
  const operator=state.status==='ready'?state.catalog.operator:initial?.slug===state.slug?initial:null;
  return <div className="mt-6">
    <PlayerOperatorChooser state={directory} current={operator} onChoose={chooseOperator} onRetry={()=>setRetry(value=>value+1)} />
    {operator?<p className="text-slate-200" data-operator>Spelar hos: <strong>{operator.name}</strong></p>:null}
    {state.slug?<button type="button" className="mt-2 text-sm text-slate-400 underline" onClick={clearOperator}>Visa alla bolag</button>:null}
    {state.status==='loading'?<p role="status" className="mt-6 text-slate-300">Hämtar publicerade spelrum…</p>:null}
    {state.status==='unscoped'?<p role="status" className="mt-6 rounded-xl border border-white/15 p-5 text-slate-300">Välj spelbolag ovan. Sedan väljer du ett publicerat rum, dealer och miljö.</p>:null}
    {state.status==='not-found'?<p role="status" className="mt-6 text-slate-300">Det här spelbolagets lobby är inte tillgänglig. Kontrollera länken från spelbolaget.</p>:null}
    {state.status==='unavailable'?<div className="mt-6"><p role="alert" className="text-amber-200">Spelrummen kan inte hämtas just nu. Försök igen om en stund.</p><button type="button" className="mt-3 rounded-lg border border-white/25 px-4 py-2" onClick={()=>setRetry(value=>value+1)}>Försök igen</button></div>:null}
    {state.status==='ready'?<PlayerRoomCatalogue catalog={state.catalog} stored={stored} directPlay={directPlay}/>:null}
  </div>;
}
