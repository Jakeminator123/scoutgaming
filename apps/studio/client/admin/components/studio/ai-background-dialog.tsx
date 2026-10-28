'use client';
import * as Dialog from '@radix-ui/react-dialog';
import {Check, ImagePlus, RefreshCw, Sparkles, X} from 'lucide-react';
import {useEffect, useRef, useState} from 'react';
import type {StudioProject} from '../../../../../../packages/presentation/contracts/studio-model.mjs';
import {AI_IMAGE_MAX_PROPOSALS, AI_IMAGE_PRESETS, AI_IMAGE_PROMPT_LENGTH, AI_IMAGE_REFERENCE_TYPES, aiImageLabel, type AiImagePresetId} from '../../../../lib/ai-image-contract.mjs';
import {aiImageErrorMessage, aiTableDealers, prepareReferenceImage, readAiImageStatus, registerAiProposal, requestAiProposals, type AiImageStatus, type AiProposal} from '../../lib/ai-background.mjs';
import {layerUploadFailureMessage} from '../../../../../../packages/presentation/contracts/layer-upload-errors.mjs';

export type AiBackgroundDialogProps = {
  /** Bakgrund (default) or filmed-dealer bordsgrafik. */
  role?: 'background' | 'table';
  /** Table graphics exist only for Blackjack dealers with a filmed profile. */
  game?: 'blackjack' | 'roulette';
  /** Registered dealers; table mode lists those with a filmed profile. */
  dealers?: readonly {id: string; label: string}[];
  disabled?: boolean;
  onRegistered: (project: StudioProject, id: string) => void;
  onBusyChange?: (busy: boolean) => void;
};

type Phase = 'form' | 'generating' | 'results' | 'saving';
const field = 'min-w-0 w-full rounded border border-sg-line bg-sg-bg p-2 text-sm text-sg-text';

// Proposals are drafts in this dialog only. "Använd" registers one through the
// existing layer-asset upload; it reaches no operator until a scene template
// lists it and is published.
export function AiBackgroundDialog({role = 'background', game = 'blackjack', dealers = [], disabled = false, onRegistered, onBusyChange}: AiBackgroundDialogProps) {
  const table = role === 'table', filmed = aiTableDealers(dealers), unsupported = table && (game !== 'blackjack' || filmed.length === 0);
  const [open, setOpen] = useState(false), [phase, setPhase] = useState<Phase>('form');
  const [status, setStatus] = useState<AiImageStatus | null>(null), [statusError, setStatusError] = useState('');
  const [prompt, setPrompt] = useState(''), [preset, setPreset] = useState<AiImagePresetId>('dark-studio'), [count, setCount] = useState(2);
  const [dealerId, setDealerId] = useState(''), [reference, setReference] = useState<string | null>(null), [referenceName, setReferenceName] = useState('');
  const [proposals, setProposals] = useState<AiProposal[]>([]), [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState(''), [progress, setProgress] = useState<number | null>(null), [confirmation, setConfirmation] = useState('');
  const request = useRef<AbortController | null>(null), anchor = useRef<HTMLSpanElement>(null), mounted = useRef(true), busyCallback = useRef(onBusyChange);
  busyCallback.current = onBusyChange;
  const busy = phase === 'generating' || phase === 'saving';
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; request.current?.abort(); busyCallback.current?.(false); }; }, []);
  useEffect(() => { busyCallback.current?.(busy); }, [busy]);
  const filmedIds = filmed.map(row => row.id).join(',');
  useEffect(() => { const ids = filmedIds ? filmedIds.split(',') : []; if (table && !ids.includes(dealerId)) setDealerId(ids[0] ?? ''); }, [table, filmedIds, dealerId]);
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
  const offline = status?.configured === false, exhausted = status?.configured === true && status.remaining < count;
  const ready = text.length >= AI_IMAGE_PROMPT_LENGTH.min && text.length <= AI_IMAGE_PROMPT_LENGTH.max && (!table || Boolean(dealerId)) && !offline && !exhausted && !unsupported;

  function close(next: boolean) {
    if (next) { setOpen(true); setConfirmation(''); return; }
    request.current?.abort(); request.current = null;
    setOpen(false); setPhase('form'); setProposals([]); setSelected(null); setError(''); setProgress(null);
  }
  async function pickReference(input: HTMLInputElement) {
    const file = input.files?.[0]; input.value = '';
    if (!file) return;
    setError('');
    try { const value = await prepareReferenceImage(file); if (mounted.current) { setReference(value); setReferenceName(file.name); } }
    catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : 'Referensbilden kunde inte läsas.'); }
  }
  async function generate() {
    if (!ready || busy) return;
    const controller = new AbortController(); request.current = controller;
    setPhase('generating'); setError(''); setProposals([]); setSelected(null);
    try {
      const result = await requestAiProposals({role, prompt: text, preset, count, ...(table ? {dealerId} : {}), reference}, {signal: controller.signal});
      if (!mounted.current || controller.signal.aborted) return;
      setProposals(result.images); setSelected(result.images[0]?.id ?? null); setPhase('results');
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
      const saved = await registerAiProposal(proposal, {role, prompt: text}, {signal: controller.signal,
        onUploadProgress: event => { if (mounted.current) setProgress(Math.round(event.percentage)); },
        onCommit: () => { commitStarted = true; }});
      if (!mounted.current) return;
      onRegistered(saved.project, saved.id);
      setConfirmation(`Sparad i ${place} som "${aiImageLabel(text)}". Den når inget bolag förrän den läggs till i en scenmall och publiceras.`);
      close(false);
    } catch (cause) {
      if (!mounted.current) return;
      setError(layerUploadFailureMessage(cause, {aborted: controller.signal.aborted, commitStarted})); setPhase('results');
    } finally { if (request.current === controller) request.current = null; if (mounted.current) setProgress(null); }
  }

  return <span ref={anchor} className="inline-flex flex-col gap-1">
    <Dialog.Root open={open} onOpenChange={next => { if (!busy || next) close(next); }}>
      <Dialog.Trigger asChild>
        <button type="button" className="sg-btn sg-btn-secondary" disabled={disabled || unsupported}
          title={unsupported ? 'Bordsgrafik med AI kräver Blackjack och en dealer med filmad profil.' : undefined}>
          <Sparkles size={16} aria-hidden="true" />Skapa {noun} med AI
        </button>
      </Dialog.Trigger>
      <Dialog.Portal container={anchor.current?.closest<HTMLElement>('.preview-admin') ?? undefined}>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70" />
        <Dialog.Content aria-busy={busy || undefined} onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onPointerDownOutside={event => { if (busy) event.preventDefault(); }}
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[92dvh] w-[min(760px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-lg border border-sg-line bg-sg-panel p-5 text-sm text-sg-text shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-lg font-semibold">Skapa {noun} med AI</Dialog.Title>
              <Dialog.Description className="mt-1 text-sg-muted">
                AI tar fram förslag. Inget sparas förrän du väljer ett och klickar Använd; då hamnar det i {place} som ett vanligt material.
                {table ? ' Insatsboxarna ritas av servern exakt där dealerns kort landar.' : ''}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild><button type="button" className="sg-btn sg-btn-ghost" disabled={busy} aria-label="Stäng"><X size={16} aria-hidden="true" /></button></Dialog.Close>
          </div>

          {status === null && !statusError ? <p role="status" className="text-sg-muted">Kontrollerar bildtjänsten…</p> : null}
          {statusError ? <p role="alert" className="text-sg-red">{statusError}</p> : null}
          {offline ? <p role="status" className="rounded border border-sg-line p-3"><strong>Inte anslutet.</strong> OpenAI-nyckeln saknas på servern, så inga förslag kan skapas här ännu. Manuell uppladdning fungerar som vanligt.</p> : null}
          {status?.configured ? <p className="text-xs text-sg-muted">{status.remaining} av {status.dailyLimit} bilder kvar i dag på den här servern.</p> : null}
          {unsupported ? <p role="status" className="rounded border border-sg-line p-3">Bordsgrafik med AI kräver Blackjack och en dealer med filmad profil.</p> : null}

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
                  className={'sg-btn ' + (preset === row.id ? 'sg-btn-primary' : 'sg-btn-secondary')} onClick={() => setPreset(row.id)}>{row.label}</button>)}
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
            <div className="grid gap-1">
              <span className="font-medium">Referensbild · valfri</span>
              {reference ? <div className="flex items-center gap-3">
                <img src={reference} alt={'Referensbild: ' + referenceName} className="h-16 w-24 rounded border border-sg-line object-cover" />
                <span className="min-w-0 flex-1 truncate text-xs">{referenceName}</span>
                <button type="button" className="sg-btn sg-btn-ghost" disabled={busy} onClick={() => { setReference(null); setReferenceName(''); }}>Ta bort</button>
              </div> : <label className="sg-btn sg-btn-secondary w-fit cursor-pointer">
                <ImagePlus size={16} aria-hidden="true" />Välj bild
                <input type="file" className="sr-only" accept={AI_IMAGE_REFERENCE_TYPES.join(',')} disabled={busy} onChange={event => void pickReference(event.currentTarget)} />
              </label>}
              <span className="text-xs text-sg-muted">Ett foto av ett bord, en lokal eller en miljö att inspireras av. PNG, JPEG eller WebP, högst 8 MB. Skickas bara med förfrågan och sparas inte.</span>
            </div>
            <label className="grid w-fit gap-1">
              <span className="font-medium">Antal förslag</span>
              <select className={field} value={count} disabled={busy} onChange={event => setCount(Number(event.target.value))}>
                {Array.from({length: AI_IMAGE_MAX_PROPOSALS}, (_, index) => index + 1).map(value => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          </div> : null}

          {phase === 'generating' ? <div className="grid gap-2">
            <p role="status">Skapar förslag… Det kan ta ett par minuter.</p>
            <div className="grid grid-cols-2 gap-3" aria-hidden="true">
              {Array.from({length: count}, (_, index) => <div key={index} className={'animate-pulse rounded border border-sg-line bg-sg-bg ' + (table ? 'aspect-[1080/1233]' : 'aspect-video')} />)}
            </div>
          </div> : null}

          {phase === 'results' || phase === 'saving' ? <div className="grid gap-2">
            <p className="font-medium">Välj ett förslag</p>
            <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Förslag">
              {proposals.map((row, index) => <button key={row.id} type="button" role="radio" aria-checked={selected === row.id} disabled={phase === 'saving'}
                className={'relative overflow-hidden rounded border-2 bg-sg-bg ' + (selected === row.id ? 'border-sg-lime' : 'border-sg-line')} onClick={() => setSelected(row.id)}>
                <img src={row.dataUrl} alt={`Förslag ${index + 1}`} className="block h-auto w-full" />
                {selected === row.id ? <span className="absolute right-2 top-2 rounded-full bg-sg-lime p-1 text-sg-bg"><Check size={14} aria-hidden="true" /></span> : null}
              </button>)}
            </div>
            {phase === 'saving' ? <p role="status">{progress === null ? `Sparar i ${place}…` : `Laddar upp · ${progress} %`}</p> : null}
          </div> : null}

          {error ? <p role="alert" className="text-sg-red">{error}</p> : null}

          <div className="flex flex-wrap justify-end gap-2">
            {phase === 'generating' ? <button type="button" className="sg-btn sg-btn-secondary" onClick={() => request.current?.abort()}>Avbryt</button> : null}
            {phase === 'form' ? <button type="button" className="sg-btn sg-btn-primary" disabled={!ready} onClick={() => void generate()}><Sparkles size={16} aria-hidden="true" />Skapa förslag</button> : null}
            {phase === 'results' ? <>
              <button type="button" className="sg-btn sg-btn-secondary" disabled={!ready} onClick={() => void generate()}><RefreshCw size={16} aria-hidden="true" />Skapa nya</button>
              <button type="button" className="sg-btn sg-btn-primary" disabled={!selected} onClick={() => void use()}><Check size={16} aria-hidden="true" />Använd</button>
            </> : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
    {confirmation ? <p role="status" className="text-xs text-sg-lime">{confirmation}</p> : null}
  </span>;
}
