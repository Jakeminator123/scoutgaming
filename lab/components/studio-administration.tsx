'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { BACKOFFICE_GROUPS, BACKOFFICE_SECTIONS } from '../lib/backoffice-navigation.mjs';
import { studioAdminEndpoint } from '../lib/studio-admin-contract.mjs';
import { isStudioRole, meetsStudioAdminSectionRole, studioRoleMeetsMinimum, STUDIO_ROLES, type StudioRole } from '../lib/studio-access-policy.mjs';
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
  fetchImpl?: typeof fetch;
};
type Resource = { payload?: JsonObject; error?: StudioAdminUiError };
type Resources = Record<string, Resource>;
type Command = (action: string, body: JsonObject, form?: HTMLFormElement) => void;

const CONFIG_COMMANDS = new Set(['voiceline-review', 'tournament', 'pitboss', 'tier', 'room', 'clip-landing', 'clip-never', 'gen-landing', 'gen-verdict']);
const GROUP_READS: Record<string, readonly string[]> = {
  operations: ['overview', 'config'], tables: ['overview', 'config'], accounts: ['players', 'users'],
  partners: ['apikeys'], finance: ['transactions'], 'media-review': ['config', 'voicelines'],
};
const CURRENCIES = ['USD', 'EUR', 'SEK'];
const PLAYER_STATES = ['active', 'blocked', 'closed'];
const PARTNER_SCOPES = ['launch', 'play', 'wallet', 'history', 'lobby', 'events'];
const EMPTY_ACTIONS: readonly string[] = Object.freeze([]);

function object(value: unknown): JsonObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : null;
}
function rows(value: unknown): JsonObject[] { return Array.isArray(value) ? value.map(object).filter((row): row is JsonObject => row !== null) : []; }
function label(value: unknown, fallback = '—'): string { return typeof value === 'string' && value.length > 0 ? value.slice(0, 500) : typeof value === 'number' && Number.isFinite(value) ? String(value) : fallback; }
function value(form: HTMLFormElement, name: string): string { return String(new FormData(form).get(name) ?? '').trim(); }
function validRevision(value: unknown): value is string { return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(value); }
function sameIdentity(left: unknown, right: string): boolean { return typeof left === 'string' && left.trim().toLowerCase() === right.trim().toLowerCase(); }

export function studioAdminActor(value: unknown): StudioAdminActor | null {
  const actor = object(value);
  if (!actor || !Object.hasOwn(actor, 'username') || !Object.hasOwn(actor, 'role') || typeof actor.username !== 'string' || !actor.username.trim() || actor.username.length > 254 || /[\u0000-\u001f\u007f-\u009f]/.test(actor.username) || !isStudioRole(actor.role)) return null;
  return { username: actor.username, role: actor.role };
}

export class StudioAdminUiError extends Error {
  readonly status: number;
  constructor(status: number) {
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
    super(messages[status] ?? 'Åtgärden kunde inte bekräftas av servern. Ladda om innan du försöker igen.');
    this.name = 'StudioAdminUiError';
    this.status = status;
  }
}

function uiError(error: unknown): StudioAdminUiError { return error instanceof StudioAdminUiError ? error : new StudioAdminUiError(503); }
function aborted(signal?: AbortSignal) { if (signal?.aborted) throw new DOMException('Aborted', 'AbortError'); }

/** UI transport, NOT session/Origin/CSRF/CAS authorization. No route is activated by this helper. */
export function createStudioAdminClient({ apiBase, session, availableActions = EMPTY_ACTIONS, fetchImpl = fetch }: StudioAdministrationProps) {
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
  async function request(method: Method, action: string, body?: JsonObject, signal?: AbortSignal) {
    const descriptor = typeof action === 'string' ? studioAdminEndpoint(method, `/studio/api/admin/${action}`) : null;
    if (!baseIsValid || !descriptor || (method !== 'GET' && method !== 'POST') || (method === 'GET' && body !== undefined)) throw new StudioAdminUiError(400);
    if (!available(method, action)) throw new StudioAdminUiError(501);
    aborted(signal);
    const actor = await identity();
    aborted(signal);
    if (!studioRoleMeetsMinimum(actor.role, descriptor.minimumRole)) throw new StudioAdminUiError(403);
    if (method === 'POST') {
      if (!object(body)) throw new StudioAdminUiError(400);
      if (CONFIG_COMMANDS.has(action) && !validRevision(body?.expectedRevision)) throw new StudioAdminUiError(409);
      if ((action === 'users/remove' || action === 'users/role') && sameIdentity(body?.username, actor.username)) throw new StudioAdminUiError(403);
      if (action === 'users/role' && !isStudioRole(body?.role)) throw new StudioAdminUiError(400);
      if (action === 'players/status' && !PLAYER_STATES.includes(String(body?.status))) throw new StudioAdminUiError(400);
      // These responses contain one-time credentials or game-authority launch data.
      // They require a separate, secure export/launch contract; this UI never requests them.
      if (['apikeys/create', 'apikeys/rotate', 'apikeys/launch', 'apikeys/credit', 'speech-qa'].includes(action)) throw new StudioAdminUiError(501);
    }
    let response: Response;
    try {
      response = await fetchImpl(`${apiBase}/${action}`, {
        method, credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal,
        headers: { Accept: 'application/json', ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}) },
        ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
      });
    } catch (error) { aborted(signal); throw uiError(error); }
    aborted(signal);
    if (!response.ok) throw new StudioAdminUiError(response.status);
    let payload: JsonObject | null;
    try { payload = object(await response.json()); } catch { throw new StudioAdminUiError(503); }
    aborted(signal);
    if (!payload || payload.ok === false || typeof payload.error === 'string') throw new StudioAdminUiError(400);
    if (method === 'POST') {
      if (payload.ok !== true) throw new StudioAdminUiError(503);
      // Never retain invite token links, credentials or arbitrary response text in React state.
      return { actor, payload: { ok: true, ...(typeof payload.emailSent === 'boolean' ? { emailSent: payload.emailSent } : {}) } };
    }
    if (action === 'apikeys') {
      if (!Array.isArray(payload.keys)) throw new StudioAdminUiError(503);
      payload = { keys: partnerMetadata(payload.keys) };
    }
    const listField = { players: 'players', users: 'users', transactions: 'tx', voicelines: 'dealers' }[action as 'players' | 'users' | 'transactions' | 'voicelines'];
    if (listField && !Array.isArray(payload[listField])) throw new StudioAdminUiError(503);
    return { actor, payload };
  }
  return { identity, available, request };
}

/** Whitelist metadata before it enters component state; masked/raw key fields are both omitted. */
export function partnerMetadata(value: unknown): JsonObject[] {
  return rows(value).map(row => ({
    id: label(row.id, ''), name: label(row.name),
    scopes: Array.isArray(row.scopes) ? row.scopes.filter(scope => typeof scope === 'string' && PARTNER_SCOPES.includes(scope)) : [],
    walletConfigured: typeof row.wallet_configured === 'boolean' ? row.wallet_configured : typeof row.wallet_url === 'string' && row.wallet_url.length > 0,
    created_at: label(row.created_at), last_used: label(row.last_used), revoked_at: row.revoked_at ? label(row.revoked_at) : null,
  }));
}

export function studioAdminMediaUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\/(dealer|dealers\/(astrid|amira|mei))\/[a-zA-Z0-9_./-]+\.(mp4|webm|mp3|wav)$/.test(value) || value.includes('..') || value.includes('//')) return null;
  return value;
}

type AdministrationViewProps = {
  actor: StudioAdminActor; group: string; resources: Resources; busy: boolean;
  available: (method: Method, action: string) => boolean; command: Command;
  onDirty?: (form: HTMLFormElement) => void;
};

function ResourceNotice({ resource }: { resource?: Resource }) {
  if (resource?.error) return <p className={styles.notice} role="status">{resource.error.message}</p>;
  if (!resource?.payload) return <p className={styles.notice}>Ingen serverdata har lästs för den här funktionen.</p>;
  return null;
}
function EmptyRows({ count }: { count: number }) { return count ? null : <p>Servern returnerade inga poster.</p>; }

/** Pure presentation export also allows isolated render/role tests without a live server. */
export function StudioAdministrationView({ actor, group, resources, busy, available, command, onDirty }: AdministrationViewProps) {
  const selected = BACKOFFICE_GROUPS.find(item => item.id === group);
  if (!studioAdminActor(actor) || !selected) return <p role="alert">Okänd session eller administrationsgrupp.</p>;
  const config = resources.config?.payload;
  const revision = config?.revision;
  function mayWrite(action: string, needsRevision = false) {
    const descriptor = studioAdminEndpoint('POST', `/studio/api/admin/${action}`);
    return Boolean(descriptor && studioRoleMeetsMinimum(actor.role, descriptor.minimumRole) && available('POST', action) && (!needsRevision || validRevision(revision)));
  }
  function submit(action: string, build: (form: HTMLFormElement) => JsonObject, needsRevision = false) {
    return (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (busy || !mayWrite(action, needsRevision)) return;
      const form = event.currentTarget;
      command(action, { ...build(form), ...(needsRevision ? { expectedRevision: revision } : {}) }, form);
    };
  }
  function configNotice() {
    return config && !validRevision(revision) ? <p className={styles.notice}>Serverns konfigurationsrevision saknas. Inställningar kan läsas men inte sparas.</p> : null;
  }
  function unavailableWrite(action: string) {
    const descriptor = studioAdminEndpoint('POST', `/studio/api/admin/${action}`);
    return descriptor && studioRoleMeetsMinimum(actor.role, descriptor.minimumRole) && !available('POST', action) ? <p className={styles.notice}>Ändringen {action} är ännu inte ansluten. Ingen åtgärd skickas.</p> : null;
  }
  const overview = resources.overview?.payload;
  const sections = selected.sections.filter(section => meetsStudioAdminSectionRole(actor.role, section));
  return <div className={styles.sections} onInput={event => { const target = event.target; if (target instanceof HTMLElement) { const form = target.closest('form'); if (form instanceof HTMLFormElement) onDirty?.(form); } }}>
    {sections.map(section => <section key={section} data-admin-section={section} className={styles.section} aria-labelledby={`admin-${section}`}>
      <h3 id={`admin-${section}`}>{BACKOFFICE_SECTIONS.find(item => item.id === section)?.label}</h3>
      {section === 'ops' && <>
        <ResourceNotice resource={resources.overview} />
        {overview && <><dl className={styles.metrics}>
          <div><dt>Spelare</dt><dd>{label(overview.players)}</dd></div>
          <div><dt>Rum</dt><dd>{Array.isArray(overview.rooms) ? overview.rooms.length : '—'}</dd></div>
          <div><dt>Dealers</dt><dd>{Array.isArray(overview.dealers) ? overview.dealers.length : '—'}</dd></div>
        </dl><p>Siffrorna kommer från servern vid senaste omladdningen; de är inte en realtidsmätare.</p></>}
      </>}
      {section === 'shoes' && <>
        <p>Spelmotorn ansvarar för shuffle, shoe, kort och utfall. Administrationen ändrar inte en pågående hand.</p>
        <ResourceNotice resource={resources.config} />
        {config && <dl className={styles.metrics}><div><dt>Konfigurationsrevision</dt><dd>{label(revision)}</dd></div></dl>}
        <p className={styles.notice}>Detaljerad shoe-status och verifierat integritetsunderlag är inte anslutna här. Inget RNG-certifikat påstås av den här vyn.</p>
      </>}
      {section === 'rooms' && <>
        <ResourceNotice resource={resources.config} />{configNotice()}{unavailableWrite('room')}
        {config && <><EmptyRows count={rows(config.rooms).length} />{rows(config.rooms).map((room, index) => <div className={styles.row} key={label(room.id, String(index))}>
          <div><strong>{label(room.name, label(room.id))}</strong><p>{label(room.tier)} · {label(room.state)}</p></div>
          {mayWrite('room', true) && <form onSubmit={submit('room', form => ({ id: room.id, state: value(form, 'state') }), true)}>
            <label>Status<select name="state" defaultValue={label(room.state, 'pending')} disabled={busy}><option value="live">live</option><option value="preview">preview</option><option value="pending">pending</option></select></label>
            <button disabled={busy}>Spara rum</button>
          </form>}
        </div>)}</>}
      </>}
      {section === 'dealers' && <>
        <ResourceNotice resource={resources.config} />{configNotice()}{unavailableWrite('tier')}
        {config && Object.entries(object(config.tiers) ?? {}).filter(([tier]) => ['classic', 'high', 'vip'].includes(tier)).map(([tier, dealer]) => <div className={styles.row} key={tier}>
          <div><strong>{tier}</strong><p>Dealer: {label(dealer)}</p></div>
          {mayWrite('tier', true) && <form onSubmit={submit('tier', form => ({ tier, dealer: value(form, 'dealer') }), true)}>
            <label>Dealer<select name="dealer" defaultValue={label(dealer, 'vera')} disabled={busy}>{['vera', 'astrid', 'amira', 'mei'].map(id => <option key={id} value={id}>{id}</option>)}</select></label>
            <button disabled={busy}>Spara dealer</button>
          </form>}
        </div>)}
        <p>Aktiva tal- och spelklipp hanteras i Dealer &amp; klipp, inte i en andra klippbank här.</p>
      </>}
      {section === 'pit' && <>
        <ResourceNotice resource={resources.config} />{configNotice()}{unavailableWrite('pitboss')}
        {config && <><p>Serverns inställningar: payout10x {label(object(config.pitboss)?.payout10x === true ? 'på' : object(config.pitboss)?.payout10x === false ? 'av' : undefined)}; streak5 {label(object(config.pitboss)?.streak5 === true ? 'på' : object(config.pitboss)?.streak5 === false ? 'av' : undefined)}.</p>
          {mayWrite('pitboss', true) && <form onSubmit={submit('pitboss', form => ({ payout10x: new FormData(form).has('payout10x'), streak5: new FormData(form).has('streak5'), randomWalkMin: Number(value(form, 'randomWalkMin')) }), true)}>
            <label className={styles.checkbox}><input name="payout10x" type="checkbox" defaultChecked={object(config.pitboss)?.payout10x === true} disabled={busy} />payout10x</label>
            <label className={styles.checkbox}><input name="streak5" type="checkbox" defaultChecked={object(config.pitboss)?.streak5 === true} disabled={busy} />streak5</label>
            <label>Random floor walk (minuter)<input name="randomWalkMin" type="number" min="1" max="1440" step="1" defaultValue={typeof object(config.pitboss)?.randomWalkMin === 'number' ? object(config.pitboss)!.randomWalkMin as number : ''} required disabled={busy} /></label>
            <button disabled={busy}>Spara pit bosses</button>
          </form>}
        </>}
      </>}
      {section === 'tours' && <>
        <ResourceNotice resource={resources.config} />{configNotice()}{unavailableWrite('tournament')}
        {config && <><EmptyRows count={rows(config.tournaments).length} />{rows(config.tournaments).map((tour, index) => <p key={label(tour.id, String(index))}><strong>{label(tour.name)}</strong> · {label(tour.format)} · {label(tour.starts)} · {label(tour.state)} · {label(tour.entries)}/{label(tour.cap)}</p>)}</>}
        {mayWrite('tournament', true) && <form className={styles.form} onSubmit={submit('tournament', form => ({ name: value(form, 'name'), format: value(form, 'format'), buyin: Number(value(form, 'buyin')), pool: Number(value(form, 'pool')), cap: Number(value(form, 'cap') || '0'), starts: value(form, 'starts') }), true)}>
          <label>Namn<input name="name" required maxLength={100} disabled={busy} /></label>
          <label>Format<input name="format" maxLength={100} required disabled={busy} /></label>
          <label>Buy-in<input name="buyin" type="number" min="0" step="0.01" required disabled={busy} /></label>
          <label>Pool<input name="pool" type="number" min="0" step="0.01" required disabled={busy} /></label>
          <label>Max deltagare (0 = ingen gräns)<input name="cap" type="number" min="0" max="1000000" step="1" defaultValue={0} required disabled={busy} /></label>
          <label>Start (serverns tidsformat)<input name="starts" required maxLength={100} disabled={busy} /></label>
          <button disabled={busy}>Skapa turneringsutkast</button>
        </form>}
      </>}
      {section === 'players' && <>
        <p>Spelarkonton är skilda från Studio-administratörer. Stängning bevarar saldo och journal; kontot hårdraderas inte.</p>
        <ResourceNotice resource={resources.players} />
        {unavailableWrite('players/create')}{unavailableWrite('players/status')}
        {resources.players?.payload && <><EmptyRows count={rows(resources.players.payload.players).length} /><div className={styles.tableWrap}><table>
          <thead><tr><th>Spelare / ID</th><th>Saldo</th><th>Status</th><th>Åtgärd</th></tr></thead>
          <tbody>{rows(resources.players.payload.players).map((player, index) => <tr key={label(player.id, String(index))}>
            <td>{label(player.username, label(player.name))}<small>{label(player.id)}</small></td><td>{label(player.balance)} {label(player.currency)}</td><td>{label(player.status)}</td>
            <td>{mayWrite('players/status') && resources.players.payload?.administration === true && ['active', 'blocked'].includes(String(player.status)) ? <form onSubmit={submit('players/status', form => ({ playerId: player.id, status: value(form, 'status'), reason: value(form, 'reason') }))}>
              <label>Ny status<select name="status" defaultValue={player.status === 'active' ? 'blocked' : 'active'} disabled={busy}>
                <option value={player.status === 'active' ? 'blocked' : 'active'}>{player.status === 'active' ? 'blocked' : 'active'}</option><option value="closed">closed (slutgiltigt)</option>
              </select></label><label>Orsak<input name="reason" required maxLength={500} disabled={busy} /></label><button disabled={busy}>Ändra spelarstatus</button>
            </form> : player.status === 'closed' ? 'Stängt konto – ingen återöppning' : 'Läsning'}</td>
          </tr>)}</tbody>
        </table></div></>}
        {resources.players?.payload?.administration === false && <p className={styles.notice}>Spelarkontonas lagring stödjer inte administration i den här miljön.</p>}
        {mayWrite('players/create') && resources.players?.payload?.administration === true && <form className={styles.form} onSubmit={submit('players/create', form => {
          const password = String(new FormData(form).get('password') ?? '');
          const input = form.elements.namedItem('password');
          if (input instanceof HTMLInputElement) input.value = '';
          return { username: value(form, 'username'), name: value(form, 'name'), password, currency: value(form, 'currency'), reason: value(form, 'reason') };
        })} autoComplete="off">
          <h4>Nytt spelarkonto</h4>
          <label>Inloggningsnamn<input name="username" pattern="[a-z0-9][a-z0-9._-]{2,31}" minLength={3} maxLength={32} required autoComplete="off" disabled={busy} /></label>
          <label>Visningsnamn<input name="name" maxLength={40} required disabled={busy} /></label>
          <label>Lösenord (12–128 tecken)<input name="password" type="password" minLength={12} maxLength={128} required autoComplete="new-password" disabled={busy} /></label>
          <label>Valuta<select name="currency" disabled={busy}>{CURRENCIES.map(currency => <option key={currency}>{currency}</option>)}</select></label>
          <label>Orsak<input name="reason" maxLength={500} required disabled={busy} /></label><button disabled={busy}>Skapa spelarkonto</button>
        </form>}
      </>}
      {section === 'users' && <>
        <ResourceNotice resource={resources.users} />
        {['users/invite', 'users/resend', 'users/role', 'users/remove'].map(action => <div key={action}>{unavailableWrite(action)}</div>)}
        {resources.users?.payload && <><EmptyRows count={rows(resources.users.payload.users).length} />{rows(resources.users.payload.users).map((user, index) => <div className={styles.row} key={label(user.username, String(index))}>
          <div><strong>{label(user.username)}</strong><p>{label(user.role)} · {user.active ? 'aktiverat' : 'väntar på aktivering'}</p></div>
          {sameIdentity(user.username, actor.username) ? <p>Ditt eget konto: rollbyte och borttagning är spärrade.</p> : <div className={styles.actions}>
            {mayWrite('users/role') && <form onSubmit={submit('users/role', form => ({ username: user.username, role: value(form, 'role') }))}><label>Roll<select name="role" defaultValue={label(user.role, 'reader')} disabled={busy}>{STUDIO_ROLES.map(role => <option key={role}>{role}</option>)}</select></label><button disabled={busy}>Spara roll</button></form>}
            {mayWrite('users/remove') && <button disabled={busy} type="button" onClick={() => { if (window.confirm(`Ta bort administratören ${label(user.username)}? Detta är inte ett spelarkonto.`)) command('users/remove', { username: user.username }); }}>Ta bort administratör</button>}
          </div>}
          {mayWrite('users/resend') && <button disabled={busy} type="button" onClick={() => command('users/resend', { username: user.username })}>Skicka nytt aktiverings-/återställningsmejl</button>}
        </div>)}</>}
        {mayWrite('users/invite') && <form className={styles.form} onSubmit={submit('users/invite', form => ({ email: value(form, 'email'), role: value(form, 'role') }))}>
          <h4>Bjud in administratör</h4><label>E-post<input type="email" name="email" required maxLength={254} disabled={busy} /></label>
          <label>Roll<select name="role" disabled={busy}>{STUDIO_ROLES.map(role => <option key={role}>{role}</option>)}</select></label><button disabled={busy}>Skicka inbjudan</button>
        </form>}
      </>}
      {section === 'apikeys' && <>
        <ResourceNotice resource={resources.apikeys} />
        {unavailableWrite('apikeys/revoke')}
        {resources.apikeys?.payload && <><EmptyRows count={rows(resources.apikeys.payload.keys).length} />{rows(resources.apikeys.payload.keys).map((key, index) => <div className={styles.row} key={label(key.id, String(index))}>
          <div><strong>{label(key.name)}</strong><p>Nyckel: dold · {Array.isArray(key.scopes) ? key.scopes.filter(scope => typeof scope === 'string' && PARTNER_SCOPES.includes(scope)).join(', ') : '—'}</p><p>{key.revoked_at ? `Återkallad: ${label(key.revoked_at)}` : 'Aktiv'} · Senast använd: {label(key.last_used)} · Wallet: {key.walletConfigured === true ? 'ansluten' : 'ej ansluten'}</p></div>
          {!key.revoked_at && mayWrite('apikeys/revoke') && <button disabled={busy} type="button" onClick={() => { if (window.confirm(`Återkalla partnernyckeln för ${label(key.name)}?`)) command('apikeys/revoke', { id: key.id }); }}>Återkalla partnernyckel</button>}
        </div>)}</>}
        <p className={styles.notice}>Skapa/rotera nyckel kräver en säker engångsexport som ännu inte är ansluten. Partnerlaunch och kreditering väntar på spelmotorns retur- och walletkontrakt. Inga nyckelvärden visas här.</p>
      </>}
      {section === 'emails' && <>
        <p>Befintliga mallar: välkomstmejl, insättningskvitto, turneringsinbjudan och ansvarsfullt-spel-checkin.</p>
        <p className={styles.notice}>Native förhandsvisning av mallarna är ännu inte ansluten. Inbjudan och återställning skickas från Konton; den här vyn skickar inte testmejl vid öppning.</p>
      </>}
      {section === 'pay' && <>
        <ResourceNotice resource={resources.transactions} />
        {resources.transactions?.payload && <><EmptyRows count={rows(resources.transactions.payload.tx).length} /><div className={styles.tableWrap}><table><thead><tr><th>Tid</th><th>Spelar-ID</th><th>Typ</th><th>Belopp</th></tr></thead><tbody>{rows(resources.transactions.payload.tx).map((tx, index) => <tr key={index}><td>{label(tx.at)}</td><td>{label(tx.player_id)}</td><td>{label(tx.type)}</td><td>{label(tx.amount)} {label(tx.currency)}</td></tr>)}</tbody></table></div><p>Serverns senaste journalposter. Den här vyn ändrar inte saldo eller historik.</p></>}
      </>}
      {section === 'voice' && <>
        <ResourceNotice resource={resources.voicelines} />{configNotice()}{unavailableWrite('voiceline-review')}
        {resources.voicelines?.payload && <><EmptyRows count={rows(resources.voicelines.payload.dealers).length} />{rows(resources.voicelines.payload.dealers).map((dealer, index) => <div key={label(dealer.dealer, String(index))}>
          <h4>{label(dealer.name, label(dealer.dealer))}</h4>
          {rows(dealer.lines).map((line, lineIndex) => <article className={styles.review} key={label(line.key, String(lineIndex))}>
            <strong>{label(line.key)}</strong><p>{label(line.text)}</p><p>Manuell bedömning: {label(line.review, 'ej granskad')}</p>
            {studioAdminMediaUrl(line.preview) && <video controls preload="none" src={studioAdminMediaUrl(line.preview)!} aria-label={`Förhandsvisning ${label(line.key)}`} />}
            {studioAdminMediaUrl(line.audio) && <audio controls preload="none" src={studioAdminMediaUrl(line.audio)!} aria-label={`Ljud ${label(line.key)}`} />}
            {mayWrite('voiceline-review', true) && <form onSubmit={submit('voiceline-review', form => ({ dealer: dealer.dealer, line: line.key, verdict: value(form, 'verdict') || null }), true)}>
              <label>Bedömning<select name="verdict" defaultValue={label(line.review, '')} disabled={busy}><option value="">Ej granskad</option><option value="approved">Godkänd</option><option value="rejected">Underkänd</option></select></label><button disabled={busy}>Spara manuell granskning</button>
            </form>}
          </article>)}
        </div>)}</>}
        <p>Manuell bedömning är inte automatisk läppsynkscertifiering. Rehearsal i det riktiga spelet behövs fortfarande.</p>
        <p className={styles.notice}>Betald speech-QA körs inte från den här ytan; den kräver separat operatörsgate.</p>
      </>}
      {section === 'clips' && <><p>Aktiva spelklipp och deras inställningar finns i Dealer &amp; klipp.</p><p className={styles.notice}>Äldre klippbank, landningskopior och tilldelningsslask kopieras inte till en andra mediasamling här. Den avvecklade clip-assign-funktionen återaktiveras inte.</p></>}
      {section === 'gens' && <><p>Aktiva klipp och nya uppladdningar hanteras i Dealer &amp; klipp. OpenClaw är den separata befintliga genereringsytan.</p><p className={styles.notice}>Äldre genereringsgalleri flyttas inte automatiskt. Den här vyn startar inga GPU-/modelljobb och ändrar inte kostnadsjournalen.</p></>}
    </section>)}
  </div>;
}

export function StudioAdministration(props: StudioAdministrationProps) {
  const client = useMemo(() => createStudioAdminClient(props), [props.apiBase, props.session, props.availableActions, props.fetchImpl]);
  const [group, setGroup] = useState('operations');
  const [actor, setActor] = useState<StudioAdminActor | null>(null);
  const [resources, setResources] = useState<Resources>({});
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [editorEpoch, setEditorEpoch] = useState(0);
  const [notice, setNotice] = useState('');
  const [fatal, setFatal] = useState<StudioAdminUiError | null>(null);
  const sequence = useRef(0);
  const activeRead = useRef<AbortController | null>(null);
  const alive = useRef(false);
  const writing = useRef(false);
  const changed = useRef(false);
  // An edited config form retains the revision it was based on, even after reload.
  // Reloading must not silently rebase stale fields onto newer server data.
  const draftForms = useRef(new Map<HTMLFormElement, string | undefined>());

  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => { if (changed.current || writing.current) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, []);

  async function load(target: string, preserveNotice = false): Promise<boolean> {
    const ticket = ++sequence.current;
    activeRead.current?.abort();
    const controller = new AbortController(); activeRead.current = controller;
    if (alive.current) { setBusy(true); setFatal(null); if (!preserveNotice) setNotice(''); }
    try {
      const initialActor = await client.identity();
      aborted(controller.signal);
      const reads = GROUP_READS[target];
      if (!reads) throw new StudioAdminUiError(400);
      const results = await Promise.all(reads.filter(action => {
        const descriptor = studioAdminEndpoint('GET', `/studio/api/admin/${action}`);
        return descriptor && studioRoleMeetsMinimum(initialActor.role, descriptor.minimumRole);
      }).map(async action => {
        try { const result = await client.request('GET', action, undefined, controller.signal); return { action, ...result }; }
        catch (error) { aborted(controller.signal); const failure = uiError(error); if (failure.status === 401 || failure.status === 403) throw failure; return { action, actor: initialActor, error: failure }; }
      }));
      if (!alive.current || ticket !== sequence.current) return false;
      // A change mid-load must not keep higher-role controls from the earlier result.
      if (results.some(result => result.actor.username !== initialActor.username || result.actor.role !== initialActor.role)) throw new StudioAdminUiError(403);
      const next: Resources = {};
      for (const result of results) next[result.action] = 'error' in result ? { error: result.error } : { payload: result.payload };
      setActor(initialActor); setResources(next);
      return results.some(result => 'payload' in result)
        && results.every(result => 'payload' in result || result.error.status === 501);
    } catch (error) {
      if (!alive.current || ticket !== sequence.current || controller.signal.aborted) return false;
      setActor(null); setResources({}); setFatal(uiError(error)); return false;
    } finally { if (alive.current && ticket === sequence.current && !writing.current) setBusy(false); }
  }

  useEffect(() => {
    alive.current = true;
    void load(group);
    return () => { alive.current = false; ++sequence.current; activeRead.current?.abort(); };
    // The client identity/transport and local group define this read transaction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, group]);

  function changeGroup(next: string) {
    if (!BACKOFFICE_GROUPS.some(item => item.id === next) || busy || writing.current || next === group) return;
    if (changed.current && !window.confirm('Lämna osparade formulärfält och byta administrationsgrupp?')) return;
    draftForms.current.clear(); changed.current = false; setDirty(false); setNotice(''); setResources({}); setGroup(next);
  }

  function discardDrafts() {
    if (busy || writing.current || !window.confirm('Kasta alla osparade formulärfält och läsa in serverns värden igen?')) return;
    draftForms.current.clear(); changed.current = false; setDirty(false); setEditorEpoch(epoch => epoch + 1);
    void load(group);
  }

  async function command(action: string, body: JsonObject, form?: HTMLFormElement) {
    if (writing.current || busy || !actor) { delete body.password; return; }
    if (form && CONFIG_COMMANDS.has(action) && draftForms.current.has(form)) body.expectedRevision = draftForms.current.get(form);
    writing.current = true; setBusy(true); setNotice(''); setFatal(null);
    try {
      const result = await client.request('POST', action, body);
      if (!alive.current) return;
      if (result.actor.username !== actor.username || result.actor.role !== actor.role) throw new StudioAdminUiError(403);
      // The server is authoritative: no optimistic accounts, balances or role updates.
      const reloaded = await load(group, true);
      if (!alive.current) return;
      if (!reloaded) {
        setNotice('Servern bekräftade åtgärden, men serverdata kunde inte läsas om helt. Skicka inte samma åtgärd igen; ladda om och kontrollera resultatet först.');
        return;
      }
      if (form) {
        if (['players/create', 'users/invite', 'tournament'].includes(action)) form.reset();
        draftForms.current.delete(form);
      }
      changed.current = draftForms.current.size > 0; setDirty(changed.current);
      setNotice(result.payload.emailSent === false ? 'Servern bekräftade åtgärden, men mejlet skickades inte. Ingen inbjudningslänk eller hemlighet visas här.' : 'Servern bekräftade åtgärden. Tillgänglig serverdata har lästs om.');
    } catch (error) {
      if (!alive.current) return;
      const failure = uiError(error);
      if (failure.status === 401 || failure.status === 403) { setActor(null); setResources({}); setFatal(failure); }
      else setNotice(failure.message);
    } finally {
      delete body.password;
      writing.current = false;
      if (alive.current) setBusy(false);
    }
  }

  return <div className={styles.administration} aria-busy={busy}>
    <header className={styles.header}><div><h2>Backoffice</h2><p>{actor ? `${actor.username} · ${actor.role}` : 'Verifierar Studio-sessionen'}</p></div>
      <button type="button" disabled={busy} onClick={() => void load(group)}>Ladda om från servern</button>
    </header>
    <p className={styles.notice}>UI-behörighet är en visningsregel. Servern kontrollerar session, aktuell roll, origin och varje ändring.</p>
    {fatal && <p role="alert" className={styles.error}>{fatal.message}</p>}
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
    {dirty && <div><p role="status">Osparade formulärfält. Omladdning behåller fälten och deras ursprungliga revision; den skriver inte över nyare serverändringar.</p><button type="button" disabled={busy} onClick={discardDrafts}>Kasta formulärutkast och läs om</button></div>}
    {actor && <><nav className={styles.groups} aria-label="Backoffice-grupper">{BACKOFFICE_GROUPS.map(item => <button type="button" key={item.id} aria-pressed={group === item.id} disabled={busy} onClick={() => changeGroup(item.id)}>{item.label}</button>)}</nav>
      <StudioAdministrationView key={`${group}-${editorEpoch}`} actor={actor} group={group} resources={resources} busy={busy} available={client.available} command={(action, body, form) => { void command(action, body, form); }} onDirty={form => { if (!draftForms.current.has(form)) draftForms.current.set(form, validRevision(resources.config?.payload?.revision) ? resources.config!.payload!.revision as string : undefined); changed.current = true; setDirty(true); }} />
    </>}
  </div>;
}
