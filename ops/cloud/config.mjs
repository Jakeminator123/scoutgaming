import { access, lstat, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { isIP } from 'node:net';
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readVercelIngressConfig } from './vercel-ingress.mjs';
import { readStorageExportConfig } from './storage-export.mjs';
import { createPostgresStore } from '../../services/game/storage/postgres-store.mjs';
import { validateGameConnection } from '../../packages/storage/server/postgres-store.mjs';
import {gameEntryEnabled} from '../../packages/navigation/game-entry.mjs';
import { studioGamePolicyConfiguration } from '../../packages/presentation/server/saved-game-policy.mjs';
import { validatePrivateMedia } from '../../packages/studio-registry/server/private-media-contract.mjs';
import { movingDriftConfiguration, MOVING_DRIFT_DEALER_ID } from '../../packages/presentation/contracts/moving-drift.mjs';

export const REPOSITORY = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const WEB_PORT = 4173;

const outside = (base, path) => {
  const rel = relative(base, path);
  return rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel);
};
const samePath = (left, right) => {
  const a = resolve(left), b = resolve(right);
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
};
const fail = name => { throw new Error(`Invalid or missing ${name}.`); };

function httpsOrigin(value, name) {
  let url;
  try { url = new URL(value); } catch { fail(name); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash
    || url.pathname !== '/' || url.port || isIP(url.hostname) || url.hostname.includes('*')
    || !url.hostname.includes('.') || url.hostname.endsWith('.local')
    || value !== url.origin) fail(name);
  return url.origin;
}

function port(value) {
  const number = Number(value);
  if (!/^[0-9]+$/.test(String(value ?? '')) || !Number.isInteger(number)
    || number < 1024 || number > 65535 || number === WEB_PORT) fail('PORT');
  return number;
}

function optionalPair(env, urlName, tokenName) {
  const url = env[urlName]?.trim() || '';
  const token = env[tokenName]?.trim() || '';
  if (Boolean(url) !== Boolean(token)) fail(`${urlName}/${tokenName}`);
  if (url) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.hash
        || parsed.search || parsed.port || parsed.pathname !== '/' || url !== parsed.origin
        || isIP(parsed.hostname) || !parsed.hostname.includes('.') || parsed.hostname.endsWith('.local')) fail(urlName);
    } catch { fail(urlName); }
    if (token.length > 2048 || /[\s\x00-\x1f]/.test(token)) fail(tokenName);
  }
  return { url, token };
}

export function validateCloudConfig(env, { repository = REPOSITORY } = {}) {
  if (env.NODE_ENV !== 'production') fail('NODE_ENV');
  for (const name of ['CROUPIER_CLOUD_LAB_CHILD', 'CROUPIER_P6_QA_ROUTER', 'CROUPIER_P6_BOUNDED_TEST']) {
    if (env[name] !== undefined && !['', '0'].includes(env[name])) fail(name + ' (retired)');
  }
  if (env.CROUPIER_PLAYER_ACCOUNTS && !['0', '1'].includes(env.CROUPIER_PLAYER_ACCOUNTS)) fail('CROUPIER_PLAYER_ACCOUNTS');
  const sharedTableFlag = env.CROUPIER_SHARED_TABLE_ENABLED;
  if (sharedTableFlag !== undefined && !['0', '1'].includes(sharedTableFlag)) fail('CROUPIER_SHARED_TABLE_ENABLED');
  for (const name of ['DEMO_GUEST_ACCESS', 'CROUPIER_GENERATED_SPEECH_PREVIEW',
    'CROUPIER_LISSABON_PROFILES']) {
    if (env[name] === '1') fail(name);
  }
  const bootstrapUser = env.CROUPIER_CLOUD_BOOTSTRAP_ADMIN_USER || '';
  const bootstrapPassword = env.CROUPIER_CLOUD_BOOTSTRAP_ADMIN_PASSWORD || '';
  if (Boolean(bootstrapUser) !== Boolean(bootstrapPassword)
    || (bootstrapUser && (!/^[a-z][a-z0-9._-]{2,63}$/.test(bootstrapUser)
      || bootstrapUser.toLowerCase() === 'kevin'
      || bootstrapPassword.length < 16 || bootstrapPassword.length > 256
      || /[\u0000-\u001f\u007f-\u009f]/u.test(bootstrapPassword)))) fail('CROUPIER_CLOUD_BOOTSTRAP_ADMIN_USER/PASSWORD');
  const camera = env.CROUPIER_ASTRID_CAMERA === '1';
  if (env.CROUPIER_ASTRID_CAMERA && !['0', '1'].includes(env.CROUPIER_ASTRID_CAMERA)) fail('CROUPIER_ASTRID_CAMERA');
  const translationKey = env.CROUPIER_ASTRID_TRANSLATION_KEY || '';
  if (camera && (!translationKey || translationKey.length > 2048 || /\s/.test(translationKey))) fail('CROUPIER_ASTRID_TRANSLATION_KEY');
  const generatedSpeech = env.CROUPIER_GENERATED_SPEECH === '1' && env.CROUPIER_CLOUD_GENERATED_SPEECH === '1';
  if (Boolean(env.CROUPIER_GENERATED_SPEECH === '1') !== Boolean(env.CROUPIER_CLOUD_GENERATED_SPEECH === '1')
    || (env.CROUPIER_GENERATED_SPEECH && !['0', '1'].includes(env.CROUPIER_GENERATED_SPEECH))
    || (env.CROUPIER_CLOUD_GENERATED_SPEECH && !['0', '1'].includes(env.CROUPIER_CLOUD_GENERATED_SPEECH))) {
    fail('CROUPIER_GENERATED_SPEECH/CROUPIER_CLOUD_GENERATED_SPEECH');
  }
  const streaming = env.CROUPIER_GENERATED_SPEECH_STREAMING === '1';
  if (env.CROUPIER_GENERATED_SPEECH_STREAMING && !['0', '1'].includes(env.CROUPIER_GENERATED_SPEECH_STREAMING)) fail('CROUPIER_GENERATED_SPEECH_STREAMING');
  if (streaming && !generatedSpeech) fail('CROUPIER_GENERATED_SPEECH_STREAMING');
  const dealerSpeechProfiles = env.CROUPIER_DEALER_SPEECH_PROFILES === '1';
  if (env.CROUPIER_DEALER_SPEECH_PROFILES && !['0','1'].includes(env.CROUPIER_DEALER_SPEECH_PROFILES)
    || dealerSpeechProfiles && (!streaming || env.CROUPIER_STUDIO_NEON_POLICY !== '1')) fail('CROUPIER_DEALER_SPEECH_PROFILES');
  const elevenLabsKey = dealerSpeechProfiles ? env.ELEVENLABS_API_KEY || '' : '';
  if (elevenLabsKey && (elevenLabsKey.length > 2048 || /[\s\u0000-\u001f]/.test(elevenLabsKey))) fail('ELEVENLABS_API_KEY');
  const workerSecret = env.CROUPIER_SPEECH_STREAM_WORKER_SECRET || '';
  const ticketSecret = env.CROUPIER_SPEECH_STREAM_TICKET_SECRET || '';
  const validSecret = value => value.length >= 32 && value.length <= 2048 && !/\s/.test(value);
  if (streaming && (!validSecret(workerSecret) || !validSecret(ticketSecret) || workerSecret === ticketSecret)) {
    fail('CROUPIER_SPEECH_STREAM_WORKER_SECRET/TICKET_SECRET');
  }
  const sessionReserveUsd = env.CROUPIER_SPEECH_RUNPOD_SESSION_RESERVE_USD || '';
  if (streaming && (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(sessionReserveUsd)
    || Number(sessionReserveUsd) <= 0 || Number(sessionReserveUsd) > 10)) fail('CROUPIER_SPEECH_RUNPOD_SESSION_RESERVE_USD');
  const dailyBudgetUsd = env.CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD || '';
  const fullfileBudgetRequired = generatedSpeech && !streaming && env.CROUPIER_STUDIO_NEON_POLICY === '1';
  const fullfileReserveUsd = env.CROUPIER_SPEECH_FULLFILE_RESERVE_USD || '';
  if (fullfileBudgetRequired && (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(fullfileReserveUsd)
    || Number(fullfileReserveUsd) <= 0 || Number(fullfileReserveUsd) > 10)) fail('CROUPIER_SPEECH_FULLFILE_RESERVE_USD');
  if ((streaming || fullfileBudgetRequired) && (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(dailyBudgetUsd)
    || Number(dailyBudgetUsd) <= 0 || Number(dailyBudgetUsd) > 20
    || (streaming && Number(sessionReserveUsd) > Number(dailyBudgetUsd))
    || (fullfileBudgetRequired && Number(fullfileReserveUsd) > Number(dailyBudgetUsd)))) fail('CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD');
  const cartesiaKey = env.CARTESIA_API_KEY || '';
  const runpodKey = env.RUNPOD_API_KEY || '';
  const runpodEndpointId = env.CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID || '';
  if (generatedSpeech && (![cartesiaKey, runpodKey].every(value => value.length > 0 && value.length <= 2048 && !/\s/.test(value))
    || !/^[A-Za-z0-9_-]{1,100}$/.test(runpodEndpointId))) fail('CARTESIA_API_KEY/RUNPOD_API_KEY/CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID');
  const mediaStorage = env.CROUPIER_MEDIA_STORAGE || 'disk';
  if (!['disk', 'blob'].includes(mediaStorage)) fail('CROUPIER_MEDIA_STORAGE');
  const blobToken = env.BLOB_READ_WRITE_TOKEN || '';
  if (mediaStorage === 'blob' && (!blobToken || blobToken.length > 4096 || /\s/.test(blobToken))) fail('BLOB_READ_WRITE_TOKEN');
  const zonesDatabaseUrl = env.CROUPIER_ZONES_DATABASE_URL || '';
  if (zonesDatabaseUrl) {
    let database;
    try { database = new URL(zonesDatabaseUrl); } catch { fail('CROUPIER_ZONES_DATABASE_URL'); }
    if (mediaStorage !== 'blob' || !['postgres:', 'postgresql:'].includes(database.protocol)
      || !database.username || !database.password || !database.hostname || database.hash
      || !['require', 'verify-ca', 'verify-full'].includes(database.searchParams.get('sslmode'))
      || zonesDatabaseUrl.length > 8192 || /[\r\n\t]/.test(zonesDatabaseUrl)) fail('CROUPIER_ZONES_DATABASE_URL');
  }
  // One product path in every mode, maintenance included: PostgreSQL. No variable selects it.
  const database = 'postgres';
  const gameDatabaseUrl = env.CROUPIER_GAME_DATABASE_URL || '';
  validateGameConnection(gameDatabaseUrl, zonesDatabaseUrl);
  const layout = env.CROUPIER_CLOUD_LAYOUT || 'separate-hosts';
  if (!['separate-hosts', 'single-origin'].includes(layout)) fail('CROUPIER_CLOUD_LAYOUT');
  const singleOrigin = layout === 'single-origin';
  const gameOrigin = httpsOrigin(env.PUBLIC_URL || (singleOrigin ? env.RENDER_EXTERNAL_URL : ''), 'PUBLIC_URL');
  const boOrigin = httpsOrigin(env.BO_URL || (singleOrigin ? gameOrigin : ''), 'BO_URL');
  const labOrigin = httpsOrigin(env.LAB_PUBLIC_URL || (singleOrigin ? gameOrigin : ''), 'LAB_PUBLIC_URL');
  if (singleOrigin) {
    if (boOrigin !== gameOrigin || labOrigin !== gameOrigin) fail('CROUPIER_CLOUD_LAYOUT origins');
  } else {
    if (gameOrigin === labOrigin) fail('LAB_PUBLIC_URL');
    if (boOrigin === gameOrigin || boOrigin === labOrigin) fail('BO_URL');
  }
  const vercelIngress = readVercelIngressConfig(env);
  if (vercelIngress && (!singleOrigin || vercelIngress.publicOrigin !== gameOrigin)) fail('CROUPIER_PUBLIC_ORIGIN');
  const publicGamePath = gameEntryEnabled(env) ? '/blackjack' : env.CROUPIER_PUBLIC_GAME_PATH || '/';
  if (!['/', '/game', ...(gameEntryEnabled(env) ? ['/blackjack'] : [])].includes(publicGamePath)
    || vercelIngress && publicGamePath !== (gameEntryEnabled(env) ? '/blackjack' : '/game')) fail('CROUPIER_PUBLIC_GAME_PATH');
  const storageExport = readStorageExportConfig(env);
  // Maintenance exports never start product children. Every ordinary cloud
  // process uses the one scoped Neon catalog and private Blob, even with a mount.
  let studioPolicy = null;
  if (!storageExport) {
    if (env.CROUPIER_STUDIO_NEON_POLICY !== '1') fail('CROUPIER_STUDIO_NEON_POLICY');
    try { studioPolicy = studioGamePolicyConfiguration(env); } catch { fail('CROUPIER_STUDIO_NEON_POLICY/scope'); }
    if (!studioPolicy || mediaStorage !== 'blob' || !blobToken) fail('CROUPIER_MEDIA_STORAGE/BLOB_READ_WRITE_TOKEN');
  }
  const movingFlag = env.CROUPIER_MOVING_SPEECH_ENABLED;
  if (movingFlag !== undefined && !['', '0', '1'].includes(movingFlag)) fail('CROUPIER_MOVING_SPEECH_ENABLED');
  let movingSpeech = null;
  if (movingFlag === '1') {
    if (storageExport || !studioPolicy || mediaStorage !== 'blob' || !blobToken || !dealerSpeechProfiles)
      fail('CROUPIER_MOVING_SPEECH_ENABLED requires Neon, private Blob and registered speech profiles');
    const prefix = 'CROUPIER_MOVING_SPEECH_';
    const workerOrigin = httpsOrigin(env[prefix + 'WORKER_ORIGIN'], prefix + 'WORKER_ORIGIN');
    if (workerOrigin !== httpsOrigin(env.RENDER_EXTERNAL_URL, 'RENDER_EXTERNAL_URL')) fail(prefix + 'WORKER_ORIGIN');
    // One private, hash-bound bank manifest per dealer: {"<dealerId>": <record>}.
    const banksName = prefix + 'BANK_RECORDS', banksJson = env[banksName];
    let bankRecords;
    try {
      if (typeof banksJson !== 'string' || Buffer.byteLength(banksJson) > 128 * 1024) throw Error();
      const parsed = JSON.parse(banksJson), dealers = parsed && typeof parsed === 'object' ? Object.keys(parsed) : [];
      if (Array.isArray(parsed) || Object.getPrototypeOf(parsed) !== Object.prototype || !dealers.length || dealers.length > 8
        || dealers.some(dealerId => !MOVING_DRIFT_DEALER_ID.test(dealerId))) throw Error();
      bankRecords = Object.fromEntries(dealers.map(dealerId => {
        const record = validatePrivateMedia(parsed[dealerId]);
        if (record.contentType !== 'application/json' || record.size > 128 * 1024
          || !/^croupier\/media\/dealers\/[a-z][a-z0-9-]{0,39}\/runtime\/moving-bank\//.test(record.pathname)) throw Error();
        return [dealerId, record];
      }));
    } catch { fail(banksName); }
    for (const [dealerId, record] of Object.entries(bankRecords)) {
      if (!record.pathname.startsWith(`croupier/media/dealers/${dealerId}/runtime/moving-bank/`)) fail(`${banksName} (bank of another dealer for ${dealerId})`);
    }
    const runpodKey = env[prefix + 'RUNPOD_API_KEY'];
    const image = env[prefix + 'IMAGE'], releaseSha256 = env[prefix + 'RELEASE_SHA256'], movingTicket = env[prefix + 'TICKET_SECRET'];
    const credential = (value, minimum) => typeof value === 'string' && value.length >= minimum && value.length <= 2048
      && !/[\s\u0000-\u001f\u007f-\u009f]/u.test(value);
    if (!credential(runpodKey, 1)) fail(prefix + 'RUNPOD_API_KEY');
    if (!/^ghcr\.io\/jakeminator123\/moving-gpu-worker@sha256:[a-f0-9]{64}$/.test(image ?? '')) fail(prefix + 'IMAGE');
    if (!/^[a-f0-9]{64}$/.test(releaseSha256 ?? '')) fail(prefix + 'RELEASE_SHA256');
    if (!credential(movingTicket, 32) || [workerSecret, ticketSecret, translationKey, cartesiaKey, runpodKey,
      env.RUNPOD_API_KEY, elevenLabsKey, blobToken, env.CROUPIER_VERCEL_INGRESS_SECRET].includes(movingTicket)) fail(prefix + 'TICKET_SECRET');
    // Exactly one drift profile (own endpoint, this release) per bank, and no profile without a bank.
    let drift;
    try { drift = movingDriftConfiguration(env); }
    catch { fail('CROUPIER_STUDIO_MOVING_DRIFT_API/PROFILES'); }
    if (!drift || drift.profiles.some(profile => !/^[a-z0-9]{6,64}$/.test(profile.endpointId)
      || profile.releaseDigest !== releaseSha256)) fail('CROUPIER_STUDIO_MOVING_DRIFT_API/PROFILES');
    for (const { dealerId } of drift.profiles) {
      if (!Object.hasOwn(bankRecords, dealerId)) fail(`CROUPIER_STUDIO_MOVING_DRIFT_PROFILES (profile without a bank for ${dealerId})`);
    }
    for (const dealerId of Object.keys(bankRecords)) {
      if (!drift.profiles.some(profile => profile.dealerId === dealerId)) fail(`${banksName} (bank without a drift profile for ${dealerId})`);
    }
    movingSpeech = Object.freeze({ bankRecords: JSON.stringify(bankRecords), runpodKey, image, releaseSha256,
      ticketSecret: movingTicket, workerOrigin, driftProfiles: JSON.stringify(drift.profiles) });
  }
  const frontendOrigin = env.CROUPIER_VERCEL_FRONTEND_ORIGIN
    ? httpsOrigin(env.CROUPIER_VERCEL_FRONTEND_ORIGIN, 'CROUPIER_VERCEL_FRONTEND_ORIGIN') : '';
  if (frontendOrigin && [gameOrigin, boOrigin, labOrigin].includes(frontendOrigin)) fail('CROUPIER_VERCEL_FRONTEND_ORIGIN');
  if (httpsOrigin(env.CROUPIER_GAME_ORIGIN || (singleOrigin ? gameOrigin : ''), 'CROUPIER_GAME_ORIGIN') !== gameOrigin) fail('CROUPIER_GAME_ORIGIN');
  const publicPort = port(env.PORT);
  const disk = env.CROUPIER_CLOUD_DATA_ROOT;
  const diskRequired = Boolean(storageExport);
  if (disk === undefined && diskRequired) fail('CROUPIER_CLOUD_DATA_ROOT');
  if (disk !== undefined && (typeof disk !== 'string' || !isAbsolute(disk))) fail('CROUPIER_CLOUD_DATA_ROOT');
  const dataRoot = disk === undefined ? null : resolve(disk);
  if (dataRoot && (dataRoot === parse(dataRoot).root || !outside(resolve(repository), dataRoot))) fail('CROUPIER_CLOUD_DATA_ROOT');
  if (!dataRoot && (mediaStorage !== 'blob' || env.CROUPIER_STUDIO_NEON_POLICY !== '1')) fail('CROUPIER_CLOUD_DATA_ROOT');
  // No child owns a disk path any more; the retired SQLite directory is refused like the other disk keys.
  const paths = {};
  for (const name of ['CROUPIER_DATA_DIR','LAB_STUDIO_DATA_DIR','CROUPIER_PRESENTATION_STUDIO_DIR','CROUPIER_GENERATIONS_DIR','CROUPIER_GENERATED_SPEECH_DIR']) {
    if (env[name] !== undefined) fail(name);
  }
  let videoArchive;
  if (env.LAB_VIDEO_ARCHIVE !== undefined) {
    if (!isAbsolute(env.LAB_VIDEO_ARCHIVE)) fail('LAB_VIDEO_ARCHIVE');
    videoArchive = resolve(env.LAB_VIDEO_ARCHIVE);
  }
  const director = optionalPair(env, 'CROUPIER_PRESENTATION_DIRECTOR_URL', 'CROUPIER_PRESENTATION_DIRECTOR_TOKEN');
  const productSpeech = optionalPair(env, 'OPENCLAW_PRODUCT_SPEECH_URL', 'OPENCLAW_PRODUCT_SPEECH_TOKEN');
  // Recorded-media games can run without AI. Enabled AI media still needs its
  // real relay; an absent pair must never be replaced by fixture credentials.
  if ((generatedSpeech || camera || movingSpeech) && !productSpeech.url) fail('OPENCLAW_PRODUCT_SPEECH_URL/TOKEN');
  const timeoutMs = Number(env.OPENCLAW_TIMEOUT_MS ?? 8000);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 30000) fail('OPENCLAW_TIMEOUT_MS');
  const speechTimeoutMs = Number(env.OPENCLAW_SPEECH_TIMEOUT_MS ?? timeoutMs);
  if (!Number.isInteger(speechTimeoutMs) || speechTimeoutMs < 1000 || speechTimeoutMs > 30000) fail('OPENCLAW_SPEECH_TIMEOUT_MS');
  return Object.freeze({ gameOrigin, boOrigin, labOrigin, frontendOrigin, singleOrigin, publicPort, dataRoot, paths, videoArchive,
    database, gameDatabaseUrl, vercelIngress, publicGamePath, storageExport,
    director, productSpeech, timeoutMs, speechTimeoutMs, camera, generatedSpeech, streaming, dealerSpeechProfiles, elevenLabsKey, movingSpeech,
    mediaStorage, studioPolicy, blobToken: mediaStorage === 'blob' ? blobToken : '', zonesDatabaseUrl,
    playerAccounts: env.CROUPIER_PLAYER_ACCOUNTS === '1',
    sharedTableEnabled: sharedTableFlag === '1',
    streamSecrets: streaming ? { workerSecret, ticketSecret, sessionReserveUsd, dailyBudgetUsd } : null,
    fullfileBudget: fullfileBudgetRequired ? { reserveUsd:fullfileReserveUsd, dailyBudgetUsd } : null,
    bootstrapAdmin: bootstrapUser ? { user: bootstrapUser, password: bootstrapPassword } : null,
    translationKey: camera ? translationKey : '',
    speechProvider: generatedSpeech ? { cartesiaKey, runpodKey, runpodEndpointId } : null });
}

// Read-only check. Filesystem existence cannot prove that a mount is durable.
export async function inspectCloudDisk(config) {
  if (!config.dataRoot) return;
  const info = await lstat(config.dataRoot).catch(() => null);
  const canonical = await realpath(config.dataRoot).catch(() => null);
  if (!info?.isDirectory() || info.isSymbolicLink()
    || !canonical || !samePath(canonical, config.dataRoot)) fail('CROUPIER_CLOUD_DATA_ROOT');
  await access(config.dataRoot, constants.R_OK | constants.W_OK | constants.X_OK).catch(() => fail('CROUPIER_CLOUD_DATA_ROOT'));
  if (config.videoArchive) {
    const archive = await lstat(config.videoArchive).catch(() => null);
    if (!archive?.isDirectory() || archive.isSymbolicLink()) fail('LAB_VIDEO_ARCHIVE');
  }
}

// A read-only preflight prevents --check from approving a blank CRAIG volume
// that the Web child would reject on startup. It never creates a database.
// The store factory is injectable so the empty-CRAIG refusal is testable without a server.
export async function inspectCloudBootstrap(config, { openStore = createPostgresStore } = {}) {
  // This maintenance process starts no game child and cannot bootstrap
  // or query PostgreSQL. Disk/build preflight remains in start.mjs.
  if (config.storageExport?.mode === 'studio-export') return;
  if (config.bootstrapAdmin) return;
  const storage = openStore({ connectionString: config.gameDatabaseUrl, zonesConnectionString: config.zonesDatabaseUrl });
  try {
    await storage.db.assertInstalled();
    if (!(await storage.boDb.prepare('SELECT COUNT(*) AS n FROM users').get()).n) fail('CROUPIER_CLOUD_BOOTSTRAP_ADMIN_USER/PASSWORD');
  } finally { await storage.close(); }
}

export function childSpecifications(config, env = process.env) {
  // Never pass the deployment environment wholesale to the game child.
  const base = Object.fromEntries(['PATH', 'Path', 'TMPDIR', 'TEMP', 'TMP', 'TZ',
    'NODE_EXTRA_CA_CERTS', 'SSL_CERT_FILE', 'SSL_CERT_DIR'].filter(name => env[name] !== undefined)
    .map(name => [name, env[name]]));
  const shared = { ...base, NODE_ENV: 'production',
    ...(config.studioPolicy ? {
      CROUPIER_STUDIO_NEON_POLICY: '1',
      CROUPIER_STUDIO_ENVIRONMENT_ID: config.studioPolicy.scope.environment,
      CROUPIER_STUDIO_WORKSPACE_ID: config.studioPolicy.scope.workspaceId,
      CROUPIER_PUBLIC_ORIGIN: env.CROUPIER_PUBLIC_ORIGIN,
      CROUPIER_VERCEL_INGRESS_SECRET: env.CROUPIER_VERCEL_INGRESS_SECRET,
    } : {}),
    CROUPIER_STREAM_LANE: 'lissabon-stream-lane',
    CROUPIER_MEDIA_STORAGE: config.mediaStorage,
    ...(config.blobToken ? { BLOB_READ_WRITE_TOKEN: config.blobToken } : {}),
    ...(config.videoArchive ? { LAB_VIDEO_ARCHIVE: config.videoArchive } : {}) };
  return {
    web: { command: process.execPath, args: [join(REPOSITORY, 'services/game/server.mjs')], cwd: REPOSITORY,
      env: { ...shared, HOST: '127.0.0.1', PORT: String(WEB_PORT), PUBLIC_URL: config.gameOrigin,
        ...(config.gameDatabaseUrl ? { CROUPIER_GAME_DATABASE_URL: config.gameDatabaseUrl } : {}),
        CROUPIER_PUBLIC_GAME_PATH: config.publicGamePath,
        BO_URL: config.boOrigin, LAB_PUBLIC_URL: config.labOrigin,
        CROUPIER_VERCEL_FRONTEND_ORIGIN: config.frontendOrigin,
        CROUPIER_CLOUD_RUNTIME: '1',
        CROUPIER_CLOUD_LAYOUT: config.singleOrigin ? 'single-origin' : 'separate-hosts',
        CROUPIER_PLAYER_ACCOUNTS: config.playerAccounts ? '1' : '',
        CROUPIER_SHARED_TABLE_ENABLED: config.sharedTableEnabled ? '1' : '0',
        ...(config.bootstrapAdmin ? {
          CROUPIER_CLOUD_BOOTSTRAP_ADMIN_USER: config.bootstrapAdmin.user,
          CROUPIER_CLOUD_BOOTSTRAP_ADMIN_PASSWORD: config.bootstrapAdmin.password,
        } : {}),
        DEMO_GUEST_ACCESS: '', CROUPIER_LISSABON_PROFILES: '',
        CROUPIER_GENERATED_SPEECH: config.generatedSpeech ? '1' : '',
        CROUPIER_CLOUD_GENERATED_SPEECH: config.generatedSpeech ? '1' : '',
        CROUPIER_GENERATED_SPEECH_STREAMING: config.streaming ? '1' : '',
        CROUPIER_DEALER_SPEECH_PROFILES: config.dealerSpeechProfiles ? '1' : '',
        ...(config.dealerSpeechProfiles && config.elevenLabsKey ? {ELEVENLABS_API_KEY:config.elevenLabsKey} : {}),
        ...(config.streamSecrets ? {
          CROUPIER_SPEECH_STREAM_WORKER_SECRET: config.streamSecrets.workerSecret,
          CROUPIER_SPEECH_STREAM_TICKET_SECRET: config.streamSecrets.ticketSecret,
          CROUPIER_SPEECH_RUNPOD_SESSION_RESERVE_USD: config.streamSecrets.sessionReserveUsd,
          CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD: config.streamSecrets.dailyBudgetUsd,
        } : {}),
        ...(config.fullfileBudget ? {
          CROUPIER_SPEECH_FULLFILE_RESERVE_USD:config.fullfileBudget.reserveUsd,
          CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD:config.fullfileBudget.dailyBudgetUsd,
        } : {}),
        ...(config.speechProvider ? {
          CARTESIA_API_KEY: config.speechProvider.cartesiaKey,
          RUNPOD_API_KEY: config.speechProvider.runpodKey,
          CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID: config.speechProvider.runpodEndpointId,
        } : {}),
        ...(config.movingSpeech ? {
          CROUPIER_MOVING_SPEECH_ENABLED: '1',
          CROUPIER_STUDIO_MOVING_DRIFT_API: '1',
          CROUPIER_STUDIO_MOVING_DRIFT_PROFILES: config.movingSpeech.driftProfiles,
          CROUPIER_MOVING_SPEECH_BANK_RECORDS: config.movingSpeech.bankRecords,
          CROUPIER_MOVING_SPEECH_RUNPOD_API_KEY: config.movingSpeech.runpodKey,
          CROUPIER_MOVING_SPEECH_IMAGE: config.movingSpeech.image,
          CROUPIER_MOVING_SPEECH_RELEASE_SHA256: config.movingSpeech.releaseSha256,
          CROUPIER_MOVING_SPEECH_TICKET_SECRET: config.movingSpeech.ticketSecret,
          CROUPIER_MOVING_SPEECH_WORKER_ORIGIN: config.movingSpeech.workerOrigin,
        } : {}),
        CROUPIER_ASTRID_CAMERA: config.camera ? '1' : '',
        CROUPIER_ASTRID_TRANSLATION_KEY: config.translationKey,
        CROUPIER_PRESENTATION_DIRECTOR_URL: config.director.url,
        CROUPIER_PRESENTATION_DIRECTOR_TOKEN: config.director.token,
        OPENCLAW_PRODUCT_SPEECH_URL: config.productSpeech.url,
        OPENCLAW_PRODUCT_SPEECH_TOKEN: config.productSpeech.token,
        OPENCLAW_SPEECH_TIMEOUT_MS: String(config.speechTimeoutMs),
        OPENCLAW_TIMEOUT_MS: String(config.timeoutMs) } },
  };
}
