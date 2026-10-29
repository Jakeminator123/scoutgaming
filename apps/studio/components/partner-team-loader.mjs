'use client';

import React from 'react';
import { brandingApiBase } from './partner-appearance-loader.mjs';
import { PartnerJournal } from './partner-journal-loader.mjs';

const h = React.createElement;
const ids = value => Array.isArray(value) && value.every(item => typeof item === 'string');

// GET/POST /api/partner/team (lib/partner-team-api.mjs). Allt annat är inget team.
export function readPartnerTeam(payload) {
  if (!payload || typeof payload !== 'object' || typeof payload.operatorId !== 'string'
    || !Array.isArray(payload.roles) || !Array.isArray(payload.members) || !ids(payload.inviteRoles)) return null;
  const roleOk = role => typeof role?.id === 'string' && typeof role.label === 'string';
  const memberOk = member => typeof member?.userId === 'string' && typeof member.roleId === 'string'
    && typeof member.status === 'string' && Number.isSafeInteger(member.revision) && member.revision > 0
    && ids(member.allowed?.role);
  return payload.roles.every(roleOk) && payload.members.every(memberOk) ? payload : null;
}

// TeamView (components/partner/views/team.jsx) läser medlemmarna ur snapshot.team. E-postadresser listas aldrig.
export function partnerTeamSnapshot(snapshot, team) {
  const operatorId = snapshot.operator.id;
  return {
    ...snapshot,
    roles: team.roles.map(role => ({ id: role.id, label: role.label, operatorId, permissions: [...(role.permissions || [])], delegable: role.delegable === true })),
    team: team.members.map(member => ({
      id: member.userId,
      operatorId,
      name: member.username || member.userId,
      email: '',
      roleId: member.roleId,
      role: member.roleLabel || member.roleId,
      status: member.status,
      revision: member.revision,
    })),
  };
}

export function partnerTeamMessage(action, status, reason, language = 'sv') {
  if (language === 'en') {
    if (status === 200) return ({ invite: 'Invitation registered.', suspend: 'Member suspended.', reactivate: 'Member reactivated.' })[action] || 'Role saved.';
    if (status === 429) return 'Too many invitations this hour. Try again later.';
    if (status === 409) return reason === 'member' ? 'This account is already a member.' : reason === 'last-admin' ? 'The operator must retain an active administrator.' : 'Another person changed this membership. The list has been refreshed; try again.';
    if (status === 401) return 'Your session has expired. Sign in again.';
    if (status === 403) return 'You do not have permission for this change.';
    if (status === 404) return 'This member is no longer in the team.';
    if (status === 422) return action === 'invite' ? 'The invitation details could not be accepted.' : 'This role is unavailable.';
    return 'The change could not be saved. Try again.';
  }
  if (status === 200) return ({ invite: 'Inbjudan är registrerad.', suspend: 'Medlemmen är avstängd.', reactivate: 'Medlemmen är återaktiverad.' })[action] || 'Rollprofilen är sparad.';
  if (status === 429) return 'För många inbjudningar den här timmen. Försök igen om en stund.';
  if (status === 409) {
    if (reason === 'member') return 'Kontot är redan medlem i teamet.';
    if (reason === 'last-admin') return 'Ändringen skulle lämna operatören utan administratör.';
    return 'Medlemskapet ändrades av någon annan. Listan är uppdaterad; försök igen.';
  }
  if (status === 422) return action === 'invite' ? 'Det finns inget partnerkonto med den e-postadressen.' : 'Rollprofilen finns inte.';
  if (status === 403) return 'Du saknar behörighet för den ändringen.';
  if (status === 404) return 'Medlemmen finns inte längre i teamet.';
  if (status === 401) return 'Sessionen har gått ut. Logga in igen.';
  return 'Ändringen kunde inte sparas. Försök igen.';
}

export function createPartnerTeamClient({ base, operatorSlug, fetcher = (...args) => globalThis.fetch(...args) }) {
  const url = `${base}/team?operator=${encodeURIComponent(operatorSlug)}`;
  async function call(init, headers = {}) {
    let response;
    try {
      response = await fetcher(url, { credentials: 'same-origin', cache: 'no-store', ...init, headers: { accept: 'application/json', ...headers } });
    } catch { return { status: 0, team: null, reason: null }; }
    const payload = await response.json().catch(() => null);
    return {
      status: response.status,
      team: response.ok ? readPartnerTeam(payload) : null,
      reason: typeof payload?.reason === 'string' ? payload.reason : null,
    };
  }
  return Object.freeze({
    read: () => call({}),
    write: body => call({ method: 'POST', body: JSON.stringify(body) }, { 'content-type': 'application/json' }),
  });
}

// Only fresh server-authorized actions are exposed to the membership view.
export function createPartnerTeamAdapter({ team, client, notify, onTeam, guard = { busy: false }, onBusy = () => {}, language = 'sv' }) {
  const members = new Map(team.members.map(member => [member.userId, member]));
  const manages = Boolean(team.can?.invite || team.can?.role || team.can?.suspend);
  async function refresh(epoch) {
    const fresh = await client.read();
    if (guard.epoch === epoch) onTeam(fresh.team || null);
  }
  async function run(action, body) {
    if (guard.busy) { notify(language === 'en' ? 'Please wait for the previous change to finish.' : 'Vänta, föregående ändring sparas.'); return false; }
    guard.busy = true; onBusy(true);
    const epoch = guard.epoch = (guard.epoch || 0) + 1;
    try {
      const result = await client.write(body);
      if (guard.epoch !== epoch) return false;
      notify(partnerTeamMessage(action, result.status, result.reason, language));
      if (result.status === 200) {
        if (result.team) onTeam(result.team); else await refresh(epoch);
        return true;
      }
      if ([401, 403, 404].includes(result.status)) onTeam(null);
      if ([403, 404, 409].includes(result.status)) await refresh(epoch);
      return false;
    } finally { guard.busy = false; onBusy(false); }
  }
  return Object.freeze({
    inviteRoles: Object.freeze([...team.inviteRoles]),
    note: language === 'en'
      ? (manages ? 'New addresses receive an activation email. Existing partner accounts are linked without email. Only authorized actions are available.' : 'You can view the team. Changes require the relevant administrator permissions.')
      : (manages ? 'En ny adress får ett aktiveringsmejl. Ett befintligt partnerkonto kopplas utan mejl. Endast tillåtna åtgärder visas.' : 'Du kan se teamet. Ändringar kräver rätt administratörsbehörighet.'),
    assignable: member => members.get(member?.id)?.allowed.role ?? [],
    canSuspend: member => members.get(member?.id)?.allowed.suspend === true,
    canReactivate: member => members.get(member?.id)?.allowed.reactivate === true,
    status: (member, action) => {
      const current = members.get(member?.id);
      if (!current || !['suspend', 'reactivate'].includes(action) || current.allowed[action] !== true) return Promise.resolve(false);
      return run(action, { action, userId: current.userId, expectedRevision: current.revision });
    },
    invite: (email, roleId) => team.can?.invite === true && team.inviteRoles.includes(roleId) ? run('invite', { action: 'invite', email, roleId }) : Promise.resolve(false),
    role: (member, roleId) => {
      const current = members.get(member?.id);
      if (!current || !current.allowed.role.includes(roleId)) return Promise.resolve(false);
      return run('role', { action: 'role', userId: current.userId, roleId, expectedRevision: current.revision });
    },
  });
}

// Reauthorize the selected operator before enabling actions; failures clear prior grants.
export function PartnerTeamLoader({ snapshot, runtime, surface, toast, base, Team, language = 'sv' }) {
  const operatorId = snapshot?.operator?.id;
  const operatorSlug = snapshot?.operator?.slug;
  const [team, setTeam] = React.useState(null);
  const [state, setState] = React.useState('loading');
  const [busy, setBusy] = React.useState(false);
  const [journalVersion, setJournalVersion] = React.useState(0);
  const alive = React.useRef(true);
  const readSerial = React.useRef(0);
  const guard = React.useRef({ busy: false });
  const client = React.useMemo(() => createPartnerTeamClient({ base, operatorSlug }), [base, operatorSlug]);
  React.useEffect(() => { alive.current = true; return () => { alive.current = false; readSerial.current += 1; guard.current.epoch = (guard.current.epoch || 0) + 1; }; }, []);
  const accept = React.useCallback(next => {
    if (!alive.current) return;
    readSerial.current += 1;
    if (next?.operatorId === operatorId) { setTeam(next); setState('ready'); setJournalVersion(value => value + 1); }
    else { setTeam(null); setState('error'); }
  }, [operatorId]);
  const reload = React.useCallback(async () => {
    const serial = ++readSerial.current;
    guard.current.epoch = (guard.current.epoch || 0) + 1;
    setState('loading'); setTeam(null);
    const result = await client.read();
    if (alive.current && readSerial.current === serial) accept(result.team);
  }, [client, accept]);
  React.useEffect(() => { void reload(); }, [reload]);
  const notify = React.useCallback(message => {
    if (alive.current) { if (typeof toast === 'function') toast(message); else runtime?.notify?.(message); }
  }, [toast, runtime]);
  const current = team?.operatorId === operatorId ? team : null;
  const live = React.useMemo(() => current ? createPartnerTeamAdapter({ team: current, client, notify, onTeam: accept, guard: guard.current,
    onBusy: value => { if (alive.current) setBusy(value); }, language }) : null, [current, client, notify, accept, language]);
  const en = language === 'en';
  return h(React.Fragment, null,
    state !== 'ready' ? h('div', { className: 'note', role: state === 'error' ? 'alert' : 'status' },
      state === 'loading' ? (en ? 'Checking team access…' : 'Kontrollerar teamåtkomst…') : (en ? 'Team access could not be verified.' : 'Teamåtkomsten kunde inte verifieras.'),
      state === 'error' ? h('button', { type: 'button', className: 'btn sm', onClick: () => void reload() }, en ? 'Try again' : 'Försök igen') : null) : null,
    h(Team, { snapshot: live ? partnerTeamSnapshot(snapshot, current) : { ...snapshot, team: [], roles: [] }, runtime: { ...runtime, team: live, teamBusy: busy }, surface, toast, language }),
    live && current.can?.journal === true ? h(PartnerJournal, { key: operatorId, base, operatorSlug, operatorId, language, version: journalVersion }) : null);
}

const views = new WeakMap();
// One stable component per Team and API base, so a re-render never remounts the view.
export function partnerTeamView(apiBase, Team) {
  const base = brandingApiBase(apiBase);
  if (!/^(?:\/studio)?\/api\/partner$/.test(base)) return Team;
  let byBase = views.get(Team);
  if (!byBase) views.set(Team, byBase = new Map());
  if (!byBase.has(base)) byBase.set(base, function PartnerTeamView(props) { return h(PartnerTeamLoader, { ...props, key: props.snapshot?.operator?.id, base, Team }); });
  return byBase.get(base);
}
