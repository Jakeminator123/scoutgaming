'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { addVariant, allowedPathDescriptors, MAX_ALTERNATIVES, removeTrigger, removeVariant } from '../lib/studio-model.mjs';
import type { DealerId, StudioProject, StudioTrigger, StudioVariant, TriggerCategory } from '../lib/studio-model.mjs';
import { Stage } from './stage';
import { TriggerEditor, categoryLabels, defaultValue } from './trigger-editor';
import { VideoLibrary } from './video-library';
import { GatewayPanel, ModeSelector, modeLabels } from './gateway-panel';
import { TestContextPanel, neutralContext } from './test-context';
import { requestJson, viewPaths } from './studio-types';
import type { ConnectionStatus, DirectorMode, SimulationResult, StudioView, TestContext, VideoInventory } from './studio-types';

const sourceLabels: Record<string, string> = { speak: 'Repliker', deal: 'Kortdelning', reveal: 'Kortvändning', turn: 'Spelarens tur', settle: 'Resultat', idle: 'Vänteläge' };
const sourceSymbols: Record<string, string> = { speak: '◌', deal: '▱', reveal: '◇', turn: '◎', settle: '✦', idle: '◷' };
const navigation: { id: StudioView; label: string; number: string }[] = [{ id: 'lab', label: 'Eventstudion', number: '01' }, { id: 'videos', label: 'Videobanken', number: '02' }, { id: 'openclaw', label: 'OpenClaw', number: '03' }];
const reasonDescriptions: Record<string, string> = {
  deterministic_rules: 'Högst prioriterade variant med matchande villkor valdes. Ingen modell behövdes.',
  ai_disabled: 'Standardläget spelar alltid din säkra standardvariant. Ingen modell kontaktades.',
  accepted: 'OpenClaw valde en variant som klarade dina regler och serverns kontroll.',
  shadow_only: 'OpenClaws förslag klarade kontrollen. Skuggläget spelar ändå standardvarianten.',
  no_advice: 'Inget giltigt modellförslag kom fram. Din säkra standardvariant används.',
  abstained: 'OpenClaw avstod från att välja. Din säkra standardvariant används.',
  invalid_advice_shape: 'Modellsvaret hade fel format. Standardvarianten skyddar presentationen.',
  request_mismatch: 'Svaret hörde inte till detta test och ignorerades. Standardvarianten används.',
  catalog_mismatch: 'Svaret gällde en annan policyversion och ignorerades. Standardvarianten används.',
  ineligible_variant: 'Förslaget matchade inte dina tillåtna varianter. Standardvarianten används.',
};
const providerDescriptions: Record<string, string> = {
  off: 'Lokalt · ingen modell', deterministic_rules: 'Lokal regelmotor', responded: 'OpenClaw svarade',
  remote_unavailable_baseline: 'Render kunde inte lämna ett råd · säker standard',
  openclaw_not_configured: 'OpenClaw är inte anslutet · säker standard',
  openclaw_timeout: 'OpenClaw svarade inte i tid · säker standard',
  openclaw_unreachable: 'OpenClaw kunde inte nås · säker standard',
};

export function Studio({ initialProject, initialVideos, initialStatus, initialView = 'lab' }: { initialProject: StudioProject; initialVideos: VideoInventory; initialStatus: ConnectionStatus; initialView?: StudioView }) {
  const [project, setProject] = useState(initialProject);
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(initialProject));
  const [view, setView] = useState<StudioView>(initialView);
  const [dealerId, setDealerId] = useState<DealerId>('astrid');
  const [eventId, setEventId] = useState(initialProject.events[0].id);
  const [variantId, setVariantId] = useState('');
  const [editorTab, setEditorTab] = useState<'event' | 'variants' | 'triggers'>('variants');
  const [mode, setMode] = useState<DirectorMode>('rules');
  const [context, setContext] = useState<TestContext>(() => structuredClone(neutralContext));
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [playId, setPlayId] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [filter, setFilter] = useState('');
  const simulationRun = useRef(0);

  const projectJson = useMemo(() => JSON.stringify(project), [project]);
  const dirty = projectJson !== savedJson;
  const event = project.events.find(item => item.id === eventId) ?? project.events[0];
  const line = project.lines.find(item => item.dealerId === dealerId && item.eventId === event.id)!;
  const variant = line.variants.find(item => item.id === variantId) ?? line.variants[0];
  const isBaseline = variant.id === line.baselineVariantId;
  const dealer = project.dealers.find(item => item.id === dealerId)!;
  const currentAsset = result?.asset ?? project.assets.find(item => item.id === variant.assetId);
  const eligibleIds = new Set((result?.eligible ?? []).map(item => typeof item === 'string' ? item : item.id ?? item.variantId));
  const visibleEvents = project.events.filter(item => `${item.label} ${item.id}`.toLocaleLowerCase('sv').includes(filter.toLocaleLowerCase('sv')));
  const selectedVideo = result?.videoGenerationId ? initialVideos.videos.find(item => item.id === result.videoGenerationId && item.available) : undefined;

  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) { if (dirty) { event.preventDefault(); event.returnValue = ''; } }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);
  useEffect(() => {
    function onPopState() { simulationRun.current++; setResult(null); setPlaying(false); setView(window.location.pathname.startsWith('/videos') ? 'videos' : window.location.pathname.startsWith('/openclaw') ? 'openclaw' : 'lab'); }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  useEffect(() => {
    if (!playing) return;
    const timeout = window.setTimeout(() => setPlaying(false), (currentAsset?.durationMs ?? 1700) + 400);
    return () => window.clearTimeout(timeout);
  }, [playing, playId, currentAsset?.durationMs]);

  function invalidateSimulation() { simulationRun.current++; setResult(null); setPlaying(false); }
  function changeView(next: StudioView) { invalidateSimulation(); setView(next); window.history.pushState(null, '', viewPaths[next]); }
  function updateProject(edit: (draft: StudioProject) => void) { setProject(current => { const draft = structuredClone(current); edit(draft); return draft; }); invalidateSimulation(); setError(''); setNotice(''); }
  function modelEdit(edit: (value: StudioProject) => StudioProject) {
    try { setProject(edit(project)); invalidateSimulation(); setError(''); setNotice(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Ändringen kunde inte göras.'); }
  }
  function updateVariant(patch: Partial<StudioVariant>) { updateProject(draft => { const target = draft.lines.find(item => item.dealerId === dealerId && item.eventId === event.id)!.variants.find(item => item.id === variant.id)!; Object.assign(target, patch); }); }
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
    if (simulating) return;
    const run = ++simulationRun.current;
    setSimulating(true); setError(''); setResult(null); setPlaying(false);
    try {
      const response = await requestJson<SimulationResult>('/api/simulate', { method: 'POST', body: JSON.stringify({ project, dealerId, eventId: event.id, context, mode }) });
      if (run !== simulationRun.current) { setNotice('Testets indata ändrades under körningen. Svaret visas inte; kör Testa event igen.'); return; }
      setResult(response);
      if (response.variant?.id) setVariantId(response.variant.id);
      setPlayId(current => current + 1); setPlaying(true);
    } catch (cause) { if (run === simulationRun.current) setError(cause instanceof Error ? cause.message : 'Testet kunde inte genomföras.'); }
    finally { setSimulating(false); }
  }

  function exportProject() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'croupier-lab-project.json'; anchor.click(); URL.revokeObjectURL(url);
    setNotice('JSON exporterad. Filen innehåller labbpolicyer, inte hemligheter eller videofiler.');
  }

  return <div className="studio-shell"><a className="skip-link" href="#workspace">Hoppa till arbetsytan</a><header className="studio-header"><a className="studio-brand" href="/" onClick={e => { e.preventDefault(); changeView('lab'); }}><span className="brand-mark" aria-hidden="true">C<span>↗</span></span><span>CROUPIER<small>DIRECTOR STUDIO</small></span></a><nav className="main-nav" aria-label="Huvudnavigation">{navigation.map(item => <a key={item.id} href={viewPaths[item.id]} className={view === item.id ? 'active' : ''} aria-current={view === item.id ? 'page' : undefined} onClick={e => { if (!e.ctrlKey && !e.metaKey && !e.shiftKey) { e.preventDefault(); changeView(item.id); } }}><span>{item.number}</span>{item.label}</a>)}</nav><div className="header-actions"><span className={`save-state ${dirty ? 'dirty' : ''}`}><i />{dirty ? 'Osparade ändringar' : 'Sparat lokalt'}</span><button className="icon-button export-button" title="Exportera projekt som JSON" aria-label="Exportera projekt som JSON" onClick={exportProject}>↓</button><button className="primary-button" disabled={!dirty || saving} onClick={() => void save()}>{saving ? 'Sparar…' : 'Spara projekt'}</button></div></header>
    <div className="studio-body"><aside className="event-sidebar"><div className="sidebar-top"><div className="eyebrow">DITT LABB <span>LOCAL / 01</span></div><div className="game-selector"><button className="active" aria-pressed="true"><span aria-hidden="true">♠</span> Blackjack</button><button disabled title="Roulette är inte implementerat">Roulette <small>Senare</small></button></div><label className="dealer-selector"><span className="eyebrow">CROUPIER</span><select value={dealerId} onChange={e => selectDealer(e.target.value as DealerId)}>{project.dealers.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label className="search-field sidebar-search"><span aria-hidden="true">⌕</span><input placeholder="Hitta ett event…" aria-label="Sök event" value={filter} onChange={e => setFilter(e.target.value)} /></label></div><div className="event-tree"><div className="tree-title"><span>EVENTTRÄD</span><span>{project.events.length}</span></div>{Object.keys(sourceLabels).map(source => { const items = visibleEvents.filter(item => item.sourceType === source); return items.length ? <div className="event-group" key={source}><div className="event-group-title"><span>{sourceSymbols[source]}</span>{sourceLabels[source]}<code>{source}</code></div>{items.map(item => <button className={`event-node ${event.id === item.id ? 'active' : ''}`} key={item.id} onClick={() => selectEvent(item.id)}><i /><span>{item.label}</span>{event.id === item.id ? <span className="node-arrow">↗</span> : null}</button>)}</div> : null; })}{!visibleEvents.length ? <p className="helper">Inga event matchar sökningen.</p> : null}</div><div className="sidebar-footer"><span className="sidebar-foot-icon" aria-hidden="true">⌘</span><p><strong>6 motortyper. 16 labbevent.</strong><span>Namnen är dina. Källkontraktet ligger fast.</span></p></div></aside>
      <main id="workspace" className={`workspace view-${view}`}><div className="workspace-breadcrumb"><span>Blackjack</span><span>/</span><span>{dealer.label}</span><span>/</span><strong>{view === 'lab' ? event.label : view === 'videos' ? 'Videobanken' : 'OpenClaw'}</strong><span className="environment-badge"><i /> ISOLERAT LABB</span></div>{error ? <div className="feedback error" role="alert"><span>{error}</span><button className="icon-button" aria-label="Stäng felmeddelande" onClick={() => setError('')}>×</button></div> : null}{notice ? <div className="feedback success" role="status"><span>{notice}</span><button className="icon-button" aria-label="Stäng meddelande" onClick={() => setNotice('')}>×</button></div> : null}
        {view === 'videos' ? <VideoLibrary inventory={initialVideos} dealer={dealer.label} eventLabel={event.label} line={line} variant={variant} onSelectVariant={selectVariant} onBind={id => updateVariant({ videoGenerationId: id })} /> : view === 'openclaw' ? <GatewayPanel status={initialStatus} mode={mode} onModeChange={changeMode} dealerId={dealerId} dirty={dirty} /> : <div className="editor-layout"><div className="preview-column"><div className="event-heading"><div><span className="eyebrow">01 / EVENTSTUDION</span><h1>{event.label}</h1><p>{event.description}</p></div><span className="source-tag">{event.sourceType}<span>verifierad källtyp</span></span></div><Stage event={event} asset={currentAsset} dealer={dealer.label} variantLabel={result?.variant?.label ?? variant.label} playId={playId} playing={playing} hasResult={Boolean(result)} busy={simulating} videoUrl={selectedVideo?.previewUrl} videoName={selectedVideo?.label} onPlay={() => void simulate()} />
          <section className="decision-section"><div className="section-heading"><div><span className="eyebrow">SÅ TAS BESLUTET</span><h2>En tydlig kedja, hela vägen.</h2></div><span className="mini-badge">{modeLabels[mode]}</span></div><div className="decision-chain"><div className="chain-node"><span>01 · SPELMOTORN</span><strong>{event.sourceType}</strong><small>Bestämmer vad som hänt</small></div><span className="chain-arrow" aria-hidden="true">→</span><div className="chain-node"><span>02 · DINA REGLER</span><strong>{result ? eligibleIds.size : line.variants.length} {result ? 'tillåtna' : 'varianter'}</strong><small>Standard + matchande triggers</small></div><span className="chain-arrow" aria-hidden="true">→</span><div className={`chain-node ${mode === 'active' || mode === 'shadow' ? 'claw-node' : ''}`}><span>03 · VAL & KONTROLL</span><strong>{modeLabels[mode]}</strong><small>{mode === 'rules' || mode === 'off' ? 'Ingen modell behövs' : 'Endast inom din ram'}</small></div><span className="chain-arrow" aria-hidden="true">→</span><div className="chain-node"><span>04 · PRESENTATION</span><strong>{(result?.videoGenerationId ?? variant.videoGenerationId) ? 'Videokoppling' : 'Labbanimation'}</strong><small>En specifik variant / fil</small></div></div><ModeSelector mode={mode} onChange={changeMode} configured={Boolean(initialStatus.configured)} compact />
            {result ? <div className="decision-result" role="status"><span className="result-marker">✓</span><div><strong>{result.variant?.label ?? 'Beslut klart'}</strong><p>{reasonDescriptions[result.decision?.reason ?? ''] ?? 'Beslutet är kontrollerat. Den tekniska orsaken finns i beslutsspåret nedan.'}</p><span>{providerDescriptions[result.provider ?? ''] ?? 'Se anslutningsstatus i det tekniska beslutsspåret'}</span>{result.videoGenerationId ? <p className="helper">Exakt videokoppling: <code>{result.videoGenerationId}</code>. Välj Videofil i scenen för att spela just detta original, enbart som labbförhandsvisning.</p> : null}</div></div> : <div className="decision-hint"><span aria-hidden="true">↳</span> Tryck på <strong>Testa event</strong> för att se vilka regler som matchar och varför en variant väljs.</div>}
            {result ? <details className="technical-details"><summary>Visa exakt beslutsspår</summary><pre>{JSON.stringify(result, null, 2)}</pre></details> : null}
          </section><TestContextPanel value={context} onChange={changeContext} /><div className="workspace-footnote">Testmiljö, inte ett spel om pengar. RNG, regler och utbetalningar är alltid utanför studion.</div>
        </div><aside className="inspector"><div className="inspector-heading"><span className="eyebrow">BYGG PRESENTATIONEN</span><h2>Din regi</h2><p>För {dealer.label} / {event.label}</p></div><div className="inspector-tabs" role="tablist" aria-label="Redigera event"><button role="tab" aria-selected={editorTab === 'event'} onClick={() => setEditorTab('event')}>Event</button><button role="tab" aria-selected={editorTab === 'variants'} onClick={() => setEditorTab('variants')}>Varianter <span>{line.variants.length}</span></button><button role="tab" aria-selected={editorTab === 'triggers'} onClick={() => setEditorTab('triggers')}>Triggers</button></div>
          <div className="inspector-content">{editorTab === 'event' ? <div><label className="field">Eventets visningsnamn<input value={event.label} maxLength={120} onChange={e => updateProject(draft => { draft.events.find(item => item.id === event.id)!.label = e.target.value; })} /></label><p className="helper">Samma eventnamn för alla fyra croupierer.</p><label className="field">Beskrivning<textarea rows={4} value={event.description} maxLength={600} onChange={e => updateProject(draft => { draft.events.find(item => item.id === event.id)!.description = e.target.value; })} /></label><label className="field">Standardlinjens namn<input value={line.label} maxLength={120} onChange={e => updateProject(draft => { draft.lines.find(item => item.dealerId === dealerId && item.eventId === event.id)!.label = e.target.value; })} /></label><p className="helper">Linjen samlar standard och alternativ för just {dealer.label}.</p><div className="protected-contract"><span className="eyebrow">LÅST KÄLLKONTRAKT</span><code>{event.id}</code><p>Tekniskt event-ID och motorns fält ändras inte när du byter namn.</p><details className="technical-details"><summary>Se källeventets exempel</summary><pre>{JSON.stringify(event.exampleEvent, null, 2)}</pre></details></div></div> : editorTab === 'triggers' ? <TriggerEditor triggers={project.triggers} descriptors={allowedPathDescriptors} onChange={updateTrigger} onAdd={createTrigger} onRemove={id => { const count = project.lines.reduce((total, item) => total + item.variants.filter(v => v.triggerIds.includes(id)).length, 0); if (count > 0) { setError(`Triggern används av ${count} varianter. Koppla loss den uttryckligen under Varianter innan du tar bort den.`); return; } if (window.confirm('Ta bort denna oanvända trigger? Ändringen sparas först när du väljer Spara projekt.')) modelEdit(value => removeTrigger(value, id)); }} /> : <div><div className="variant-list">{line.variants.map((item, index) => <button key={item.id} className={`variant-option ${variant.id === item.id ? 'active' : ''}`} onClick={() => selectVariant(item.id)}><span className="variant-number">{String(index).padStart(2, '0')}</span><span><strong>{item.label}</strong><small>{item.id === line.baselineVariantId ? 'Standard · alltid tillåten' : result ? eligibleIds.has(item.id) ? 'Tillåten i senaste testet' : 'Villkoren matchade inte' : `${item.triggerIds.length} triggers · prioritet ${item.priority}`}</small></span>{item.id === line.baselineVariantId ? <span className="baseline-mark" title="Skyddad standardvariant">◇</span> : null}</button>)}</div><button className="text-button add-variant" disabled={line.variants.length >= MAX_ALTERNATIVES + 1} onClick={() => { try { const next = addVariant(project, dealerId, event.id, `Alternativ ${line.variants.length}`); setProject(next); setVariantId(next.lines.find(item => item.dealerId === dealerId && item.eventId === event.id)!.variants.at(-1)!.id); invalidateSimulation(); setError(''); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Varianten kunde inte skapas.'); } }}>＋ Lägg till variant <span>{line.variants.length - 1}/{MAX_ALTERNATIVES}</span></button><div className="variant-form"><span className="eyebrow">{isBaseline ? 'REDIGERA STANDARDVARIANT' : 'REDIGERA ALTERNATIV'}</span><label className="field">Variantens namn<input value={variant.label} maxLength={120} onChange={e => updateVariant({ label: e.target.value })} /></label><label className="field">Labbanimation<select value={variant.assetId} onChange={e => updateVariant({ assetId: e.target.value })}>{project.assets.map(asset => <option value={asset.id} key={asset.id}>{asset.label} · {asset.animation}</option>)}</select></label>{!isBaseline ? <label className="field">Prioritet <span className="optional">Högre väljs först i regelläget</span><input type="number" value={variant.priority} min={-100} max={100} onChange={e => updateVariant({ priority: Number(e.target.value) })} /></label> : null}<div className="variant-binding"><span className="eyebrow">VIDEOMÅL</span><strong>{variant.videoGenerationId ? 'Ett exakt original är kopplat' : 'Labbanimation tills vidare'}</strong>{variant.videoGenerationId ? <code>{variant.videoGenerationId}</code> : null}<button className="text-button" onClick={() => changeView('videos')}>{variant.videoGenerationId ? 'Se / byt video' : 'Koppla en video'} ↗</button></div>{isBaseline ? <div className="notice subtle"><strong>Din säkra standard.</strong><p>Den har inga villkor och kan inte tas bort. Om ett modellval fallerar finns den alltid kvar.</p></div> : <fieldset className="trigger-assignment"><legend>Vilka triggers måste matcha?</legend><p className="helper">Alla valda villkor måste vara sanna. Inga valda = alltid tillåten.</p>{project.triggers.map(trigger => <label className="check-field" key={trigger.id}><input type="checkbox" checked={variant.triggerIds.includes(trigger.id)} onChange={e => updateVariant({ triggerIds: e.target.checked ? [...variant.triggerIds, trigger.id] : variant.triggerIds.filter(id => id !== trigger.id) })} /><span>{trigger.label}<small>{categoryLabels[trigger.category]}</small></span></label>)}<button type="button" className="text-button" onClick={() => setEditorTab('triggers')}>Hantera triggerbiblioteket →</button></fieldset>}<code className="technical-id">{variant.id}</code>{!isBaseline ? <button className="danger-button" onClick={() => { modelEdit(value => removeVariant(value, dealerId, event.id, variant.id)); setVariantId(line.baselineVariantId); }}>Ta bort alternativ</button> : null}</div></div>}</div><div className="inspector-footer"><i className={dirty ? 'unsaved-dot' : 'saved-dot'} />{dirty ? 'Utkast · spara när du är nöjd' : 'Projekt sparat lokalt'}<span>JSON, inte dold konfiguration.</span></div></aside></div>}
      </main></div><footer className="studio-footer"><span>CROUPIER LAB <span className="footer-version">/ FIRST EDITION</span></span><span>Spel → Croupier → Event → Linje → Variant → Fil</span><span>{initialStatus.configured ? 'OpenClaw konfigurerat' : 'Lokalt regelläge'}</span></footer>
  </div>;
}
