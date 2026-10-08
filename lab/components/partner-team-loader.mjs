'use client';

import React from 'react';
import { brandingApiBase } from './partner-appearance-loader.mjs';

const h = React.createElement;
const ids = value => Array.isArray(value) && value.every(item => typeof item === 'string');

// GET/POST /api/partner/team (lab/lib/partner-team-api.mjs). Anything else is not a team.
export function readPartnerTeam(payload) {
  if (!payload || typeof payload !== 'object' || typeof payload.operatorId !== 'string'
    || !Array.isArray(payload.roles) || !Array.isArray(payload.members) || !ids(payload.inviteRoles)) return null;
  const roleOk = role => typeof role?.id === 'string' && typeof role.label === 'string';
  const memberOk = member => typeof member?.userId === 'string' && typeof member.roleId === 'string'
    && typeof member.status === 'string' && Number.isSafeInteger(member.revision) && member.revision > 0
    && ids(member.allowed?.role);
  return payload.roles.every(roleOk) && payload.members.every(memberOk) ? payload : null;
}

// Kevin's TeamView reads members from snapshot.team. E-mail addresses are never listed.
export function partnerTeamSnapshot(snapshot, team) {
  const operatorId = snapshot.operator.id;
  return {
    ...snapshot,
    roles: team.roles.map(role => ({ id: role.id, label: role.label, operatorId })),
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

export function partnerTeamMessage(action, status, reason) {
  if (status === 200) return action === 'invite' ? 'Inbjudan är registrerad.' : 'Rollprofilen är sparad.';
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

// runtime.team for TeamView: which roles the viewer may hand out, and the two
// writes Kevin's view has controls for. Suspension stays in the API and in Kontrollpanelen.
export function createPartnerTeamAdapter({ team, client, notify, onTeam, guard = { busy: false } }) {
  const members = new Map(team.members.map(member => [member.userId, member]));
  const manages = Boolean(team.can?.invite || team.can?.role);
  async function refresh() {
    const fresh = await client.read();
    if (fresh.team) onTeam(fresh.team);
  }
  async function run(action, body) {
    if (guard.busy) { notify('Vänta, föregående ändring sparas.'); return false; }
    guard.busy = true;
    try {
      const result = await client.write(body);
      notify(partnerTeamMessage(action, result.status, result.reason));
      if (result.status === 200) {
        if (result.team) onTeam(result.team); else await refresh();
        return true;
      }
      if ([403, 404, 409].includes(result.status)) await refresh();
      return false;
    } finally { guard.busy = false; }
  }
  return Object.freeze({
    inviteRoles: Object.freeze([...team.inviteRoles]),
    note: manages
      ? 'En ny adress får ett aktiveringsmejl. Ett befintligt partnerkonto kopplas utan mejl. Administratörer och avstängning hanteras av intern personal.'
      : 'Du kan se teamet. Inbjudan och rollbyte kräver operatörsadministratör.',
    assignable: member => members.get(member?.id)?.allowed.role ?? [],
    invite: (email, roleId) => run('invite', { action: 'invite', email, roleId }),
    role: (member, roleId) => {
      const current = members.get(member?.id);
      if (!current) return Promise.resolve(false);
      return run('role', { action: 'role', userId: current.userId, roleId, expectedRevision: current.revision });
    },
  });
}

// Shows Kevin's read-only TeamView until the team API answers; any failure keeps it read-only.
export function PartnerTeamLoader({ snapshot, runtime, surface, toast, base, Team }) {
  const operatorId = snapshot?.operator?.id;
  const operatorSlug = snapshot?.operator?.slug;
  const [team, setTeam] = React.useState(null);
  const guard = React.useRef({ busy: false });
  const client = React.useMemo(() => createPartnerTeamClient({ base, operatorSlug }), [base, operatorSlug]);
  const accept = React.useCallback(next => { if (next?.operatorId === operatorId) setTeam(next); }, [operatorId]);
  React.useEffect(() => {
    let cancelled = false;
    void client.read().then(result => { if (!cancelled) accept(result.team); });
    return () => { cancelled = true; };
  }, [client, accept]);
  const notify = React.useCallback(message => {
    if (typeof toast === 'function') toast(message); else runtime?.notify?.(message);
  }, [toast, runtime]);
  const live = React.useMemo(() => team ? createPartnerTeamAdapter({ team, client, notify, onTeam: accept, guard: guard.current }) : null,
    [team, client, notify, accept]);
  if (!live) return h(Team, { snapshot, runtime, surface, toast });
  return h(Team, { snapshot: partnerTeamSnapshot(snapshot, team), runtime: { ...runtime, team: live }, surface, toast });
}

const views = new WeakMap();
// One stable component per Team and API base, so a re-render never remounts the view.
export function partnerTeamView(apiBase, Team) {
  const base = brandingApiBase(apiBase);
  if (!/^(?:\/studio)?\/api\/partner$/.test(base)) return Team;
  let byBase = views.get(Team);
  if (!byBase) views.set(Team, byBase = new Map());
  if (!byBase.has(base)) byBase.set(base, function PartnerTeamView(props) { return h(PartnerTeamLoader, { ...props, base, Team }); });
  return byBase.get(base);
}
