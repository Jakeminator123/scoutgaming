'use client';

import { useEffect, useRef, useState } from 'react';
import { openClawDashboardUrl } from '../lib/openclaw-dashboard.mjs';
import { labUrl } from '../lib/lab-url.mjs';
import type { OpenClawAdminModel, OpenClawAdminSnapshot, OpenClawAdminReceipt } from '../lib/openclaw-admin.mjs';
import { PageTemplate, UnsavedBar, publishShellStatus } from './page-template.mjs';
import styles from './openclaw-workspace.module.css';

type Model = OpenClawAdminModel;
type Snapshot = OpenClawAdminSnapshot;
type Agent = Snapshot['agents'][number];
type Receipt = Pick<OpenClawAdminReceipt, 'agentId' | 'model' | 'restartScheduled' | 'verifiedAt'>;
type Failure = Error & { status?: number };

const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 256;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
function model(value: unknown): value is Model {
  return record(value) && text(value.primary) && Array.isArray(value.fallbacks) && value.fallbacks.every(text);
}
function snapshot(value: unknown): value is Snapshot {
  if (!record(value) || value.version !== 1 || !text(value.baseHash) || !record(value.gateway)
    || value.gateway.connected !== true || !text(value.gateway.version)
    || !(value.gateway.applied === null || typeof value.gateway.applied === 'boolean')
    || !Array.isArray(value.agents) || !Array.isArray(value.models)) return false;
  return value.agents.every(agent => record(agent) && text(agent.id) && model(agent.model))
    && new Set(value.agents.map(agent => agent.id)).size === value.agents.length
    && value.models.every(item => record(item) && text(item.id) && text(item.provider))
    && new Set(value.models.map(item => item.id)).size === value.models.length;
}
function sameModel(left: Model, right: Model) {
  return left.primary === right.primary && left.fallbacks.length === right.fallbacks.length
    && left.fallbacks.every((value, index) => value === right.fallbacks[index]);
}
function failure(status?: number, code?: unknown): Failure {
  let message = 'OpenClaw kunde inte nås. Försök hämta inställningarna igen.';
  if (status === 401) message = 'Din session har löpt ut. Logga in i Studio igen.';
  else if (status === 403) message = 'Ditt Studio-konto saknar behörighet att ändra OpenClaw.';
  else if (status === 409) message = 'Inställningarna har ändrats av någon annan. Ditt utkast finns kvar. Hämta aktuella val innan du sparar igen.';
  else if (code === 'openclaw_admin_not_configured' || code === 'openclaw_admin_device_not_configured') message = 'OpenClaw-administrationen är inte konfigurerad ännu.';
  else if (code === 'openclaw_admin_pairing_required') message = 'Anslutningen till OpenClaw behöver godkännas av en administratör.';
  else if (code === 'openclaw_admin_scope_required') message = 'Anslutningen till OpenClaw saknar behörighet för modellinställningar.';
  else if (code === 'openclaw_admin_version_mismatch') message = 'OpenClaw-versionen stöder inte dessa modellinställningar.';
  else if (code === 'openclaw_admin_save_uncertain') message = 'Sparandet kunde inte bekräftas. Ditt utkast finns kvar. Hämta aktuella val innan du försöker igen.';
  else if (status === 422) message = 'Modellen är inte längre tillgänglig. Ditt utkast finns kvar. Hämta aktuella val.';
  else if (status === 400) message = 'Modellvalet kunde inte sparas. Hämta aktuella val och kontrollera modellen.';
  return Object.assign(new Error(message), { status });
}
async function request(method: 'GET' | 'PATCH', signal: AbortSignal, body?: unknown) {
  let response: Response;
  try {
    response = await fetch(labUrl('/api/openclaw/admin'), {
      method, signal: AbortSignal.any([signal, AbortSignal.timeout(45000)]), credentials: 'same-origin', cache: 'no-store', redirect: 'error',
      ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw failure();
  }
  const value: unknown = await response.json().catch(() => null);
  if (!response.ok) throw failure(response.status, record(value) ? value.error ?? value.code : null);
  return value;
}

export function OpenClawWorkspace({ dashboardUrl }: { dashboardUrl?: unknown }) {
  const url = openClawDashboardUrl(dashboardUrl);
  const [data, setData] = useState<Snapshot | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>('load');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const alive = useRef(false);
  const receipt = useRef<Receipt | null>(null);

  function accept(next: Snapshot) {
    setData(next);
    if (receipt.current) {
      const saved = receipt.current;
      const actual = next.agents.find(agent => agent.id === saved.agentId);
      if (!actual || !sameModel(actual.model, saved.model)) {
        setError('Det nya valet kunde inte bekräftas i OpenClaw. Ditt utkast finns kvar. Kontrollera aktuella val innan du försöker igen.');
        receipt.current = null;
        setNeedsRefresh(true);
        return;
      }
      setNotice(`${saved.agentId}: ${saved.model.primary} sparad och bekräftad i OpenClaws inställningar.${saved.restartScheduled ? ' Gateway-omstart är planerad.' : ''}`);
      receipt.current = null;
    }
    setDrafts(previous => Object.fromEntries(Object.entries(previous).filter(([id, primary]) => {
      const current = next.agents.find(agent => agent.id === id);
      return !current || current.model.primary !== primary;
    })));
    setNeedsRefresh(false);
  }

  async function load() {
    if (controller.current) return;
    const active = new AbortController();
    controller.current = active;
    setBusy('load'); setError(''); setNotice('');
    try {
      const next = await request('GET', active.signal);
      if (!snapshot(next)) throw failure();
      if (alive.current && !active.signal.aborted) accept(next);
    } catch (cause) {
      if (alive.current && !active.signal.aborted) { setError((cause as Error).message); setNeedsRefresh(true); }
    } finally {
      if (controller.current === active) {
        controller.current = null;
        if (alive.current) setBusy(null);
      }
    }
  }

  useEffect(() => {
    alive.current = true;
    void load();
    return () => { alive.current = false; controller.current?.abort(); controller.current = null; };
  }, []);

  const changedAgents = data?.agents.filter(agent => (drafts[agent.id] ?? agent.model.primary) !== agent.model.primary) ?? [];
  const dirty = changedAgents.length > 0 || Object.keys(drafts).some(id => !data?.agents.some(agent => agent.id === id));
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => {
    if (!data) { publishShellStatus(null); return; }
    publishShellStatus(<span className={dirty ? 'sg-pill sg-pill-ej-sparad' : 'sg-pill sg-pill-sparad'}>{dirty ? 'Ej sparad' : 'Sparad'}</span>);
    return () => publishShellStatus(null);
  }, [dirty, data]);

  async function save(agent: Agent) {
    const primary = drafts[agent.id];
    if (!data || !data.gateway.connected || needsRefresh || controller.current || !primary
      || primary === agent.model.primary || agent.model.fallbacks.includes(primary) || !data.models.some(item => item.id === primary)) return;
    const active = new AbortController();
    controller.current = active;
    setBusy(agent.id); setError(''); setNotice('');
    const intended = { primary, fallbacks: [...agent.model.fallbacks] };
    try {
      const result = await request('PATCH', active.signal, { version: 1, baseHash: data.baseHash, agentId: agent.id, model: intended });
      if (!record(result) || result.saved !== true || !text(result.baseHash) || result.agentId !== agent.id
        || !model(result.model) || !sameModel(result.model, intended) || typeof result.restartScheduled !== 'boolean' || !text(result.verifiedAt)) throw failure();
      if (!alive.current || active.signal.aborted) return;
      receipt.current = { agentId: agent.id, model: intended, restartScheduled: result.restartScheduled, verifiedAt: result.verifiedAt };
      setNeedsRefresh(true);
      const next = await request('GET', active.signal);
      if (!snapshot(next)) throw failure();
      if (alive.current && !active.signal.aborted) accept(next);
    } catch (cause) {
      if (alive.current && !active.signal.aborted) {
        setNeedsRefresh(true);
        setError(receipt.current
          ? 'OpenClaw tog emot ändringen, men återläsningen misslyckades. Ditt utkast finns kvar. Hämta aktuella val för att bekräfta resultatet.'
          : (cause as Error).message);
      }
    } finally {
      if (controller.current === active) {
        controller.current = null;
        if (alive.current) setBusy(null);
      }
    }
  }

  function undoAll() {
    setDrafts({});
    setNotice('');
  }
  return <main id="main-content" className={styles.shell}>
    <PageTemplate
      eyebrow="// OPENCLAW"
      title="Agentmodeller"
      intro="Välj modell för en agent och spara. Du använder din Studio-inloggning."
      status={<span className={dirty ? 'sg-pill sg-pill-ej-sparad' : 'sg-pill sg-pill-sparad'}>{dirty ? 'Ej sparad' : 'Sparad'}</span>}
    />
    <div className={styles.headerActions}><button className="sg-btn sg-btn-primary" type="button" disabled={!!busy} onClick={() => void load()}>Hämta aktuella val</button></div>
    <div className={styles.feedback} aria-live="polite">
      {busy === 'load' && <p role="status">Hämtar inställningar från OpenClaw…</p>}
      {busy && busy !== 'load' && <p role="status">Sparar och kontrollerar modellvalet…</p>}
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </div>
    {data && <section className={styles.panel} aria-labelledby="agent-models">
      <div className={styles.panelHeading}><h2 id="agent-models">Modellval</h2><span>{dirty ? 'Osparade ändringar' : 'Senast hämtade val'}</span></div>
      <p className={styles.runtimeState}>{needsRefresh ? 'De här valen kommer från senaste lyckade hämtningen. Hämta aktuella val för att kontrollera statusen.'
        : data.gateway.applied === true ? 'Gateway använder de hämtade inställningarna.'
        : data.gateway.applied === false ? 'Inställningarna är sparade. Gateway har ännu inte tagit dem i bruk.'
          : 'Gateway är nåbar. Det går inte att bekräfta vilka inställningar som används i körningen.'}</p>
      {data.agents.length === 0 && <p className={styles.empty}>Inga Croupier-agenter kunde läsas från OpenClaw.</p>}
      {data.agents.map(agent => {
        const primary = drafts[agent.id] ?? agent.model.primary;
        const changed = primary !== agent.model.primary;
        const inCatalog = data.models.some(item => item.id === primary);
        return <article key={agent.id} className={styles.agent} aria-labelledby={`agent-${agent.id}`}>
          <div className={styles.identity}><h3 className={styles.modelName} id={`agent-${agent.id}`}>{agent.id}</h3><p>Aktuell: <code>{agent.model.primary}</code></p>
            {agent.model.fallbacks.length > 0 && <details className={styles.details}><summary>Reservmodeller · {agent.model.fallbacks.length}</summary><p>Behålls när du sparar.</p><ol>{agent.model.fallbacks.map((fallback, index) => <li key={`${index}-${fallback}`}><code>{fallback}</code></li>)}</ol></details>}
          </div>
          <label className={styles.field}>Modell för {agent.id}
            <select value={primary} disabled={!!busy || !data.gateway.connected} onChange={event => {
              const next = event.target.value;
              setDrafts(previous => ({ ...previous, [agent.id]: next })); setNotice('');
            }}>
              {!inCatalog && <option value={primary} disabled>{primary} (nuvarande, saknas i modellistan)</option>}
              {data.models.map(item => <option key={item.id} value={item.id} disabled={agent.model.fallbacks.includes(item.id)}>{item.id} · {item.provider}{agent.model.fallbacks.includes(item.id) ? ' (reservmodell)' : ''}</option>)}
            </select>
            {changed && <span className={styles.draft}>Nytt val: <code>{primary}</code></span>}
          </label>
          <div className={styles.actions}>
            <button className="sg-btn sg-btn-secondary" type="button" aria-label={`Spara modell för ${agent.id}`} disabled={!changed || !inCatalog || agent.model.fallbacks.includes(primary) || !!busy || needsRefresh || !data.gateway.connected} onClick={() => void save(agent)}>{busy === agent.id ? 'Sparar…' : 'Spara'}</button>
            {changed && <button className={styles.secondary} type="button" disabled={!!busy} aria-label={`Återställ modell för ${agent.id}`} onClick={() => {
              setDrafts(previous => { const next = { ...previous }; delete next[agent.id]; return next; }); setNotice('');
            }}>Återställ</button>}
          </div>
        </article>;
      })}
      {Object.entries(drafts).filter(([id]) => !data.agents.some(agent => agent.id === id)).map(([id, primary]) => <div className={styles.orphan} key={id}>
        <p role="alert">{id} finns inte längre i de hämtade inställningarna. Ditt osparade val är <code>{primary}</code>.</p>
        <button className={styles.secondary} disabled={!!busy} type="button" onClick={() => setDrafts(previous => { const next = { ...previous }; delete next[id]; return next; })}>Ta bort utkast för {id}</button>
      </div>)}
    </section>}
    <section className={styles.advanced} aria-labelledby="openclaw-advanced">
      <div><h2 id="openclaw-advanced">Fler inställningar</h2><p>Agentchatt, sessioner och avancerade inställningar finns i OpenClaws egen dashboard.</p></div>
      {url ? <a className={styles.secondary} href={url}>Öppna OpenClaw-dashboard ↗</a>
        : <p role="alert">Dashboardadressen är ogiltig.</p>}
      <p className={styles.advancedNote}>Dashboarden kan begära OpenClaws befintliga webbläsargodkännande. Ändra dealerns klipp och regler i <a href={labUrl('/')}>Studio</a>.</p>
    </section>
    {changedAgents.length > 0 ? <UnsavedBar count={changedAgents.length} onSave={() => { const agent = changedAgents[0]; if (agent) void save(agent); }} onUndo={undoAll} /> : null}
  </main>;
}
