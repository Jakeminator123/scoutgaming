// Membership and permissions for the server-selected operator. Diagnostic drafts stay local.
import React, { useState } from 'react';

const h = React.createElement;
const DEFAULT_ROLES = [
  ['Partner administrator', 'Eget team, spelare och konfiguration inom tilldelat mandat.'],
  ['Partner editor', 'Godkända presentationer och eget varumärke.'],
  ['Partner technician', 'Egen integration och avgränsade teststarter.'],
  ['Partner analyst', 'Egna rapporter och läsbehörighet.'],
];
const STATUS_TEXT = { active: 'aktiv', suspended: 'avstängd', invited: 'inbjuden' };

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}
function roleOf(member) {
  const role = member?.role;
  if (role && typeof role === 'object') {
    const id = text(role.id) || text(member.roleId);
    return { id, label: text(role.label) || text(role.name) || id || '—' };
  }
  const id = text(member?.roleId) || text(role);
  return { id, label: text(role) || id || '—' };
}
function sameOperator(member, operatorId) {
  return !member?.operatorId || !operatorId || member.operatorId === operatorId;
}
function roleChoices(snapshot, members, operatorId) {
  const choices = [];
  const seen = new Set();
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
function statusText(status, preview, en) {
  if (en && STATUS_TEXT[status]) return status;
  if (STATUS_TEXT[status]) return STATUS_TEXT[status];
  if (preview && status) return `Fixture · ${status}`;
  return status ? String(status) : '—';
}
function statusNode(status, preview, en) {
  const label = statusText(status, preview, en);
  if (preview && status && !STATUS_TEXT[status]) return h('span', { className: 'badge b-paused' }, h('i'), label);
  const tone = status === 'suspended' ? 'pill pill-err' : status === 'invited' ? 'pill pill-warn' : 'pill kevin-status-pill';
  return h('span', { className: tone }, label);
}
function revisionText(member) {
  const value = member?.revision;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return `Revision ${value}`;
  if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) return `Revision ${value}`;
  return '';
}
function notify(toast, runtime, message) {
  const fn = typeof toast === 'function' ? toast : runtime?.notify;
  if (typeof fn === 'function') fn(message);
}

const PERMISSIONS = {
  'overview.read': ['Läsa översikt', 'Read overview'], 'players.read': ['Läsa spelare', 'Read players'],
  'team.read': ['Läsa team', 'Read team'], 'team.invite': ['Bjuda in medlemmar', 'Invite members'],
  'team.roles.assign': ['Tilldela roller', 'Assign roles'], 'team.suspend': ['Stänga av och återaktivera medlemmar', 'Suspend and reactivate members'],
  'tables.read': ['Läsa bord', 'Read tables'], 'tables.configure': ['Konfigurera bord', 'Configure tables'],
  'presentations.read': ['Läsa presentationer', 'Read presentations'], 'presentations.configure': ['Anpassa presentationer', 'Configure presentations'],
  'reports.read': ['Läsa rapporter', 'Read reports'], 'integrations.read': ['Läsa integrationer', 'Read integrations'],
};
export function TeamView({ snapshot, runtime, surface, toast, language = 'sv' }) {
  const en = language === 'en';
  const busy = runtime?.teamBusy === true;
  const preview = snapshot?.preview === true;
  const live = !preview && runtime?.team ? runtime.team : null;
  const locked = !preview && !live;
  const operatorId = text(snapshot?.operator?.id);
  const operatorName = text(snapshot?.operator?.name) || '—';
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('members');
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('');
  const [drafts, setDrafts] = useState([]);
  const [roleOverrides, setRoleOverrides] = useState({});
  const source = [...(Array.isArray(snapshot?.team) ? snapshot.team : []), ...drafts].filter(member => member && typeof member === 'object' && sameOperator(member, operatorId));
  const choices = roleChoices(snapshot, source, operatorId);
  const inviteChoices = live ? choices.filter(item => live.inviteRoles.includes(item.id)) : choices;
  const inviteLocked = locked || Boolean(live && inviteChoices.length === 0);
  const selectedInviteRole = inviteChoices.some(role => role.id === inviteRole) ? inviteRole : inviteChoices[0]?.id || '';
  const needle = query.trim().toLowerCase();
  const shown = source.filter(member => {
    if (!needle) return true;
    const role = roleOf(member);
    return `${member.name || ''} ${member.email || ''} ${member.id || ''} ${role.label}`.toLowerCase().includes(needle);
  });
  const catalogue = Array.isArray(snapshot?.roles) && snapshot.roles.length
    ? choices
    : (preview ? DEFAULT_ROLES.map(([label, description]) => ({ id: label, label, description })) : choices);
  const subtitle = preview
    ? `Personal i ${operatorName}. Exempelmedlemmar; kontoadministration är inte ansluten.`
    : (en ? `Memberships in ${operatorName}.` : `Medlemskap i ${operatorName}.`);

  const onInvite = event => {
    event.preventDefault();
    if (locked || busy) return;
    const address = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(address)) {
      notify(toast, runtime, en ? 'Enter a valid email address. Nothing has been sent.' : 'Ange en giltig e-postadress. Ingenting har skickats.');
      return;
    }
    if (!selectedInviteRole) {
      notify(toast, runtime, en ? 'Choose a role. Nothing has been sent.' : 'Välj en rollprofil. Ingenting har skickats.');
      return;
    }
    if (source.some(member => text(member.email).toLowerCase() === address.toLowerCase() || member.id === address)) {
      notify(toast, runtime, en ? 'This address is already listed. Nothing has been sent.' : 'Den adressen finns redan i listan. Ingenting har skickats.');
      return;
    }
    if (live) {
      void live.invite(address, selectedInviteRole).then(added => { if (added) setEmail(''); });
      return;
    }
    const role = choices.find(item => item.id === selectedInviteRole) || { id: selectedInviteRole, label: selectedInviteRole };
    setDrafts(current => [...current, {
      id: address,
      operatorId,
      name: address,
      email: address,
      role: role.label,
      roleId: role.id,
      status: 'invited',
    }]);
    setEmail('');
    notify(toast, runtime, 'Inbjudan sparad lokalt. Ingenting har skickats.');
  };
  const onRole = (member, nextRole) => {
    if (busy) return;
    if (live) {
      if (member?.id) void live.role(member, nextRole);
      return;
    }
    if (!preview || !member?.id) return;
    setRoleOverrides(current => ({ ...current, [member.id]: nextRole }));
    notify(toast, runtime, 'Rollbyte sparat lokalt. Ingenting har skickats.');
  };

  const onStatus = (member, action) => {
    if (!live || busy) return;
    const name = text(member.name) || text(member.id);
    const question = action === 'suspend'
      ? (en ? 'Suspend ' + name + ' for this operator?' : 'Stäng av ' + name + ' för detta bolag?')
      : (en ? 'Reactivate ' + name + ' for this operator?' : 'Återaktivera ' + name + ' för detta bolag?');
    if (globalThis.confirm?.(question) === true) void live.status(member, action);
  };
  return h(React.Fragment, null,
    h('header', { className: 'page-h' },
      h('div', { style: { display: 'grid', gap: 6 } },
        h('h1', null, preview ? 'Team & access' : (en ? 'Memberships' : 'Medlemskap')),
        h('div', { className: 'muted', style: { fontSize: 13, maxWidth: 720 } }, subtitle))),
    h('div', { className: 'page-b' },
      h('section', { className: 'panel', 'data-surface': surface || 'partner' },
        h('div', { className: 'panel-h' },
          h('div', { className: 'seg' }, [['members', en ? 'Members' : 'Medlemmar'], ['roles', en ? 'Roles & permissions' : 'Roller & behörigheter']].map(([id, label]) =>
            h('button', { key: id, type: 'button', className: tab === id ? 'on' : '', 'aria-pressed': tab === id, onClick: () => setTab(id) }, label))),
          h('input', {
            className: 'input',
            placeholder: en ? 'Search members' : 'Sök medlemmar',
            'aria-label': en ? 'Search members' : 'Sök medlemmar',
            value: query,
            onChange: event => setQuery(event.target.value),
          })),
        tab === 'members'
          ? h('div', { className: 'scroll-x' },
            h('table', { className: 'tbl pl-tbl' },
              h('thead', null, h('tr', null, (en ? ['Membership', 'Role', 'Operator', 'Status', 'Actions'] : ['Medlemskap', 'Rollprofil', 'Bolag', 'Status', 'Åtgärder']).map(label => h('th', { key: label, scope: 'col' }, label)))),
              h('tbody', null, shown.map((member, index) => {
                const role = roleOf(member);
                const selected = roleOverrides[member.id] || role.id;
                const name = text(member.name) || text(member.id) || '—';
                const userId = text(member.id);
                const revision = revisionText(member);
                const optionIds = new Set(choices.map(item => item.id));
                const options = optionIds.has(selected) || !selected ? choices : [...choices, { id: selected, label: role.label }];
                const assignable = live ? live.assignable(member) : null;
                const roleOptions = assignable ? options.filter(item => item.id === selected || assignable.includes(item.id)) : options;
                return h('tr', { key: `${member.operatorId || ''}:${userId}:${index}` },
                  h('td', null, h('div', { className: 'pl-who' },
                    h('span', { className: 'pl-av' }, name.slice(0, 2).toUpperCase()),
                    h('span', null,
                      h('b', null, name),
                      text(member.email) ? h('small', null, member.email) : null,
                      !preview && userId && userId !== name ? h('small', { className: 'mono' }, userId) : null,
                      revision ? h('small', { className: 'mono' }, revision) : null))),
                  h('td', null, h('select', {
                    id: `team-role-${userId || index}`,
                    className: 'select',
                    'aria-label': en ? `Role for ${name}` : `Rollprofil för ${name}`,
                    value: selected,
                    disabled: busy || locked || Boolean(assignable && assignable.length === 0),
                    onChange: event => onRole(member, event.target.value),
                  }, roleOptions.map(item => h('option', { key: item.id, value: item.id }, item.label)))),
                  h('td', null, operatorName),
                  h('td', null, statusNode(member.status, preview, en)),
                  h('td', null,
                    live?.canSuspend?.(member) ? h('button', { type: 'button', className: 'btn sm', disabled: busy, onClick: () => onStatus(member, 'suspend'), 'aria-label': (en ? 'Suspend ' : 'Stäng av ') + name }, en ? 'Suspend' : 'Stäng av') : null,
                    live?.canReactivate?.(member) ? h('button', { type: 'button', className: 'btn sm', disabled: busy, onClick: () => onStatus(member, 'reactivate'), 'aria-label': (en ? 'Reactivate ' : 'Återaktivera ') + name }, en ? 'Reactivate' : 'Återaktivera') : null));
              }))))
          : h('div', { className: 'rows' }, catalogue.map(role =>
            h('section', { key: role.id }, h('h3', null, role.label),
              role.description ? h('p', null, role.description) : null,
              typeof role.delegable === 'boolean' ? h('p', { className: 'muted' }, role.delegable
                ? (en ? 'May be assigned by an authorized partner administrator.' : 'Kan tilldelas av behörig partneradministratör.')
                : (en ? 'Assigned by internal staff only.' : 'Tilldelas endast av intern personal.')) : null,
              Array.isArray(role.permissions) ? h('ul', null, role.permissions.map(permission => h('li', { key: permission }, PERMISSIONS[permission]?.[en ? 1 : 0] || permission)))
                : h('p', { className: 'muted' }, en ? 'Permission details are unavailable.' : 'Rättighetsdetaljer saknas.')))),
        h('form', { className: 'panel-h wrap', onSubmit: onInvite },
          h('div', { className: 'field' },
            h('label', { htmlFor: 'team-invite-email' }, en ? 'Email' : 'E-post'),
            h('input', {
              id: 'team-invite-email',
              className: 'input',
              type: 'email',
              autoComplete: 'off',
              value: email,
              disabled: busy || inviteLocked,
              onChange: event => setEmail(event.target.value),
            })),
          h('div', { className: 'field' },
            h('label', { htmlFor: 'team-invite-role' }, en ? 'Role' : 'Rollprofil'),
            h('select', {
              id: 'team-invite-role',
              className: 'select',
              'aria-label': en ? 'Invitation role' : 'Rollprofil för inbjudan',
              value: selectedInviteRole,
              disabled: busy || inviteLocked,
              onChange: event => setInviteRole(event.target.value),
            }, inviteChoices.map(item => h('option', { key: item.id, value: item.id }, item.label)))),
          h('button', { id: 'team-invite-submit', className: 'btn primary', type: 'submit', disabled: busy || inviteLocked }, busy ? (en ? 'Saving…' : 'Sparar…') : (en ? 'Invite' : 'Bjud in'))),
        h('div', { className: 'note' }, preview
          ? 'Rollerna är målbilden. Den aktuella förhandsvisningen kräver befintlig intern admininloggning; inga partnerkonton eller utökade rättigheter skapas här.'
          : live ? live.note : (en ? 'Actions are locked until team access is verified.' : 'Åtgärderna är låsta tills teamåtkomsten har verifierats.')))));
}
