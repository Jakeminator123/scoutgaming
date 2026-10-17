'use client';
import { useEffect, useRef, useState } from 'react';
import { Archive, RotateCcw, Trash2 } from 'lucide-react';
import type { StudioProject } from '../../../../../packages/presentation/contracts/studio-model.mjs';
import { validateProject } from '../../../../../packages/presentation/contracts/studio-model.mjs';
import { createDealerSet, dealerSetsForClip, editDealerSet, removeDealerSet, validateDealerSetBindings } from '../../../../../packages/presentation/contracts/dealer-sets.mjs';
import type { DealerArchiveImpact } from '../../../../../lab/lib/dealer-archive-impact.mjs';
import type { Catalog, VideoInventory } from '../../lib/connected-studio.mjs';
import { clipLifecycleBlocker, createLifecycleClient, lifecycleBank, lifecycleClipReferences, lifecycleFingerprint, lifecycleMessage, type DeletionPlan } from '../../lib/studio-lifecycle.mjs';

const client = createLifecycleClient();
const button = 'inline-flex items-center justify-center gap-2 rounded border border-sg-line px-3 py-2 text-xs disabled:opacity-40';
const input = 'min-w-0 rounded border border-sg-line bg-sg-bg p-2 text-xs';
type Plan = { dealerId: string; fingerprint: string; ids: string[] } & (
  { kind: 'clips'; archived: boolean; all: boolean } | { kind: 'dealer'; archived: boolean; impact?: DealerArchiveImpact }
  | { kind: 'delete-clip'; eligibility: DeletionPlan } | { kind: 'delete-dealer'; eligibility: DeletionPlan }
);
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
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false), [invalidated, setInvalidated] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const lock = useRef(false);
  const current = useRef({ project, inventory, selectedDealer, onReload, onBusyChange });
  current.current = { project, inventory, selectedDealer, onReload, onBusyChange };
  useEffect(() => { setSelectedDealer(dealerId); }, [dealerId]);
  useEffect(() => { setSelected([]); setPlan(null); setConfirmation(''); setError(''); setNotice(''); }, [selectedDealer]);
  useEffect(() => { setSelected([]); setPlan(null); setConfirmation(''); setInvalidated(false); }, [project, inventory]);
  const bank = lifecycleBank(project, inventory, catalog, selectedDealer);
  const disabled = blocked || busy || invalidated;
  const visible = bank?.videos.filter(row => Boolean(row.classification?.archived) === archivedView) ?? [];
  const reviewed = plan && plan.dealerId === selectedDealer && plan.fingerprint === lifecycleFingerprint(project, inventory, selectedDealer, plan.ids) ? plan : null;
  function snapshot(ids: string[]) { return { dealerId: selectedDealer, ids, fingerprint: lifecycleFingerprint(project, inventory, selectedDealer, ids) }; }
  function stillCurrent(value: Pick<Plan, 'dealerId'|'ids'|'fingerprint'>) {
    const state = current.current;
    return state.selectedDealer === value.dealerId && value.fingerprint === lifecycleFingerprint(state.project, state.inventory, value.dealerId, value.ids);
  }
  async function run(action: () => Promise<void>, mutation = false) {
    if (disabled || lock.current) return;
    lock.current = true; setBusy(true); current.current.onBusyChange?.(true); setError(''); setNotice('');
    if (mutation) { setInvalidated(true); setPlan(null); setConfirmation(''); }
    try { await action(); }
    catch (cause) {
      const completed = (cause as { completed?: string[] })?.completed?.length ?? 0;
      setError((completed ? `${completed} klipp ändrades innan åtgärden stoppades. ` : '') + lifecycleMessage(cause) + (mutation ? ' Registret läses om; åtgärden upprepas inte automatiskt.' : ''));
      setPlan(null);
    } finally {
      // Release the parent's mutation guard before requesting its registered
      // snapshot read. A failed read keeps this panel invalidated.
      current.current.onBusyChange?.(false);
      if (mutation) try { await current.current.onReload(); } catch { setError(value => value + ' Registret kunde inte läsas om.'); }
      lock.current = false; setBusy(false);
    }
  }
  function reviewClips(ids: string[], archived: boolean, all = false) {
    if (disabled || !bank || !ids.length) return;
    const blockers = ids.map(id => clipLifecycleBlocker(project, bank.videos.find(row => row.id === id), selectedDealer, archived ? 'archive' : 'restore')).filter(Boolean);
    if (blockers.length) { setError(lifecycleMessage(blockers[0])); setPlan(null); return; }
    setError(''); setConfirmation(''); setPlan({ ...snapshot(ids), kind: 'clips', archived, all });
  }
  async function reviewDealer(archived: boolean) {
    if (!bank) return;
    const captured = snapshot(bank.videos.map(row => row.id));
    if (!archived) { setConfirmation(''); setPlan({ ...captured, kind: 'dealer', archived: false }); return; }
    await run(async () => {
      const impact = await client.checkDealerArchive(project, selectedDealer);
      if (stillCurrent(captured)) setPlan({ ...captured, kind: 'dealer', archived: true, impact });
    });
  }
  async function reviewDeletion(id?: string) {
    if (!bank) return;
    const captured = snapshot(id ? [id] : bank.videos.map(row => row.id));
    setConfirmation('');
    await run(async () => {
      const eligibility = id ? await client.checkClipDeletion(project, inventory, selectedDealer, id) : await client.checkDealerDeletion(project, selectedDealer);
      if (stillCurrent(captured)) setPlan(id ? { ...captured, kind: 'delete-clip', eligibility } : { ...captured, kind: 'delete-dealer', eligibility });
    });
  }
  async function apply() {
    if (!reviewed || !bank) return;
    const captured = reviewed;
    if (captured.kind.startsWith('delete') && (!('eligibility' in captured) || !captured.eligibility.allowed || confirmation !== (captured.kind === 'delete-dealer' ? selectedDealer : captured.ids[0]))) return;
    await run(async () => {
      const unchanged = () => stillCurrent(captured);
      if (captured.kind === 'clips') {
        const completed = await client.archiveClips({ project, inventory, dealerId: captured.dealerId, ids: captured.ids, archived: captured.archived, stillCurrent: unchanged });
        setNotice(`${completed.length} klipp ${captured.archived ? 'arkiverade' : 'återställda'}. Mediafilerna är bevarade.`);
      } else if (captured.kind === 'dealer') {
        await client.dealerLifecycle(project, captured.dealerId, captured.archived, captured.impact, unchanged);
        setNotice(captured.archived ? 'Dealern, berörda sammansättningar och klipp är arkiverade. Filerna är bevarade.' : 'Dealern är återställd till utkast med tal avstängt. Rum och bolagspaket återöppnas separat.');
      } else if (captured.kind === 'delete-clip') {
        await client.deleteClip(project, inventory, captured.dealerId, captured.ids[0], unchanged);
        setNotice('Det uttryckligen valda klippet är permanent raderat.');
      } else {
        await client.deleteDealer(project, captured.dealerId, unchanged);
        setNotice('Dealeridentiteten och alla dess tillåtna mediafiler är permanent raderade.');
      }
    }, true);
  }
  return <section className="studio-lifecycle-panel flex flex-col gap-4 text-xs" aria-label="Arkiv och livscykel">
    <header><p className="font-mono text-[10px] uppercase tracking-widest text-sg-muted">Registrerade resurser</p><h2 className="mt-1 text-base font-semibold">Klipp & arkiv</h2></header>
    <label className="flex flex-col gap-1 text-sg-muted">Dealeridentitet
      <select className={input} value={selectedDealer} disabled={busy} onChange={event => setSelectedDealer(event.target.value)}>
        {!catalog.administration.dealers.some(row => row.id === selectedDealer) && <option value="">Välj en registrerad dealer</option>}
        {catalog.administration.dealers.map(row => <option key={row.id} value={row.id}>{row.name} · {row.id}{row.archived ? ' · arkiv' : ''}</option>)}
      </select>
    </label>
    {blocked && (view === 'clips' || editBlocked) && <p role="status" className="text-amber-300">Spara eller kasta det pågående utkastet innan du ändrar arkivet.</p>}
    {busy && <p role="status">Kontrollerar aktuella register…</p>}
    {error && <p role="alert" className="text-amber-300">{error}</p>}
    {notice && <p role="status" className="text-sg-lime">{notice}</p>}
    {invalidated && !busy && <button type="button" className={button} disabled={blocked} onClick={() => void onReload()}><RotateCcw size={13} /> Läs om registret</button>}
    {!bank ? <p>Ingen sådan dealer finns i de inlästa registren. En ny setversion måste registreras innan den får media och livscykelåtgärder.</p> : <>
      <div className="rounded border border-sg-line p-3"><strong>{bank.dealer.label}</strong><p className="mt-1 text-sg-muted">Identitet: <code>{bank.dealer.id}</code> · {bank.archived ? 'Arkiverad' : 'Aktiv'} · {bank.videos.length} mediafiler</p>
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
      <div className="flex gap-2" role="group" aria-label="Visa klipp"><button type="button" className={button} aria-pressed={!archivedView} disabled={busy} onClick={() => { setArchivedView(false); setSelected([]); setPlan(null); }}>Bibliotek ({bank.videos.filter(row => !row.classification?.archived).length})</button><button type="button" className={button} aria-pressed={archivedView} disabled={busy} onClick={() => { setArchivedView(true); setSelected([]); setPlan(null); }}><Trash2 size={13} /> Arkiv ({bank.videos.filter(row => row.classification?.archived).length})</button></div>
      <div className="max-h-80 space-y-2 overflow-y-auto" aria-label={archivedView ? 'Arkiverade klipp' : 'Registrerade klipp'}>
        {!visible.length && <p className="text-sg-muted">Inga klipp i denna vy.</p>}
        {visible.map(video => {
          const blocker = clipLifecycleBlocker(project, video, selectedDealer, archivedView ? 'restore' : 'archive');
          const references = lifecycleClipReferences(project, video.id, { includeArchive: archivedView });
          return <article key={video.id} className="rounded border border-sg-line p-3">
            <label className="flex items-start gap-2"><input type="checkbox" className="mt-0.5" checked={selected.includes(video.id)} disabled={disabled || Boolean(blocker)} onChange={event => setSelected(rows => event.target.checked ? [...rows, video.id] : rows.filter(id => id !== video.id))} /><span className="min-w-0"><strong>{video.classification?.label ?? video.label}</strong><span className="mt-1 block break-all text-[10px] text-sg-muted">{video.id} · {video.classification?.eventId ?? 'Äldre bank'}{video.classification?.situation ? ` · ${video.classification.situation}` : ''}</span></span></label>
            {references.length > 0 && <ul className="mt-2 space-y-1 text-sg-muted">{references.map(row => <li key={row.kind + row.label}>Används: {row.label}</li>)}</ul>}
            {blocker && <p className="mt-2 text-sg-muted">{lifecycleMessage(blocker)}</p>}
            {archivedView && <details className="mt-2"><summary className="cursor-pointer text-sg-muted">Permanent radering</summary><p className="my-2 text-sg-muted">Servern måste godkänna ägarskap och publicerade eller delade referenser.</p><button type="button" className={button} disabled={disabled || Boolean(clipLifecycleBlocker(project, video, selectedDealer, 'delete'))} onClick={() => void reviewDeletion(video.id)}>Kontrollera detta klipp</button></details>}
          </article>;
        })}
      </div>
      <div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={disabled || !selected.length} onClick={() => reviewClips(selected, !archivedView)}>{archivedView ? <RotateCcw size={13} /> : <Archive size={13} />}{archivedView ? 'Återställ valda' : 'Arkivera valda'} ({selected.length})</button>
        {!archivedView && <button type="button" className={button} disabled={disabled || bank.archived || !visible.length} onClick={() => reviewClips(visible.map(row => row.id), true, true)}>Granska alla {visible.length} klipp</button>}
      </div>
      <details className="rounded border border-sg-line p-3"><summary className="cursor-pointer">Hela dealeridentiteten</summary>
        {project.dealerSets?.some(row => row.dealerId === selectedDealer) && <p className="mt-2 text-amber-300">Dealern har sparade eller arkiverade kategorier. Ta bort kategorietiketterna och spara först. Kategoriernas klipp bevaras.</p>}
        <p className="my-3 text-sg-muted">Dealerarkivering flyttar även dess klipp och berörda sammansättningar till arkivet, stänger av tal och ändrar berörda rum och bolagspaket. Filer och historik bevaras.</p>
        {bank.deletionPending ? <p className="text-amber-300">Permanent radering har påbörjats. Återställning är spärrad.</p> : <button type="button" className={button} disabled={disabled} onClick={() => void reviewDealer(!bank.archived)}>{bank.archived ? <RotateCcw size={13} /> : <Archive size={13} />}{bank.archived ? 'Granska återställning av dealer' : 'Kontrollera dealerarkivering'}</button>}
        {bank.archived && <details className="mt-3"><summary className="cursor-pointer text-sg-muted">Radera dealer och alla dess mediafiler permanent</summary><p className="my-3 text-sg-muted">Detta tar bort hela den arkiverade identiteten och samtliga tillåtna filer. Delad originalmedia och publicerade beroenden spärrar åtgärden.</p><button type="button" className={button} disabled={disabled} onClick={() => void reviewDeletion()}>{bank.deletionPending ? 'Kontrollera för att slutföra radering' : 'Kontrollera permanent radering'}</button></details>}
      </details>
      {reviewed && <div className="rounded border border-sg-lime/40 p-3" role="group" aria-label="Granska och bekräfta livscykelåtgärd">
        <h3 className="font-semibold">{reviewed.kind === 'clips' ? `${reviewed.archived ? 'Arkivera' : 'Återställ'} ${reviewed.all ? 'alla' : 'valda'} ${reviewed.ids.length} klipp?` : reviewed.kind === 'dealer' ? `${reviewed.archived ? 'Arkivera' : 'Återställ'} dealeridentiteten ${bank.dealer.label}?` : reviewed.kind === 'delete-clip' ? 'Radera detta klipp permanent?' : 'Radera dealeridentiteten och alla dess filer permanent?'}</h3>
        {reviewed.kind === 'clips' && <><ul className="my-2 space-y-1">{reviewed.ids.map(id => <li key={id}>{bank.videos.find(row => row.id === id)?.label ?? id}</li>)}</ul><p className="my-2 text-sg-muted">Filerna bevaras. Flera klipp ändras ett i taget; om servern stoppar ett klipp avbryts resten och redan ändrade klipp redovisas.</p></>}
        {reviewed.kind === 'dealer' && (reviewed.impact ? <><p className="my-2">{reviewed.impact.mediaCount} mediafiler. Tal {reviewed.impact.speechEnabled ? 'stängs av' : 'är avstängt'}.</p><ul className="my-2 space-y-1">{reviewed.impact.compositions.map(row => <li key={'c' + row.id}>Sammansättning arkiveras: {row.label}</li>)}{reviewed.impact.rooms.map(row => <li key={'r' + row.id}>Rum arkiveras: {row.name}</li>)}{reviewed.impact.operators.map(row => <li key={'o' + row.id}>Bolagspaket ändras: {row.name}</li>)}</ul></> : <p className="my-2 text-sg-muted">Dealer och bevarade klipp återställs till utkast med tal avstängt. Bolagspaket och spelrum behöver granskas och återställas separat.</p>)}
        {'eligibility' in reviewed && (reviewed.eligibility.allowed ? <><p className="my-2 text-amber-300">Serverns kontroll tillåter radering just nu. Åtgärden kan inte ångras.</p><label className="flex flex-col gap-1">Skriv {reviewed.kind === 'delete-dealer' ? selectedDealer : reviewed.ids[0]} för att bekräfta<input className={input} autoComplete="off" value={confirmation} disabled={disabled} onChange={event => setConfirmation(event.target.value)} /></label></> : <p className="my-2 text-amber-300">{lifecycleMessage(reviewed.eligibility.reason)}</p>)}
        <div className="mt-3 flex gap-2"><button type="button" className={button} disabled={disabled || 'eligibility' in reviewed && (!reviewed.eligibility.allowed || confirmation !== (reviewed.kind === 'delete-dealer' ? selectedDealer : reviewed.ids[0]))} onClick={() => void apply()}>Bekräfta {reviewed.kind.startsWith('delete') ? 'permanent radering' : 'ändringen'}</button><button type="button" className={button} disabled={busy} onClick={() => { setPlan(null); setConfirmation(''); }}>Avbryt</button></div>
      </div>}
      </>}
    </>}
  </section>;
}
