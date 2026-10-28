import { randomUUID } from 'node:crypto';
import { registeredDealerIds } from '../../../packages/presentation/contracts/dealer-identity.mjs';
import { isStudioRole, meetsStudioAdminActionRole } from './studio-access-policy.mjs';
import { validateStudioScope, validateRevision, canonicalStudioJson } from '../../../packages/studio-registry/server/document-contract.mjs';
import { createPlayerAdministration } from '../../../packages/storage/server/player-administration.mjs';
import { createRegisteredVoiceLines, studioVoiceIdentity, voiceReviewMatches } from './studio-voice-lines.mjs';
import { isGameLane, gameLaneConfiguration, validateGameLanes } from '../../../packages/presentation/contracts/game-lanes.mjs';

const fail = (statusCode = 400) => { throw Object.assign(new Error('studio_admin_request_rejected'), { statusCode }); };
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max && !/[\u0000-\u001f\u007f-\u009f]/u.test(value);
function bodyKeys(body, allowed, required = allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).some(key => !allowed.includes(key)) || required.some(key => !Object.hasOwn(body, key))) fail();
}

// Actual domain handlers, not a forwarding proxy. Missing domains are not
// registered; callers cannot turn a future descriptor into an active feature.
export function createStudioAdminData({ db, boDb, repository, scope, gamePolicy, canAssignDealer,
  voiceLines = createRegisteredVoiceLines(), now = () => new Date().toISOString() } = {}) {
  if (!db?.prepare || !boDb?.prepare || !repository?.readDocument || !repository?.saveDocument) fail(503);
  scope = validateStudioScope(scope);
  const players = createPlayerAdministration({ db, boDb, now }), handlers = new Map(), gates = new Map();
  function trusted(context) {
    if (canonicalStudioJson(validateStudioScope(context.scope)) !== canonicalStudioJson(scope)
      || !text(context.actor?.user, 254) || !isStudioRole(context.actor.role)) fail(403);
    return context.actor.user;
  }
  const register = (method, action, run) => handlers.set(`${method} /studio/api/admin/${action}`, async context => {
    trusted(context); if (!meetsStudioAdminActionRole(context.actor.role, action)) fail(403); return run(context);
  });
  async function config() {
    const document = gamePolicy ? await gamePolicy.readAdministration() : await repository.readDocument('administration');
    if (!document) fail(503); // Explicit import/initialize only; never BO_DEFAULTS.
    return document;
  }
  function change(action, allowed, update) {
    register('POST', action, async context => {
      const body = context.body;
      bodyKeys(body, [...allowed, 'expectedRevision']); validateRevision(body.expectedRevision);
      const previous = await config();
      if (previous.revision !== body.expectedRevision) fail(409);
      const value = structuredClone(previous.value);
      await update(value, body, context);
      const saved = gamePolicy ? await gamePolicy.saveAdministration(value, body.expectedRevision, { actor: trusted(context) }) : await repository.saveDocument('administration', {
        value, actor: trusted(context), expectedRevision: body.expectedRevision,
      });
      return { ok: true, revision: saved.revision };
    });
  }
  async function readSavedDealers() {
    try {
      const saved = await repository.readDocument('project');
      registeredDealerIds(saved?.value);
      if (saved.value.dealers.some(dealer => !text(dealer.label, 120) || dealer.label !== dealer.label.trim())) return null;
      return saved.value.dealers.map(({ id, label }) => ({ id, label }));
    } catch { return null; }
  }
  async function savedDealerSet() {
    const saved = await readSavedDealers();
    if (!saved) fail(503);
    return new Set(saved.map(dealer => dealer.id));
  }
  register('GET', 'config', async () => {
    const [saved, savedDealers] = await Promise.all([config(), readSavedDealers()]);
    return { ...saved.value, ...gameLaneConfiguration(saved.value), revision: saved.revision, savedDealers };
  });
  change('game-lane', ['lane'], (value, body) => {
    const lanes = gameLaneConfiguration(value);
    if (!isGameLane(body.lane, lanes.gameLanes)) fail();
    value.gameLanes = lanes.gameLanes;
    value.gameLane = body.lane;
  });
  change('game-lanes/create', ['definition'], async (value, body) => {
    const dealers = await savedDealerSet();
    if (!dealers.has(body.definition?.dealer)) fail(422);
    const lanes = gameLaneConfiguration(value);
    let next;
    try { next = validateGameLanes([...lanes.gameLanes, body.definition]); } catch { fail(); }
    value.gameLanes = next;
    value.gameLane = lanes.gameLane ?? body.definition.id;
  });
  change('game-lanes/remove', ['lane', 'replacementLane'], (value, body) => {
    const lanes = gameLaneConfiguration(value);
    if (!isGameLane(body.lane, lanes.gameLanes)) fail(404);
    // Room bindings outlive active/default choices and operator publication.
    // Preserve every referenced lane, including preview and pending rooms.
    if ((value.rooms ?? []).some(room => room.gameLaneId === body.lane)) fail(409);
    const remaining = lanes.gameLanes.filter(lane => lane.id !== body.lane);
    const active = lanes.gameLane === body.lane ? body.replacementLane : lanes.gameLane;
    if (remaining.length ? !isGameLane(active, remaining) : active !== null) fail(409);
    // Collections can have multiple lane owners. Removing a catalogue entry
    // never grants authority to delete shared media or historical job artifacts.
    value.gameLanes = remaining;
    value.gameLane = active;
  });
  register('GET', 'voicelines', async () => {
    const [saved, registry, dealers] = await Promise.all([config(), voiceLines(), savedDealerSet()]);
    return { ...registry, revision: saved.revision, dealers: registry.dealers.filter(dealer => dealers.has(dealer.dealer)).map(dealer => ({ ...dealer,
      lines: dealer.lines.map(line => {
        const review = saved.value.voiceReview?.[dealer.dealer]?.[line.key];
        const matches = voiceReviewMatches(review, line.identity);
        return { ...line, review: matches ? review.verdict : null,
          reviewState: matches ? 'current-human-review' : review ? 'unbound-or-changed-media' : 'unreviewed',
          productionApproved: false };
      }) })) };
  });
  change('voiceline-review', ['dealer', 'line', 'verdict', 'expectedIdentity'], async (value, body, context) => {
    if (!text(body.dealer, 40) || !text(body.line, 100) || !['approved', 'rejected', null].includes(body.verdict)) fail();
    const [registry, dealers] = await Promise.all([voiceLines(), savedDealerSet()]);
    if (!dealers.has(body.dealer)) fail(404);
    const line = registry.dealers.find(row => row.dealer === body.dealer)?.lines.find(row => row.key === body.line);
    if (!line) fail(404);
    if (body.verdict !== null && (!line.reviewable || !studioVoiceIdentity(body.expectedIdentity)
      || !studioVoiceIdentity(line.identity) || canonicalStudioJson(body.expectedIdentity) !== canonicalStudioJson(line.identity))) fail(409);
    if (body.verdict === null && body.expectedIdentity !== null && !studioVoiceIdentity(body.expectedIdentity)) fail();
    value.voiceReview ??= {}; value.voiceReview[body.dealer] ??= {};
    if (body.verdict === null) delete value.voiceReview[body.dealer][body.line];
    else value.voiceReview[body.dealer][body.line] = { verdict: body.verdict, identity: structuredClone(line.identity), by: trusted(context), at: now() };
  });
  register('GET', 'overview', async () => {
    const [saved, total, tx] = await Promise.all([
      config(), db.prepare('SELECT COUNT(*) n FROM players').get(),
      db.prepare("SELECT CASE WHEN type='sync' THEN meta ELSE type END AS type,COUNT(*) n,SUM(amount) sum FROM transactions WHERE at>=? GROUP BY 1").all(now().slice(0,10)),
    ]);
    return { tiers: saved.value.tiers, rooms: saved.value.rooms, revision: saved.revision, players: total.n, tx };
  });
  register('GET', 'players', async () => ({
    players: await db.prepare('SELECT players.id,name,currency,balance,created_at,status,closed_at,EXISTS(SELECT 1 FROM player_accounts WHERE player_accounts.player_id=players.id) AS passwordChangeAllowed FROM players ORDER BY created_at DESC LIMIT 500').all()
      .then(rows => rows.map(row => ({ ...row, passwordChangeAllowed: row.passwordChangeAllowed === true || row.passwordChangeAllowed === 1 }))),
    administration: true, storage: 'postgres',
  }));
  register('GET', 'transactions', async () => ({ tx: await db.prepare('SELECT player_id,type,amount,currency,meta,at FROM transactions ORDER BY id DESC LIMIT 100').all() }));
  register('GET', 'users', async () => ({ users: await boDb.prepare('SELECT username,email,role,created_at,(hash IS NOT NULL)::integer AS active FROM users ORDER BY id').all() }));
  register('GET', 'apikeys', async () => ({ keys: await boDb.prepare('SELECT id,name,scopes,(wallet_url IS NOT NULL AND wallet_url<>\'\') AS wallet_configured,created_at,last_used,revoked_at FROM api_keys ORDER BY created_at DESC').all()
    .then(rows => rows.map(row => ({ ...row, scopes: (() => { try { const value = JSON.parse(row.scopes); return Array.isArray(value) ? value.filter(item => typeof item === 'string') : []; } catch { return []; } })() }))) }));

  change('room', ['id','state'], (value, body) => {
    if (!text(body.id,100) || !['live','preview','pending'].includes(body.state) || !Array.isArray(value.rooms)) fail();
    const room = value.rooms.find(item => item?.id === body.id); if (!room) fail(404);
    room.state = body.state;
  });
  change('pitboss', ['payout10x','streak5','randomWalkMin'], (value, body) => {
    if (typeof body.payout10x !== 'boolean' || typeof body.streak5 !== 'boolean'
      || !Number.isInteger(body.randomWalkMin) || body.randomWalkMin < 1 || body.randomWalkMin > 1440) fail();
    value.pitboss = { payout10x: body.payout10x, streak5: body.streak5, randomWalkMin: body.randomWalkMin };
  });
  change('tournament', ['name','format','buyin','pool','cap','starts'], (value, body) => {
    if (!text(body.name,100) || !text(body.format,100) || !text(body.starts,100)
      || !['buyin','pool'].every(key => typeof body[key] === 'number' && Number.isFinite(body[key]) && body[key] >= 0 && body[key] <= 100_000_000)
      || !Number.isSafeInteger(body.cap) || body.cap < 0 || body.cap > 1_000_000 || !Array.isArray(value.tournaments)) fail();
    value.tournaments.unshift({ id: `t-${randomUUID()}`, name: body.name.trim(), format: body.format.trim(),
      buyin: body.buyin, pool: body.pool, cap: body.cap, starts: body.starts.trim(), state: 'draft', entries: 0 });
  });
  if (typeof canAssignDealer === 'function') change('tier', ['tier','dealer'], async (value, body) => {
    const dealers = await savedDealerSet();
    if (!['classic','high','vip'].includes(body.tier) || !dealers.has(body.dealer) || !Object.hasOwn(value.tiers || {}, body.tier)) fail();
    if (await canAssignDealer(body.dealer) !== true) fail(409);
    value.tiers[body.tier] = body.dealer;
  });
  register('POST', 'players/create', async context => {
    bodyKeys(context.body, ['username','password','name','currency','reason'], ['username','password']);
    try { return { ok: true, player: await players.create({ ...context.body, actor: trusted(context) }) }; }
    catch (error) { if (error.code === '23505') fail(409); throw error; }
  });
  gates.set('player-lifecycle-and-ledger', () => true); // Existing atomic playerAdministration.create.

  async function changeUser(context, remove) {
    const body = context.body, actor = trusted(context);
    bodyKeys(body, remove ? ['username'] : ['username','role']);
    if (!text(body.username,254) || body.username.trim().toLowerCase() === actor.trim().toLowerCase()
      || !remove && body.role !== 'admin') fail(403);
    return boDb.transaction(async () => {
      const target = await boDb.prepare('SELECT id,username,role,hash FROM users WHERE username=? FOR UPDATE').get(body.username);
      if (!target) fail(404);
      if (remove) {
        // The existing product transaction serializes identity changes. Also lock
        // the current active administrators so direct trusted callers cannot
        // remove the final admin or act after a concurrent removal.
        const administrators = await boDb.prepare("SELECT id,username,role FROM users WHERE role IN ('admin','superadmin') AND hash IS NOT NULL ORDER BY id FOR UPDATE").all();
        if (!administrators.some(row => row.username.toLowerCase() === actor.trim().toLowerCase())) fail(403);
        if (isStudioRole(target.role) && target.hash && administrators.length <= 1) fail(409);
        await boDb.prepare('DELETE FROM tokens WHERE username=?').run(target.username);
        await boDb.prepare('DELETE FROM users WHERE id=?').run(target.id);
      } else await boDb.prepare('UPDATE users SET role=? WHERE id=?').run(body.role, target.id);
      // product-v1 triggers increment auth_epoch; proactively remove handoffs.
      await boDb.prepare('DELETE FROM lab_sessions WHERE craig_user_id=?').run(String(target.id));
      await boDb.prepare('DELETE FROM bo_lab_handoffs WHERE craig_user_id=?').run(String(target.id));
      return { ok: true };
    });
  }
  register('POST', 'users/role', context => changeUser(context, false));
  register('POST', 'users/remove', context => changeUser(context, true));
  gates.set('forbid-self-role-change', context => context.body.username.trim().toLowerCase() !== context.actor.user.trim().toLowerCase());
  gates.set('forbid-self-removal', context => context.body.username.trim().toLowerCase() !== context.actor.user.trim().toLowerCase());
  gates.set('revoke-changed-identity', () => true); // Runtime verifies checksum-locked product-v1 before construction.
  // Player status is intentionally NOT registered: its Render chat/speech/probe
  // cancellation cannot be replaced by a local Vercel no-op or a DB flag alone.
  // Partner revoke/credit/launch also need shared game/runtime invalidation.
  return { handlers, gates };
}
