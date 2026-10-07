'use client';

import type { StudioProject } from '../lib/studio-model.mjs';
import { EventTree } from './event-tree';
import { FamilyOverview } from './family-video-library';
import { PageTemplate } from './page-template.mjs';
import { StudioBindingNotices, StudioContextIntro, StudioMessages, useStudioSession } from './studio-session';
import { studioHref, type ConnectionStatus, type VideoInventory } from './studio-types';

export function ControlTreePage({ initialProject, initialVideos, initialStatus, initialDealerId, initialEventId }: {
  initialProject: StudioProject;
  initialVideos: VideoInventory;
  initialStatus: ConnectionStatus;
  initialDealerId?: string;
  initialEventId?: string;
}) {
  const session = useStudioSession({ initialProject, initialVideos, initialStatus, initialDealerId, initialEventId });
  const { media, videos, project, dealerId, event, line, variant, mode, originals, selectDealer, selectEvent, selectVariant, dealer, error, setError, notice, setNotice } = session;
  const eventHref = studioHref('/control/events', { dealerId, eventId: event.id });
  return <PageTemplate eyebrow="// STUDIO" title="Händelser → klipp" intro={<StudioContextIntro dealerLabel={dealer.label} pageLabel="Händelser → klipp" eventHref={eventHref} eventLabel={event.label} />}>
    <StudioMessages error={error} notice={notice} setError={setError} setNotice={setNotice} />
    <StudioBindingNotices project={project} videos={videos} dealerId={dealerId} eventId={event.id} />
    {media.managed
      ? <FamilyOverview inventory={videos} project={project} dealerId={dealerId} hrefFor={id => studioHref('/control/events', { dealerId, eventId: id })} />
      : <EventTree project={project} inventory={videos} originals={originals} dealerId={dealerId} event={event} line={line} variant={variant} mode={mode} onSelectDealer={selectDealer} onSelectEvent={selectEvent} onSelectVariant={selectVariant} onEdit={tab => { window.location.assign(studioHref('/control/events', { dealerId, eventId: event.id, tab })); }} onVideos={() => { window.location.assign(studioHref('/control/videos', { dealerId, eventId: event.id })); }} onOpenClaw={() => { window.location.assign(studioHref('/control/openclaw', { dealerId, eventId: event.id, tab: 'chat' })); }} />}
  </PageTemplate>;
}
