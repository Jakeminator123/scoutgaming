'use client';

import { useEffect, useRef, useState } from 'react';
import { ControlOperatorDirectory, type OperatorDirectory } from './control-operator-directory';
import { ControlResourceLifecycle, type LifecycleSnapshot } from './control-resource-lifecycle';
import { studioHistory } from '../lib/studio-history.mjs';
import { PageTemplate } from './page-template.mjs';
import styles from './admin-publication-page.module.css';

// Bolag & team (/admin/companies): the company directory and the company lifecycle.
// Package publication lives on Spelbolag & rum (/admin/rooms, RegisteredStudio).
export type PublicationOperatorChoice = { id: string; slug: string; name: string; status?: string; archivedAt?: string | null; publishedPackage?: { revision: number; lanes: string[] } | null };

export function initialPackageOperator(operators: readonly PublicationOperatorChoice[], laneId?: string, operatorId?: string) {
  if (operatorId) return operators.find(operator => operator.id === operatorId || operator.slug === operatorId)?.id ?? '';
  const matches = laneId ? operators.filter(operator => operator.publishedPackage?.lanes.includes(laneId)) : [];
  return matches.length === 1 ? matches[0].id : operators.length === 1 ? operators[0].id : '';
}
const OFFLINE = 'Bolagens uppgifter kunde inte hämtas. Ladda om sidan för att försöka igen.';

export function AdminPublicationPage({ operators, storeAvailable, directory, initialLaneId, initialOperatorId, onContextChange }: {
  initialLaneId?: string;
  initialOperatorId?: string;
  onContextChange?: () => void;
  operators: PublicationOperatorChoice[];
  storeAvailable: boolean;
  directory?: OperatorDirectory | null;
}) {
  const initialOperators: PublicationOperatorChoice[] = [...operators, ...(directory?.operators ?? []).filter(entry => !operators.some(operator => operator.id === entry.id))];
  const [operatorId, setOperatorId] = useState(() => initialPackageOperator(initialOperators, initialLaneId, initialOperatorId));
  // A bookmark may name a company the directory could not list (archived, or the directory was unavailable); the lifecycle snapshot resolves it once.
  const pendingInitialOperator = useRef(initialOperatorId && !initialOperators.some(operator => operator.id === initialOperatorId || operator.slug === initialOperatorId) ? initialOperatorId : null);
  const [lifecycleStatuses, setLifecycleStatuses] = useState<Record<string, string>>({});
  const [lifecycleArchives, setLifecycleArchives] = useState<Record<string, string | null>>({});
  const [resourcesRevision, setResourcesRevision] = useState(0);
  const [childBusy, setChildBusy] = useState({ lifecycle: false, directory: false });
  const childLocks = useRef(childBusy);
  function setChildBusyFor(source: keyof typeof childBusy, value: boolean) {
    childLocks.current = { ...childLocks.current, [source]: value };
    setChildBusy(current => current[source] === value ? current : { ...current, [source]: value });
  }
  const interactionBusy = Object.values(childBusy).some(Boolean);
  function replaceQuery(update: (params: URLSearchParams) => void) {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    update(params);
    studioHistory(window).replaceContext(window.location.pathname + '?' + params + window.location.hash);
    onContextChange?.();
  }
  function chooseOperator(id: string) {
    if (interactionBusy || Object.values(childLocks.current).some(Boolean)) return;
    setOperatorId(id);
    replaceQuery(params => {
      if (id) params.set('operator', id); else params.delete('operator');
      // Room aliases belong to the previous company.
      if (id !== operatorId) { params.delete('room'); params.delete('table'); }
    });
  }
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => { if (interactionBusy) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', guard); return () => window.removeEventListener('beforeunload', guard);
  }, [interactionBusy]);
  function resourceChanged(snapshot: LifecycleSnapshot) {
    if (pendingInitialOperator.current) {
      const requested = pendingInitialOperator.current; pendingInitialOperator.current = null;
      const found = snapshot.operators.find(operator => operator.id === requested || operator.slug === requested);
      if (found) setOperatorId(found.id);
    }
    setLifecycleStatuses(Object.fromEntries(snapshot.operators.map(operator => [operator.id, operator.status])));
    setLifecycleArchives(Object.fromEntries(snapshot.operators.map(operator => [operator.id, operator.archivedAt])));
  }
  function companyCreated(operator: { id: string; slug: string; name: string }) {
    setOperatorId(operator.id);
    replaceQuery(params => { params.set('operator', operator.id); params.delete('room'); params.delete('table'); });
    setResourcesRevision(value => value + 1);
  }

  return <PageTemplate eyebrow="// SPELBOLAG" title="Bolag & team" intro="Välj ett bolag för att hantera team, spelbord och åtkomst.">
    <div className={styles.page}>
      {!storeAvailable ? <p role="status" className={styles.card}>{OFFLINE}</p> : null}
      <ControlOperatorDirectory directory={directory ?? null} selectedOperatorId={operatorId} onSelect={chooseOperator} lifecycleStatuses={lifecycleStatuses} lifecycleArchives={lifecycleArchives}
        disabled={!storeAvailable || childBusy.lifecycle} onBusyChange={value => setChildBusyFor('directory', value)} onCreated={companyCreated} />
      <ControlResourceLifecycle operatorId={operatorId} kind="operator" available={storeAvailable} disabled={childBusy.directory} refreshKey={resourcesRevision} onChanged={resourceChanged} onBusyChange={value => setChildBusyFor('lifecycle', value)} />
    </div>
  </PageTemplate>;
}
