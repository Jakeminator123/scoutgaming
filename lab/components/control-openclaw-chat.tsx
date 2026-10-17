'use client';
import { StudioDealerRequired } from './studio-dealer-required';

import { studioNavigationContextFromQuery, studioNavigationHref } from '../lib/studio-navigation.mjs';
import { labUrl } from '../lib/lab-url.mjs';
import type { StudioProject } from '../../packages/presentation/contracts/studio-model.mjs';
import { GatewayPanel } from './gateway-panel';
import { PageTemplate } from './page-template.mjs';
import { useStudioSession } from './studio-session';
import { resolveStudioDealerId, studioHref, type ConnectionStatus } from './studio-types';
import type { VideoInventory } from '../../packages/presentation/contracts/media-inventory.mjs';

export function OpenClawTabLinks({ active }: { active: 'models' | 'chat' }) {
  const models = active === 'models';
  const chat = active === 'chat';
  return <>
    <a href={labUrl('/control/openclaw')} aria-current={models ? 'page' : undefined} aria-pressed={models ? true : undefined}>Agentmodeller</a>
    <a href={studioHref('/control/openclaw', { tab: 'chat' })} aria-current={chat ? 'page' : undefined} aria-pressed={chat ? true : undefined}>Chatt</a>
  </>;
}

function SelectedControlOpenClawChat({ initialProject, initialVideos, initialStatus, initialDealerId, initialEventId, standaloneVoicePreviewAvailable }: {
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
    title="Intern agentchatt"
    intro="Arbeta med vald dealers agentinställningar och gå vidare till provspelning."
    tabs={<OpenClawTabLinks active="chat" />}
  >
    <div className="sg-page-body">
      <GatewayPanel standaloneVoicePreviewAvailable={standaloneVoicePreviewAvailable} status={status} mode={mode} onModeChange={changeMode} dealerId={dealerId} dirty={dirty} onPlayerChat={() => { window.location.assign(studioNavigationHref('/control/rehearsal', { ...studioNavigationContextFromQuery(new URLSearchParams(window.location.search)), dealerId })); }} />
    </div>
  </PageTemplate>;
}

export function ControlOpenClawChat(props: Parameters<typeof SelectedControlOpenClawChat>[0]) {
  if (!resolveStudioDealerId(props.initialProject, props.initialDealerId)) return <StudioDealerRequired project={props.initialProject} title="Intern agentchatt" />;
  return <SelectedControlOpenClawChat {...props} />;
}
