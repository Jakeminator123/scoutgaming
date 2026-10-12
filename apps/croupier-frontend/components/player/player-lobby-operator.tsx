'use client';

import {useEffect,useState,type CSSProperties,type MouseEvent} from 'react';
import {OPERATOR_STORAGE_KEY,operatorChoice} from '@/lib/player-operator.mjs';
import {readChoices} from '@/lib/player-choices.mjs';
import {loadOperatorCatalogue,loadRoomCatalogue,rememberRoomSelection,roomLaunch,roomSelection,type RoomSelection,type OperatorCatalogueResult} from '@/lib/player-lobby.mjs';
import {dealerPortrait,loadRoomPreview,type RoomPreviewResult} from '@/lib/player-room-preview.mjs';
import {PlayerRoomPreview,PreviewImage,EnvironmentChoices,SelectedMark,StepHeading,choiceLabel} from './player-room-preview';
import type {PublicOperatorRooms,PublicOperatorRoom} from '../../../../web/public/operator-rooms-contract.mjs';

type Operator={slug:string;name:string};
type CatalogueState={status:'loading'|'unscoped'|'not-found'|'unavailable';slug:string}|{status:'ready';slug:string;catalog:PublicOperatorRooms};
const inputClass='mt-2 block min-h-12 w-full rounded-xl border border-white/15 bg-[#121417] px-4 py-3 text-sm text-white placeholder:text-white/30 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lime';
const focusClass='focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lime';
const kickerClass='font-mono text-[11px] uppercase tracking-[0.18em] text-lime';
const quietButton='inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/20 px-4 py-2 text-sm text-white/80 transition-colors hover:border-lime/60 hover:text-off '+focusClass;
const monogramClass='grid shrink-0 place-items-center border border-lime/30 bg-gradient-to-br from-lime/15 to-transparent font-semibold tracking-tight text-lime';

export function monogram(name:string){
  const words=name.trim().split(/\s+/).filter(Boolean);
  if(/^[\p{Lu}\d]{2,3}$/u.test(words[0]??''))return words[0];
  return words.slice(0,2).map(word=>Array.from(word)[0]).join('').toLocaleUpperCase('sv')||'··';
}

function DealerStack({dealers}:{dealers:PublicOperatorRoom['dealers']}) {
  const shown=dealers.slice(0,3),extra=dealers.length-shown.length;
  return <span aria-hidden="true" className="flex shrink-0 -space-x-2.5">
    {shown.map(row=>{const portrait=dealerPortrait(row.id);return portrait
      ?<PreviewImage key={row.id} portrait={portrait} label={row.label} className="h-10 w-10 rounded-full object-cover object-top ring-2 ring-[#0d0f11]"/>
      :<span key={row.id} className="grid h-10 w-10 place-items-center rounded-full bg-[#1b1f22] text-sm font-medium text-white/70 ring-2 ring-[#0d0f11]">{Array.from(row.label)[0]?.toLocaleUpperCase('sv')}</span>;})}
    {extra>0?<span className="grid h-10 w-10 place-items-center rounded-full bg-[#1b1f22] font-mono text-[11px] text-white/60 ring-2 ring-[#0d0f11]">+{extra}</span>:null}
  </span>;
}

// Image-led studio layout; choices and launch always come from the published room.
export function PlayerRoomCard({catalog,room,stored,directPlay}:{catalog:PublicOperatorRooms;room:PublicOperatorRoom;stored:Partial<RoomSelection>;directPlay:boolean}) {
  const [selected,setSelected]=useState(()=>roomSelection(room,stored));
  const [error,setError]=useState('');
  const [launching,setLaunching]=useState(false);
  const [previews,setPreviews]=useState<Record<string,RoomPreviewResult>>({});
  useEffect(()=>{
    const controller=new AbortController();let active=true;const pending=[...room.dealers];
    // Four bounded readers. Cards never discover dealers outside this room.
    async function worker(){while(active&&pending.length){const row=pending.shift()!;const result=await loadRoomPreview(catalog,room,row.id,{signal:controller.signal});if(active)setPreviews(current=>({...current,[row.id]:result}));}}
    void Promise.all(Array.from({length:Math.min(4,pending.length)},worker));
    return()=>{active=false;controller.abort();};
  },[catalog,room]);
  useEffect(()=>{
    if(!launching)return;
    // Back/forward cache restores this page as it was left; a stalled navigation must not keep it covered.
    const restore=(event:PageTransitionEvent)=>{if(event.persisted)setLaunching(false);};
    const timer=window.setTimeout(()=>setLaunching(false),8000);
    window.addEventListener('pageshow',restore);
    return()=>{window.clearTimeout(timer);window.removeEventListener('pageshow',restore);};
  },[launching]);
  if(!selected)return null;
  const dealer=room.dealers.find(row=>row.id===selected.dealer)!;
  const launch=roomLaunch(catalog,room.id,selected,{directPlay});
  if(!launch)return null;
  function choose(patch:Partial<RoomSelection>){setSelected(current=>roomSelection(room,{...current,...patch}));setError('');}
  function remember(event:MouseEvent<HTMLAnchorElement>) {
    let saved:boolean;
    try {saved=rememberRoomSelection(window.localStorage,catalog.operator.slug,launch!.choices);}
    catch {saved=!launch!.choices.tableAsset&&!launch!.choices.background;}
    if(!saved){event.preventDefault();setError('Dina miljöval kunde inte sparas. Tillåt lokal lagring i webbläsaren och försök igen.');return;}
    if(event.type==='click'&&event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey)setLaunching(true);
  }
  const current=previews[dealer.id];const preview=current?.status==='ready'?current.preview:null;
  const showBackground=dealer.independentLayers&&dealer.background.enabled&&dealer.background.allowed.length>0;
  const showTable=dealer.independentLayers&&dealer.table.enabled&&dealer.table.allowed.length>0;
  const environment=[
    showBackground&&selected.background?choiceLabel(dealer.background.allowed.find(row=>row.id===selected.background)?.label??'','Vald bakgrund'):null,
    showTable&&selected.tableAsset?choiceLabel(dealer.table.allowed.find(row=>row.id===selected.tableAsset)?.label??'','Valt bord'):null,
  ].filter(Boolean).join(' · ');
  return <article className="mt-6 overflow-clip rounded-[28px] border border-white/10 bg-[#0d0f11] shadow-[0_40px_120px_-40px_rgba(0,0,0,.9)] lg:grid lg:grid-cols-[minmax(0,1.08fr)_minmax(380px,.92fr)]" aria-labelledby={room.id+'-title'}>
    <PlayerRoomPreview key={dealer.id} result={current} dealerId={dealer.id} dealerLabel={dealer.label} roomName={room.name} game={room.game} operatorName={catalog.operator.name} tableAsset={selected.tableAsset} background={selected.background}/>
    <div className="flex min-w-0 flex-col border-t border-white/10 lg:border-l lg:border-t-0">
      <header className="border-b border-white/10 px-5 pb-6 pt-7 sm:px-8 sm:pt-9">
        <p className={kickerClass}><span aria-hidden="true">{'// '}</span>Spelrum · {catalog.operator.name}</p>
        <h3 id={room.id+'-title'} className="mt-3 break-words text-3xl font-medium leading-[1.05] tracking-[-0.03em] sm:text-4xl">{room.name}</h3>
        <p className="mt-4 text-xs text-white/55">Förhandsvisningen följer dina val.</p>
      </header>
      <div className="flex-1 divide-y divide-white/10 px-5 sm:px-8">
        <fieldset className="py-7"><legend className="float-left w-full"><StepHeading step="01" title="Dealer" value={dealer.label}/></legend>
          <p className="clear-both pt-2 text-sm text-white/45">Värden vid ditt bord. Spelbolaget bestämmer vilka dealers rummet har.</p>
          <div className={'mt-4 grid gap-3 '+(room.dealers.length>2?'grid-cols-2 sm:grid-cols-3':'grid-cols-2')} role="radiogroup" aria-label="Dealer">
            {room.dealers.map(row=>{const data=previews[row.id],active=row.id===selected.dealer;return <label key={row.id} className={'group relative min-w-0 cursor-pointer overflow-hidden rounded-2xl border transition-[border-color,background-color,box-shadow] duration-200 focus-within:outline-2 focus-within:outline-offset-4 focus-within:outline-lime '+(active?'border-lime bg-lime/[.06] shadow-[0_0_0_1px_var(--color-lime)]':'border-white/10 bg-white/[.03] hover:border-white/30')}>
              <PreviewImage key={data?.status==='ready'?data.preview.media.dealer?.src??row.id:row.id} portrait={dealerPortrait(row.id)} media={data?.status==='ready'?data.preview.media.dealer:null} label={row.label} className="aspect-[4/3.4] w-full object-cover object-top transition-transform duration-500 motion-safe:group-hover:scale-[1.03]"/>
              {active?<SelectedMark/>:null}
              <span className="flex min-h-16 items-center gap-2 p-3.5"><span className="min-w-0"><span className="block break-words text-base font-medium tracking-tight">{row.label}</span><span className="mt-0.5 block text-[11px] text-white/45">{row.independentLayers?'Valbar bordsmiljö':'Egen bordsmiljö'}</span></span><input type="radio" name={room.id+'-dealer'} value={row.id} checked={active} onChange={()=>choose({dealer:row.id})} className="sr-only"/></span>
            </label>})}
          </div>
        </fieldset>
        {!dealer.independentLayers?<p className="py-7 text-sm leading-relaxed text-white/55">Bord och bakgrund ingår i {dealer.label}s dealerfilm.</p>:<>
          {showBackground?<EnvironmentChoices step="02" legend="Bakgrund" name={room.id+'-background'} items={dealer.background.allowed} media={preview?.media.backgrounds} selected={selected.background} allowEmpty={dealer.background.default===null} onChange={id=>choose({background:id})}/>:null}
          {showTable?<EnvironmentChoices step={showBackground?'03':'02'} legend="Bordets utseende" name={room.id+'-table'} items={dealer.table.allowed} media={preview?.media.tables} selected={selected.tableAsset} allowEmpty={dealer.table.default===null} onChange={id=>choose({tableAsset:id})}/>:null}
          {!dealer.table.allowed.length&&!dealer.background.allowed.length?<p className="py-7 text-sm text-white/55">Bolagets valda miljö används i det här rummet.</p>:null}
        </>}
      </div>
      <div className="sticky bottom-0 z-10 border-t border-white/10 bg-[#0d0f11]/90 px-5 py-5 backdrop-blur-md sm:px-8">
        {error?<p role="alert" className="mb-3 text-sm text-amber-200">{error}</p>:null}
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <p className="min-w-0 flex-1 basis-48 text-xs leading-relaxed text-white/45">Dina val följer med när bordet öppnas.<br/><span className="font-mono text-[10px] uppercase tracking-[.16em] text-white/35">Demo utan riktiga pengar</span></p>
          <a href={launch.href} onClick={remember} onAuxClick={remember} className={'inline-flex min-h-13 w-full items-center justify-between gap-4 rounded-xl bg-lime px-6 py-3.5 text-base font-semibold text-ink transition-[background-color,box-shadow,transform] hover:bg-[#e3ff70] hover:shadow-[0_10px_30px_rgba(214,255,58,.2)] motion-safe:hover:-translate-y-px sm:w-auto '+focusClass}><span>{directPlay?'Spela med ':'Logga in och spela med '}{dealer.label}</span><span aria-hidden="true">↗</span></a>
        </div>
      </div>
    </div>
    {launching?<div role="status" aria-live="polite" className="fixed inset-0 z-50 grid place-items-center bg-ink/90 px-6 backdrop-blur-md">
      <div className="flex max-w-sm flex-col items-center gap-5 text-center">
        <span className="relative grid h-24 w-24 place-items-center"><span aria-hidden="true" className="absolute inset-0 rounded-full border-2 border-white/10 border-t-lime motion-safe:animate-spin"/><span aria-hidden="true" className="text-3xl font-semibold text-lime">/</span></span>
        <p className={kickerClass}>{catalog.operator.name}</p>
        <p className="text-3xl font-medium tracking-[-0.03em]">Öppnar ditt bord</p>
        <dl className="w-full divide-y divide-white/10 border-y border-white/10 text-left text-sm">
          {[['Dealer',dealer.label],['Spelrum',room.name],['Miljö',dealer.independentLayers?environment||'Bolagets val':'Dealerfilmens egen']].map(([label,value],index)=><div key={label} className="animate-rise flex justify-between gap-6 py-2.5" style={{'--delay':(index*120)+'ms'} as CSSProperties}><dt className="font-mono text-[11px] uppercase tracking-[.16em] text-white/40">{label}</dt><dd className="min-w-0 truncate font-medium">{value}</dd></div>)}
        </dl>
      </div>
    </div>:null}
  </article>;
}

export function PlayerRoomCatalogue({catalog,stored={},directPlay}:{catalog:PublicOperatorRooms;stored?:Partial<RoomSelection>;directPlay:boolean}) {
  const [roomId,setRoomId]=useState(catalog.rooms[0]?.id??'');
  const room=catalog.rooms.find(row=>row.id===roomId)??catalog.rooms[0];
  if(!room)return <div role="status" className="mt-10 rounded-3xl border border-dashed border-white/15 bg-white/[.02] px-6 py-12 text-center">
    <p className="text-xl font-medium tracking-tight">{catalog.operator.name} har inga öppna spelrum ännu.</p>
    <p className="mt-2 text-sm text-white/50">Välkommen tillbaka snart.</p>
  </div>;
  return <section className="mt-10" aria-label="Spelrum">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className={kickerClass}><span aria-hidden="true">{'// '}</span>02 · Spelrum</p><h2 className="mt-2 text-3xl font-medium tracking-[-0.03em] text-off sm:text-4xl">Välj din plats vid bordet.</h2></div>
      <span className="font-mono text-[11px] uppercase tracking-[.16em] text-white/45">{catalog.rooms.length} spelrum</span>
    </div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {catalog.rooms.map(row=>{const active=row.id===room.id;return <button key={row.id} type="button" aria-pressed={active} onClick={()=>setRoomId(row.id)}
        className={'group flex min-w-0 items-center gap-4 rounded-2xl border p-4 text-left transition-[border-color,background-color,box-shadow] duration-200 '+focusClass+(active?' border-lime/70 bg-lime/[.06] shadow-[0_0_0_1px_rgba(214,255,58,.35)]':' border-white/10 bg-white/[.025] hover:border-white/30 hover:bg-white/[.04]')}>
        <DealerStack dealers={row.dealers}/>
        <span className="min-w-0 flex-1"><span className="block break-words text-base font-medium text-off">{row.name}</span><span className="mt-1 block text-xs text-white/50">{row.game==='roulette'?'Roulette':'Blackjack'} · {row.dealers.length} {row.dealers.length===1?'dealer':'dealers'} att välja bland</span></span>
        <span aria-hidden="true" className={'grid h-8 w-8 shrink-0 place-items-center rounded-full border text-sm transition-colors '+(active?'border-lime bg-lime text-ink':'border-white/15 text-white/50 group-hover:border-white/40 group-hover:text-off')}>{active?'✓':'↗'}</span>
      </button>;})}
    </div>
    <PlayerRoomCard key={catalog.operator.slug+':'+catalog.packageRevision+':'+room.id} catalog={catalog} room={room} stored={stored} directPlay={directPlay}/>
  </section>;
}

type OperatorDirectoryState=OperatorCatalogueResult|{status:'loading'};
export function PlayerOperatorChooser({state,current,onChoose,onRetry,filter='',onFilter}:{
  state:OperatorDirectoryState;current:Operator|null;onChoose:(slug:string)=>void;onRetry:()=>void;filter?:string;onFilter?:(value:string)=>void;
}) {
  if(state.status==='loading')return <div role="status" className="mt-10"><span className="sr-only">Hämtar spelbolag…</span>
    <div aria-hidden="true" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0,1,2].map(index=><div key={index} className="h-[236px] rounded-3xl border border-white/10 bg-white/[.03] motion-safe:animate-pulse"/>)}</div>
  </div>;
  if(state.status==='unavailable')return <div className="mt-10 rounded-3xl border border-amber-200/20 bg-amber-200/[.04] p-6 sm:p-8"><p role="alert" className="text-amber-100">Spelbolagen kan inte hämtas just nu.</p>
    <button type="button" className={'mt-4 '+quietButton} onClick={onRetry}>Hämta bolagen igen</button></div>;
  if(!state.operators.length)return <p role="status" className="mt-10 rounded-3xl border border-dashed border-white/15 bg-white/[.02] px-6 py-12 text-center text-white/60">Inga spelbolag har öppna spelrum ännu. Välkommen tillbaka snart.</p>;
  const visible=state.operators.filter(row=>row.name.toLocaleLowerCase('sv').includes(filter.trim().toLocaleLowerCase('sv')));
  return <section aria-label="Välj spelbolag" className="mt-10">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className={kickerClass}><span aria-hidden="true">{'// '}</span>01 · Spelbolag</p><h2 className="mt-2 text-3xl font-medium tracking-[-0.03em] text-off sm:text-4xl">Var vill du spela?</h2><p className="mt-2 text-sm text-white/50">Varje bolag har sina egna spelrum, dealers och miljöer.</p></div>
      {state.operators.length>6&&onFilter?<label className="w-full text-xs text-white/60 sm:w-72">Sök spelbolag<input value={filter} onChange={event=>onFilter(event.target.value)} type="search" className={inputClass} placeholder="Bolagets namn" /></label>:null}
    </div>
    <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {visible.map((row,index)=><button key={row.slug} type="button" onClick={()=>onChoose(row.slug)}
        className={'group relative isolate flex min-h-[236px] min-w-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0f1113] p-6 text-left transition-[border-color,transform,box-shadow] duration-300 hover:border-lime/50 hover:shadow-[0_24px_60px_-30px_rgba(214,255,58,.35)] motion-safe:hover:-translate-y-0.5 '+focusClass}>
        <span aria-hidden="true" className="bg-grid absolute inset-0 -z-10 opacity-70 [mask-image:radial-gradient(ellipse_at_top_right,#000,transparent_70%)]"/>
        <span aria-hidden="true" className="absolute -right-20 -top-20 -z-10 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(214,255,58,.22),transparent_70%)] opacity-40 transition-opacity duration-300 group-hover:opacity-100"/>
        <span className="flex items-start justify-between"><span aria-hidden="true" className={'h-14 w-14 rounded-2xl text-lg '+monogramClass}>{monogram(row.name)}</span><span aria-hidden="true" className="font-mono text-xs text-white/30">{String(index+1).padStart(2,'0')}</span></span>
        <span className="mt-auto block break-words pt-8 text-2xl font-medium tracking-[-0.02em] text-off">{row.name}</span>
        <span className="mt-2 block text-sm text-white/50">Välj spelrum och dealer</span>
        <span className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 text-sm font-medium text-lime">Utforska spelrummen <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-full border border-lime/40 transition-colors group-hover:bg-lime group-hover:text-ink">↗</span></span>
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
  const steps=[
    {label:'Bolag',status:state.slug?'done':'current'},
    {label:'Spelrum',status:state.status==='ready'?'current':'todo'},
    {label:'Dealer & miljö',status:state.status==='ready'?'current':'todo'},
  ];
  return <div>
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 border-y border-white/10 py-4">
      <ol aria-label="Dina steg" className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        {steps.map((step,index)=><li key={step.label} className="flex items-center gap-3">
          {index?<span aria-hidden="true" className="hidden h-px w-8 bg-white/15 sm:block"/>:null}
          <span aria-hidden="true" className={'grid h-7 w-7 place-items-center rounded-full border font-mono text-[11px] '+(step.status==='done'?'border-lime bg-lime text-ink':step.status==='current'?'border-lime text-lime':'border-white/15 text-white/40')}>{step.status==='done'?'✓':'0'+(index+1)}</span>
          <span className={step.status==='todo'?'text-white/40':'text-off'}>{step.label}{step.status==='done'?<span className="sr-only"> (klart)</span>:null}</span>
        </li>)}
      </ol>
      {state.slug?<div className="flex w-full min-w-0 items-center gap-3 sm:w-auto sm:gap-4">
        <span aria-hidden="true" className={'h-11 w-11 rounded-xl text-sm '+monogramClass}>{operator?monogram(operator.name):'··'}</span>
        <p className="min-w-0 flex-1 text-sm text-white/60" data-operator>Spelar hos: <strong className="block truncate text-base font-medium text-off sm:inline">{operator?.name??(state.status==='loading'?'Hämtar bolag…':'Spelbolaget är inte tillgängligt')}</strong></p>
        <button type="button" className={'shrink-0 '+quietButton} onClick={clearOperator}>← Byt spelbolag</button>
      </div>:null}
    </div>
    {state.slug?null:<PlayerOperatorChooser state={directory} current={null} onChoose={chooseOperator} onRetry={()=>setRetry(value=>value+1)} filter={filter} onFilter={setFilter}/>}
    {state.status==='loading'?<div role="status" className="mt-10"><span className="sr-only">Hämtar publicerade spelrum…</span>
      <div aria-hidden="true" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[0,1,2].map(index=><div key={index} className="h-[74px] rounded-2xl border border-white/10 bg-white/[.03] motion-safe:animate-pulse"/>)}</div>
      <div aria-hidden="true" className="mt-6 h-[min(72svh,720px)] rounded-[28px] border border-white/10 bg-white/[.02] motion-safe:animate-pulse"/>
    </div>:null}
    {state.status==='not-found'?<p role="status" className="mt-10 rounded-3xl border border-dashed border-white/15 bg-white/[.02] px-6 py-10 text-white/60">Det här spelbolagets lobby är inte tillgänglig. Kontrollera länken från spelbolaget eller välj ett annat bolag.</p>:null}
    {state.status==='unavailable'?<div className="mt-10 rounded-3xl border border-amber-200/20 bg-amber-200/[.04] p-6 sm:p-8"><p role="alert" className="text-amber-100">Spelrummen kan inte hämtas just nu. Försök igen om en stund.</p><button type="button" className={'mt-4 '+quietButton} onClick={()=>setRetry(value=>value+1)}>Försök igen</button></div>:null}
    {state.status==='ready'?<PlayerRoomCatalogue key={state.catalog.operator.slug+':'+state.catalog.packageRevision} catalog={state.catalog} stored={stored} directPlay={directPlay}/>:null}
  </div>;
}
