import {operatorPublicView} from './player-catalog.mjs';
import {playerHandoffDestination} from '../../../packages/navigation/player-handoff.mjs';
import {platformBackendHeaders, platformConfiguration} from '../../../packages/navigation/server/platform-routing.mjs';
import {operatorLoginPath, operatorPlayPath, operatorSlugFromSearch} from './player-operator.mjs';

// Signed-in player's own aggregate. Partner /api/v1/history stays a separate key API.
export const PLAYER_RESULTS_PATH = '/api/history';

const NOTICE = 'Spelkontot kan inte läsas just nu. Försök igen om en stund.';
const LOGIN_SENTENCE = 'Logga in för att se egen profil och egen historik.';
const HISTORY_EMPTY = 'Inga avslutade rundor ännu. Historiken fylls på när du spelat klart en runda.';
const LOGIN_BLACKJACK = '/player-login?returnTo=/play/blackjack';

function unavailable() {
  return {unavailable: true};
}

export function playerAccountKind(session) {
  if (!session || session.unavailable) return null;
  if (session.guest === true) return 'gäst';
  if (session.authenticated !== true) return null;
  if (typeof session.partnerKeyId === 'string' && session.partnerKeyId) return 'partner-start';
  return 'konto';
}

function sessionState(session) {
  if (session?.unavailable) return 'unavailable';
  if (session?.authenticated === true) return 'in';
  return 'out';
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function cleanName(value) {
  const name = typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim() : '';
  return [...name].slice(0, 40).join('') || 'Spelare';
}

function formatAmount(amount, currency) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return null;
  const text = value.toLocaleString('sv-SE', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  return /^[A-Z]{3}$/.test(currency) ? `${text} ${currency}` : text;
}

function sessionView(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.authenticated !== 'boolean') return unavailable();
  const partnerKeyId = typeof data.partnerKeyId === 'string' && data.partnerKeyId ? data.partnerKeyId.slice(0, 80) : '';
  return {
    authenticated: data.authenticated,
    guest: data.guest === true,
    sharedCredentials: data.sharedCredentials === true,
    ...(data.playerAccounts === true ? {playerAccounts: true} : {}),
    ...(partnerKeyId ? {partnerKeyId} : {}),
  };
}

function profileState(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  if (data.unavailable === true || data.editable === false) return {unavailable: true};
  if (data.editable !== true || typeof data.displayName !== 'string') return null;
  const displayName = data.displayName.trim();
  if ([...displayName].length < 2 || [...displayName].length > 40 || /[\u0000-\u001f\u007f\u0080-\u009f]/u.test(displayName)) return {unavailable: true};
  return {editable: true, displayName, locale: data.locale === 'en' ? 'en' : 'sv'};
}

async function readOperator(config, slug, fetchImpl) {
  try {
    const headers = platformBackendHeaders(new Headers({Accept: 'application/json'}), config);
    const response = await fetchImpl(config.backendOrigin + '/api/operators/' + encodeURIComponent(slug), {
      method: 'GET', headers, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      await response.body?.cancel?.();
      return null;
    }
    let data;
    try { data = await response.json(); } catch { return null; }
    return operatorPublicView(data, slug);
  } catch {
    return null;
  }
}

function playerView(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return unavailable();
  const balance = Number(data.balance);
  const currency = typeof data.currency === 'string' ? data.currency : '';
  if (!Number.isFinite(balance) || !/^[A-Z]{3}$/.test(currency)) return unavailable();
  return {name: cleanName(data.name), currency, balance};
}

function resultsView(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return unavailable();
  const currencies = Array.isArray(data.currencies) ? data.currencies.flatMap(row => {
    if (!row || typeof row !== 'object') return [];
    const currency = typeof row.currency === 'string' && /^[A-Z]{3}$/.test(row.currency) ? row.currency : null;
    if (!currency) return [];
    const number = key => Number.isFinite(Number(row[key])) ? Number(row[key]) : 0;
    return [{currency, rounds: number('rounds'), won: number('won'), lost: number('lost'), net: number('net'), wagered: number('wagered'), returned: number('returned')}];
  }) : [];
  const last = data.lastRound && typeof data.lastRound === 'object' ? data.lastRound : null;
  return {currencies, lastRound: last && /^[A-Z]{3}$/.test(last.currency) ? {
    currency: last.currency,
    net: Number.isFinite(Number(last.net)) ? Number(last.net) : 0,
    outcome: ['win', 'loss', 'push'].includes(last.outcome) ? last.outcome : 'push',
  } : null};
}

async function readBackend(config, request, path, {method = 'GET', body, fetchImpl}) {
  try {
    const headers = platformBackendHeaders(new Headers({
      Accept: 'application/json',
      ...(request.headers.get('cookie') ? {Cookie: request.headers.get('cookie')} : {}),
      ...(body !== undefined ? {'Content-Type': 'application/json'} : {}),
    }), config);
    const response = await fetchImpl(config.backendOrigin + path, {
      method, headers, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000),
      ...(body !== undefined ? {body: JSON.stringify(body)} : {}),
    });
    if (response.status === 401) {
      await response.body?.cancel?.();
      return null;
    }
    if (!response.ok) {
      await response.body?.cancel?.();
      return unavailable();
    }
    let data;
    try { data = await response.json(); } catch { return unavailable(); }
    return data;
  } catch {
    return unavailable();
  }
}

export function playerAreaRequest(path, headerList, env = process.env) {
  const origin = typeof env?.CROUPIER_PUBLIC_ORIGIN === 'string' && /^https:\/\/[^/]+$/.test(env.CROUPIER_PUBLIC_ORIGIN)
    ? env.CROUPIER_PUBLIC_ORIGIN : 'https://www.scoutgaming.tech';
  const headers = new Headers();
  const cookie = headerList?.get?.('cookie');
  if (typeof cookie === 'string' && cookie) headers.set('cookie', cookie);
  return new Request(origin + path, {headers});
}

export async function playerAreaData(request, env = process.env, options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const empty = {session: unavailable(), player: null, results: null, profile: null, operator: null};
  let config;
  try { config = platformConfiguration(env); } catch { return empty; }
  if (!config?.backendOrigin) return empty;
  const sessionData = await readBackend(config, request, '/api/auth/session', {fetchImpl});
  if(sessionData?.backofficeHandoff===true) {
    const url=new URL(request.url),redirect=playerHandoffDestination(url.pathname+url.search,{origin:url.origin});
    if(redirect) return {...empty,redirect};
  }
  const operatorSlug = options.surface === 'lobby' ? operatorSlugFromSearch(new URL(request.url).search) : '';
  const operator = operatorSlug ? await readOperator(config, operatorSlug, fetchImpl) : null;
  if (sessionData === null) return {session: null, player: null, results: null, profile: null, operator};
  if (sessionData?.unavailable) return {...empty, operator};
  const session = sessionView(sessionData);
  if (session.unavailable) return {session, player: null, results: null, profile: null, operator};
  if (session.authenticated !== true) return {session, player: null, results: null, profile: null, operator};
  const playerData = await readBackend(config, request, '/api/player', {method: 'POST', body: {}, fetchImpl});
  const player = playerData === null ? null : playerData.unavailable ? playerData : playerView(playerData);
  let profile = null;
  if (options.surface === 'profil') {
    const profileData = await readBackend(config, request, '/api/profile', {fetchImpl});
    profile = profileData === null ? null : profileState(profileData);
  }
  let results = null;
  if (PLAYER_RESULTS_PATH && options.surface === 'historik') {
    const resultsData = await readBackend(config, request, PLAYER_RESULTS_PATH, {method: 'POST', body: {}, fetchImpl});
    results = resultsData === null ? null : resultsData.unavailable ? resultsData : resultsView(resultsData);
  }
  return {session, player, results, profile, operator};
}

function playerFields(player) {
  if (!player || player.unavailable) return [];
  const money = formatAmount(player.balance, player.currency);
  return [
    {label: 'Visningsnamn', value: player.name},
    {label: 'Saldo', value: money || String(player.balance)},
    {label: 'Valuta', value: player.currency},
  ];
}

function areaModel(surface, redirect, extra = {}) {
  return {
    redirect, surface,
    eyebrow: 'Spelaryta',
    title: surface === 'profil' ? 'Egen profil' : surface === 'historik' ? 'Egen historik' : 'Spellobby',
    intro: '', notice: null, fields: [], pills: [], links: [], sentence: null, primary: null, empty: null, historyLines: [], clientLabel: null,
    profileForm: null, profileNote: null, operator: null,
    ...extra,
  };
}

export function playerAreaModel(data, surface) {
  if(data?.redirect) return areaModel(surface,data.redirect);
  const state = sessionState(data?.session);
  const outage = state === 'unavailable' || data?.player?.unavailable === true || data?.results?.unavailable === true;
  const signedIn = state === 'in';
  if (surface === 'profil' && state === 'out') return areaModel(surface, '/player-login?returnTo=/play/profil');
  if (surface === 'historik' && state === 'out') return areaModel(surface, '/player-login?returnTo=/play/historik');
  const kind = playerAccountKind(data?.session);
  const fields = signedIn ? playerFields(data.player) : [];
  if (surface === 'profil' && signedIn && kind) fields.splice(1, 0, {label: 'Kontotyp', value: kind});
  const profile = surface === 'profil' ? data?.profile : null;
  const profileForm = profile?.editable ? {displayName: profile.displayName, locale: profile.locale === 'en' ? 'en' : 'sv'} : null;
  if (profileForm) {
    const nameIndex = fields.findIndex(field => field.label === 'Visningsnamn');
    if (nameIndex >= 0) fields.splice(nameIndex, 1);
  }
  const operator = data?.operator?.slug && data.operator.name ? {slug: data.operator.slug, name: data.operator.name} : null;
  const playPath = operator ? operatorPlayPath(operator.slug) : '/play/blackjack';
  const primary = surface === 'profil'
    ? {href: '/lobby', label: 'Till spellobbyn'}
    : surface === 'historik'
      ? {href: '/play/blackjack', label: 'Spela en runda'}
      : {href: signedIn || outage ? playPath : operator ? operatorLoginPath(operator.slug) : LOGIN_BLACKJACK, label: 'Spela Blackjack'};
  const outcomeLabel = {win: 'vinst', loss: 'förlust', push: 'lika'};
  const historyRows = !data?.results || data.results.unavailable ? [] : (data.results.currencies || []).filter(row => row.rounds > 0);
  const last = historyRows.length && data.results.lastRound ? data.results.lastRound : null;
  const historyLines = historyRows.map(row => `${row.currency}: ${row.rounds} rundor, netto ${formatAmount(row.net, row.currency) || row.net}`);
  if (last) historyLines.push(`Senaste runda: ${outcomeLabel[last.outcome] || 'lika'}, netto ${formatAmount(last.net, last.currency) || last.net}`);
  return areaModel(surface, null, {
    intro: surface === 'profil'
      ? profileForm
        ? 'Visningsnamn och språk kan sparas. Saldo och valuta kommer från spelkontot.'
        : 'Uppgifterna kommer från spelkontot och kan inte ändras här.'
      : surface === 'historik'
        ? 'Namn, saldo och valuta kommer från spelkontot.'
        : 'Välj ett publicerat blackjack- eller rouletterum.',
    notice: outage ? NOTICE : null,
    fields,
    pills: surface === 'lobby'
      ? [{label: 'Roulette', status: 'demo'}, {label: 'Baccarat', status: 'planerat'}]
      : surface === 'profil' && kind ? [{label: 'Kontotyp', status: kind}]
        : surface === 'historik' && signedIn && !historyRows.length && !outage ? [{label: 'Historik', status: 'inga rundor'}] : [],
    links: surface === 'lobby' && signedIn && !outage
      ? [{href: '/play/profil', label: 'Egen profil'}, {href: '/play/historik', label: 'Egen historik'}]
      : surface === 'profil' && signedIn && !outage ? [{href: '/play/historik', label: 'Spelhistorik'}] : [],
    sentence: surface === 'lobby' && state === 'out' ? LOGIN_SENTENCE : null,
    primary,
    empty: surface === 'historik' && signedIn && !outage && !historyRows.length ? HISTORY_EMPTY : null,
    historyLines,
    clientLabel: surface === 'lobby' ? 'Spelklient' : null,
    profileForm,
    profileNote: profile?.unavailable ? 'Inte tillgängligt än' : null,
    operator,
  });
}

function pillsHtml(pills) {
  if (!pills.length) return '';
  return `<p class="mt-6 flex flex-wrap gap-2">${pills.map(pill =>
    `<span class="rounded-full border border-white/15 px-3 py-1 text-sm text-slate-300">${escapeHtml(pill.label)} · ${escapeHtml(pill.status)}</span>`).join('')}</p>`;
}

function fieldsHtml(fields) {
  if (!fields.length) return '';
  return `<dl class="mt-6 space-y-2">${fields.map(field =>
    `<div class="flex flex-wrap gap-2 text-slate-200"><dt class="text-slate-400">${escapeHtml(field.label)}</dt><dd data-field="${escapeHtml(field.label)}">${escapeHtml(field.value)}</dd></div>`).join('')}</dl>`;
}

function profileFormHtml(form) {
  if (!form) return '';
  const option = (value, label) => `<option value="${value}"${form.locale === value ? ' selected' : ''}>${label}</option>`;
  return `<form class="mt-6 space-y-4" data-profile-form>
      <label class="block text-slate-200">Visningsnamn
        <input name="displayName" value="${escapeHtml(form.displayName)}" minlength="2" maxlength="40" required autocomplete="nickname" class="mt-1 block w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-white" />
      </label>
      <label class="block text-slate-200">Språk
        <select name="locale" class="mt-1 block w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-white">${option('sv', 'Svenska')}${option('en', 'English')}</select>
      </label>
      <button type="submit" class="rounded-lg bg-lime px-6 py-3 font-semibold text-ink">Spara profil</button>
      <p role="alert" data-profile-error class="text-rose-200"></p>
      <p role="status" data-profile-saved class="text-emerald-300"></p>
    </form>`;
}

function operatorHtml(operator) {
  if (!operator?.name) return '';
  return `<p class="mt-6 text-slate-200" data-operator>Spelar hos: ${escapeHtml(operator.name)}</p>
    <button type="button" data-operator-clear class="mt-3 text-sm text-slate-300 underline">Byt bolag</button>`;
}

function primaryHtml(primary) {
  if (!primary) return '';
  return `<a href="${escapeHtml(primary.href)}" class="mt-7 inline-block rounded-lg bg-emerald-300 px-6 py-3 font-semibold text-slate-950">${escapeHtml(primary.label)}</a>`;
}

export function renderPlayerAreaHtml(model) {
  const history = model.historyLines?.length ? `<ul class="mt-6 space-y-2 text-slate-200">${model.historyLines.map(line =>
    `<li>${escapeHtml(line)}</li>`).join('')}</ul>` : '';
  const lobbyCard = model.surface === 'lobby' ? `<section class="mt-9 rounded-2xl border border-white/15 bg-white/5 p-8" aria-labelledby="blackjack-title">
      <p class="text-sm uppercase tracking-widest text-emerald-300">${escapeHtml(model.clientLabel)}</p>
      <h2 id="blackjack-title" class="mt-4 text-2xl font-semibold">Blackjack</h2>
      <p class="mt-3 text-slate-300">Klassiskt kortspel med videodealer.</p>
      ${primaryHtml(model.primary)}
    </section>` : primaryHtml(model.primary);
  const links = model.links?.length ? `<nav class="mt-6 flex flex-wrap gap-4" aria-label="Spelarkonto">${model.links.map(link =>
    `<a href="${escapeHtml(link.href)}" class="text-emerald-300 underline decoration-emerald-300/70 underline-offset-4">${escapeHtml(link.label)}</a>`).join('')}</nav>` : '';
  return `<main class="min-h-screen bg-[#0b151b] px-6 py-14 text-white">
    <div class="mx-auto max-w-3xl">
      <a href="/" class="text-sm text-slate-300">← Scoutgaming</a>
      <p class="mt-12 text-sm uppercase tracking-widest text-emerald-300">${escapeHtml(model.eyebrow)}</p>
      <h1 class="mt-3 text-4xl font-semibold">${escapeHtml(model.title)}</h1>
      <p class="mt-4 text-slate-300">${escapeHtml(model.intro)}</p>
      ${model.notice ? `<p role="status" class="mt-6 inline-block rounded-full border border-white/15 px-3 py-1 text-sm text-slate-200">${escapeHtml(model.notice)}</p>` : ''}
      ${model.profileNote ? `<p role="status" class="mt-6 text-slate-300">${escapeHtml(model.profileNote)}</p>` : ''}
      ${profileFormHtml(model.profileForm)}
      ${operatorHtml(model.operator)}
      ${fieldsHtml(model.fields || [])}
      ${model.sentence ? `<p class="mt-6 text-slate-300">${escapeHtml(model.sentence)}</p>` : ''}
      ${model.empty ? `<p role="status" class="mt-6 text-slate-300">${escapeHtml(model.empty)}</p>` : ''}
      ${history}
      ${links}
      ${lobbyCard}
      ${pillsHtml(model.pills || [])}
    </div>
  </main>`;
}

export async function playerAreaPage(request, env = process.env, surface = 'lobby', options = {}) {
  const data = await playerAreaData(request, env, {...options, surface});
  const model = playerAreaModel(data, surface);
  if (model.redirect) return {redirect: model.redirect, html: '', data, model};
  return {redirect: null, html: renderPlayerAreaHtml(model), data, model};
}
