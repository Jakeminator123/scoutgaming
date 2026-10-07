// Medlemskap for one operator. Preview drafts stay in this component; real mode is read-only.
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
    choices.push({ id: role.id, label: role.label || role.id });
  };
  for (const value of Array.isArray(snapshot?.roles) ? snapshot.roles : []) {
    if (value && typeof value === 'object' && value.operatorId && operatorId && value.operatorId !== operatorId) continue;
    if (typeof value === 'string') add({ id: value, label: value });
    else if (value && typeof value === 'object') add({ id: text(value.id) || text(value.roleId), label: text(value.label) || text(value.name) || text(value.id) });
  }
  for (const member of members) add(roleOf(member));
  return choices;
}
function statusText(status, preview) {
  if (STATUS_TEXT[status]) return STATUS_TEXT[status];
  if (preview && status) return `Fixture · ${status}`;
  return status ? String(status) : '—';
}
function statusNode(status, preview) {
  const label = statusText(status, preview);
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

export function TeamView({ snapshot, runtime, surface, toast }) {
  const preview = snapshot?.preview === true;
  const locked = !preview;
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
  const selectedInviteRole = inviteRole || choices[0]?.id || '';
  const needle = query.trim().toLowerCase();
  const shown = source.filter(member => {
    if (!needle) return true;
    const role = roleOf(member);
    return `${member.name || ''} ${member.email || ''} ${member.id || ''} ${role.label}`.toLowerCase().includes(needle);
  });
  const catalogue = Array.isArray(snapshot?.roles) && snapshot.roles.length
    ? choices.map(role => [role.label, ''])
    : (preview ? DEFAULT_ROLES : choices.map(role => [role.label, '']));
  const subtitle = preview
    ? `Personal i ${operatorName}. Exempelmedlemmar; kontoadministration är inte ansluten.`
    : `Medlemskap i ${operatorName}.`;

  const onInvite = event => {
    event.preventDefault();
    if (!preview) return;
    const address = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(address)) {
      notify(toast, runtime, 'Ange en giltig e-postadress. Ingenting har skickats.');
      return;
    }
    if (!selectedInviteRole) {
      notify(toast, runtime, 'Välj en rollprofil. Ingenting har skickats.');
      return;
    }
    if (source.some(member => text(member.email).toLowerCase() === address.toLowerCase() || member.id === address)) {
      notify(toast, runtime, 'Den adressen finns redan i listan. Ingenting har skickats.');
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
    if (!preview || !member?.id) return;
    setRoleOverrides(current => ({ ...current, [member.id]: nextRole }));
    notify(toast, runtime, 'Rollbyte sparat lokalt. Ingenting har skickats.');
  };

  return h(React.Fragment, null,
    h('header', { className: 'page-h' },
      h('div', { style: { display: 'grid', gap: 6 } },
        h('h1', null, preview ? 'Team & access' : 'Medlemskap'),
        h('div', { className: 'muted', style: { fontSize: 13, maxWidth: 720 } }, subtitle))),
    h('div', { className: 'page-b' },
      h('section', { className: 'panel', 'data-surface': surface || 'partner' },
        h('div', { className: 'panel-h' },
          h('div', { className: 'seg' }, [['members', 'Members'], ['roles', 'Roles & permissions']].map(([id, label]) =>
            h('button', { key: id, type: 'button', className: tab === id ? 'on' : '', onClick: () => setTab(id) }, label))),
          h('input', {
            className: 'input',
            placeholder: 'Search name or email',
            'aria-label': 'Search name or email',
            value: query,
            onChange: event => setQuery(event.target.value),
          })),
        tab === 'members'
          ? h('div', { className: 'scroll-x' },
            h('table', { className: 'tbl pl-tbl' },
              h('thead', null, h('tr', null, ['Medlemskap', 'Rollprofil', 'Operatör', 'Status'].map(label => h('th', { key: label }, label)))),
              h('tbody', null, shown.map((member, index) => {
                const role = roleOf(member);
                const selected = roleOverrides[member.id] || role.id;
                const name = text(member.name) || text(member.id) || '—';
                const userId = text(member.id);
                const revision = revisionText(member);
                const optionIds = new Set(choices.map(item => item.id));
                const options = optionIds.has(selected) || !selected ? choices : [...choices, { id: selected, label: role.label }];
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
                    'aria-label': `Rollprofil för ${name}`,
                    value: selected,
                    disabled: locked,
                    onChange: event => onRole(member, event.target.value),
                  }, options.map(item => h('option', { key: item.id, value: item.id }, item.label)))),
                  h('td', null, operatorName),
                  h('td', null, statusNode(member.status, preview)));
              }))))
          : h('div', { className: 'rows' }, catalogue.map(([name, description], index) =>
            h('div', { key: `${name}:${index}` }, h('b', null, name), h('span', null, description)))),
        h('form', { className: 'panel-h wrap', onSubmit: onInvite },
          h('div', { className: 'field' },
            h('label', { htmlFor: 'team-invite-email' }, 'E-post'),
            h('input', {
              id: 'team-invite-email',
              className: 'input',
              type: 'email',
              autoComplete: 'off',
              value: email,
              disabled: locked,
              onChange: event => setEmail(event.target.value),
            })),
          h('div', { className: 'field' },
            h('label', { htmlFor: 'team-invite-role' }, 'Rollprofil'),
            h('select', {
              id: 'team-invite-role',
              className: 'select',
              'aria-label': 'Rollprofil för inbjudan',
              value: selectedInviteRole,
              disabled: locked,
              onChange: event => setInviteRole(event.target.value),
            }, choices.map(item => h('option', { key: item.id, value: item.id }, item.label)))),
          h('button', { id: 'team-invite-submit', className: 'btn primary', type: 'submit', disabled: locked }, 'Bjud in')),
        h('div', { className: 'note' }, preview
          ? 'Rollerna är målbilden. Den aktuella förhandsvisningen kräver befintlig intern admininloggning; inga partnerkonton eller utökade rättigheter skapas här.'
          : 'Inbjudan och rollbyte ansluts i nästa steg'))));
}
