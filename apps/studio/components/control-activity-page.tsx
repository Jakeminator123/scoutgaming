'use client';

import { useCallback, useEffect, useState } from 'react';
import { ACTIVITY_LIMIT, appendActivity, type ActivityEntry } from '../lib/activity-log.mjs';
import { loadActivities, saveActivities } from '../lib/activity-store.mjs';
import { saveObservedStep } from '../lib/observed-step-store.mjs';
import { studioNavigationHref } from '../lib/studio-navigation.mjs';
import type { StudioProject } from '../../../packages/presentation/contracts/studio-model.mjs';
import { ActivityLog, type ActivityDraft } from './activity-log';
import type { LifecycleSnapshot } from './control-resource-lifecycle';
import { PlaybackGuidance } from './playback-guidance';
import { PageTemplate, publishShellStatus } from './page-template.mjs';
import { StudioNavigation } from './studio-navigation';
import { activeStudioDealers, requestJson, type ConnectionStatus } from './studio-types';
import type { VideoInventory } from '../../../packages/presentation/contracts/media-inventory.mjs';

export function ControlActivityPage({ initialProject: project, initialVideos: videos, initialDealerId, initialLaneId, initialOperatorSlug, initialTableId, initialRoomId, initialGame }: {
  initialProject: StudioProject;
  initialVideos: VideoInventory;
  initialStatus: ConnectionStatus;
  initialDealerId?: string;
  initialLaneId?: string;
  initialOperatorSlug?: string;
  initialTableId?: string;
  initialRoomId?: string | string[];
  initialGame?: string;
}) {
  const invalidRoomContext=Array.isArray(initialRoomId);
  const tableId=typeof initialRoomId==='string'?initialRoomId:initialRoomId===undefined?initialTableId:undefined;
  const dealers = activeStudioDealers(project);
  const dealer = dealers.find(row => row.id === initialDealerId);
  const dealerId = dealer?.id ?? '';
  const roomOwnsDealer = Boolean(tableId && !initialDealerId);
  const hasSelection = Boolean(!invalidRoomContext && (dealer || roomOwnsDealer));
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [activitiesReady, setActivitiesReady] = useState(false);
  const [contextNames, setContextNames] = useState<{ tableId?: string; operatorSlug?: string; tableLabel?: string; operatorLabel?: string } | null>(null);
  useEffect(() => { publishShellStatus(null); }, []);
  useEffect(() => {
    setActivities(current => {
      const recorded = new Set(current.map(entry => entry.id));
      return [...loadActivities().filter(entry => !recorded.has(entry.id)), ...current].slice(-ACTIVITY_LIMIT);
    });
    setActivitiesReady(true);
  }, []);
  useEffect(() => { if (activitiesReady) saveActivities(activities); }, [activities, activitiesReady]);
  useEffect(() => {
    if (!tableId) return;
    const controller = new AbortController();
    requestJson<Pick<LifecycleSnapshot, 'operators' | 'rooms'>>('/api/admin/resource-lifecycle', {
      credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
    }).then(snapshot => {
      if (controller.signal.aborted) return;
      const room = Array.isArray(snapshot?.rooms) ? snapshot.rooms.find(row => row?.id === tableId) : undefined;
      const operator = Array.isArray(snapshot?.operators) ? snapshot.operators.find(row => typeof row?.id === 'string' && (initialOperatorSlug
        ? row.id === initialOperatorSlug || row.slug === initialOperatorSlug
        : row.id === room?.operatorId)) : undefined;
      const ownedRoom = operator && room?.operatorId === operator.id ? room : undefined;
      setContextNames({ tableId: tableId, operatorSlug: initialOperatorSlug,
        tableLabel: typeof ownedRoom?.name === 'string' && ownedRoom.name !== ownedRoom.id ? ownedRoom.name.trim() : undefined,
        operatorLabel: typeof operator?.name === 'string' && operator.name !== operator.id ? operator.name.trim() : undefined });
    }).catch(() => { if (!controller.signal.aborted) setContextNames(null); });
    return () => controller.abort();
  }, [tableId, initialOperatorSlug]);
  const recordActivity = useCallback((entry: ActivityDraft) => setActivities(current => appendActivity(current, {...entry, id: crypto.randomUUID(), time: new Date().toISOString()})), []);
  const context = { dealerId: dealer?.id, laneId: initialLaneId, operatorSlug: initialOperatorSlug, tableId, game: initialGame };
  function contextHref(path:string,selection:typeof context & {eventId?:string}=context){
    const url=new URL(studioNavigationHref(path,selection),'https://studio.invalid');
    const query=new URLSearchParams(typeof window==='undefined'?'':window.location?.search);
    for(const key of ['operator','room','table'])if(query.has(key)){url.searchParams.delete(key);for(const value of query.getAll(key))url.searchParams.append(key,value);}
    return url.pathname+url.search+url.hash;
  }
  const names = contextNames?.tableId === tableId && contextNames?.operatorSlug === initialOperatorSlug ? contextNames : null;
  const observationIdentity = { dealerId: dealer?.id, operatorSlug: initialOperatorSlug, tableId: tableId };
  const observationContext = { ...observationIdentity, dealerLabel: dealer?.label, tableLabel: names?.tableLabel, operatorLabel: names?.operatorLabel };
  return <PageTemplate eyebrow="// STUDIO" title="Provspelning & logg" intro="Följ vad som faktiskt visas och hörs i spelfliken.">
    <div className="sg-page-body">
      <StudioNavigation {...context} dealerLabel={dealer?.label} active="playback" />
      {invalidRoomContext?<p role="alert">Länken anger flera rum. Öppna ett uttryckligt rum innan du startar observationen.</p>:null}
      {!hasSelection ? <section aria-label="Välj dealer för provspelning"><h2>Välj en dealer att provspela</h2><p>{!dealers.length ? 'Inga dealers har registrerats ännu. Lägg till en dealer för att börja provspela.' : initialDealerId ? 'Den valda dealern är inte aktiv. Välj en dealer nedan.' : 'Välj en dealer nedan, eller öppna provspelning från ett valt spelrum.'}</p><div className="sg-chip-row">{dealers.map(row => <a key={row.id} className="sg-chip" href={contextHref('/admin/rehearsal', {...context,dealerId:row.id})}>{row.label}</a>)}</div><p><a href={contextHref('/admin/dealer-studio',context)}>Hantera dealers →</a></p></section> : <ActivityLog
        key={JSON.stringify(observationIdentity)}
        full
        rolling
        observationContext={observationContext}
        entries={activities}
        onActivity={recordActivity}
        onClear={() => setActivities([])}
        savedRevision={project.revision}
        onOpen={() => { window.location.assign(studioNavigationHref('/control/rehearsal', context)); }}
        streamView={dealer ? {
          project, videos, dealerId,
          onOpenEvent: (id, step) => {
            if (step.blocked || !step.eventId) return;
            saveObservedStep(step);
            window.location.assign(contextHref('/admin/events', { ...context, dealerId, eventId: id }));
          },
        } : undefined}
      />}
      {dealer ? <PlaybackGuidance dealerId={dealerId} observation /> : null}
    </div>
  </PageTemplate>;
}
