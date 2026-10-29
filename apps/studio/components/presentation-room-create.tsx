'use client';

import { useEffect, useRef, useSyncExternalStore, type FormEvent } from 'react';
import {
  createPresentationRoomController, presentationRoomContextKey,
  type PresentationRoomContext, type PresentationRoomController, type PresentationRoomReceipt,
} from '../lib/presentation-room-client.mjs';
import styles from './presentation-room-create.module.css';
import { labUrl } from '../lib/lab-url.mjs';

export type PresentationRoomCreateProps = PresentationRoomContext & {
  hideExisting?: boolean; visual?:boolean;
  interactionDisabled?: boolean;
  onCreated?: (receipt: PresentationRoomReceipt) => void;
  onBusyChange?: (busy: boolean) => void;
  onDraftChange?: (dirty: boolean) => void;
};

export function PresentationRoomCreate({ operator, presentation, projectRevision, projectSaved, storeAvailable, disabled = false, interactionDisabled = false, onCreated, onBusyChange, onDraftChange, hideExisting = false, visual = false }: PresentationRoomCreateProps) {
  const controllerRef = useRef<PresentationRoomController | null>(null);
  if (!controllerRef.current) controllerRef.current = createPresentationRoomController();
  const controller = controllerRef.current;
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const context = { operator, presentation, projectRevision, projectSaved, storeAvailable, disabled };
  const key = presentationRoomContextKey(context);
  const callbacks = useRef({ onCreated, onBusyChange, onDraftChange });
  callbacks.current = { onCreated, onBusyChange, onDraftChange };
  const delivered = useRef<PresentationRoomReceipt | null>(null);
  const current = state.key === key;
  const enabled = Boolean(operator && presentation && projectSaved && storeAvailable && !disabled && !interactionDisabled);
  const busy = current && state.status === 'busy';
  const unresolved = current && state.status === 'uncertain';
  const ready = enabled && current && state.preflight?.ready && state.preflight.projectRevision === projectRevision;

  useEffect(() => {
    void controller.configure(context);
    return () => controller.cancel();
    // The key contains the scalar identity and saved revision. Names only affect labels.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controller, key, projectSaved, storeAvailable, disabled]);

  useEffect(() => {
    callbacks.current.onBusyChange?.(busy);
    return () => callbacks.current.onBusyChange?.(false);
  }, [busy]);

  useEffect(() => {
    if (enabled && current && state.receipt && controller.getSnapshot().receipt === state.receipt && delivered.current !== state.receipt) {
      delivered.current = state.receipt;
      callbacks.current.onCreated?.(state.receipt);
    }
  }, [controller, enabled, current, state.receipt]);

  useEffect(()=>{
    callbacks.current.onDraftChange?.(current && Boolean(state.name.trim()) && !state.receipt);
    return()=>callbacks.current.onDraftChange?.(false);
  },[current,state.name,state.receipt]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if ((!ready && !unresolved) || busy) return;
    callbacks.current.onBusyChange?.(true);
    void controller.create(key).finally(()=>callbacks.current.onBusyChange?.(controller.getSnapshot().status==='busy'));
  }
  const message = !storeAvailable ? 'Spelbord kräver en ansluten lagring.'
    : !projectSaved ? 'Spara miljön först.'
      : !operator || !presentation ? 'Välj bolag och miljö.'
        : current ? state.message : null;
  const staleProject = current && !unresolved && Boolean(state.preflight && state.preflight.projectRevision !== projectRevision);
  const packageConflict = current && !unresolved && state.preflight?.reason === 'presentation_package_conflict';
  const needsEnvironment = current && !unresolved && state.preflight?.reason === 'presentation_room_environment_required';
  const needsComposition = current && !unresolved && ['presentation_lane_incompatible', 'presentation_package_too_large', 'presentation_room_environment_required'].includes(state.preflight?.reason ?? '');
  // Rooms are created and reviewed on Spelbolag & rum; the room link resolves its own composition.
  const reloadHref = labUrl('/admin/rooms?' + new URLSearchParams({ operator: operator?.id ?? '' }));
  const compositionHref = labUrl('/admin/scenes?' + new URLSearchParams({ composition: presentation?.id ?? '' }));
  const conflictCode = !staleProject && packageConflict ? state.preflight?.conflictCode : null;
  const recovery = ['presentation_shared_dealer_conflict', 'presentation_shared_layer_conflict', 'presentation_legacy_package_conflict'].includes(conflictCode ?? '')
    ? { href: '#operator-package-selection', label: 'Granska hela paketurvalet' }
    : conflictCode === 'presentation_room_environment_conflict'
      ? { href: compositionHref, label: 'Skapa en separat miljö' }
    : conflictCode === 'presentation_room_binding_conflict' || conflictCode === 'presentation_game_lane_conflict'
      ? { href: reloadHref, label: 'Kontrollera spelbordet' } : null;
  const refresh = current && !staleProject && !packageConflict && !needsComposition && (state.status === 'conflict' || state.status === 'unavailable' || state.status === 'error' && !state.preflight);
  const canCreate = enabled && (ready || unresolved) && ['ready', 'uncertain', 'error'].includes(state.status) && (unresolved || Boolean(state.name.trim()));
  const receipt = current && projectSaved && storeAvailable ? state.receipt : null;

  const rooms = current && enabled ? state.preflight?.rooms : undefined;
  return <section className={styles.card+(visual?' '+styles.visual:'')} aria-label="Spelbord">
    {!visual&&<div className={styles.heading}><div><span className={styles.eyebrow}>SPELARENS INGÅNG</span><h2>{visual?'Välj spel och namn':'Spelbord'}</h2></div>{rooms ? <span className={styles.count}>{rooms.length} befintliga spelbord</span> : null}</div>}
    {!visual && operator && presentation ? <p className={styles.context}>{operator.name} · {presentation.label}</p> : null}
    {current && state.preflight?.environment ? <p><strong>Spelbordets miljö:</strong> {state.preflight.environment.label}
      {state.preflight.environment.kind === 'baked' ? ' · inbakad miljö' : state.preflight.environment.fixed ? ' · fast bakgrund' : ' · behöver avgränsas'}</p> : null}
    {!visual&&<p>Spelaren väljer ett spelbord i bolagets lobby. Återanvänd spelbordet när du ändrar utseende eller klipp.</p>}
    {!hideExisting&&operator&&(rooms?.length||receipt)?<p><a className="sg-btn sg-btn-primary" href={'/lobby?operator='+encodeURIComponent(operator.slug)}>Öppna bolagets spellobby</a></p>:null}
    {!hideExisting&&rooms?.length ? <ul aria-label="Befintliga spelbord">{rooms.map(room=><li key={room.id}><a href={room.playUrl}>Öppna {room.name}</a></li>)}</ul>
      : !hideExisting && rooms && !receipt ? <p>Inget publicerat spelbord för den här miljön ännu.</p> : null}
    <details className={styles.create} open={visual || rooms?.length === 0 && !receipt || undefined}><summary>Skapa nytt spelbord</summary>
    <p>Ange ett namn. Miljön publiceras och kopplas till spelbordet i samma steg.</p>
    <form className={styles.form} onSubmit={submit}>
      {visual?<div role="group" aria-label="Välj spel" className={styles.gameChoices}>{(['blackjack','roulette'] as const).map(game=><button key={game} className="sg-btn" type="button" aria-pressed={state.game===game} disabled={!enabled||!current||busy||unresolved||state.status==='loading'} onClick={()=>controller.setGame(game)}>{game==='blackjack'?'♠ Blackjack':'◉ Roulette'}</button>)}</div>:<label className={styles.field}>Spel
        <select value={current ? state.game : 'blackjack'} disabled={!enabled || !current || busy || unresolved || state.status === 'loading'} onChange={event=>controller.setGame(event.target.value)}>
          <option value="blackjack">Blackjack</option><option value="roulette">Roulette · enkel nolla</option>
        </select>
      </label>}
      <label className={styles.field}>{visual?'Namn i bolagets utbud':'Spelbordets namn'}
        <input type="text" value={current ? state.name : ''} maxLength={100} required
          disabled={!enabled || !current || busy || unresolved || state.status === 'loading'} onChange={event => { controller.setName(event.target.value);callbacks.current.onDraftChange?.(Boolean(controller.getSnapshot().name.trim())); }} autoComplete="off" />
      </label>
      <div className={styles.actions}>
        {recovery ? null : staleProject || packageConflict ? <a className="sg-btn sg-btn-primary" href={reloadHref} aria-disabled={!enabled}
          onClick={event => { if (!enabled) event.preventDefault(); }}>Läs in aktuella uppgifter</a>
          : needsComposition ? <a className="sg-btn sg-btn-primary" href={compositionHref} aria-disabled={!enabled}
            onClick={event => { if (!enabled) event.preventDefault(); }}>{needsEnvironment ? 'Välj och lås miljön i Miljöer' : 'Kontrollera miljön'}</a>
          : refresh ? <button className="sg-btn sg-btn-primary" type="button" disabled={!enabled}
          onClick={() => { if (enabled) void controller.refresh(); }}>Uppdatera uppgifter</button>
          : receipt ? <a className="sg-btn sg-btn-primary" href={receipt.playUrl}>Öppna spelbordet</a>
            : <button className="sg-btn sg-btn-primary" type="submit" disabled={!canCreate || busy}>
              {busy ? 'Skapar…' : unresolved ? 'Försök igen' : visual ? 'Lägg till spel' : 'Skapa spelbord'}</button>}
      </div>
    </form>
    </details>
    {current && state.status === 'loading' ? <p role="status">Kontrollerar…</p> : null}
    {message ? <p role={current && ['error', 'conflict', 'uncertain'].includes(state.status) ? 'alert' : 'status'}>{message}</p> : null}
    {recovery ? <p><a className="sg-btn sg-btn-primary" href={recovery.href} aria-disabled={!enabled}
      onClick={event => { if (!enabled) event.preventDefault(); }}>{recovery.label}</a></p> : null}
    {receipt ? <p role="status">{receipt.room.name} är klart. <a href={receipt.playUrl}>Öppna spelbordet</a></p> : null}
  </section>;
}
