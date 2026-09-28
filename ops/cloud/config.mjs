import { access, lstat, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { isIP } from 'node:net';
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPOSITORY = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const WEB_PORT = 4173;
export const LAB_PORT = 4188;

const outside = (base, path) => {
  const rel = relative(base, path);
  return rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel);
};
const fail = name => { throw new Error(`Invalid or missing ${name}.`); };

function httpsOrigin(value, name) {
  let url;
  try { url = new URL(value); } catch { fail(name); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash
    || url.pathname !== '/' || url.port || isIP(url.hostname)
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
  for (const name of ['DEMO_GUEST_ACCESS', 'CROUPIER_GENERATED_SPEECH',
    'CROUPIER_CLOUD_GENERATED_SPEECH', 'CROUPIER_GENERATED_SPEECH_PREVIEW',
    'CROUPIER_ASTRID_CAMERA', 'CROUPIER_LISSABON_PROFILES']) {
    if (env[name] === '1') fail(name);
  }
  const gameOrigin = httpsOrigin(env.PUBLIC_URL, 'PUBLIC_URL');
  const labOrigin = httpsOrigin(env.LAB_PUBLIC_URL, 'LAB_PUBLIC_URL');
  if (gameOrigin === labOrigin) fail('LAB_PUBLIC_URL');
  if (httpsOrigin(env.BO_URL, 'BO_URL') !== gameOrigin) fail('BO_URL');
  if (httpsOrigin(env.CROUPIER_GAME_ORIGIN, 'CROUPIER_GAME_ORIGIN') !== gameOrigin
    || httpsOrigin(env.BETTALOTTO_PARTNER_BASE_URL, 'BETTALOTTO_PARTNER_BASE_URL') !== gameOrigin) {
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
  for (const [name, path] of Object.entries({ CROUPIER_DATA_DIR: paths.players,
    LAB_STUDIO_DATA_DIR: paths.studio, CROUPIER_PRESENTATION_STUDIO_DIR: paths.studio,
    CROUPIER_GENERATIONS_DIR: paths.generations, CROUPIER_GENERATED_SPEECH_DIR: paths.speech })) {
    if (env[name] && resolve(env[name]) !== path) fail(name);
  }
  let videoArchive;
  if (env.LAB_VIDEO_ARCHIVE !== undefined) {
    if (!isAbsolute(env.LAB_VIDEO_ARCHIVE)) fail('LAB_VIDEO_ARCHIVE');
    videoArchive = resolve(env.LAB_VIDEO_ARCHIVE);
  }
  const director = optionalPair(env, 'CROUPIER_PRESENTATION_DIRECTOR_URL', 'CROUPIER_PRESENTATION_DIRECTOR_TOKEN');
  const productSpeech = optionalPair(env, 'OPENCLAW_PRODUCT_SPEECH_URL', 'OPENCLAW_PRODUCT_SPEECH_TOKEN');
  const labRemote = optionalPair(env, 'LAB_REMOTE_URL', 'LAB_REMOTE_TOKEN');
  const partnerKeys = ['BETTALOTTO_PARTNER_KEY_ID', 'BETTALOTTO_PARTNER_SECRET', 'BETTALOTTO_PARTNER_PLAYER_ID'];
  const partnerPresent = partnerKeys.map(name => Boolean(env[name]));
  if (partnerPresent.some(Boolean) && !partnerPresent.every(Boolean)) fail('BETTALOTTO_PARTNER_KEY_ID/SECRET/PLAYER_ID');
  if (partnerPresent.every(Boolean) && (!/^ck_live_[A-Za-z0-9_-]{24}$/.test(env.BETTALOTTO_PARTNER_KEY_ID)
    || !/^cs_[A-Za-z0-9_-]{43}$/.test(env.BETTALOTTO_PARTNER_SECRET)
    || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(env.BETTALOTTO_PARTNER_PLAYER_ID))) fail('BETTALOTTO_PARTNER_KEY_ID/SECRET/PLAYER_ID');
  return Object.freeze({ gameOrigin, labOrigin, publicPort, dataRoot, paths, videoArchive,
    director, productSpeech, labRemote,
    partner: partnerPresent.every(Boolean) ? Object.fromEntries(partnerKeys.map(name => [name, env[name]])) : null });
}

// Read-only check. Filesystem existence cannot prove that a mount is durable.
export async function inspectCloudDisk(config) {
  const info = await lstat(config.dataRoot).catch(() => null);
  if (!info?.isDirectory() || info.isSymbolicLink()
    || await realpath(config.dataRoot).catch(() => null) !== config.dataRoot) fail('CROUPIER_CLOUD_DATA_ROOT');
  await access(config.dataRoot, constants.R_OK | constants.W_OK | constants.X_OK).catch(() => fail('CROUPIER_CLOUD_DATA_ROOT'));
  if (config.videoArchive) {
    const archive = await lstat(config.videoArchive).catch(() => null);
    if (!archive?.isDirectory() || archive.isSymbolicLink()) fail('LAB_VIDEO_ARCHIVE');
  }
}

export function childSpecifications(config, env = process.env) {
  // Never pass the deployment environment wholesale to either child.
  const base = Object.fromEntries(['PATH', 'Path', 'TMPDIR', 'TEMP', 'TMP', 'TZ',
    'NODE_EXTRA_CA_CERTS', 'SSL_CERT_FILE', 'SSL_CERT_DIR'].filter(name => env[name] !== undefined)
    .map(name => [name, env[name]]));
  const shared = { ...base, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1',
    CROUPIER_STREAM_LANE: 'lissabon-stream-lane',
    ...(config.videoArchive ? { LAB_VIDEO_ARCHIVE: config.videoArchive } : {}) };
  return {
    web: { command: process.execPath, args: [join(REPOSITORY, 'web/server.mjs')], cwd: REPOSITORY,
      env: { ...shared, HOST: '127.0.0.1', PORT: String(WEB_PORT), PUBLIC_URL: config.gameOrigin,
        BO_URL: config.gameOrigin, DEMO_GUEST_ACCESS: '', CROUPIER_LISSABON_PROFILES: '',
        CROUPIER_DATA_DIR: config.paths.players, CROUPIER_PRESENTATION_STUDIO_DIR: config.paths.studio,
        CROUPIER_GENERATIONS_DIR: config.paths.generations, CROUPIER_GENERATED_SPEECH_DIR: config.paths.speech,
        CROUPIER_GENERATED_SPEECH: '', CROUPIER_CLOUD_GENERATED_SPEECH: '',
        CROUPIER_ASTRID_CAMERA: '',
        CROUPIER_PRESENTATION_DIRECTOR_URL: config.director.url,
        CROUPIER_PRESENTATION_DIRECTOR_TOKEN: config.director.token,
        OPENCLAW_PRODUCT_SPEECH_URL: config.productSpeech.url,
        OPENCLAW_PRODUCT_SPEECH_TOKEN: config.productSpeech.token } },
    lab: { command: process.execPath,
      args: [join(REPOSITORY, 'lab/node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(LAB_PORT)],
      cwd: join(REPOSITORY, 'lab'),
      env: { ...shared, HOST: '127.0.0.1', PORT: String(LAB_PORT), CROUPIER_LAB_DIST_DIR: '.next',
        LAB_STUDIO_DATA_DIR: config.paths.studio, CROUPIER_GAME_ORIGIN: config.gameOrigin,
        BETTALOTTO_PARTNER_BASE_URL: config.gameOrigin,
        ...(config.partner ?? {}), LAB_REMOTE_URL: config.labRemote.url, LAB_REMOTE_TOKEN: config.labRemote.token } },
  };
}
