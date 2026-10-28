'use client';
import {Check, ImagePlus, RefreshCw, Sparkles} from 'lucide-react';
import {useEffect, useRef, useState} from 'react';
import type {StudioProject} from '../../../../../../packages/presentation/contracts/studio-model.mjs';
import {AI_IMAGE_MAX_PROPOSALS, AI_IMAGE_PRESETS, AI_IMAGE_PROMPT_LENGTH, AI_IMAGE_REFERENCE_TYPES, aiImageLabel, type AiImagePresetId} from '../../../../lib/ai-image-contract.mjs';
import {aiImageErrorMessage, aiSceneTemplates, aiTableDealers, prepareReferenceImage, readAiImageStatus, registerAiProposal, requestAiProposals, type AiImageStatus, type AiProposal, type AiSceneTemplate} from '../../lib/ai-background.mjs';
import type {AiTableFit} from '../../../../lib/ai-image-contract.mjs';
import {layerUploadFailureMessage} from '../../../../../../packages/presentation/contracts/layer-upload-errors.mjs';
import {Dialog} from '../ui/dialog';
import {Button, buttonVariants, cn} from '../ui/kit';

export type AiBackgroundDialogProps = {
  /** Bakgrund (default) or filmed-dealer bordsgrafik. */
  role?: 'background' | 'table';
  /** Table graphics exist only for Blackjack dealers with a filmed profile. */
  game?: 'blackjack' | 'roulette';
  /** Registered dealers; table mode lists those with a filmed profile. */
  dealers?: readonly {id: string; label: string}[];
  /** Scene templates (project.lanes); a table is drawn for one template's composition. */
  templates?: readonly AiSceneTemplate[];
  disabled?: boolean;
  onRegistered: (project: StudioProject, id: string) => void;
  onBusyChange?: (busy: boolean) => void;
};

type Phase = 'form' | 'generating' | 'results' | 'saving';
const PUBLICATION_NOTE = 'Bilden hamnar i materialbiblioteket. Inget bolag ser den förrän den ligger i en scenmall som publiceras.';
const UNSUPPORTED = 'Bordsgrafik med AI kräver Blackjack och en dealer med filmad profil.';
const field = 'min-w-0 w-full rounded-lg border border-sg-border bg-sg-surface px-3 py-2 text-[13.5px] text-sg-text';
const notice = 'm-0 rounded-lg border border-sg-border bg-sg-surface-2 p-3';

// Proposals are drafts in this dialog only. "Använd" registers one through the
// existing layer-asset upload; it reaches no operator until a scene template
// lists it and is published.
export function AiBackgroundDialog({role = 'background', game = 'blackjack', dealers = [], templates = [], disabled = false, onRegistered, onBusyChange}: AiBackgroundDialogProps) {
  const table = role === 'table', filmed = aiTableDealers(dealers), unsupported = table && (game !== 'blackjack' || filmed.length === 0);
  const [open, setOpen] = useState(false), [phase, setPhase] = useState<Phase>('form');
  const [status, setStatus] = useState<AiImageStatus | null>(null), [statusError, setStatusError] = useState('');
  const [prompt, setPrompt] = useState(''), [preset, setPreset] = useState<AiImagePresetId>('dark-studio'), [count, setCount] = useState(2);
  const [dealerId, setDealerId] = useState(''), [templateId, setTemplateId] = useState(''), [reference, setReference] = useState<string | null>(null), [referenceName, setReferenceName] = useState('');
  const [proposals, setProposals] = useState<AiProposal[]>([]), [selected, setSelected] = useState<string | null>(null), [fit, setFit] = useState<AiTableFit | null>(null);
  const [error, setError] = useState(''), [progress, setProgress] = useState<number | null>(null), [confirmation, setConfirmation] = useState('');
  const request = useRef<AbortController | null>(null), mounted = useRef(true), busyCallback = useRef(onBusyChange);
  busyCallback.current = onBusyChange;
  const busy = phase === 'generating' || phase === 'saving';
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; request.current?.abort(); busyCallback.current?.(false); }; }, []);
  useEffect(() => { busyCallback.current?.(busy); }, [busy]);
  const filmedIds = filmed.map(row => row.id).join(',');
  useEffect(() => { const ids = filmedIds ? filmedIds.split(',') : []; if (table && !ids.includes(dealerId)) setDealerId(ids[0] ?? ''); }, [table, filmedIds, dealerId]);
  // Default: the first scene template that allows the chosen dealer; '' = the composition defaults.
  const scenes = aiSceneTemplates(templates, dealerId), sceneIds = scenes.map(row => row.id).join(',');
  useEffect(() => { const ids = sceneIds ? sceneIds.split(',') : []; setTemplateId(current => ids.includes(current) ? current : ids[0] ?? ''); }, [sceneIds]);
  const scene = scenes.find(row => row.id === templateId) ?? null;
  useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();
    setStatusError('');
    readAiImageStatus({signal: controller.signal}).then(value => { if (!controller.signal.aborted) setStatus(value); })
      .catch(cause => { if (!controller.signal.aborted) setStatusError(aiImageErrorMessage(cause)); });
    return () => controller.abort();
  }, [open]);

  const noun = table ? 'bordsgrafik' : 'bakgrund', place = table ? 'Bordsgrafik' : 'Bakgrunder';
  const text = prompt.replace(/\s+/g, ' ').trim();
  const off = status?.enabled === false, misconfigured = status?.enabled === true && status.problem === 'invalid_setting';
  const offline = status?.enabled === true && !status.configured && !misconfigured, exhausted = status?.configured === true && status.remaining < count;
  const ready = text.length >= AI_IMAGE_PROMPT_LENGTH.min && text.length <= AI_IMAGE_PROMPT_LENGTH.max && (!table || Boolean(dealerId)) && status !== null && !off && !misconfigured && !offline && !exhausted && !unsupported;

  function close(next: boolean) {
    if (next) { setOpen(true); setConfirmation(''); return; }
    request.current?.abort(); request.current = null;
    setOpen(false); setPhase('form'); setProposals([]); setSelected(null); setFit(null); setError(''); setProgress(null);
  }
  async function pickReference(file: File | undefined) {
    if (!file || busy) return;
    setError('');
    try { const value = await prepareReferenceImage(file); if (mounted.current) { setReference(value); setReferenceName(file.name); } }
    catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : 'Inspirationsbilden kunde inte läsas.'); }
  }
  async function generate() {
    if (!ready || busy) return;
    const controller = new AbortController(); request.current = controller;
    setPhase('generating'); setError(''); setProposals([]); setSelected(null); setFit(null);
    try {
      const result = await requestAiProposals({role, prompt: text, preset, count, ...(table ? {dealerId, sceneTemplate: scene ? {id: scene.id, composition: scene.composition} : null} : {}), reference}, {signal: controller.signal});
      if (!mounted.current || controller.signal.aborted) return;
      setProposals(result.images); setSelected(result.images[0]?.id ?? null); setFit(result.fit); setPhase('results');
      setStatus(current => current ? {...current, remaining: result.remaining} : current);
    } catch (cause) {
      if (!mounted.current) return;
      setError(aiImageErrorMessage(cause)); setPhase('form');
    } finally { if (request.current === controller) request.current = null; }
  }
  async function use() {
    const proposal = proposals.find(row => row.id === selected);
    if (!proposal || busy) return;
    const controller = new AbortController(); request.current = controller;
    let commitStarted = false;
    setPhase('saving'); setError(''); setProgress(null);
    try {
      const saved = await registerAiProposal(proposal, {role, prompt: text, fit}, {signal: controller.signal,
        onUploadProgress: event => { if (mounted.current) setProgress(Math.round(event.percentage)); },
        onCommit: () => { commitStarted = true; }});
      if (!mounted.current) return;
      onRegistered(saved.project, saved.id);
      setConfirmation(`Sparad i ${place} som "${aiImageLabel(text, table ? fit : null)}". ${PUBLICATION_NOTE}`);
      close(false);
    } catch (cause) {
      if (!mounted.current) return;
      setError(layerUploadFailureMessage(cause, {aborted: controller.signal.aborted, commitStarted})); setPhase('results');
    } finally { if (request.current === controller) request.current = null; if (mounted.current) setProgress(null); }
  }

  const footer = phase === 'saving' ? undefined : <>
    {phase === 'generating' ? <Button onClick={() => request.current?.abort()}>Avbryt</Button> : null}
    {phase === 'form' ? <Button variant="primary" disabled={!ready} onClick={() => void generate()}><Sparkles aria-hidden="true" />Skapa förslag</Button> : null}
    {phase === 'results' ? <>
      <Button disabled={!ready} onClick={() => void generate()}><RefreshCw aria-hidden="true" />Skapa nya</Button>
      <Button variant="primary" disabled={!selected} onClick={() => void use()}><Check aria-hidden="true" />Använd</Button>
    </> : null}
  </>;

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

        {phase === 'form' || phase === 'generating' ? <div className="grid gap-4">
          <label className="grid gap-1">
            <span className="font-medium">Beskriv {table ? 'bordet' : 'bakgrunden'}</span>
            <textarea className={field} rows={3} maxLength={AI_IMAGE_PROMPT_LENGTH.max} value={prompt} disabled={busy}
              placeholder={table ? 'T.ex. mörkgrön filt med smal guldkant' : 'T.ex. lugn kvällsstudio med mjukt sidoljus'} onChange={event => setPrompt(event.target.value)} />
            <span className="text-xs text-sg-muted">{text.length}/{AI_IMAGE_PROMPT_LENGTH.max} tecken. Text, logotyper, personer, kort och marker tas aldrig med.</span>
          </label>
          <fieldset className="grid gap-2" disabled={busy}>
            <legend className="mb-1 font-medium">Förinställning</legend>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Förinställning">
              {AI_IMAGE_PRESETS.map(row => <button key={row.id} type="button" role="radio" aria-checked={preset === row.id}
                className={cn(buttonVariants({size: 'sm', variant: preset === row.id ? 'ink' : 'secondary'}), 'rounded-full')} onClick={() => setPreset(row.id)}>{row.label}</button>)}
            </div>
            {preset === 'free' ? <span className="text-xs text-sg-muted">Fri: bara din beskrivning styr stilen.</span> : null}
          </fieldset>
          {table && filmed.length ? <label className="grid gap-1">
            <span className="font-medium">Dealer</span>
            <select className={field} value={dealerId} disabled={busy} onChange={event => setDealerId(event.target.value)}>
              {filmed.map(row => <option key={row.id} value={row.id}>{row.label}</option>)}
            </select>
            <span className="text-xs text-sg-muted">Bordet ritas efter dealerns filmade landningar.</span>
          </label> : null}
          {table && filmed.length ? <label className="grid gap-1">
            <span className="font-medium">Scenmall</span>
            <select className={field} value={templateId} disabled={busy} onChange={event => setTemplateId(event.target.value)}>
              {scenes.map(row => <option key={row.id} value={row.id}>{row.label}</option>)}
              <option value="">Standardplacering (ingen scenmall)</option>
            </select>
            <span className="text-xs text-sg-muted">Bordsgrafiken passar scenmallens placering. Ändras placeringen senare behöver bordet ritas om.</span>
          </label> : null}
          <div className="grid gap-1 rounded-lg border border-dashed border-sg-border p-3" onDragOver={event => { event.preventDefault(); }}
            onDrop={event => { event.preventDefault(); void pickReference(event.dataTransfer.files?.[0]); }}>
            <span className="font-medium">Inspirationsbild · valfri</span>
            {reference ? <div className="flex items-center gap-3">
              <img src={reference} alt={'Inspirationsbild: ' + referenceName} className="h-16 w-24 rounded-md border border-sg-border object-cover" />
              <span className="min-w-0 flex-1 truncate text-xs">{referenceName}</span>
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => { setReference(null); setReferenceName(''); }}>Ta bort</Button>
            </div> : <label className={cn(buttonVariants(), 'w-fit focus-within:ring-2 focus-within:ring-sg-lime')}>
              <ImagePlus aria-hidden="true" />Välj bild
              <input type="file" className="sr-only" accept={AI_IMAGE_REFERENCE_TYPES.join(',')} disabled={busy} onChange={event => { const input = event.currentTarget, file = input.files?.[0]; input.value = ''; void pickReference(file); }} />
            </label>}
            <span className="text-xs text-sg-muted">Dra in eller välj ett bord, en lokal eller ett foto att inspireras av. PNG, JPEG eller WebP; görs mindre till högst 1536 px och under 2 MB. Skickas bara med förfrågan och sparas inte.</span>
          </div>
          <label className="grid w-fit gap-1">
            <span className="font-medium">Antal förslag</span>
            <select className={field} value={count} disabled={busy} onChange={event => setCount(Number(event.target.value))}>
              {Array.from({length: AI_IMAGE_MAX_PROPOSALS}, (_, index) => index + 1).map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
        </div> : null}

        {phase === 'generating' ? <div className="grid gap-2">
          <p role="status" className="m-0">Skapar förslag… Det kan ta ett par minuter.</p>
          <div className="grid grid-cols-2 gap-3" aria-hidden="true">
            {Array.from({length: count}, (_, index) => <div key={index} className={'animate-pulse rounded-lg border border-sg-border bg-sg-surface-2 ' + (table ? 'aspect-[3/4]' : 'aspect-video')} />)}
          </div>
        </div> : null}

        {phase === 'results' || phase === 'saving' ? <div className="grid gap-2">
          <p className="m-0 font-medium">Välj ett förslag</p>
          <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Förslag">
            {proposals.map((row, index) => <button key={row.id} type="button" role="radio" aria-checked={selected === row.id} disabled={phase === 'saving'}
              className={cn('relative overflow-hidden rounded-lg border-2 bg-sg-surface-2', selected === row.id ? 'border-sg-lime' : 'border-sg-border')} onClick={() => setSelected(row.id)}>
              <img src={row.dataUrl} alt={`Förslag ${index + 1}`} className="block h-auto w-full" />
              {selected === row.id ? <span className="absolute right-2 top-2 rounded-full bg-sg-lime p-1 text-sg-on-accent"><Check className="size-3.5" aria-hidden="true" /></span> : null}
            </button>)}
          </div>
          {phase === 'saving' ? <p role="status" className="m-0">{progress === null ? `Sparar i ${place}…` : `Laddar upp · ${progress} %`}</p> : null}
        </div> : null}

        {error ? <p role="alert" className="m-0 rounded-lg bg-sg-danger-bg px-3 py-2 text-sg-danger">{error}</p> : null}
      </div>
    </Dialog>
    {confirmation ? <p role="status" className="m-0 max-w-[32ch] text-center text-xs text-sg-ok">{confirmation}</p> : null}
  </span>;
}
