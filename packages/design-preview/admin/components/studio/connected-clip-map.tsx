"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Background, BackgroundVariant, Controls, ReactFlow, ReactFlowProvider, type Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ConnectedClipCard, type CardNode } from './connected-clip-card';
import { DealerIdentityPortrait } from './dealer-identity-portrait';
import { bindClip, clipSlots, clipsForSlot, configuredClipIds, createStudioClient, currentClipId, selectLayer, uploadMetadata, type ClipSlot, type Workspace } from '../../lib/connected-studio.mjs';
import { readIdleVideoDuration } from '../../../../../lab/lib/idle-video-duration.mjs';
import type { StudioProject } from '../../../../../lab/lib/studio-model.mjs';
import { replaceContext } from '../../../runtime/navigation';

const client = createStudioClient();
const nodeTypes = { registeredClip: ConnectedClipCard };
const button = 'rounded border border-sg-line px-3 py-2 text-xs disabled:opacity-40';
const input = 'min-w-0 rounded border border-sg-line bg-sg-panel p-2 text-xs';
const groups = ['idle', 'transition', 'deal', 'reveal', 'speak', 'turn', 'settle'];
const studioAliases = new Set(['/admin', '/admin/structure', '/admin/clips', '/admin/rooms', '/admin/dealers', '/admin/assets']);

function WorkspaceMap() {
  const [data, setData] = useState<Workspace|null>(null);
  const [base, setBase] = useState<StudioProject|null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [operatorId, setOperatorId] = useState(() => new URLSearchParams(location.search).get('operator') ?? '');
  const [roomId, setRoomId] = useState(() => new URLSearchParams(location.search).get('table') ?? '');
  const [dealerId, setDealerId] = useState(() => new URLSearchParams(location.search).get('dealer') ?? '');
  const [category, setCategory] = useState('all');
  const [panel, setPanel] = useState<'room'|'dealer'|'layers'|null>(null);
  const [selected, setSelected] = useState<Record<string,string>>({});
  const [variants, setVariants] = useState<Record<string,string>>({});
  const [pending, setPending] = useState<{file:File;slot:ClipSlot}|null>(null);
  const [localUrl, setLocalUrl] = useState('');
  const [compositing, setCompositing] = useState<'green-screen'|'opaque'>('green-screen');
  const activeRequest = useRef<AbortController|null>(null);
  const uploadDialog = useRef<HTMLDialogElement|null>(null);
  const busyRef = useRef(false);
  const dirty = Boolean(data && base && JSON.stringify(data.project) !== JSON.stringify(base));
  const registry = data?.catalog.administration;
  const operator = registry?.operators.find(row => row.id === operatorId) ?? registry?.operators[0];
  const rooms = registry?.rooms.filter(row => row.operatorId === operator?.id) ?? [];
  const room = rooms.find(row => row.id === roomId) ?? rooms[0];
  const dealers = data?.project.dealers ?? [];
  const dealer = dealers.find(row => row.id === dealerId) ?? dealers.find(row => row.id === room?.dealerIds[0]) ?? dealers[0];
  const lane = data?.project.lanes?.find(row => row.id === room?.compositionId);
  const slots = useMemo(() => data && dealer ? clipSlots(data.project, data.inventory, dealer.id) : [], [data, dealer]);
  const context = new URLSearchParams();
  if (operator) context.set('operator', operator.id);
  if (room) context.set('table', room.id);
  if (lane) context.set('composition', lane.id);
  if (dealer) context.set('dealer', dealer.id);

  const load = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setLoading(true); setError('');
    const controller = new AbortController(); activeRequest.current?.abort(); activeRequest.current = controller;
    try { const value = await client.load(controller.signal); if (controller.signal.aborted) return; setData(value); setBase(structuredClone(value.project)); setSelected({}); setVariants({}); setAuthorized(true); setNotice('Riktiga register och sparad revision inlästa.'); }
    catch (cause) { if (!controller.signal.aborted) { setAuthorized(false); setError(cause instanceof Error ? cause.message : 'Registret kunde inte läsas.'); } }
    finally { if (!controller.signal.aborted) { setLoading(false); busyRef.current = false; } }
  }, []);
  useEffect(() => { void load(); return () => { activeRequest.current?.abort(); busyRef.current = false; }; }, [load]);
  useEffect(() => {
    if (!pending) { setLocalUrl(''); return; }
    const url = URL.createObjectURL(pending.file); setLocalUrl(url); return () => URL.revokeObjectURL(url);
  }, [pending]);
  useEffect(() => { if (pending && uploadDialog.current && !uploadDialog.current.open) uploadDialog.current.showModal(); }, [pending]);
  useEffect(() => {
    if (!data || !dealer) return;
    const query = new URLSearchParams(location.search);
    ['operator','table','composition','dealer'].forEach(key => query.delete(key)); query.delete('lane');
    context.forEach((value,key) => query.set(key,value));
    replaceContext(`${location.pathname}?${query}`);
  }, [operator?.id, room?.id, lane?.id, dealer?.id]);
  useEffect(() => {
    const blocked = () => busyRef.current || dirty || Boolean(pending);
    const unload = (event:BeforeUnloadEvent) => { if (blocked()) { event.preventDefault(); event.returnValue = ''; } };
    const leave = (event:Event) => {
      const target = (event as CustomEvent<{href:string}>).detail?.href;
      if (target && studioAliases.has(new URL(target,location.origin).pathname)) return;
      if (busyRef.current || blocked() && !confirm('Det finns ett osparat Studio-utkast. Lämna sidan och kasta utkastet?')) event.preventDefault();
    };
    const click = (event:MouseEvent) => {
      const anchor = (event.target as Element)?.closest?.('a'); if (!anchor || event.defaultPrevented || !blocked()) return;
      if (new URL(anchor.href,location.origin).origin === location.origin && new URL(anchor.href).pathname.startsWith('/admin/') && !anchor.target) return;
      if (busyRef.current || !confirm('Det finns ett osparat Studio-utkast. Lämna sidan och kasta utkastet?')) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener('beforeunload',unload); window.addEventListener('scout:navigate',leave); document.addEventListener('click',click,true);
    return () => { window.removeEventListener('beforeunload',unload); window.removeEventListener('scout:navigate',leave); document.removeEventListener('click',click,true); };
  }, [dirty,pending]);

  async function work(action:(signal:AbortSignal)=>Promise<void>) {
    if (busyRef.current || !authorized) return;
    busyRef.current = true; setBusy(true); setError(''); setNotice('');
    const controller = new AbortController(); activeRequest.current = controller;
    try { await action(controller.signal); }
    catch (cause) { if (!controller.signal.aborted) { if ([401,403].includes((cause as {statusCode?:number})?.statusCode??0)) setAuthorized(false); setError(cause instanceof Error ? cause.message : 'Åtgärden misslyckades. Utkastet finns kvar.'); } }
    finally { busyRef.current = false; setBusy(false); }
  }
  function edit(project:StudioProject) { setData(current => current && ({...current,project})); setError(''); setNotice('Ändringen finns i utkastet. Spara när du har granskat berörda rum.'); }
  async function link(slot:ClipSlot, id:string) {
    if (!data || !dealer) return;
    await work(async signal => {
      const video = clipsForSlot(data.inventory,dealer.id,slot).find(row => row.id === id);
      const durationMs = slot.eventId === 'idle.ready' && video ? await readIdleVideoDuration(video.previewUrl,{signal}) : undefined;
      edit(bindClip(data.project,data.inventory,dealer.id,slot,id,{variantId:variants[slot.id],durationMs}));
    });
  }
  function stage(file:File,slot:ClipSlot) {
    if (busyRef.current || !authorized) return;
    if (slot.sourceType === 'speak') { setError('Taluppladdning är inte ansluten här ännu: den kräver exakt text, ljud, video och separat acceptans.'); return; }
    if (pending && !confirm('Byt ut den valda, ännu inte uppladdade videon?')) return;
    setPending({file,slot}); setCompositing('green-screen'); setError('');
  }
  async function upload() {
    if (!pending || !data || !dealer) return;
    const target = pending;
    await work(async signal => {
      const metadata = uploadMetadata(data.project,dealer.id,target.slot,target.file,compositing === 'green-screen'
        ? {mode:'green-screen',threshold:0.38,softness:0.12,despill:0.6} : {mode:'opaque'});
      const result = await client.upload(target.file,metadata,signal);
      setData(current => current && ({...current,inventory:result.inventory}));
      setSelected(current => ({...current,[target.slot.id]:result.video.id})); setPending(null);
      setNotice('Filen är registrerad och vald för förhandsvisning. Koppla den uttryckligen till utkastet.');
    });
  }
  async function save() {
    if (!data || !dirty) return;
    await work(async signal => {
      const saved = await client.save(data.project,signal);
      setData(current => current && ({...current,project:saved})); setBase(structuredClone(saved));
      setNotice('Utkastet är sparat med ny serverrevision. Rumspublicering hanteras separat.');
    });
  }
  function changeContext(action:()=>void) {
    if (busyRef.current) return;
    if (pending && !confirm('Kasta videovalet som ännu inte har laddats upp och byt kontext?')) return;
    setPending(null); setSelected({}); setVariants({}); action();
    if (dirty) setNotice('Det gemensamma projektutkastet är kvar, även för tidigare vald dealer och sammansättning.');
  }
  const nodes:CardNode[] = slots.filter(slot => category === 'all' || slot.sourceType === category).map((slot,index,all) => {
    const line = data!.project.lines.find(row => row.dealerId === dealer!.id && row.eventId === slot.eventId);
    const variantId = variants[slot.id] ?? line?.baselineVariantId ?? '';
    const clips = clipsForSlot(data!.inventory,dealer!.id,slot);
    const boundId = currentClipId(data!.project,dealer!.id,slot,variantId);
    const selectedId = selected[slot.id] ?? (clips.some(row => row.id === boundId) ? boundId : '');
    const column = Math.max(0,groups.indexOf(slot.sourceType));
    return {id:slot.id,type:'registeredClip',position:{x:column*340,y:all.slice(0,index).filter(row => row.sourceType === slot.sourceType).length*570},
      data:{slot,clips,boundId,boundIds:configuredClipIds(data!.project,dealer!.id,slot,variantId),selectedId,busy:busy||loading||!authorized,variantId,variants:slot.family ? [] : line?.variants.map(row=>({id:row.id,label:row.label})) ?? [],
        onSelect:id=>setSelected(current=>({...current,[slot.id]:id})),onVariant:id=>{setVariants(current=>({...current,[slot.id]:id}));setSelected(current=>({...current,[slot.id]:''}));},
        onBind:()=>{void link(slot,selectedId);},onFile:file=>stage(file,slot)}};
  });
  const mainRow = nodes.filter(node=>node.position.y===0).sort((a,b)=>a.position.x-b.position.x);
  const edges:Edge[] = mainRow.slice(1).map((node,index)=>({id:`group-${node.id}`,source:mainRow[index].id,target:node.id,type:'smoothstep',style:{stroke:'#3ad6c4'},selectable:false}));
  const impacts = registry?.rooms.filter(row => row.dealerIds.includes(dealer?.id ?? '') || row.compositionId === lane?.id) ?? [];
  return <section className="flex min-h-0 flex-1 flex-col" aria-label="Central Studio">
    <header className="space-y-3 border-b border-sg-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-lg font-semibold">Klippkarta</h1><p className="mt-1 text-xs text-sg-muted">Dealerbank och rumssammansättning · riktiga register</p></div>
        <div className="flex flex-wrap items-center gap-2"><span className={`text-xs ${dirty ? 'text-sg-amber':'text-sg-lime'}`}>{dirty ? 'Osparat utkast':'Sparad revision'}</span>
          <button className={button} disabled={busy||loading||!authorized||!dirty||Boolean(pending)} onClick={()=>{void save();}}>Spara utkast</button>
          <button className={button} disabled={busy||loading} onClick={()=>{if ((dirty||pending)&&!confirm('Kasta utkastet och läs om serverns revision?'))return;setPending(null);void load();}}>Läs om register</button></div></div>
      {registry && <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex min-w-0 flex-col gap-1 text-xs">Spelbolag<select className={input} value={operator?.id??''} disabled={busy||loading} onChange={event=>changeContext(()=>{setOperatorId(event.target.value);setRoomId('');setDealerId('');})}>{registry.operators.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
        <label className="flex min-w-0 flex-col gap-1 text-xs">Spelrum<select className={input} value={room?.id??''} disabled={busy||loading} onChange={event=>changeContext(()=>{setRoomId(event.target.value);setDealerId('');})}>{rooms.length?rooms.map(row=><option key={row.id} value={row.id}>{row.name} · {row.game}</option>):<option value="">Inga registrerade rum</option>}</select></label>
        <label className="flex min-w-0 flex-col gap-1 text-xs">Dealerbank<select className={input} value={dealer?.id??''} disabled={busy||loading} onChange={event=>changeContext(()=>setDealerId(event.target.value))}>{dealers.map(row=><option key={row.id} value={row.id}>{row.label}{room?.dealerIds.includes(row.id)?' · i rummet':''}</option>)}</select></label>
      </div>}
      {data && <div className="flex flex-wrap gap-2"><button className={button} onClick={()=>setPanel(panel==='room'?null:'room')}>Rum & publicerad revision</button><button className={button} onClick={()=>setPanel(panel==='dealer'?null:'dealer')}>Dealer & användning</button><button className={button} onClick={()=>setPanel(panel==='layers'?null:'layers')}>Bord, bakgrund & sammansättning</button><select aria-label="Klippgrupp" className={input} value={category} onChange={event=>setCategory(event.target.value)}><option value="all">Alla kortplatser</option>{groups.map(group=><option key={group} value={group}>{group}</option>)}</select></div>}
      {loading&&<p role="status" className="text-xs">Läser riktiga register…</p>}{error&&<p role="alert" className="text-sm text-sg-red">{error} {!data&&<button className={button} onClick={()=>{void load();}}>Försök igen</button>}</p>}{notice&&<p role="status" className="text-xs text-sg-teal">{notice}</p>}
      {dirty&&<p className="text-xs text-sg-amber">Granska påverkan: klipp hör till dealerbanken och kan användas av flera rum. Spara uppdaterar det befintliga projektutkastet; publicerade rum behåller sin frysta version.</p>}
    </header>
    {panel&&data&&<aside className="space-y-3 border-b border-sg-line bg-sg-panel p-4 text-xs" aria-label="Kontextpanel">
      {panel==='room'&&<><p>{room ? `${room.name} · ${room.game} · ${room.state} · ${room.published?'publicerad':'ej publicerad'} · ${room.playable?'spelbar':'ej spelbar'}`:'Bolaget har inga registrerade rum.'}</p><p>Publicerad bolagsrevision: {operator?.packageRevision??'saknas'} · Sparad projektrevision: {data.project.revision}</p><p>Rummets dealers: {room?.dealers.map(row=>row.name).join(', ')||'saknas'}</p><p>Dealerbyte och rumspublicering kräver separat samordning.</p></>}
      {panel==='dealer'&&<><div className="flex items-center gap-4">{dealer&&<DealerIdentityPortrait dealer={dealer} className="h-28 w-28 shrink-0"/>}<p>{dealer?.label} · {room?.dealerIds.includes(dealer?.id??'')?'tillåten i valt rum':'dealerbanken är vald utanför detta rum; inget dealerbyte utförs'}</p></div><p>Berörda rum/sammansättningar: {impacts.map(row=>`${row.name} (${row.game})`).join(', ')||'inga registrerade kopplingar'}</p><p>Grundloopens kort visar den gemensamma basfilmen. Exakt text, ljud och video för talmedia behöver en separat godkänd uppsättning.</p></>}
      {panel==='layers'&&<><p>{lane?.label??'Rummets sparade sammansättning saknas.'} · Mobil och desktop använder samma dealerbank; deras kompositioner sparas separat i sammansättningen.</p>
        <div className="flex flex-wrap gap-4">{(['background','table'] as const).map(role=><label key={role} className="flex flex-col gap-1">{role==='background'?'Bakgrund':'Bord'}<select aria-label={role==='background'?'Bakgrund':'Bord'} className={input} value={lane?.layers[role].default??''} disabled={busy||loading||!authorized||!room||!lane?.layers[role].enabled||role==='table'&&room.game!=='blackjack'} onChange={event=>{try{edit(selectLayer(data.project,room!,role,event.target.value));}catch(cause){setError((cause as Error).message);}}}>{lane?.layers[role].allowed.length?lane.layers[role].allowed.map(id=><option key={id} value={id}>{data.project.layerAssets?.find(row=>row.id===id)?.label??id}</option>):<option value="">Inget lager valt</option>}</select></label>)}</div>
        {room?.game==='roulette'&&<p>Roulettens bord ändras efter separat designunderlag.</p>}<p>Valen gäller registrerade tillåtna lager i utkastet. Biblioteksuppladdning och kompositionernas mobil/desktopjustering är ännu inte anslutna till denna panel. Publicerat utseende följer rummets bolagsrevision.</p></>}
    </aside>}
    {data&&dealer&&<div className="min-h-[560px] flex-1"><ReactFlow key={`${dealer.id}:${category}`} defaultViewport={{x:20,y:20,zoom:0.72}} nodes={nodes} edges={edges} nodeTypes={nodeTypes} nodesDraggable={false} nodesConnectable={false} edgesReconnectable={false} minZoom={0.12} maxZoom={1.5} colorMode="dark" proOptions={{hideAttribution:true}}><Background variant={BackgroundVariant.Dots} gap={22} color="#33363b"/><Controls showInteractive={false}/></ReactFlow></div>}
    {pending&&<dialog ref={uploadDialog} onCancel={event=>{event.preventDefault();if(!busyRef.current)setPending(null);}} aria-labelledby="upload-heading" className="w-full max-w-md space-y-4 rounded-lg border border-sg-line bg-sg-panel p-5"><h2 id="upload-heading" className="font-semibold">Registrera video i kortplats</h2><p className="text-xs">{dealer?.label} · {pending.slot.title} · {pending.slot.situation||'standard'} · {pending.file.name}</p>{localUrl&&<video src={localUrl} controls muted playsInline className="max-h-52 w-full object-contain"/>}<label className="flex flex-col gap-1 text-xs">Bakgrund i filen<select className={input} disabled={busy} value={compositing} onChange={event=>setCompositing(event.target.value as typeof compositing)}><option value="green-screen">Grön skärm</option><option value="opaque">Inbakad bakgrund</option></select></label><p className="text-xs text-sg-muted">Filen sparas i det befintliga privata registret. Koppling och rumspublicering är separata steg.</p>{error&&<p role="alert" className="text-xs text-sg-red">{error}</p>}<div className="flex gap-2"><button className={button} disabled={busy||loading||!authorized} onClick={()=>{void upload();}}>{busy?'Registrerar…':'Ladda upp till registret'}</button><button className={button} disabled={busy} onClick={()=>setPending(null)}>Avbryt videoval</button></div></dialog>}
  </section>;
}
export function ConnectedClipMap() { return <ReactFlowProvider><WorkspaceMap/></ReactFlowProvider>; }
