import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { StudioError } from './project-store.mjs';
import { assertLocalRequest, readLocalJson } from './http-guard.mjs';
import { isCloudMediaConfigured, putPrivateMedia, getPrivateMedia, deletePrivateMedia } from './cloud-media-store.mjs';

const exec = promisify(execFile);
export const MAX_ZONE_CLIP_BYTES = 64 * 1024 * 1024;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/;

export function zoneCloudConfigured(env = process.env) {
  return Boolean(env.CROUPIER_ZONES_DATABASE_URL && isCloudMediaConfigured(env));
}

export function validateZones(value) {
  if (!Array.isArray(value) || value.length > 100) throw new StudioError('Högst 100 zoner får sparas.');
  const ids = new Set();
  return value.map(zone => {
    if (!zone || typeof zone !== 'object' || typeof zone.id !== 'string' || !ID.test(zone.id) || ids.has(zone.id)
      || typeof zone.name !== 'string' || !zone.name.trim() || zone.name.length > 50
      || ![zone.x, zone.y, zone.width, zone.height].every(Number.isInteger)
      || zone.x < 0 || zone.y < 0 || zone.width < 4 || zone.height < 4
      || zone.x + zone.width > 1080 || zone.y + zone.height > 1920
      || !['screen', 'normal'].includes(zone.blend)
      || !['continuous', 'automatic', 'off'].includes(zone.playback ?? 'continuous')) {
      throw new StudioError('Zonernas namn, pixelmått eller uppspelning är ogiltiga.');
    }
    ids.add(zone.id);
    const result = { id: zone.id, name: zone.name.trim(), x: zone.x, y: zone.y, width: zone.width, height: zone.height, blend: zone.blend, playback: zone.playback ?? 'continuous' };
    if (zone.cloudClipId != null) {
      if (!UUID.test(zone.cloudClipId) || typeof zone.clipName !== 'string' || !zone.clipName.trim() || zone.clipName.length > 200
        || zone.clipWidth !== zone.width || zone.clipHeight !== zone.height) throw new StudioError('Zonklippets ID, namn eller pixelmått är ogiltiga.');
      Object.assign(result, { cloudClipId: zone.cloudClipId.toLowerCase(), clipName: zone.clipName, clipWidth: zone.clipWidth, clipHeight: zone.clipHeight });
    } else if (zone.clipName) throw new StudioError('Ladda upp zonklippet innan koordinaterna sparas i molnet.');
    return result;
  });
}

// No module-level database connection: builds/offline Lab do not need secrets.
async function queryFor(options) {
  if (options.query) return options.query;
  const env = options.env ?? process.env;
  if (!zoneCloudConfigured(env)) throw new StudioError('Molnlagring för zoner är inte konfigurerad på Lab-servern. Webbläsarkopian finns kvar.', 503);
  let url;
  try { url = new URL(env.CROUPIER_ZONES_DATABASE_URL); } catch { throw new StudioError('Zondatabasens anslutning är ogiltig.', 503); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new StudioError('Zondatabasens anslutning är ogiltig.', 503);
  // Deliberately no DATABASE_URL / POSTGRES_URL fallback: those belong to other resources.
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(env.CROUPIER_ZONES_DATABASE_URL);
  return async (text, values = []) => {
    try { return await sql.query(text, values, { fetchOptions: { signal: AbortSignal.timeout(15000) } }); }
    catch { throw new StudioError('Zondatabasen kunde inte nås. Kontrollera den separata zonanslutningen och installerat zonschema.', 503); }
  };
}

export async function loadCloudZones(request, options = {}) {
  assertLocalRequest(request);
  if (!options.query && !zoneCloudConfigured(options.env ?? process.env)) return { configured: false, revision: 0, zones: [] };
  const query = await queryFor(options);
  const [row] = await query('SELECT revision, zones, updated_at FROM croupier_zones.documents WHERE dealer = $1', ['astrid']);
  return { configured: true, revision: row?.revision ?? 0, zones: row ? validateZones(row.zones) : [], updatedAt: row?.updated_at ?? null };
}

export async function saveCloudZones(request, options = {}) {
  const body = await readLocalJson(request);
  const zones = validateZones(body.zones);
  if (!Number.isSafeInteger(body.revision) || body.revision < 0 || body.revision >= 2147483647) throw new StudioError('Zonernas versionsnummer saknas.');
  const query = await queryFor(options);
  const clipIds = [...new Set(zones.flatMap(zone => zone.cloudClipId ? [zone.cloudClipId] : []))];
  if (clipIds.length) {
    const clips = await query('SELECT id, width, height FROM croupier_zones.clips WHERE id = ANY($1::uuid[])', [clipIds]);
    for (const zone of zones.filter(zone => zone.cloudClipId)) {
      const clip = clips.find(clip => clip.id === zone.cloudClipId);
      if (!clip || clip.width !== zone.width || clip.height !== zone.height) throw new StudioError('Zonklippet saknas i molnet eller har andra pixelmått.', 409);
    }
  }
  // Atomic compare-and-swap prevents another tab's save from being overwritten.
  const [saved] = await query(`INSERT INTO croupier_zones.documents (dealer, revision, zones)
    SELECT $1, 1, $2::jsonb WHERE $3::integer = 0
    ON CONFLICT (dealer) DO NOTHING RETURNING revision, updated_at`, ['astrid', JSON.stringify(zones), body.revision]);
  const updated = saved ?? (await query(`UPDATE croupier_zones.documents SET zones = $1::jsonb, revision = revision + 1, updated_at = now()
    WHERE dealer = $2 AND revision = $3 RETURNING revision, updated_at`, [JSON.stringify(zones), 'astrid', body.revision]))[0];
  if (!updated) throw new StudioError('Molnzonerna ändrades i en annan flik. Läs från molnet innan nästa sparning. Webbläsarkopian finns kvar.', 409);
  return { configured: true, revision: updated.revision, zones, updatedAt: updated.updated_at };
}

export async function probeZoneVideo(bytes, extension) {
  const dir = await mkdtemp(join(tmpdir(), 'croupier-zone-'));
  try {
    const file = join(dir, `clip.${extension}`);
    await writeFile(file, bytes, { flag: 'wx' });
    const { stdout } = await exec('ffprobe', ['-v', 'error', '-protocol_whitelist', 'file', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,codec_type', '-of', 'json', file], { timeout: 15000, maxBuffer: 65536, windowsHide: true });
    const stream = JSON.parse(stdout)?.streams?.[0];
    if (!stream || stream.codec_type !== 'video' || !Number.isInteger(stream.width) || !Number.isInteger(stream.height)) throw new Error('Missing dimensions');
    return { width: stream.width, height: stream.height };
  } catch (error) {
    if (error.code === 'ENOENT') throw new StudioError('Lab-servern saknar ffprobe för säker kontroll av zonklipp.', 503);
    throw new StudioError('Videons bildyta kunde inte verifieras. Välj en giltig MP4- eller WebM-video.', 415);
  } finally { await rm(dir, { recursive: true, force: true }); }
}

export async function uploadZoneClip(request, options = {}) {
  assertLocalRequest(request);
  const type = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  const extension = { 'video/mp4': 'mp4', 'video/webm': 'webm' }[type];
  if (!extension) throw new StudioError('Välj en MP4- eller WebM-video.', 415);
  const width = Number(request.headers.get('x-zone-width')), height = Number(request.headers.get('x-zone-height'));
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 4 || width > 1080 || height < 4 || height > 1920) throw new StudioError('Ange zonens exakta pixelmått.');
  if (Number(request.headers.get('content-length')) > MAX_ZONE_CLIP_BYTES) throw new StudioError('Zonklippet får vara högst 64 MiB.', 413);
  const query = await queryFor(options);
  const reader = request.body?.getReader();
  if (!reader) throw new StudioError('Zonklippet saknas.');
  const chunks = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > MAX_ZONE_CLIP_BYTES) throw new StudioError('Zonklippet får vara högst 64 MiB.', 413);
      chunks.push(Buffer.from(value));
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  const bytes = Buffer.concat(chunks);
  const validHeader = size >= 16 && (extension === 'mp4' ? bytes.toString('ascii', 4, 8) === 'ftyp' : bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])));
  if (!validHeader) throw new StudioError('Filen har inte rätt MP4/WebM-format.', 415);
  const dimensions = await (options.probe ?? probeZoneVideo)(bytes, extension);
  if (dimensions.width !== width || dimensions.height !== height) throw new StudioError(`Klippet är ${dimensions.width} × ${dimensions.height}; zonen kräver exakt ${width} × ${height}.`);
  const id = randomUUID(), sha256 = createHash('sha256').update(bytes).digest('hex');
  const media = await (options.putMedia ?? putPrivateMedia)(`croupier/zones/${id}/${sha256}.${extension}`, bytes, { ...options, contentType: type, sha256, size });
  try { await query('INSERT INTO croupier_zones.clips (id, width, height, media) VALUES ($1::uuid, $2, $3, $4::jsonb)', [id, width, height, JSON.stringify(media)]); }
  catch (error) {
    // The object is new and unreferenced. Existing saved clips are never deleted.
    await (options.deleteMedia ?? deletePrivateMedia)(media, options).catch(() => {});
    throw error;
  }
  return { id, width, height, size };
}

export async function streamZoneClip(request, id, options = {}) {
  assertLocalRequest(request);
  if (!UUID.test(id)) throw new StudioError('Zonklippet saknas.', 404);
  const query = await queryFor(options);
  const [clip] = await query('SELECT media FROM croupier_zones.clips WHERE id = $1::uuid', [id]);
  if (!clip) throw new StudioError('Zonklippet saknas.', 404);
  // assertLocalRequest above verifies the gateway secret and exact public
  // origin before the media adapter accepts Next's internal request URL.
  return (options.getMedia ?? getPrivateMedia)(clip.media, request, { ...options, trustedProxyOrigin: process.env.LAB_PUBLIC_URL });
}
