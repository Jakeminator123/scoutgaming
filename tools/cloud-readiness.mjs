#!/usr/bin/env node
// Read-only preparation report. Never imports a server, reads .env files, opens
// databases, probes providers, or reads media bytes. Configuration values stay private.
import { lstat, readFile, realpath } from 'node:fs/promises';
import { isIP } from 'node:net';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizePresentationArchive } from './media-layout.mjs';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const SOURCE_FILES = [
  'web/server.mjs', 'web/shoe-game.mjs', 'web/native-table.mjs',
  'web/partner-presentation.mjs', 'web/partner-api.mjs',
  'presentation-runtime/selection.mjs', 'web/public/local-presentation.mjs',
  'web/public/performance-player.mjs', 'web/presentation-api.mjs',
  'lab/lib/http-guard.mjs', 'lab/lib/project-store.mjs', 'lab/lib/partner-observer.mjs',
  'web/lissabon-profiles.mjs', 'web/generated-speech.mjs',
  'lab/start.mjs', 'lab/policies/project.seed.json', 'lab/package-lock.json',
];
export const ARCHITECTURE_BLOCKERS = [
  { id: 'durable-state', files: ['web/server.mjs', 'lab/lib/project-store.mjs'],
    requirement: 'Provide durable SQLite and a shared writable project/history directory; deployment checkout or function temporary storage is insufficient.' },
  { id: 'studio-access', files: ['lab/lib/http-guard.mjs'],
    requirement: 'BO-to-Lab admin handoff and per-request identity checks exist in the gated cloud scaffold; verify real HTTPS routing, cookies, denial paths and session expiry before launch.' },
  { id: 'partner-origin', files: ['lab/lib/partner-observer.mjs'],
    requirement: 'Set BETTALOTTO_PARTNER_BASE_URL and CROUPIER_GAME_ORIGIN to the same exact HTTPS game origin, then verify the authenticated observer.' },
  { id: 'profile-access', files: ['web/lissabon-profiles.mjs', 'web/server.mjs'],
    requirement: 'Use authenticated cloud identity or a protected demo. Local passwordless profile switching is loopback-only and disabled in production.' },
  { id: 'speech-activation', files: ['web/generated-speech.mjs'],
    requirement: 'Configure CROUPIER_CLOUD_GENERATED_SPEECH with production HTTPS origin, private speech store and provider credentials; verify authenticated paid speech flow.' },
  { id: 'media-location', files: ['web/presentation-api.mjs', 'lab/lib/video-registry.mjs'],
    requirement: 'Mount one durable LAB_VIDEO_ARCHIVE containing the exact manifest and media for product and Lab, and verify hashes and Range responses.' },
  { id: 'process-state', files: ['web/partner-api.mjs', 'web/server.mjs'],
    requirement: 'Keep one long-lived product replica initially. SSE subscribers and active chat/Probe state are process-local; scaling needs durable coordination.' },
  { id: 'deployment-verification', files: ['docs/CLOUD-MIGRATION.md'],
    requirement: 'Verify actual HTTPS access, persistence across restart, media Range requests, game events and speech end-to-end before claiming readiness.' },
];

const present = value => typeof value === 'string' && value.trim().length > 0;
const contained = (base, target) => {
  const path = relative(base, target);
  return path === '' || (!isAbsolute(path) && path !== '..' && !path.startsWith(`..${sep}`));
};
async function kind(path) {
  try { const info = await lstat(path); return info.isSymbolicLink() ? 'symlink' : info.isDirectory() ? 'directory' : info.isFile() ? 'file' : 'other'; }
  catch (error) { return error.code === 'ENOENT' ? 'missing' : 'unreadable'; }
}
function secureUrl(value) {
  if (!present(value)) return 'missing';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash
      && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ? 'https' : 'invalid-cloud-url';
  } catch { return 'invalid-cloud-url'; }
}
function secureOrigin(value) {
  if (!present(value)) return false;
  try {
    const url = new URL(value);
    return secureUrl(value) === 'https' && !url.port && url.pathname === '/'
      && !isIP(url.hostname) && url.hostname.includes('.') && !url.hostname.endsWith('.local')
      && value === url.origin;
  } catch { return false; }
}
async function mediaReport(root, env) {
  const archive = normalizePresentationArchive(Object.hasOwn(env, 'LAB_VIDEO_ARCHIVE') ? env.LAB_VIDEO_ARCHIVE : join(root, 'media/dealers/astrid/runtime/presentation'),root);
  const result = { status: 'unavailable', items: 0, present: 0, missing: 0, invalid: 0, sizeMismatch: 0,
    validation: 'Metadata and file sizes only; no hashes, decoding, or visual acceptance.' };
  if (typeof archive !== 'string' || !isAbsolute(archive)) return result;
  const manifestPath = join(archive, 'lab-video-manifest.json');
  try {
    const archiveInfo = await lstat(archive);
    if (!archiveInfo.isDirectory() || archiveInfo.isSymbolicLink()) return result;
    const info = await lstat(manifestPath);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 5 * 1024 * 1024) return result;
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    if (manifest.schemaVersion !== 2 || !Array.isArray(manifest.items) || manifest.items.length > 10000) return result;
    result.items = manifest.items.length;
    const canonicalArchive = await realpath(archive);
    for (const item of manifest.items) {
      const path = item?.relativePath;
      if (typeof path !== 'string' || path.includes('\\') || isAbsolute(path)
        || path.split('/').some(part => !part || part === '.' || part === '..')
        || !path.endsWith('.mp4') || !Number.isSafeInteger(item.size) || item.size < 1) { result.invalid++; continue; }
      const target = resolve(archive, path);
      try {
        const file = await lstat(target);
        if (!file.isFile() || file.isSymbolicLink() || !contained(canonicalArchive, await realpath(target))) result.invalid++;
        else if (file.size !== item.size) result.sizeMismatch++;
        else result.present++;
      } catch { result.missing++; }
    }
    result.status = result.items > 0 && !result.missing && !result.invalid && !result.sizeMismatch ? 'metadata-present' : 'incomplete';
  } catch { /* Never print parser errors, arbitrary manifest values, or private paths. */ }
  return result;
}

export async function collectCloudReadiness({ root = repository, env = process.env } = {}) {
  root = resolve(root);
  const sources = await Promise.all(SOURCE_FILES.map(async file => ({ file, status: await kind(join(root, file)) })));
  const directories = await Promise.all(['CROUPIER_DATA_DIR', 'LAB_STUDIO_DATA_DIR',
    'CROUPIER_PRESENTATION_STUDIO_DIR', 'CROUPIER_GENERATED_SPEECH_DIR'].map(async name => {
    const configured = present(env[name]);
    const absolute = configured && isAbsolute(env[name]);
    const path = absolute ? resolve(env[name]) : null;
    return { name, configured, absolute, outsideCheckout: path ? !contained(root, path) : null,
      status: path ? await kind(path) : configured ? 'relative-path' : 'not-configured',
      durableMountVerified: false };
  }));
  const shared = ['LAB_STUDIO_DATA_DIR', 'CROUPIER_PRESENTATION_STUDIO_DIR'].every(name => present(env[name]) && isAbsolute(env[name]));
  const urls = ['PUBLIC_URL', 'BO_URL', 'LAB_REMOTE_URL', 'OPENCLAW_PRODUCT_SPEECH_URL', 'CROUPIER_PRESENTATION_DIRECTOR_URL']
    .map(name => ({ name, status: secureUrl(env[name]) }));
  const credentials = ['LAB_REMOTE_TOKEN', 'OPENCLAW_PRODUCT_SPEECH_TOKEN', 'CROUPIER_PRESENTATION_DIRECTOR_TOKEN',
    'CARTESIA_API_KEY', 'RUNPOD_API_KEY', 'CROUPIER_ASTRID_TRANSLATION_KEY'].map(name => ({ name, configured: present(env[name]) }));
  return {
    schemaVersion: 1, ready: false, status: 'migration-required',
    scope: 'Read-only local evidence and supplied process environment; no .env values, database contents, media bytes or network requests.',
    sources, media: await mediaReport(root, env),
    configuration: { directories,
      sharedStudioDirectory: shared ? resolve(env.LAB_STUDIO_DATA_DIR) === resolve(env.CROUPIER_PRESENTATION_STUDIO_DIR) : null,
      urls, credentials,
      mediaArchive: { configured: Object.hasOwn(env, 'LAB_VIDEO_ARCHIVE'),
        absolute: isAbsolute(env.LAB_VIDEO_ARCHIVE ?? ''),
        status: !Object.hasOwn(env, 'LAB_VIDEO_ARCHIVE') ? 'repo-default'
          : !isAbsolute(env.LAB_VIDEO_ARCHIVE ?? '') ? 'invalid-path' : await kind(env.LAB_VIDEO_ARCHIVE) },
      partnerOrigin: secureOrigin(env.BETTALOTTO_PARTNER_BASE_URL)
        && env.BETTALOTTO_PARTNER_BASE_URL === env.CROUPIER_GAME_ORIGIN
          ? 'matched-https-origin' : 'not-configured-or-mismatch',
      speechEndpoint: !present(env.CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID) ? 'missing'
        : /^[A-Za-z0-9_-]{1,100}$/.test(env.CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID) ? 'id-present' : 'invalid-id',
      streamLane: env.CROUPIER_STREAM_LANE === 'lissabon-stream-lane' ? 'lissabon' : 'not-lissabon',
      generatedSpeechEnabled: env.CROUPIER_GENERATED_SPEECH === '1',
      generatedSpeechPreviewEnabled: env.CROUPIER_GENERATED_SPEECH_PREVIEW === '1',
      cloudGeneratedSpeechRequested: env.CROUPIER_CLOUD_GENERATED_SPEECH === '1',
      currentSpeechHostGateSatisfied: ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(env.HOST),
    },
    blockers: ARCHITECTURE_BLOCKERS,
    next: 'Follow docs/CLOUD-MIGRATION.md. Configuration presence is not authentication, durable storage, media approval, or deployment proof.',
  };
}

export async function main(args = process.argv.slice(2)) {
  if (args.some(arg => !['--json', '--strict'].includes(arg))) throw new Error('Usage: node tools/cloud-readiness.mjs [--json] [--strict]');
  const report = await collectCloudReadiness();
  if (args.includes('--json')) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`Cloud readiness: ${report.status} (ready: false)`);
    console.log(`Sources: ${report.sources.filter(item => item.status === 'file').length}/${report.sources.length}; media: ${report.media.present}/${report.media.items} (${report.media.status}).`);
    for (const blocker of report.blockers) console.log(`- ${blocker.id}: ${blocker.requirement}`);
    console.log('Use --json for redacted configuration evidence. --strict exits 2 while migration is required.');
  }
  return args.includes('--strict') && !report.ready ? 2 : 0;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(code => { process.exitCode = code; }).catch(() => { console.error('Cloud readiness failed. Usage: node tools/cloud-readiness.mjs [--json] [--strict]'); process.exitCode = 1; });
}
