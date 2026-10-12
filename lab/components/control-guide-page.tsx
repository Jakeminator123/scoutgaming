'use client';
import { labUrl } from '../lib/lab-url.mjs';
import type { StudioProject } from '../lib/studio-model.mjs';
import { PageTemplate } from './page-template.mjs';
import { StudioGuide } from './studio-guide';
import { viewPaths, type ConnectionStatus, type StudioView, type VideoInventory } from './studio-types';
export function ControlGuidePage(_props: { initialProject: StudioProject; initialVideos: VideoInventory; initialStatus: ConnectionStatus; initialDealerId?: string; initialEventId?: string }) {
  function onNavigate(view: StudioView) { window.location.assign(labUrl(viewPaths[view])); }
  return <PageTemplate eyebrow="// STUDIO" title="Guide & hjälp"><div className="sg-page-body"><StudioGuide onNavigate={onNavigate} /></div></PageTemplate>;
}
