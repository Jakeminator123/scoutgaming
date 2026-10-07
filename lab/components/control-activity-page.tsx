'use client';

import { saveObservedStep } from '../lib/observed-step-store.mjs';
import type { StudioProject } from '../lib/studio-model.mjs';
import { ActivityLog } from './activity-log';
import { PageTemplate } from './page-template.mjs';
import { StudioBindingNotices, StudioContextIntro, StudioMessages, useStudioSession } from './studio-session';
import { studioHref, type ConnectionStatus, type VideoInventory } from './studio-types';

export function ControlActivityPage({ initialProject, initialVideos, initialStatus, initialDealerId, initialEventId }: {
  initialProject: StudioProject;
  initialVideos: VideoInventory;
  initialStatus: ConnectionStatus;
  initialDealerId?: string;
  initialEventId?: string;
}) {
  const session = useStudioSession({ initialProject, initialVideos, initialStatus, initialDealerId, initialEventId });
  const { project, videos, originals, dealerId, event, dealer, activities, recordActivity, clearActivities, error, setError, notice, setNotice } = session;
  const eventHref = studioHref('/control/events', { dealerId, eventId: event.id });
  return <PageTemplate eyebrow="// STUDIO" title="Uppspelning" intro={<StudioContextIntro dealerLabel={dealer.label} pageLabel="Uppspelning" eventHref={eventHref} eventLabel={event.label} />}>
    <div className="sg-page-body">
    <StudioMessages error={error} notice={notice} setError={setError} setNotice={setNotice} />
    <StudioBindingNotices project={project} videos={videos} dealerId={dealerId} eventId={event.id} />
    <ActivityLog
      full
      rolling
      entries={activities}
      onActivity={recordActivity}
      onClear={clearActivities}
      onOpen={() => { window.location.assign(studioHref('/control/activity', { dealerId, eventId: event.id })); }}
      streamView={{
        project, videos, originals, dealerId,
        onOpenEvent: (id, step) => {
          if (step.blocked || !step.eventId) return;
          saveObservedStep(step);
          window.location.assign(studioHref('/control/events', { dealerId, eventId: id }));
        },
      }}
    />
    </div>
  </PageTemplate>;
}
