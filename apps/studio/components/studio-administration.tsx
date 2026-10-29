'use client';
import {SharedTableProof} from './shared-table-proof';

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { SYSTEM_GROUPS, SYSTEM_SECTIONS } from '../lib/admin-system-sections.mjs';
import { studioAdminEndpoint } from '../lib/studio-admin-contract.mjs';
import { approvedPartnerLaunchUrl } from '../lib/partner-launch-url.mjs';
import { isStudioRole, normalizeStudioRole, meetsStudioAdminSectionRole, studioRoleMeetsMinimum, STUDIO_ROLES, type StudioRole } from '../lib/studio-access-policy.mjs';
import { labUrl } from '../lib/lab-url.mjs';
import { studioHistory } from '../lib/studio-history.mjs';
import { PageTemplate, publishShellStatus } from './page-template.mjs';
import { journalType, formatJournalAmount, readEconomyJournal } from '../client/admin/lib/economy-journal.mjs';
import styles from './studio-administration.module.css';

type JsonObject = Record<string, unknown>;
type Method = 'GET' | 'POST';
export type StudioAdminActor = { username: string; role: StudioRole };
export type StudioAdminApiBase = '/studio/api/admin' | '/api/admin';
export type StudioAdministrationProps = {
  apiBase: StudioAdminApiBase;
  /** Client adapter only. Server handlers remain responsible for full authorization. */
  session: () => Promise<unknown>;
  /** Exact activated handler keys, for example "GET players". Descriptors alone are not activation. */
  availableActions?: readonly string[];
  /** Explicit native response capability. Legacy/local adapters retain preflight. */
  readIdentity?: 'session-preflight' | 'response-headers-v1';
  fetchImpl?: typeof fetch;
  /** Explicit public game origin from server configuration, never request JSON. */
  gameOrigin?: string;
  /** Group id from ?tab=. Unknown values open Spelstatus & integritet. */
  initialGroup?: string;
  /** Connected operations UI bound to the freshly read actor. */
  renderOperations?: (actor: StudioAdminActor) => ReactNode;
  /** Explain a legacy team editor when this view is embedded in the new Admin. */
  companyTeamLabel?: string;
  /** Admin owns pathname navigation; standalone shells keep their local group tabs. */
  showGroupNavigation?: boolean;
  /** Only these sections of the group are read and shown; the enclosing page owns the heading. */
  sections?: readonly string[];
  /** A read shared with another view of the same page visit, used for the first load. */
  sharedRead?: SharedStudioAdminRead;
};
type Resource = { payload?: JsonObject; error?: StudioAdminUiError };
type Resources = Record<string, Resource>;
type Command = (action: string, body: JsonObject, form?: HTMLFormElement) => void;
export type StudioPartnerResult =
  | { kind: 'credentials'; id: string; key?: string; secret: string }
  | { kind: 'launch'; url: string; playerRef: string }
  | { kind: 'credit'; playerId: string; balance: number; currency: string };

const CONFIG_COMMANDS = new Set(['tier', 'game-lane', 'game-lanes/create', 'game-lanes/remove', 'clip-landing', 'clip-never', 'gen-landing', 'gen-verdict']);
const SECTION_READS: Record<string, readonly string[]> = {
  ops: ['overview'], shoes: ['shoes'], players: ['players'], users: ['users'],
  apikeys: ['apikeys'], emails: ['emails'], pay: ['transactions'],
};
const CURRENCIES = ['USD', 'EUR', 'SEK'];
const PLAYER_STATES = ['active', 'blocked', 'closed'];
const PARTNER_SCOPES = ['launch', 'play', 'wallet', 'history', 'lobby', 'events'];
const OPERATOR_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/;
const EMPTY_ACTIONS: readonly string[] = Object.freeze([]);
const ACTIVE_GROUPS = SYSTEM_GROUPS;
function visibleSections(group: string, only?: readonly string[]): readonly string[] {
  return ACTIVE_GROUPS.find(item => item.id === group)?.sections.filter(section => !only || only.includes(section)) ?? [];
}

function object(value: unknown): JsonObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : null;
}
function rows(value: unknown): JsonObject[] { return Array.isArray(value) ? value.map(object).filter((row): row is JsonObject => row !== null) : []; }
function label(value: unknown, fallback = '—'): string { return typeof value === 'string' && value.length > 0 ? value.slice(0, 500) : typeof value === 'number' && Number.isFinite(value) ? String(value) : fallback; }
function value(form: HTMLFormElement, name: string): string { return String(new FormData(form).get(name) ?? '').trim(); }
function validRevision(value: unknown): value is string { return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(value); }
function accountRole(value: unknown): string { return normalizeStudioRole(value) === 'admin' ? 'Administratör' : 'Spelare'; }
function sameIdentity(left: unknown, right: string): boolean { return typeof left === 'string' && left.trim().toLowerCase() === right.trim().toLowerCase(); }
function playerState(value: unknown): string { return value === 'active' ? 'Aktivt' : value === 'blocked' ? 'Blockerat' : value === 'closed' ? 'Stängt' : label(value); }
const journalDate = new Intl.DateTimeFormat('sv-SE', { timeZone:'UTC', year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit' });
function AdminTime({value, empty='Ej registrerat'}:{value:unknown;empty?:string}) {
  if (typeof value !== 'string' || !value) return <span>{empty}</span>;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? <time dateTime={date.toISOString()} title={value}>{journalDate.format(date)} UTC</time> : <span>{label(value)}</span>;
}
function TransactionJournal({payload}:{payload:JsonObject}) {
  let journal: ReturnType<typeof readEconomyJournal>;
  try { journal = readEconomyJournal(payload); }
  catch { return <p role="alert" className={styles.error}>Journalposterna kunde inte visas säkert. Ladda om från servern och försök igen.</p>; }
  if (!journal.length) return <p className={styles.notice}>Inga journalposter har registrerats.</p>;
  const sourceRows = rows(payload.tx);
  return <><p className={styles.notice}>Serverns senaste {journal.length} journalposter. Beloppen visas i postens valuta. Tider anges i UTC.</p>
    <div className={styles.tableWrap} role="region" aria-label="Betalningsjournal" tabIndex={0}><table className={styles.journal}>
      <thead><tr><th scope="col">Tid · UTC</th><th scope="col">Händelse</th><th scope="col" className={styles.amount}>Belopp</th><th scope="col">Referenser</th></tr></thead>
      <tbody>{journal.map(tx => <tr key={tx.key}>
        <td><AdminTime value={tx.at}/></td><td>{journalType(tx.type)}</td>
        <td className={styles.amount}><strong>{formatJournalAmount(tx.amount,tx.currency)}</strong><small>{tx.currency}</small></td>
        <td><details className={styles.disclosure}><summary>Visa detaljer</summary><dl className={styles.technicalDetails}>
          <div><dt>Spelar-ID</dt><dd><code>{tx.playerId || 'Ej angivet'}</code></dd></div>
          <div><dt>Händelsetyp</dt><dd><code>{tx.type}</code></dd></div>
          <div><dt>Serverns tid</dt><dd><code>{label(sourceRows[Number(tx.key)]?.at)}</code></dd></div>
        </dl></details></td>
      </tr>)}</tbody>
    </table></div><p className={styles.notice}>Journalen ändrar inte saldo eller historik. Öppningssaldo och valutabyte visar ett saldo; de är inte insättningar.</p></>;
}

export function studioAdminActor(value: unknown): StudioAdminActor | null {
  const actor = object(value);
  if (!actor || !Object.hasOwn(actor, 'username') || !Object.hasOwn(actor, 'role') || typeof actor.username !== 'string' || !actor.username.trim() || actor.username.length > 254 || /[\u0000-\u001f\u007f-\u009f]/.test(actor.username) || !isStudioRole(actor.role)) return null;
  return { username: actor.username, role: normalizeStudioRole(actor.role) as StudioRole };
}

// Nyckel→bolag (docs/plans/NYCKEL-BOLAG.md): the fixed codes apikeys/create answers with, in words.
// Only these codes are read from a refusal body; any other server text is never shown.
const KEY_REFUSALS: Record<string, string> = {
  partner_key_operator_schema_pending: 'Nyckeln skapades inte: databasen saknar ännu kopplingen mellan nyckel och bolag (spelmigrering 012). Nycklar kan skapas när Scoutgaming har lagt in den.',
  partner_key_operator_invalid: 'Nyckeln skapades inte: bolaget finns inte eller är avstängt. Välj ett aktivt bolag och försök igen.',
};
export class StudioAdminUiError extends Error {
  readonly status: number;
  readonly code?: string;
  constructor(status: number, code?: string) {
    const messages: Record<number, string> = {
      400: 'Servern avvisade uppgifterna. Kontrollera fälten och försök igen.',
      401: 'Sessionen är avslutad. Logga in igen och ladda om.',
      403: 'Behörigheten saknas eller har ändrats. Ladda om din session.',
      404: 'Funktionen är ännu inte ansluten till den här administrationsytan.',
      409: 'Uppgifterna har ändrats eller åtgärden krockar med ett pågående spel. Ladda om och kontrollera innan du försöker igen.',
      422: 'Servern avvisade uppgifterna. Kontrollera fälten och försök igen.',
      501: 'Funktionen är ännu inte ansluten till den här administrationsytan.',
      503: 'Tjänsten är tillfälligt otillgänglig. Inga lokala ersättningsdata används.',
    };
    const known = typeof code === 'string' && Object.hasOwn(KEY_REFUSALS, code) ? code : undefined;
    super(known ? KEY_REFUSALS[known] : messages[status] ?? 'Åtgärden kunde inte bekräftas av servern. Ladda om innan du försöker igen.');
    this.name = 'StudioAdminUiError';
    this.status = status;
    if (known) this.code = known;
  }
}
/** The fixed refusal code of a failed apikeys/create, when it is one Admin explains; never other text. */
async function keyRefusal(method: Method, action: string, response: Response): Promise<string | undefined> {
  if (method !== 'POST' || action !== 'apikeys/create' || ![422, 503].includes(response.status)) return undefined;
  try {
    const body = object(await response.json());
    return typeof body?.code === 'string' && Object.hasOwn(KEY_REFUSALS, body.code) ? body.code : undefined;
  } catch { return undefined; }
}

// Notices after an acknowledged write, keyed so the page can mark which one it shows (data-notice). The
// unrefreshed one is the guard against a second write: the server took the first, but the data is not re-read.
const WRITE_NOTICES = {
  acknowledged: 'Servern bekräftade åtgärden. Tillgänglig serverdata har lästs om.',
  'acknowledged-unrefreshed': 'Servern bekräftade åtgärden, men serverdata kunde inte läsas om helt. Skicka inte samma åtgärd igen; ladda om och kontrollera resultatet först.',
  'email-not-sent': 'Servern bekräftade åtgärden, men mejlet skickades inte. Ingen inbjudningslänk eller hemlighet visas här.',
  'invite-sent': 'Inbjudan till Scoutgamings personal har skickats för leverans. Kontot ger tillgång till Admin, Partnerportalen och spelet; bolagsåtkomst följer tilldelade medlemskap. Mottagaren aktiverar kontot genom att välja eget lösenord via mejlet.',
  'resend-sent': 'Aktiverings-/återställningsmejlet har skickats för leverans. Be mottagaren kontrollera inkorgen och skräpposten.',
} as const;
const writeNoticeKind = (notice: string) => (Object.keys(WRITE_NOTICES) as (keyof typeof WRITE_NOTICES)[]).find(kind => WRITE_NOTICES[kind] === notice);

function uiError(error: unknown): StudioAdminUiError { return error instanceof StudioAdminUiError ? error : new StudioAdminUiError(503); }
function aborted(signal?: AbortSignal) { if (signal?.aborted) throw new DOMException('Aborted', 'AbortError'); }

/** UI transport, NOT session/Origin/CSRF/CAS authorization. No route is activated by this helper. */
export function createStudioAdminClient({ apiBase, session, availableActions = EMPTY_ACTIONS, fetchImpl = fetch, gameOrigin, readIdentity = 'session-preflight' }: StudioAdministrationProps) {
  const baseIsValid = apiBase === '/studio/api/admin' || apiBase === '/api/admin';
  const activated = new Set(availableActions);
  async function identity(): Promise<StudioAdminActor> {
    let result: unknown;
    try { result = await session(); } catch { throw new StudioAdminUiError(401); }
    const actor = studioAdminActor(result);
    if (!actor) throw new StudioAdminUiError(401);
    return actor;
  }
  function available(method: unknown, action: unknown) {
    return baseIsValid && typeof action === 'string' && Boolean(studioAdminEndpoint(method, `/studio/api/admin/${action}`)) && activated.has(`${method} ${action}`);
  }
  function responseActor(response: Response): StudioAdminActor {
    const encoded = response.headers.get('X-Croupier-Studio-Actor'), role = response.headers.get('X-Croupier-Studio-Role');
    let username: string;
    try {
      if (!encoded || encoded.length > 254 * 12) throw new Error();
      username = decodeURIComponent(encoded);
      if (encodeURIComponent(username) !== encoded) throw new Error();
    } catch { throw new StudioAdminUiError(403); }
    const actor = studioAdminActor({ username, role });
    if (!actor || role !== actor.role) throw new StudioAdminUiError(403);
    return actor;
  }
  async function request(method: Method, action: string, body?: JsonObject, signal?: AbortSignal, expectedActor?: StudioAdminActor, query?: Record<string,string>) {
    const descriptor = typeof action === 'string' ? studioAdminEndpoint(method, `/studio/api/admin/${action}`) : null;
    if (!baseIsValid || !descriptor || !['session-preflight', 'response-headers-v1'].includes(readIdentity) || (method !== 'GET' && method !== 'POST') || (method === 'GET' && body !== undefined)) throw new StudioAdminUiError(400);
    if (query !== undefined && (method!=='GET'||action!=='shared-table-proof'||!object(query)||!query.roomId
      || Object.keys(query).some(key=>!['roomId','shoeId'].includes(key))||Object.values(query).some(value=>typeof value!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value))))throw new StudioAdminUiError(400);
    if (!available(method, action)) throw new StudioAdminUiError(501);
    aborted(signal);
    const preflightActor = method === 'GET' && readIdentity === 'response-headers-v1' ? null : await identity();
    aborted(signal);
    if (preflightActor && !studioRoleMeetsMinimum(preflightActor.role, descriptor.minimumRole)) throw new StudioAdminUiError(403);
    if (preflightActor && expectedActor && (preflightActor.username !== expectedActor.username || preflightActor.role !== expectedActor.role)) throw new StudioAdminUiError(403);
    if (method === 'POST') {
      if (!preflightActor) throw new StudioAdminUiError(401);
      if (!object(body)) throw new StudioAdminUiError(400);
      if (CONFIG_COMMANDS.has(action) && !validRevision(body?.expectedRevision)) throw new StudioAdminUiError(409);
      if ((action === 'users/remove' || action === 'users/role') && sameIdentity(body?.username, preflightActor.username)) throw new StudioAdminUiError(403);
      if (action === 'users/role' && !isStudioRole(body?.role)) throw new StudioAdminUiError(400);
      if (action === 'players/status' && !PLAYER_STATES.includes(String(body?.status))) throw new StudioAdminUiError(400);
    }
    const response = await send(method, action, body, signal, query);
    if (!response.ok) throw new StudioAdminUiError(response.status, await keyRefusal(method, action, response));
    const actor = preflightActor ?? responseActor(response);
    if (!studioRoleMeetsMinimum(actor.role, descriptor.minimumRole)
      || (method === 'GET' && expectedActor && (actor.username !== expectedActor.username || actor.role !== expectedActor.role))) throw new StudioAdminUiError(403);
    return readPayload(method, action, response, actor, signal);
  }
  async function send(method: Method, action: string, body?: JsonObject, signal?: AbortSignal, query?:Record<string,string>) {
    let response: Response;
    try {
      response = await fetchImpl(`${apiBase}/${action}${query?'?'+new URLSearchParams(query):''}`, {
        method, credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal,
        headers: { Accept: 'application/json', ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}) },
        ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
      });
    } catch (error) { aborted(signal); throw uiError(error); }
    aborted(signal);
    return response;
  }
  async function readPayload(method: Method, action: string, response: Response, actor: StudioAdminActor, signal?: AbortSignal) {
    aborted(signal);
    let payload: JsonObject | null;
    try { payload = object(await response.json()); } catch { throw new StudioAdminUiError(503); }
    aborted(signal);
    if (!payload || payload.ok === false || typeof payload.error === 'string') throw new StudioAdminUiError(400);
    if (action === 'moving-drift') {
      if (payload.schemaVersion !== 1 || !Number.isSafeInteger(payload.revision)) throw new StudioAdminUiError(503);
      return { actor, payload };
    }
    if (method === 'POST') {
      if (payload.ok !== true) throw new StudioAdminUiError(503);
      // Explicit one-time partner values are isolated from lists/resources. Invite
      // links, curl snippets, arbitrary server text and other fields never persist.
      const oneTime = studioPartnerResult(action, payload, gameOrigin);
      return { actor, payload: { ok: true, ...(typeof payload.emailSent === 'boolean' ? { emailSent: payload.emailSent } : {}), ...(oneTime ? { oneTime } : {}) } };
    }
    if (action === 'apikeys') {
      if (!Array.isArray(payload.keys)) throw new StudioAdminUiError(503);
      payload = { keys: partnerMetadata(payload.keys), operators: keyOperators(payload.operators),
        operatorBinding: payload.operatorBinding === 'ready' || payload.operatorBinding === 'pending' ? payload.operatorBinding : 'unknown' };
    }
    const listField = { players: 'players', users: 'users', transactions: 'tx' }[action as 'players' | 'users' | 'transactions'];
    if (listField && !Array.isArray(payload[listField])) throw new StudioAdminUiError(503);
    return { actor, payload };
  }
  async function readGroup(actions: readonly string[], signal?: AbortSignal) {
    if (!baseIsValid || readIdentity !== 'response-headers-v1') throw new StudioAdminUiError(400);
    // Fetch headers in parallel. No response body is read until every successful
    // response identifies the same freshly authorized actor and role.
    const responses = await Promise.all(actions.map(async action => {
      try {
        const descriptor = studioAdminEndpoint('GET', `/studio/api/admin/${action}`);
        if (!descriptor) throw new StudioAdminUiError(400);
        if (!available('GET', action)) throw new StudioAdminUiError(501);
        aborted(signal);
        const response = await send('GET', action, undefined, signal);
        if (!response.ok) throw new StudioAdminUiError(response.status);
        const actor = responseActor(response);
        if (!studioRoleMeetsMinimum(actor.role, descriptor.minimumRole)) throw new StudioAdminUiError(403);
        return { action, response, actor };
      } catch (error) {
        aborted(signal);
        const failure = uiError(error);
        if (failure.status !== 501 && failure.status !== 503) throw failure;
        return { action, error: failure };
      }
    }));
    aborted(signal);
    const first = responses.find(result => 'actor' in result);
    if (!first?.actor) throw responses.find(result => result.error)?.error ?? new StudioAdminUiError(503);
    const actor = first.actor;
    if (responses.some(result => result.actor && (result.actor.username !== actor.username || result.actor.role !== actor.role))) throw new StudioAdminUiError(403);
    const results = await Promise.all(responses.map(async result => {
      if (!result.response) return { action: result.action, error: result.error! };
      try { return { action: result.action, ...await readPayload('GET', result.action, result.response, actor, signal) }; }
      catch (error) {
        aborted(signal);
        const failure = uiError(error);
        if (failure.status !== 501 && failure.status !== 503) throw failure;
        return { action: result.action, error: failure };
      }
    }));
    aborted(signal);
    if (!results.some(result => 'payload' in result)) throw results.find(result => result.error)?.error ?? new StudioAdminUiError(503);
    return { actor, results };
  }
  return { identity, available, request, readGroup };
}

export type StudioAdminGroupRead = Awaited<ReturnType<ReturnType<typeof createStudioAdminClient>['readGroup']>>;
export type SharedStudioAdminRead = {
  readonly actions: readonly string[];
  read: (client: Pick<ReturnType<typeof createStudioAdminClient>, 'readGroup'>) => Promise<StudioAdminGroupRead>;
  refresh: () => void;
};
/** One identity-checked group read for several views of one page visit (Ekonomi's tabs).
 * It carries no view's abort signal, so one view leaving cannot cancel another's data. */
export function sharedStudioAdminRead(actions: readonly string[]): SharedStudioAdminRead {
  let current: Promise<StudioAdminGroupRead> | null = null;
  return Object.freeze({
    actions: Object.freeze([...actions]),
    read(client: Pick<ReturnType<typeof createStudioAdminClient>, 'readGroup'>) {
      if (current) return current;
      const pending = client.readGroup(actions);
      current = pending;
      // A failed read is never reused; the next view or retry reads again.
      pending.catch(() => { if (current === pending) current = null; });
      return pending;
    },
    refresh() { current = null; },
  });
}

export function studioPartnerResult(action: string, payload: JsonObject, gameOrigin?: string): StudioPartnerResult | null {
  const clean = (value: unknown, max: number): value is string => typeof value === 'string' && value.length > 0 && value.length <= max && !/[\u0000-\u001f\u007f-\u009f]/.test(value);
  if (action === 'apikeys/create' || action === 'apikeys/rotate') {
    const values = action === 'apikeys/create' ? object(payload.key) : payload;
    if (!values || !clean(values.id, 256) || typeof values.secret !== 'string' || !/^cs_[A-Za-z0-9_-]{43}$/.test(values.secret)
      || action === 'apikeys/create' && (typeof values.key !== 'string' || !/^ck_live_[A-Za-z0-9_-]{24}$/.test(values.key))) throw new StudioAdminUiError(503);
    return { kind: 'credentials', id: values.id, secret: values.secret, ...(action === 'apikeys/create' ? { key: values.key as string } : {}) };
  }
  if (action === 'apikeys/launch') {
    // The same launch-address rule as the Demo-builder (lib/partner-launch-url.mjs).
    const url = approvedPartnerLaunchUrl(payload.url, gameOrigin);
    if (!url || !clean(payload.playerRef,256)) throw new StudioAdminUiError(503);
    return { kind: 'launch', url: url.href, playerRef: payload.playerRef };
  }
  if (action === 'apikeys/credit') {
    if (!clean(payload.playerId,256) || typeof payload.balance !== 'number' || !Number.isFinite(payload.balance) || payload.balance < 0
      || !CURRENCIES.includes(String(payload.currency))) throw new StudioAdminUiError(503);
    return { kind: 'credit', playerId: payload.playerId, balance: payload.balance, currency: payload.currency as string };
  }
  return null;
}

/** Whitelist metadata before it enters component state; masked/raw key fields are both omitted. */
export function partnerMetadata(value: unknown): JsonObject[] {
  return rows(value).map(row => ({
    id: label(row.id, ''), name: label(row.name),
    scopes: Array.isArray(row.scopes) ? row.scopes.filter(scope => typeof scope === 'string' && PARTNER_SCOPES.includes(scope)) : [],
    walletConfigured: typeof row.wallet_configured === 'boolean' ? row.wallet_configured : typeof row.wallet_url === 'string' && row.wallet_url.length > 0,
    created_at: label(row.created_at), last_used: label(row.last_used), revoked_at: row.revoked_at ? label(row.revoked_at) : null,
    // Nyckel→bolag: the key's company, or null for a key from before game migration 012.
    operatorId: typeof row.operatorId === 'string' && OPERATOR_ID.test(row.operatorId) ? row.operatorId : null,
    operatorName: typeof row.operatorName === 'string' && row.operatorName.trim() ? label(row.operatorName) : null,
  }));
}
/** The companies a new key can belong to, as the server listed them for this scope. */
export function keyOperators(value: unknown): JsonObject[] {
  return rows(value).filter(row => typeof row.id === 'string' && OPERATOR_ID.test(row.id))
    .map(row => ({ id: row.id as string, name: label(row.name, row.id as string), active: row.status === 'active' }));
}

type AdministrationViewProps = {
  actor: StudioAdminActor; group: string; resources: Resources; busy: boolean;
  available: (method: Method, action: string) => boolean; command: Command;
  onDirty?: (form: HTMLFormElement) => void;
  onReload?: () => void;
  sections?: readonly string[];
};

function ResourceNotice({ resource, onReload, reloadLabel }: { resource?: Resource; onReload?: () => void; reloadLabel: string }) {
  if (resource?.error) return <p className={styles.notice} role="status">{resource.error.message}</p>;
  if (!resource?.payload) return <p className={styles.notice}><button type="button" className="sg-btn sg-btn-secondary" onClick={() => onReload?.()}>{reloadLabel}</button></p>;
  return null;
}
function EmptyRows({ count }: { count: number }) { return count ? null : <p>Servern returnerade inga poster.</p>; }

/** Pure presentation export also allows isolated render/role tests without a live server. */
export function StudioAdministrationView({ actor, group, resources, busy, available, command, onDirty, onReload, sections: only }: AdministrationViewProps) {
  if (!studioAdminActor(actor) || !ACTIVE_GROUPS.some(item => item.id === group)) return <p role="alert">Okänd session eller administrationsgrupp.</p>;
  function mayWrite(action: string) {
    const descriptor = studioAdminEndpoint('POST', `/studio/api/admin/${action}`);
    return Boolean(descriptor && studioRoleMeetsMinimum(actor.role, descriptor.minimumRole) && available('POST', action));
  }
  function submit(action: string, build: (form: HTMLFormElement) => JsonObject) {
    return (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (busy || !mayWrite(action)) return;
      const form = event.currentTarget;
      command(action, build(form), form);
    };
  }
  function passwordSubmit(playerId: unknown) {
    return (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget, fields = new FormData(form);
      const password = String(fields.get('password') ?? ''), confirmation = String(fields.get('confirm') ?? '');
      for (const name of ['password', 'confirm']) {
        const field = form.elements.namedItem(name);
        if (field instanceof HTMLInputElement) field.value = '';
      }
      if (busy || !mayWrite('players/password')) return;
      const confirmField = form.elements.namedItem('confirm');
      if (password !== confirmation) {
        if (confirmField instanceof HTMLInputElement) { confirmField.setCustomValidity('Lösenorden stämmer inte överens. Ange dem igen.'); confirmField.reportValidity(); }
        return;
      }
      command('players/password', { playerId, password, reason: String(fields.get('reason') ?? '').trim() }, form);
    };
  }
  function unavailableWrite(action: string) {
    const descriptor = studioAdminEndpoint('POST', `/studio/api/admin/${action}`);
    return descriptor && studioRoleMeetsMinimum(actor.role, descriptor.minimumRole) && !available('POST', action) ? <p className={styles.notice}>Ändringen {action} är ännu inte ansluten. Ingen åtgärd skickas.</p> : null;
  }
  const overview = resources.overview?.payload;
  // Nyckel→bolag: a new key needs an active company, and the database column from game migration 012.
  const keyPayload = resources.apikeys?.payload, keyCompanies = rows(keyPayload?.operators).filter(company => company.active === true);
  const keyCreation = { companies: keyCompanies,
    blocker: keyPayload?.operatorBinding === 'pending' ? 'Nya nycklar kan skapas när databasen har fått kopplingen mellan nyckel och bolag (spelmigrering 012). Till dess visas befintliga nycklar utan bolag.'
      : !keyCompanies.length ? 'Det finns inget aktivt bolag att knyta en nyckel till. Skapa eller aktivera bolaget under Bolag och spelbord först.' : '' };
  const sections = visibleSections(group, only).filter(section => meetsStudioAdminSectionRole(actor.role, section));
  function missing(resource: Resource | undefined, kind: string) {
    const reloadLabel = kind === 'players' ? 'Hämta spelarkonton' : kind === 'users' ? 'Hämta konton' : 'Hämta serverdata';
    return <ResourceNotice resource={resource} onReload={onReload} reloadLabel={reloadLabel} />;
  }
  return <div className={styles.sections} onInput={event => { const target = event.target; if (target instanceof HTMLElement) { const form = target.closest('form'); if (form instanceof HTMLFormElement) onDirty?.(form); } }}>
    {sections.map(section => <section key={section} data-admin-section={section} className={styles.section} aria-labelledby={`admin-${section}`}>
      <h3 id={`admin-${section}`}>{SYSTEM_SECTIONS.find(item => item.id === section)?.label}</h3>
      {section === 'ops' && <>
        {missing(resources.overview, 'overview')}
        {overview && <><dl className={styles.metrics}>
          <div><dt>Spelare</dt><dd>{label(overview.players)}</dd></div>
          <div><dt>Rum</dt><dd>{Array.isArray(overview.rooms) ? overview.rooms.length : '—'}</dd></div>
        </dl><p className={styles.notice}>Senast hämtade uppgifter.</p></>}
      </>}
      {section === 'shoes' && <>
        {missing(resources.shoes, 'shoes')}
        {resources.shoes?.payload && <><dl className={styles.metrics}>
          <div><dt>Sparade bord</dt><dd>{label(resources.shoes.payload.tableCount)}</dd></div>
          <div><dt>Shoes / pågående rundor</dt><dd>{label(resources.shoes.payload.shoes)} / {label(resources.shoes.payload.activeRounds)}</dd></div>
          <div><dt>Cut card nådd</dt><dd>{label(resources.shoes.payload.cutReached)}</dd></div>
          <div><dt>Kortlekar / kort</dt><dd>{label(object(resources.shoes.payload.rules)?.decks)} / {label(object(resources.shoes.payload.rules)?.total)}</dd></div>
        </dl><details className={styles.disclosure}><summary>Spelregler och status</summary><p>Cut card efter {label(object(resources.shoes.payload.rules)?.cutAfter)} dragna kort; {label(object(resources.shoes.payload.rules)?.burn)} bränt kort. Shuffle sker mellan rundor när cut card nåtts.</p>
          <p>Sparad spelmotorstatus: {label(resources.shoes.payload.observedAt)}.{resources.shoes.payload.partial === true ? ` Visar ${label(resources.shoes.payload.sampledTables)} av ${label(resources.shoes.payload.tableCount)} bord.` : ''}</p>
          <p data-certification="missing">Certifieringsunderlag: saknas.</p></details>
        </>}
      </>}
      {section === 'players' && <>
        <p>Spelarkonton ger tillgång till lobbyn och spelen. För åtkomst till Admin använder du Bjud in personal till Admin under Användare och roller. Stängning bevarar saldo och journal; kontot hårdraderas inte.</p>
        {missing(resources.players, 'players')}
        {unavailableWrite('players/create')}{unavailableWrite('players/status')}{unavailableWrite('players/password')}
        {resources.players?.payload && <><EmptyRows count={rows(resources.players.payload.players).length} /><div className={styles.tableWrap}><table>
          <thead><tr><th scope="col">Spelare</th><th scope="col">Saldo</th><th scope="col">Status</th><th scope="col">Åtgärd</th></tr></thead>
          <tbody>{rows(resources.players.payload.players).map((player, index) => <tr key={label(player.id, String(index))}>
            <td><strong>{label(player.username, label(player.name))}</strong><details className={styles.disclosure}><summary>Spelar-ID</summary><code>{label(player.id)}</code></details></td><td className={styles.amount}>{label(player.balance)} {label(player.currency)}</td><td><span className={styles.status}>{playerState(player.status)}</span></td>
            <td><details className={styles.disclosure}><summary>Hantera konto</summary>{mayWrite('players/status') && resources.players.payload?.administration === true && ['active', 'blocked'].includes(String(player.status)) ? <form method="post" onSubmit={submit('players/status', form => ({ playerId: player.id, status: value(form, 'status'), reason: value(form, 'reason') }))}>
              <label>Ny status<select name="status" defaultValue={player.status === 'active' ? 'blocked' : 'active'} disabled={busy}>
                <option value={player.status === 'active' ? 'blocked' : 'active'}>{player.status === 'active' ? 'Blockerat' : 'Aktivt'}</option><option value="closed">Stängt (slutgiltigt)</option>
              </select></label><label>Orsak<input name="reason" required maxLength={500} disabled={busy} /></label><button disabled={busy}>Ändra spelarstatus</button>
            </form> : player.status === 'closed' ? 'Stängt konto – ingen återöppning' : 'Läsning'}
              {mayWrite('players/password') && resources.players.payload?.administration === true && player.passwordChangeAllowed === true && ['active', 'blocked'].includes(String(player.status)) && <details>
                <summary>Ändra lösenord</summary><form method="post" onSubmit={passwordSubmit(player.id)} autoComplete="off">
                  <label>Nytt lösenord (12–128 tecken)<input name="password" type="password" minLength={12} maxLength={128} required autoComplete="new-password" disabled={busy} /></label>
                  <label>Upprepa lösenordet<input name="confirm" type="password" minLength={12} maxLength={128} required autoComplete="new-password" disabled={busy} onInput={event => event.currentTarget.setCustomValidity('')} /></label>
                  <label>Orsak<input name="reason" maxLength={500} required disabled={busy} /></label>
                  <p>Spelarens befintliga sessioner avslutas. Saldo och spelhistorik bevaras.</p><button disabled={busy}>Spara nytt lösenord</button>
                </form>
              </details>}
            </details></td>
          </tr>)}</tbody>
        </table></div></>}
        {resources.players?.payload?.administration === false && <p className={styles.notice}>Spelarkontonas lagring stödjer inte administration här.</p>}
        {mayWrite('players/create') && resources.players?.payload?.administration === true && <details className={styles.disclosure}><summary>Skapa spelarkonto</summary><p>Det här kontot kan logga in i Blackjack. Det ger ingen administratörsbehörighet eller Studioåtkomst.</p><form method="post" className={styles.form} onSubmit={submit('players/create', form => {
          const password = String(new FormData(form).get('password') ?? '');
          const input = form.elements.namedItem('password');
          if (input instanceof HTMLInputElement) input.value = '';
          return { username: value(form, 'username'), name: value(form, 'name'), password, currency: value(form, 'currency'), reason: value(form, 'reason') };
        })} autoComplete="off">
          <label>Inloggningsnamn<input name="username" pattern="[a-z0-9][a-z0-9._-]{2,31}" minLength={3} maxLength={32} required autoComplete="off" disabled={busy} /></label>
          <label>Visningsnamn<input name="name" maxLength={40} required disabled={busy} /></label>
          <label>Lösenord (12–128 tecken)<input name="password" type="password" minLength={12} maxLength={128} required autoComplete="new-password" disabled={busy} /></label>
          <label>Valuta<select name="currency" disabled={busy}>{CURRENCIES.map(currency => <option key={currency}>{currency}</option>)}</select></label>
          <label>Orsak<input name="reason" maxLength={500} required disabled={busy} /></label><button disabled={busy}>Skapa spelarkonto</button>
        </form></details>}
      </>}
      {section === 'users' && <>
        <p>Scoutgamings personal bjuds in med e-post. Behörigheten omfattar Admin, Partnerportalen (bolagens arbetsytor) och spelet (lobbyn och spelen). Mottagaren väljer eget lösenord via aktiveringslänken och använder sedan samma konto och lösenord överallt. Bolagsåtkomst följer tilldelade medlemskap.</p>
        {missing(resources.users, 'users')}
        {!available('POST', 'users/invite') && <p className={styles.notice} role="status">E-post för Admin behöver konfigureras innan inbjudningar kan skickas. Att skapa ett spelarkonto ger inte åtkomst till Admin.</p>}
        {['users/role', 'users/remove'].map(action => <div key={action}>{unavailableWrite(action)}</div>)}
        {resources.users?.payload && <><EmptyRows count={rows(resources.users.payload.users).length} />{rows(resources.users.payload.users).map((user, index) => <div className={styles.row} key={label(user.username, String(index))}>
          <div><strong>{label(user.username)}</strong><p>{accountRole(user.role)} · {user.active ? 'aktiverat' : 'väntar på aktivering'}</p></div>
          {sameIdentity(user.username, actor.username) ? <p>Ditt eget konto: rollbyte och borttagning är spärrade.</p> : <div className={styles.actions}>
            {mayWrite('users/role') && <form method="post" onSubmit={submit('users/role', form => ({ username: user.username, role: value(form, 'role') }))}><label>Ny roll<select name="role" defaultValue={normalizeStudioRole(user.role) || ''} required disabled={busy}><option value="" disabled>Välj ny roll</option>{STUDIO_ROLES.map(role => <option key={role} value={role}>Administratör</option>)}</select></label><button disabled={busy}>Spara roll</button></form>}
            {mayWrite('users/remove') && <button disabled={busy} type="button" onClick={() => { if (window.confirm(`Ta bort inloggningskontot ${label(user.username)}?`)) command('users/remove', { username: user.username }); }}>Ta bort konto</button>}
          </div>}
          {mayWrite('users/resend') && <button disabled={busy} type="button" onClick={() => command('users/resend', { username: user.username })}>Skicka nytt aktiverings-/återställningsmejl</button>}
        </div>)}</>}
        {mayWrite('users/invite') && <details className={styles.disclosure}><summary>Bjud in personal till Admin</summary><p>Ange administratörens e-postadress. Mejlet bjuder in Scoutgamings personal med behörighet till Admin, Partnerportalen och spelet. Bolagsåtkomst följer tilldelade medlemskap. Kontot aktiveras genom att mottagaren väljer lösenord via mejlet. Aktiveringslänken gäller i 72 timmar.</p><form method="post" className={styles.form} onSubmit={submit('users/invite', form => ({ email: value(form, 'email'), role: value(form, 'role') }))}>
          <label>E-post<input type="email" name="email" required maxLength={254} disabled={busy} /></label>
          <label>Behörighet<select name="role" disabled={busy}>{STUDIO_ROLES.map(role => <option key={role} value={role}>Administratör</option>)}</select></label><button disabled={busy}>Skicka inbjudan</button>
        </form></details>}
      </>}
      {section === 'apikeys' && <>
        {missing(resources.apikeys, 'apikeys')}
        {['apikeys/create','apikeys/rotate','apikeys/revoke','apikeys/launch','apikeys/credit'].map(action => <div key={action}>{unavailableWrite(action)}</div>)}
        {resources.apikeys?.payload && <><EmptyRows count={rows(resources.apikeys.payload.keys).length} />{rows(resources.apikeys.payload.keys).map((key, index) => <div className={styles.row} key={label(key.id, String(index))}>
          <div className={styles.integrationIdentity}><strong>{label(key.name)}</strong><dl className={styles.integrationFacts}>
            <div><dt>Bolag</dt><dd>{typeof key.operatorId === 'string' ? label(key.operatorName, key.operatorId) : 'Inget bolag'}</dd></div>
            <div><dt>Status</dt><dd><span className={styles.status}>{key.revoked_at ? 'Återkallad' : 'Aktiv'}</span>{Boolean(key.revoked_at) && <small><AdminTime value={key.revoked_at}/></small>}</dd></div>
            <div><dt>Senast använd</dt><dd><AdminTime value={key.last_used} empty="Inte registrerat"/></dd></div>
            <div><dt>Wallet</dt><dd>{key.walletConfigured === true ? 'Ansluten' : 'Ej ansluten'}</dd></div>
          </dl><details className={styles.disclosure}><summary>Nyckelns rättigheter</summary><p>Nyckel och hemlighet är dolda.</p><p><code>{Array.isArray(key.scopes) ? key.scopes.filter(scope => typeof scope === 'string' && PARTNER_SCOPES.includes(scope)).join(', ') : '—'}</code></p></details></div>
          {!key.revoked_at && mayWrite('apikeys/revoke') && <button disabled={busy} type="button" onClick={() => { if (window.confirm(`Återkalla partnernyckeln för ${label(key.name)}?`)) command('apikeys/revoke', { id: key.id }); }}>Återkalla partnernyckel</button>}
          {!key.revoked_at && mayWrite('apikeys/rotate') && <button disabled={busy} type="button" onClick={() => { if (window.confirm(`Byta nyckeln för ${label(key.name)}? Den tidigare nyckeln slutar fungera.`)) command('apikeys/rotate', { id: key.id }); }}>Rotera hemlighet</button>}
          {!key.revoked_at && mayWrite('apikeys/launch') && Array.isArray(key.scopes) && key.scopes.includes('launch') && <form method="post" className={styles.form} onSubmit={submit('apikeys/launch', form => ({ id:key.id, playerId:value(form,'playerId'), displayName:value(form,'displayName'), currency:value(form,'currency'), language:value(form,'language') }))}>
            <h4>Starta partnerspel</h4><label>Partnerns spelar-ID<input name="playerId" required maxLength={256} disabled={busy} /></label>
            <label>Visningsnamn<input name="displayName" required maxLength={40} disabled={busy} /></label>
            <label>Valuta<select name="currency" defaultValue="EUR" disabled={busy}>{CURRENCIES.map(currency => <option key={currency}>{currency}</option>)}</select></label>
            <label>Språk<select name="language" disabled={busy}><option value="en">English</option><option value="sv">Svenska</option></select></label><button disabled={busy}>Skapa spellänk</button>
          </form>}
          {!key.revoked_at && key.walletConfigured !== true && mayWrite('apikeys/credit') && Array.isArray(key.scopes) && key.scopes.includes('wallet') && <form method="post" className={styles.form} onSubmit={submit('apikeys/credit', form => ({ id:key.id, playerId:value(form,'playerId'), amount:Number(value(form,'amount')) }))}>
            <h4>Demo-kreditering</h4><label>Partnerns spelar-ID<input name="playerId" required maxLength={256} disabled={busy} /></label>
            <label>Belopp<input name="amount" type="number" min="0.01" max="100000" step="0.01" required disabled={busy} /></label><button disabled={busy}>Kreditera demo-saldo</button>
          </form>}
        </div>)}</>}
        {mayWrite('apikeys/create') && resources.apikeys?.payload && <details className={styles.disclosure}><summary>Ny partnernyckel</summary>
          {keyCreation.blocker && <p className={styles.notice} role="status">{keyCreation.blocker}</p>}
          <form method="post" className={styles.form} onSubmit={submit('apikeys/create', form => ({ operatorId:value(form,'operatorId'), name:value(form,'name'), scopes:PARTNER_SCOPES.filter(scope => new FormData(form).has(`scope-${scope}`)), walletUrl:value(form,'walletUrl'), ipAllow:value(form,'ipAllow') }))}>
          <label>Bolag<select name="operatorId" required defaultValue="" disabled={busy || !keyCreation.companies.length}>
            <option value="" disabled>Välj bolaget som nyckeln gäller</option>
            {keyCreation.companies.map(company => <option key={String(company.id)} value={String(company.id)}>{label(company.name)}</option>)}
          </select></label>
          <p className={styles.notice}>Nyckeln gäller bara det valda bolaget och kan inte flyttas till ett annat. Spelare som startas med den hamnar hos bolaget.</p>
          <label>Namn<input name="name" required maxLength={80} disabled={busy} /></label>
          <label>Wallet-URL (valfritt, HTTPS)<input name="walletUrl" type="url" maxLength={2048} disabled={busy} /></label>
          <label>IP-adresser (valfritt, kommaseparerat)<input name="ipAllow" maxLength={2048} disabled={busy} /></label>
          <fieldset><legend>Rättigheter</legend>{PARTNER_SCOPES.map(scope => <label className={styles.checkbox} key={scope}><input type="checkbox" name={`scope-${scope}`} defaultChecked disabled={busy} />{scope}</label>)}</fieldset>
          <button disabled={busy || Boolean(keyCreation.blocker)}>Skapa partnernyckel</button>
        </form></details>}
        <p className={styles.notice}>Nyckel och HMAC-hemlighet visas endast direkt efter skapande eller rotation. Kopiera dem till partnerns säkra förvaring innan du lämnar vyn. Spelmotorn bekräftar launch, återkallelse och demo-saldo.</p>
      </>}
      {section === 'emails' && <>
        {missing(resources.emails, 'emails')}
        <p className={styles.notice}>Inbjudan och återställning skickas från Konton.</p>
        {resources.emails?.payload && <details className={styles.disclosure}><summary>Visa exempelmallar</summary>{rows(resources.emails.payload.templates).filter(template => template.id !== 'tournament-invite').map(template=><article className={styles.review} key={label(template.id)}>
          <h4>{label(template.name)}</h4><strong>{label(template.heading)}</strong><p>{label(template.text)}</p>
          <dl>{Array.isArray(template.fields) && template.fields.filter(Array.isArray).map((field,index)=><div key={index}><dt>{label(field[0])}</dt><dd>{label(field[1])}</dd></div>)}</dl>
          <p><strong>{label(template.action)}</strong></p><p>18+ · Play responsibly · Scout Gaming</p>
        </article>)}</details>}
      </>}
      {section === 'pay' && <>
        {missing(resources.transactions, 'pay')}
        {resources.transactions?.payload && <TransactionJournal payload={resources.transactions.payload}/>}
      </>}
    </section>)}
  </div>;
}

export function StudioAdministration(props: StudioAdministrationProps) {
  const client = useMemo(() => createStudioAdminClient(props), [props.apiBase, props.session, props.availableActions, props.fetchImpl, props.gameOrigin, props.readIdentity]);
  const [group, setGroup] = useState(() => ACTIVE_GROUPS.find(item => item.id === props.initialGroup)?.id ?? 'operations');
  const [actor, setActor] = useState<StudioAdminActor | null>(null);
  const [resources, setResources] = useState<Resources>({});
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [editorEpoch, setEditorEpoch] = useState(0);
  const [notice, setNotice] = useState('');
  const [fatal, setFatal] = useState<StudioAdminUiError | null>(null);
  const [oneTime, setOneTime] = useState<StudioPartnerResult | null>(null);
  const oneTimeEpoch = useRef(0);
  const sequence = useRef(0);
  const activeRead = useRef<AbortController | null>(null);
  const alive = useRef(false);
  const writing = useRef(false);
  const changed = useRef(false);
  // Edited forms survive reloads until they are saved or explicitly discarded.
  const draftForms = useRef(new Set<HTMLFormElement>());

  useEffect(() => {
    const owner = studioHistory(window), canLeave = () => !changed.current && !writing.current;
    const release = owner.guardTraversal(canLeave);
    const guard = (event: Event) => { if (!canLeave()) event.preventDefault(); };
    window.addEventListener('studio:before-navigate', guard);
    return () => { release(); window.removeEventListener('studio:before-navigate', guard); };
  }, []);

  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => { if (changed.current || writing.current) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, []);

  useEffect(() => {
    const clearOneTime = () => {
      ++oneTimeEpoch.current;
      // pagehide means navigation proceeded. Commit the removal before the
      // browser freezes a bfcache snapshot; cancelled beforeunload keeps it.
      flushSync(() => setOneTime(null));
    };
    window.addEventListener('pagehide', clearOneTime);
    return () => window.removeEventListener('pagehide', clearOneTime);
  }, []);

  async function load(target: string, preserveNotice = false, preserveOneTimeActor?: StudioAdminActor, shared?: SharedStudioAdminRead): Promise<boolean> {
    const ticket = ++sequence.current;
    activeRead.current?.abort();
    const controller = new AbortController(); activeRead.current = controller;
    if (alive.current) { setBusy(true); setFatal(null); if (!preserveNotice) setNotice(''); if (!preserveOneTimeActor) setOneTime(null); }
    try {
      // Each view reads only the sections it shows.
      const reads = visibleSections(target, props.sections).flatMap(section => SECTION_READS[section] ?? []);
      if (!reads.length) throw new StudioAdminUiError(400);
      let initialActor: StudioAdminActor;
      let results: { action: string; payload?: JsonObject; error?: StudioAdminUiError }[];
      if (props.readIdentity === 'response-headers-v1') {
        const current = shared && shared.actions.join() === reads.join() ? await shared.read(client) : await client.readGroup(reads, controller.signal);
        initialActor = current.actor; results = current.results;
      } else {
        initialActor = await client.identity();
        aborted(controller.signal);
        const legacy = await Promise.all(reads.filter(action => {
          const descriptor = studioAdminEndpoint('GET', `/studio/api/admin/${action}`);
          return descriptor && studioRoleMeetsMinimum(initialActor.role, descriptor.minimumRole);
        }).map(async action => {
          try { const result = await client.request('GET', action, undefined, controller.signal, initialActor); return { action, ...result }; }
          catch (error) { aborted(controller.signal); const failure = uiError(error); if (failure.status === 401 || failure.status === 403) throw failure; return { action, actor: initialActor, error: failure }; }
        }));
        if (legacy.some(result => result.actor.username !== initialActor.username || result.actor.role !== initialActor.role)) throw new StudioAdminUiError(403);
        results = legacy;
      }
      if (!alive.current || ticket !== sequence.current) return false;
      if (preserveOneTimeActor && (initialActor.username !== preserveOneTimeActor.username || initialActor.role !== preserveOneTimeActor.role)) setOneTime(null);
      const next: Resources = {};
      for (const result of results) next[result.action] = result.error ? { error: result.error } : { payload: result.payload };
      setActor(initialActor); setResources(next);
      return results.some(result => result.payload)
        && results.every(result => result.payload || result.error?.status === 501);
    } catch (error) {
      if (!alive.current || ticket !== sequence.current || controller.signal.aborted) return false;
      setActor(null); setResources({}); setOneTime(null); setFatal(uiError(error)); return false;
    } finally { if (alive.current && ticket === sequence.current && !writing.current) setBusy(false); }
  }

  useEffect(() => {
    alive.current = true;
    void load(group, false, undefined, props.sharedRead);
    return () => { alive.current = false; ++sequence.current; activeRead.current?.abort(); };
    // The client identity/transport and local group define this read transaction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, group]);

  function changeGroup(next: string) {
    if (!ACTIVE_GROUPS.some(item => item.id === next) || writing.current || next === group) return;
    if (changed.current && !window.confirm('Lämna osparade formulärfält och byta administrationsgrupp?')) return;
    // Invalidate before React's passive cleanup, including fetches that ignore
    // cancellation. A cancelled draft confirmation leaves the current read intact.
    ++sequence.current; activeRead.current?.abort(); setBusy(true);
    draftForms.current.clear(); changed.current = false; setDirty(false); setNotice(''); setOneTime(null); setResources({}); setGroup(next);
    if (window.location) {
      const params = new URLSearchParams(window.location.search || '');
      params.set('tab', next);
      studioHistory(window).push(`${window.location.pathname || '/admin/drift'}?${params.toString()}`, true);
    }
  }

  function discardDrafts() {
    if (busy || writing.current || !window.confirm('Kasta alla osparade formulärfält och läsa in serverns värden igen?')) return;
    draftForms.current.clear(); changed.current = false; setDirty(false); setEditorEpoch(epoch => epoch + 1);
    void load(group);
  }

  async function command(action: string, body: JsonObject, form?: HTMLFormElement) {
    if (writing.current || busy || !actor) { delete body.password; return; }
    writing.current = true; setBusy(true); setNotice(''); setFatal(null); setOneTime(null);
    const resultEpoch = oneTimeEpoch.current;
    try {
      const result = await client.request('POST', action, body);
      if (!alive.current) return;
      if (result.actor.username !== actor.username || result.actor.role !== actor.role) throw new StudioAdminUiError(403);
      // A response from before pagehide must not revive credentials after Back.
      setOneTime(resultEpoch === oneTimeEpoch.current ? (result.payload.oneTime as StudioPartnerResult | undefined) || null : null);
      // The server is authoritative: no optimistic accounts, balances or role updates.
      const reloaded = await load(group, true, result.actor);
      if (!alive.current) return;
      if (!reloaded) {
        setNotice(WRITE_NOTICES['acknowledged-unrefreshed']);
        return;
      }
      if (form) {
        if (['players/create', 'players/password', 'users/invite', 'apikeys/create'].includes(action)) form.reset();
        draftForms.current.delete(form);
      }
      changed.current = draftForms.current.size > 0; setDirty(changed.current);
      setNotice(WRITE_NOTICES[result.payload.emailSent === false ? 'email-not-sent'
        : result.payload.emailSent === true && action === 'users/invite' ? 'invite-sent'
          : result.payload.emailSent === true && action === 'users/resend' ? 'resend-sent' : 'acknowledged']);
    } catch (error) {
      if (!alive.current) return;
      const failure = uiError(error);
      if (failure.status === 401 || failure.status === 403) { setActor(null); setResources({}); setOneTime(null); setFatal(failure); }
      else setNotice(failure.message);
    } finally {
      delete body.password;
      writing.current = false;
      if (alive.current) setBusy(false);
    }
  }

  const activeGroup = ACTIVE_GROUPS.find(item => item.id === group);
  const area = activeGroup?.area ?? 'Drift';
  const areaGroups = ACTIVE_GROUPS.filter(item => item.area === area);
  const pageTitle = activeGroup?.label ?? 'Administration';
  // A view limited to some sections sits under its page's own heading.
  const ownHeading = !props.sections;
  useEffect(() => {
    publishShellStatus(<span className={dirty ? 'sg-pill sg-pill-ej-sparad' : 'sg-pill sg-pill-sparad'}>{dirty ? 'Ej sparad' : 'Sparad'}</span>);
    return () => publishShellStatus(null);
  }, [dirty]);
  return <div className={styles.administration} aria-busy={busy}>
    <PageTemplate eyebrow={ownHeading ? (group === 'finance' ? 'EKONOMI' : area.toUpperCase()) : null} title={ownHeading ? pageTitle : null} intro={actor ? `${actor.username} · ${accountRole(actor.role)}` : fatal ? 'Administration kunde inte läsas in' : 'Hämtar session och serverdata…'} />
    <div className={styles.headerActions}><button type="button" className="sg-btn sg-btn-secondary" data-action="reload" disabled={busy} onClick={() => void load(group)}>Ladda om från servern</button></div>
    {group === 'operations' && actor && !fatal && props.renderOperations?.(actor)}
    {group === 'accounts' && <p className={styles.notice}>För bolagens medlemmar och behörigheter, öppna <a href={labUrl('/admin/companies')}>{props.companyTeamLabel ?? 'Bolag & team'}</a>. Här hanterar du interna konton och spelare.</p>}
    {group === 'partners' && <p className={styles.notice}>Tekniska integrationer använder API-nycklar. Personers åtkomst hanteras i <a href={labUrl('/admin/companies')}>{props.companyTeamLabel ?? 'Bolag & team'}</a>.</p>}
    {fatal && <p role="alert" className={styles.error}>{fatal.message}</p>}
    {notice && <p role="status" className={styles.notice} data-notice={writeNoticeKind(notice)}>{notice}</p>}
    {oneTime && actor && <section className={styles.section} data-one-time="" aria-label="Engångsresultat från partneråtgärd">
      {oneTime.kind === 'credentials' && <><h3>Engångsuppgifter</h3><p>Kopiera nu. Uppgifterna försvinner när du döljer dem, laddar om eller lämnar vyn.</p>
        {oneTime.key && <label>API-nyckel<input readOnly value={oneTime.key} autoComplete="off" spellCheck={false} /></label>}
        <label>HMAC-hemlighet<input readOnly value={oneTime.secret} autoComplete="off" spellCheck={false} /></label></>}
      {oneTime.kind === 'launch' && <><h3>Partnerspel</h3><p>Spelmotorn har skapat en tillfällig spellänk.</p><a href={oneTime.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Öppna partnerspelet</a></>}
      {oneTime.kind === 'credit' && <><h3>Demo-saldo bekräftat</h3><p>{oneTime.playerId}: {oneTime.balance} {oneTime.currency}</p></>}
      <button type="button" onClick={() => setOneTime(null)}>Dölj engångsresultat</button>
    </section>}
    {dirty && <div><p role="status">Osparade formulärfält. Omladdning behåller fälten tills du sparar eller kastar dem.</p><button type="button" data-action="discard-drafts" disabled={busy} onClick={discardDrafts}>Kasta formulärutkast och läs om</button></div>}
    {actor && <>{props.showGroupNavigation !== false && <nav className={`${styles.groups} sg-tabs`} aria-label="Administration"><span className={styles.areaLabel}>{area}</span>{areaGroups.map(item => <button type="button" key={item.id} data-group={item.id} aria-pressed={group === item.id} disabled={writing.current} onClick={() => changeGroup(item.id)}>{item.label}</button>)}</nav>}
      {group==='operations'&&client.available('GET','shared-table-proof')&&actor.role==='admin'?<SharedTableProof
        key={actor.username+':'+actor.role}
        roomChoices={rows(resources.overview?.payload?.rooms).filter(room=>typeof room.id==='string').map(room=>({id:String(room.id),name:label(room.name??room.label??room.id)}))}
        read={async(query,signal)=>(await client.request('GET','shared-table-proof',undefined,signal,actor,query)).payload}
      />:null}
      <StudioAdministrationView key={`${group}-${editorEpoch}`} actor={actor} group={group} sections={props.sections} resources={resources} busy={busy} available={client.available} command={(action, body, form) => { void command(action, body, form); }} onReload={() => { void load(group); }} onDirty={form => { draftForms.current.add(form); changed.current = true; setDirty(true); }} />
    </>}
  </div>;
}
