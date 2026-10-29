'use client';
import { StudioDealerRequired } from './studio-dealer-required';

import { studioScopedHref } from '../lib/studio-navigation.mjs';
import { studioHistory } from '../lib/studio-history.mjs';
import type { StudioProject } from '../../../packages/presentation/contracts/studio-model.mjs';
import { GatewayPanel } from './gateway-panel';
import { StudioNavigation } from './studio-navigation';
import { PageTemplate } from './page-template.mjs';
import { useStudioSession } from './studio-session';
import { resolveStudioDealerId, type ConnectionStatus } from './studio-types';
import type { VideoInventory } from '../../../packages/presentation/contracts/media-inventory.mjs';

function SelectedControlOpenClawChat({ initialProject, initialVideos, initialStatus, initialDealerId, initialEventId, standaloneVoicePreviewAvailable }: {
  initialProject: StudioProject;
  initialVideos: VideoInventory;
  initialStatus: ConnectionStatus;
  initialDealerId?: string;
  initialEventId?: string;
  standaloneVoicePreviewAvailable: boolean;
}) {
  const { status, mode, changeMode, dealerId, dirty } = useStudioSession({ initialProject, initialVideos, initialStatus, initialDealerId, initialEventId });
  const query=new URLSearchParams(typeof window==='undefined'?'':window.location?.search);
  // Tvetydiga spelrum går dit den delade dokumentmappningen skickar dem, aldrig till det första värdet.
  const rehearsalHref=studioScopedHref('/admin/rooms',query,{dealerId});
  return <PageTemplate
    eyebrow="Studio"
    title="Dialogtest"
    intro={initialProject.dealers.find(dealer=>dealer.id===dealerId)?.label??dealerId}
  >
    <div className="sg-page-body">
      <StudioNavigation dealerId={dealerId} dealerLabel={initialProject.dealers.find(dealer=>dealer.id===dealerId)?.label} active="speech"/>
      <GatewayPanel standaloneVoicePreviewAvailable={standaloneVoicePreviewAvailable} status={status} mode={mode} onModeChange={changeMode} dealerId={dealerId} dirty={dirty} onPlayerChat={() => { if(studioHistory(window).canNavigate(rehearsalHref))window.location.assign(rehearsalHref); }} />
    </div>
  </PageTemplate>;
}

export function ControlOpenClawChat(props: Parameters<typeof SelectedControlOpenClawChat>[0]) {
  if (!resolveStudioDealerId(props.initialProject, props.initialDealerId)) return <StudioDealerRequired project={props.initialProject} title="Dialogtest" />;
  // An accepted dealer change starts its own session and conversation.
  return <SelectedControlOpenClawChat key={props.initialDealerId} {...props} />;
}
