'use client';

import { StudioGuide } from './studio-guide';
import contract from '../policies/studio-contract.json';
import { EventTree } from './event-tree';
import treeStyles from './event-tree.module.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addVariant, allowedPathDescriptors, isAssetCompatible, MAX_ALTERNATIVES, removeTrigger, removeVariant } from '../lib/studio-model.mjs';
import type { DealerId, StudioAsset, StudioProject, StudioTrigger, StudioVariant, TriggerCategory } from '../lib/studio-model.mjs';
import { videoFitsLine } from '../lib/video-intake.mjs';
import { getMotionClip } from '../lib/motion-library.mjs';
import { EventTestPanel } from './event-test-panel';
import { Stage } from './stage';
import { TriggerEditor, categoryLabels, defaultValue } from './trigger-editor';
import { VideoLibrary, VariantVideoBinding } from './video-library';
import { VariantSelectionEditor } from './variant-selection';
import type { UploadBinding } from './video-upload';
import type { VideoEntry } from './studio-types';
import { GatewayPanel } from './gateway-panel';
import { neutralContext } from './test-context';
import { SocialChatPanel } from './social-chat-panel';
import type { SocialDraftCache } from './social-chat-panel';
import socialStyles from './social-chat-panel.module.css';
import { requestJson, studioViewForPath, viewPaths, previewVideoIdFor } from './studio-types';
import type { ConnectionStatus, DirectorMode, SimulationResult, StudioView, TestContext, VideoInventory } from './studio-types';

const sourceLabels: Record<string, string> = Object.fromEntries(Object.entries(contract.sourceTypes).map(([id, value]) => [id, value.label]));
const sourceSymbols: Record<string, string> = { speak: '◌', deal: '▱', reveal: '◇', turn: '◎', settle: '✦', idle: '◷' };
const navigation: { id: StudioView; label: string; number: string }[] = [{ id: 'tree', label: 'Nodträdet', number: '01' }, { id: 'lab', label: 'Eventstudion', number: '02' }, { id: 'videos', label: 'Videobanken', number: '03' }, { id: 'openclaw', label: 'OpenClaw', number: '04' }, { id: 'guide', label: 'Guide', number: '05' }];

export function Studio({ initialProject, initialVideos, initialStatus, initialView = 'lab' }: { initialProject: StudioProject; initialVideos: VideoInventory; initialStatus: ConnectionStatus; initialView?: StudioView }) {
  const [project, setProject] = useState(initialProject);
  const [videos, setVideos] = useState(initialVideos);
  const projectRef = useRef(project);
  projectRef.current = project;
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(initialProject));
  const [view, setView] = useState<StudioView>(initialView);
  const [dealerId, setDealerId] = useState<DealerId>('astrid');
  const [eventId, setEventId] = useState(initialProject.events[0].id);
  const [variantId, setVariantId] = useState('');
  const [editorTab, setEditorTab] = useState<'event' | 'variants' | 'triggers'>('variants');
  const [testToolsOpen, setTestToolsOpen] = useState(false);
  const [mode, setMode] = useState<DirectorMode>('off');
  const [context, setContext] = useState<TestContext>(() => structuredClone(neutralContext));
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [playId, setPlayId] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [previewKind, setPreviewKind] = useState<'selected' | 'social' | null>(null);
  const [socialAsset, setSocialAsset] = useState<StudioAsset | null>(null);
  const [socialReply, setSocialReply] = useState('');
  const [filter, setFilter] = useState('');
  const simulationRun = useRef(0);
  const simulationRequest = useRef<AbortController | null>(null);
  const cancelSocial = useRef<(() => void) | null>(null);
  const socialDraftCache = useRef<SocialDraftCache | null>(null);
  const mainStage = useRef<HTMLDivElement>(null);
  const socialChat = useRef<HTMLDivElement>(null);
  const registerSocialCancel = useCallback((cancel: (() => void) | null) => { cancelSocial.current = cancel; }, []);

  const projectJson = useMemo(() => JSON.stringify(project), [project]);
  const dirty = projectJson !== savedJson;
  const event = project.events.find(item => item.id === eventId) ?? project.events[0];
  const line = project.lines.find(item => item.dealerId === dealerId && item.eventId === event.id)!;
  const variant = line.variants.find(item => item.id === variantId) ?? line.variants[0];
  const isBaseline = variant.id === line.baselineVariantId;
  const dealer = project.dealers.find(item => item.id === dealerId)!;
  const selectedAsset = project.assets.find(item => item.id === variant.assetId);
  const currentAsset = socialAsset ?? result?.asset ?? selectedAsset;
  const selectedAnimationCompatible = isAssetCompatible(event, selectedAsset);
  const incompatibleBindings = useMemo(() => {
    const events = new Map(project.events.map(item => [item.id, item]));
    const assets = new Map(project.assets.map(item => [item.id, item]));
    return project.lines.flatMap(item => item.variants.filter(candidate => !isAssetCompatible(events.get(item.eventId), assets.get(candidate.assetId))).map(candidate => ({ dealerId: item.dealerId, eventId: item.eventId, variantId: candidate.id })));
  }, [project]);
  const eligibleIds = new Set((result?.eligible ?? []).map(item => typeof item === 'string' ? item : item.id ?? item.variantId));
  const visibleEvents = project.events.filter(item => `${item.label} ${item.id}`.toLocaleLowerCase('sv').includes(filter.toLocaleLowerCase('sv')));
  const previewVideoId = previewVideoIdFor(variant, result, Boolean(socialAsset));
  const selectedVideo = previewVideoId ? videos.videos.find(item => item.id === previewVideoId && item.available && videoFitsLine(item, dealerId, event.id)) : undefined;
  const invalidVideoBindings = project.lines.flatMap(l => l.variants.filter(v => v.videoGenerationId && !videoFitsLine(videos.videos.find(f => f.id === v.videoGenerationId), l.dealerId, l.eventId)));

  function openFirstIncompatibleBinding() {
    const first = incompatibleBindings[0];
    if (!first) return;
    setDealerId(first.dealerId); setEventId(first.eventId); setVariantId(first.variantId);
    setEditorTab('variants'); changeView('lab');
  }
  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      const social = socialDraftCache.current;
      if (dirty || social && JSON.stringify(social.draft) !== JSON.stringify(social.status.policy)) { event.preventDefault(); event.returnValue = ''; }
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);
  useEffect(() => {
    function onPopState() { invalidateSimulation(); setView(studioViewForPath(window.location.pathname)); }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  useEffect(() => () => { simulationRun.current++; simulationRequest.current?.abort(); cancelSocial.current?.(); }, []);
  useEffect(() => {
    if (view !== 'lab' || previewKind !== 'social' || !socialReply) return;
    const frame = window.requestAnimationFrame(() => scrollTo(mainStage.current));
    return () => window.cancelAnimationFrame(frame);
  }, [playId, previewKind, socialReply, view]);

  function scrollTo(element: HTMLElement | null) {
    element?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  function invalidateSimulation(stopSocial = true) {
    simulationRun.current++; simulationRequest.current?.abort(); simulationRequest.current = null;
    setResult(null); setPlaying(false); setSimulating(false); setPreviewKind(null); setSocialAsset(null); setSocialReply('');
    if (stopSocial) cancelSocial.current?.();
  }
  function previewSelected() {
    invalidateSimulation(); setError('');
    if (!selectedAnimationCompatible) { setError('Byt först den gamla animationskopplingen till en som matchar eventet.'); return; }
    setPreviewKind('selected'); setPlayId(current => current + 1); setPlaying(true);
  }
  function goToAstridIdle() { invalidateSimulation(); setDealerId('astrid'); setEventId('idle.ready'); setVariantId(''); }
  function playSocialReaction(assetId: 'social.ledsen' | 'idle.ready.standard', label: string, exactReply: string) {
    if (dealerId !== 'astrid' || event.id !== 'idle.ready' || view !== 'lab') return;
    const clip = getMotionClip(assetId);
    if (!clip) { setError('Den sociala labbrörelsen saknas. Ingen annan rörelse spelades som ersättning.'); return; }
    setSocialAsset({ id: assetId, label, kind: 'animation', animation: 'idle', color: '#b7a4c5', durationMs: clip.durationMs });
    setSocialReply(exactReply);
    setResult(null); setPreviewKind('social'); setPlayId(current => current + 1); setPlaying(true);
  }
  function changeView(next: StudioView) { invalidateSimulation(); setView(next); window.history.pushState(null, '', viewPaths[next]); }
  function updateProject(edit: (draft: StudioProject) => void) { setProject(current => { const draft = structuredClone(current); edit(draft); return draft; }); invalidateSimulation(); setError(''); setNotice(''); }
  function modelEdit(edit: (value: StudioProject) => StudioProject) {
    try { setProject(edit(project)); invalidateSimulation(); setError(''); setNotice(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Ändringen kunde inte göras.'); }
  }
  function updateVariant(patch: Partial<StudioVariant>) { updateProject(draft => { const target = draft.lines.find(item => item.dealerId === dealerId && item.eventId === event.id)!.variants.find(item => item.id === variant.id)!; Object.assign(target, patch); }); }
  function uploadedVideo(inventory: VideoInventory, video: VideoEntry, binding: UploadBinding | null) {
    setVideos(inventory);
    if (!binding || !video.classification) return;
    const { dealerId: targetDealer, eventId: targetEvent } = video.classification;
    try {
      let next = structuredClone(projectRef.current);
      if (binding.role === 'alternative') next = addVariant(next, targetDealer, targetEvent, video.label);
      const targetLine = next.lines.find(l => l.dealerId === targetDealer && l.eventId === targetEvent)!;
      const targetVariant = binding.role === 'standard' ? targetLine.variants.find(v => v.id === targetLine.baselineVariantId)! : targetLine.variants.at(-1)!;
      targetVariant.videoGenerationId = video.id;
      if (binding.role === 'alternative') { targetVariant.selection = binding.selection; targetVariant.triggerIds = binding.triggerIds; }
      setProject(next); setDealerId(targetDealer); setEventId(targetEvent); setVariantId(targetVariant.id);
      invalidateSimulation(); setError(''); setNotice('Videon finns i banken. Kopplingen ligger i utkastet tills du sparar projektet.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Filen sparades men kunde inte kopplas.'); }
  }
  function updateTrigger(id: string, patch: Partial<StudioTrigger>) { updateProject(draft => { Object.assign(draft.triggers.find(item => item.id === id)!, patch); }); }
  function createTrigger(category: TriggerCategory) {
    const descriptor = allowedPathDescriptors.find(item => item.category === category)!;
    const id = `trigger.${crypto.randomUUID()}`;
    updateProject(draft => { draft.triggers.push({ id, label: `Ny ${category === 'deterministic' ? 'spelregel' : category === 'social' ? 'social trigger' : 'framtoning'}`, category, path: descriptor.path, op: descriptor.operators[0], value: defaultValue(descriptor) }); });
    return id;
  }
  function selectEvent(id: string) { setEventId(id); setVariantId(''); invalidateSimulation(); }
  function selectDealer(id: DealerId) { setDealerId(id); setVariantId(''); invalidateSimulation(); }
  function selectVariant(id: string) { setVariantId(id); invalidateSimulation(); }
  function changeContext(next: TestContext) { setContext(next); invalidateSimulation(); }
  function changeMode(next: DirectorMode) { setMode(next); invalidateSimulation(); }

  async function save() {
    if (saving) return;
    invalidateSimulation();
    setSaving(true); setError(''); setNotice('');
    const submitted = project;
    try {
      const response = await requestJson<{ project: StudioProject }>('/api/project', { method: 'PUT', body: JSON.stringify({ project: submitted, expectedRevision: submitted.revision }) });
      if (!response.project) throw new Error('Servern returnerade inte det sparade projektet.');
      setSavedJson(JSON.stringify(response.project));
      setProject(current => current === submitted ? response.project : { ...current, revision: response.project.revision });
      setNotice('Projektet är sparat lokalt. Inget har publicerats till spelet eller Render.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Projektet kunde inte sparas.'); }
    finally { setSaving(false); }
  }

  async function simulate() {
    setTestToolsOpen(true);
    invalidateSimulation();
    const run = ++simulationRun.current;
    const controller = new AbortController(); simulationRequest.current = controller;
    setSimulating(true); setError(''); setResult(null); setPlaying(false);
    try {
      const response = await requestJson<SimulationResult>('/api/simulate', { method: 'POST', signal: controller.signal, body: JSON.stringify({ project, dealerId, eventId: event.id, context, mode }) });
      if (controller.signal.aborted || run !== simulationRun.current) return;
      setResult(response);
      if (response.variant?.id) setVariantId(response.variant.id);
      setPlayId(current => current + 1); setPlaying(true);
    } catch (cause) { if (run === simulationRun.current) setError(cause instanceof Error ? cause.message : 'Testet kunde inte genomföras.'); }
    finally { if (run === simulationRun.current) { simulationRequest.current = null; setSimulating(false); } }
  }

  function exportProject() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'croupier-lab-project.json'; anchor.click(); URL.revokeObjectURL(url);
    setNotice('JSON exporterad. Filen innehåller labbpolicyer, inte hemligheter eller videofiler.');
  }

  return <div className="studio-shell"><a className="skip-link" href="#workspace">Hoppa till arbetsytan</a><header className="studio-header"><a className="studio-brand" href="/" onClick={e => { e.preventDefault(); changeView('lab'); }}><span className="brand-mark" aria-hidden="true">C<span>↗</span></span><span>CROUPIER<small>DIRECTOR STUDIO</small></span></a><nav className="main-nav" aria-label="Huvudnavigation">{navigation.map(item => <a key={item.id} href={viewPaths[item.id]} className={view === item.id ? 'active' : ''} aria-current={view === item.id ? 'page' : undefined} onClick={e => { if (!e.ctrlKey && !e.metaKey && !e.shiftKey) { e.preventDefault(); changeView(item.id); } }}><span>{item.number}</span>{item.label}</a>)}</nav><div className="header-actions"><span className={`save-state ${dirty ? 'dirty' : ''}`}><i />{dirty ? 'Osparade ändringar' : 'Sparat lokalt'}</span><button className="icon-button export-button" title="Exportera projekt som JSON" aria-label="Exportera projekt som JSON" onClick={exportProject}>↓</button><button className="primary-button" disabled={!dirty || saving} onClick={() => void save()}>{saving ? 'Sparar…' : 'Spara projekt'}</button></div></header>
    <div className={`studio-body ${view === 'lab' || view === 'videos' ? '' : treeStyles.fullWidth}`}>{view === 'lab' || view === 'videos' ? <aside className="event-sidebar"><div className="sidebar-top"><div className="eyebrow">DITT LABB <span>LOCAL / 01</span></div><div className="game-selector"><button className="active" aria-pressed="true"><span aria-hidden="true">♠</span> Blackjack</button><button disabled title="Roulette är inte implementerat">Roulette <small>Senare</small></button></div><label className="dealer-selector"><span className="eyebrow">CROUPIER</span><select value={dealerId} onChange={e => selectDealer(e.target.value as DealerId)}>{project.dealers.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label className="search-field sidebar-search"><span aria-hidden="true">⌕</span><input placeholder="Hitta ett event…" aria-label="Sök event" value={filter} onChange={e => setFilter(e.target.value)} /></label></div><div className="event-tree"><div className="tree-title"><span>EVENTTRÄD</span><span>{project.events.length}</span></div>{Object.keys(sourceLabels).map(source => { const items = visibleEvents.filter(item => item.sourceType === source); return items.length ? <div className="event-group" key={source}><div className="event-group-title"><span>{sourceSymbols[source]}</span>{sourceLabels[source]}<code>{source}</code></div>{items.map(item => <button className={`event-node ${event.id === item.id ? 'active' : ''}`} key={item.id} onClick={() => selectEvent(item.id)}><i /><span>{item.label}</span>{event.id === item.id ? <span className="node-arrow">↗</span> : null}</button>)}</div> : null; })}{!visibleEvents.length ? <p className="helper">Inga event matchar sökningen.</p> : null}</div><div className="sidebar-footer"><span className="sidebar-foot-icon" aria-hidden="true">⌘</span><p><strong>6 eventtyper. 16 eventgrupper.</strong><span>Namnen är dina. Källkontraktet ligger fast.</span></p></div></aside> : null}
      <main id="workspace" className={`workspace view-${view}`}><div className="workspace-breadcrumb"><span>Blackjack</span><span>/</span><span>{dealer.label}</span><span>/</span><strong>{view === 'lab' ? event.label : view === 'tree' ? 'Nodträdet' : view === 'videos' ? 'Videobanken' : view === 'guide' ? 'Guide' : 'OpenClaw'}</strong><span className="environment-badge"><i /> ISOLERAT LABB</span></div>{error ? <div className="feedback error" role="alert"><span>{error}</span><button className="icon-button" aria-label="Stäng felmeddelande" onClick={() => setError('')}>×</button></div> : null}{notice ? <div className="feedback success" role="status"><span>{notice}</span><button className="icon-button" aria-label="Stäng meddelande" onClick={() => setNotice('')}>×</button></div> : null}
        {incompatibleBindings.length ? <div className="feedback error" role="alert"><span><strong>{incompatibleBindings.length} animationskopplingar behöver rättas.</strong> Projektet innehåller äldre val som inte matchar spelhändelsen. Inget har ändrats automatiskt. Välj en kompatibel labbanimation för varje markerad variant innan du sparar eller testar.</span><button className="primary-button" onClick={openFirstIncompatibleBinding}>Rätta första kopplingen →</button></div> : null}
        {invalidVideoBindings.length ? <div className="feedback error" role="alert"><span>{invalidVideoBindings.length} videokopplingar behöver kategoriseras eller kopplas loss. Inga original har ändrats.</span><button className="text-button" onClick={() => changeView('videos')}>Granska i Videobanken →</button></div> : null}
        {view === 'tree' ? <EventTree project={project} inventory={videos} dealerId={dealerId} event={event} line={line} variant={variant} mode={mode} onSelectDealer={selectDealer} onSelectEvent={selectEvent} onSelectVariant={selectVariant} onEdit={tab => { setEditorTab(tab); changeView('lab'); }} onVideos={() => changeView('videos')} onOpenClaw={() => changeView('openclaw')} /> : view === 'videos' ? <VideoLibrary onInventory={next => { setVideos(next); invalidateSimulation(); }} project={project} onUploaded={uploadedVideo} onOpenEvent={id => { selectEvent(id); changeView('lab'); }} inventory={videos} dealer={dealer.label} eventLabel={event.label} line={line} variant={variant} onSelectVariant={selectVariant} onBind={id => updateVariant({ videoGenerationId: id })} /> : view === 'guide' ? <StudioGuide onNavigate={changeView} /> : view === 'openclaw' ? <GatewayPanel status={initialStatus} mode={mode} onModeChange={changeMode} dealerId={dealerId} dirty={dirty} /> : <div className="editor-layout"><div className="preview-column"><div className="event-heading"><div><span className="eyebrow">01 / EVENTSTUDION</span><h1>{event.label}</h1><p>{event.description}</p></div><span className="source-tag">{event.sourceType}<span>källtyp · labbindelning</span></span></div><div ref={mainStage} className={socialStyles.stageAnchor}><Stage event={event} asset={currentAsset} dealer={dealer.label} variantLabel={socialAsset?.label ?? result?.variant?.label ?? variant.label} playId={playId} playing={playing} hasResult={Boolean(result)} previewing={Boolean(previewKind) && playing} busy={simulating} videoUrl={selectedVideo?.previewUrl} videoName={selectedVideo?.label} videoMissing={Boolean(previewVideoId && !selectedVideo)} onPlay={() => void simulate()} onPreview={previewSelected} onPlaybackEnd={() => setPlaying(false)} /><div className={socialStyles.sceneReply} aria-live="polite" aria-atomic="true">{socialReply ? <><div><span className="eyebrow">ASTRID · SOCIALT LABBSVAR</span><p>{socialReply}</p><small>Separat social presentation, inte ett nytt spel-event eller godkänd läppsynk.</small></div><button className="text-button" type="button" onClick={() => scrollTo(socialChat.current)}>Visa chatten ↓</button></> : <span>Spela vald variant visar ditt val direkt. Testa event provar villkoren.</span>}</div></div>
          <EventTestPanel open={testToolsOpen} onOpen={setTestToolsOpen} mode={mode} onMode={changeMode} configured={Boolean(initialStatus.configured)} context={context} onContext={changeContext} dealer={dealer.label} eventLabel={event.label} sourceType={event.sourceType} result={result} previewKind={previewKind} busy={simulating} onRun={() => void simulate()} />{dealerId === 'astrid' && event.id === 'idle.ready' ? <div ref={socialChat} className={socialStyles.chatAnchor}><SocialChatPanel draftCache={socialDraftCache} dealerId={dealerId} eventId={event.id} registerCancel={registerSocialCancel} onBegin={() => invalidateSimulation(false)} onReaction={playSocialReaction} onGoToIdle={goToAstridIdle} /></div> : <button type="button" className="text-button social-entry" onClick={goToAstridIdle}>Prova spelarchatten → Astrids vänteläge</button>}<div className="workspace-footnote">Testmiljö, inte ett spel om pengar. RNG, regler och utbetalningar är alltid utanför studion.</div>
        </div><aside className="inspector"><div className="inspector-heading"><span className="eyebrow">BYGG PRESENTATIONEN</span><h2>Redigera vald nod</h2><p>Samma nod som i nodträdet: {dealer.label} / {event.label}.</p></div><div className="inspector-tabs" role="tablist" aria-label="Redigera event"><button role="tab" aria-selected={editorTab === 'event'} onClick={() => setEditorTab('event')}>Event</button><button role="tab" aria-selected={editorTab === 'variants'} onClick={() => setEditorTab('variants')}>Varianter <span>{line.variants.length}</span></button><button role="tab" aria-selected={editorTab === 'triggers'} onClick={() => setEditorTab('triggers')}>Triggers</button></div>
          <div className="inspector-content">{editorTab === 'event' ? <div><label className="field">Eventets visningsnamn<input value={event.label} maxLength={120} onChange={e => updateProject(draft => { draft.events.find(item => item.id === event.id)!.label = e.target.value; })} /></label><p className="helper">Samma labbnamn för alla fyra croupierer. Motorns typer och ID:n ligger fast.</p>{event.id === 'speak.other' ? <p className="notice subtle">Den här labbnoden samlar flera exakta replik-ID:n. En generisk videokoppling här är bara ett labbexempel — den kan inte användas som gemensam talvideo för alla repliker i spelet.</p> : null}<label className="field">Beskrivning<textarea rows={4} value={event.description} maxLength={600} onChange={e => updateProject(draft => { draft.events.find(item => item.id === event.id)!.description = e.target.value; })} /></label><label className="field">Linjens namn<input value={line.label} maxLength={120} onChange={e => updateProject(draft => { draft.lines.find(item => item.dealerId === dealerId && item.eventId === event.id)!.label = e.target.value; })} /></label><p className="helper">Linjen samlar standard och alternativ för just {dealer.label}.</p><div className="protected-contract"><span className="eyebrow">LÅST KÄLLKONTRAKT</span><code>{event.id}</code><p>Tekniskt event-ID och motorns fält ändras inte när du byter namn.</p><details className="technical-details"><summary>Se källeventets exempel</summary><pre>{JSON.stringify(event.exampleEvent, null, 2)}</pre></details></div></div> : editorTab === 'triggers' ? <TriggerEditor triggers={project.triggers} descriptors={allowedPathDescriptors} onChange={updateTrigger} onAdd={createTrigger} onRemove={id => { const count = project.lines.reduce((total, item) => total + item.variants.filter(v => v.triggerIds.includes(id)).length, 0); if (count > 0) { setError(`Triggern används av ${count} varianter. Koppla loss den uttryckligen under Varianter innan du tar bort den.`); return; } if (window.confirm('Ta bort denna oanvända trigger? Ändringen sparas först när du väljer Spara projekt.')) modelEdit(value => removeTrigger(value, id)); }} /> : <div><div className="variant-list">{line.variants.map((item, index) => <button key={item.id} className={`variant-option ${variant.id === item.id ? 'active' : ''}`} onClick={() => selectVariant(item.id)}><span className="variant-number">{String(index).padStart(2, '0')}</span><span><strong>{item.label}</strong><small>{item.id === line.baselineVariantId ? 'Standard · alltid tillåten' : result ? eligibleIds.has(item.id) ? 'Tillåten i senaste testet' : 'Ej valbar i detta läge' : `${item.triggerIds.length} triggers · prioritet ${item.priority}`}</small></span>{item.id === line.baselineVariantId ? <span className="baseline-mark" title="Skyddad standardvariant">◇</span> : null}</button>)}</div><button className="text-button add-variant" disabled={line.variants.length >= MAX_ALTERNATIVES + 1} onClick={() => { try { const next = addVariant(project, dealerId, event.id, `Alternativ ${line.variants.length}`); setProject(next); setVariantId(next.lines.find(item => item.dealerId === dealerId && item.eventId === event.id)!.variants.at(-1)!.id); invalidateSimulation(); setError(''); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Varianten kunde inte skapas.'); } }}>＋ Lägg till variant <span>{line.variants.length - 1}/{MAX_ALTERNATIVES}</span></button><div className="variant-form"><span className="eyebrow">{isBaseline ? 'REDIGERA STANDARDVARIANT' : 'REDIGERA ALTERNATIV'}</span><label className="field">Variantens namn<input value={variant.label} maxLength={120} onChange={e => updateVariant({ label: e.target.value })} /></label><VariantVideoBinding key={variant.id} inventory={videos} dealerId={dealerId} eventId={event.id} variant={variant} isBaseline={isBaseline} onBind={id => updateVariant({ videoGenerationId: id })} onInspect={() => changeView('videos')} />{!isBaseline ? <VariantSelectionEditor variant={variant} onChange={selection => updateVariant({ selection })} /> : null}<details className="reserve-editor"><summary>2D-reserv</summary><label className="field">2D-rörelse när video saknas<select value={variant.assetId} aria-invalid={!selectedAnimationCompatible} onChange={e => updateVariant({ assetId: e.target.value })}>{!selectedAnimationCompatible ? <option value={variant.assetId} disabled>{selectedAsset?.label ?? variant.assetId} · behöver bytas (matchar inte eventet)</option> : null}{project.assets.filter(asset => isAssetCompatible(event, asset)).map(asset => <option value={asset.id} key={asset.id}>{asset.label} · {asset.animation}</option>)}</select></label></details>{!isBaseline ? <label className="field">Prioritet <span className="optional">Högre väljs först i regelläget</span><input type="number" value={variant.priority} min={-100} max={100} onChange={e => updateVariant({ priority: Number(e.target.value) })} /></label> : null}{isBaseline ? <div className="notice subtle"><strong>Din säkra standard.</strong><p>Den har inga villkor och kan inte tas bort. Om ett modellval fallerar finns den alltid kvar.</p></div> : <fieldset className="trigger-assignment"><legend>Vilka triggers måste matcha?</legend><p className="helper">Alla valda villkor måste vara sanna. Inga valda = inga extra villkor. Urvalstillåtelsen gäller fortfarande.</p>{project.triggers.map(trigger => <label className="check-field" key={trigger.id}><input type="checkbox" checked={variant.triggerIds.includes(trigger.id)} onChange={e => updateVariant({ triggerIds: e.target.checked ? [...variant.triggerIds, trigger.id] : variant.triggerIds.filter(id => id !== trigger.id) })} /><span>{trigger.label}<small>{categoryLabels[trigger.category]}</small></span></label>)}<button type="button" className="text-button" onClick={() => setEditorTab('triggers')}>Hantera triggerbiblioteket →</button></fieldset>}<code className="technical-id">{variant.id}</code>{!isBaseline ? <button className="danger-button" onClick={() => { modelEdit(value => removeVariant(value, dealerId, event.id, variant.id)); setVariantId(line.baselineVariantId); }}>Ta bort alternativ</button> : null}</div></div>}</div><div className="inspector-footer"><i className={dirty ? 'unsaved-dot' : 'saved-dot'} />{dirty ? 'Utkast · spara när du är nöjd' : 'Projekt sparat lokalt'}<span>JSON, inte dold konfiguration.</span></div></aside></div>}
      </main></div><footer className="studio-footer"><span>CROUPIER LAB <span className="footer-version">/ FIRST EDITION</span></span><span>Spel → Eventgrupp → Dealerlinje → Variant → Fil</span><span>{initialStatus.configured ? 'OpenClaw konfigurerat' : 'Lokalt regelläge'}</span></footer>
  </div>;
}
