'use client';

import { useRef, useState, type FormEvent } from 'react';
import { labBasePath } from '../lib/lab-url.mjs';
import type { OperatorDirectoryEntry, OperatorDirectoryMember } from '../lib/studio-native-runtime.mjs';
import styles from './control-operator-directory.module.css';

export type StandardOperatorRole = { id: string; label: string; permissions: string[] };
export type OperatorDirectory = { operators: OperatorDirectoryEntry[]; standardRoles: StandardOperatorRole[] };
type Kind = 'create' | 'member' | 'role';

const STATUS: Record<string, string> = { active: 'aktiv', suspended: 'avstängd', invited: 'inbjuden' };

// The admin API answers with a status only, so a 409 on a membership cannot say
// whether it was a stale revision, an existing member or the last administrator.
export function operatorDirectoryFailure(kind: Kind, status: number) {
  if (status === 403) return 'Åtkomst nekad. Logga in som intern administratör på den här adressen.';
  if (status === 503) return 'Ingen skrivbar Neon-pool. Ingenting sparades.';
  if (kind === 'create' && status === 409) return 'Det finns redan ett bolag med den sluggen.';
  if (kind === 'create' && status === 422) return 'Ogiltig slug eller namn. Slug: små bokstäver, siffror och bindestreck; reserverade ord som api, login och partner går inte.';
  if (kind === 'member' && status === 409) return 'Ingenting sparades: kontot är redan medlem, någon annan ändrade medlemskapet, eller ändringen skulle ta bort sista administratören. Ladda om sidan.';
  if (kind === 'member' && status === 422) return 'Kontot finns inte som partnerkonto, eller rollen saknas hos bolaget.';
  if (kind === 'member' && status === 404) return 'Bolaget finns inte längre.';
  if (kind === 'role' && status === 409) return 'Rolländringen skulle ta bort sista administratören.';
  return 'Ändringen gick inte igenom.';
}

function defaultRole(operator: OperatorDirectoryEntry) {
  const wanted = operator.members.length ? 'partner-viewer' : 'partner-admin';
  return operator.roles.some(role => role.id === wanted) ? wanted : operator.roles[0]?.id ?? '';
}

export function ControlOperatorDirectory({ directory, onCreated }: {
  directory: OperatorDirectory | null;
  onCreated?: (operator: { id: string; slug: string; name: string }) => void;
}) {
  const [entries, setEntries] = useState<OperatorDirectoryEntry[]>(() => directory?.operators ?? []);
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [adds, setAdds] = useState<Record<string, { username: string; roleId: string }>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const pending = useRef(false);

  if (!directory) {
    return <section className={styles.card} aria-labelledby="operator-directory">
      <h2 id="operator-directory">Bolag</h2>
      <p role="status">Bolag, roller och medlemskap kräver en skrivbar Neon-pool. Ingenting kan läsas eller sparas här just nu.</p>
    </section>;
  }
  const standardRoles = directory.standardRoles;

  function replace(next: OperatorDirectoryEntry | null | undefined) {
    if (!next || typeof next.id !== 'string') return;
    setEntries(current => current.some(item => item.id === next.id)
      ? current.map(item => item.id === next.id ? next : item)
      : [...current, next].sort((a, b) => a.slug.localeCompare(b.slug)));
  }
  async function run(key: string, action: string, body: Record<string, unknown>, kind: Kind, done: string) {
    if (pending.current) return null;
    pending.current = true;
    setBusy(key); setError(''); setMessage('');
    try {
      const response = await fetch(`${labBasePath()}/api/admin/${action}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) { setError(operatorDirectoryFailure(kind, response.status)); return null; }
      replace(payload?.operator);
      setMessage(done);
      return payload;
    } catch {
      setError('Ändringen gick inte igenom.');
      return null;
    } finally {
      pending.current = false;
      setBusy('');
    }
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = await run('create', 'operator-create', { slug: slug.trim(), name: name.trim() }, 'create', '');
    const created = payload?.operator as OperatorDirectoryEntry | undefined;
    if (!created) return;
    setSlug(''); setName('');
    onCreated?.({ id: created.id, slug: created.slug, name: created.name });
    setMessage(created.missingRoles?.length
      ? `${created.name} är skapat, men standardrollerna ${created.missingRoles.join(', ')} saknas. Skapa dem under bolaget.`
      : `${created.name} är skapat med rollerna ${created.roles.map(role => role.id).join(', ')}.`);
  }
  async function addMember(event: FormEvent<HTMLFormElement>, operator: OperatorDirectoryEntry) {
    event.preventDefault();
    const draft = adds[operator.id] ?? { username: '', roleId: '' };
    const roleId = draft.roleId || defaultRole(operator);
    const username = draft.username.trim();
    if (!username || !roleId) { setError('Ange användarnamn och roll.'); return; }
    const payload = await run(`add:${operator.id}`, 'operator-membership', { operatorId: operator.id, username, roleId, status: 'active' },
      'member', `${username} är medlem i ${operator.name}.`);
    if (payload) setAdds(current => ({ ...current, [operator.id]: { username: '', roleId } }));
  }
  async function change(operator: OperatorDirectoryEntry, member: OperatorDirectoryMember, next: { roleId: string; status: string }, done: string) {
    const key = `${operator.id}:${member.userId}`;
    const payload = await run(key, 'operator-membership', {
      operatorId: operator.id, userId: member.userId, roleId: next.roleId, status: next.status, expectedRevision: member.revision,
    }, 'member', done);
    if (payload) setDrafts(current => Object.fromEntries(Object.entries(current).filter(([item]) => item !== key)));
  }
  async function restoreRoles(operator: OperatorDirectoryEntry) {
    for (const roleId of operator.missingRoles) {
      const role = standardRoles.find(item => item.id === roleId);
      if (!role) continue;
      const saved = await run(`roles:${operator.id}`, 'operator-role', { operatorId: operator.id, roleId, permissions: role.permissions },
        'role', `Standardrollerna finns nu hos ${operator.name}.`);
      if (!saved) return;
    }
  }

  return <section className={styles.card} aria-labelledby="operator-directory">
    <h2 id="operator-directory">Bolag</h2>
    <p>Operatörsbolag med roller och medlemskap. En medlem är ett befintligt partnerkonto; ingen e-post skickas. Bolagets administratörer bjuder in och byter roller i partnerportalen.</p>
    {error ? <p role="alert">{error}</p> : null}
    {message ? <p role="status">{message}</p> : null}
    <form className={styles.form} aria-label="Skapa bolag" onSubmit={event => { void create(event); }}>
      <label className={styles.field}>Slug
        <input value={slug} onChange={event => setSlug(event.target.value)} autoComplete="off" spellCheck={false} maxLength={63} placeholder="nordic-bet" required />
      </label>
      <label className={styles.field}>Namn
        <input value={name} onChange={event => setName(event.target.value)} autoComplete="off" maxLength={120} placeholder="Nordic Bet" required />
      </label>
      <div className={styles.actions}>
        <button className="sg-btn sg-btn-secondary" type="submit" disabled={Boolean(busy)}>Skapa bolag</button>
      </div>
    </form>
    {entries.length ? <div className={styles.operators}>{entries.map(operator => {
      const add = adds[operator.id] ?? { username: '', roleId: '' };
      return <article className={styles.operator} key={operator.id} aria-labelledby={`operator-${operator.id}`}>
        <h3 id={`operator-${operator.id}`}>{operator.name} <span className={styles.muted}>· {operator.slug}{operator.status !== 'active' ? ` · ${operator.status}` : ''}</span></h3>
        {operator.missingRoles.length ? <div className={styles.actions}>
          <p role="status">Standardroller saknas: {operator.missingRoles.join(', ')}.</p>
          <button className="sg-btn sg-btn-ghost" type="button" disabled={Boolean(busy)} onClick={() => { void restoreRoles(operator); }}>Skapa saknade standardroller</button>
        </div> : null}
        {operator.members.length ? <div className={styles.scroll}><table className={styles.members}>
          <thead><tr><th>Medlem</th><th>Roll</th><th>Status</th><th>Åtgärd</th></tr></thead>
          <tbody>{operator.members.map(member => {
            const key = `${operator.id}:${member.userId}`;
            const who = member.username ?? `konto ${member.userId}`;
            const roleId = drafts[key] ?? member.roleId;
            const options = operator.roles.some(role => role.id === member.roleId)
              ? operator.roles : [...operator.roles, { id: member.roleId, label: member.roleId, permissions: [], delegable: false }];
            return <tr key={member.userId}>
              <td>{who}<small>id {member.userId} · revision {member.revision}</small></td>
              <td><select aria-label={`Roll för ${who}`} value={roleId} disabled={Boolean(busy)}
                onChange={event => { const value = event.target.value; setDrafts(current => ({ ...current, [key]: value })); }}>
                {options.map(role => <option key={role.id} value={role.id}>{role.label}</option>)}
              </select></td>
              <td>{STATUS[member.status] ?? member.status}</td>
              <td><div className={styles.actions}>
                <button className="sg-btn sg-btn-ghost" type="button" disabled={Boolean(busy) || roleId === member.roleId}
                  onClick={() => { void change(operator, member, { roleId, status: member.status }, `Rollen för ${who} är sparad.`); }}>Spara roll</button>
                {member.status === 'active' ? <button className="sg-btn sg-btn-ghost" type="button" disabled={Boolean(busy)}
                  onClick={() => { void change(operator, member, { roleId: member.roleId, status: 'suspended' }, `${who} är avstängd.`); }}>Stäng av</button> : null}
                {member.status === 'suspended' ? <button className="sg-btn sg-btn-ghost" type="button" disabled={Boolean(busy)}
                  onClick={() => { void change(operator, member, { roleId: member.roleId, status: 'active' }, `${who} är återaktiverad.`); }}>Återaktivera</button> : null}
              </div></td>
            </tr>;
          })}</tbody>
        </table></div> : <p className={styles.muted}>Inga medlemmar ännu.</p>}
        <form className={styles.form} aria-label={`Lägg till medlem i ${operator.name}`} onSubmit={event => { void addMember(event, operator); }}>
          <label className={styles.field}>Användarnamn
            <input value={add.username} autoComplete="off" spellCheck={false} maxLength={254} required
              onChange={event => { const value = event.target.value; setAdds(current => ({ ...current, [operator.id]: { ...add, username: value } })); }} />
          </label>
          <label className={styles.field}>Roll
            <select value={add.roleId || defaultRole(operator)} disabled={!operator.roles.length}
              onChange={event => { const value = event.target.value; setAdds(current => ({ ...current, [operator.id]: { ...add, roleId: value } })); }}>
              {operator.roles.map(role => <option key={role.id} value={role.id}>{role.label}</option>)}
            </select>
          </label>
          <div className={styles.actions}>
            <button className="sg-btn sg-btn-secondary" type="submit" disabled={Boolean(busy) || !operator.roles.length}>Lägg till medlem</button>
          </div>
        </form>
      </article>;
    })}</div> : <p className={styles.muted}>Inga bolag ännu.</p>}
  </section>;
}
