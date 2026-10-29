"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode, type MouseEvent } from 'react';
import { loadLobbyCatalog, lobbySelection, lobbyQuerySelection, type LobbyCatalog, type Dealer, type RoomDealer, type Operator, type Room } from '@/lib/catalog.mjs';
import { studioHistory } from '../../../lib/studio-history.mjs';
import { roomSelection, rememberRoomSelection, readRoomSelection, type RoomSelection } from '../../../../../packages/player-catalog/room-selection.mjs';

export const STEP_IDS = { operator: 'bolag', room: 'spelbord', dealer: 'dealers' } as const;
export type LobbyStep = 1 | 2 | 3 | 4;
export function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
}
type SelectOptions = { advance?: boolean };
type LobbyContextValue = LobbyCatalog & {
  status: 'loading' | 'ready' | 'error'; error: string | null; reload: () => void;
  operator: Operator | null; room: Room | null; dealer: RoomDealer | null;
  availableRooms: Room[]; availableDealers: Dealer[]; step: LobbyStep;
  selectOperator: (id: string | null, options?: SelectOptions) => void;
  selectRoom: (key: string | null, options?: SelectOptions) => void;
  selectDealer: (id: string | null) => void; reset: () => void;
  choices: RoomSelection | null; selectEnvironment: (key: 'tableAsset' | 'background', id: string) => void;
  prepareLaunch: (event: MouseEvent<HTMLAnchorElement>) => void; launchError: string | null;
};
const EMPTY: LobbyCatalog = { operators: [], rooms: [], dealers: [] };
const LobbyContext = createContext<LobbyContextValue | null>(null);

export function LobbyProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<LobbyCatalog>(EMPTY);
  const [status, setStatus] = useState<LobbyContextValue['status']>('loading');
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState(() => typeof window === 'undefined' ? '' : window.location.search);
  const [launchError, setLaunchError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading'); setError(null); setCatalog(EMPTY);
    loadLobbyCatalog({ signal: controller.signal }).then(next => {
      if (controller.signal.aborted) return;
      setCatalog(next); setStatus('ready');
    }).catch(reason => {
      if (controller.signal.aborted) return;
      setStatus('error');
      setError(reason instanceof Error && reason.message.startsWith('Din session')
        ? reason.message : 'Spelkatalogen kunde inte hämtas. Inga spelval är tillgängliga.');
    });
    return () => controller.abort();
  }, [revision]);
  useEffect(() => {
    const history = studioHistory(window);
    const sync = () => {
      const next = new URL(history.snapshotHref(), window.location.origin).search;
      setSearch(next);
    };
    const unsubscribe = history.subscribe(sync);
    sync();
    return unsubscribe;
  }, []);
  const writeSelection = useCallback((operatorId: string | null, roomId: string | null, dealerId: string | null = null, choices: Partial<RoomSelection> = {}) => {
    const history = studioHistory(window);
    const url = new URL(history.snapshotHref(), window.location.origin);
    if (operatorId) url.searchParams.set('operator', operatorId); else url.searchParams.delete('operator');
    for (const key of ['room', 'table', 'dealer', 'tableAsset', 'background']) url.searchParams.delete(key);
    if (operatorId && roomId) url.searchParams.set('room', roomId);
    if (operatorId && roomId && dealerId) {
      url.searchParams.set('dealer', dealerId);
      for (const key of ['tableAsset', 'background'] as const) if (Object.hasOwn(choices, key)) url.searchParams.set(key, choices[key] ?? '');
    }
    const href = url.pathname + url.search + url.hash;
    if (href !== history.snapshotHref() && (!history.canNavigate(href) || !history.push(href))) return false;
    setLaunchError(null);
    return true;
  }, []);
  const reload = useCallback(() => setRevision(value => value + 1), []);
  const requested = lobbyQuerySelection(catalog, search);
  const selected = lobbySelection(catalog, requested);
  let stored: Partial<RoomSelection> = {};
  try { if (selected.operator) stored = readRoomSelection(window.localStorage, selected.operator.id); } catch { /* Storage is optional until a launch needs explicit layer choices. */ }
  const query = new URLSearchParams(search);
  // The engine returns a validated company/room; only still-allowed saved dealer preferences may fill an absent selector.
  const { operator, room, dealer, availableRooms, availableDealers } = lobbySelection(catalog, {
    ...requested, dealerId: query.has('dealer') ? requested.dealerId : stored.dealer ?? null,
  });
  const preferred = { ...stored, dealer: dealer?.id };
  for (const key of ['tableAsset', 'background'] as const) if (query.has(key)) preferred[key] = query.getAll(key).length === 1 ? query.get(key)! : '';
  const choices = room && dealer ? roomSelection(room, preferred) : null;
  const selectOperator = useCallback((id: string | null, options?: SelectOptions) => {
    const next = catalog.operators.find(row => row.id === id);
    if (!writeSelection(next?.id ?? null, null)) return;
    if (next && options?.advance) scrollToSection(STEP_IDS.room);
  }, [catalog, writeSelection]);
  const selectRoom = useCallback((key: string | null, options?: SelectOptions) => {
    const next = availableRooms.find(row => row.key === key);
    if (!writeSelection(operator?.id ?? null, next?.id ?? null)) return;
    if (next && options?.advance) scrollToSection(STEP_IDS.dealer);
  }, [availableRooms, operator, writeSelection]);
  const selectDealer = useCallback((id: string | null) => {
    const selected = room?.dealers.find(row => row.id === id);
    if (!operator || !room || !selected || selected.id === dealer?.id) return;
    let previous: Partial<RoomSelection> = {};
    try { previous = readRoomSelection(window.localStorage, operator.id); } catch { /* Defaults are validated against the room. */ }
    writeSelection(operator.id, room.id, selected.id, roomSelection(room, { ...previous, dealer: selected.id }) ?? {});
  }, [operator, room, dealer?.id, writeSelection]);
  const selectEnvironment = (key: 'tableAsset' | 'background', id: string) => {
    if (!operator || !room || !dealer || !choices) return;
    const next = roomSelection(room, { ...choices, [key]: id });
    if (next) writeSelection(operator.id, room.id, dealer.id, { ...next, tableAsset: next.tableAsset ?? '', background: next.background ?? '' });
  };
  const prepareLaunch = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!operator || !room || !dealer || !choices) { event.preventDefault(); return; }
    let saved = false;
    try { saved = rememberRoomSelection(window.localStorage, operator.id, choices); }
    catch { saved = !choices.tableAsset && !choices.background; }
    if (!saved) {
      event.preventDefault();
      setLaunchError('Dina miljöval kunde inte sparas. Tillåt lokal lagring och försök igen.');
    }
  };
  const reset = useCallback(() => {
    if (writeSelection(null, null)) scrollToSection(STEP_IDS.operator);
  }, [writeSelection]);
  const step: LobbyStep = !operator ? 1 : !room ? 2 : !dealer ? 3 : 4;
  return <LobbyContext.Provider value={{ ...catalog, status, error, reload, operator, room, dealer,
    availableRooms, availableDealers, step, selectOperator, selectRoom, selectDealer, reset, choices, selectEnvironment, prepareLaunch, launchError }}>
    {status === 'ready' && requested.unavailable && <p role="alert" className="border-b border-border bg-card px-5 py-4 text-sm text-off md:px-10">Det länkade valet är inte tillgängligt. Välj bolag och spelbord igen.</p>}
    {children}
  </LobbyContext.Provider>;
}
export function useLobby() {
  const context = useContext(LobbyContext);
  if (!context) throw new Error('useLobby must be used inside <LobbyProvider>');
  return context;
}
