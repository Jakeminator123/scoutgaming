'use client';

import { useCallback, useEffect, useState } from 'react';
import { ACTIVITY_LIMIT, appendActivity, type ActivityEntry } from '../lib/activity-log.mjs';
import { loadActivities, saveActivities } from '../lib/activity-store.mjs';
import type { OriginalMediaCatalog } from '../lib/original-media.mjs';
import { saveObservedStep } from '../lib/observed-step-store.mjs';
import { studioNavigationHref } from '../lib/studio-navigation.mjs';
import type { StudioProject } from '../lib/studio-model.mjs';
import { ActivityLog, type ActivityDraft } from './activity-log';
import { PlaybackGuidance } from './playback-guidance';
import { PageTemplate, publishShellStatus } from './page-template.mjs';
import { StudioNavigation } from './studio-navigation';
import { activeStudioDealers, requestJson, type ConnectionStatus, type VideoInventory } from './studio-types';

export function ControlActivityPage({ initialProject: project, initialVideos: videos, initialDealerId, initialLaneId, initialOperatorSlug, initialTableId }: {
  initialProject: StudioProject;
  initialVideos: VideoInventory;
  initialStatus: ConnectionStatus;
  initialDealerId?: string;
  initialLaneId?: string;
  initialOperatorSlug?: string;
  initialTableId?: string;
}) {
  const dealers = activeStudioDealers(project);
  const dealer = dealers.find(row => row.id === initialDealerId);
  const dealerId = dealer?.id ?? '';
  const roomOwnsDealer = Boolean(initialTableId && !initialDealerId);
  const hasSelection = Boolean(dealer || roomOwnsDealer);
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [activitiesReady, setActivitiesReady] = useState(false);
  const [originals, setOriginals] = useState<OriginalMediaCatalog | null>(null);
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
    if (!dealerId) return;
    const controller = new AbortController();
    requestJson<OriginalMediaCatalog>('/api/original-media', {signal: controller.signal}).then(setOriginals).catch(() => {});
    return () => controller.abort();
  }, [dealerId]);
  const recordActivity = useCallback((entry: ActivityDraft) => setActivities(current => appendActivity(current, {...entry, id: crypto.randomUUID(), time: new Date().toISOString()})), []);
  const context = { dealerId: dealer?.id, laneId: initialLaneId, operatorSlug: initialOperatorSlug, tableId: initialTableId };
  const observationContext = { dealerId: dealer?.id, dealerLabel: dealer?.label, operatorSlug: initialOperatorSlug, tableId: initialTableId };
  return <PageTemplate eyebrow="// STUDIO" title="Provspelning & logg" intro="Följ vad som faktiskt visas och hörs i spelfliken.">
    <div className="sg-page-body">
      <StudioNavigation {...context} dealerLabel={dealer?.label} active="playback" />
      {!hasSelection ? <section aria-label="Välj dealer för provspelning"><h2>Välj en dealer att provspela</h2><p>{!dealers.length ? 'Inga dealers har registrerats ännu. Lägg till en dealer för att börja provspela.' : initialDealerId ? 'Den valda dealern är inte aktiv. Välj en dealer nedan.' : 'Välj en dealer nedan, eller öppna provspelning från ett valt spelrum.'}</p><div className="sg-chip-row">{dealers.map(row => <a key={row.id} className="sg-chip" href={studioNavigationHref('/control/rehearsal', {...context,dealerId:row.id})}>{row.label}</a>)}</div><p><a href={studioNavigationHref('/control/clips',context)}>Hantera dealers →</a></p></section> : <ActivityLog
        key={JSON.stringify(observationContext)}
        full
        rolling
        observationContext={observationContext}
        entries={activities}
        onActivity={recordActivity}
        onClear={() => setActivities([])}
        savedRevision={project.revision}
        onOpen={() => { window.location.assign(studioNavigationHref('/control/rehearsal', context)); }}
        streamView={dealer ? {
          project, videos, originals, dealerId,
          onOpenEvent: (id, step) => {
            if (step.blocked || !step.eventId) return;
            saveObservedStep(step);
            window.location.assign(studioNavigationHref('/control/events', { ...context, dealerId, eventId: id }));
          },
        } : undefined}
      />}
      {dealer ? <PlaybackGuidance dealerId={dealerId} observation /> : null}
    </div>
  </PageTemplate>;
}
