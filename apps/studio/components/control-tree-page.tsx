'use client';
import { StudioDealerRequired } from './studio-dealer-required';

import { useEffect, useRef } from 'react';
import { studioHistory } from '../lib/studio-history.mjs';
import { studioNavigationContextFromQuery, studioNavigationHref } from '../lib/studio-navigation.mjs';
import type { StudioProject } from '../../../packages/presentation/contracts/studio-model.mjs';
import { EventTree } from './event-tree';
import { PlaybackGuidance, ClipSelectionHelp } from './playback-guidance';
import styles from './playback-guidance.module.css';
import { FamilyOverview } from './family-video-library';
import { PageTemplate } from './page-template.mjs';
import { StudioBindingNotices, StudioContextIntro, StudioMessages, useStudioSession } from './studio-session';
import { activeStudioDealers, resolveStudioDealerId, studioHref, type ConnectionStatus } from './studio-types';
import type { VideoInventory } from '../../../packages/presentation/contracts/media-inventory.mjs';

function eventSelectionHref(selection: Parameters<typeof studioHref>[1]) {
  const query = new URLSearchParams(typeof window === 'undefined' ? '' : window.location?.search);
  const { laneId, operatorId, tableId, game } = studioNavigationContextFromQuery(query);
  const url = new URL(studioNavigationHref(studioHref('/admin/events', selection), { laneId, operatorId, tableId, game }), 'https://studio.invalid');
  if (query.get('room')) url.searchParams.set('room', query.get('room')!);
  return url.pathname + url.search + url.hash;
}

function SelectedControlTreePage({ initialProject, initialVideos, initialStatus, initialDealerId, initialEventId }: {
  initialProject: StudioProject;
  initialVideos: VideoInventory;
  initialStatus: ConnectionStatus;
  initialDealerId?: string;
  initialEventId?: string;
}) {
  const session = useStudioSession({ initialProject, initialVideos, initialStatus, initialDealerId, initialEventId, overview: true });
  const { media, videos, project, dealerId, event, line, variant, mode, selectDealer, selectEvent, selectVariant, dealer, error, setError, notice, setNotice } = session;
  const currentSession = useRef(session);
  currentSession.current = session;
  useEffect(() => studioHistory(window).subscribe(event => {
    if (!event) return;
    const query = new URLSearchParams(window.location.search), current = currentSession.current;
    // Editor links are mounted by Admin; an overview update must not remove their event.
    if (query.has('event')) return;
    const nextDealer = resolveStudioDealerId(current.project, query.get('dealer') ?? '');
    if (nextDealer) current.assignSelection({ dealerId: nextDealer, variantId: '' });
  }), []);
  const eventHref = eventSelectionHref({ dealerId, eventId: event.id });
  return <PageTemplate eyebrow="// STUDIO" title="Spelhändelser & villkor" intro={<StudioContextIntro dealerLabel={dealer.label} pageLabel="Händelser" eventHref={eventHref} eventLabel={event.label} />}>
    <div className="sg-page-body">
    <StudioMessages error={error} notice={notice} setError={setError} setNotice={setNotice} />
    <StudioBindingNotices project={project} videos={videos} dealerId={dealerId} eventId={event.id} />
    <div className={styles.dealerBar} role="group" aria-label="Välj dealer för spelhändelser">{activeStudioDealers(project).map(item => <button type="button" className="sg-chip" key={item.id} aria-pressed={dealerId === item.id} onClick={() => selectDealer(item.id)}>{item.label}</button>)}</div>
    <PlaybackGuidance dealerId={dealerId} />
    <ClipSelectionHelp />
    {media.managed
      ? <FamilyOverview inventory={videos} project={project} dealerId={dealerId} hrefFor={(id, situation) => eventSelectionHref({ dealerId, eventId: id, situation: situation || undefined })} />
      : <details className={styles.legacy}><summary>Avancerat · äldre händelsegrupper och testanimationer</summary><p>Här finns de sparade grupperna, varianterna och villkoren kvar. Vänster, mitten och höger samlar flera exakta spelplatser. Använd i första hand dealerns klippfack; en labbanimation är ett jämförelseprov och bevisar inte att en inspelad video finns.</p><EventTree project={project} inventory={videos} dealerId={dealerId} event={event} line={line} variant={variant} mode={mode} onSelectDealer={selectDealer} onSelectEvent={selectEvent} onSelectVariant={selectVariant} onEdit={tab => { window.location.assign(eventSelectionHref({ dealerId, eventId: event.id, variantId: variant.id, tab })); }} onVideos={() => { window.location.assign(studioHref('/admin/videos', { dealerId, eventId: event.id })); }} onOpenClaw={() => { window.location.assign(studioHref('/control/openclaw', { dealerId, eventId: event.id, tab: 'chat' })); }} /></details>}
    </div>
  </PageTemplate>;
}

export function ControlTreePage(props: Parameters<typeof SelectedControlTreePage>[0]) {
  if (!resolveStudioDealerId(props.initialProject, props.initialDealerId)) return <StudioDealerRequired project={props.initialProject} title="Händelser" />;
  return <SelectedControlTreePage {...props} />;
}
