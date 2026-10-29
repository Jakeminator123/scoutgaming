'use client';
import React from 'react';
const h = React.createElement;
const revision = value => value === null || (Number.isSafeInteger(value) && value > 0);
// Två former: hela journalen (team.read + team.roles.assign) och publiceringshistoriken
// (`kind: 'publications'`, GET /journal?kind=publications, reports.read), där varje rad bara är
// {id, atMs, beforeRevision, afterRevision}, utan vem, hur eller ändringsinnehåll.
const FIELDS = {
  all: { text: ['id', 'actor', 'accessClass', 'action', 'resourceType', 'resourceId', 'requestId'], keep: ['id', 'atMs', 'actor', 'accessClass', 'action', 'resourceType', 'resourceId', 'beforeRevision', 'afterRevision', 'requestId'] },
  publications: { text: ['id'], keep: ['id', 'atMs', 'beforeRevision', 'afterRevision'] },
};
export function readPartnerJournal(payload, operatorId, kind = 'all') {
  const fields = FIELDS[kind];
  if (!fields || !payload || payload.operatorId !== operatorId || !Array.isArray(payload.entries) || payload.entries.length > 100
    || !(payload.nextCursor === null || (typeof payload.nextCursor === 'string' && payload.nextCursor.length < 2048))) return null;
  const entries = [];
  for (const row of payload.entries) {
    if (!row || !fields.text.every(key => typeof row[key] === 'string' && row[key].length <= 512)
      || !Number.isSafeInteger(row.atMs) || row.atMs < 0 || row.atMs > 8640000000000000 || !revision(row.beforeRevision) || !revision(row.afterRevision)) return null;
    entries.push(Object.fromEntries(fields.keep.map(key => [key, row[key]])));
  }
  return { operatorId, entries, nextCursor: payload.nextCursor };
}
export function createPartnerJournalClient({ base, operatorSlug, operatorId, kind = 'all', fetcher = (...args) => globalThis.fetch(...args) }) {
  return Object.freeze({ async read(cursor = null) {
    const query = new URLSearchParams({ operator: operatorSlug, limit: '25' });
    if (kind === 'publications') query.set('kind', 'publications');
    if (cursor !== null) query.set('cursor', cursor);
    try {
      const response = await fetcher(`${base}/journal?${query}`, { credentials: 'same-origin', cache: 'no-store', headers: { accept: 'application/json' } });
      const payload = await response.json().catch(() => null);
      return { status: response.status, journal: response.ok ? readPartnerJournal(payload, operatorId, kind) : null };
    } catch { return { status: 0, journal: null }; }
  } });
}
const ACTIONS = {
  'draft.save': ['Utkast sparat', 'Draft saved'], 'draft.restore': ['Version återställd till utkast', 'Version restored to draft'],
  'draft.publish': ['Utkast publicerat', 'Draft published'],
  'role.save': ['Roll sparad', 'Role saved'], 'membership.activate': ['Medlemskap aktiverat', 'Membership activated'], 'membership.compensate': ['Aktivering återställd', 'Activation reverted'],
  'operator.create': ['Bolag skapat', 'Company created'], 'operator.role.upsert': ['Roll ändrad', 'Role changed'],
  'role.upsert': ['Roll ändrad', 'Role changed'], 'membership.create': ['Medlem tillagd', 'Member added'],
  'membership.update': ['Medlemskap ändrat', 'Membership changed'], 'package.publish': ['Ny version publicerad', 'New version published'],
  'team.invite': ['Medlem inbjuden', 'Member invited'], 'team.role': ['Roll ändrad', 'Role changed'],
  'team.suspend': ['Medlem avstängd', 'Member suspended'], 'team.reactivate': ['Medlem återaktiverad', 'Member reactivated'],
};
// `kind: 'publications'` reads only the published versions (reports.read) and shows time and version.
export function PartnerJournal({ base, operatorSlug, operatorId, language = 'sv', version = 0, kind = 'all' }) {
  const en = language === 'en';
  const [open, setOpen] = React.useState(false);
  const [refresh, setRefresh] = React.useState(0);
  const [state, setState] = React.useState({ status: 'idle', entries: [], nextCursor: null });
  const request = React.useRef(0);
  const client = React.useMemo(() => createPartnerJournalClient({ base, operatorSlug, operatorId, kind }), [base, operatorSlug, operatorId, kind]);
  const publications = kind === 'publications';
  const load = React.useCallback(async (cursor = null) => {
    const serial = ++request.current;
    setState(previous => ({ ...previous, status: 'loading', ...(cursor === null ? { entries: [], nextCursor: null } : {}) }));
    const result = await client.read(cursor);
    if (request.current !== serial) return;
    if (!result.journal) { setState({ status: 'error', entries: [], nextCursor: null }); return; }
    setState(previous => ({ status: 'ready', nextCursor: result.journal.nextCursor,
      entries: cursor === null ? result.journal.entries : [...previous.entries, ...result.journal.entries.filter(row => !previous.entries.some(old => old.id === row.id))] }));
  }, [client]);
  React.useEffect(() => {
    if (open) void load();
    return () => { request.current += 1; };
  }, [open, load, version, refresh]);
  const title = publications ? (en ? 'Publications' : 'Publiceringar') : (en ? 'Change journal' : 'Ändringsjournal');
  const time = row => h('td', null, h('time', { dateTime: new Date(row.atMs).toISOString() }, new Date(row.atMs).toLocaleString(en ? 'en-GB' : 'sv-SE')));
  const versions = row => h('td', null, `${row.beforeRevision ?? '—'} → ${row.afterRevision ?? '—'}`);
  const columns = publications ? (en ? ['Time', 'Version'] : ['Tid', 'Version']) : (en ? ['Time', 'Actor', 'Change', 'Resource', 'Revision'] : ['Tid', 'Aktör', 'Ändring', 'Resurs', 'Revision']);
  const cells = row => publications ? [time(row), versions(row)] : [time(row),
    h('td', null, row.actor, h('small', { style: { display: 'block' } }, row.accessClass === 'internal-admin' ? (en ? 'Internal administrator' : 'Intern administratör') : row.accessClass)),
    h('td', null, ACTIONS[row.action]?.[en ? 1 : 0] || row.action),
    h('td', null, row.resourceId),
    versions(row)];
  return h('div', { className: 'stack' }, h('section', { className: 'card flat', 'aria-label': title },
    h('div', { className: 'card-head' }, h('h2', null, title),
      h('button', { type: 'button', className: 'btn small', 'aria-expanded': open, onClick: () => setOpen(value => !value) }, open ? (en ? 'Hide journal' : 'Dölj journal') : (en ? 'Show journal' : 'Visa journal')),
      open ? h('button', { type: 'button', className: 'btn small', disabled: state.status === 'loading', onClick: () => setRefresh(value => value + 1) }, en ? 'Refresh' : 'Uppdatera') : null),
    open ? h(React.Fragment, null,
      h('p', { className: 'note' }, publications
        ? (en ? 'When each version was published for the company. Logging starts when this feature is activated; older publications are not reconstructed.' : 'När varje version publicerades för bolaget. Loggningen börjar när funktionen aktiveras; äldre publiceringar återskapas inte.')
        : (en ? 'Saved changes for this operator. Logging starts when this feature is activated; older changes are not reconstructed.' : 'Bolagets journal. Loggningen börjar när funktionen aktiveras; äldre ändringar återskapas inte.')),
      state.status === 'error' ? h('p', { className: 'note', role: 'alert' }, en ? 'The journal could not be loaded. Access may have changed. Refresh to try again.' : 'Journalen kunde inte hämtas. Behörigheten kan ha ändrats. Uppdatera för att försöka igen.') : null,
      state.status === 'loading' ? h('p', { className: 'note', role: 'status' }, en ? 'Loading changes…' : 'Hämtar ändringar…') : null,
      state.status === 'ready' && state.entries.length === 0 ? h('p', { className: 'note' }, publications ? (en ? 'No recorded publications yet.' : 'Inga registrerade publiceringar ännu.') : (en ? 'No recorded changes yet.' : 'Inga registrerade ändringar ännu.')) : null,
      state.entries.length ? h('div', { className: 'scroll-x' }, h('table', { className: 'table' },
        h('thead', null, h('tr', null, columns.map(label => h('th', { key: label, scope: 'col' }, label)))),
        h('tbody', null, state.entries.map(row => h('tr', { key: row.id }, ...cells(row)))))) : null,
      state.nextCursor ? h('button', { type: 'button', className: 'btn', disabled: state.status === 'loading', onClick: () => void load(state.nextCursor) }, en ? 'Load older changes' : 'Hämta äldre ändringar') : null) : null));
}
