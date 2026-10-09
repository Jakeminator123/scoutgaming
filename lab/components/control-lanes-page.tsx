'use client';

import {buildPresentationPackage} from '../../web/presentation-layers.mjs';
import { useState, type FormEvent } from 'react';
import { labBasePath } from '../lib/lab-url.mjs';
import { defaultPresentationLane, type StudioLane, type StudioProject } from '../lib/studio-model.mjs';
import { ControlOperatorDirectory, type OperatorDirectory } from './control-operator-directory';
import { LaneEditor } from './lane-editor';
import { PageTemplate } from './page-template';
import styles from './control-lanes-page.module.css';
import { ProjectConflict } from './project-conflict';
import { useStudioSession } from './studio-session';
import type { ConnectionStatus, VideoInventory } from './studio-types';

export type LaneOperatorChoice = { id: string; slug: string; name: string };

const OFFLINE = 'Förhandsvisning. Publicering kräver anslutning till den sparade studion.';

export function publishLaneRows(lanes: readonly Pick<StudioLane, 'id' | 'label' | 'dealers'>[] | undefined, savedJson: string, dirty: boolean) {
  let saved: { id?: string }[] = [];
  try {
    const parsed = JSON.parse(savedJson) as { lanes?: { id?: string }[] };
    if (Array.isArray(parsed?.lanes)) saved = parsed.lanes;
  } catch {
    saved = [];
  }
  const byId = new Map(saved.map(lane => [String(lane.id), JSON.stringify(lane)]));
  const rows = (lanes ?? []).map(lane => ({
    id: lane.id,
    label: lane.label,
    dealers: [...lane.dealers],
    unsaved: Boolean(dirty) && byId.get(lane.id) !== JSON.stringify(lane),
  }));
  // The publish API validates against the saved project, where no lanes means the
  // standard lane is allowed. Keep it publishable without a save, as before the editor.
  if (saved.length === 0 && !rows.some(row => row.id === 'mobile-phone')) {
    const standard = defaultPresentationLane();
    rows.unshift({ id: standard.id, label: standard.label, dealers: [...standard.dealers], unsaved: false });
  }
  return rows;
}

export function ControlLanesPage({ initialProject, initialVideos, initialStatus, operators, storeAvailable, directory }: {
  initialProject: StudioProject;
  initialVideos: VideoInventory;
  initialStatus: ConnectionStatus;
  operators: LaneOperatorChoice[];
  storeAvailable: boolean;
  directory?: OperatorDirectory | null;
}) {
  const session = useStudioSession({ initialProject, initialVideos, initialStatus });
  const {
    project, modelEdit, dirty, saving, save, error, setError, notice, setNotice, conflict, setConflict, savedJson, setSavedJson, setProject,
  } = session;
  const rows = publishLaneRows(project.lanes, savedJson, dirty);
  const [chosen, setChosen] = useState<string[]>([]);
  const [operatorId, setOperatorId] = useState(() => operators.find(item => item.id === 'sg-test')?.id ?? operators[0]?.id ?? '');
  const [listed, setListed] = useState(operators);
  const [revision, setRevision] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [publishError, setPublishError] = useState('');
  const [busy, setBusy] = useState<'publish' | 'create' | ''>('');
  const writesOff = !storeAvailable || Boolean(busy);
  const publishable = chosen.filter(id => rows.some(row => row.id === id && !row.unsaved));
  const shownError = [publishError, error].filter(Boolean).join(' ');

  async function post(action: string, body: Record<string, unknown>) {
    const response = await fetch(`${labBasePath()}/api/admin/${action}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);
    return { response, payload };
  }

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const lanes = chosen.filter(id => rows.some(row => row.id === id && !row.unsaved));
    if (!storeAvailable || busy || lanes.length < 1 || !operatorId) return;
    setBusy('publish'); setPublishError(''); setMessage('');
    try {
      const { response, payload } = await post('operator-package', { operatorId, lanes });
      if (!response.ok) {
        setPublishError(response.status === 422 ? 'Kontrollera lagerfiler och tillåtna val. Nora kräver en egen spellane med dealer-id nora under Administration → Bord. Spara sedan lanen.' : response.status === 409 ? 'Publiceringen krockade. Ladda om och försök igen.' : 'Publiceringen gick inte igenom.');
        return;
      }
      const next = Number(payload?.package_revision ?? payload?.packageRevision);
      if (!Number.isSafeInteger(next) || next < 1) { setPublishError('Servern svarade utan package_revision.'); return; }
      setRevision(next);
      setMessage(`package_revision ${next}`);
    } catch {
      setPublishError('Publiceringen gick inte igenom.');
    } finally {
      setBusy('');
    }
  }

  function exportLanes() {
    try {
      const saved=JSON.parse(savedJson) as StudioProject;
      if(!saved.lanes?.length)saved.lanes=[defaultPresentationLane()];
      const pack=buildPresentationPackage(saved,publishable,saved.layerAssets??[]);
      const url=URL.createObjectURL(new Blob([JSON.stringify(pack,null,2)],{type:'application/json'}));
      const link=document.createElement('a');link.href=url;link.download='scoutgaming-lanes.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    } catch {setPublishError('Paketet är ofullständigt. Välj lager från biblioteket, kontrollera tillåtna val och spara projektet.');}
  }

  async function createDemo() {
    if (!storeAvailable || busy) return;
    setBusy('create'); setPublishError(''); setMessage('');
    try {
      const { response, payload } = await post('operator-create-demo', {});
      if (response.status === 409) { setPublishError('SG test game provider finns redan.'); return; }
      const operator = payload?.operator;
      if (!response.ok || !operator || operator.id !== 'sg-test') { setPublishError('Operatören kunde inte skapas.'); return; }
      setListed(current => current.some(item => item.id === operator.id) ? current : [...current, { id: operator.id, slug: operator.slug, name: operator.name }]);
      setOperatorId(operator.id);
      setMessage('SG test game provider är skapad.');
    } catch {
      setPublishError('Operatören kunde inte skapas.');
    } finally {
      setBusy('');
    }
  }

  return <PageTemplate
    eyebrow="// STUDIO"
    title="Lanes"
    intro="Sätt ihop en lane av dealers, lager och OpenClaw-läge. Publicera ett operatörspaket. Spelet läser paketet på /blackjack?operator=<slug> och spelarens dealerval följer paketet. Kortet Bolag skapar bolag, roller och medlemskap."
    primary={<button className="sg-btn sg-btn-primary" type="button" disabled={!dirty || saving} onClick={() => void save()}>{saving ? 'Sparar…' : 'Spara projekt'}</button>}
  >
    <div className={`sg-page-body ${styles.page}`}>
      {!storeAvailable ? <p role="status">{OFFLINE}</p> : null}
      {shownError ? <p role="alert">{shownError}</p> : null}
      {message ? <p role="status">{message}</p> : null}
      {notice ? <p role="status">{notice}</p> : null}
      {revision !== null ? <p>Senaste package_revision: {revision}</p> : null}
      {conflict ? <ProjectConflict base={JSON.parse(savedJson)} draft={project} onResolve={(remote, merged) => { setSavedJson(JSON.stringify(remote)); setProject(merged); setConflict(false); setError(''); setNotice('Utkastet är sammanslaget. Granska dina val och spara.'); }} /> : null}
      <LaneEditor project={project} onEdit={modelEdit} />
      <section className={styles.card} aria-labelledby="publish-package">
        <h2 id="publish-package">Publicera paket</h2>
        <form className={styles.form} onSubmit={event => { void publish(event); }}>
          <fieldset className={styles.choices}>
            <legend>Lanes</legend>
            {rows.length ? rows.map(row => <label className={styles.choice} key={row.id}>
              <input type="checkbox" name="lanes" value={row.id} checked={chosen.includes(row.id) && !row.unsaved} disabled={row.unsaved}
                onChange={event => setChosen(current => event.target.checked ? [...current, row.id] : current.filter(id => id !== row.id))} />
              {row.id} · {row.label} · {row.dealers.join(', ')}{row.unsaved ? ' (osparad)' : ''}
            </label>) : <p>Projektet har inga lanes.</p>}
          </fieldset>
          <label className={styles.field}>Operatör
            <select value={operatorId} disabled={!storeAvailable || !listed.length} onChange={event => setOperatorId(event.target.value)}>
              {listed.map(operator => <option key={operator.id} value={operator.id}>{operator.name}</option>)}
            </select>
          </label>
          <div className={styles.actions}>
            <button className="sg-btn sg-btn-secondary" type="button" disabled={publishable.length < 1 || dirty} onClick={exportLanes}>Exportera lanes (JSON)</button>
            <button className="sg-btn sg-btn-secondary" type="submit" disabled={writesOff || publishable.length < 1 || !operatorId}>Publicera paket</button>
            <button className="sg-btn sg-btn-ghost" type="button" disabled={writesOff} onClick={() => { void createDemo(); }}>Skapa SG test game provider</button>
          </div>
        </form>
      </section>
      {directory !== undefined ? <ControlOperatorDirectory directory={directory}
        onCreated={operator => setListed(current => current.some(item => item.id === operator.id) ? current : [...current, operator])} /> : null}
    </div>
  </PageTemplate>;
}
