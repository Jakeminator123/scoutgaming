'use client';
import { useEffect, useRef, useState } from 'react';
import { Archive, RotateCcw, Trash2 } from 'lucide-react';
import type { StudioProject } from '../../../../../../packages/presentation/contracts/studio-model.mjs';
import { validateProject } from '../../../../../../packages/presentation/contracts/studio-model.mjs';
import { createDealerSet, dealerSetsForClip, editDealerSet, removeDealerSet, validateDealerSetBindings } from '../../../../../../packages/presentation/contracts/dealer-sets.mjs';
import type { Catalog, VideoInventory } from '../../lib/connected-studio.mjs';
import { clipLifecycleBlocker, createLifecycleClient, lifecycleBank, lifecycleClipReferences, lifecycleFingerprint, lifecycleMessage } from '../../lib/studio-lifecycle.mjs';
import { clipArchivePlan } from '../../lib/lifecycle-actions.mjs';
import { ConfirmDialog } from '../ui/dialog';
import Link from '../../../runtime/navigation';
import { ClipDeleteAction, type ClipDeleteResult } from './clip-delete-action';

const client = createLifecycleClient();
const button = 'inline-flex items-center justify-center gap-2 rounded border border-sg-line px-3 py-2 text-xs disabled:opacity-40';
const input = 'min-w-0 rounded border border-sg-line bg-sg-bg p-2 text-xs';
// Clip archive only. The whole dealer is archived, restored and deleted in one
// place: the Dealers list with its Papperskorg (dealer-directory.tsx).
type Plan = { dealerId: string; fingerprint: string; ids: string[]; error?: string; kind: 'clips'; archived: boolean; all: boolean };
export type StudioLifecyclePanelProps = {
  project: StudioProject; inventory: VideoInventory; catalog: Catalog; dealerId: string; blocked?: boolean;
  onReload: () => void|Promise<void>; onBusyChange?: (busy: boolean) => void;
  onEdit?: (project: StudioProject) => void; editBlocked?: boolean;
};

function DealerSetManager({ project, inventory, dealerId, disabled, onEdit }: { project: StudioProject; inventory: VideoInventory; dealerId: string; disabled: boolean; onEdit?: (project: StudioProject) => void }) {
  const [chosen, setChosen] = useState(''), [name, setName] = useState(''), [newName, setNewName] = useState('');
  const [message, setMessage] = useState('');
  const [intent, setIntent] = useState<{ id: string; action: 'archive'|'restore'|'detach'|'remove'; fingerprint: string }|null>(null);
  const sets = (project.dealerSets ?? []).filter(row => row.dealerId === dealerId);
  const set = sets.find(row => row.id === chosen);
  const canEdit = !disabled && Boolean(onEdit) && project.dealers.some(row => row.id === dealerId);
  useEffect(() => { setChosen(''); setNewName(''); setMessage(''); setIntent(null); }, [dealerId]);
  useEffect(() => { setName(set?.name ?? ''); setIntent(null); }, [set]);
  function apply(next: StudioProject, notice: string) {
    if (!canEdit) return;
    try { validateProject(next); validateDealerSetBindings(next, inventory); onEdit?.(next); setMessage(notice + ' Spara Studio-utkastet för att behålla ändringen.'); setIntent(null); }
    catch (cause) { setMessage(lifecycleMessage(cause)); }
  }
  function create() {
    if (!newName.trim() || !canEdit) return;
    const id = 'set-' + crypto.randomUUID();
    try { apply(createDealerSet(project, { id, name: newName, dealerId }), 'Kategorin skapades under denna dealer.'); setChosen(id); setNewName(''); }
    catch (cause) { setMessage(lifecycleMessage(cause)); }
  }
  const intentSet = intent && intent.fingerprint === JSON.stringify(set) && intent.id === set?.id ? set : null;
  function confirmIntent() {
    if (!intent || !intentSet || !canEdit) return;
    try {
      const next = intent.action === 'remove' ? removeDealerSet(project, intent.id)
        : editDealerSet(project, intent.id, intent.action === 'detach' ? { clipIds: [] } : { archived: intent.action === 'archive' });
      apply(next, intent.action === 'remove' ? 'Kategori och medlemskap borttagna. Alla mediafiler är kvar.'
        : intent.action === 'detach' ? 'Medlemskap bortkopplade. Kategorin och alla mediafiler är kvar.'
        : intent.action === 'archive' ? 'Kategorin arkiverades. Klippen och deras användning är oförändrade.' : 'Kategorin återställdes med samma klippmedlemskap.');
    } catch (cause) { setMessage(lifecycleMessage(cause)); }
  }
  const clips = inventory.videos.filter(row => row.classification?.dealerId === dealerId && !row.classification.archived && !(row as { deletion?: unknown }).deletion);
  return <section className="space-y-3" aria-label="Set och kategorier">
    <p className="text-sg-muted">Ett set är en egen kategori under dealeridentiteten. Du kan exempelvis skapa PAOW3 under PAOW utan att registrera en ny dealer. Kategorier är arbetsmaterial; publicerade bolagspaket behåller sina frysta versioner.</p>
    {!onEdit && <p role="status" className="text-amber-300">Kategoriernas utkastredigering är inte ansluten i denna vy.</p>}
    <div className="flex gap-2"><label className="flex min-w-0 flex-1 flex-col gap-1 text-sg-muted">Ny kategori<input className={input} maxLength={120} placeholder="Exempel: PAOW3" value={newName} disabled={!canEdit} onChange={event => setNewName(event.target.value)} /></label><button type="button" className={button + ' self-end'} disabled={!canEdit || !newName.trim()} onClick={create}>Skapa</button></div>
    <label className="flex flex-col gap-1 text-sg-muted">Kategori<select className={input} value={chosen} disabled={disabled} onChange={event => { setChosen(event.target.value); setMessage(''); }}><option value="">Välj kategori ({sets.length})</option>{sets.map(row => <option key={row.id} value={row.id}>{row.name}{row.archived ? ' · arkiv' : ''} · {row.clipIds.length} klipp</option>)}</select></label>
    {message && <p role="status" className="text-sg-muted">{message}</p>}
    {set && <>
      <div className="rounded border border-sg-line p-3"><p className="text-sg-muted">{set.archived ? 'Arkiverad kategori' : 'Aktiv kategori'} · {set.clipIds.length} medlemskap · <code>{set.id}</code></p>
        <div className="mt-3 flex gap-2"><label className="flex min-w-0 flex-1 flex-col gap-1">Namn<input className={input} value={name} maxLength={120} disabled={!canEdit} onChange={event => setName(event.target.value)} /></label><button className={button + ' self-end'} type="button" disabled={!canEdit || !name.trim() || name.trim() === set.name} onClick={() => { try { apply(editDealerSet(project, set.id, { name }), 'Kategorins namn ändrades.'); } catch (cause) { setMessage(lifecycleMessage(cause)); } }}>Byt namn</button></div>
        <button type="button" className={button + ' mt-3'} disabled={!canEdit} onClick={() => setIntent({ id: set.id, action: set.archived ? 'restore' : 'archive', fingerprint: JSON.stringify(set) })}>{set.archived ? <RotateCcw size={13} /> : <Archive size={13} />}{set.archived ? 'Återställ bara kategorin' : 'Arkivera bara kategorin'}</button>
      </div>
      <div className="max-h-72 space-y-2 overflow-y-auto" aria-label="Exakta klippmedlemskap">
        {clips.map(video => {
          const others = dealerSetsForClip(project, video.id).filter(row => row.id !== set.id);
          return <div className="rounded border border-sg-line p-2" key={video.id}><label className="flex items-start gap-2"><input type="checkbox" checked={set.clipIds.includes(video.id)} disabled={!canEdit || set.archived || !(video as { revision?: string }).revision || !video.available || video.integrity === 'unavailable'} onChange={event => { try { apply(editDealerSet(project, set.id, { clipIds: event.target.checked ? [...set.clipIds, video.id] : set.clipIds.filter(id => id !== video.id) }), 'Kategorins medlemskap ändrades. Mediafilen är kvar.'); } catch (cause) { setMessage(lifecycleMessage(cause)); } }} /><span className="min-w-0">{video.classification?.label ?? video.label}<code className="mt-1 block break-all text-[10px] text-sg-muted">{video.id}</code></span></label>{others.length > 0 && <p className="mt-1 text-sg-muted">Delas med: {others.map(row => row.name + (row.archived ? ' (arkiv)' : '')).join(', ')}</p>}</div>;
        })}
        {!clips.length && <p className="text-sg-muted">Inga aktiva registrerade klipp för denna dealer.</p>}
      </div>
      <details className="rounded border border-sg-line p-3"><summary className="cursor-pointer">Koppla loss eller ta bort kategorietiketten</summary><p className="my-2 text-sg-muted">Detta ändrar bara kategorin och dess medlemskap. Klippen ligger kvar och deras andra kategorier, spelkopplingar och publiceringar bevaras.</p><div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={!canEdit || !set.clipIds.length} onClick={() => setIntent({ id: set.id, action: 'detach', fingerprint: JSON.stringify(set) })}>Koppla loss alla medlemskap</button><button type="button" className={button} disabled={!canEdit} onClick={() => setIntent({ id: set.id, action: 'remove', fingerprint: JSON.stringify(set) })}>Ta bort kategorietiketten</button></div></details>
      {intent && intentSet && <div className="rounded border border-sg-lime/40 p-3"><strong>{intent.action === 'archive' ? 'Arkivera bara' : intent.action === 'restore' ? 'Återställ bara' : intent.action === 'detach' ? 'Koppla loss medlemmar från' : 'Ta bort etiketten'} {intentSet.name}?</strong><p className="my-2 text-sg-muted">{intentSet.clipIds.length} klipp {['archive', 'restore'].includes(intent.action) ? 'behåller sina medlemskap' : 'kopplas loss från denna kategori'}. Alla mediafiler och publicerade versioner är kvar.</p><ul className="my-2 space-y-1">{intentSet.clipIds.map(id => <li key={id}>{inventory.videos.find(row => row.id === id)?.label ?? id}{dealerSetsForClip(project, id).filter(row => row.id !== intentSet.id).length ? ' · finns även i ' + dealerSetsForClip(project, id).filter(row => row.id !== intentSet.id).map(row => row.name).join(', ') : ''}</li>)}</ul><div className="flex gap-2"><button type="button" className={button} disabled={!canEdit} onClick={confirmIntent}>Bekräfta kategoriändringen</button><button type="button" className={button} onClick={() => setIntent(null)}>Avbryt</button></div></div>}
    </>}
  </section>;
}

export function StudioLifecyclePanel({ project, inventory, catalog, dealerId, blocked = false, onReload, onBusyChange, onEdit, editBlocked = blocked }: StudioLifecyclePanelProps) {
  const [selectedDealer, setSelectedDealer] = useState(dealerId);
  const [view, setView] = useState<'sets'|'clips'>('sets');
  const [archivedView, setArchivedView] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [plan, setPlan] = useState<Plan|null>(null);
  const [busy, setBusy] = useState(false), [invalidated, setInvalidated] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const lock = useRef(false);
  const current = useRef({ project, inventory, selectedDealer, onReload, onBusyChange });
  current.current = { project, inventory, selectedDealer, onReload, onBusyChange };
  useEffect(() => { setSelectedDealer(dealerId); }, [dealerId]);
  useEffect(() => { setSelected([]); setPlan(null); setError(''); setNotice(''); }, [selectedDealer]);
  useEffect(() => { setSelected([]); setPlan(null); setInvalidated(false); }, [project, inventory]);
  const bank = lifecycleBank(project, inventory, catalog, selectedDealer);
  const disabled = blocked || busy || invalidated;
  const visible = bank?.videos.filter(row => Boolean(row.classification?.archived) === archivedView) ?? [];
  const reviewed = plan && plan.dealerId === selectedDealer && plan.fingerprint === lifecycleFingerprint(project, inventory, selectedDealer, plan.ids) ? plan : null;
  function snapshot(ids: string[]) { return { dealerId: selectedDealer, ids, fingerprint: lifecycleFingerprint(project, inventory, selectedDealer, ids) }; }
  function stillCurrent(value: Pick<Plan, 'dealerId'|'ids'|'fingerprint'>) {
    const state = current.current;
    return state.selectedDealer === value.dealerId && value.fingerprint === lifecycleFingerprint(state.project, state.inventory, value.dealerId, value.ids);
  }
  async function reload() {
    setInvalidated(true);
    try { await current.current.onReload(); } catch { setError(value => value + ' Registret kunde inte läsas om.'); }
  }
  // Mutations keep the dialog open in its busy state, then close it and read the
  // register back. A failed read keeps this panel invalidated.
  async function run(action: () => Promise<void>, mutation = false) {
    if (disabled || lock.current) return;
    lock.current = true; setBusy(true); current.current.onBusyChange?.(true); setError(''); setNotice('');
    try { await action(); }
    catch (cause) {
      const completed = (cause as { completed?: string[] })?.completed?.length ?? 0;
      setError((completed ? `${completed} klipp ändrades innan åtgärden stoppades. ` : '') + lifecycleMessage(cause) + (mutation ? ' Registret läses om; åtgärden upprepas inte automatiskt.' : ''));
    } finally {
      current.current.onBusyChange?.(false);
      if (mutation) { setPlan(null); await reload(); }
      lock.current = false; setBusy(false);
    }
  }
  function reviewClips(ids: string[], archived: boolean, all = false) {
    if (disabled || !bank || !ids.length) return;
    setError(''); setPlan({ ...snapshot(ids), kind: 'clips', archived, all });
  }
  function clipDone(result: ClipDeleteResult) {
    if (result.kind === 'kept') return;
    setError(''); setNotice('');
    if (result.kind === 'archived') setNotice('Klippet är flyttat till arkivet. Filen är bevarad och kan återställas.');
    else if (result.kind === 'deleted') setNotice('Klippet är permanent raderat.');
    else if (result.kind === 'failed') setError(result.message + ' Registret läses om; åtgärden upprepas inte automatiskt.');
    void reload();
  }
  function childBusy(value: boolean) { setBusy(value); current.current.onBusyChange?.(value); }
  async function apply() {
    if (!reviewed || !bank || reviewed.error) return;
    const captured = reviewed;
    await run(async () => {
      const unchanged = () => stillCurrent(captured);
      const completed = await client.archiveClips({ project, inventory, dealerId: captured.dealerId, ids: captured.ids, archived: captured.archived, stillCurrent: unchanged });
      setNotice(`${completed.length} klipp ${captured.archived ? 'flyttade till arkivet' : 'återställda'}. Mediafilerna är bevarade.`);
    }, true);
  }
  const dialog = reviewed ? clipArchivePlan({ project, inventory, dealerId: selectedDealer, ids: reviewed.ids, archived: reviewed.archived }) : null;
  const dialogError = plan && !reviewed ? 'Registret har ändrats sedan dialogen öppnades. Stäng och granska igen.' : reviewed?.error || dialog?.error || '';
  const dialogConfirm = reviewed && !dialogError ? dialog?.confirmLabel : undefined;
  return <section className="studio-lifecycle-panel flex flex-col gap-4 text-xs" aria-label="Arkiv och livscykel">
    <header><p className="font-mono text-[10px] uppercase tracking-widest text-sg-muted">Registrerade resurser</p><h2 className="mt-1 text-base font-semibold">Klipp & arkiv</h2></header>
    <label className="flex flex-col gap-1 text-sg-muted">Dealeridentitet
      <select className={input} value={selectedDealer} disabled={busy} onChange={event => setSelectedDealer(event.target.value)}>
        {!catalog.administration.dealers.some(row => row.id === selectedDealer) && <option value="">Välj en registrerad dealer</option>}
        {catalog.administration.dealers.map(row => <option key={row.id} value={row.id}>{row.name} · {row.id}{row.archived ? ' · arkiv' : ''}</option>)}
      </select>
    </label>
    {blocked && (view === 'clips' || editBlocked) && <p role="status" className="text-amber-300">Spara eller kasta det pågående utkastet innan du ändrar arkivet.</p>}
    {busy && !plan && <p role="status">Kontrollerar aktuella register…</p>}
    {error && <p role="alert" className="text-amber-300">{error}</p>}
    {notice && <p role="status" className="text-sg-lime">{notice}</p>}
    {invalidated && !busy && <button type="button" className={button} disabled={blocked} onClick={() => void onReload()}><RotateCcw size={13} /> Läs om registret</button>}
    {!bank ? <p>Ingen sådan dealer finns i de inlästa registren. En ny setversion måste registreras innan den får media och livscykelåtgärder.</p> : <>
      <div className="rounded border border-sg-line p-3"><strong>{bank.dealer.label}</strong><p className="mt-1 text-sg-muted" title={'Dealer-id: '+bank.dealer.id}>{bank.archived ? 'I papperskorgen' : 'Aktiv'} · {bank.videos.length===1?'1 mediafil':`${bank.videos.length} mediafiler`}</p>
        <p className="mt-2 text-sg-muted">Namnet är en etikett för denna identitet. Namn och versionsliknande ID:n skapar inte separata set.</p>
      </div>
      <nav className="flex gap-2" aria-label="Livscykelresurser"><button type="button" className={button} disabled={busy} aria-pressed={view === 'sets'} onClick={() => setView('sets')}>Set & kategorier</button><button type="button" className={button} disabled={busy} aria-pressed={view === 'clips'} onClick={() => setView('clips')}>Klipp & dealerarkiv</button></nav>
      {view === 'sets' ? <DealerSetManager project={project} inventory={inventory} dealerId={selectedDealer} disabled={editBlocked || busy || invalidated} onEdit={onEdit} /> : <>
      <details className="rounded border border-sg-line p-3"><summary className="cursor-pointer">Sammansättningar & användning ({bank.compositions.length})</summary>
        {bank.compositions.length ? <ul className="mt-2 space-y-1">{bank.compositions.map(row => <li key={row.id}>{row.label} <code className="text-sg-muted">{row.id}</code></li>)}</ul> : <p className="mt-2 text-sg-muted">Inga kopplade sammansättningar.</p>}
        <p className="mt-3 text-sg-muted">Rum som använder dealeridentiteten:</p>
        {bank.rooms.length ? <ul className="mt-1 space-y-1">{bank.rooms.map(row => <li key={row.id}>{row.name} · {catalog.administration.operators.find(operator => operator.id === row.operatorId)?.name ?? row.operatorId} · {row.published ? 'Publicerat paket' : 'Sparat utkast'}</li>)}</ul> : <p className="mt-1 text-sg-muted">Inga sådana rum i detta register.</p>}
        <p className="mt-3 text-sg-muted">Exakt klippanvändning i andra arbetsytor och alla publiceringsversioner kontrolleras av servern vid åtgärden.</p>
      </details>
      <div className="flex gap-2" role="group" aria-label="Visa klipp"><button type="button" className={button} aria-pressed={!archivedView} disabled={busy} onClick={() => { setArchivedView(false); setSelected([]); setPlan(null); }}>Bibliotek ({bank.videos.filter(row => !row.classification?.archived).length})</button><button type="button" className={button} aria-pressed={archivedView} disabled={busy} onClick={() => { setArchivedView(true); setSelected([]); setPlan(null); }}><Archive size={13} /> Arkiv ({bank.videos.filter(row => row.classification?.archived).length})</button></div>
      <p className="text-sg-muted">{archivedView ? 'Arkiverade klipp kan återställas. Radera permanent tar bort filen för alltid efter serverns kontroll.' : 'Radera flyttar klippet till arkivet; filen bevaras och kan återställas.'}</p>
      <div className="max-h-80 space-y-2 overflow-y-auto" aria-label={archivedView ? 'Arkiverade klipp' : 'Registrerade klipp'}>
        {!visible.length && <p className="text-sg-muted">Inga klipp i denna vy.</p>}
        {visible.map(video => {
          const blocker = clipLifecycleBlocker(project, video, selectedDealer, archivedView ? 'restore' : 'archive');
          const references = lifecycleClipReferences(project, video.id, { includeArchive: archivedView });
          return <article key={video.id} className="rounded border border-sg-line p-3">
            <label className="flex items-start gap-2"><input type="checkbox" className="mt-0.5" checked={selected.includes(video.id)} disabled={disabled || Boolean(blocker)} onChange={event => setSelected(rows => event.target.checked ? [...rows, video.id] : rows.filter(id => id !== video.id))} /><span className="min-w-0"><strong>{video.classification?.label ?? video.label}</strong><span className="mt-1 block break-all text-[10px] text-sg-muted">{video.id} · {video.classification?.eventId ?? 'Äldre bank'}{video.classification?.situation ? ` · ${video.classification.situation}` : ''}</span></span></label>
            {references.length > 0 && <ul className="mt-2 space-y-1 text-sg-muted">{references.map(row => <li key={row.kind + row.label}>Används: {row.label}</li>)}</ul>}
            {blocker && <p className="mt-2 text-sg-muted">{lifecycleMessage(blocker)}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              {archivedView ? <>
                <button type="button" className={button} disabled={disabled || Boolean(blocker)} onClick={() => reviewClips([video.id], false)}><RotateCcw size={13} />Återställ</button>
                <ClipDeleteAction variant="permanent" project={project} inventory={inventory} catalog={catalog} dealerId={selectedDealer} videoId={video.id} disabled={disabled} onBusyChange={childBusy} onDone={clipDone} />
              </> : <ClipDeleteAction variant="archive" project={project} inventory={inventory} catalog={catalog} dealerId={selectedDealer} videoId={video.id} disabled={disabled} onBusyChange={childBusy} onDone={clipDone} />}
            </div>
          </article>;
        })}
      </div>
      <div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={disabled || !selected.length} onClick={() => reviewClips(selected, !archivedView)}>{archivedView ? <RotateCcw size={13} /> : <Trash2 size={13} />}{archivedView ? 'Återställ valda' : 'Radera valda'} ({selected.length})</button>
        {!archivedView && <button type="button" className={button} disabled={disabled || bank.archived || !visible.length} onClick={() => reviewClips(visible.map(row => row.id), true, true)}>Radera alla {visible.length} klipp</button>}
      </div>
      <p className="text-sg-muted">Hela dealern flyttas till papperskorgen, återställs och raderas under <Link href="/admin/dealers">Dealers</Link>.</p>
      </>}
    </>}
    <ConfirmDialog open={plan !== null} title={dialog?.title ?? 'Granska åtgärden'} description={dialog?.summary} consequences={dialog?.items ?? []}
      error={dialogError} busy={busy && plan !== null} busyLabel={dialog?.busyLabel}
      confirmLabel={dialogConfirm} confirmDisabled={disabled && !busy}
      cancelLabel={plan && !reviewed || reviewed?.error ? 'Stäng' : dialog?.cancelLabel}
      onConfirm={() => void apply()} onCancel={() => { if (!busy) setPlan(null); }} />
  </section>;
}
