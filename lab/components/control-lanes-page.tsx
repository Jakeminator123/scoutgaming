'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { labBasePath } from '../lib/lab-url.mjs';
import { defaultPresentationLane, normalizeProject, type StudioProject } from '../lib/studio-model.mjs';
import { PageTemplate } from './page-template';

export type LaneOperatorChoice = { id: string; slug: string; name: string };

const OFFLINE = 'Ingen skrivbar Neon-pool. Fixturen visas. Publicera paket och Skapa SG test game provider är avstängda tills poolen har connect().';

function visibleLanes(project: StudioProject) {
  try {
    const normalized = normalizeProject(project);
    if (Array.isArray(normalized.lanes) && normalized.lanes.length) {
      return normalized.lanes.map(lane => ({ id: lane.id, label: lane.label, dealers: [...lane.dealers] }));
    }
  } catch {
    return [];
  }
  const fallback = defaultPresentationLane();
  return [{ id: fallback.id, label: fallback.label, dealers: [...fallback.dealers] }];
}

export function ControlLanesPage({ initialProject, operators, storeAvailable }: {
  initialProject: StudioProject;
  operators: LaneOperatorChoice[];
  storeAvailable: boolean;
}) {
  const lanes = useMemo(() => visibleLanes(initialProject), [initialProject]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [operatorId, setOperatorId] = useState(() => operators.find(item => item.id === 'sg-test')?.id ?? operators[0]?.id ?? '');
  const [listed, setListed] = useState(operators);
  const [revision, setRevision] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'publish' | 'create' | ''>('');
  const writesOff = !storeAvailable || Boolean(busy);

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
    if (!storeAvailable || busy || chosen.length < 1 || !operatorId) return;
    setBusy('publish'); setError(''); setMessage('');
    try {
      const { response, payload } = await post('operator-package', { operatorId, lanes: chosen });
      if (!response.ok) {
        setError(response.status === 422 ? 'Lane-id:t finns inte i projektet.' : response.status === 409 ? 'Publiceringen krockade. Ladda om och försök igen.' : 'Publiceringen gick inte igenom.');
        return;
      }
      const next = Number(payload?.package_revision ?? payload?.packageRevision);
      if (!Number.isSafeInteger(next) || next < 1) { setError('Servern svarade utan package_revision.'); return; }
      setRevision(next);
      setMessage(`package_revision ${next}`);
    } catch {
      setError('Publiceringen gick inte igenom.');
    } finally {
      setBusy('');
    }
  }

  async function createDemo() {
    if (!storeAvailable || busy) return;
    setBusy('create'); setError(''); setMessage('');
    try {
      const { response, payload } = await post('operator-create-demo', {});
      if (response.status === 409) { setError('SG test game provider finns redan.'); return; }
      const operator = payload?.operator;
      if (!response.ok || !operator || operator.id !== 'sg-test') { setError('Operatören kunde inte skapas.'); return; }
      setListed(current => current.some(item => item.id === operator.id) ? current : [...current, { id: operator.id, slug: operator.slug, name: operator.name }]);
      setOperatorId(operator.id);
      setMessage('SG test game provider är skapad.');
    } catch {
      setError('Operatören kunde inte skapas.');
    } finally {
      setBusy('');
    }
  }

  return <PageTemplate eyebrow="// STUDIO" title="Lanes" intro="Publicera ett operatörspaket. Spelet läser inte paketet i det här steget.">
    <div className="sg-page-body">
      {!storeAvailable ? <p role="status">{OFFLINE}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {message ? <p role="status">{message}</p> : null}
      {revision !== null ? <p>Senaste package_revision: {revision}</p> : null}
      <form onSubmit={event => { void publish(event); }}>
        <fieldset>
          <legend>Lanes i projektet</legend>
          {lanes.length ? lanes.map(lane => <label key={lane.id}>
            <input type="checkbox" name="lanes" value={lane.id} checked={chosen.includes(lane.id)} disabled={!storeAvailable}
              onChange={event => setChosen(current => event.target.checked ? [...current, lane.id] : current.filter(id => id !== lane.id))} />
            {lane.id} · {lane.label} · {lane.dealers.join(', ')}
          </label>) : <p>Projektet har inga lanes.</p>}
        </fieldset>
        <label>Operatör
          <select value={operatorId} disabled={!storeAvailable || !listed.length} onChange={event => setOperatorId(event.target.value)}>
            {listed.map(operator => <option key={operator.id} value={operator.id}>{operator.name}</option>)}
          </select>
        </label>
        <button className="primary-button" type="submit" disabled={writesOff || chosen.length < 1 || !operatorId}>Publicera paket</button>
      </form>
      <button className="sg-btn sg-btn-ghost" type="button" disabled={writesOff} onClick={() => { void createDemo(); }}>Skapa SG test game provider</button>
    </div>
  </PageTemplate>;
}
