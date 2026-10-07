'use client';

import { createDefaultProbePolicy } from '../lib/probe-policy.mjs';
import type { StudioProject } from '../lib/studio-model.mjs';
import { PageTemplate } from './page-template.mjs';
import { ProbeEditor } from './probe-editor';
import { ProjectConflict } from './project-conflict';
import { StudioMessages, useStudioSession } from './studio-session';
import type { ConnectionStatus, VideoInventory } from './studio-types';

export function ControlProbePage({ initialProject, initialVideos, initialStatus, initialDealerId, initialEventId }: {
  initialProject: StudioProject;
  initialVideos: VideoInventory;
  initialStatus: ConnectionStatus;
  initialDealerId?: string;
  initialEventId?: string;
}) {
  const session = useStudioSession({ initialProject, initialVideos, initialStatus, initialDealerId, initialEventId });
  const { project, updateProject, recordActivity, dirty, saving, save, error, setError, notice, setNotice, conflict, setConflict, savedJson, setSavedJson, setProject } = session;
  return <PageTemplate
    eyebrow="// DRIFT"
    title="Talgranskning"
    intro="Astrids egna tal när spelaren är inaktiv. Spara projektet när du ändrat läge, tid eller modell."
    primary={<button className="sg-btn sg-btn-primary" type="button" disabled={!dirty || saving} onClick={() => void save()}>{saving ? 'Sparar…' : 'Spara projekt'}</button>}
  >
    <div className="sg-page-body">
      <StudioMessages error={error} notice={notice} setError={setError} setNotice={setNotice} />
      {conflict ? <ProjectConflict base={JSON.parse(savedJson)} draft={project} onResolve={(remote, merged) => { setSavedJson(JSON.stringify(remote)); setProject(merged); setConflict(false); setError(''); setNotice('Utkastet är sammanslaget. Granska dina val och spara.'); }} /> : null}
      <ProbeEditor policy={project.probePolicy ?? createDefaultProbePolicy()} onChange={policy => updateProject(draft => { draft.probePolicy = policy; })} onActivity={recordActivity} />
    </div>
  </PageTemplate>;
}
