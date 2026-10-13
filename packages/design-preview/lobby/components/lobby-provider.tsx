"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { loadLobbyCatalog, lobbySelection, type LobbyCatalog, type Dealer, type Operator, type Room } from '@/lib/catalog.mjs';

export const STEP_IDS = { operator: 'bolag', room: 'spelrum', dealer: 'dealers' } as const;
export type LobbyStep = 1 | 2 | 3 | 4;
export function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
}
type SelectOptions = { advance?: boolean };
type LobbyContextValue = LobbyCatalog & {
  status: 'loading' | 'ready' | 'error'; error: string | null; reload: () => void;
  operator: Operator | null; room: Room | null; dealer: Dealer | null;
  availableRooms: Room[]; availableDealers: Dealer[]; step: LobbyStep;
  selectOperator: (id: string | null, options?: SelectOptions) => void;
  selectRoom: (key: string | null, options?: SelectOptions) => void;
  selectDealer: (id: string | null) => void; reset: () => void;
};
const EMPTY: LobbyCatalog = { operators: [], rooms: [], dealers: [] };
const LobbyContext = createContext<LobbyContextValue | null>(null);

export function LobbyProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<LobbyCatalog>(EMPTY);
  const [status, setStatus] = useState<LobbyContextValue['status']>('loading');
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [operatorId, setOperatorId] = useState<string | null>(null);
  const [roomKey, setRoomKey] = useState<string | null>(null);
  const [dealerId, setDealerId] = useState<string | null>(null);
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
  const reload = useCallback(() => setRevision(value => value + 1), []);
  const { operator, room, dealer, availableRooms, availableDealers } = lobbySelection(catalog, { operatorId, roomKey, dealerId });
  const selectOperator = useCallback((id: string | null, options?: SelectOptions) => {
    const next = catalog.operators.find(row => row.id === id);
    setOperatorId(next?.id ?? null); setRoomKey(null); setDealerId(null);
    if (next && options?.advance) scrollToSection(STEP_IDS.room);
  }, [catalog]);
  const selectRoom = useCallback((key: string | null, options?: SelectOptions) => {
    const next = availableRooms.find(row => row.key === key);
    setRoomKey(next?.key ?? null); setDealerId(null);
    if (next && options?.advance) scrollToSection(STEP_IDS.dealer);
  }, [availableRooms]);
  const selectDealer = useCallback((id: string | null) => {
    setDealerId(room?.dealers.some(row => row.id === id) ? id : null);
  }, [room]);
  const reset = useCallback(() => {
    setOperatorId(null); setRoomKey(null); setDealerId(null); scrollToSection(STEP_IDS.operator);
  }, []);
  const step: LobbyStep = !operator ? 1 : !room ? 2 : !dealer ? 3 : 4;
  return <LobbyContext.Provider value={{ ...catalog, status, error, reload, operator, room, dealer,
    availableRooms, availableDealers, step, selectOperator, selectRoom, selectDealer, reset }}>
    {children}
  </LobbyContext.Provider>;
}
export function useLobby() {
  const context = useContext(LobbyContext);
  if (!context) throw new Error('useLobby must be used inside <LobbyProvider>');
  return context;
}
