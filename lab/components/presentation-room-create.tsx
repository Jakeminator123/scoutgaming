'use client';

import { useEffect, useRef, useSyncExternalStore, type FormEvent } from 'react';
import {
  createPresentationRoomController, presentationRoomContextKey,
  type PresentationRoomContext, type PresentationRoomController, type PresentationRoomReceipt,
} from '../lib/presentation-room-client.mjs';
import styles from './presentation-room-create.module.css';

export type PresentationRoomCreateProps = PresentationRoomContext & {
  onCreated?: (receipt: PresentationRoomReceipt) => void;
  onBusyChange?: (busy: boolean) => void;
};

export function PresentationRoomCreate({ operator, presentation, projectRevision, projectSaved, storeAvailable, disabled = false, onCreated, onBusyChange }: PresentationRoomCreateProps) {
  const controllerRef = useRef<PresentationRoomController | null>(null);
  if (!controllerRef.current) controllerRef.current = createPresentationRoomController();
  const controller = controllerRef.current;
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const context = { operator, presentation, projectRevision, projectSaved, storeAvailable, disabled };
  const key = presentationRoomContextKey(context);
  const callbacks = useRef({ onCreated, onBusyChange });
  callbacks.current = { onCreated, onBusyChange };
  const delivered = useRef<PresentationRoomReceipt | null>(null);
  const current = state.key === key;
  const enabled = Boolean(operator && presentation && projectSaved && storeAvailable && !disabled);
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

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || busy) return;
    void controller.create(key);
  }
  const message = !storeAvailable ? 'Spelrum kräver en ansluten lagring.'
    : !projectSaved ? 'Spara presentationen först.'
      : !operator || !presentation ? 'Välj bolag och presentation.'
        : current ? state.message : null;
  const refresh = current && (state.status === 'conflict' || state.status === 'unavailable' || state.status === 'error' && !state.preflight);
  const canCreate = ready && ['ready', 'uncertain', 'error'].includes(state.status) && (unresolved || Boolean(state.name.trim()));
  const receipt = current && projectSaved && storeAvailable ? state.receipt : null;

  const rooms = current && enabled ? state.preflight?.rooms : undefined;
  return <section className={styles.card} aria-label="Spelrum">
    <h2>Spelrum</h2>
    {operator && presentation ? <p className={styles.context}>{operator.name} · {presentation.label}</p> : null}
    <p>Ett spelrum öppnar det publicerade paketet för valt bolag. Återanvänd rummet när du ändrar presentationens lager eller klipp.</p>
    {rooms?.length ? <ul aria-label="Befintliga spelrum">{rooms.map(room=><li key={room.id}><a href={room.playUrl}>Öppna {room.name}</a></li>)}</ul>
      : rooms && !receipt ? <p>Inget publicerat spelrum för den här presentationen ännu.</p> : null}
    <details><summary>Skapa nytt spelrum</summary>
    <p>Skapar ett nytt rum och publicerar vald presentation i bolagets paket.</p>
    <form className={styles.form} onSubmit={submit}>
      <label className={styles.field}>Rumsnamn
        <input type="text" value={current ? state.name : ''} maxLength={100} required
          disabled={!enabled || !current || busy || unresolved || state.status === 'loading'} onChange={event => controller.setName(event.target.value)} autoComplete="off" />
      </label>
      <div className={styles.actions}>
        {refresh ? <button className="sg-btn sg-btn-primary" type="button" disabled={!enabled}
          onClick={() => { if (enabled) void controller.refresh(); }}>Uppdatera uppgifter</button>
          : receipt ? <a className="sg-btn sg-btn-primary" href={receipt.playUrl}>Öppna spelrummet</a>
            : <button className="sg-btn sg-btn-primary" type="submit" disabled={!canCreate || busy}>
              {busy ? 'Skapar…' : unresolved ? 'Försök igen' : 'Skapa spelrum'}</button>}
      </div>
    </form>
    </details>
    {current && state.status === 'loading' ? <p role="status">Kontrollerar…</p> : null}
    {message ? <p role={current && ['error', 'conflict', 'uncertain'].includes(state.status) ? 'alert' : 'status'}>{message}</p> : null}
    {receipt ? <p role="status">{receipt.room.name} är klart. <a href={receipt.playUrl}>Öppna spelrummet</a></p> : null}
  </section>;
}
