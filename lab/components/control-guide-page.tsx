'use client';

import { labUrl } from '../lib/lab-url.mjs';
import type { StudioProject } from '../lib/studio-model.mjs';
import { PageTemplate } from './page-template.mjs';
import { StudioBindingNotices, StudioContextIntro, StudioMessages, useStudioSession } from './studio-session';
import { StudioGuide } from './studio-guide';
import { studioHref, viewPaths, type ConnectionStatus, type StudioView, type VideoInventory } from './studio-types';

export function ControlGuidePage({ initialProject, initialVideos, initialStatus, initialDealerId, initialEventId }: {
  initialProject: StudioProject;
  initialVideos: VideoInventory;
  initialStatus: ConnectionStatus;
  initialDealerId?: string;
  initialEventId?: string;
}) {
  const session = useStudioSession({ initialProject, initialVideos, initialStatus, initialDealerId, initialEventId });
  const { project, videos, dealerId, event, dealer, error, setError, notice, setNotice } = session;
  function onNavigate(view: StudioView) { window.location.assign(labUrl(viewPaths[view])); }
  return <PageTemplate eyebrow="// STUDIO" title="Guide & hjälp" intro={<StudioContextIntro dealerLabel={dealer.label} pageLabel="Guide & hjälp" eventHref={studioHref('/control/events', { dealerId, eventId: event.id })} eventLabel={event.label} />}>
    <StudioMessages error={error} notice={notice} setError={setError} setNotice={setNotice} />
    <StudioBindingNotices project={project} videos={videos} dealerId={dealerId} eventId={event.id} />
    <StudioGuide onNavigate={onNavigate} />
  </PageTemplate>;
}
