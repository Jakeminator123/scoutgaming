'use client';
import { StudioDealerRequired } from './studio-dealer-required';

import { studioNavigationContextFromQuery, studioNavigationHref } from '../lib/studio-navigation.mjs';
import { labUrl } from '../lib/lab-url.mjs';
import { studioHistory } from '../lib/studio-history.mjs';
import type { StudioProject } from '../../../packages/presentation/contracts/studio-model.mjs';
import { GatewayPanel } from './gateway-panel';
import { PageTemplate } from './page-template.mjs';
import { useStudioSession } from './studio-session';
import { resolveStudioDealerId, type ConnectionStatus } from './studio-types';
import type { VideoInventory } from '../../../packages/presentation/contracts/media-inventory.mjs';

export function OpenClawTabLinks({ active, modelsHref=labUrl('/admin/openclaw?tab=models'), chatHref=labUrl('/admin/openclaw?tab=agent') }: { active: 'models' | 'chat'; modelsHref?:string; chatHref?:string }) {
  const models = active === 'models';
  const chat = active === 'chat';
  return <>
    <a href={modelsHref} aria-current={models ? 'page' : undefined} aria-pressed={models ? true : undefined}>Agentmodeller</a>
    <a href={chatHref} aria-current={chat ? 'page' : undefined} aria-pressed={chat ? true : undefined}>Chatt</a>
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
  const query=new URLSearchParams(typeof window==='undefined'?'':window.location?.search);
  function contextHref(path:string) {
    const url=new URL(studioNavigationHref(path,{...studioNavigationContextFromQuery(query),dealerId}),'https://studio.invalid');
    // Keep explicit ambiguous room/operator selectors for the destination to validate.
    for(const key of ['operator','table','room'])if(query.has(key)){
      url.searchParams.delete(key);for(const value of query.getAll(key))url.searchParams.append(key,value);
    }
    return url.pathname+url.search;
  }
  const modelsHref=contextHref('/admin/openclaw?tab=models');
  const rehearsalHref=contextHref('/admin/rehearsal');
  return <PageTemplate
    eyebrow="// OPENCLAW"
    title="Intern agentchatt"
    intro={`Arbeta med agentinställningar för ${initialProject.dealers.find(dealer=>dealer.id===dealerId)?.label??dealerId} och gå vidare till provspelning.`}
    tabs={<OpenClawTabLinks active="chat" modelsHref={modelsHref} chatHref={contextHref('/admin/openclaw?tab=agent')} />}
  >
    <div className="sg-page-body">
      <GatewayPanel modelsHref={modelsHref} standaloneVoicePreviewAvailable={standaloneVoicePreviewAvailable} status={status} mode={mode} onModeChange={changeMode} dealerId={dealerId} dirty={dirty} onPlayerChat={() => { if(studioHistory(window).canNavigate(rehearsalHref))window.location.assign(rehearsalHref); }} />
    </div>
  </PageTemplate>;
}

export function ControlOpenClawChat(props: Parameters<typeof SelectedControlOpenClawChat>[0]) {
  if (!resolveStudioDealerId(props.initialProject, props.initialDealerId)) return <StudioDealerRequired project={props.initialProject} title="Intern agentchatt" />;
  // An accepted dealer change starts its own session and conversation.
  return <SelectedControlOpenClawChat key={props.initialDealerId} {...props} />;
}
