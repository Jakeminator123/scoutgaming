#!/usr/bin/env node
import { MOVING_TRIAL_BUDGET } from './moving-speech-budget.mjs';
import { handleSharedRoomHttp } from './shared-room-http.mjs';
import { withSharedRoomEntry } from './shared-room-entry.mjs';
import { consumeSharedRoomQaContext } from './shared-room-qa-context.mjs';
import { sharedRoomOrigins } from './shared-room-origins.mjs';
import {OPERATOR_NOT_FOUND_HTML} from '../../packages/navigation/operator-entry.mjs';
import {currentBackofficeAccount} from './bo-player-session.mjs';
import { isAdministratorRole } from '../../packages/studio-access/server/account-credentials.mjs';
// Static server with Range-request support (the engine range-fetches clip
// bytes in production; locally it serves whole files and ranges alike).
// Listens on 0.0.0.0 so phones on the LAN can open the demo.
import { playerAuth, playerPostOriginOk } from './storage/async-player-auth.mjs';
import { craigIdentity } from '../../packages/studio-access/server/craig-identity.mjs';
import { installBoAuthEpoch } from '../../packages/studio-access/server/bo-auth-epoch.mjs';
import { readPlayerResults } from './storage/async-player-results.mjs';
import { createPlayerChatMemory } from './storage/async-player-chat-memory.mjs';
import { createPlayerProbeStore } from './storage/async-player-probe-store.mjs';
import { installPartnerApi } from './storage/async-partner-api.mjs';
import { createPostgresStore } from './storage/postgres-store.mjs';
import { createPostgresNativeTableCommand } from './postgres-native-table.mjs';
import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { command as shoeCommand, newGame } from './shoe-game.mjs';
import { createPlayerHistoryHandler } from './player-history.mjs';
import { openClawChat } from './openclaw-chat.mjs';
import { normalizeAstridObservation } from '../../packages/director/astrid-observation.mjs';
import { createAstridTranscriptionApi } from './astrid-transcription.mjs';
import { getGeneratedSpeechService, configureGeneratedSpeechJournal } from './generated-speech-runtime.mjs';
import { completeChatWithSpeech } from './generated-speech-chat.mjs';
import { createChatResponseStream } from './chat-response-stream.mjs';
import { createGeneratedSpeechStreamService, generatedSpeechStreamConfiguration } from './generated-speech-stream.mjs';
import { createDealerSpeechRuntime } from './dealer-speech-runtime.mjs';
import { createDealerSpeechReferenceService } from './dealer-speech-reference.mjs';
import { createOperatorSpeechQa, isRetiredBackofficePost } from './operator-speech-qa.mjs';
import { CHAT_STAGES } from '../../packages/presentation/contracts/chat-response.mjs';
import {createRegisteredChatContext,createPublishedChatResolver,cancelPlayerChats} from './registered-chat-context.mjs';
import { createNativeObservationPublisher } from './native-observation-publisher.mjs';
import { installGenerationsApi } from './generations-api.mjs';
import { serveGenerationMedia } from './generation-media.mjs';
import { publicRoutePaths, isRetiredGenerationRoute, isRetiredLocalDealerRoute } from './retired-public-routes.mjs';
import { clipMapping } from './clip-mapping.mjs';
import { installGracefulShutdown } from './graceful-shutdown.mjs';
const persistenceFailure = error => Boolean(error?.severity)
  || /^[0-9A-Z]{5}$/.test(error?.code || '')
  || ['ECONNRESET','ECONNREFUSED','ETIMEDOUT','ENOTFOUND','EAI_AGAIN','EPIPE'].includes(error?.code)
  || /(?:connection (?:terminated|timeout)|timeout exceeded when trying to connect)/i.test(error?.message || '');
const publicFailure = (error, statusCode = 400) => persistenceFailure(error)
  ? { error: 'Service temporarily unavailable', statusCode: 503 }
  : { error: String(error?.message || error), statusCode };
import { readFileSync as readSync } from 'node:fs';
import { statSync, createReadStream, existsSync, realpathSync, closeSync } from 'node:fs';
import { join, normalize, extname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID, scryptSync, randomBytes, timingSafeEqual, createHmac, createHash } from 'node:crypto';
import { compositionRuntimeResponse } from './composition-runtime.mjs';
import { presentationCapabilitiesResponse } from './presentation-capabilities.mjs';
import { presentationPublicSource } from '../../packages/presentation/public-modules.mjs';
import { createPostgresRouletteCommand } from './games/roulette/storage.mjs';
import { rouletteDocument } from './games/roulette/http.mjs';

// Only the separate local QA launcher can register this in-process capability.
// Ordinary startup still uses the unchanged TLS/Neon configuration path.
const sharedRoomQa = consumeSharedRoomQaContext();
const root = realpathSync(join(fileURLToPath(new URL('.', import.meta.url)), 'public'));
const mediaRepository = resolve(root, '../../..');
const localMediaEnabled = process.env.CROUPIER_STUDIO_NEON_POLICY !== '1' && process.env.CROUPIER_CLOUD_RUNTIME !== '1';
const mediaLayout = localMediaEnabled && existsSync(join(mediaRepository, 'media/layout.json'))
  ? await import(pathToFileURL(join(mediaRepository, 'tools/media-layout.mjs')).href) : null;
const publicAssetPath = (...parts) => {
  const name = parts.join('/').replace(/\\/g, '/').replace(/^\/+/, '');
  return mediaLayout ? mediaLayout.resolveMediaPath(`web/public/${name}`, {
    repositoryRoot: mediaRepository, sourcePath: `services/game/public/${name}`,
  }) : join(root, ...parts);
};
const publicBlobMedia = localMediaEnabled && process.env.CROUPIER_MEDIA_BLOB_INDEX
  ? (await import(pathToFileURL(join(mediaRepository, 'services/game/media-blob-index.mjs')).href)).getPublicMediaBlobResponse : null;
const cloudRuntime = process.env.CROUPIER_CLOUD_RUNTIME === '1';
// One product path: PostgreSQL only, named explicitly so a missing variable never
// selects a backend. The retired SQLite directory must not linger in an environment.
if (process.env.CROUPIER_DATABASE !== 'postgres') throw Error(process.env.CROUPIER_DATABASE === 'sqlite' ? 'sqlite_backend_removed' : 'postgres_required');
if (process.env.CROUPIER_DATA_DIR !== undefined) throw Error('croupier_data_dir_retired');
const sharedRoomFlag = process.env.CROUPIER_SHARED_TABLE_ENABLED;
if (sharedRoomFlag !== undefined && !['0','1'].includes(sharedRoomFlag)) throw Error('shared_room_flag_invalid');
const sharedRoomsEnabled = sharedRoomFlag === '1';
let sharedRoomService = null;
let sharedRoomCommand = null;
// createPostgresStore validates the game/zones URLs; the owned QA launcher supplies its own pool.
const storage = sharedRoomQa?.storage ?? createPostgresStore({ connectionString: process.env.CROUPIER_GAME_DATABASE_URL,
  zonesConnectionString: process.env.CROUPIER_ZONES_DATABASE_URL });
await storage.db.assertInstalled();
const neonStudioEnabled = process.env.CROUPIER_STUDIO_NEON_POLICY === '1';
const { decorateGameEntryHtml } = await import('./public/game-entry-contract.mjs');
const { gameEntryRedirect, playerLoginDestination, publicGamePath } = await import('../../packages/navigation/game-entry.mjs');
const { launchGameStart } = await import('./game-start.mjs');
const { gameLaneSelection } = await import('../../packages/presentation/contracts/game-selection.mjs');
const gamePath = neonStudioEnabled ? '/blackjack' : process.env.CROUPIER_PUBLIC_GAME_PATH || '/';
const { createRenderStudioPolicy } = neonStudioEnabled ? await import('./storage/studio-runtime.mjs') : {};
const { createStudioGameCommandApi } = neonStudioEnabled ? await import('./studio-game-commands.mjs') : {};
const { createStudioNativeAuth } = neonStudioEnabled ? await import('../../packages/studio-access/studio-native-auth.mjs') : {};
const { createStudioLabSessionCheck } = neonStudioEnabled ? await import('./studio-lab-session.mjs') : {};
const { createStudioMediaRuntime } = neonStudioEnabled ? await import('./storage/studio-media-runtime.mjs') : {};
const studioPolicyRuntime = sharedRoomQa?.studioPolicyRuntime ?? (neonStudioEnabled ? await createRenderStudioPolicy({ storage }) : null);
const studioMediaRuntime = sharedRoomQa?.studioMediaRuntime ?? (studioPolicyRuntime ? createStudioMediaRuntime({ ...studioPolicyRuntime, repositoryRoot: mediaRepository }) : null);
const speechReplyLibrary = studioPolicyRuntime && process.env.CROUPIER_MEDIA_STORAGE === 'blob'
  ? (await import('../../packages/presentation/server/speech-reply-library.mjs')).createSpeechReplyLibrary({mediaStore:await import('./blob-media.mjs'),env:process.env,...studioPolicyRuntime.scope,
    repository:(await import('../../packages/presentation/server/speech-reply-repository.mjs')).createSpeechReplyRepository({sql:storage.pool,scope:studioPolicyRuntime.scope})}) : null;
const dealerSpeechRuntime = studioPolicyRuntime ? createDealerSpeechRuntime({
  readProject: () => studioPolicyRuntime.policy.projectStore().load(),
  readVideoRegistry:studioMediaRuntime.videoRegistry,
  referenceService: createDealerSpeechReferenceService({readVideoRegistry:studioMediaRuntime.videoRegistry,readVideoResponse:studioMediaRuntime.videoResponse}),
}) : null;
// Operator packages share the Studio pool and scope; a read failure keeps today's entry.
const { createGameEntrySelector } = studioPolicyRuntime ? await import('../../packages/presentation/server/game-entry-selector.mjs') : {};
const selectGameEntry = studioPolicyRuntime ? createGameEntrySelector({ policy: studioPolicyRuntime.policy,
  packages: (await import('./storage/operator-package-reader.mjs')).createOperatorPackageReader({ sql: storage.pool, scope: studioPolicyRuntime.scope, ttlMs:0 }) }) : null;
const operatorAppearanceApi = selectGameEntry ? (await import('./operator-appearance-api.mjs')).createOperatorAppearanceApi({selectGameEntry}) : null;
const frozenDealerContext = studioPolicyRuntime ? await (async () => {
  const { createFrozenDealerPresentationContext, createFrozenDealerContextReader } = await import('../../packages/presentation/server/frozen-dealer-presentation.mjs');
  return createFrozenDealerPresentationContext({
    readCurrentContext: createFrozenDealerContextReader({ pool: storage.pool, scope: studioPolicyRuntime.scope }),
    readPresentation: (await import('../../packages/presentation/server/presentation-package.mjs')).readPackagePresentation,
    privateMedia: sharedRoomQa?.privateMedia ?? ((record, request) => (import('./blob-media.mjs')).then(({getPrivateMedia})=>getPrivateMedia(record,request,{repositoryRoot:mediaRepository,
      trustedProxyOrigin:process.env.CROUPIER_CLOUD_RUNTIME==='1'&&process.env.CROUPIER_VERCEL_FRONTEND_ORIGIN&&
        new URL(request.url).origin===process.env.PUBLIC_URL&&[new URL(process.env.PUBLIC_URL).host,new URL(process.env.CROUPIER_VERCEL_FRONTEND_ORIGIN).host].includes(request.headers.get('host'))
        ?process.env.CROUPIER_VERCEL_FRONTEND_ORIGIN:null}))),
  });
})() : null;
const publishedLayerAssets = studioPolicyRuntime ? (await import('./storage/published-layer-assets.mjs')).createPublishedLayerAssets({
  packages:(await import('./storage/operator-package-reader.mjs')).createOperatorPackageReader({sql:storage.pool,scope:studioPolicyRuntime.scope}),
  privateMedia:sharedRoomQa?.privateMedia ?? (await import('./blob-media.mjs')).getPrivateMedia,
}) : null;

const authorizeChatDealer = createRegisteredChatContext({
  resolvePublishedContext:studioPolicyRuntime ? createPublishedChatResolver({
    readCurrentContext:(await import('../../packages/presentation/server/frozen-dealer-presentation.mjs')).createFrozenDealerContextReader({pool:storage.pool,scope:studioPolicyRuntime.scope}),
    readPresentation:(await import('../../packages/presentation/server/presentation-package.mjs')).readPackagePresentation,
  }) : null,
});
const speechJournal = studioPolicyRuntime ? await (await import('./postgres-speech-journal.mjs')).createSpeechJournal({
  pool: storage.pool, environmentId: studioPolicyRuntime.scope.environment }) : null;
if (speechJournal) configureGeneratedSpeechJournal(speechJournal, {
  artifacts: (await import('./speech-blob-artifacts.mjs')).createSpeechBlobArtifacts(),
});
const { handlePlayerSurface } = await import('./player-surface.mjs');
const { createPublicOperatorDirectory } = await import('./public-operators.mjs');
const publicOperatorStore = studioPolicyRuntime ? await (await import('../../packages/operators/server/operator-store.mjs')).createOperatorStore({
  sql: storage.pool, scope: studioPolicyRuntime.scope,
}) : null;
const publicOperatorRooms = (await import('./public-operator-rooms.mjs')).createPublicOperatorRooms({
  store: publicOperatorStore, policy: studioPolicyRuntime?.policy ?? null,
});
const publicOperators = createPublicOperatorDirectory({ store: publicOperatorStore, readRooms: publicOperatorRooms.read });
const publicOperatorPreview = studioPolicyRuntime ? (await import('./public-operator-preview.mjs')).createPublicOperatorPreview({
  readCurrentContext: (await import('../../packages/presentation/server/frozen-dealer-presentation.mjs')).createFrozenDealerContextReader({pool:storage.pool,scope:studioPolicyRuntime.scope}),
  privateMedia: sharedRoomQa?.privateMedia ?? ((record,request)=>(import('./blob-media.mjs')).then(({getPrivateMedia})=>getPrivateMedia(record,request,{repositoryRoot:mediaRepository,
    trustedProxyOrigin:process.env.CROUPIER_CLOUD_RUNTIME==='1'&&process.env.CROUPIER_VERCEL_FRONTEND_ORIGIN&&
      new URL(request.url).origin===process.env.PUBLIC_URL&&[new URL(process.env.PUBLIC_URL).host,new URL(process.env.CROUPIER_VERCEL_FRONTEND_ORIGIN).host].includes(request.headers.get('host'))
      ?process.env.CROUPIER_VERCEL_FRONTEND_ORIGIN:null}))),
}) : null;
const rouletteRoomAccess = studioPolicyRuntime ? (await import('./games/roulette/access.mjs')).createRouletteRoomAccess({
  readCurrentContext:(await import('../../packages/presentation/server/frozen-dealer-presentation.mjs')).createFrozenDealerContextReader({pool:storage.pool,scope:studioPolicyRuntime.scope}),
}) : null;

// ---------- player database (demo money only) ----------
const db = storage.db;
const playerChatMemory = (await createPlayerChatMemory(db, {studioScope:studioPolicyRuntime?.scope}));
let presentationApi;
const activePlayerChats = new Map();
let speechStreamService = null;
let movingSpeechService = null;
const probeStore = (await createPlayerProbeStore(db, playerChatMemory));
let activeProbeRuntime;
async function loadProbeRuntime() {
  if(!activeProbeRuntime){
    const [{createProbeRuntime},{readSettings}]=await Promise.all([
      import('./storage/async-probe-runtime.mjs'),import('./director-settings.mjs')]);
    const projectStore = studioPolicyRuntime?.policy.projectStore() ?? null;
    if (!projectStore) throw Object.assign(new Error('studio_read_storage_unavailable'), { statusCode: 503 });
    activeProbeRuntime ??= await createProbeRuntime({store:probeStore,memory:playerChatMemory,
      projectStore,
      settingsProvider:readSettings,serviceProvider:getGeneratedSpeechService,
      chatBusy:playerId=>activePlayerChats.has(JSON.stringify([playerId,'astrid']))});
  }
  return activeProbeRuntime;
}
const probeRuntime={
  async cancel(scope,reason){if(activeProbeRuntime)return activeProbeRuntime.cancel(scope,reason);return (await probeStore.activity(scope));},
  async forget(scope,factId){if(activeProbeRuntime)return activeProbeRuntime.forget(scope,factId);return probeStore.forget(scope,factId);},
  ...Object.fromEntries(['config','inspect','presence','run','test','receipt','rememberMessage','completedRound'].map(method=>[method,async (...args)=>{
    // Capture before lazy imports / policy I/O so Forget also wins that race.
    if(['rememberMessage','completedRound'].includes(method))args.push((await probeStore.generation(args[0])));
    return loadProbeRuntime().then(runtime=>runtime[method](...args));
  }])),
};
const RATES = { USD: 1, EUR: 0.92, SEK: 10.6 }; // fixed demo rates per USD
const logTx = (pid, type, amount, currency, meta = '') =>
  db.prepare('INSERT INTO transactions (player_id, type, amount, currency, meta, at) VALUES (?,?,?,?,?,?)')
    .run(pid, type, amount, currency, meta, new Date().toISOString());
const getPlayer = id => db.prepare('SELECT id, name, currency, balance, status FROM players WHERE id = ?').get(id);

const apiPlayer = async ({ id, name }) => db.transaction(async () => {
  const existing = id ? await getPlayer(id) : null;
  if (existing) return existing;
  const player = { id: randomUUID(), name: (typeof name === 'string' && name.trim().slice(0, 40)) || 'Player', currency: 'USD', balance: 1000 };
  await db.prepare('INSERT INTO players (id, name, currency, balance, created_at) VALUES (?,?,?,?,?)')
    .run(player.id, player.name, player.currency, player.balance, new Date().toISOString());
  await logTx(player.id, 'open', player.balance, player.currency, 'starting demo balance');
  return player;
});
async function postgresWallet(id, work) {
  return db.transaction(async () => {
    const player = await db.prepare('SELECT id, name, currency, balance, status FROM players WHERE id=? FOR UPDATE').get(id);
    if (!player) return { error: 'no such player' };
    if (player.status !== 'active') return { error: 'Player account is inactive' };
    return work(player);
  });
}
const apiDeposit = async ({ id, amount }) => postgresWallet(id, async player => {
  const value = Number(amount);
  if (!Number.isFinite(value) || value < 1 || value > 100_000_000) return { error: 'amount must be 1-100000000' };
  const balance = Math.round((player.balance + value) * 100) / 100;
  await db.prepare('UPDATE players SET balance=? WHERE id=?').run(balance, id);
  await logTx(id, 'deposit', value, player.currency, 'demo test card');
  return { balance, currency: player.currency };
});
const apiBalance = async () => ({ error: 'Table balances are server-managed' });
const apiCurrency = async ({ id, currency }) => postgresWallet(id, async player => {
  if (!RATES[currency]) return { error: 'currency must be USD, EUR or SEK' };
  const saved = await db.prepare('SELECT state FROM blackjack_tables WHERE player_id=?').get(id);
  if (saved) { const game = JSON.parse(saved.state); if (game.round && !game.paid) return { error: 'Finish the current round before changing currency' }; }
  const balance = Math.round((player.balance / RATES[player.currency]) * RATES[currency] * 100) / 100;
  await db.prepare('UPDATE players SET balance=?,currency=? WHERE id=?').run(balance, currency, id);
  await logTx(id, 'fx', balance, currency, `converted from ${player.currency}`);
  return { balance, currency };
});
const playerHistory = createPlayerHistoryHandler({
  db, getPlayer, readPlayerResults,
  readGame: async playerId => {
    const saved = await db.prepare('SELECT state FROM blackjack_tables WHERE player_id=?').get(playerId);
    return saved ? JSON.parse(saved.state) : newGame();
  },
});
const API = { '/api/player': apiPlayer, '/api/deposit': apiDeposit, '/api/balance': apiBalance, '/api/currency': apiCurrency, '/api/history': ({ id }) => playerHistory(id) };

// Server-owned demo table; one PostgreSQL transaction commits wallet and shoe together.
// Post-commit observers are isolated so the Astrid-only probe cannot withhold partner rounds.
const nativeOptions = { db, getPlayer, logTx, ...createNativeObservationPublisher({ probeRuntime, partner, readPlayerResults, getPlayer, db,
  movingSpeech: () => movingSpeechService }) };
API['/api/table'] = createPostgresNativeTableCommand({ ...nativeOptions, pool: storage.gamePool });
const rouletteCommand = createPostgresRouletteCommand({ pool:storage.gamePool });
API['/api/roulette/table'] = async ({id,playerId,context,...request}) => {
  if (request.op === 'spin' && playerId !== id) throw Object.assign(Error('session_changed'),{statusCode:401});
  if (request.op === 'spin' && typeof request.currency !== 'string') throw Object.assign(Error('currency_changed'),{statusCode:400});
  if (!rouletteRoomAccess && (cloudRuntime || context && Object.keys(context).length)) throw Object.assign(Error('roulette_room_unavailable'),{statusCode:503});
  const access = rouletteRoomAccess ? await rouletteRoomAccess(context) : undefined;
  return rouletteCommand({id,...request},access);
};

// ---------- partner API v1 (operators / aggregators) ----------
let partnerApi = null;
const generationsApi = installGenerationsApi({
  tokenDigests: () => (process.env.GENERATIONS_READ_TOKENS ?? secretFromFiles('GENERATIONS_READ_TOKENS')).split(',').filter(Boolean),
  mapping: () => localMediaEnabled ? clipMapping({ root, resolveFile: publicAssetPath, publicUrl: process.env.PUBLIC_URL ?? 'https://bettalotto.se', revision: (() => { try { return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8', timeout: 2000 }).trim(); } catch { return null; } })() }) : null });
function partner() { return partnerApi ??= installPartnerApi({ db, boDb, shoeCommand, newGame, getPlayer, logTx, jwtSign, publicUrl: process.env.PUBLIC_URL ?? 'https://bettalotto.se', publicGamePath: publicGamePath(process.env), root,
  nativeMode:!localMediaEnabled,
  ...(studioMediaRuntime?{readMetadata:studioMediaRuntime.readMetadata,hasPublicMedia:studioMediaRuntime.hasPublicMedia}: {}) }); }

// ---------- native Studio identity and retained BO handoff/session ----------
// ---------- BO auth: JWT + craig (the auth DB) ----------
// Backoffice users live in CRAIG - the croupier_auth schema, separate from
// the players schema. Auth is a stateless HS256 JWT in an HttpOnly
// cookie, checked against a monotonic CRAIG auth epoch after every role or
// password change. Current logins survive server restarts.
const boDb = storage.boDb;
const { createPlayerAdministration, createPlayerPasswordCommand } = await import('../../packages/storage/server/player-administration.mjs');
const playerAdministration = createPlayerAdministration({ db, boDb });
const ROLE_RANK = { admin: 3, superadmin: 3 };
const boAuthEpoch = (await installBoAuthEpoch(boDb));
async function boSecret() {
  const row = (await boDb.prepare("SELECT v FROM meta WHERE k='jwt_secret'").get());
  if (row) return Buffer.from(row.v, 'hex');
  const sec = randomBytes(32);
  await boDb.prepare("INSERT INTO meta (k, v) VALUES ('jwt_secret', ?) ON CONFLICT(k) DO NOTHING").run(sec.toString('hex'));
  return Buffer.from((await boDb.prepare("SELECT v FROM meta WHERE k='jwt_secret'").get()).v, 'hex');
}
const BO_SECRET = (await boSecret());
const b64u = b => Buffer.from(b).toString('base64url');
function jwtSign(payload) {
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64u(JSON.stringify(payload));
  const sig = createHmac('sha256', BO_SECRET).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${sig}`;
}
function jwtVerify(tok) {
  const parts = (tok ?? '').split('.');
  if (parts.length !== 3) return null;
  const sig = createHmac('sha256', BO_SECRET).update(`${parts[0]}.${parts[1]}`).digest();
  const given = Buffer.from(parts[2], 'base64url');
  if (sig.length !== given.length || !timingSafeEqual(sig, given)) return null;
  try {
    const p = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (!p.exp || p.exp < Date.now() / 1000) return null;
    return p;
  } catch { return null; }
}
async function boCreateUser(username, pw, role = 'admin') {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(pw, salt, 64).toString('hex');
  (await boDb.prepare('INSERT INTO users (username, salt, hash, role, created_at) VALUES (?,?,?,?,?)')
    .run(username, salt, hash, role, new Date().toISOString()));
}
// Local fixtures provision their own identities; startup never creates or promotes them.
if (cloudRuntime && !(await boDb.prepare('SELECT COUNT(*) n FROM users').get()).n) {
  const username = process.env.CROUPIER_CLOUD_BOOTSTRAP_ADMIN_USER;
  const password = process.env.CROUPIER_CLOUD_BOOTSTRAP_ADMIN_PASSWORD;
  if (typeof username !== 'string' || !/^[a-z][a-z0-9._-]{2,63}$/.test(username)
    || username === 'kevin' || typeof password !== 'string'
    || password.length < 16 || password.length > 256 || /[\u0000-\u001f\u007f-\u009f]/u.test(password)) {
    throw new Error('Cloud operator bootstrap credentials are required for an empty CRAIG database.');
  }
  (await boCreateUser(username, password, 'superadmin'));
}
if (cloudRuntime) delete process.env.CROUPIER_CLOUD_BOOTSTRAP_ADMIN_PASSWORD;
async function administratorGameSession(req,account) {
  const current=await scoutIdentity.find(account.name);
  const role=(await boDb.prepare('SELECT role FROM users WHERE id=?').get(account.id))?.role;
  if(!current || current.id!==account.id || current.stamp!==account.stamp || !isAdministratorRole(role)) throw Error('Administrator identity changed');
  const tok=jwtSign({sub:account.name,role,aud:'backoffice',source_stamp:account.stamp,
    auth_epoch:await boAuthEpoch(account.id),exp:Math.floor(Date.now()/1000)+7*86400});
  const secure=req.socket.encrypted || process.env.NODE_ENV==='production' ? '; Secure' : '';
  return `bo_jwt=${tok}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure}`;
}
// The shared-origin logout has the same BO/Lab epoch boundary as native Studio
// logout. Clearing browser cookies alone cannot cancel in-flight requests.
async function backofficeGameLogout(req) {
  const revoke=async()=>{
    const boCookies=(req.headers.cookie??'').split(';').filter(value=>value.trim().startsWith('bo_jwt='));
    if(boCookies.length>1)throw Error('Ambiguous backoffice session');
    const account=await currentBackofficeAccount(req,{identity:scoutIdentity,boSession:boSessionOk,roles:['reader','staff','admin','superadmin']});
    if(!account)return;
    await boDb.prepare('INSERT INTO bo_auth_epochs (user_id,epoch) VALUES (?,1) ON CONFLICT(user_id) DO UPDATE SET epoch=bo_auth_epochs.epoch+1').run(account.id);
  };
  // PostgreSQL's existing transaction lock is shared with native Studio and
  // BO session issuance, including across the Vercel and Render processes.
  await boDb.transaction(revoke);
}
async function boSessionOk(req) {
  const c = req.headers.cookie ?? '';
  const m = /(?:^|;\s*)bo_jwt=([A-Za-z0-9_.-]+)/.exec(c);
  const claims = m ? jwtVerify(m[1]) : null;
  // Partner launch tokens use the same signer. Only a current, role-bearing
  // CRAIG login may authorize the remaining backoffice routes and the Lab handoff.
  if (!claims || claims.aud !== 'backoffice' || claims.partner ||
      typeof claims.sub !== 'string' || !Object.hasOwn(ROLE_RANK, claims.role) ||
      typeof claims.source_stamp !== 'string' || !Number.isSafeInteger(claims.auth_epoch)) return null;
  const account = (await scoutIdentity.find(claims.sub));
  if (!account || account.stamp !== claims.source_stamp ||
      (await boDb.prepare('SELECT role FROM users WHERE id = ?').get(account.id))?.role !== claims.role ||
      claims.auth_epoch !== (await boAuthEpoch(account.id))) return null;
  return { ...claims, sub: account.name };
}

// Retained read-only token source for the generations API. Native Studio owns
// administrator email, password and invitation flows.
const SECRET_FILES = [process.env.CROUPIER_ENV_FILE, '/etc/croupier/agent.env',
  join(process.env.HOME ?? '', '.config/croupier/agent.env'),
  join(process.env.HOME ?? '', 'Desktop/Axelio-Platform/.env')].filter(Boolean);
function secretFromFiles(name) {
  for (const file of SECRET_FILES) {
    try { const v = readSync(file, 'utf8').match(new RegExp(`^${name}=(.+)$`, 'm'))?.[1]?.trim(); if (v) return v.replace(/^["']|["']$/g, ''); } catch { /* next */ }
  }
  return '';
}
const BO_URL = process.env.BO_URL ?? 'https://backoffice.bettalotto.se';
const BO_ORIGIN = new URL(BO_URL);
function boPostOriginOk(req) {
  const origin = req.headers.origin;
  if (typeof origin !== 'string' || !URL.canParse(origin)) return false;
  const parsed = new URL(origin);
  if (parsed.origin !== origin) return false;
  let expected = req.headers.host === BO_ORIGIN.host ? BO_ORIGIN.origin : null;
  if (!expected && process.env.NODE_ENV !== 'production') {
    // The local Lissabon launcher does not configure a public BO_URL.
    try {
      const local = new URL(`http://${req.headers.host}`);
      if (['localhost', '127.0.0.1', '[::1]'].includes(local.hostname)) expected = local.origin;
    } catch { /* Invalid Host cannot authorize a BO POST. */ }
  }
  const fetchSite = req.headers['sec-fetch-site'];
  return origin === expected && (!fetchSite || fetchSite === 'same-origin');
}
const LEGACY_STUDIO_RETURNS = new Set(['/studio', '/studio/administration', '/control', '/control/administration']);
const LEGACY_STUDIO_TOKEN = /^[A-Za-z0-9_-]{32,128}$/;
function legacyBackofficeRedirect(req, pathname) {
  let destination = null;
  if (pathname === '/bo' || pathname === '/bo/' || pathname === '/bo/index.html') {
    destination = '/admin';
  } else if (pathname === '/bo/login.html') {
    const returnTo = new URL(req.url, 'http://local').searchParams.get('returnTo');
    destination = '/admin/login';
    if (returnTo && LEGACY_STUDIO_RETURNS.has(returnTo)) {
      destination += `?returnTo=${encodeURIComponent(returnTo)}`;
    }
  } else if (pathname === '/bo/set-password.html') {
    const token = new URL(req.url, 'http://local').searchParams.get('t');
    destination = '/admin/set-password';
    if (token && LEGACY_STUDIO_TOKEN.test(token)) destination += `?t=${encodeURIComponent(token)}`;
  }
  if (!destination) return false;
  if (!['GET', 'HEAD'].includes(req.method)) {
    return { status: 405, headers: { Allow: 'GET, HEAD', 'Cache-Control': 'no-store' } };
  }
  return { status: 308, headers: { Location: destination, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } };
}
const port = sharedRoomQa?.port ?? Number(process.env.PORT ?? 4173);
// 0.0.0.0 locally so phones on the LAN can open the demo; behind a reverse
// proxy set HOST=127.0.0.1 so the port is not exposed publicly.
const host = sharedRoomQa?.host ?? process.env.HOST ?? '0.0.0.0';
// Source files change constantly while this is being built; Chrome happily
// serves a cached app.mjs for a reload, so a change looks like it did nothing.
// Media (clips, audio, art) is content-addressed enough to keep caching.
const LIVE = new Set(['.html', '.mjs', '.js', '.css', '.json']);
const noStore = file => LIVE.has(extname(file))
  ? { 'Cache-Control': 'no-store, must-revalidate', Pragma: 'no-cache', Expires: '0' }
  : {};

const MIME = {
  '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.md': 'text/markdown; charset=utf-8',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.webp': 'image/webp', '.h264': 'application/octet-stream', '.mp3': 'audio/mpeg',
  '.webm': 'video/webm', '.mp4': 'video/mp4',
  '.svg': 'image/svg+xml',
};

// Dealer chat now runs exclusively through the deployed OpenClaw gateway.
// Product chat has one active decision owner: OpenClaw. It receives only this
// freshly projected public state and a closed speech/media allowlist.
const CHAT_REVISION = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;
const astridCameraEnabled = process.env.CROUPIER_ASTRID_CAMERA === '1'
  && process.env.CROUPIER_STREAM_LANE === 'lissabon-stream-lane';
const astridTranscription = createAstridTranscriptionApi({ apiKey: process.env.CROUPIER_ASTRID_TRANSLATION_KEY });
const astridVisionModels = new Set(['gpt-6-luna', 'gpt-5.6-terra']);

function chatSpeechPolicy() {
  return { recordedLines: [], generatedText: true, silence: true, mediaFamilies: [] };
}

async function authoritativeChatStatus(playerId, session, request, { allowCurrentRound = false } = {}) {
  const saved = (await db.prepare('SELECT state FROM blackjack_tables WHERE player_id=?').get(playerId));
  const game = saved ? JSON.parse(saved.state) : newGame();
  const view = shoeCommand(game, { op: 'state' }, 0).view;
  if (request.roundRevision !== String(view.version) && !(allowCurrentRound && request.roundRevision === undefined)) {
    const error = new Error('stale_round_revision'); error.statusCode = 409; throw error;
  }
  const receipt = (await db.prepare('SELECT version,payload FROM native_presentations WHERE player_id=?').get(playerId));
  let publishedEvents = [];
  if (receipt?.version === view.version) {
    try { publishedEvents = JSON.parse(receipt.payload); } catch { /* Invalid stored observations are never forwarded. */ }
  }
  const occupiedBoxes = [...new Set((view.round?.hands ?? []).map(hand => hand.box))].filter(Number.isInteger);
  const player = (await getPlayer(playerId));
  return {
    dealerId: request.dealerId, sessionRevision: request.sessionRevision, roundRevision: String(view.version),
    displayName: session?.displayName ?? player?.name ?? 'spelaren',
    ...(process.env.CROUPIER_STREAM_LANE === 'lissabon-stream-lane'
      ? { playResults: (await readPlayerResults(db, playerId, game, player.currency, { shared: false })) } : {}),
    round: view.round, occupiedBoxes, publishedEvents, policy: chatSpeechPolicy(request.dealerId),
  };
}

const scoutIdentity=(await craigIdentity(boDb));
const playerAccounts = process.env.CROUPIER_PLAYER_ACCOUNTS === '1';
const gameOrigin=sharedRoomQa?.publicOrigin??process.env.PUBLIC_URL??'https://bettalotto.se';
const frontendOrigin=sharedRoomQa?.publicOrigin??(cloudRuntime ? process.env.CROUPIER_VERCEL_FRONTEND_ORIGIN??'' : '');
// Single-origin ingress has no separate frontend origin; shared rooms then accept the canonical public origin.
const roomOrigins=sharedRoomOrigins({qaOrigin:sharedRoomQa?.publicOrigin,frontendOrigin});
const auth=(await playerAuth(db,apiPlayer,scoutIdentity,{playerAccounts,gameOrigin,frontendOrigin,administratorSession:administratorGameSession,sharedBackofficeOrigin:new URL(gameOrigin).origin===BO_ORIGIN.origin,backofficeLogout:backofficeGameLogout,authEpoch:boAuthEpoch,
  partnerAuthority: async partnerKeyId => boDb.prepare('SELECT id,secret,revoked_at,wallet_url FROM api_keys WHERE id=?').get(partnerKeyId)}));
const guestPreview = process.env.DEMO_GUEST_ACCESS === '1';
const playerSession = async req => (await auth.session(req));
async function previewPlayer(req,res) {
  const token=(req.headers.cookie??'').match(/(?:^|;\s*)preview_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  const digest=t=>createHash('sha256').update(t).digest('hex');
  const existing=token && (await db.prepare('SELECT player_id FROM preview_sessions WHERE digest=? AND expires>?').get(digest(token),Date.now()));
  if(existing && (await getPlayer(existing.player_id)))return existing.player_id;
  const p=await apiPlayer({name:'Product preview'}), fresh=randomBytes(32).toString('hex');
  (await db.prepare('DELETE FROM preview_sessions WHERE expires<=?').run(Date.now()));
  (await db.prepare('INSERT INTO preview_sessions VALUES (?,?,?)').run(digest(fresh),p.id,Date.now()+7*86400000));
  res.setHeader('Set-Cookie',`preview_session=${fresh}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800`);
  return p.id;
}
async function chatSessionOwner(req, playerId) {
  const playerToken = (req.headers.cookie ?? '').match(/(?:^|;\s*)player_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  if (playerToken && (await auth.session(req))?.playerId === playerId) return `player-${createHash('sha256').update(playerToken).digest('hex')}`;
  const previewToken = (req.headers.cookie ?? '').match(/(?:^|;\s*)preview_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  if (guestPreview && previewToken) {
    const digest = createHash('sha256').update(previewToken).digest('hex');
    const session = (await db.prepare('SELECT player_id FROM preview_sessions WHERE digest=? AND expires>?').get(digest, Date.now()));
    if (session?.player_id === playerId) return `preview-${digest}`;
  }
  throw Object.assign(new Error('stale_chat_session'), { statusCode: 401 });
}
// Opt-in operator rehearsal shares the real relay and its budget, but never
// calls player APIs or persists synthetic conversations in either database.
const operatorSpeechQa = createOperatorSpeechQa({
  directory: studioPolicyRuntime ? undefined : process.env.CROUPIER_GENERATED_SPEECH_DIR,
  journalRequired: Boolean(studioPolicyRuntime),
  gateStore: studioPolicyRuntime
    ? (await import('./postgres-operator-speech-qa.mjs')).createPostgresOperatorSpeechQa({pool:storage.pool,scope:studioPolicyRuntime.scope})
    : undefined,
  origin: process.env.PUBLIC_URL ?? gameOrigin,
  authenticate: boSessionOk,
  service: () => speechStreamService,
  decide: (request, status, signal) => openClawChat(request, status, {
    fetchImpl: ((url, options = {}) => fetch(url, { ...options,
        signal: options.signal ? AbortSignal.any([signal, options.signal]) : signal })),
  }),
});
// Every step runs even when another fails; the first failure is rethrown with
// its step and player. Chunks of 4 bound the probe step's pooled transactions.
const cancelPlayerRuntime=async (playerIds,reason)=>{
  let first;
  const cancelOne=async playerId=>{
    for(const [step,run] of [['speech',()=>speechStreamService?.cancelPlayer(playerId)],
      ['chat',()=>cancelPlayerChats(activePlayerChats,playerId,reason)],['probe',()=>probeRuntime.cancel({playerId,dealerId:'astrid'},reason)]]){
      try{await run();}catch(error){first??=Object.assign(new Error(error?.message),{statusCode:error?.statusCode,step,subject:playerId});}
    }
  };
  const ids=[playerIds].flat();
  for(let index=0;index<ids.length;index+=4)await Promise.allSettled(ids.slice(index,index+4).map(cancelOne));
  if(first)throw first;
};
const studioGameCommand = studioPolicyRuntime ? createStudioGameCommandApi({
  // The isolated K04 QA start forbids the ingress secret variable; a random
  // per-process secret keeps the Studio command surface unusable there.
  scope: studioPolicyRuntime.scope, secret: sharedRoomQa ? randomBytes(32).toString('hex') : process.env.CROUPIER_VERCEL_INGRESS_SECRET,
  publicOrigin: process.env.CROUPIER_PUBLIC_ORIGIN,
  authorize: createStudioNativeAuth({ boDb, scope: studioPolicyRuntime.scope }), boDb,
  execute: async ({ action, body, actor, afterCommit }) => {
    // Runtime cancellation follows the committed account change and cannot undo it.
    if (action === 'players/password' && !createPlayerPasswordCommand) throw Object.assign(new Error('Player administration unavailable'), { statusCode: 503 });
    if (action === 'players/password') return createPlayerPasswordCommand({ administration: playerAdministration,
      cancelRuntime: async playerId => { afterCommit(() => cancelPlayerRuntime(playerId, 'player_password_changed'), 'players/password:cancel'); } })({ body, actor });
    if (action === 'players/status') {
      const changed = await playerAdministration.setStatus({ ...body, actor: actor.user });
      if (changed.changed || changed.status !== 'active') afterCommit(() => cancelPlayerRuntime(changed.id, 'player_account_changed'), 'players/status:cancel');
      return { ok: true, ...changed };
    }
    const method = { 'apikeys/revoke': 'revoke', 'apikeys/rotate': 'rotate', 'apikeys/launch': 'mintLaunch', 'apikeys/credit': 'credit' }[action];
    if (!method || typeof body?.id !== 'string') throw Object.assign(new Error('Invalid Studio game command'), { statusCode: 400 });
    const result = await (await partner()).keys[method](body.id, body);
    if (action === 'apikeys/revoke' || action === 'apikeys/rotate') {
      const prefix = `partner:${body.id}`;
      const sessions = await db.prepare('SELECT DISTINCT player_id FROM player_sessions WHERE source_stamp=? OR source_stamp LIKE ?').all(prefix,`${prefix}:%`);
      await db.prepare('DELETE FROM player_sessions WHERE source_stamp=? OR source_stamp LIKE ?').run(prefix,`${prefix}:%`);
      // One hook for the whole batch: a partner may exceed the per-command hook cap.
      if (sessions.length) afterCommit(() => cancelPlayerRuntime(sessions.map(row => row.player_id), 'partner_key_changed'), 'apikeys:cancel');
    }
    return { ok: true, ...result };
  },
}) : null;
// The isolated K04 QA start has no Lab origin; its Lab session check stays off.
const studioLabSession = studioPolicyRuntime && !sharedRoomQa ? createStudioLabSessionCheck({
  authorize: createStudioNativeAuth({boDb,scope:studioPolicyRuntime.scope}),
  publicOrigin:process.env.CROUPIER_PUBLIC_ORIGIN,labOrigin:process.env.LAB_PUBLIC_URL,
}) : null;
const studioPreview = studioPolicyRuntime ? await (async () => {
  const { createStudioPreview } = await import('./studio-preview.mjs');
  const { getPrivateMedia } = await import('./blob-media.mjs');
  return createStudioPreview({ authorize:createStudioNativeAuth({boDb,scope:studioPolicyRuntime.scope}),
    scope:studioPolicyRuntime.scope,repository:studioPolicyRuntime.repository,
    registryLoader:studioMediaRuntime.videoRegistryCaptured,
    privateMedia:sharedRoomQa?.privateMedia ?? ((record,request)=>getPrivateMedia(record,request,{repositoryRoot:mediaRepository})),
    bankVideoResponse:(id,request,snapshot)=>studioMediaRuntime.videoResponseCaptured(id,request,snapshot),
    readHtml:async()=>readSync(join(root,'index.html'),'utf8'),origin:process.env.CROUPIER_PUBLIC_ORIGIN||gameOrigin,
  });
})() : null;
const server = createServer(async (req, res) => {
  try {
  if (movingSpeechService && await movingSpeechService.handleHttp(req,res)) return;
  if (await handleSharedRoomHttp(req,res,{command:sharedRoomCommand,engineOrigin:sharedRoomQa?.publicOrigin ?? process.env.CROUPIER_PUBLIC_ORIGIN ?? gameOrigin})) return;
  const pathname=new URL(req.url,'http://local').pathname;
  if (sharedRoomsEnabled && pathname === '/__cloud/shared-room-health') {
    const health = sharedRoomService?.health() ?? { ready:false };
    res.writeHead(health.ready ? 200 : 503, { 'Content-Type':'application/json', 'Cache-Control':'private, no-store' });
    res.end(JSON.stringify(health)); return;
  }
  if (pathname==='/api/studio-preview'||pathname.startsWith('/api/studio-preview/')||pathname.startsWith('/studio-preview/')) {
    if(!studioPreview){res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'private, no-store'});res.end('{"error":"studio_preview_unavailable"}');return;}
    const request=new Request((process.env.CROUPIER_PUBLIC_ORIGIN||gameOrigin)+req.url,{method:req.method,headers:req.headers,
      ...(!['GET','HEAD'].includes(req.method)?{body:Readable.toWeb(req),duplex:'half'}:{})});
    const response=await studioPreview.handle(request);
    if(!response){res.writeHead(404,{'Cache-Control':'private, no-store'});res.end();return;}
    res.writeHead(response.status,Object.fromEntries(response.headers));
    if(response.body&&req.method!=='HEAD')Readable.fromWeb(response.body).on('error',()=>res.destroy()).pipe(res);else res.end();
    return;
  }
  if (pathname === '/api/presentation/capabilities' && req.headers['x-presentation-capability-version'] === '9') {
    const ready = (await storage.gamePool.query("SELECT to_regclass('croupier_game.roulette_tables') AS ready")).rows[0]?.ready;
    if (!ready) { res.writeHead(503,{'Cache-Control':'no-store'}); res.end(); return; }
  }
  const capability= presentationCapabilitiesResponse(new Request('http://local'+req.url,{method:req.method,headers:req.headers??{}}));
  if(capability){res.writeHead(capability.status,Object.fromEntries(capability.headers));res.end(req.method==='HEAD'?undefined:await capability.text());return;}
  const compositionModule=await compositionRuntimeResponse(new Request('http://local'+req.url,{method:req.method}));
  if(compositionModule){res.writeHead(compositionModule.status,Object.fromEntries(compositionModule.headers));res.end(req.method==='HEAD'?undefined:Buffer.from(await compositionModule.arrayBuffer()));return;}
  if (pathname === '/api/studio-game/command') {
    if (!studioGameCommand) { res.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end('{"error":"studio_game_command_unavailable"}'); return; }
    const request = new Request(`${process.env.CROUPIER_PUBLIC_ORIGIN}${req.url}`, { method: req.method, headers: req.headers,
      ...(req.method === 'POST' ? { body: Readable.toWeb(req), duplex: 'half' } : {}) });
    const result = await studioGameCommand(request);
    res.writeHead(result.status, Object.fromEntries(result.headers)); res.end(await result.text()); return;
  }
  if (isRetiredBackofficePost({ studioPolicyActive: Boolean(studioPolicyRuntime), method: req.method, pathname })) {
    res.writeHead(410, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end('{"error":"legacy_administration_retired"}'); return;
  }
  if (pathname === '/api/auth/access') {
    // Render's process supervisor waits on this route (ops/cloud/process-group.mjs).
    // The BO-to-game handoff behind it is retired; it only reports a player session.
    const status = !['GET', 'HEAD'].includes(req.method) ? 405 : (await auth.user(req)) ? 200 : 401;
    res.writeHead(status, { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', ...(status === 405 ? { Allow: 'GET, HEAD' } : {}) });
    res.end(); return;
  }
  if (studioLabSession && pathname === '/api/auth/lab/check') {
    const checked = await studioLabSession(req);
    res.writeHead(checked.status,Object.fromEntries(checked.headers));res.end();return;
  }
  { const u=new URL(req.url,neonStudioEnabled ? gameOrigin : 'http://local'); const launch=u.searchParams.get('launch');
    if(['/', '/game', '/game/', ...(neonStudioEnabled ? ['/blackjack','/blackjack/'] : [])].includes(pathname) && launch){ const claims=jwtVerify(launch);
      if(!claims?.sub||!claims.partner||!(await getPlayer(claims.sub))){res.writeHead(403,{'Content-Type':'text/plain'});res.end('Launch token invalid or expired');return;}
      u.searchParams.delete('launch');
      // A partner launch is a blackjack start and lands on the one public game start.
      const destination = neonStudioEnabled ? launchGameStart(u.searchParams,{origin:u.origin})
        : (gamePath === '/game' ? '/game' : u.pathname)+u.search;
      if(!destination){res.writeHead(400,{'Content-Type':'text/plain','Cache-Control':'no-store'});res.end('This launch opens blackjack only');return;}
      let sessionCookie;
      try { sessionCookie = await auth.fromPartner(req,claims); }
      catch { res.writeHead(403, {'Content-Type':'text/plain','Cache-Control':'no-store'}); res.end('Launch token invalid or expired'); return; }
      res.writeHead(303,{Location:destination,'Set-Cookie':sessionCookie});res.end();return; } }
  try {
    const loggingOut=pathname==='/api/auth/logout'?(await auth.session(req)):null;
    if(await auth.handle(req,res)){
      if(loggingOut && res.statusCode===200){cancelPlayerChats(activePlayerChats,loggingOut.playerId,'player_logged_out');speechStreamService?.cancelPlayer(loggingOut.playerId);(await probeRuntime.cancel({playerId:loggingOut.playerId,dealerId:'astrid'},'logout'));}
      return;
    }
  } catch { if(!res.headersSent){res.writeHead(400);res.end('Invalid request');}return; }
  if(pathname==='/login.html'){res.writeHead(303,{Location:'/'});res.end();return;}
  const legacyBoRedirect = legacyBackofficeRedirect(req, pathname);
  if (legacyBoRedirect) {
    res.writeHead(legacyBoRedirect.status, legacyBoRedirect.headers);
    res.end(); return;
  }
  if(pathname.startsWith('/api/v1/generations')&&await generationsApi(req,res,pathname))return;
  if(pathname==='/api/v1/events'&&req.method==='GET'){ (await (await partner()).handleEvents(req,res,new URL(req.url,'http://local'))); return; }
  if(pathname.startsWith('/api/v1/')){ if(req.method!=='POST'){res.writeHead(405,{'Content-Type':'application/json'});res.end('{"error":"POST only"}');return;} await (await partner()).handle(req,res,pathname); return; }
  const backoffice=pathname==='/bo'||pathname.startsWith('/bo/')||pathname.startsWith('/api/bo/');
  if (pathname === '/api/operators' || pathname.startsWith('/api/operators/')) {
    if (pathname.includes('/preview')) {
      if(!publicOperatorPreview){res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'private, no-store'});res.end('{"error":"operator_preview_unavailable"}');return;}
      const preview=await publicOperatorPreview.handle(new Request(gameOrigin+req.url,{method:req.method,headers:req.headers}));
      if(preview){res.writeHead(preview.status,Object.fromEntries(preview.headers));if(!preview.body){res.end();return;}
        const stream=Readable.fromWeb(preview.body);res.once('close',()=>stream.destroy());stream.once('error',()=>res.destroy());stream.pipe(res);return;}
    }
    if (await publicOperatorRooms.handle(req, res, pathname)) return;
    if (await handlePlayerSurface(req, res, pathname, {operators: publicOperators})) return;
  }
  let authenticated=(await playerSession(req))?.playerId ?? null;
  const playerEntry=['/blackjack','/blackjack/','/roulette','/roulette/','/play/roulette','/play/roulette/'].includes(pathname);
  if (['/roulette','/roulette/','/play/roulette','/play/roulette/','/roulette/app.mjs','/roulette/style.css','/roulette/scene.mjs','/roulette/media.mjs','/roulette/table-layout.mjs','/roulette/assets/roulette-bord.png','/roulette-rules.mjs'].includes(pathname)
      && await rouletteDocument(req,res,{authenticated,guestPreview,resolveRoom:rouletteRoomAccess})) return;
  if (pathname === '/api/profile') {
    if (await handlePlayerSurface(req, res, pathname, {
      db, playerId: authenticated, guest: false,
      originOk: playerPostOriginOk(req, {gameOrigin, frontendOrigin}),
    })) return;
  }
  if (neonStudioEnabled && ['/blackjack','/blackjack/'].includes(pathname) && !authenticated && ['GET','HEAD'].includes(req.method)) {
    res.writeHead(303,{Location:playerLoginDestination(new URL(req.url,gameOrigin)), 'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});
    res.end(); return;
  }
  const guest=guestPreview && !authenticated && !backoffice && (pathname.startsWith('/api/') || pathname==='/chat');
  if(guest)authenticated=(await previewPlayer(req,res));
  if(pathname==='/api/auth/session' && req.method==='GET'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({authenticated:!!authenticated && !guest,guest,sharedCredentials:true,...(playerAccounts ? {playerAccounts:true} : {})}));return;}
  if(!authenticated&&!backoffice && (pathname.startsWith('/api/')||!['GET','HEAD'].includes(req.method))) {
    res.setHeader('Cache-Control','no-store');
    if(pathname.startsWith('/api/')||!['GET','HEAD'].includes(req.method)){res.writeHead(401,{'Content-Type':'application/json'});res.end('{"error":"Sign in required"}');}
    else {res.writeHead(303,{Location:'/login.html'});res.end();}
    return;
  }
  if(authenticated && !backoffice && req.method==='POST' && !playerPostOriginOk(req,{gameOrigin,frontendOrigin})) {
    res.writeHead(403);res.end('Invalid origin');return;
  }
  if (pathname === '/api/roulette/table' && req.method !== 'POST') {
    res.writeHead(405,{'Content-Type':'application/json','Cache-Control':'no-store',Allow:'POST'}); res.end('{"error":"POST only"}'); return;
  }
  if(!backoffice) res.setHeader('Cache-Control','no-store');
  if (pathname === '/api/operator/appearance') {
    const result = operatorAppearanceApi ? await operatorAppearanceApi(new Request(new URL(req.url,gameOrigin),{method:req.method})) : new Response(JSON.stringify({error:'operator_appearance_unavailable'}),{status:503,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store'}});
    res.writeHead(result.status,Object.fromEntries(result.headers));res.end(await result.text());return;
  }
  if (['/api/astrid/observation','/api/dealer/observation'].includes(pathname) && req.method === 'GET') {
    try {
      const query = new URL(req.url,'http://local').searchParams;
      if ([...query.keys()].some(key => !['dealer','presentationContext'].includes(key) || query.getAll(key).length !== 1)) throw Error('invalid_chat_context');
      const dealerId = pathname === '/api/astrid/observation' ? 'astrid' : query.get('dealer');
      const rawContext = query.get('presentationContext');
      if (rawContext && rawContext.length > 512) throw Object.assign(Error('invalid_chat_context'),{statusCode:400});
      const authorization = await authorizeChatDealer({dealerId,presentationContext:rawContext ? JSON.parse(rawContext) : null});
      await authorization.recheck();
      const config = await probeRuntime.config();
      const enabled = astridCameraEnabled;
      const profileRevision = enabled ? createHash('sha256').update((await chatSessionOwner(req, authenticated))).digest('hex') : null;
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' });
      res.end(JSON.stringify({ enabled, profileRevision, model: config.policy.model,
        reason: !enabled ? 'feature_disabled' : !astridTranscription.configured ? 'transcription_unavailable' : null,
        vision: { enabled: enabled && astridVisionModels.has(config.policy.model),
          reason: !enabled ? 'feature_disabled' : !astridVisionModels.has(config.policy.model) ? 'model_not_verified' : null },
        transcription: { enabled: enabled && astridTranscription.configured, provider: 'openai', model: 'whisper-1',
          outputLanguage: 'original', acceptsAutoLanguage: true } }));
    } catch { res.writeHead(503, { 'Content-Type': 'application/json' }); res.end('{"enabled":false}'); }
    return;
  }
  if (['/api/astrid/transcription','/api/dealer/transcription'].includes(pathname)) {
    const ownerRevision = async () => createHash('sha256').update((await chatSessionOwner(req, authenticated))).digest('hex');
    let profileRevision, authorization, dealerId;
    try {
      dealerId = pathname === '/api/astrid/transcription' ? 'astrid' : req.headers['x-astrid-dealer'];
      const rawContext = req.headers['x-dealer-presentation-context'];
      if (rawContext && (typeof rawContext !== 'string' || rawContext.length > 512)) throw Error('invalid_chat_context');
      authorization = await authorizeChatDealer({dealerId,presentationContext:rawContext ? JSON.parse(rawContext) : null});
      profileRevision = (await ownerRevision());
    }
    catch { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end('{"error":"stale_transcription_context"}'); return; }
    await astridTranscription.handle(req, res, { enabled: astridCameraEnabled, profileRevision, dealerId,
      checkCurrent: async context => {
        await authorization.recheck();
        if ((await ownerRevision()) !== profileRevision) {
          throw Object.assign(new Error('stale_transcription_context'), { code: 'stale_transcription_context', statusCode: 409 });
        }
        (await authoritativeChatStatus(authenticated, (await playerSession(req)), context));
      } });
    return;
  }
  if (pathname === '/api/probe' || pathname.startsWith('/api/probe/')) {
    const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'private, no-store'});res.end(JSON.stringify(value));};
    const scope={playerId:authenticated,dealerId:'astrid'};
    const controller=new AbortController();
    const disconnected=()=>{if(!res.writableEnded)controller.abort();};res.once('close',disconnected);
    try {
      const owner=(await chatSessionOwner(req,authenticated));
      if(pathname==='/api/probe'&&req.method==='GET'){json(200,await probeRuntime.inspect(scope));return;}
      if(req.method!=='POST')throw Object.assign(new Error('method_not_allowed'),{code:'method_not_allowed',statusCode:405});
      let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>12000)throw Object.assign(new Error('request_too_large'),{code:'request_too_large',statusCode:413});}
      const body=JSON.parse(raw||'{}');
      const context={owner,signal:controller.signal,readOwner:async ()=>(await chatSessionOwner(req,authenticated)),
        readState:async ()=>({playerId:authenticated,...(await authoritativeChatStatus(authenticated,(await playerSession(req)),{dealerId:'astrid',sessionRevision:body.sessionRevision,roundRevision:body.roundRevision}))})};
      if(pathname==='/api/probe/presence')json(200,await probeRuntime.presence(scope,body,owner));
      else if(pathname==='/api/probe/forget'){
        activePlayerChats.get(JSON.stringify([authenticated,'astrid']))?.abort('chat_memory_changed');
        speechStreamService?.cancelPlayer(authenticated);
        (await probeRuntime.forget(scope,body.factId));json(200,await probeRuntime.inspect(scope));
      }
      else if(pathname==='/api/probe/decide'||pathname==='/api/probe/receipt'||pathname==='/api/probe/test'){
        if(!CHAT_REVISION.test(body.sessionRevision)||!CHAT_REVISION.test(body.roundRevision))throw Object.assign(new Error('invalid_probe_context'),{code:'invalid_probe_context',statusCode:400});
        if(pathname.endsWith('/test')){
          if(!guestPreview || host!=='127.0.0.1' || process.env.NODE_ENV==='production')throw Object.assign(new Error('probe_test_local_only'),{code:'probe_test_local_only',statusCode:403});
          json(200,await probeRuntime.test(scope,body,context));
        }else json(200,pathname.endsWith('/decide')?await probeRuntime.run(scope,body,context):await probeRuntime.receipt(scope,body,context));
      } else throw Object.assign(new Error('not_found'),{code:'not_found',statusCode:404});
    }catch(error){if(!res.destroyed)json(error.statusCode||400,{error:error.code||'probe_failed'});}
    finally{res.removeListener('close',disconnected);}
    return;
  }
  if (pathname.startsWith('/api/presentation/') && !pathname.startsWith('/api/presentation/layers/') || presentationPublicSource(pathname)) {
    try {
      presentationApi ??= (await import('./presentation-api.mjs')).createPresentationApi({ db, frozenDealerContext, qaPublicOrigin:sharedRoomQa?.publicOrigin,
        ...(sharedRoomsEnabled?(await import('./shared-room-presentation-http.mjs')).createSharedRoomPresentationBridge({
          service:()=>sharedRoomService,origin:roomOrigins.origin,engineOrigin:roomOrigins.engineOrigin}):{}),
        beforeActionPresentation:({playerId,version})=>movingSpeechService?.normalPresentation(playerId,version),
        ...(studioPolicyRuntime ? { store: studioPolicyRuntime.policy.projectStore(), registryLoader: studioMediaRuntime.videoRegistry,
          videoResponse: studioMediaRuntime.videoResponse } : {}) });
      if (await presentationApi(req, res, pathname, authenticated)) return;
    } catch { res.writeHead(503, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Local presentation unavailable' })); return; }
  }
  if (pathname === '/api/chat/memory' || pathname === '/api/chat/memory/forget') {
    const respond = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' }); res.end(JSON.stringify(value)); };
    const handle = async incoming => {
      try {
        (await chatSessionOwner(req, authenticated));
        const {dealerId}=await authorizeChatDealer({dealerId:incoming?.dealer,presentationContext:incoming?.presentationContext});
        const scope = { playerId: authenticated, dealerId };
        if (pathname.endsWith('/forget')) {
          const key = JSON.stringify([authenticated, dealerId]);
          activePlayerChats.get(key)?.abort('chat_memory_changed');
          if (dealerId === 'astrid') speechStreamService?.cancelPlayer(authenticated);
          (await probeRuntime.forget(scope));
          respond(200, (await playerChatMemory.forget(scope)));
        } else respond(200, (await playerChatMemory.profile(scope)));
      } catch (error) { respond(error.statusCode || 400, { error: error.code || error.message }); }
    };
    if (pathname === '/api/chat/memory' && req.method === 'GET') {
      try {
        const query=new URL(req.url,'http://local').searchParams,raw=query.get('presentationContext');
        if(query.getAll('dealer').length!==1||query.getAll('presentationContext').length>1
          ||raw!==null&&raw.length>1024)throw Error('invalid');
        await handle({dealer:query.get('dealer'),...(raw!==null?{presentationContext:JSON.parse(raw)}:{})});
      } catch {respond(400,{error:'invalid_chat_context'});}
    }
    else if (pathname.endsWith('/forget') && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; if (body.length > 2000) req.destroy(); });
      req.on('end', async () => { try { (await handle(JSON.parse(body || '{}'))); } catch { respond(400, { error: 'invalid_request' }); } });
    } else respond(405, { error: 'method_not_allowed' });
    return;
  }
  if (pathname.startsWith('/api/generated-speech/')) {
    try {
      const match = /^\/api\/generated-speech\/([a-f0-9-]{32,64})\/(audio|video)$/.exec(pathname);
      const service = getGeneratedSpeechService();
      if (!match || !service || !['GET', 'HEAD'].includes(req.method)) { res.writeHead(404); res.end(); return; }
      const media = await service.media({ id: match[1], kind: match[2], owner: (await chatSessionOwner(req, authenticated)) });
      res.writeHead(200, { 'Content-Type': media.contentType, 'Content-Length': media.bytes.length, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : media.bytes);
    } catch (error) { res.writeHead(error.statusCode || 404); res.end(); }
    return;
  }
  // Retired local writer: placement is owned by the published Admin layout.
  if (req.method === 'POST' && req.url === '/calibration') {
    res.writeHead(403, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end('{"error":"calibration_unavailable"}');
    return;
  }

  if (req.method === 'POST' && pathname.startsWith('/api/bo/') && !boPostOriginOk(req)) {
    res.writeHead(403, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end('{"error":"Invalid origin"}'); return;
  }
  if (await operatorSpeechQa.handle(req, res, pathname)) return;
  if (pathname.startsWith('/api/bo/')) {
    res.writeHead(404, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end('{"error":"not found"}'); return;
  }
  if (pathname.startsWith('/bo/') && !(await boSessionOk(req))) {
    res.writeHead(302, { Location: '/admin/login', 'Cache-Control': 'no-store' });
    res.end(); return;
  }
  if (req.method === 'POST' && req.url === '/chat') {
    const controller = new AbortController();
    const stream = req.headers.accept === 'application/x-ndjson';
    const startedAt = performance.now();
    const responseStream = createChatResponseStream(res, { signal: controller.signal, startedAt });
    const frame = responseStream.frame;
    const disconnected = () => { if (!res.writableEnded) controller.abort(); };
    res.once('close', disconnected);
    let body = '', bytes = 0, tooLarge = false;
    req.on('data', c => {
      if (tooLarge) return;
      bytes += c.length;
      if (bytes > 224 * 1024) {
        tooLarge = true; body = '';
        res.writeHead(413, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end('{"error":"request_too_large"}');
      } else body += c;
    });
    req.on('end', async () => {
      if (tooLarge) return;
      let memoryTurn, memoryKey, expectedMemoryRevision;
      try {
        const incoming = JSON.parse(body || '{}');
        const owner = await chatSessionOwner(req, authenticated);
        const chatAuthorization=await authorizeChatDealer({dealerId:incoming?.dealer,presentationContext:incoming?.presentationContext});
        const dealerId=chatAuthorization.dealerId;
        if (!dealerId || !CHAT_REVISION.test(incoming.sessionRevision) || !CHAT_REVISION.test(incoming.roundRevision)) {
          res.writeHead(400, { 'Content-Type': 'application/json' }); res.end('{"error":"invalid_chat_context"}'); return;
        }
        const session = (await playerSession(req));
        const status = (await authoritativeChatStatus(authenticated, session, { dealerId, sessionRevision: incoming.sessionRevision, roundRevision: incoming.roundRevision }));
        speechStreamService?.cancelOwner(owner);
        const voiceConfig = await probeRuntime.config();
        const probeConfig = dealerId === 'astrid' ? voiceConfig : null;
        let observation;
        if (incoming.observation !== undefined) {
          if (!astridCameraEnabled) throw Object.assign(new Error('observation_disabled'), { statusCode: 403 });
          if (!req.headers.origin || !URL.canParse(req.headers.origin)
            || !['http:', 'https:'].includes(new URL(req.headers.origin).protocol)
            || new URL(req.headers.origin).origin !== req.headers.origin
            || new URL(req.headers.origin).host !== req.headers.host || req.headers['sec-fetch-site'] === 'cross-site') {
            throw Object.assign(new Error('observation_same_origin_required'), { statusCode: 403 });
          }
          if (!astridVisionModels.has(voiceConfig.policy.model)) throw Object.assign(new Error('observation_model_not_verified'), { statusCode: 409 });
          observation = normalizeAstridObservation(incoming.observation, incoming.requestId, dealerId,
            createHash('sha256').update(owner).digest('hex'));
        }
        const scope = { playerId: authenticated, dealerId };
        await probeRuntime.cancel(scope);
        memoryTurn = (await playerChatMemory.begin({ ...scope, requestId: incoming.requestId, message: incoming.message }));
        expectedMemoryRevision = memoryTurn.revision;
        memoryKey = JSON.stringify([authenticated, dealerId]);
        activePlayerChats.set(memoryKey, controller);
        const conversation = probeConfig ? (await probeStore.conversation(scope, probeConfig.policy)) : null;
        if (conversation) status.conversationMemory = conversation.context;
        // Neither a browser-supplied player ID nor fabricated assistant history
        // may enter the model. Stable identity and bounded recall are server-owned.
        const request = { requestId: incoming.requestId, message: incoming.message, history: memoryTurn.history,
          ...(observation ? { observation } : {}) };
        const readStatus = async () => {
          await chatAuthorization.recheck();
          if (conversation) {
            const currentPolicy = (await probeRuntime.config()).policy;
            if (['memoryEnabled','memoryDays','maxFacts'].some(key => currentPolicy[key] !== probeConfig.policy[key])) {
              throw Object.assign(new Error('stale_chat_memory'), { statusCode: 409 });
            }
          }
          if ((await playerChatMemory.profile(scope)).revision !== expectedMemoryRevision) throw Object.assign(new Error('stale_chat_memory'), { statusCode: 409 });
          if (conversation && !(await probeStore.conversationCurrent(scope, conversation))) throw Object.assign(new Error('stale_chat_memory'), { statusCode: 409 });
          return (await authoritativeChatStatus(authenticated, (await playerSession(req)), { dealerId, sessionRevision: incoming.sessionRevision, roundRevision: incoming.roundRevision }));
        };
        const speechTrace = randomBytes(8).toString('hex');
        const registeredSpeech = await dealerSpeechRuntime?.requested(dealerId);
        const selectedSpeechStream = movingSpeechService?.supports(dealerId)
          ? movingSpeechService.forContext(chatAuthorization.presentationContext,incoming.presentationVersion,incoming.sessionRevision) : speechStreamService;
        if(incoming.presentationVersion!==undefined&&(!movingSpeechService?.supports(dealerId)
          ||!Number.isSafeInteger(incoming.presentationVersion)||String(incoming.presentationVersion)!==incoming.roundRevision))
          throw Object.assign(Error('invalid_moving_deal_context'),{statusCode:409});
        if (registeredSpeech && (typeof selectedSpeechStream?.prepare !== 'function' || incoming.acceptsSpeechStream !== true)) throw Object.assign(Error('generated_speech_stream_required'), {statusCode:503});
        const decision = await completeChatWithSpeech({ request, status, owner, playerId: authenticated,
          onTiming: (stage, ms) => {
            if (speechStreamService && incoming.acceptsSpeechStream === true && Number.isSafeInteger(ms) && ms >= 0) {
              // A request-local random correlation key; never log text, player ids,
              // cookies, tickets, provider responses or credential-bearing URLs.
              console.info(JSON.stringify({ event: 'astrid_speech_timing', trace: speechTrace, stage, ms }));
            }
          },
          onProgress: (stage, metrics) => { if (stream && Object.hasOwn(CHAT_STAGES, stage)) frame({ type: 'progress', stage, elapsedMs: Math.round(performance.now() - startedAt), ...(metrics ? { metrics } : {}) }); },
          onDecision: exactText => { if (stream) frame({ type: 'preview', exactText }); },
          readOwner: async () => (await chatSessionOwner(req, authenticated)),
          readStatus,
          signal: controller.signal,
          decide: async (value, state) => {
            const model = probeConfig?.policy.model ?? (observation ? voiceConfig.policy.model : 'gateway-default');
            return openClawChat(value, state, { model, fetchImpl: ((url, options = {}) => fetch(url, {
              ...options, signal: options.signal ? AbortSignal.any([controller.signal, options.signal]) : controller.signal,
            })) });
          },
          service: dealerId==='astrid'?getGeneratedSpeechService():null,
          streamService: (dealerId==='astrid'||registeredSpeech)&&incoming.acceptsSpeechStream === true ? selectedSpeechStream : null,
        });
        // completeChatWithSpeech rechecks ownership/round after all async work.
        // Persist a generated response, never claim the browser has played it.
        const memoryReceipt = (await memoryTurn.commit({ kind: decision.kind, exactText: decision.exactText }));
        // This reply's own commit is expected; a later forget/turn remains stale.
        expectedMemoryRevision = memoryReceipt.revision;
        // The memory commit awaits storage: recheck publication and session before returning it.
        await readStatus();
        if(await chatSessionOwner(req,authenticated)!==owner)throw Object.assign(Error('stale_chat_session'),{statusCode:401});
        if(controller.signal.aborted)throw Object.assign(Error('chat_cancelled'),{statusCode:409});
        if(dealerId==='astrid')void probeRuntime.rememberMessage(scope,incoming.requestId,incoming.message).catch(()=>{});
        if (stream) { frame({ type: 'result', decision }); res.end(); return; }
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify(decision));
      } catch (e) {
        try { if (controller.signal.aborted) await memoryTurn?.cancel(); else await memoryTurn?.fail(); }
        catch { /* Failed persistence cleanup must not replace the original response. */ }
        if (res.destroyed) return;
        if (stream && res.headersSent) {
          frame({ type: 'error', error: controller.signal.aborted ? 'chat_cancelled' : persistenceFailure(e) ? publicFailure(e).error : e?.code || String(e.message || e) });
          res.end(); return;
        }
        if (controller.signal.aborted) {
          res.writeHead(409, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
          res.end(JSON.stringify({ error: controller.signal.reason === 'chat_memory_changed' ? 'chat_memory_changed' : 'chat_cancelled' }));
          return;
        }
        const status = persistenceFailure(e) ? 503 : Number.isInteger(e?.statusCode) ? e.statusCode : 502;
        res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ error: persistenceFailure(e) ? publicFailure(e).error : e?.code || String(e.message || e) }));
      } finally {
        responseStream.close();
        if (activePlayerChats.get(memoryKey) === controller) activePlayerChats.delete(memoryKey);
        res.removeListener('close', disconnected);
      }
    });
    return;
  }
  if (req.method === 'POST' && API[req.url]) {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 10000) req.destroy(); });
    req.on('end', async () => {
      let out;
      try {
        const activeSession=(await playerSession(req));
        if (req.url === '/api/roulette/table' && !guestPreview && activeSession?.playerId !== authenticated) throw Object.assign(Error('session_changed'),{statusCode:401});
        if (req.url === '/api/roulette/table' && activeSession?.partnerKeyId) throw Object.assign(Error('roulette_native_account_required'),{statusCode:403});
        const incoming=JSON.parse(body||'{}');let commandSession=activeSession;
        if(req.url==='/api/table'&&incoming.movingSpeech!==undefined){
          if(incoming.op!=='start'||typeof incoming.movingSpeech?.sessionRevision!=='string'
            ||!CHAT_REVISION.test(incoming.movingSpeech.sessionRevision))
            throw Object.assign(Error('invalid_moving_deal_context'),{statusCode:409});
          // An open browser can retain the speech option after it is disabled.
          // Reject before the table command can debit or deal; never retry it.
          if(!movingSpeechService)throw Object.assign(Error('moving_deal_speech_unavailable'),{statusCode:409});
          if(!movingSpeechService.supports(incoming.dealer))throw Object.assign(Error('invalid_moving_deal_context'),{statusCode:409});
          const access=await authorizeChatDealer({dealerId:incoming.dealer,presentationContext:incoming.movingSpeech.context});
          if(!access.presentationContext)throw Object.assign(Error('moving_deal_room_required'),{statusCode:409});
          commandSession={...activeSession,movingSpeech:{context:access.presentationContext,sessionRevision:incoming.movingSpeech.sessionRevision,
            ownerHash:createHash('sha256').update(await chatSessionOwner(req,authenticated)).digest('hex')}};
        }
        // The grant stays in this authenticated publish observation, never in
        // the persisted command, wallet, public receipt, or browser response.
        delete incoming.movingSpeech;
        out = (await API[req.url]({ ...incoming, id: authenticated }, req.url === '/api/table' ? commandSession : null));
        if(req.url==='/api/table')out={...out,movingSpeechAvailable:movingSpeechService?.supports(incoming.dealer)===true};
        if(req.url==='/api/player'&&activeSession?.displayName&&!out?.error)out={...out,name:activeSession.displayName};
      }
      catch (e) { out = publicFailure(e, Number.isInteger(e?.statusCode) ? e.statusCode : 400); }
      res.writeHead(out.statusCode ?? (out.error ? 400 : 200), { 'Content-Type': 'application/json','Cache-Control': req.url === '/api/history' ? 'private, no-store' : 'no-store' });
      res.end(JSON.stringify(out));
    });
    return;
  }
  const url = new URL(req.url, 'http://x');
  if (publishedLayerAssets && url.pathname.startsWith('/api/presentation/layers/')) {
    const response=await publishedLayerAssets(new Request(gameOrigin+req.url,{method:req.method,headers:req.headers}));
    if(response){res.writeHead(response.status,Object.fromEntries(response.headers));if(!response.body){res.end();return;}
      const stream=Readable.fromWeb(response.body);res.once('close',()=>stream.destroy());stream.once('error',()=>res.destroy());stream.pipe(res);return;}
  }
  const gameRedirect = gameEntryRedirect(new URL(req.url,gameOrigin),process.env);
  if (gameRedirect) {
    if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405,{Allow:'GET, HEAD'}); res.end(); return; }
    res.writeHead(307,{Location:gameRedirect,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}); res.end(); return;
  }
  let decoded;
  try { decoded = decodeURIComponent(url.pathname); }
  catch { res.writeHead(400); res.end('bad request'); return; }
  const routePaths = publicRoutePaths(decoded, normalize);
  let path = routePaths.path;
  const generationPath = routePaths.route;
  const retiredGenerationPath = isRetiredGenerationRoute(generationPath);
  if (retiredGenerationPath) {
    // Repeat auth after decoding/normalization so encoded slashes cannot bypass
    // the ordinary BO gate above. Windows also ignores directory casing and
    // trailing dots/spaces. None of these aliases may fall through to static files.
    if (!(await boSessionOk(req))) { res.writeHead(302, { Location: '/admin/login' }); res.end(); return; }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return; }
    res.writeHead(410, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : '{"error":"legacy generation catalog retired"}'); return;
  }
  if (studioMediaRuntime) {
    const response=await studioMediaRuntime.publicMediaResponse(url.pathname,new Request(gameOrigin+url.pathname,{method:req.method,headers:req.headers}));
    if(response){res.writeHead(response.status,Object.fromEntries(response.headers));
      if(!response.body){res.end();return;}const source=Readable.fromWeb(response.body);res.once('close',()=>source.destroy());source.once('error',()=>res.destroy());source.pipe(res);return;}
  }
  if (isRetiredLocalDealerRoute(generationPath)) {
    res.writeHead(410, {'Content-Type':'application/json','Cache-Control':'no-store'});
    res.end(JSON.stringify({error:'local_dealer_retired'})); return;
  }
  if(!localMediaEnabled&&(/^\/(?:dealers|media|sfx|kevin-cards|assets|review)\//i.test(generationPath)
    ||/^\/(?:scene\.jpg|dealer-fallback\.png|speech-media\.json)$/i.test(generationPath)
    ||/\.(?:mp4|webm|h264|mp3|wav|ogg|m4a)$/i.test(generationPath))){res.writeHead(404,{'Cache-Control':'no-store'});res.end();return;}
  if (mediaLayout) {
    if (publicBlobMedia) {
      const response = await publicBlobMedia(url.pathname,
        new Request(gameOrigin + url.pathname, { method: req.method, headers: req.headers }),
        { repositoryRoot: mediaRepository, trustedProxyOrigin: frontendOrigin });
      if (response) {
        res.writeHead(response.status, Object.fromEntries(response.headers));
        if (!response.body) { res.end(); return; }
        const source = Readable.fromWeb(response.body);
        res.once('close', () => source.destroy());
        source.once('error', () => res.destroy());
        source.pipe(res); return;
      }
    }
    let media;
    try { media = mediaLayout.openPublicMedia(url.pathname, { repositoryRoot: mediaRepository }); }
    catch { res.writeHead(503, { 'Cache-Control': 'no-store' }); res.end('media unavailable'); return; }
    if (media) {
      const etag = `"${media.sha256}"`;
      if (!req.headers.range && ['GET', 'HEAD'].includes(req.method) && req.headers['if-none-match'] === etag) {
        closeSync(media.fd); res.writeHead(304, { ETag: etag, 'Cache-Control': 'no-cache' }); res.end(); return;
      }
      serveGenerationMedia(req, res, media, { ETag: etag, 'Cache-Control': 'no-cache' }); return;
    }
  }
  if (['/game', '/game/'].includes(decoded)) path = '/index.html';
  if (decoded === '/blackjack' || decoded === '/blackjack/') path = neonStudioEnabled ? '/index.html' : '/blackjack-entry.html';
  if (decoded === '/player-login' || decoded === '/player-login/') {
    if (!neonStudioEnabled) { res.writeHead(404); res.end('not found'); return; }
    path = '/blackjack-entry.html';
  }
  if (path === '/' || path === '\\') path = '/index.html';
  if (/[/\\]$/.test(path)) path += 'index.html';   // directory index on Windows and POSIX
  const file = join(root, path);
  if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404); res.end('not found'); return;
  }
  const size = statSync(file).size;
  const type = MIME[extname(file)] ?? 'application/octet-stream';
  if (neonStudioEnabled && type === 'text/html') {
    let selection;
    if (['/blackjack','/blackjack/'].includes(pathname)) {
      let entry;
      try { entry = await selectGameEntry(url.searchParams); }
      catch { res.writeHead(503,{'Cache-Control':'no-store'});res.end('Game entry unavailable');return; }
      if (entry.status === 404) {
        res.writeHead(404,{'Content-Type':'text/html; charset=utf-8','Content-Length':Buffer.byteLength(OPERATOR_NOT_FOUND_HTML),'Cache-Control':'no-store'});
        res.end(req.method === 'HEAD' ? undefined : OPERATOR_NOT_FOUND_HTML); return;
      }
      selection = entry.selection;
    }
    const html=withSharedRoomEntry(decorateGameEntryHtml(readSync(file,'utf8'),process.env,selection),{enabled:sharedRoomsEnabled,selection});
    res.writeHead(200,{'Content-Type':type,'Content-Length':Buffer.byteLength(html),...noStore(file)});
    res.end(req.method === 'HEAD' ? undefined : html); return;
  }
  if (!neonStudioEnabled && path === '/index.html') {
    const html = '<!doctype html><html lang="sv"><meta charset="utf-8"><title>Välj en presentation</title><main><h1>Ingen presentation vald</h1><p>Starta ett publicerat bord eller öppna ett provspel från Sammansättning.</p><a href="/control/preview">Öppna Sammansättning</a></main></html>';
    res.writeHead(503, { 'Content-Type': type, 'Content-Length': Buffer.byteLength(html), ...noStore(file) });
    res.end(req.method === 'HEAD' ? undefined : html); return;
  }
  const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start > end || start >= size) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }); res.end(); return; }
    res.writeHead(206, {
      'Content-Type': type, 'Accept-Ranges': 'bytes',
      'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1,
    });
    createReadStream(file, { start, end }).pipe(res);
  } else {
    // media files MUST revalidate: streams are rewritten in place under the
    // same names, and a cached .h264 against a fresh index.json kills the
    // engine (the "stale dealer" poster). ETag makes revalidation a cheap 304.
    const etag = `"${size}-${Math.round(statSync(file).mtimeMs)}"`;
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, { ETag: etag }); res.end(); return; }
    const cache = LIVE.has(extname(file)) ? noStore(file) : { 'Cache-Control': 'no-cache', ETag: etag };
    res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': size, ...cache });
    createReadStream(file).pipe(res);
  }
  } catch {
    // A failed database/transport request must not crash other player sessions
    // or expose PostgreSQL diagnostics and connection details to the browser.
    if (res.destroyed || res.writableEnded) return;
    if (res.headersSent) { res.destroy(); return; }
    res.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ error: 'Service temporarily unavailable' }));
  }
});
let gameUpgradeDispatcher = null;
if (sharedRoomsEnabled) {
  if (!studioPolicyRuntime || !storage.gamePool) throw Error('shared_room_postgres_registry_required');
  const [{createSharedRoomService},{createGameUpgradeDispatcher},{createSharedCommandAuth},{createSharedRoomCommand}] = await Promise.all([
    import('./shared-room-service.mjs'), import('./game-upgrade-dispatcher.mjs'),
    import('./storage/shared-command-auth.mjs'), import('./shared-room-command.mjs'),
  ]);
  const commandAuth = createSharedCommandAuth({db,boDb,scope:studioPolicyRuntime.scope,playerAccounts});
  sharedRoomService = createSharedRoomService({
    pool:storage.gamePool, walletMode:'demo', auth, commandAuth,
    repository:studioPolicyRuntime.repository, scope:studioPolicyRuntime.scope,
    privateMedia:sharedRoomQa?.privateMedia??((record,request)=>(import('./blob-media.mjs')).then(({getPrivateMedia})=>getPrivateMedia(record,request,{repositoryRoot:mediaRepository,signal:request.signal,
      trustedProxyOrigin:cloudRuntime&&frontendOrigin&&new URL(request.url).origin===gameOrigin
        &&[new URL(gameOrigin).host,new URL(frontendOrigin).host].includes(request.headers.get('host'))?frontendOrigin:null}))),
    engineOrigin:roomOrigins.engineOrigin,
    origin:roomOrigins.origin,
    onError:()=>console.warn(JSON.stringify({event:'shared_room_runtime_unavailable'})),
  });
  sharedRoomCommand = createSharedRoomCommand({service:sharedRoomService,origin:roomOrigins.origin,
    engineOrigin:roomOrigins.engineOrigin});
  gameUpgradeDispatcher = createGameUpgradeDispatcher(server);
  gameUpgradeDispatcher.port('room').on('upgrade',sharedRoomService.handleUpgrade);
  // Receiver and game schema readiness precede listener admission. Startup never installs SQL.
  try { await sharedRoomService.start(); }
  catch (error) { gameUpgradeDispatcher.close(); await sharedRoomService.close(); throw error; }
}
if (process.env.CROUPIER_GENERATED_SPEECH_STREAMING === '1') {
  const streaming = generatedSpeechStreamConfiguration(process.env);
  if (!streaming.configured) throw new Error('generated_speech_stream_not_configured');
  speechStreamService = await createGeneratedSpeechStreamService(gameUpgradeDispatcher?.port('speech') ?? server, streaming.configuration, {
    movingSpeechRoutes:process.env.CROUPIER_MOVING_SPEECH_ENABLED === '1',
    dealerRuntime:dealerSpeechRuntime, replyLibrary:speechReplyLibrary,
    onLibraryStatus:status => console.info(JSON.stringify({event:'speech_reply_library',...status})),
    ...(speechJournal ? { journal: speechJournal, journalRequired: true } : {}),
    resolveOwner: async (req, playerId) => operatorSpeechQa.ownsIdentity(playerId)
      ? operatorSpeechQa.resolveOwner(req, playerId) : (await chatSessionOwner(req, playerId)),
  });
}
if (process.env.CROUPIER_MOVING_SPEECH_ENABLED === '1') {
  if (!studioPolicyRuntime || !speechJournal || !dealerSpeechRuntime) throw Error('moving_speech_registry_required');
  const [{loadMovingBankArtifacts,movingBankStorageOptions},{createMovingSpeechRunPod},{createMovingDriftRuntime},{createMovingSpeechRuntime},{getPrivateMedia,withVerifiedPrivateMediaFile},{createRequire},{movingDriftConfiguration}] = await Promise.all([
    import('./moving-speech-bank-artifacts.mjs'),import('./moving-speech-runpod.mjs'),import('./moving-drift-executor.mjs'),
    import('./moving-speech-runtime.mjs'),import('./blob-media.mjs'),import('node:module'),
    import('../../packages/presentation/contracts/moving-drift.mjs')]);
  const bankOptions=movingBankStorageOptions(createRequire(new URL('./package.json',import.meta.url))('@vercel/blob'));
  const bank=await loadMovingBankArtifacts(JSON.parse(process.env.CROUPIER_MOVING_SPEECH_BANK_RECORD ?? 'null'),bankOptions);
  if (bank.sourceSet.dealerId !== 'dragan') throw Error('moving_speech_test_dealer_required');
  // Fetch and hash the immutable derived bank before accepting a paid job.
  // Worker transfer then reads the existing verified cache, bypassing Vercel.
  await withVerifiedPrivateMediaFile(bank.archive,async()=>true,bankOptions);
  await withVerifiedPrivateMediaFile(bank.receipt,async()=>true,bankOptions);
  const provider=createMovingSpeechRunPod({endpointId:process.env.CROUPIER_MOVING_SPEECH_ENDPOINT_ID,
    apiKey:process.env.CROUPIER_MOVING_SPEECH_RUNPOD_API_KEY,expectedImage:process.env.CROUPIER_MOVING_SPEECH_IMAGE});
  const driftRuntime=await createMovingDriftRuntime({pool:storage.pool,scope:studioPolicyRuntime.scope,
    configuration:movingDriftConfiguration(process.env),endpointId:process.env.CROUPIER_MOVING_SPEECH_ENDPOINT_ID,
    releaseDigest:process.env.CROUPIER_MOVING_SPEECH_RELEASE_SHA256,bankHash:bank.archive.sha256,provider,
    sessionOptions:{origin:process.env.CROUPIER_MOVING_SPEECH_WORKER_ORIGIN,...MOVING_TRIAL_BUDGET}});
  const sessions=driftRuntime.sessions;
  const recovery=await sessions.reconcile();
  if(recovery.unresolved.length)console.warn(JSON.stringify({event:'moving_speech_recovery',unresolved:recovery.unresolved.length}));
  const repository=studioPolicyRuntime.repository;
  const {assertMovingSpeechSource}=await import('./moving-speech-bank.mjs');
  movingSpeechService=createMovingSpeechRuntime({server:gameUpgradeDispatcher?.port('moving') ?? server,origin:process.env.PUBLIC_URL,workerOrigin:process.env.CROUPIER_MOVING_SPEECH_WORKER_ORIGIN,
    readPresentation:playerId=>db.prepare('SELECT version,payload FROM native_presentations WHERE player_id=?').get(playerId),
    publicVideo:(frozen,id)=>frozenDealerContext.publicVideo(frozen,id),
    ticketSecret:process.env.CROUPIER_MOVING_SPEECH_TICKET_SECRET,bank,bankOptions,
    releaseSha256:process.env.CROUPIER_MOVING_SPEECH_RELEASE_SHA256,sessions,dealerRuntime:dealerSpeechRuntime,
    admissionCheck:driftRuntime.assertAvailable,
    resolveOwner:chatSessionOwner,readRegistry:studioMediaRuntime.videoRegistry,
    readEvidence:async (context,mediaId)=>{
      const [frozenContext,project,media]=await Promise.all([
        frozenDealerContext.resolve(context),repository.readDocument('project'),
        storage.pool.query('SELECT id,revision,record FROM croupier_studio.media_records WHERE environment_id=$1 AND workspace_id=$2 AND id=ANY($3::uuid[])',
          [studioPolicyRuntime.scope.environment,studioPolicyRuntime.scope.workspaceId,bank.sourceSet.clips.map(clip=>clip.videoId)])]);
      const records=bank.sourceSet.clips.map(clip=>{
        const matches=media.rows.filter(row=>row.id===clip.videoId),saved=matches[0];
        if(matches.length!==1||!saved?.record)throw Error('moving_speech_bank_source_missing');
        const record={...saved.record,revision:saved.revision};
        assertMovingSpeechSource({...record,dealer:record.classification?.dealerId,available:true,storage:'private-blob',bytes:record.size},bank.sourceSet.dealerId,clip);
        return record;
      });
      const record=records.find(row=>row.id===mediaId);
      const published=frozenContext.records.find(row=>row.id===mediaId);
      if (!record || !project || frozenContext.schemaVersion!==3 || !published || published.sha256!==record.sha256
        || published.pathname!==record.pathname || published.size!==record.size) throw Error('moving_speech_publication_changed');
      return {frozenContext,projectRevision:project.revision,record,
        mediaReferences:records.map(record=>({id:record.id,pathname:record.pathname,revision:record.revision,sha256:record.sha256}))};
    },
    readRest:({record},request)=>getPrivateMedia({provider:'vercel-blob',pathname:record.pathname,sha256:record.sha256,
      size:record.size,contentType:record.contentType},request),
  });
  driftRuntime.start(()=>movingSpeechService.cancelActive());
  const existing=speechStreamService;
  // Existing login/logout/profile/room cancellation continues to reach both
  // paths; all Astrid preparation and relay methods remain unchanged.
  speechStreamService={...existing,
    cancelOwner:value=>Promise.all([existing?.cancelOwner(value),movingSpeechService.cancelOwner(value)]),
    cancelPlayer:value=>Promise.all([existing?.cancelPlayer(value),movingSpeechService.cancelPlayer(value)]),
    close:options=>Promise.all([existing?.close(options),driftRuntime.close(),movingSpeechService.close()])};
}
const gameShutdown = installGracefulShutdown({ server, closeRuntime: async ({ signal }) => {
  gameUpgradeDispatcher?.close();
  studioPreview?.close();
  // Persist cancellation/terminal receipts while the journal connection is open.
  const probeCancellations = [];
  for (const [key, controller] of activePlayerChats) {
    controller.abort('server_shutdown');
    try {
      const [playerId, dealerId] = JSON.parse(key);
      if (dealerId === 'astrid') probeCancellations.push(probeRuntime.cancel({ playerId, dealerId }, 'server_shutdown'));
    } catch { /* An invalid internal key cannot delay the remaining cancellations. */ }
  }
  const outcomes = await Promise.allSettled([sharedRoomService?.close(), speechStreamService?.close({ signal }), ...probeCancellations]);
  if (outcomes.some(outcome => outcome.status === 'rejected')) throw new Error('runtime_shutdown_failed');
}, closeStorage: async () => {
  try { await storage.close(); }
  catch { throw new Error('storage_shutdown_failed'); }
} });
export const sharedRoomQaRuntime = sharedRoomQa ? Object.freeze({
  ready: new Promise((resolveReady, rejectReady) => {
    server.once('listening', () => resolveReady(Object.freeze({ origin: sharedRoomQa.publicOrigin, host, port })));
    server.once('error', rejectReady);
  }),
  close: () => gameShutdown.stop(),
}) : null;
server.listen(port, host, () => console.log(`croupier demo on http://${host}:${port}`));

