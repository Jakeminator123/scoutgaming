import { access, lstat, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { isIP } from 'node:net';
import { DatabaseSync } from 'node:sqlite';
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readVercelIngressConfig } from './vercel-ingress.mjs';
import { readStorageExportConfig } from './storage-export.mjs';
import { createPostgresStore, validateGameConnection } from '../../web/storage/postgres-store.mjs';
import { normalizePresentationArchive } from '../../tools/media-layout.mjs';
import { gameEntryEnabled } from '../../web/public/game-entry-contract.mjs';

export const REPOSITORY = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const WEB_PORT = 4173;
export const LAB_PORT = 4188;

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
    || number < 1024 || number > 65535 || [WEB_PORT, LAB_PORT].includes(number)) fail('PORT');
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
  if (env.CROUPIER_PLAYER_ACCOUNTS && !['0', '1'].includes(env.CROUPIER_PLAYER_ACCOUNTS)) fail('CROUPIER_PLAYER_ACCOUNTS');
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
  if (streaming && (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(dailyBudgetUsd)
    || Number(dailyBudgetUsd) <= 0 || Number(dailyBudgetUsd) > 10
    || Number(sessionReserveUsd) > Number(dailyBudgetUsd))) fail('CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD');
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
  const database = env.CROUPIER_DATABASE || 'sqlite';
  if (!['sqlite', 'postgres'].includes(database)) fail('CROUPIER_DATABASE');
  const gameDatabaseUrl = env.CROUPIER_GAME_DATABASE_URL || '';
  if (database === 'postgres') validateGameConnection(gameDatabaseUrl, zonesDatabaseUrl);
  else if (gameDatabaseUrl) fail('CROUPIER_DATABASE/CROUPIER_GAME_DATABASE_URL');
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
  const frontendOrigin = env.CROUPIER_VERCEL_FRONTEND_ORIGIN
    ? httpsOrigin(env.CROUPIER_VERCEL_FRONTEND_ORIGIN, 'CROUPIER_VERCEL_FRONTEND_ORIGIN') : '';
  if (frontendOrigin && [gameOrigin, boOrigin, labOrigin].includes(frontendOrigin)) fail('CROUPIER_VERCEL_FRONTEND_ORIGIN');
  const labBasePath = singleOrigin ? '/studio' : '';
  if (env.CROUPIER_LAB_BASE_PATH !== undefined && env.CROUPIER_LAB_BASE_PATH !== labBasePath) fail('CROUPIER_LAB_BASE_PATH');
  if (httpsOrigin(env.CROUPIER_GAME_ORIGIN || (singleOrigin ? gameOrigin : ''), 'CROUPIER_GAME_ORIGIN') !== gameOrigin
    || httpsOrigin(env.BETTALOTTO_PARTNER_BASE_URL || (singleOrigin ? gameOrigin : ''), 'BETTALOTTO_PARTNER_BASE_URL') !== gameOrigin) {
    fail('CROUPIER_GAME_ORIGIN/BETTALOTTO_PARTNER_BASE_URL');
  }
  if (env.CROUPIER_STREAM_LANE !== 'lissabon-stream-lane') fail('CROUPIER_STREAM_LANE');
  const publicPort = port(env.PORT);
  const disk = env.CROUPIER_CLOUD_DATA_ROOT;
  if (typeof disk !== 'string' || !isAbsolute(disk)) fail('CROUPIER_CLOUD_DATA_ROOT');
  const dataRoot = resolve(disk);
  if (dataRoot === parse(dataRoot).root || !outside(resolve(repository), dataRoot)) fail('CROUPIER_CLOUD_DATA_ROOT');
  const paths = {
    players: join(dataRoot, 'players'), studio: join(dataRoot, 'studio'),
    generations: join(dataRoot, 'generations'), speech: join(dataRoot, 'speech'),
  };
  const mediaBlobIndex = env.CROUPIER_MEDIA_BLOB_INDEX || '';
  if (mediaBlobIndex && (mediaStorage !== 'blob' || !isAbsolute(mediaBlobIndex)
    || ![join(repository,'media/blob-index.json'),join(paths.studio,'media-blob-index.json')].some(path => samePath(path,mediaBlobIndex)))) fail('CROUPIER_MEDIA_BLOB_INDEX');
  for (const [name, path] of Object.entries({ CROUPIER_DATA_DIR: paths.players,
    LAB_STUDIO_DATA_DIR: paths.studio, CROUPIER_PRESENTATION_STUDIO_DIR: paths.studio,
    CROUPIER_GENERATIONS_DIR: paths.generations, CROUPIER_GENERATED_SPEECH_DIR: paths.speech })) {
    if (env[name] && resolve(env[name]) !== path) fail(name);
  }
  let videoArchive;
  if (env.LAB_VIDEO_ARCHIVE !== undefined) {
    if (!isAbsolute(env.LAB_VIDEO_ARCHIVE)) fail('LAB_VIDEO_ARCHIVE');
    videoArchive = resolve(normalizePresentationArchive(env.LAB_VIDEO_ARCHIVE, repository));
  }
  const director = optionalPair(env, 'CROUPIER_PRESENTATION_DIRECTOR_URL', 'CROUPIER_PRESENTATION_DIRECTOR_TOKEN');
  const productSpeech = optionalPair(env, 'OPENCLAW_PRODUCT_SPEECH_URL', 'OPENCLAW_PRODUCT_SPEECH_TOKEN');
  if (!productSpeech.url) fail('OPENCLAW_PRODUCT_SPEECH_URL/TOKEN');
  const labRemote = optionalPair(env, 'LAB_REMOTE_URL', 'LAB_REMOTE_TOKEN');
  const timeoutMs = Number(env.OPENCLAW_TIMEOUT_MS ?? 8000);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 30000) fail('OPENCLAW_TIMEOUT_MS');
  const speechTimeoutMs = Number(env.OPENCLAW_SPEECH_TIMEOUT_MS ?? timeoutMs);
  if (!Number.isInteger(speechTimeoutMs) || speechTimeoutMs < 1000 || speechTimeoutMs > 30000) fail('OPENCLAW_SPEECH_TIMEOUT_MS');
  const partnerKeys = ['BETTALOTTO_PARTNER_KEY_ID', 'BETTALOTTO_PARTNER_SECRET', 'BETTALOTTO_PARTNER_PLAYER_ID'];
  const partnerPresent = partnerKeys.map(name => Boolean(env[name]));
  if (partnerPresent.some(Boolean) && !partnerPresent.every(Boolean)) fail('BETTALOTTO_PARTNER_KEY_ID/SECRET/PLAYER_ID');
  if (partnerPresent.every(Boolean) && (!/^ck_live_[A-Za-z0-9_-]{24}$/.test(env.BETTALOTTO_PARTNER_KEY_ID)
    || !/^cs_[A-Za-z0-9_-]{43}$/.test(env.BETTALOTTO_PARTNER_SECRET)
    || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(env.BETTALOTTO_PARTNER_PLAYER_ID))) fail('BETTALOTTO_PARTNER_KEY_ID/SECRET/PLAYER_ID');
  return Object.freeze({ gameOrigin, boOrigin, labOrigin, frontendOrigin, singleOrigin, labBasePath, publicPort, dataRoot, paths, videoArchive,
    database, gameDatabaseUrl, vercelIngress, publicGamePath, storageExport,
    director, productSpeech, labRemote, timeoutMs, speechTimeoutMs, camera, generatedSpeech, streaming,
    mediaStorage, mediaBlobIndex, blobToken: mediaStorage === 'blob' ? blobToken : '', zonesDatabaseUrl,
    playerAccounts: env.CROUPIER_PLAYER_ACCOUNTS === '1',
    streamSecrets: streaming ? { workerSecret, ticketSecret, sessionReserveUsd, dailyBudgetUsd } : null,
    bootstrapAdmin: bootstrapUser ? { user: bootstrapUser, password: bootstrapPassword } : null,
    translationKey: camera ? translationKey : '',
    speechProvider: generatedSpeech ? { cartesiaKey, runpodKey, runpodEndpointId } : null,
    partner: partnerPresent.every(Boolean) ? Object.fromEntries(partnerKeys.map(name => [name, env[name]])) : null });
}

// Read-only check. Filesystem existence cannot prove that a mount is durable.
export async function inspectCloudDisk(config) {
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
export async function inspectCloudBootstrap(config) {
  // This maintenance process starts no product/Lab child and cannot bootstrap
  // or query PostgreSQL. Disk/build preflight remains in start.mjs.
  if (config.storageExport?.mode === 'studio-export') return;
  if (config.bootstrapAdmin) return;
  if (config.database === 'postgres') {
    const storage = createPostgresStore({ connectionString: config.gameDatabaseUrl, zonesConnectionString: config.zonesDatabaseUrl });
    try {
      await storage.db.assertInstalled();
      if (!(await storage.boDb.prepare('SELECT COUNT(*) AS n FROM users').get()).n) fail('CROUPIER_CLOUD_BOOTSTRAP_ADMIN_USER/PASSWORD');
    } finally { await storage.close(); }
    return;
  }
  const dbPath = join(config.paths.players, 'craig.db');
  const info = await lstat(dbPath).catch(() => null);
  if (!info?.isFile() || info.isSymbolicLink()
    || !samePath(await realpath(dbPath).catch(() => ''), dbPath)) {
    fail('CROUPIER_CLOUD_BOOTSTRAP_ADMIN_USER/PASSWORD');
  }
  let db;
  try {
    db = new DatabaseSync(dbPath, { readOnly: true });
    if (!db.prepare('SELECT COUNT(*) AS n FROM users').get().n) fail('CROUPIER_CLOUD_BOOTSTRAP_ADMIN_USER/PASSWORD');
  } catch { fail('CROUPIER_CLOUD_BOOTSTRAP_ADMIN_USER/PASSWORD'); }
  finally { db?.close(); }
}

export function childSpecifications(config, env = process.env, { labInternalSecret } = {}) {
  if (typeof labInternalSecret !== 'string' || Buffer.byteLength(labInternalSecret) < 32) {
    throw new Error('The cloud Lab child requires an internal secret.');
  }
  // Never pass the deployment environment wholesale to either child.
  const base = Object.fromEntries(['PATH', 'Path', 'TMPDIR', 'TEMP', 'TMP', 'TZ',
    'NODE_EXTRA_CA_CERTS', 'SSL_CERT_FILE', 'SSL_CERT_DIR'].filter(name => env[name] !== undefined)
    .map(name => [name, env[name]]));
  const shared = { ...base, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1',
    ...(env.CROUPIER_STUDIO_NEON_POLICY === '1' ? {
      CROUPIER_STUDIO_NEON_POLICY: '1',
      CROUPIER_STUDIO_ENVIRONMENT_ID: env.CROUPIER_STUDIO_ENVIRONMENT_ID,
      CROUPIER_STUDIO_WORKSPACE_ID: env.CROUPIER_STUDIO_WORKSPACE_ID,
      CROUPIER_PUBLIC_ORIGIN: env.CROUPIER_PUBLIC_ORIGIN,
      CROUPIER_VERCEL_INGRESS_SECRET: env.CROUPIER_VERCEL_INGRESS_SECRET,
    } : {}),
    CROUPIER_STREAM_LANE: 'lissabon-stream-lane',
    CROUPIER_MEDIA_STORAGE: config.mediaStorage,
    ...(config.mediaBlobIndex ? { CROUPIER_MEDIA_BLOB_INDEX: config.mediaBlobIndex } : {}),
    ...(config.blobToken ? { BLOB_READ_WRITE_TOKEN: config.blobToken } : {}),
    ...(config.videoArchive ? { LAB_VIDEO_ARCHIVE: config.videoArchive } : {}) };
  return {
    web: { command: process.execPath, args: [join(REPOSITORY, 'web/server.mjs')], cwd: REPOSITORY,
      env: { ...shared, HOST: '127.0.0.1', PORT: String(WEB_PORT), PUBLIC_URL: config.gameOrigin,
        CROUPIER_DATABASE: config.database,
        ...(config.gameDatabaseUrl ? { CROUPIER_GAME_DATABASE_URL: config.gameDatabaseUrl } : {}),
        CROUPIER_PUBLIC_GAME_PATH: config.publicGamePath,
        BO_URL: config.boOrigin, LAB_PUBLIC_URL: config.labOrigin,
        CROUPIER_VERCEL_FRONTEND_ORIGIN: config.frontendOrigin,
        CROUPIER_CLOUD_RUNTIME: '1',
        CROUPIER_CLOUD_LAYOUT: config.singleOrigin ? 'single-origin' : 'separate-hosts',
        CROUPIER_PLAYER_ACCOUNTS: config.playerAccounts ? '1' : '',
        ...(config.bootstrapAdmin ? {
          CROUPIER_CLOUD_BOOTSTRAP_ADMIN_USER: config.bootstrapAdmin.user,
          CROUPIER_CLOUD_BOOTSTRAP_ADMIN_PASSWORD: config.bootstrapAdmin.password,
        } : {}),
        DEMO_GUEST_ACCESS: '', CROUPIER_LISSABON_PROFILES: '',
        CROUPIER_DATA_DIR: config.paths.players, CROUPIER_PRESENTATION_STUDIO_DIR: config.paths.studio,
        CROUPIER_GENERATIONS_DIR: config.paths.generations, CROUPIER_GENERATED_SPEECH_DIR: config.paths.speech,
        CROUPIER_GENERATED_SPEECH: config.generatedSpeech ? '1' : '',
        CROUPIER_CLOUD_GENERATED_SPEECH: config.generatedSpeech ? '1' : '',
        CROUPIER_GENERATED_SPEECH_STREAMING: config.streaming ? '1' : '',
        ...(config.streamSecrets ? {
          CROUPIER_SPEECH_STREAM_WORKER_SECRET: config.streamSecrets.workerSecret,
          CROUPIER_SPEECH_STREAM_TICKET_SECRET: config.streamSecrets.ticketSecret,
          CROUPIER_SPEECH_RUNPOD_SESSION_RESERVE_USD: config.streamSecrets.sessionReserveUsd,
          CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD: config.streamSecrets.dailyBudgetUsd,
        } : {}),
        ...(config.speechProvider ? {
          CARTESIA_API_KEY: config.speechProvider.cartesiaKey,
          RUNPOD_API_KEY: config.speechProvider.runpodKey,
          CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID: config.speechProvider.runpodEndpointId,
        } : {}),
        CROUPIER_ASTRID_CAMERA: config.camera ? '1' : '',
        CROUPIER_ASTRID_TRANSLATION_KEY: config.translationKey,
        CROUPIER_PRESENTATION_DIRECTOR_URL: config.director.url,
        CROUPIER_PRESENTATION_DIRECTOR_TOKEN: config.director.token,
        OPENCLAW_PRODUCT_SPEECH_URL: config.productSpeech.url,
        OPENCLAW_PRODUCT_SPEECH_TOKEN: config.productSpeech.token,
        OPENCLAW_SPEECH_TIMEOUT_MS: String(config.speechTimeoutMs),
        OPENCLAW_TIMEOUT_MS: String(config.timeoutMs) } },
    lab: { command: process.execPath,
      args: [join(REPOSITORY, 'lab/node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(LAB_PORT)],
      cwd: join(REPOSITORY, 'lab'),
      env: { ...shared, HOST: '127.0.0.1', PORT: String(LAB_PORT), CROUPIER_LAB_DIST_DIR: '.next',
        ...(env.CROUPIER_STUDIO_NEON_POLICY === '1' ? { CROUPIER_DATABASE: config.database,
          CROUPIER_GAME_DATABASE_URL: config.gameDatabaseUrl } : {}),
        LAB_PUBLIC_URL: config.labOrigin, CROUPIER_LAB_INTERNAL_SECRET: labInternalSecret,
        CROUPIER_LAB_BASE_PATH: config.labBasePath,
        LAB_STUDIO_DATA_DIR: config.paths.studio, CROUPIER_DATA_DIR: config.paths.players,
        BO_URL: config.boOrigin, CROUPIER_GAME_ORIGIN: config.gameOrigin,
        ...(config.zonesDatabaseUrl ? { CROUPIER_ZONES_DATABASE_URL: config.zonesDatabaseUrl } : {}),
        BETTALOTTO_PARTNER_BASE_URL: config.gameOrigin,
        ...(config.partner ?? {}), LAB_REMOTE_URL: config.labRemote.url, LAB_REMOTE_TOKEN: config.labRemote.token } },
  };
}
