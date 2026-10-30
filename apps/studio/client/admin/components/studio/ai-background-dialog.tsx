'use client';
import {Check, ImagePlus, Layers, RefreshCw, Sparkles} from 'lucide-react';
import {useEffect, useMemo, useRef, useState} from 'react';
import type {StudioProject} from '../../../../../../packages/presentation/contracts/studio-model.mjs';
import type {CompositionSettings} from '../../../../../../packages/presentation/contracts/composition-settings.mjs';
import {AI_IMAGE_MAX_PROPOSALS, AI_IMAGE_PRESETS, AI_IMAGE_PROMPT_LENGTH, AI_IMAGE_REFERENCE_TYPES, aiImageLabel, type AiImagePresetId} from '../../../../lib/ai-image-contract.mjs';
import {adoptInRoom, adoptInTemplate, aiImageErrorMessage, aiReferenceMaterials, aiSceneTemplates, aiTableDealers, aiTableShapePreview, aiTableWidthSuggestion, prepareMaterialReference, prepareReferenceImage, readAiImageStatus,
  registerAiProposal, requestAiProposals, type AiAdoptMaterial, type AiImageStatus, type AiProposal, type AiSceneTemplate} from '../../lib/ai-background.mjs';
import type {AiTableFit} from '../../../../lib/ai-image-contract.mjs';
import {layerUploadFailureMessage} from '../../../../../../packages/presentation/contracts/layer-upload-errors.mjs';
import type {VideoInventory} from '../../lib/connected-studio.mjs';
import {AiLandingBadge, AiProposalPreview} from './ai-proposal-preview';
import {Dialog} from '../ui/dialog';
import {Checkbox, Label} from '../ui/form';
import {Button, buttonVariants, cn} from '../ui/kit';

/** The spelbord the dialog was opened from (Admin › spelbordet › Utseende). */
export type AiDialogRoom = {id: string; name: string; operatorId: string; compositionId: string};
export type AiBackgroundDialogProps = {
  /** Bakgrund (default) or filmed-dealer bordsgrafik. */
  role?: 'background' | 'table';
  /** Table graphics exist only for Blackjack dealers with a filmed profile. */
  game?: 'blackjack' | 'roulette';
  /** Registered dealers; table mode lists those with a filmed profile. */
  dealers?: readonly {id: string; label: string}[];
  /** Scene templates (project.lanes); a table is drawn for one template's composition. */
  templates?: readonly AiSceneTemplate[];
  /** The saved project and video register for the preview on a scene template (background, dealer, table). */
  project?: StudioProject | null;
  inventory?: VideoInventory | null;
  /** Opened from a spelbord: "Använd" can also publish it there (steg D). */
  room?: AiDialogRoom | null;
  /** Saves the project draft (connected-studio save); needed for "Använd i miljön" without a spelbord. */
  saveProject?: (project: StudioProject, signal?: AbortSignal) => Promise<StudioProject>;
  disabled?: boolean;
  onRegistered: (project: StudioProject, id: string) => void;
  onBusyChange?: (busy: boolean) => void;
};

type Phase = 'form' | 'generating' | 'results' | 'saving';
type Role = 'background' | 'table';
// What a generation was drawn for; "Använd" adopts exactly that.
type Drawn = {theme: boolean; templateId: string; tableWidth: {mobile: number; desktop: number} | null; composition: CompositionSettings | undefined};
const PUBLICATION_NOTE = 'Bilden hamnar i materialbiblioteket. Inget bolag ser den förrän den ligger i en miljö som publiceras.';
const UNSUPPORTED = 'Bordsgrafik med AI kräver Blackjack och en dealer med filmad profil.';
const field = 'min-w-0 w-full rounded-lg border border-sg-border bg-sg-surface px-3 py-2 text-[13.5px] text-sg-text';
const notice = 'm-0 rounded-lg border border-sg-border bg-sg-surface-2 p-3';
const percent = (value: number) => value.toLocaleString('sv-SE', {maximumFractionDigits: 1}) + ' %';
const share = (value: number) => Math.round(value * 100) + ' %';

// Proposals are drafts in this dialog only. "Använd" registers the chosen ones through the existing
// layer-asset upload and, when asked, allows them in the scene template as its defaults; from a
// spelbord the server also publishes the room in the same transaction.
export function AiBackgroundDialog({role = 'background', game = 'blackjack', dealers = [], templates = [], project = null, inventory = null, room = null, saveProject, disabled = false, onRegistered, onBusyChange}: AiBackgroundDialogProps) {
  const table = role === 'table', filmed = aiTableDealers(dealers), unsupported = table && (game !== 'blackjack' || filmed.length === 0);
  const [open, setOpen] = useState(false), [phase, setPhase] = useState<Phase>('form');
  const [status, setStatus] = useState<AiImageStatus | null>(null), [statusError, setStatusError] = useState('');
  const [prompt, setPrompt] = useState(''), [preset, setPreset] = useState<AiImagePresetId>('dark-luxury'), [count, setCount] = useState(2);
  const [dealerId, setDealerId] = useState(''), [templateId, setTemplateId] = useState(''), [reference, setReference] = useState<string | null>(null), [referenceName, setReferenceName] = useState('');
  const [referenceBusy, setReferenceBusy] = useState(false), referenceRequest = useRef<AbortController | null>(null);
  const [fitWidth, setFitWidth] = useState(true), [adopt, setAdopt] = useState(true), [drawn, setDrawn] = useState<Drawn | null>(null);
  const [proposals, setProposals] = useState<Record<Role, AiProposal[]>>({table: [], background: []});
  const [selected, setSelected] = useState<Record<Role, string | null>>({table: null, background: null}), [fit, setFit] = useState<AiTableFit | null>(null);
  const [error, setError] = useState(''), [progress, setProgress] = useState<number | null>(null), [confirmation, setConfirmation] = useState('');
  const request = useRef<AbortController | null>(null), mounted = useRef(true), busyCallback = useRef(onBusyChange);
  busyCallback.current = onBusyChange;
  const busy = phase === 'generating' || phase === 'saving' || referenceBusy;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; request.current?.abort(); referenceRequest.current?.abort(); busyCallback.current?.(false); }; }, []);
  useEffect(() => { busyCallback.current?.(busy); }, [busy]);
  const filmedIds = filmed.map(row => row.id).join(',');
  useEffect(() => { const ids = filmedIds ? filmedIds.split(',') : []; if (table && !ids.includes(dealerId)) setDealerId(ids[0] ?? ''); }, [table, filmedIds, dealerId]);
  // Default: the spelbord's own scene template, else the first that allows the chosen dealer; '' = the composition defaults.
  const scenes = aiSceneTemplates(templates, dealerId), sceneIds = scenes.map(row => row.id).join(','), roomTemplate = room?.compositionId ?? '';
  useEffect(() => { const ids = sceneIds ? sceneIds.split(',') : []; setTemplateId(current => ids.includes(current) ? current : ids.includes(roomTemplate) ? roomTemplate : ids[0] ?? ''); }, [sceneIds, roomTemplate]);
  const scene = scenes.find(row => row.id === templateId) ?? null;
  // A background is previewed on any scene template; a table on the one it is drawn for.
  const [previewId, setPreviewId] = useState(''), templateIds = templates.map(row => row.id).join(',');
  useEffect(() => { const ids = templateIds ? templateIds.split(',') : []; setPreviewId(current => ids.includes(current) ? current : ids.includes(roomTemplate) ? roomTemplate : ids[0] ?? ''); }, [templateIds, roomTemplate]);
  useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();
    setStatusError('');
    readAiImageStatus({signal: controller.signal}).then(value => { if (!controller.signal.aborted) setStatus(value); })
      .catch(cause => { if (!controller.signal.aborted) setStatusError(aiImageErrorMessage(cause)); });
    return () => controller.abort();
  }, [open]);

  // The table follows the dealer's reach: the boxes fill 70-80 % of its width, written to the template's Bordsbredd %.
  const suggestion = useMemo(() => table && dealerId ? aiTableWidthSuggestion(dealerId, scene?.composition) : null, [table, dealerId, scene?.composition]);
  const widened = fitWidth && Boolean(suggestion?.changed);
  const drawComposition = widened ? suggestion!.suggested.composition : scene?.composition;
  const shape = useMemo(() => table ? aiTableShapePreview(dealerId, drawComposition, preset) : null, [table, dealerId, drawComposition, preset]);
  const libraryReferences = aiReferenceMaterials(project?.layerAssets, role);
  const noun = table ? 'bordsgrafik' : 'bakgrund', place = table ? 'Bordsgrafik' : 'Bakgrunder';
  const description = prompt.replace(/\s+/g, ' ').trim();
  const text = description || (preset !== 'free' ? AI_IMAGE_PRESETS.find(row => row.id === preset)?.label ?? '' : reference ? 'Följ inspirationsbildens färger och material.' : '');
  const off = status?.enabled === false, misconfigured = status?.enabled === true && status.problem === 'invalid_setting';
  const offline = status?.enabled === true && !status.configured && !misconfigured;
  const available = (theme: boolean) => status?.configured === true && status.remaining >= count * (theme ? 2 : 1);
  const ready = !referenceBusy && text.length >= AI_IMAGE_PROMPT_LENGTH.min && text.length <= AI_IMAGE_PROMPT_LENGTH.max && (!table || Boolean(shape)) && status !== null && !off && !misconfigured && !offline && !unsupported;
  const exhausted = status?.configured === true && !available(false);
  // Where "Använd" puts the material: the drawn table's template (a theme's background too), a background's preview template.
  const target = drawn ? (table ? drawn.templateId : previewId) : '';
  const targetLabel = templates.find(row => row.id === target)?.label ?? '';
  const publishRoom = Boolean(room && target && room.compositionId === target);
  const chosen = (kind: Role) => proposals[kind].find(row => row.id === selected[kind]) ?? null;

  function close(next: boolean) {
    if (next) { setOpen(true); setConfirmation(''); return; }
    request.current?.abort(); request.current = null;
    referenceRequest.current?.abort(); referenceRequest.current = null; setReferenceBusy(false);
    setOpen(false); setPhase('form'); setProposals({table: [], background: []}); setSelected({table: null, background: null}); setFit(null); setDrawn(null); setError(''); setProgress(null);
  }
  async function pickReference(source: File | {id: string; label: string} | undefined) {
    if (!source || busy) return;
    referenceRequest.current?.abort();
    const controller = new AbortController(); referenceRequest.current = controller;
    setError(''); setReferenceBusy(true);
    try {
      const material = 'id' in source;
      const value = material ? await prepareMaterialReference(source.id, {signal: controller.signal}) : await prepareReferenceImage(source);
      if (mounted.current && !controller.signal.aborted) { setReference(value); setReferenceName(material ? source.label : source.name); setPreset('free'); }
    } catch (cause) { if (mounted.current && !controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Inspirationsbilden kunde inte läsas.'); }
    finally { if (referenceRequest.current === controller) { referenceRequest.current = null; if (mounted.current) setReferenceBusy(false); } }
  }
  // One run: this role's proposals, and with a theme a table and a background from the same description, style and image.
  async function generate(theme = false) {
    if (!ready || busy || !available(theme)) return;
    const controller = new AbortController(); request.current = controller;
    const next: Drawn = {theme, templateId: scene?.id ?? '', tableWidth: table && widened ? suggestion!.suggested.tableWidth : null, composition: drawComposition};
    setPhase('generating'); setError(''); setProposals({table: [], background: []}); setSelected({table: null, background: null}); setFit(null); setDrawn(next);
    const sceneTemplate = scene || widened ? {id: scene?.id ?? 'standardplacering', composition: drawComposition} : null;
    const ask = (kind: Role) => requestAiProposals({role: kind, prompt: text, preset, count, ...(kind === 'table' ? {dealerId, sceneTemplate} : {}), reference}, {signal: controller.signal});
    const kinds: Role[] = theme ? ['table', 'background'] : [role];
    const results = await Promise.allSettled(kinds.map(ask));
    if (request.current === controller) request.current = null;
    if (!mounted.current || controller.signal.aborted) { if (mounted.current) { setError(aiImageErrorMessage(results.find(row => row.status === 'rejected')?.reason)); setPhase('form'); } return; }
    const found: Record<Role, AiProposal[]> = {table: [], background: []};
    const left: number[] = [], problems: unknown[] = [];
    for (const [index, row] of results.entries()) {
      if (row.status === 'rejected') { problems.push(row.reason); continue; }
      found[kinds[index]] = row.value.images; left.push(row.value.remaining);
      if (kinds[index] === 'table') setFit(row.value.fit);
    }
    if (!found.table.length && !found.background.length) { setError(aiImageErrorMessage(problems[0])); setPhase('form'); return; }
    setProposals(found); setSelected({table: found.table[0]?.id ?? null, background: found.background[0]?.id ?? null});
    if (problems.length) setError((theme ? 'En del av temat kunde inte skapas: ' : '') + aiImageErrorMessage(problems[0]));
    if (left.length) setStatus(current => current ? {...current, remaining: Math.min(...left)} : current);
    setPhase('results');
  }
  async function use() {
    const items = (drawn?.theme ? ['background', 'table'] as Role[] : [role]).map(kind => ({kind, proposal: chosen(kind)})).filter(row => row.proposal);
    if (!items.length || busy || !drawn) return;
    const controller = new AbortController(); request.current = controller;
    let commitStarted = false, latest: StudioProject | null = null;
    const ids: Partial<Record<Role, string>> = {};
    setPhase('saving'); setError(''); setProgress(null);
    try {
      for (const {kind, proposal} of items) {
        commitStarted = false;
        const saved = await registerAiProposal(proposal!, {role: kind, prompt: text, fit: kind === 'table' ? fit : null}, {signal: controller.signal,
          onUploadProgress: event => { if (mounted.current) setProgress(Math.round(event.percentage)); },
          onCommit: () => { commitStarted = true; }});
        latest = saved.project; ids[kind] = saved.id;
      }
    } catch (cause) {
      if (mounted.current) { setError(layerUploadFailureMessage(cause, {aborted: controller.signal.aborted, commitStarted})); setPhase('results'); setProgress(null); }
      if (request.current === controller) request.current = null;
      return;
    }
    if (!mounted.current || !latest) return;
    const own = ids[role];
    if (own) onRegistered(latest, own);
    const labels = items.map(({kind}) => `${kind === 'table' ? 'Bordsgrafik' : 'Bakgrunder'} som "${aiImageLabel(text, kind === 'table' ? fit : null)}"`).join(' och ');
    const materials: AiAdoptMaterial[] = items.map(({kind}) => ({role: kind, assetId: ids[kind]!}));
    const tableWidth = materials.some(row => row.role === 'table') ? drawn.tableWidth : null;
    let outcome = `Sparad i ${labels}. ${PUBLICATION_NOTE}`;
    if (adopt && target) {
      try {
        if (publishRoom && room) {
          const result = await adoptInRoom({operatorId: room.operatorId, roomId: room.id, compositionId: target, materials, tableWidth, expectedProjectRevision: latest.revision});
          outcome = result.ok
            ? `Sparad i ${labels}, tillåten och standard i miljön ${targetLabel} och publicerad i spelbordet ${room.name} (version ${result.receipt.packageRevision}).`
            : `Sparad i ${labels}, men inte publicerad: ${result.error}`;
        } else if (saveProject) {
          const saved = await adoptInTemplate({project: latest, compositionId: target, materials, tableWidth}, {save: saveProject, signal: controller.signal});
          if (own && mounted.current) onRegistered(saved, own);
          outcome = `Sparad i ${labels}, tillåten och standard i miljön ${targetLabel}${tableWidth ? ` med Bordsbredd ${percent(tableWidth.desktop * 100)} (dator) och ${percent(tableWidth.mobile * 100)} (mobil)` : ''}. Publicera spelbordet för att visa det för spelarna.`;
        }
      } catch (cause) {
        outcome = `Sparad i ${labels}, men miljön ändrades inte: ${cause instanceof Error ? cause.message : 'försök igen'}.`;
      }
    } else if (tableWidth) outcome += ` Bordet är ritat för Bordsbredd ${percent(tableWidth.desktop * 100)} (dator) och ${percent(tableWidth.mobile * 100)} (mobil); sätt dem i miljöns Avancerat innan du väljer det.`;
    if (request.current === controller) request.current = null;
    if (!mounted.current) return;
    setProgress(null); setConfirmation(outcome); close(false);
  }

  const theme = table;
  const footer = phase === 'saving' ? undefined : <>
    {phase === 'generating' ? <Button onClick={() => request.current?.abort()}>Avbryt</Button> : null}
    {phase === 'form' && theme ? <Button disabled={!ready || !available(true)} onClick={() => void generate(true)}><Layers aria-hidden="true" />Skapa bord + bakgrund</Button> : null}
    {phase === 'form' ? <Button variant="primary" disabled={!ready || exhausted} onClick={() => void generate(false)}><Sparkles aria-hidden="true" />Skapa förslag</Button> : null}
    {phase === 'results' ? <>
      <Button disabled={!ready || !available(Boolean(drawn?.theme))} onClick={() => void generate(Boolean(drawn?.theme))}><RefreshCw aria-hidden="true" />Skapa nya</Button>
      <Button variant="primary" disabled={!chosen('table') && !chosen('background')} onClick={() => void use()}><Check aria-hidden="true" />Använd</Button>
    </> : null}
  </>;
  const results = (kind: Role) => proposals[kind].length ? <div className="grid gap-2">
    <p className="m-0 font-medium">{drawn?.theme ? (kind === 'table' ? 'Välj bord' : 'Välj bakgrund') : 'Välj ett förslag'}</p>
    <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label={kind === 'table' ? 'Förslag på bord' : 'Förslag på bakgrund'}>
      {proposals[kind].map((row, index) => <button key={row.id} type="button" role="radio" aria-checked={selected[kind] === row.id} disabled={phase === 'saving'}
        className={cn('relative overflow-hidden rounded-lg border-2 bg-sg-surface-2', selected[kind] === row.id ? 'border-sg-lime' : 'border-sg-border')} onClick={() => setSelected(current => ({...current, [kind]: row.id}))}>
        <img src={row.dataUrl} alt={`Förslag ${index + 1}`} className="block h-auto w-full" />
        {selected[kind] === row.id ? <span className="absolute right-2 top-2 rounded-full bg-sg-lime p-1 text-sg-on-accent"><Check className="size-3.5" aria-hidden="true" /></span> : null}
        <AiLandingBadge role={kind} proposal={row} className="absolute bottom-2 left-2 max-w-[calc(100%-1rem)] truncate" />
      </button>)}
    </div>
  </div> : null;
  const shown: Role = drawn?.theme ? 'table' : role, preview = chosen(shown), companion = drawn?.theme ? chosen('background') : null;

  return <span className="inline-flex flex-col items-center gap-1">
    <Button variant="ink" aria-haspopup="dialog" disabled={disabled || unsupported} title={unsupported ? UNSUPPORTED : undefined} onClick={() => close(true)}>
      <Sparkles aria-hidden="true" />Skapa med AI
    </Button>
    <Dialog open={open} size="lg" busy={busy} ariaBusy={busy} onClose={() => close(false)} footer={footer} title={`Skapa ${noun} med AI`}
      description={<>AI tar fram förslag. Inget sparas förrän du väljer ett och klickar Använd. {PUBLICATION_NOTE}{table ? ' Insatsboxarna ritas av servern exakt där dealerns kort landar.' : ''}</>}>
      <div className="grid gap-4">
        {status === null && !statusError ? <p role="status" className="m-0 text-sg-muted">Kontrollerar bildtjänsten…</p> : null}
        {statusError ? <p role="alert" className="m-0 text-sg-danger">{statusError}</p> : null}
        {off ? <p role="status" className={notice}><strong>Inte påslaget.</strong> AI-bilder är avstängda på den här servern. Manuell uppladdning fungerar som vanligt.</p> : null}
        {misconfigured ? <p role="status" className={notice}><strong>AI-inställningen är ogiltig.</strong> Kontakta den som driftar Scoutgaming.</p> : null}
        {offline ? <p role="status" className={notice}><strong>Inte anslutet.</strong> OpenAI-nyckeln saknas på servern, så inga förslag kan skapas här ännu. Manuell uppladdning fungerar som vanligt.</p> : null}
        {status?.configured ? <p className="m-0 text-xs text-sg-muted">{status.remaining} av {status.dailyLimit} bilder kvar i dag på den här servern.</p> : null}
        {unsupported ? <p role="status" className={notice}>{UNSUPPORTED}</p> : null}
        {room ? <p className="m-0 text-xs text-sg-muted">Öppnad från spelbordet {room.name}.</p> : null}

        {phase === 'form' || phase === 'generating' ? <div className="grid gap-4">
          <label className="grid gap-1">
            <span className="font-medium">Beskriv {table ? 'bordet' : 'bakgrunden'} · valfritt med vald stil eller bild</span>
            <textarea className={field} rows={3} maxLength={AI_IMAGE_PROMPT_LENGTH.max} value={prompt} disabled={busy}
              placeholder={table ? 'T.ex. svart filt, tjock läderrail och guldkant' : 'T.ex. lugn kvällsstudio med mjukt sidoljus'} onChange={event => setPrompt(event.target.value)} />
            <span className="text-xs text-sg-muted">{description.length}/{AI_IMAGE_PROMPT_LENGTH.max} tecken. Beskriv färg, material och känsla. Perspektiv och storlek anpassas automatiskt.</span>
          </label>
          <fieldset className="grid gap-2" disabled={busy}>
            <legend className="mb-1 font-medium">Stil</legend>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Stil">
              {AI_IMAGE_PRESETS.map(row => <button key={row.id} type="button" role="radio" aria-checked={preset === row.id}
                className={cn(buttonVariants({size: 'sm', variant: preset === row.id ? 'ink' : 'secondary'}), 'rounded-full')} onClick={() => setPreset(row.id)}>{row.label}</button>)}
            </div>
            {preset === 'free' ? <span className="text-xs text-sg-muted">Fri: din beskrivning och inspirationsbilden styr material och färg.</span> : null}
          </fieldset>
          {table && filmed.length ? <details className="rounded-lg border border-sg-border p-3">
            <summary className="cursor-pointer text-sm font-medium">Placering · {filmed.find(row => row.id === dealerId)?.label ?? 'Dealer'} · {scene?.label ?? 'Standard'}</summary>
            <div className="mt-3 grid gap-3">
              <label className="grid gap-1">
                <span className="font-medium">Dealer</span>
                <select className={field} value={dealerId} disabled={busy} onChange={event => setDealerId(event.target.value)}>
                  {filmed.map(row => <option key={row.id} value={row.id}>{row.label}</option>)}
                </select>
                <span className="text-xs text-sg-muted">Bordet ritas efter dealerns filmade landningar.</span>
              </label>
              <label className="grid gap-1">
                <span className="font-medium">Miljö</span>
                <select className={field} value={templateId} disabled={busy} onChange={event => setTemplateId(event.target.value)}>
                  {scenes.map(row => <option key={row.id} value={row.id}>{row.label}{row.id === roomTemplate ? ' · spelbordets' : ''}</option>)}
                  <option value="">Standardplacering (ingen miljö)</option>
                </select>
                <span className="text-xs text-sg-muted">Bordsgrafiken passar miljöns placering. Ändras placeringen senare behöver bordet ritas om.</span>
              </label>
              {suggestion ? <div className="flex items-start gap-2">
                <Checkbox id="ai-fit-width" checked={fitWidth} disabled={busy || !suggestion.changed} onCheckedChange={value => setFitWidth(value === true)} className="mt-0.5" />
                <Label htmlFor="ai-fit-width" className="grid gap-0.5">
                  <span className="font-medium">Anpassa bordets bredd efter dealerns räckvidd</span>
                  <span className="text-xs text-sg-muted">{suggestion.changed
                    ? `Rekommenderad bredd: ${percent(suggestion.suggested.percent.desktop)} (dator), ${percent(suggestion.suggested.percent.mobile)} (mobil). Boxarna fyller då ${share(suggestion.suggested.share)} av bordet. Bredden följer med till miljön.`
                    : `Boxarna fyller redan ${share(suggestion.current.share)} av bordet.`}</span>
                </Label>
              </div> : null}
            </div>
          </details> : null}
          {table && shape ? <div className="grid gap-2 rounded-lg border border-sg-border p-3">
            <p className="m-0 font-medium">Bordets form och storlek</p>
            <AiProposalPreview role="table" proposal={shape} project={project} inventory={inventory} laneId={scene?.id ?? ''} dealerId={dealerId} composition={drawComposition} />
            <p className="m-0 text-xs text-sg-muted">Formmall före generering. AI ger bordet material och ljus; perspektivet, storleken och kortens platser behålls. Inspirationsbilden ändrar bara stilen.</p>
          </div> : null}
          {table && dealerId && !shape ? <p role="alert" className={notice}>Bordet kan inte ritas för den här placeringen. Välj en annan miljö eller justera bordets och dealerns placering för dator och mobil.</p> : null}
          <div className="grid gap-1 rounded-lg border border-dashed border-sg-border p-3" onDragOver={event => { event.preventDefault(); }}
            onDrop={event => { event.preventDefault(); void pickReference(event.dataTransfer.files?.[0]); }}>
            <span className="font-medium">Inspirationsbild · valfri</span>
            {reference ? <div className="flex items-center gap-3">
              <img src={reference} alt={'Inspirationsbild: ' + referenceName} className="h-16 w-24 rounded-md border border-sg-border object-cover" />
              <span className="min-w-0 flex-1 truncate text-xs">{referenceName}</span>
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => { setReference(null); setReferenceName(''); }}>Ta bort</Button>
            </div> : <label className={cn(buttonVariants(), 'w-fit focus-within:ring-2 focus-within:ring-sg-mark focus-within:ring-offset-2 focus-within:ring-offset-sg-surface')}>
              <ImagePlus aria-hidden="true" />Välj bild
              <input type="file" className="sr-only" accept={AI_IMAGE_REFERENCE_TYPES.join(',')} disabled={busy} onChange={event => { const input = event.currentTarget, file = input.files?.[0]; input.value = ''; void pickReference(file); }} />
            </label>}
            {libraryReferences.length ? <details>
              <summary className="cursor-pointer py-2 text-sm font-medium">Välj från materialbiblioteket</summary>
              <div className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
                {libraryReferences.map(material => <button key={material.id} type="button" disabled={busy} onClick={() => void pickReference(material)} className="grid gap-1 rounded-lg border border-sg-border bg-sg-surface-2 p-2 text-left disabled:opacity-50">
                  <img src={material.url} alt="" loading="lazy" className="aspect-video w-full rounded object-contain" />
                  <span className="text-xs">{material.label}</span>
                </button>)}
              </div>
            </details> : null}
            {referenceBusy ? <p role="status" className="m-0 text-xs">Läser inspirationsbilden…</p> : null}
            <span className="text-xs text-sg-muted">Välj en befintlig bild eller ladda upp PNG, JPEG eller WebP (högst 8 MB). Bilden väljer Fri stil och styr färg och material, aldrig perspektiv eller storlek. Den skickas med förfrågan utan att sparas igen.</span>
          </div>
          <label className="grid w-fit gap-1">
            <span className="font-medium">Antal förslag</span>
            <select className={field} value={count} disabled={busy} onChange={event => setCount(Number(event.target.value))}>
              {Array.from({length: AI_IMAGE_MAX_PROPOSALS}, (_, index) => index + 1).map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          {theme ? <p className="m-0 text-xs text-sg-muted">Bord + bakgrund använder samma beskrivning, stil och inspirationsbild ({count * 2} bilder).</p> : null}
        </div> : null}

        {phase === 'generating' ? <div className="grid gap-2">
          <p role="status" className="m-0">Skapar förslag… Det kan ta ett par minuter.</p>
          <div className="grid grid-cols-2 gap-3" aria-hidden="true">
            {Array.from({length: count}, (_, index) => <div key={index} className={'animate-pulse rounded-lg border border-sg-border bg-sg-surface-2 ' + (table ? 'aspect-[3/4]' : 'aspect-video')} />)}
          </div>
        </div> : null}

        {phase === 'results' || phase === 'saving' ? <div className="grid gap-3">
          {drawn?.theme ? <>{results('table')}{results('background')}</> : results(role)}
          {preview ? <div className="grid gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="m-0 font-medium">Förhandsvisning i scenen</p>
              {!table && templates.length ? <label className="flex items-center gap-2 text-xs text-sg-muted">Miljö
                <select className={cn(field, 'w-auto py-1 text-xs')} value={previewId} disabled={phase === 'saving'} onChange={event => setPreviewId(event.target.value)}>
                  {templates.map(row => <option key={row.id} value={row.id}>{row.label}</option>)}
                </select>
              </label> : null}
            </div>
            <AiProposalPreview role={shown} proposal={preview} companion={companion} project={project} inventory={inventory} laneId={table ? drawn?.templateId ?? '' : previewId}
              dealerId={table ? dealerId : undefined} composition={table ? drawn?.composition : undefined} />
          </div> : null}
          {target && (publishRoom || saveProject) ? <div className="flex items-start gap-2 rounded-lg border border-sg-border p-3">
            <Checkbox id="ai-adopt" checked={adopt} disabled={phase === 'saving'} onCheckedChange={value => setAdopt(value === true)} className="mt-0.5" />
            <Label htmlFor="ai-adopt" className="grid gap-0.5">
              <span className="font-medium">{publishRoom && room ? `Använd i miljön ${targetLabel} och i spelbordet ${room.name}` : `Använd i miljön ${targetLabel}`}</span>
              <span className="text-xs text-sg-muted">{publishRoom
                ? 'Tillåts i miljön, blir standard och publiceras i spelbordet i ett steg. Finns andra opublicerade ändringar publiceras inget; materialet ligger då kvar i biblioteket.'
                : 'Tillåts i miljön och blir standard i det sparade utkastet. Publicera spelbordet för att visa det för spelarna.'}{drawn?.tableWidth ? ` Bordsbredd ${percent(drawn.tableWidth.desktop * 100)} (dator) och ${percent(drawn.tableWidth.mobile * 100)} (mobil) följer med.` : ''} Utan bocken sparas bara i biblioteket.</span>
            </Label>
          </div> : null}
          {phase === 'saving' ? <p role="status" className="m-0">{progress === null ? `Sparar i ${drawn?.theme ? 'biblioteket' : place}…` : `Laddar upp · ${progress} %`}</p> : null}
        </div> : null}

        {error ? <p role="alert" className="m-0 rounded-lg bg-sg-danger-bg px-3 py-2 text-sg-danger">{error}</p> : null}
      </div>
    </Dialog>
    {confirmation ? <p role="status" className="m-0 max-w-[40ch] text-center text-xs text-sg-ok">{confirmation}</p> : null}
  </span>;
}
