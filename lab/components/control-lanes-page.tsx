'use client';

import { useRef, useState, type FormEvent } from 'react';
import { labBasePath, labUrl } from '../lib/lab-url.mjs';
import { defaultPresentationLane, type StudioLane, type StudioProject } from '../lib/studio-model.mjs';
import { ControlOperatorDirectory, type OperatorDirectory } from './control-operator-directory';
import { LaneEditor } from './lane-editor';
import { PresentationRoomCreate } from './presentation-room-create';
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

export function ControlLanesPage({ initialProject, initialVideos, initialStatus, operators, storeAvailable, directory, initialLaneId, initialTab = 'publish' }: {
  initialLaneId?: string;
  initialTab?: 'publish' | 'companies';
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
  const [selectedLaneId, setSelectedLaneId] = useState(initialLaneId ?? project.lanes?.[0]?.id ?? 'mobile-phone');
  const selectedLane = project.lanes?.find(lane => lane.id === selectedLaneId) ?? project.lanes?.[0] ?? defaultPresentationLane();
  const compositionHref = labUrl('/control/preview' + (selectedLane ? '?lane=' + encodeURIComponent(selectedLane.id) : ''));
  const [chosen, setChosen] = useState<string[]>(() => initialLaneId && rows.some(row => row.id === initialLaneId) ? [initialLaneId] : rows[0] ? [rows[0].id] : []);
  const [operatorId, setOperatorId] = useState(() => operators.find(item => item.id === 'sg-test')?.id ?? operators[0]?.id ?? '');
  const [listed, setListed] = useState(operators);
  const [revision, setRevision] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [publishError, setPublishError] = useState('');
  const [busy, setBusy] = useState<'publish' | 'create' | ''>('');
  const writeLock = useRef(false);
  const [roomBusy, setRoomBusy] = useState(false);
  const interactionBusy = Boolean(busy) || saving || roomBusy;
  const companiesOnly = initialTab === 'companies';
  const writesOff = !storeAvailable || interactionBusy;
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
    if (!storeAvailable || writeLock.current || interactionBusy || conflict || lanes.length < 1 || !operatorId) return;
    writeLock.current = true;
    setBusy('publish'); setPublishError(''); setMessage('');
    try {
      const { response, payload } = await post('operator-package', { operatorId, lanes });
      if (!response.ok) {
        setPublishError(response.status === 422 ? 'Kontrollera lagerfiler, vald grundloop och tillåtna val. Spara presentationen och försök igen.' : response.status === 409 ? 'Publiceringen krockade. Ladda om och försök igen.' : 'Publiceringen gick inte igenom.');
        return;
      }
      const next = Number(payload?.package_revision ?? payload?.packageRevision);
      if (!Number.isSafeInteger(next) || next < 1) { setPublishError('Serverns publiceringskvitto saknas.'); return; }
      setRevision(next);
      setMessage(`Paketet är publicerat. Version ${next}.`);
    } catch {
      setPublishError('Publiceringen gick inte igenom.');
    } finally {
      writeLock.current = false;
      setBusy('');
    }
  }

  async function createDemo() {
    if (!storeAvailable || writeLock.current || interactionBusy) return;
    writeLock.current = true;
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
      writeLock.current = false;
      setBusy('');
    }
  }

  return <PageTemplate
    eyebrow="// STUDIO"
    title={companiesOnly ? 'Bolag & team' : 'Publicering'}
    primary={companiesOnly ? undefined : <button className="sg-btn sg-btn-primary" type="button" disabled={!dirty || interactionBusy} onClick={() => void save()}>{saving ? 'Sparar…' : 'Spara presentationer'}</button>}
  >
    <div className={`sg-page-body ${styles.page}`}>
      {!storeAvailable ? <p role="status">{OFFLINE}</p> : null}
      {shownError ? <p role="alert">{shownError}</p> : null}
      {message ? <p role="status">{message}</p> : null}
      {notice ? <p role="status">{notice}</p> : null}
      {revision !== null ? <p>Senast publicerade version: {revision}</p> : null}
      {conflict ? <ProjectConflict base={JSON.parse(savedJson)} draft={project} onResolve={(remote, merged) => { setSavedJson(JSON.stringify(remote)); setProject(merged); setConflict(false); setError(''); setNotice('Utkastet är sammanslaget. Granska dina val och spara.'); }} /> : null}
      {!companiesOnly ? <>
      <div className={styles.actions}><a className="sg-btn sg-btn-secondary" aria-disabled={dirty || interactionBusy} onClick={event => { if (dirty || interactionBusy) event.preventDefault(); }} href={compositionHref}>Till sammansättning</a></div>
      <section className={styles.card} aria-label="Vald presentation och bolag">
        <div className={styles.selection}>
          <label className={styles.field}>Bolag
            <select value={operatorId} disabled={interactionBusy || !listed.length} onChange={event => setOperatorId(event.target.value)}>
              {listed.map(operator => <option key={operator.id} value={operator.id}>{operator.name}</option>)}
            </select>
          </label>
          <label className={styles.field}>Presentation för spelrum
            <select value={selectedLane.id} disabled={interactionBusy} onChange={event => setSelectedLaneId(event.target.value)}>
              {rows.map(row => <option key={row.id} value={row.id}>{row.label}{row.unsaved ? ' (osparad)' : ''}</option>)}
            </select>
          </label>
        </div>
      </section>
      <section className={styles.card} aria-label="Partnerpaket">
        <h2>Publicera partnerpaket</h2>
        <p>Paketet ger valt bolag tillgång till de markerade presentationerna och deras tillåtna dealers, bord och bakgrunder. Spara ändrade presentationer före publicering.</p>
        <form className={styles.form} onSubmit={event => { void publish(event); }}>
          <fieldset className={styles.choices}>
            <legend>Presentationer i partnerpaketet</legend>
            {rows.length ? rows.map(row => <label className={styles.choice} key={row.id}>
              <input type="checkbox" name="lanes" value={row.id} checked={chosen.includes(row.id) && !row.unsaved} disabled={row.unsaved || interactionBusy}
                onChange={event => { setChosen(current => event.target.checked ? [...current, row.id] : current.filter(id => id !== row.id)); }} />
              {row.label} · {row.dealers.map(id=>project.dealers.find(dealer=>dealer.id===id)?.label??id).join(', ')}{row.unsaved ? ' (osparad)' : ''}
            </label>) : <p>Skapa en presentation i Sammansättning.</p>}
          </fieldset>
          <div className={styles.actions}>
            <button className="sg-btn sg-btn-primary" type="submit" disabled={writesOff || publishable.length < 1 || !operatorId || conflict}>Publicera paket</button>
          </div>
        </form>
        <p>För att uppdatera ett befintligt spelrum: behåll rummets presentation markerad och publicera paketet igen. Valen ovan ersätter paketets presentationsurval.</p>
      </section>
      <PresentationRoomCreate operator={listed.find(operator => operator.id === operatorId) ?? null}
        presentation={{id:selectedLane.id,label:selectedLane.label}} projectRevision={project.revision}
        projectSaved={!dirty && !conflict} storeAvailable={storeAvailable} disabled={Boolean(busy) || saving || conflict}
        onBusyChange={setRoomBusy} onCreated={receipt => setRevision(receipt.packageRevision)} />
      <details className={styles.card}>
        <summary>Avancerat: bolag och spellanes</summary>
        <button className="sg-btn sg-btn-ghost" type="button" disabled={writesOff} onClick={() => { void createDemo(); }}>Skapa SG test game provider</button>
        <a className="sg-btn sg-btn-secondary" aria-disabled={dirty || interactionBusy}
          onClick={event => { if (dirty || interactionBusy) event.preventDefault(); }}
          href={labUrl('/control/administration?tab=tables')}>Öppna bord & spelrum</a>
      </details>
      <details className={styles.card}><summary>Avancerade presentationsinställningar</summary><LaneEditor project={project} onEdit={modelEdit} selectedId={selectedLaneId} onSelect={setSelectedLaneId} navigationBlocked={dirty||interactionBusy} disabled={interactionBusy} /></details>
      </> : null}
      {companiesOnly && directory !== undefined ? <ControlOperatorDirectory directory={directory}
        onCreated={operator => setListed(current => current.some(item => item.id === operator.id) ? current : [...current, operator])} /> : null}
    </div>
  </PageTemplate>;
}
