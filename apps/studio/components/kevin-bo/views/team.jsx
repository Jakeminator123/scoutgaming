// Team: medlemmar, roller, inbjudan, rollbyte, avstängning. Åtgärderna ligger i en
// åtgärdsmeny (⋯) per medlem med bekräftelse och körs bara genom den serverkontrollerade
// adaptern (partner-team-loader.mjs). Journalen renderas av laddaren under vyn.
import React, { useState } from 'react';
import { ActionMenu, Card, Chip, Page } from './ui.jsx';
import { partnerRoleWord } from '../partner-copy.mjs';

const STATUS = { sv: { active: 'aktiv', suspended: 'avstängd', invited: 'inbjuden' }, en: { active: 'active', suspended: 'suspended', invited: 'invited' } };
const PERMISSIONS = {
  'overview.read': ['Se översikten', 'See the overview'], 'players.read': ['Se spelare', 'See players'],
  'team.read': ['Se teamet', 'See the team'], 'team.invite': ['Bjuda in medlemmar', 'Invite members'],
  'team.roles.assign': ['Byta roll på medlemmar', 'Change member roles'], 'team.suspend': ['Stänga av och återaktivera medlemmar', 'Suspend and reactivate members'],
  'tables.read': ['Se spelborden', 'See the tables'], 'tables.configure': ['Ändra spelbordens inställningar', 'Change table settings'],
  'presentations.read': ['Se scenmallar och utseende', 'See scene templates and appearance'], 'presentations.configure': ['Ändra spelbordets utseende och publicera', 'Change table appearance and publish'],
  'reports.read': ['Se ekonomi', 'See finance'], 'integrations.read': ['Se integration', 'See integration'],
};

const text = value => typeof value === 'string' ? value.trim() : '';
function roleOf(member) {
  const role = member?.role;
  if (role && typeof role === 'object') {
    const id = text(role.id) || text(member.roleId);
    return { id, label: text(role.label) || text(role.name) || id || '—' };
  }
  const id = text(member?.roleId) || text(role);
  return { id, label: text(role) || id || '—' };
}
const sameOperator = (member, operatorId) => !member?.operatorId || !operatorId || member.operatorId === operatorId;
function roleChoices(snapshot, members, operatorId) {
  const choices = [], seen = new Set();
  const add = role => {
    if (!role?.id || seen.has(role.id)) return;
    seen.add(role.id);
    choices.push({ id: role.id, label: role.label || role.id, permissions: Array.isArray(role.permissions) ? role.permissions : null, delegable: role.delegable });
  };
  for (const value of Array.isArray(snapshot?.roles) ? snapshot.roles : []) {
    if (value && typeof value === 'object' && value.operatorId && operatorId && value.operatorId !== operatorId) continue;
    if (typeof value === 'string') add({ id: value, label: value });
    else if (value && typeof value === 'object') add({ id: text(value.id) || text(value.roleId), label: text(value.label) || text(value.name) || text(value.id), permissions: value.permissions, delegable: value.delegable });
  }
  for (const member of members) add(roleOf(member));
  return choices;
}
const revisionText = (member, en) => Number.isSafeInteger(member?.revision) && member.revision > 0 || /^[1-9]\d*$/.test(String(member?.revision ?? '')) ? `${en ? 'revision' : 'revision'} ${member.revision}` : '';
function notify(toast, runtime, message) {
  const fn = typeof toast === 'function' ? toast : runtime?.notify;
  if (typeof fn === 'function') fn(message);
}

export function TeamView({ snapshot, runtime, toast, language = 'sv', copy }) {
  const en = language === 'en', lang = en ? 'en' : 'sv', t = (sv, english) => en ? english : sv;
  const busy = runtime?.teamBusy === true;
  const live = runtime?.team ?? null;
  const locked = !live;
  const operatorId = text(snapshot?.operator?.id), operatorName = text(snapshot?.operator?.name) || '—';
  const [query, setQuery] = useState('');
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('');
  const members = (Array.isArray(snapshot?.team) ? snapshot.team : []).filter(member => member && typeof member === 'object' && sameOperator(member, operatorId));
  const choices = roleChoices(snapshot, members, operatorId);
  const word = role => partnerRoleWord(role.id, role.label, lang);
  const inviteChoices = live ? choices.filter(item => live.inviteRoles.includes(item.id)) : choices;
  const inviteLocked = locked || inviteChoices.length === 0;
  const selectedInviteRole = inviteChoices.some(role => role.id === inviteRole) ? inviteRole : inviteChoices[0]?.id || '';
  const adminRoles = new Set(choices.filter(role => role.permissions?.includes('team.roles.assign')).map(role => role.id));
  const activeAdmins = members.filter(member => member.status === 'active' && adminRoles.has(roleOf(member).id));
  const lastAdmin = member => activeAdmins.length === 1 && activeAdmins[0].id === member.id;
  const needle = query.trim().toLowerCase();
  const shown = members.filter(member => !needle || `${member.name || ''} ${member.id || ''} ${word(roleOf(member))}`.toLowerCase().includes(needle));

  const onInvite = event => {
    event.preventDefault();
    if (locked || busy) return;
    const address = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(address)) { notify(toast, runtime, t('Ange en giltig e-postadress. Ingenting har skickats.', 'Enter a valid email address. Nothing has been sent.')); return; }
    if (!selectedInviteRole) { notify(toast, runtime, t('Välj en roll. Ingenting har skickats.', 'Choose a role. Nothing has been sent.')); return; }
    if (members.some(member => text(member.email).toLowerCase() === address.toLowerCase() || member.id === address)) { notify(toast, runtime, t('Den adressen finns redan i listan. Ingenting har skickats.', 'This address is already listed. Nothing has been sent.')); return; }
    void live.invite(address, selectedInviteRole).then(added => { if (added) setEmail(''); });
  };
  const actions = member => {
    const name = text(member.name) || text(member.id) || '—';
    if (!live) return <span className="faint">—</span>;
    const items = [];
    for (const roleId of live.assignable(member) ?? []) {
      const next = choices.find(role => role.id === roleId) ?? { id: roleId, label: roleId };
      items.push({ id: `role:${roleId}`, label: t(`Byt roll till ${word(next)}`, `Change role to ${word(next)}`), onSelect: () => void live.role(member, roleId),
        confirm: { title: t(`Byt roll för ${name}?`, `Change role for ${name}?`), impact: [t(`Ny roll: ${word(next)}.`, `New role: ${word(next)}.`), t('Gäller direkt och loggas i journalen (team.role).', 'Applies immediately and is logged in the journal (team.role).')], button: t('Byt roll', 'Change role'), cancel: t('Avbryt', 'Cancel') } });
    }
    if (live.canSuspend?.(member)) items.push({ id: 'suspend', tone: 'danger', label: t('Stäng av', 'Suspend'), onSelect: () => void live.status(member, 'suspend'),
      confirm: { title: t(`Stäng av ${name}?`, `Suspend ${name}?`), impact: [t('Medlemmen kan inte längre logga in i Partnerportalen.', 'The member can no longer sign in to the partner portal.'), t('Loggas i journalen (team.suspend). Kan återaktiveras senare.', 'Logged in the journal (team.suspend). Can be reactivated later.')], button: t('Stäng av', 'Suspend'), cancel: t('Avbryt', 'Cancel') } });
    if (live.canReactivate?.(member)) items.push({ id: 'reactivate', label: t('Återaktivera', 'Reactivate'), onSelect: () => void live.status(member, 'reactivate'),
      confirm: { title: t(`Återaktivera ${name}?`, `Reactivate ${name}?`), impact: [t('Medlemmen kan logga in igen med sin roll.', 'The member can sign in again with their role.'), t('Loggas i journalen (team.reactivate).', 'Logged in the journal (team.reactivate).')], button: t('Återaktivera', 'Reactivate'), cancel: t('Avbryt', 'Cancel') } });
    if (!items.length) return lastAdmin(member)
      ? <Chip>{t('sista administratören', 'last administrator')}</Chip>
      : <span className="faint">—</span>;
    return <ActionMenu id={`team-actions-${text(member.id)}`} label={t(`Åtgärder för ${name}`, `Actions for ${name}`)} items={items} disabled={busy} />;
  };
  const statusChip = status => <Chip tone={status === 'active' ? 'ok' : status === 'invited' ? 'warn' : status === 'suspended' ? 'danger' : ''} dot>{STATUS[lang][status] ?? status ?? '—'}</Chip>;
  return <Page title={copy?.team ?? t('Team', 'Team')} intro={t(`${operatorName}: medlemmar, roller och inbjudningar. Administratör utses bara av Scoutgaming; den sista administratören kan inte stängas av.`, `${operatorName}: members, roles and invitations. Administrators are appointed by Scoutgaming only; the last administrator cannot be suspended.`)}>
    <div className="grid main-aside">
      <div className="stack">
        <Card title={t('Medlemmar', 'Members')} aside={<input className="input" style={{ width: 200 }} placeholder={t('Sök medlemmar', 'Search members')} aria-label={t('Sök medlemmar', 'Search members')} value={query} onChange={event => setQuery(event.target.value)} />}>
          {shown.length ? <div className="scroll-x"><table className="table">
            <thead><tr>{[t('Medlem', 'Member'), t('Roll', 'Role'), t('Status', 'Status'), t('Åtgärder', 'Actions')].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
            <tbody>{shown.map((member, index) => {
              const role = roleOf(member), name = text(member.name) || text(member.id) || '—', userId = text(member.id), revision = revisionText(member, en);
              return <tr key={`${member.operatorId || ''}:${userId}:${index}`}>
                <td><b>{name}</b>{userId && userId !== name ? <div className="small muted"><code>{userId}</code></div> : null}{revision ? <div className="small faint">{revision}</div> : null}</td>
                <td>{word(role)}</td>
                <td>{statusChip(member.status)}</td>
                <td className="num">{actions(member)}</td>
              </tr>;
            })}</tbody>
          </table></div> : <p className="muted">{members.length ? t('Inga medlemmar matchar sökningen.', 'No members match the search.') : t('Inga medlemmar ännu.', 'No members yet.')}</p>}
          <form className="actions mt" onSubmit={onInvite} aria-label={t('Bjud in', 'Invite')}>
            <div className="field"><label htmlFor="team-invite-email">{t('E-post', 'Email')}</label>
              <input id="team-invite-email" className="input" type="email" autoComplete="off" value={email} disabled={busy || inviteLocked} onChange={event => setEmail(event.target.value)} /></div>
            <div className="field"><label htmlFor="team-invite-role">{t('Roll', 'Role')}</label>
              <select id="team-invite-role" className="input" aria-label={t('Roll för inbjudan', 'Invitation role')} value={selectedInviteRole} disabled={busy || inviteLocked} onChange={event => setInviteRole(event.target.value)}>{inviteChoices.map(item => <option key={item.id} value={item.id}>{word(item)}</option>)}</select></div>
            <div className="field"><label aria-hidden="true">&nbsp;</label><button id="team-invite-submit" className="btn primary" type="submit" disabled={busy || inviteLocked}>{busy ? t('Sparar…', 'Saving…') : t('Bjud in', 'Invite')}</button></div>
          </form>
          <p className="small muted mt">{live ? live.note : t('Åtgärderna är låsta tills teamåtkomsten har verifierats.', 'Actions are locked until team access is verified.')}</p>
        </Card>
      </div>
      <div className="stack">
        <Card title={t('Rollerna', 'The roles')}>
          <div className="rows">{choices.map(role => <div className="row" key={role.id}>
            <div><Chip tone={adminRoles.has(role.id) ? 'accent' : ''}>{word(role)}</Chip></div>
            <div><div className="title">{role.label}</div>
              <div className="text">{Array.isArray(role.permissions) ? role.permissions.map(permission => PERMISSIONS[permission]?.[en ? 1 : 0] ?? permission).join(', ') : t('Rättighetsdetaljer saknas.', 'Permission details are unavailable.')}</div>
              {typeof role.delegable === 'boolean' ? <div className="text">{role.delegable ? t('Kan tilldelas av bolagets administratör.', 'May be assigned by the company administrator.') : t('Utses bara av Scoutgaming.', 'Appointed by Scoutgaming only.')}</div> : null}</div>
            <div />
          </div>)}</div>
        </Card>
      </div>
    </div>
  </Page>;
}
