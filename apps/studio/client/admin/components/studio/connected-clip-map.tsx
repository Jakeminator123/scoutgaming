"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Background, BackgroundVariant, ReactFlow, ReactFlowProvider, useReactFlow, useNodesState } from '@xyflow/react';
import { RotateCcw, Layers, Users, Volume2 } from 'lucide-react';
import '@xyflow/react/dist/style.css';
import { ConnectedClipCard, ConnectedClipDetails, type CardNode } from './connected-clip-card';
import { SavedScenePreview } from './saved-scene-preview';
import { DealerIdentityPortrait } from './dealer-identity-portrait';
import { bindClip, clipSlots, clipsForSlot, compositionUses, configuredClipIds, createStudioClient, currentClipId, navigationKeepsStudioTab, roomChoicesPath, uploadMetadata, type ClipSlot, type Workspace, type VideoInventory } from '../../lib/connected-studio.mjs';
import { readIdleVideoDuration } from '../../../../lib/idle-video-duration.mjs';
import type { StudioProject } from '../../../../../../packages/presentation/contracts/studio-model.mjs';
import { replaceContext, usePathname, useSearchParams } from '../../../runtime/navigation';
import {isInternalAdminPathname,isStudioAdminRoute} from '../../../runtime/admin-routing.mjs';
import { groupSlots, affectedRooms, slotCaption, layoutClipCards, clipLibraryForSlot, clipVariantChoices } from '../../lib/studio-layout.mjs';
import { StudioSpeechPanel } from './studio-speech-panel';
import { StudioLifecyclePanel } from './studio-lifecycle-panel';
import { studioClipUsage } from '../../lib/studio-policy.mjs';
import { StudioPolicyPanel } from './studio-policy-panel';
import { StudioCompositionPanel } from './studio-composition-panel';
import { RouletteStartEditor } from './roulette-start-editor';
import { RouletteIdleEditor } from './roulette-idle-editor';
import { registerCompositionLayer } from '../../../../lib/studio-composition.mjs';
import { rebaseProjectDraft } from '../../../../lib/project-rebase.mjs';
import { validateProject } from '../../../../../../packages/presentation/contracts/studio-model.mjs';
import {rouletteReferencePreview,unbindRouletteClip} from '../../lib/roulette-clip-map.mjs';
import { studioContext } from '../../lib/studio-context.mjs';
import {isActiveOperator} from '../../lib/studio-resource-lifecycle.mjs';

const client = createStudioClient();
const nodeTypes = { registeredClip: ConnectedClipCard };
const button = 'rounded border border-sg-line px-3 py-2 text-xs disabled:opacity-40';
const input = 'min-w-0 rounded border border-sg-line bg-sg-panel p-2 text-xs';

function WorkspaceMap({active=true,onDirtyChange,onRevisionChange,refreshKey=0}:{active?:boolean;onDirtyChange?:(dirty:boolean)=>void;onRevisionChange?:(revision:string)=>void;refreshKey?:number}) {
  // Accepted snapshots stay fixed while a rejected history move is restored.
  const path=usePathname(), search=useSearchParams().toString();
  const { setViewport, fitView, zoomIn, zoomOut } = useReactFlow();
  const [zoom,setZoom] = useState(1);
  const [activeGroupId,setActiveGroupId] = useState('');
  const canvasRef = useRef<HTMLDivElement|null>(null);
  const workspaceRef=useRef<HTMLElement|null>(null);
  const playingPreview=useRef<HTMLMediaElement|null>(null);
  const pausePreviews=useCallback(()=>{
    playingPreview.current?.pause();
    workspaceRef.current?.querySelectorAll<HTMLMediaElement>('video,audio').forEach(media=>media.pause());
    playingPreview.current=null;
  },[]);
  useEffect(()=>{
    if(!active)pausePreviews();
    const hidden=()=>{if(document.hidden)pausePreviews();};
    document.addEventListener('visibilitychange',hidden);
    return()=>{document.removeEventListener('visibilitychange',hidden);pausePreviews();};
  },[active,pausePreviews]);
  const [canvasWidth,setCanvasWidth] = useState(1200);
  const [positions,setPositions] = useState<Record<string,{x:number;y:number}>>({});
  const [flowNodes,setFlowNodes,onFlowNodesChange] = useNodesState<CardNode>([]);
  const [data, setData] = useState<Workspace|null>(null);
  const [base, setBase] = useState<StudioProject|null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [childBusy, setChildBusy] = useState(false);
  const [materialReload,setMaterialReload]=useState(false);
  const [speechDirty, setConfigDirty] = useState(false);
  const [startDirty,setStartDirty]=useState(false);
  const [startVideoId,setStartVideoId]=useState('');
  const [startVariantId,setStartVariantId]=useState('');
  const [panelEpoch,setPanelEpoch]=useState(0);
  const configDirty=speechDirty||startDirty;
  const locked = busy || childBusy;
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [operatorId, setOperatorId] = useState(() => new URLSearchParams(location.search).get('operator') ?? '');
  const [roomId, setRoomId] = useState(() => new URLSearchParams(location.search).get('table') ?? '');
  const [compositionId,setCompositionId]=useState(()=>new URLSearchParams(location.search).get('composition')??new URLSearchParams(location.search).get('lane')??'');
  const [dealerId, setDealerId] = useState(() => new URLSearchParams(location.search).get('dealer') ?? '');
  const [game, setGame] = useState<'blackjack'|'roulette'>(()=>new URLSearchParams(location.search).get('game')==='roulette'?'roulette':'blackjack');
  const [gameExplicit,setGameExplicit]=useState(()=>['blackjack','roulette'].includes(new URLSearchParams(location.search).get('game')??''));
  const [panel, setPanel] = useState<'scene'|'clip'|'room'|'dealer'|'layers'|'policy'|'roulette-start'|'roulette-media'|null>(()=>new URLSearchParams(location.search).get('panel')==='layers'?'layers':null);
  const panelHeading=useRef<HTMLHeadingElement|null>(null);
  useEffect(()=>{if(panel)panelHeading.current?.focus({preventScroll:true});},[panel,activeGroupId]);
  useEffect(()=>()=>pausePreviews(),[panel,activeGroupId,pausePreviews]);
  const [speechDealer,setSpeechDealer]=useState('');
  const [previewCompositionId,setPreviewCompositionId]=useState(()=>new URLSearchParams(location.search).get('composition')??new URLSearchParams(location.search).get('lane')??'');
  const [settingsSlot, setSettingsSlot] = useState<ClipSlot|null>(null);
  const [selected, setSelected] = useState<Record<string,string>>({});
  const [variants, setVariants] = useState<Record<string,string>>({});
  const [cardSlots, setCardSlots] = useState<Record<string,string>>({});
  const [pending, setPending] = useState<{file:File;slot:ClipSlot}|null>(null);
  useEffect(()=>()=>pausePreviews(),[pending,pausePreviews]);
  const [reviewSave, setReviewSave] = useState(false);
  const [conflictPaths, setConflictPaths] = useState<string[]>([]);
  const [revisionConflict, setRevisionConflict] = useState(false);
  const [localUrl, setLocalUrl] = useState('');
  const [localReference,setLocalReference]=useState<{dealerId:string;file:File}|null>(null);
  const [referenceUrl,setReferenceUrl]=useState('');
  const [compositing, setCompositing] = useState<'green-screen'|'opaque'|'alpha'>('green-screen');
  const activeRequest = useRef<AbortController|null>(null);
  const uploadDialog = useRef<HTMLDialogElement|null>(null);
  const busyRef = useRef(false);
  const observedRefresh=useRef(refreshKey);
  const childOperation = useCallback((value:boolean)=>{busyRef.current=value;setChildBusy(value);},[]);
  const dirty = Boolean(data && base && JSON.stringify(data.project) !== JSON.stringify(base));
  useEffect(()=>{onDirtyChange?.(dirty||configDirty||Boolean(pending)||locked);},[dirty,configDirty,pending,locked,onDirtyChange]);
  useEffect(()=>{if(base)onRevisionChange?.(base.revision);},[base?.revision,onRevisionChange]);
  const registry = data?.catalog.administration;
  const requestedRoom=registry?.rooms.find(row=>row.id===roomId&&(!operatorId||row.operatorId===operatorId));
  const resolved=data?studioContext(data.catalog,data.project,{operatorId,game:requestedRoom?.game??game,roomId,compositionId,dealerId,library:true}):null;
  const {operator,room,lane,dealer}=resolved??{};
  // A suggested voice must not create a dirty form before the user opens it.
  useEffect(()=>{if(panel==='room'&&dealer)setSpeechDealer(dealer.id);},[panel,dealer?.id]);
  const roomChoices = roomChoicesPath(operator,room);
  const rooms=resolved?.rooms??[],dealers=resolved?.dealers??[];
  useEffect(()=>{if(!gameExplicit&&room&&['blackjack','roulette'].includes(room.game))setGame(room.game as 'blackjack'|'roulette');},[room?.id,room?.game,gameExplicit]);
  useEffect(()=>{if(!canvasRef.current)return;const observer=new ResizeObserver(entries=>setCanvasWidth(entries[0].contentRect.width));observer.observe(canvasRef.current);return()=>observer.disconnect();},[Boolean(data),dealer?.id]);
  const slots = useMemo(() => data && dealer ? clipSlots(data.project, data.inventory, dealer.id,game) : [], [data, dealer,game]);
  const rouletteReference=data&&dealer&&game==='roulette'?rouletteReferencePreview(data.inventory,dealer.id):null;
  const localVilaUrl=game==='roulette'&&localReference?.dealerId===dealer?.id?referenceUrl:'';
  const context = new URLSearchParams();
  if (operator) context.set('operator', operator.id);
  if (room) context.set('table', room.id);
  if (compositionId) context.set('composition', compositionId);
  else if (lane) context.set('composition', lane.id);
  if (dealer) context.set('dealer', dealer.id);
  context.set('game',game);

  const load = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setLoading(true); setError('');
    const controller = new AbortController(); activeRequest.current?.abort(); activeRequest.current = controller;
    try { const value = await client.load(controller.signal); if (controller.signal.aborted) return; setData(value); setBase(structuredClone(value.project)); setSelected({}); setVariants({}); setAuthorized(true); setConflictPaths([]);setRevisionConflict(false); setNotice('Register och sparad revision inlästa.'); }
    catch (cause) { if (!controller.signal.aborted) { setAuthorized(false); setError(cause instanceof Error ? cause.message : 'Registret kunde inte läsas.'); } }
    finally { if (!controller.signal.aborted) { setLoading(false); busyRef.current = false; } }
  }, []);
  useEffect(() => { void load(); return () => { activeRequest.current?.abort(); busyRef.current = false; }; }, [load]);
  useEffect(()=>{
    if(observedRefresh.current===refreshKey)return;observedRefresh.current=refreshKey;
    if(dirty||configDirty||pending||busyRef.current){setRevisionConflict(true);setNotice('Registret har ändrats. Ditt utkast är kvar; jämför senaste revisionen innan du fortsätter.');return;}
    void load();
  },[refreshKey,dirty,configDirty,pending,load]);
  useEffect(()=>{if(materialReload&&!locked){setMaterialReload(false);void load();}},[materialReload,locked,load]);
  useEffect(() => {
    if (!pending) { setLocalUrl(''); return; }
    const url = URL.createObjectURL(pending.file); setLocalUrl(url); return () => URL.revokeObjectURL(url);
  }, [pending]);
  useEffect(()=>{if(!localReference){setReferenceUrl('');return;}const url=URL.createObjectURL(localReference.file);setReferenceUrl(url);return()=>URL.revokeObjectURL(url);},[localReference]);
  useEffect(() => { if (pending && uploadDialog.current && !uploadDialog.current.open) uploadDialog.current.showModal(); }, [pending]);
  useEffect(() => {
    if (!data || !dealer || !isStudioAdminRoute(path,search) || new URLSearchParams(search).get('tool')==='import') return;
    const query = new URLSearchParams(search);
    ['operator','table','composition','dealer','game'].forEach(key => query.delete(key)); query.delete('lane');
    context.forEach((value,key) => query.set(key,value));
    if(query.toString()!==search)replaceContext(`${path}?${query}`);
  }, [path, search, operator?.id, room?.id, compositionId, lane?.id, dealer?.id, game]);
  useEffect(() => {
    const blocked = () => busyRef.current || dirty || configDirty || Boolean(pending);
    const unload = (event:BeforeUnloadEvent) => { if (blocked()) { event.preventDefault(); event.returnValue = ''; } };
    const leave = (event:Event) => {
      const target = (event as CustomEvent<{href:string}>).detail?.href;
      if (target) {
        const url=new URL(target,location.origin);
        if(url.origin===location.origin&&isInternalAdminPathname(url.pathname)) {
          // Dealer registration/import does not select a room's permitted dealer.
          if(!isStudioAdminRoute(url.pathname,url.search)||url.searchParams.get('tool')==='import')return;
          const query=url.searchParams;
          if(registry&&['operator','table','composition','lane','dealer','game'].some(key=>query.has(key))) {
            const requestedRoom=registry.rooms.find(row=>row.id===query.get('table'));
            const nextOperator=query.get('operator')??requestedRoom?.operatorId??operator?.id??'';
            const nextRoom=requestedRoom?.operatorId===nextOperator?requestedRoom.id:query.has('table')?query.get('table')??'':query.has('game')?'':room?.id??'';
            const nextDealer=query.get('dealer')??dealer?.id??'';
            const hasGame=['blackjack','roulette'].includes(query.get('game')??'');
            const nextGame=hasGame?(query.get('game')==='roulette'?'roulette':'blackjack')
              : requestedRoom?.operatorId===nextOperator?(requestedRoom.game==='roulette'?'roulette':'blackjack'):game;
            const nextGameExplicit=hasGame||nextRoom===(room?.id??'')&&gameExplicit;
            const nextComposition=query.get('composition')??query.get('lane')??(nextRoom===(room?.id??'')&&nextOperator===(operator?.id??'')&&nextGame===game?compositionId:'');
            if(nextOperator!==(operator?.id??'')||nextRoom!==(room?.id??'')||nextComposition!==compositionId||nextDealer!==(dealer?.id??'')||nextGame!==game||nextGameExplicit!==gameExplicit) {
              if(!changeContext(()=>{setOperatorId(nextOperator);setRoomId(nextRoom);setCompositionId(nextComposition);setDealerId(nextDealer);setGame(nextGame);setGameExplicit(nextGameExplicit);})){event.preventDefault();return;}
            }
          }
          if(query.get('panel')==='layers'&&!openPanel('layers'))event.preventDefault();
          return;
        }
      }
      if (busyRef.current || blocked() && !confirm('Det finns ett osparat Studio-utkast. Lämna sidan och kasta utkastet?')) event.preventDefault();
    };
    const click = (event:MouseEvent) => {
      const anchor = (event.target as Element)?.closest?.('a'); if (!anchor || event.defaultPrevented || navigationKeepsStudioTab(event,anchor) || !blocked()) return;
      const target=new URL(anchor.href,location.origin);
      if(target.origin===location.origin&&isInternalAdminPathname(target.pathname)&&!anchor.target)return;
      if (busyRef.current || !confirm('Det finns ett osparat Studio-utkast. Lämna sidan och kasta utkastet?')) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener('beforeunload',unload); window.addEventListener('scout:navigate',leave); document.addEventListener('click',click,true);
    return () => { window.removeEventListener('beforeunload',unload); window.removeEventListener('scout:navigate',leave); document.removeEventListener('click',click,true); };
  }, [dirty,pending,configDirty,registry,operator?.id,room?.id,compositionId,dealer?.id,game,gameExplicit]);

  async function work(action:(signal:AbortSignal)=>Promise<void>, revalidateSession=false) {
    if (busyRef.current || !authorized&&!revalidateSession) return;
    busyRef.current = true; setBusy(true); setError(''); setNotice('');
    const controller = new AbortController(); activeRequest.current = controller;
    try { await action(controller.signal); }
    catch (cause) { if (!controller.signal.aborted) { const status=(cause as {statusCode?:number})?.statusCode??0;if ([401,403].includes(status)) setAuthorized(false);if(status===409)setRevisionConflict(true); setError(cause instanceof Error ? cause.message : 'Åtgärden misslyckades. Utkastet finns kvar.'); } }
    finally { busyRef.current = false; setBusy(false); }
  }
  function edit(project:StudioProject) { setData(current => current && ({...current,project})); setError(''); setNotice(base&&JSON.stringify(project)===JSON.stringify(base)?'Alla lokala ändringar är återställda.':'Ändringen finns i utkastet. Spara när du har granskat berörda rum.'); }
  const updateInventory=useCallback((inventory:VideoInventory)=>setData(current=>current&&({...current,inventory})),[]);
  async function link(slot:ClipSlot, id:string, asAlternative=false) {
    if (!data || !dealer) return;
    await work(async signal => {
      const video = clipsForSlot(data.inventory,dealer.id,slot).find(row => row.id === id);
      const durationMs = slot.eventId === 'idle.ready' && video ? await readIdleVideoDuration(video.previewUrl,{signal}) : undefined;
      const next=bindClip(data.project,data.inventory,dealer.id,slot,id,{variantId:variants[slot.id],durationMs,asAlternative});
      edit(next);
      if(asAlternative){
        const variantId=next.lines.find(row=>row.dealerId===dealer.id&&row.eventId===slot.eventId)!.variants.at(-1)!.id;
        setVariants(current=>({...current,[slot.id]:variantId}));
      }
    });
  }
  function stage(file:File,slot:ClipSlot) {
    if (busyRef.current || !authorized) return;
    if(slot.planned){setError('Detta fack visar nästa steg. Uppladdnings- och spelkontraktet är ännu inte anslutet.');return;}
    if(slot.localOnly){
      if(!dealer||!/^image\/png$/.test(file.type)||!file.name.toLowerCase().endsWith('.png')||file.size<16||file.size>128*1024*1024){setError('Välj PNG, högst 128 MB, för lokal VILA-förhandsvisning.');return;}
      setLocalReference({dealerId:dealer.id,file});setNotice('VILA-bilden visas lokalt och sparas inte. Den försvinner när du byter kontext eller stänger sidan.');setError('');return;
    }
    if (slot.sourceType === 'speak') { setError('Taluppladdning är inte ansluten här ännu: den kräver exakt text, ljud, video och separat acceptans.'); return; }
    if (pending && !confirm('Byt ut den valda, ännu inte uppladdade videon?')) return;
    setPending({file,slot}); setCompositing(slot.eventId==='roulette.reference'?'alpha':'green-screen'); setError('');
  }
  async function upload() {
    if (!pending || !data || !dealer) return;
    const target = pending;
    await work(async signal => {
      const metadata = uploadMetadata(data.project,dealer.id,target.slot,target.file,compositing === 'green-screen'
        ? {mode:'green-screen',threshold:0.38,softness:0.12,despill:0.6} : {mode:compositing});
      const result = await client.upload(target.file,metadata,signal);
      setData(current => current && ({...current,inventory:result.inventory}));
      setSelected(current => ({...current,[target.slot.id]:result.video.id})); setPending(null);
      setNotice(target.slot.intakeOnly?'Roulettefilen är registrerad i rätt fack och vald för förhandsvisning. Spelkoppling och publicering återstår.':'Filen är registrerad och vald för förhandsvisning. Koppla den uttryckligen till utkastet.');
    });
  }
  async function save() {
    if (!data || !dirty || conflictPaths.length) return;
    await work(async signal => {
      const saved = await client.save(data.project,signal);
      setData(current => current && ({...current,project:saved})); setBase(structuredClone(saved));
      setRevisionConflict(false);
      setNotice('Utkastet är sparat med ny serverrevision. Rumspublicering hanteras separat.');
    });
  }
  async function compareRevision() {
    if(!data||!base)return;
    await work(async signal=>{const remote=await client.load(signal);const result=rebaseProjectDraft(base,data.project,remote.project);const project=validateProject(result.project);setData({...remote,project});setBase(structuredClone(remote.project));setConflictPaths(result.conflicts);setRevisionConflict(false);setAuthorized(true);setNotice('Senaste revisionen är jämförd; dina utkaständringar är kvar.');},true);
  }
  function changeContext(action:()=>void) {
    if (busyRef.current) return false;
    if (configDirty && !confirm('Det finns formulärändringar som ännu inte har lagts i utkastet. Kasta dem och byt kontext?')) return false;
    if (pending && !confirm('Kasta videovalet som ännu inte har laddats upp och byt kontext?')) return false;
    setPending(null);setLocalReference(null); setSelected({}); setVariants({}); setPanel(null);setSettingsSlot(null);setActiveGroupId('');setPreviewCompositionId('');setPositions({}); action();
    if (dirty) setNotice('Det gemensamma projektutkastet är kvar, även för tidigare vald dealer och sammansättning.');
    return true;
  }
  function openPanel(next:typeof panel) {
    if(busyRef.current)return false;
    if(startDirty&&!confirm('Kasta filmformulärets osparade ändringar?'))return false;
    setStartDirty(false);setPanelEpoch(value=>value+1);setPanel(next);return true;
  }
  function togglePanel(next:typeof panel) {openPanel(panel===next?null:next);}
  const clipPanel = panel!==null && ['clip','policy','roulette-start','roulette-media'].includes(panel);
  const cardGroups = groupSlots(slots);
  const measuredCards = cardGroups.map(group=>({id:group.id,height:flowNodes.find(node=>node.id===group.id)?.measured?.height}));
  // ReactFlow measures expanded libraries too. Depend on sizes, not node/position object identity.
  const cardHeightKey = JSON.stringify(measuredCards);
  const cardPositions = layoutClipCards(measuredCards,canvasWidth,positions,game==='roulette'?440:355);
  const nodes:CardNode[] = cardGroups.map(group => {
    const slot = group.slots.find(slot=>slot.id===cardSlots[group.id]) ?? group.slots[0];
    const line = data!.project.lines.find(row => row.dealerId === dealer!.id && row.eventId === slot.eventId);
    const variantId = variants[slot.id] ?? line?.baselineVariantId ?? '';
    const clips = clipsForSlot(data!.inventory,dealer!.id,slot);
    const boundId = currentClipId(data!.project,dealer!.id,slot,variantId,data!.inventory);
    const selectedId = selected[slot.id] ?? (clips.some(row => row.id === boundId) ? boundId : slot.intakeOnly?clips[0]?.id??'':'');
    const usage=studioClipUsage(data!.project,data!.inventory,dealer!.id,slot,selectedId,variantId);
    const library=clipLibraryForSlot(data!.project,data!.inventory,dealer!.id,slot);
    const usageChanged=Boolean(base&&(boundId!==currentClipId(base,dealer!.id,slot,variantId,data!.inventory)||JSON.stringify(usage)!==JSON.stringify(studioClipUsage(base,data!.inventory,dealer!.id,slot,selectedId,variantId))));
    return {id:group.id,type:'registeredClip',position:cardPositions[group.id],
      data:{group,slot,clips,library,boundId,usage,usageChanged,active:clipPanel&&activeGroupId===group.id,onOpen:()=>{if(openPanel('clip')){setActiveGroupId(group.id);setSettingsSlot(null);}},boundIds:configuredClipIds(data!.project,dealer!.id,slot,variantId,data!.inventory),selectedId,localPreviewUrl:slot.localOnly&&localReference?.dealerId===dealer?.id?referenceUrl:undefined,busy:locked||loading||!authorized,variantId,variants:clipVariantChoices(data!.project,data!.inventory,dealer!.id,slot),
        onSlot:id=>{if(!openPanel('clip'))return;setActiveGroupId(group.id);setCardSlots(current=>({...current,[group.id]:id}));setSettingsSlot(null);},onSettings:()=>{if(!openPanel(slot.eventId==='roulette.wheel-start'?'roulette-start':slot.game==='roulette'?'roulette-media':slot.sourceType==='speak'?'room':'policy'))return;setActiveGroupId(group.id);setSettingsSlot(slot);setStartVideoId(selectedId||boundId);setStartVariantId(variantId);},
        onSelect:id=>{if(!openPanel('clip'))return;setSelected(current=>({...current,[slot.id]:id}));},onVariant:id=>{if(!openPanel('clip'))return;setVariants(current=>({...current,[slot.id]:id}));setSelected(current=>({...current,[slot.id]:currentClipId(data!.project,dealer!.id,slot,id,data!.inventory)}));},
         onBind:asAlternative=>{void link(slot,selectedId,asAlternative);},onUnbind:()=>{void work(async()=>{edit(validateProject(unbindRouletteClip(data!.project,dealer!.id,slot,selectedId)));});},onFile:file=>stage(file,slot)}};
  });
  const previewCompositions=base?.lanes?.filter(row=>row.layers.dealer.allowed.includes(dealer?.id??''))??[];
  const previewComposition=previewCompositions.find(row=>row.id===(previewCompositionId||lane?.id));
  const activeCard = nodes.find(node=>node.id===activeGroupId)?.data;
  const impacts = registry?.rooms.filter(row => row.dealerIds.includes(dealer?.id ?? '') || row.compositionId === lane?.id) ?? [];
  const changedRooms = data&&base ? affectedRooms(base,data.project,registry?.rooms??[]) : [];
  useEffect(()=>{setFlowNodes(current=>nodes.map(node=>({...current.find(row=>row.id===node.id),...node})));},[data,base,dealer?.id,game,cardSlots,selected,variants,locked,loading,authorized,positions,canvasWidth,cardHeightKey,referenceUrl,localReference,startDirty,activeGroupId,clipPanel]);
  return <section ref={workspaceRef} onPlayCapture={event=>{
    const media=event.target;
    if(!(media instanceof HTMLMediaElement))return;
    if(!active||document.hidden||media.closest('[hidden]')){media.pause();return;}
    if(playingPreview.current!==media)playingPreview.current?.pause();
    workspaceRef.current?.querySelectorAll<HTMLMediaElement>('video,audio').forEach(other=>{if(other!==media)other.pause();});
    playingPreview.current=media;
  }} className="studio-clip-workspace flex min-h-0 flex-1 flex-col" aria-label="Klippkarta för vald dealer">
    <header className="studio-workspace-header">
      <div className="studio-workspace-toolbar"><p>Klippbibliotek <span>Kategori → situation → standardklipp och varianter.</span></p>
        <div className="studio-save-actions"><span className={dirty||configDirty?'text-sg-amber':'text-sg-lime'}>{loading?'Läser…':configDirty?'Osparat formulär':dirty?'Osparat utkast':data?'Projektutkast sparat':'Ej inläst'}</span><button className="studio-button studio-save" disabled={locked||loading||!authorized||!dirty||Boolean(pending)||configDirty||conflictPaths.length>0} onClick={()=>setReviewSave(true)}>Spara utkast</button><button className="studio-icon-button" aria-label="Läs om register" title="Läs om register" disabled={locked||loading} onClick={()=>{if((dirty||pending||configDirty)&&!confirm('Kasta utkast och formulärändringar och läs om serverns revision?'))return;setPending(null);setPanel(null);setSpeechDealer('');setStartDirty(false);setConfigDirty(false);void load();}}><RotateCcw size={15}/></button></div></div>
      {registry&&<>
        <div className="studio-context-row studio-primary-context">
          <label className="studio-field">Dealer<select aria-label="Dealer" value={dealer?.id??''} disabled={locked||loading} onChange={event=>changeContext(()=>setDealerId(event.target.value))}>{dealers.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}</select></label>
          <label className="studio-field">Spel<select value={game} disabled={locked||loading} onChange={event=>changeContext(()=>{setGame(event.target.value as 'blackjack'|'roulette');setGameExplicit(true);setRoomId('');setCompositionId('');})}><option value="blackjack">Blackjack</option><option value="roulette">Roulette</option></select></label>
          <button className="studio-button" disabled={!dealer||locked} onClick={()=>togglePanel('dealer')}><Users size={16}/>Dealerinställningar</button>
          <button className="studio-button" disabled={!dealer||locked} onClick={()=>togglePanel('room')}><Volume2 size={16}/>Röst &amp; tal</button><button className="studio-button" disabled={!dealer||locked} onClick={()=>togglePanel('scene')}>Scenförhandsvisning</button>
          <button className="studio-button" disabled={!lane||locked} title={lane?'Redigera den valda gemensamma sammansättningsmallen':'Välj en sparad sammansättning eller ett rum under Rum och publicering'} onClick={()=>togglePanel('layers')}><Layers size={16}/>Scen &amp; lager</button>
        </div>
        <details className="studio-room-context"><summary>Rum och publicering <span>{room?room.name:'Inget spelrum valt'}</span></summary>
          <div className="studio-context-row">
            <label className="studio-field">Spelbolag<select value={operator?.id??''} disabled={locked||loading} onChange={event=>changeContext(()=>{setOperatorId(event.target.value);setRoomId('');setCompositionId('');})}><option value="">Ingen bolagskontext</option>{registry.operators.filter(isActiveOperator).map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
            <label className="studio-field">Rum<select value={room?.id??''} disabled={locked||loading||!rooms.length} onChange={event=>changeContext(()=>{setRoomId(event.target.value);setCompositionId('');setGameExplicit(false);})}><option value="">Ingen rumskontext</option>{rooms.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
            {roomChoices&&<a className="studio-button" href={roomChoices}>Rummets val</a>}
          </div>
          {data&&<p className="studio-publication-note">Kartan visar projektutkastet. {room?.published?'Rummets publicerade paket jämförs inte med utkastet här.':'Ingen publicerad rumsversion är vald.'} {room&&<a href={`/admin/publication?${new URLSearchParams({operator:room.operatorId,table:room.id,composition:room.compositionId,game:room.game})}`}>Granska rumspublicering</a>}</p>}
        </details>
      </>}
      {error&&<p role="alert" className="studio-error">{error} {!data&&<button className="studio-button" onClick={()=>{void load();}}>Försök igen</button>} {revisionConflict&&<button className="studio-button" disabled={locked||!authorized} onClick={()=>{void compareRevision();}}>Jämför senaste revision</button>} {data&&!authorized&&<><a href={'/control/login?returnTo='+encodeURIComponent(location.pathname+location.search)} target="_blank" rel="noopener">Logga in i ny flik</a><button className="studio-button" disabled={locked} onClick={()=>{void compareRevision();}}>Återanslut och behåll utkast</button></>}</p>}
      {conflictPaths.length>0&&<div className="studio-error" role="alert"><p>Samtidiga ändringar: {conflictPaths.join(', ')}. Ditt utkast är kvar; sparande är spärrat tills du väljer.</p><button className="studio-button" onClick={()=>setConflictPaths([])}>Behåll mitt utkast för dessa fält</button></div>}
      {data&&!dealer&&<p role="alert" className="studio-error">Det finns ingen aktiv dealer i biblioteket. Skapa en i Dealerregister för att börja.</p>}
      {dealer&&room&&!lane?.layers.dealer.allowed.includes(dealer.id)&&<p role="note">Du redigerar {dealer.label}s klippbank. {room?'Dealern är ännu inte kopplad till det valda rummet.':'Inget spelrum är valt.'} Lägg till kopplingen under <a href="/admin/structure">Kopplingar</a> när materialet är klart.</p>}
      {room?.materialWarning&&<p role="note">Fryst spelåtkomst behålls. Materialet har en annan katalogtagg; granska rummets bord och spel före nästa publicering.</p>}
    </header>
    <div className="studio-canvas-toolbar"><div><h1>Klippkarta <span>{cardGroups.length} kort · {slots.length} fack</span></h1><p>Dra i bakgrunden för att panorera. Korten kan flyttas.</p></div><div className="studio-map-controls" role="group" aria-label="Kartans visning">
      <button className="studio-button" aria-label="Zooma ut" onClick={()=>void zoomOut({duration:180})}>−</button>
      <button className="studio-button" aria-label="Visa kartan i 100 procent" onClick={()=>void setViewport({x:24,y:24,zoom:1},{duration:180})}>{Math.round(zoom*100)} %</button>
      <button className="studio-button" aria-label="Zooma in" onClick={()=>void zoomIn({duration:180})}>+</button>
      <button className="studio-button" onClick={()=>void fitView({padding:.15,maxZoom:1,duration:250})}>Visa alla kort</button>
      <button className="studio-button" onClick={()=>{setPositions({});void setViewport({x:24,y:24,zoom:1},{duration:250});}}><RotateCcw size={16}/>Återställ placering</button>
    </div></div>
    {notice&&notice!=='Register och sparad revision inlästa.'&&<p role="status" className="studio-notice">{notice}</p>}
    {speechDirty&&panel!=='room'&&<div className="studio-draft-reminder" role="status"><p>Talformuläret har osparade ändringar. De finns kvar i Röst &amp; tal.</p><button type="button" className="studio-button" disabled={locked} onClick={()=>openPanel('room')}>Fortsätt med osparat tal</button></div>}
    {game==='roulette'&&<div className="flex flex-wrap items-center gap-3 border-b border-sg-line px-6 py-3 text-xs text-sg-text-soft" aria-label="Roulettens förlopp">
      {localVilaUrl?<img className="h-20 w-24 object-contain" src={localVilaUrl} alt="Lokal VILA-referens, inte sparad"/>:rouletteReference&&(rouletteReference.classification?.mediaType==='image'?<img className="h-20 w-24 object-contain" src={rouletteReference.previewUrl} alt="Roulettens VILA-referens"/>:<video className="h-20 w-24 object-contain" src={rouletteReference.previewUrl} muted playsInline preload="auto" aria-label="Första tillgängliga roulette-idle som viloreserv"/>)}
      <p>Vila → insatser → kulsläpp och animerat hjul → resultat → vila.<br/>Bakgrund, dealer och bord är separata bild- eller videolager. Filvalen här gäller bara roulette. {localVilaUrl?'Lokal VILA-bild visas, inte sparad.':rouletteReference?rouletteReference.classification?.mediaType==='image'?'VILA-bild finns.':'VILA-bild saknas; första tillgängliga roulette-idle visas som reserv.':'VILA och roulette-idle saknas.'} Koppla grundloop och glasögonvarianter uttryckligen, spara utkastet och publicera rummet separat. Registrering är ingen visuell acceptans.</p>
      <button className="studio-button" disabled={locked} onClick={()=>togglePanel('layers')}>Bakgrund och bord · bild/video</button>
    </div>}
    {reviewSave&&<div className="studio-review-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="studio-save-review" className="studio-review"><h2 id="studio-save-review">Berörda användningar</h2><p>Ändringarna sparas som utkast. Publicerade versioner behålls.</p><ul>{changedRooms.length?changedRooms.map(row=><li key={row.id}>{registry?.operators.find(op=>op.id===row.operatorId)?.name} · {row.name} · {row.game}{row.published?' · publicerad':''}</li>):<li>Inga registrerade rum använder det ändrade materialet.</li>}</ul><div><button className="studio-button studio-save" disabled={locked||loading||!authorized||conflictPaths.length>0||configDirty} onClick={()=>{void save().then(()=>setReviewSave(false));}}>Bekräfta sparande</button><button className="studio-button" disabled={busy} onClick={()=>setReviewSave(false)}>Tillbaka</button></div></section></div>}
    <div className="studio-map-stage">
    {data&&dealer&&<aside id="studio-clip-inspector" hidden={!panel} className={`studio-drawer ${panel==='scene'?'is-scene':panel==='layers'?'is-layers':''}`} aria-label="Klipp och inställningar"><header><h2 ref={panelHeading} tabIndex={-1}>{panel==='scene'?'Provspela sparad scen':panel==='room'?'Röst & tal':panel==='dealer'?'Dealer & användning':panel==='layers'?'Gemensam sammansättningsmall':clipPanel&&activeCard?activeCard.group.subtitle:settingsSlot?slotCaption(settingsSlot):'Klippinställningar'}</h2><button className="studio-button" disabled={locked} onClick={()=>{if(openPanel(null))document.getElementById(`studio-card-open-${activeGroupId}`)?.focus();}}>Stäng</button></header>
      {(clipPanel||panel==='scene'||panel==='layers')&&<nav className="studio-inspector-nav" aria-label="Klipp och scen"><button type="button" className="studio-button" disabled={locked||!activeCard} aria-current={clipPanel?'page':undefined} onClick={()=>openPanel('clip')}>Klipp</button><button type="button" className="studio-button" disabled={locked} aria-current={panel==='scene'?'page':undefined} onClick={()=>openPanel('scene')}>Scenförhandsvisning</button><button type="button" className="studio-button" disabled={locked||!lane} aria-current={panel==='layers'?'page':undefined} onClick={()=>openPanel('layers')}>Scen &amp; lager</button></nav>}
      {clipPanel&&activeCard&&<ConnectedClipDetails key={dealer.id+'/'+activeCard.slot.id} data={activeCard} settingsOpen={panel!=='clip'} active={active&&!pending}/>}
      {panel==='scene'&&<><label className="studio-field">Sparad sammansättning<select value={previewComposition?.id??''} disabled={locked} onChange={event=>setPreviewCompositionId(event.target.value)}><option value="">Välj en sammansättning…</option>{previewCompositions.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}</select></label><p className="studio-preview-caption">Provar scenens sparade förval och bibliotek, inte rummets publicerade val eller enbart det markerade klippet.{previewComposition?' Startdealer: '+(base?.dealers.find(row=>row.id===previewComposition.layers.dealer.default)?.label??previewComposition.layers.dealer.default)+'.':''}</p><SavedScenePreview active={active} presentationLaneId={previewComposition?.id} revision={base?.revision} dealerId={dealer.id} game={game} blocked={locked||loading||!authorized||dirty||configDirty||Boolean(pending)||revisionConflict||conflictPaths.length>0} reason={speechDirty?'Spara eller återställ talformuläret i Röst & tal.':dirty?'Spara projektutkastet före scenförhandsvisning.':undefined} onStart={pausePreviews}/></>}
      {panel==='roulette-start'&&<RouletteStartEditor key={`${dealer.id}:${startVideoId}:${panelEpoch}`} project={data.project} inventory={data.inventory} dealerId={dealer.id} laneId={lane?.id??''} videoId={startVideoId} blocked={locked||loading||!authorized} onEdit={edit} onDirtyChange={setStartDirty} onInventory={updateInventory} onBusyChange={childOperation}/>}
      {panel==='roulette-media'&&data.inventory.videos.filter(video=>video.id===startVideoId).map(video=><RouletteIdleEditor key={`${dealer.id}:${video.id}:${panelEpoch}`} project={data.project} inventory={data.inventory} video={video} dealerId={dealer.id} blocked={locked||loading||!authorized} onEdit={edit} onSaved={updateInventory} onDirtyChange={setStartDirty} onBusyChange={childOperation}/>)}
      <div hidden={panel!=='room'}>{(panel==='room'||speechDealer===dealer.id)&&<StudioSpeechPanel active={active&&panel==='room'} game={game} project={data.project} inventory={data.inventory} dealerId={dealer.id} blocked={busy || loading || !authorized} projectDirty={dirty} onEdit={edit} onBusyChange={childOperation} onDirtyChange={setConfigDirty}/>}</div>
      {panel==='dealer'&&<><div className="studio-dealer-summary"><DealerIdentityPortrait dealer={dealer} className="h-16 w-16 shrink-0"/><div><strong>{dealer.label}</strong><small>Identitet: {dealer.id}</small><p>{impacts.length} rum använder dealern / sammansättningen</p></div></div><StudioLifecyclePanel project={data.project} inventory={data.inventory} catalog={data.catalog} dealerId={dealer.id} blocked={busy || loading || !authorized || dirty} editBlocked={busy || loading || !authorized || Boolean(pending)} onEdit={edit} onReload={load} onBusyChange={childOperation}/></>}
      {panel==='policy'&&settingsSlot&&<StudioPolicyPanel project={data.project} inventory={data.inventory} dealerId={dealer.id} slot={settingsSlot} selectedVideoId={startVideoId} selectedVariantId={startVariantId} blocked={busy || loading || !authorized} onEdit={edit} onBusyChange={childOperation}/>}
      {panel==='layers'&&<StudioCompositionPanel localReferenceUrl={localVilaUrl} uses={compositionUses(data.catalog,lane?.id)} roomChoicesPath={roomChoices} project={data.project} savedProject={base} inventory={data.inventory} dealerId={dealer.id} room={room} compositionId={compositionId||lane?.id} game={game} blocked={busy || loading || !authorized} projectDirty={dirty||configDirty||Boolean(pending)||revisionConflict} onSaved={remote=>{setBase(structuredClone(remote));setData(current=>current&&({...current,project:remote}));setMaterialReload(true);}} onEdit={edit} onBusyChange={childOperation} onRegistered={(remote,id,role)=>{try{if(!base||!lane)throw Error('Sammansättningen saknas. Filen är registrerad; utkastet är kvar.');const result=registerCompositionLayer(base,data.project,remote,{id,role,laneId:lane.id});setBase(structuredClone(remote));setData(current=>current&&({...current,project:result.project}));setConflictPaths(result.conflicts);if(result.conflicts.length)setError('Filen är registrerad. Dessa utkastfält behöver granskas: '+result.conflicts.join(', '));else setNotice('Lagret är registrerat och valt i utkastet.');}catch(cause){setError((cause as Error).message);}}}/>}
    </aside>}
    {data&&dealer&&<div ref={canvasRef} className="studio-canvas"><ReactFlow key={`${dealer.id}:${game}`} defaultViewport={{x:24,y:24,zoom:1}} onMove={(_event,viewport)=>setZoom(viewport.zoom)} nodes={flowNodes} edges={[]} nodeTypes={nodeTypes} nodesDraggable={!locked} onNodesChange={changes=>{onFlowNodesChange(changes);if(!changes.some(change=>change.type==='position'&&change.position))return;setPositions(current=>{const next={...current};let moved=false;for(const change of changes)if(change.type==='position'&&change.position&&(!current[change.id]||current[change.id].x!==change.position.x||current[change.id].y!==change.position.y)){next[change.id]=change.position;moved=true;}return moved?next:current;});}} nodesConnectable={false} edgesReconnectable={false} minZoom={0.2} maxZoom={1.5} colorMode="dark" proOptions={{hideAttribution:true}}><Background variant={BackgroundVariant.Dots} gap={22} color="#33363b"/></ReactFlow></div>}
    </div>
    {pending&&<dialog ref={uploadDialog} onCancel={event=>{event.preventDefault();if(!busyRef.current)setPending(null);}} aria-labelledby="upload-heading" className="w-full max-w-md space-y-4 rounded-lg border border-sg-line bg-sg-panel p-5"><h2 id="upload-heading" className="font-semibold">Registrera fil i kortplats</h2><p className="text-xs">{dealer?.label} · {pending.slot.title} · {pending.slot.situation||'standard'} · {pending.file.name}</p>{localUrl&&(pending.slot.eventId==='roulette.reference'?<img src={localUrl} alt="VILA-bild att registrera" className="max-h-52 w-full object-contain"/>:<video src={localUrl} controls muted playsInline className="max-h-52 w-full object-contain"/>)}<label className="flex flex-col gap-1 text-xs">Bakgrund i filen<select className={input} disabled={busy||pending.slot.eventId==='roulette.reference'} value={compositing} onChange={event=>setCompositing(event.target.value as typeof compositing)}><option value="green-screen">Grön skärm</option><option value="opaque">Inbakad bakgrund</option><option value="alpha">Verifierad alfa · PNG / WebM</option></select></label><p className="text-xs text-sg-muted">Filen sparas i det befintliga privata registret. Koppling och rumspublicering är separata steg.</p>{error&&<p role="alert" className="text-xs text-sg-red">{error}</p>}<div className="flex gap-2"><button className={button} disabled={locked||loading||!authorized} onClick={()=>{void upload();}}>{busy?'Registrerar…':'Ladda upp till registret'}</button><button className={button} disabled={busy} onClick={()=>setPending(null)}>Avbryt videoval</button></div></dialog>}
  </section>;
}
export function ConnectedClipMap(props:{active?:boolean;onDirtyChange?:(dirty:boolean)=>void;onRevisionChange?:(revision:string)=>void;refreshKey?:number}) { return <ReactFlowProvider><WorkspaceMap {...props}/></ReactFlowProvider>; }
