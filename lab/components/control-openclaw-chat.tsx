'use client';

import { labUrl } from '../lib/lab-url.mjs';
import type { StudioProject } from '../lib/studio-model.mjs';
import { GatewayPanel } from './gateway-panel';
import { PageTemplate } from './page-template.mjs';
import { useStudioSession } from './studio-session';
import { studioHref, type ConnectionStatus, type VideoInventory } from './studio-types';

export function OpenClawTabLinks({ active }: { active: 'models' | 'chat' }) {
  const models = active === 'models';
  const chat = active === 'chat';
  return <>
    <a href={labUrl('/control/openclaw')} aria-current={models ? 'page' : undefined} aria-pressed={models ? true : undefined}>Agentmodeller</a>
    <a href={studioHref('/control/openclaw', { tab: 'chat' })} aria-current={chat ? 'page' : undefined} aria-pressed={chat ? true : undefined}>Chatt</a>
  </>;
}

export function ControlOpenClawChat({ initialProject, initialVideos, initialStatus, initialDealerId, initialEventId, standaloneVoicePreviewAvailable }: {
  initialProject: StudioProject;
  initialVideos: VideoInventory;
  initialStatus: ConnectionStatus;
  initialDealerId?: string;
  initialEventId?: string;
  standaloneVoicePreviewAvailable: boolean;
}) {
  const { status, mode, changeMode, dealerId, dirty } = useStudioSession({ initialProject, initialVideos, initialStatus, initialDealerId, initialEventId });
  return <PageTemplate
    eyebrow="// OPENCLAW"
    title="OpenClaw"
    intro="Fråga OpenClaw om labbet, eller öppna spelarchatten vid bordet."
    tabs={<OpenClawTabLinks active="chat" />}
  >
    <div className="sg-page-body">
      <GatewayPanel standaloneVoicePreviewAvailable={standaloneVoicePreviewAvailable} status={status} mode={mode} onModeChange={changeMode} dealerId={dealerId} dirty={dirty} onPlayerChat={() => { window.location.assign(labUrl('/control/activity')); }} />
    </div>
  </PageTemplate>;
}
