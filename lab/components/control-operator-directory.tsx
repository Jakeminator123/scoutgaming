'use client';

import { useRef, useState, type FormEvent } from 'react';
import { labBasePath, labUrl } from '../lib/lab-url.mjs';
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
  if (kind === 'member' && status === 429) return 'För många inbjudningar den här timmen. Ingenting sparades.';
  if (kind === 'member' && status === 404) return 'Bolaget finns inte längre.';
  if (kind === 'role' && status === 409) return 'Rolländringen skulle ta bort sista administratören.';
  return 'Ändringen gick inte igenom.';
}

const ROLE_LABELS: Record<string, string> = { 'Partner administrator': 'Administratör', 'Partner editor': 'Redaktör', 'Partner viewer': 'Läsare' };
const roleLabel = (role: { label: string }) => ROLE_LABELS[role.label] ?? role.label;
const PERMISSION_LABELS: Record<string, string> = {
  'overview.read': 'Se översikt', 'players.read': 'Se spelare', 'team.read': 'Se team', 'team.invite': 'Bjuda in medlemmar',
  'team.roles.assign': 'Tilldela roller', 'team.suspend': 'Stänga av medlemmar', 'tables.read': 'Se spelrum', 'tables.configure': 'Konfigurera spelrum',
  'presentations.read': 'Se presentationer', 'presentations.configure': 'Anpassa presentationer', 'reports.read': 'Se rapporter', 'integrations.read': 'Se integrationer',
};
function defaultRole(operator: OperatorDirectoryEntry) {
  const wanted = operator.members.length ? 'partner-viewer' : 'partner-admin';
  return operator.roles.some(role => role.id === wanted) ? wanted : operator.roles[0]?.id ?? '';
}

export function suggestOperatorSlug(name: string) {
  return name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 63).replace(/-+$/g, '');
}

export function operatorMemberInput(contact: string) {
  const value = contact.trim();
  return value.includes('@') ? { email: value, status: 'invited' } : { username: value, status: 'active' };
}

export function ControlOperatorDirectory({ directory, onCreated, selectedOperatorId, onSelect }: {
  directory: OperatorDirectory | null;
  selectedOperatorId?: string;
  onSelect?: (id: string) => void;
  onCreated?: (operator: { id: string; slug: string; name: string }) => void;
}) {
  const [entries, setEntries] = useState<OperatorDirectoryEntry[]>(() => directory?.operators ?? []);
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [search, setSearch] = useState('');
  const [localSelection, setLocalSelection] = useState('');
  const selectedId = selectedOperatorId ?? localSelection;
  function select(id: string) { if (!pending.current) { setLocalSelection(id); onSelect?.(id); } }
  const [name, setName] = useState('');
  const [adds, setAdds] = useState<Record<string, { contact: string; roleId: string }>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const pending = useRef(false);

  if (!directory) {
    return <section className={styles.card} aria-labelledby="operator-directory">
      <h2 id="operator-directory">Bolag</h2>
      <p role="status">Bolag och team kunde inte hämtas. Försök att ladda om sidan.</p>
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
    setSlug(''); setName(''); setSlugEdited(false); select(created.id);
    onCreated?.({ id: created.id, slug: created.slug, name: created.name });
    setMessage(created.missingRoles?.length
      ? `${created.name} är skapat, men standardrollerna ${created.missingRoles.join(', ')} saknas. Skapa dem under bolaget.`
      : `${created.name} är skapat med rollerna ${created.roles.map(role => role.label).join(', ')}.`);
  }
  async function addMember(event: FormEvent<HTMLFormElement>, operator: OperatorDirectoryEntry) {
    event.preventDefault();
    const draft = adds[operator.id] ?? { contact: '', roleId: '' };
    const roleId = draft.roleId || defaultRole(operator);
    if (!roleId || !draft.contact.trim()) { setError('Ange e-post eller användarnamn och välj en roll.'); return; }
    const identity = operatorMemberInput(draft.contact);
    const payload = await run(`add:${operator.id}`, 'operator-membership', { operatorId: operator.id, ...identity, roleId },
      'member', identity.email ? `Inbjudan till ${operator.name} är registrerad.` : `${identity.username} är medlem i ${operator.name}.`);
    if (payload) setAdds(current => ({ ...current, [operator.id]: { contact: '', roleId } }));
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

  const selected = entries.find(operator => operator.id === selectedId);
  const visible = entries.filter(operator => (operator.name + ' ' + operator.slug).toLocaleLowerCase('sv').includes(search.trim().toLocaleLowerCase('sv')));
  return <section className={styles.directory} aria-labelledby="operator-directory">
    <div className={styles.heading}><div><h2 id="operator-directory">Bolag & team</h2><p className={styles.muted}>Välj bolag och hantera dess medlemmar. Intern personal och spelarkonton finns under <a href={labUrl('/control/administration?tab=accounts')}>Interna konton & spelare</a>.</p></div><span className={styles.count}>{entries.length} bolag</span></div>
    {error ? <p className={styles.feedback} role="alert">{error}</p> : null}
    {message ? <p className={styles.feedback} role="status">{message}</p> : null}
    <div className={styles.workspace}>
    <aside className={styles.sidebar} aria-label="Välj bolag">
      <label className={styles.field}>Sök bolag<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Namn eller adress" /></label>
      <div className={styles.companyList}>{visible.map(operator => <button key={operator.id} type="button" className={styles.company} aria-pressed={selectedId === operator.id} disabled={Boolean(busy)} onClick={() => select(operator.id)}>
        <strong>{operator.name}</strong><span>{operator.members.length} {operator.members.length === 1 ? 'medlem' : 'medlemmar'}{operator.status !== 'active' ? ' · ' + (STATUS[operator.status] ?? operator.status) : ''}</span>
      </button>)}</div>
      {!visible.length ? <p className={styles.muted}>{entries.length ? 'Inga bolag matchar sökningen.' : 'Inga bolag ännu.'}</p> : null}
      <details className={styles.create} open={!entries.length || undefined}><summary>Skapa bolag</summary>
        <form className={styles.stack} aria-label="Skapa bolag" onSubmit={event => { void create(event); }}>
          <label className={styles.field}>Bolagsnamn<input value={name} disabled={Boolean(busy)} onChange={event => { setName(event.target.value); if (!slugEdited) setSlug(suggestOperatorSlug(event.target.value)); }} autoComplete="organization" maxLength={120} placeholder="Nordic Bet" required /></label>
          <label className={styles.field}>Adressnamn<input value={slug} disabled={Boolean(busy)} onChange={event => { setSlugEdited(true); setSlug(event.target.value); }} autoComplete="off" spellCheck={false} maxLength={63} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="nordic-bet" required /><small>/partner/{slug || 'bolagsnamn'}</small></label>
          <p className={styles.muted}>Standardroller skapas automatiskt. Bjud sedan in teamet.</p>
          <button className="sg-btn sg-btn-secondary" type="submit" disabled={Boolean(busy)}>Skapa bolag</button>
        </form>
      </details>
    </aside>
    {selected ? (() => {
      const operator = selected;
      const add = adds[operator.id] ?? { contact: '', roleId: '' };
      const selectedRole = operator.roles.find(role => role.id === (add.roleId || defaultRole(operator)));
      return <article className={styles.card} aria-labelledby={`operator-${operator.id}`}>
        <header className={styles.heading}><div><span className={styles.eyebrow}>BOLAGETS ARBETSYTA</span><h3 id={`operator-${operator.id}`}>{operator.name}</h3><p className={styles.muted}>/partner/{operator.slug}</p></div><a className="sg-btn sg-btn-secondary" href={labUrl('/control/lanes?' + new URLSearchParams({ operator: operator.id }))}>Spelrum & publicering →</a></header>
        {operator.missingRoles.length ? <div className={styles.feedback}><p role="status">Standardroller saknas: {operator.missingRoles.join(', ')}.</p><button className="sg-btn sg-btn-ghost" type="button" disabled={Boolean(busy)} onClick={() => { void restoreRoles(operator); }}>Skapa saknade standardroller</button></div> : null}
        <section className={styles.invite} aria-label="Lägg till i teamet">
          <h4>Bjud in till {operator.name}</h4>
          <p className={styles.muted}>En ny e-postadress får ett aktiveringsmejl. Ett befintligt partnerkonto kopplas utan mejl.</p>
          <form className={styles.form} aria-label={`Lägg till medlem i ${operator.name}`} onSubmit={event => { void addMember(event, operator); }}>
            <label className={styles.field}>E-post eller användarnamn<input value={add.contact} autoComplete="off" spellCheck={false} maxLength={254} required disabled={Boolean(busy)} placeholder="namn@bolag.se" onChange={event => { const contact = event.target.value; setAdds(current => ({ ...current, [operator.id]: { ...add, contact } })); }} /></label>
            <label className={styles.field}>Roll<select value={add.roleId || defaultRole(operator)} disabled={Boolean(busy) || !operator.roles.length} onChange={event => { const roleId = event.target.value; setAdds(current => ({ ...current, [operator.id]: { ...add, roleId } })); }}>{operator.roles.map(role => <option key={role.id} value={role.id}>{roleLabel(role)}</option>)}</select></label>
            <button className="sg-btn sg-btn-secondary" type="submit" disabled={Boolean(busy) || !operator.roles.length}>{add.contact.includes('@') ? 'Bjud in medlem' : 'Lägg till medlem'}</button>
          </form>
          {selectedRole ? <p className={styles.muted}>{roleLabel(selectedRole)}: {selectedRole.permissions.length} behörigheter. Se rollens åtkomst nedan.{!operator.members.length ? ' Första medlemmen föreslås bli administratör.' : ''}</p> : null}
        </section>
        <div className={styles.heading}><h4>Team</h4><span className={styles.count}>{operator.members.length} medlemmar</span></div>
        {operator.members.length ? <div className={styles.scroll}><table className={styles.members}>
          <thead><tr><th>Medlem</th><th>Roll</th><th>Status</th><th>Åtgärd</th></tr></thead>
          <tbody>{operator.members.map(member => {
            const key = `${operator.id}:${member.userId}`;
            const who = member.username ?? `konto ${member.userId}`;
            const roleId = drafts[key] ?? member.roleId;
            const options = operator.roles.some(role => role.id === member.roleId) ? operator.roles : [...operator.roles, { id: member.roleId, label: member.roleId, permissions: [], delegable: false }];
            return <tr key={member.userId}><td>{who}</td>
              <td><select aria-label={`Roll för ${who}`} value={roleId} disabled={Boolean(busy)} onChange={event => { const value = event.target.value; setDrafts(current => ({ ...current, [key]: value })); }}>{options.map(role => <option key={role.id} value={role.id}>{roleLabel(role)}</option>)}</select></td>
              <td><span className={styles.status} data-status={member.status}>{STATUS[member.status] ?? member.status}</span></td>
              <td><div className={styles.actions}>
                {roleId !== member.roleId ? <button className="sg-btn sg-btn-secondary" type="button" disabled={Boolean(busy)} onClick={() => { void change(operator, member, { roleId, status: member.status }, `Rollen för ${who} är sparad.`); }}>Spara roll</button> : null}
                {member.status === 'active' ? <button className="sg-btn sg-btn-ghost" type="button" disabled={Boolean(busy)} onClick={() => { void change(operator, member, { roleId: member.roleId, status: 'suspended' }, `${who} är avstängd.`); }}>Stäng av</button> : null}
                {member.status === 'suspended' ? <button className="sg-btn sg-btn-ghost" type="button" disabled={Boolean(busy)} onClick={() => { void change(operator, member, { roleId: member.roleId, status: 'active' }, `${who} är återaktiverad.`); }}>Återaktivera</button> : null}
              </div></td></tr>;
          })}</tbody></table></div> : <p className={styles.empty}>Teamet är tomt. Lägg till bolagets första administratör ovan.</p>}
        <details className={styles.roles}><summary>Vad får rollerna göra?</summary>{operator.roles.map(role => <div key={role.id}><strong>{roleLabel(role)}</strong><p className={styles.muted}>{role.permissions.map(permission => PERMISSION_LABELS[permission] ?? permission).join(' · ') || 'Inga behörigheter'}</p></div>)}</details>
      </article>;
    })() : <div className={styles.empty}><span className={styles.eyebrow}>BOLAG → TEAM → SPELRUM</span><h3>Samla arbetet kring ett bolag</h3><p>Välj ett bolag i listan eller skapa ett nytt. Här sköter du medlemskap och roller; under Spelrum & publicering väljer du vad bolagets spelare får möta.</p></div>}
    </div>
  </section>;
}
