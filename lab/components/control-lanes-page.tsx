'use client';

import { useRef, useState, type FormEvent } from 'react';
import { labBasePath, labUrl } from '../lib/lab-url.mjs';
import { defaultPresentationLane, type StudioLane, type StudioProject } from '../lib/studio-model.mjs';
import { ControlOperatorDirectory, type OperatorDirectory } from './control-operator-directory';
import { PresentationRoomCreate } from './presentation-room-create';
import { PageTemplate } from './page-template';
import styles from './control-lanes-page.module.css';
import { ProjectConflict } from './project-conflict';
import { useStudioSession } from './studio-session';
import type { ConnectionStatus, VideoInventory } from './studio-types';

export type LaneOperatorChoice = { id: string; slug: string; name: string; publishedPackage?: { revision: number; lanes: string[] } | null };
type PackageEditor = { chosen: string[]; revision: number | null; message: string; error: string; needsRefresh: boolean };

export function initialPackageOperator(operators: readonly LaneOperatorChoice[], laneId?: string, operatorId?: string) {
  if (operatorId) return operators.some(operator => operator.id === operatorId) ? operatorId : '';
  const matches = laneId ? operators.filter(operator => operator.publishedPackage?.lanes.includes(laneId)) : [];
  return matches.length === 1 ? matches[0].id : operators.length === 1 ? operators[0].id : '';
}
function packageEditor(operator?: LaneOperatorChoice): PackageEditor {
  return { chosen: [...(operator?.publishedPackage?.lanes ?? [])], revision: operator?.publishedPackage?.revision ?? null,
    message: '', error: '', needsRefresh: operator?.publishedPackage === undefined };
}

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

export function ControlLanesPage({ initialProject, initialVideos, initialStatus, operators, storeAvailable, directory, initialLaneId, initialOperatorId, initialTab = 'publish' }: {
  initialLaneId?: string;
  initialOperatorId?: string;
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
    project, dirty, saving, error, setError, notice, setNotice, conflict, setConflict, savedJson, setSavedJson, setProject,
  } = session;
  const rows = publishLaneRows(project.lanes, savedJson, dirty);
  const [selectedLaneId, setSelectedLaneId] = useState(initialLaneId ?? project.lanes?.[0]?.id ?? 'mobile-phone');
  const selectedLane = project.lanes?.find(lane => lane.id === selectedLaneId) ?? project.lanes?.[0] ?? defaultPresentationLane();
  const compositionHref = labUrl('/control/preview' + (selectedLane ? '?lane=' + encodeURIComponent(selectedLane.id) : ''));
  const [operatorId, setOperatorId] = useState(() => initialPackageOperator(operators, initialLaneId, initialOperatorId));
  const [listed, setListed] = useState(operators);
  const [packages, setPackages] = useState<Record<string, PackageEditor>>(() => Object.fromEntries(operators.map(operator => [operator.id, packageEditor(operator)])));
  const selectedOperator = listed.find(operator => operator.id === operatorId);
  const selectedPackage = packages[operatorId] ?? packageEditor(selectedOperator);
  const { chosen, revision, message, error: publishError, needsRefresh } = selectedPackage;
  function updatePackage(id: string, update: (current: PackageEditor) => PackageEditor) {
    setPackages(current => ({ ...current, [id]: update(current[id] ?? packageEditor(listed.find(operator => operator.id === id))) }));
  }
  function chooseOperator(id: string) {
    if (writeLock.current || interactionBusy) return;
    setOperatorId(id);
    updatePackage(id, current => ({ ...current, message: '', error: '' }));
  }
  const [busy, setBusy] = useState<'publish' | 'create' | ''>('');
  const writeLock = useRef(false);
  const [roomBusy, setRoomBusy] = useState(false);
  const interactionBusy = Boolean(busy) || saving || roomBusy;
  const companiesOnly = initialTab === 'companies';
  const writesOff = !storeAvailable || interactionBusy;
  const publishSelectionReady = chosen.length > 0 && chosen.every(id => rows.some(row => row.id === id && !row.unsaved));
  const reloadHref = labUrl('/control/lanes?' + new URLSearchParams({ operator: operatorId, lane: selectedLane.id }));
  const draftBlocksReload = dirty || interactionBusy;
  const setMessage = (value: string) => updatePackage(operatorId, current => ({ ...current, message: value }));
  const setPublishError = (value: string) => updatePackage(operatorId, current => ({ ...current, error: value }));
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
    const lanes = [...chosen];
    if (!storeAvailable || writeLock.current || interactionBusy || conflict || !publishSelectionReady || needsRefresh || !operatorId) return;
    writeLock.current = true;
    setBusy('publish'); setPublishError(''); setMessage('');
    try {
      const { response, payload } = await post('operator-package', { operatorId, lanes });
      if (!response.ok) {
        updatePackage(operatorId, current => ({ ...current, needsRefresh: response.status === 409 || current.needsRefresh,
          error: response.status === 422 ? 'Kontrollera lagerfiler, vald grundloop och tillåtna val. Spara presentationen och försök igen.'
            : response.status === 409 ? 'Paketet kunde inte uppdateras. Uppgifterna kan ha ändrats, eller så påverkar urvalet ett befintligt spelrum. Läs in bolagets publicerade paket och behåll presentationer som används av spelrum.'
              : 'Publiceringen gick inte igenom.' }));
        return;
      }
      const next = Number(payload?.package_revision ?? payload?.packageRevision);
      if (!Number.isSafeInteger(next) || next < 1) { setPublishError('Serverns publiceringskvitto saknas.'); return; }
      updatePackage(operatorId, current => ({ ...current, chosen: lanes, revision: next, needsRefresh: false, error: '', message: 'Paketet är publicerat. Version ' + next + '.' }));
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
      const added: LaneOperatorChoice = { id: operator.id, slug: operator.slug, name: operator.name, publishedPackage: null };
      setListed(current => current.some(item => item.id === operator.id) ? current : [...current, added]);
      setPackages(current => ({ ...current, [added.id]: { ...packageEditor(added), message: 'SG test game provider är skapad.' } }));
      setOperatorId(added.id);
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
            <select value={operatorId} disabled={interactionBusy || !listed.length} onChange={event => chooseOperator(event.target.value)}>
              <option value="">Välj bolag</option>
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
        {selectedOperator ? <p>Urval för {selectedOperator.name}. Kryssrutorna utgår från bolagets publicerade paket. Att välja presentation för ett spelrum ändrar inte paketurvalet.</p> : <p>Välj vilket bolag som ska få paketet.</p>}
        {selectedOperator && !chosen.includes(selectedLane.id) ? <p>{selectedLane.label} är inte markerad i paketurvalet nedan. Markera den om du vill lägga till den vid publicering, eller skapa ett rum för presentationen längre ned.</p> : null}
        {selectedOperator && needsRefresh ? <p role="status">Läs in bolagets aktuella paket före nästa publicering. {dirty ? 'Spara utkastet först.' : null} <a href={reloadHref} aria-disabled={draftBlocksReload} onClick={event => { if (draftBlocksReload) event.preventDefault(); }}>Läs in publicerat paket</a></p> : null}
        {chosen.length > 0 && !publishSelectionReady ? <p role="status">Alla markerade presentationer måste finnas och vara sparade före publicering.</p> : null}
        <p>Paketet ger valt bolag tillgång till de markerade presentationerna och deras tillåtna dealers, bord och bakgrunder. Spara ändrade presentationer före publicering.</p>
        <form className={styles.form} onSubmit={event => { void publish(event); }}>
          <fieldset className={styles.choices}>
            <legend>Presentationer i partnerpaketet</legend>
            {rows.length ? rows.map(row => <label className={styles.choice} key={row.id}>
              <input type="checkbox" name="lanes" value={row.id} checked={chosen.includes(row.id)} disabled={row.unsaved || interactionBusy || !operatorId}
                onChange={event => { if (writeLock.current || interactionBusy || !operatorId) return; const checked = event.target.checked; updatePackage(operatorId, current => ({ ...current, chosen: checked ? [...new Set([...current.chosen, row.id])] : current.chosen.filter(id => id !== row.id), message: '', error: '' })); }} />
              {row.label} · {row.dealers.map(id=>project.dealers.find(dealer=>dealer.id===id)?.label??id).join(', ')}{row.unsaved ? ' (osparad)' : ''}
            </label>) : <p>Skapa en presentation i Sammansättning.</p>}
            {chosen.filter(id => !rows.some(row => row.id === id)).map(id => <label className={styles.choice} key={id}>
              <input type="checkbox" name="lanes" value={id} checked disabled={interactionBusy || !operatorId}
                onChange={event => { if (writeLock.current || interactionBusy || event.target.checked) return; updatePackage(operatorId, current => ({ ...current, chosen: current.chosen.filter(value => value !== id), message: '', error: '' })); }} />
              {id} · Saknas bland presentationerna. Avmarkera för att ta bort den ur paketet. Befintliga spelrum kan hindra borttagning.
            </label>)}
          </fieldset>
          <div className={styles.actions}>
            <button className="sg-btn sg-btn-primary" type="submit" disabled={writesOff || !publishSelectionReady || needsRefresh || !operatorId || conflict}>Publicera paket</button>
          </div>
        </form>
        <p>För att uppdatera ett befintligt spelrum: behåll rummets presentation markerad och publicera paketet igen. Valen ovan ersätter paketets presentationsurval.</p>
      </section>
      <PresentationRoomCreate operator={selectedOperator ?? null}
        presentation={{id:selectedLane.id,label:selectedLane.label}} projectRevision={project.revision}
        projectSaved={!dirty && !conflict} storeAvailable={storeAvailable} disabled={Boolean(busy) || saving || conflict}
        onBusyChange={setRoomBusy} onCreated={receipt => updatePackage(receipt.room.operatorId, current => ({ ...current, revision: receipt.packageRevision, needsRefresh: true, message: '', error: '' }))} />
      <details className={styles.card}>
        <summary>Avancerat: bolag och spelrum</summary>
        <button className="sg-btn sg-btn-ghost" type="button" disabled={writesOff} onClick={() => { void createDemo(); }}>Skapa SG test game provider</button>
        <a className="sg-btn sg-btn-secondary" aria-disabled={dirty || interactionBusy}
          onClick={event => { if (dirty || interactionBusy) event.preventDefault(); }}
          href={labUrl('/control/administration?tab=tables')}>Öppna bord & spelrum</a>
      </details>
      <p>Dealer, bord, bakgrund och uppspelningsinställningar redigeras i <a href={compositionHref} aria-disabled={dirty||interactionBusy} onClick={event=>{if(dirty||interactionBusy)event.preventDefault();}}>vald sammansättning</a>.</p>
      </> : null}
      {companiesOnly && directory !== undefined ? <ControlOperatorDirectory directory={directory}
        onCreated={operator => setListed(current => current.some(item => item.id === operator.id) ? current : [...current, operator])} /> : null}
    </div>
  </PageTemplate>;
}
