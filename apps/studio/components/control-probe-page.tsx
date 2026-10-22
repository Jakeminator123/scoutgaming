'use client';
import { StudioDealerRequired } from './studio-dealer-required';

import { createDefaultProbePolicy } from '../../../packages/presentation/contracts/probe-policy.mjs';
import type { StudioProject } from '../../../packages/presentation/contracts/studio-model.mjs';
import { PageTemplate } from './page-template.mjs';
import { StudioNavigation } from './studio-navigation';
import { studioNavigationHref } from '../lib/studio-navigation.mjs';
import { ProbeEditor } from './probe-editor';
import { ProjectConflict } from './project-conflict';
import { StudioMessages, useStudioSession } from './studio-session';
import { resolveStudioDealerId, type ConnectionStatus } from './studio-types';
import type { VideoInventory } from '../../../packages/presentation/contracts/media-inventory.mjs';

function SelectedControlProbePage({ initialProject, initialVideos, initialStatus, initialDealerId, initialEventId }: {
  initialProject: StudioProject;
  initialVideos: VideoInventory;
  initialStatus: ConnectionStatus;
  initialDealerId?: string;
  initialEventId?: string;
}) {
  const session = useStudioSession({ initialProject, initialVideos, initialStatus, initialDealerId, initialEventId });
  const { project, dealerId, dealer, updateProject, recordActivity, dirty, saving, save, error, setError, notice, setNotice, conflict, setConflict, savedJson, setSavedJson, setProject } = session;
  return <PageTemplate
    eyebrow="// STUDIO"
    title="AI-småprat vid inaktivitet"
    intro={`Talinitiativ för ${dealer.label}. Inspelade klipp och nytt AI-tal har separata inställningar.`}
    primary={<button className="sg-btn sg-btn-primary" type="button" disabled={dealerId !== 'astrid' || !dirty || saving} onClick={() => void save()}>{saving ? 'Sparar…' : 'Spara projekt'}</button>}
  >
    <div className="sg-page-body">
      <StudioNavigation dealerId={dealerId} dealerLabel={dealer.label} active="speech" crumbs={[{label:"Tal vid inaktivitet"}]} />
      <StudioMessages error={error} notice={notice} setError={setError} setNotice={setNotice} />
      {conflict ? <ProjectConflict base={JSON.parse(savedJson)} draft={project} onResolve={(remote, merged) => { setSavedJson(JSON.stringify(remote)); setProject(merged); setConflict(false); setError(''); setNotice('Utkastet är sammanslaget. Granska dina val och spara.'); }} /> : null}
      {dealerId === 'astrid' ? <ProbeEditor policy={project.probePolicy ?? createDefaultProbePolicy()} onChange={policy => updateProject(draft => { draft.probePolicy = policy; })} onActivity={recordActivity} /> : <section aria-label="Talinitiativ för vald dealer"><h2>Tal vid inaktivitet · {dealer.label}</h2><p>Automatiskt nygenererat tal vid inaktivitet är ännu bara anslutet för Astrid. Den här sidan ändrar inte Astrids inställningar.</p><p>{dealer.label}s inspelade klipp och grundloopvariationer kan användas med deras egna villkor. Egen röst och läppsynk hanteras i dealerns talinställningar.</p><a className="sg-btn sg-btn-secondary" href={studioNavigationHref('/admin/dealer-studio?view=speech',{dealerId})}>Till dealerns tal och automatik</a></section>}
    </div>
  </PageTemplate>;
}

export function ControlProbePage(props: Parameters<typeof SelectedControlProbePage>[0]) {
  if (!resolveStudioDealerId(props.initialProject, props.initialDealerId)) return <StudioDealerRequired project={props.initialProject} title="Tal vid inaktivitet" />;
  return <SelectedControlProbePage {...props} />;
}
