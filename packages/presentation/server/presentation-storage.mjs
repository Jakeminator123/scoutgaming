import { createHash } from 'node:crypto';
import { StudioStorageError, canonicalStudioJson, cloneStudioJson } from '../../studio-registry/server/storage-contract.mjs';

export const PRESENTATION_STORAGE_KEY = '_scoutPresentation';
export const EXTENDED_PRESENTATION_FORMAT = 'croupier-lanes-v2';
export const EXTENDED_PRESENTATION_DATA_LIMIT = 30 * 1024;
export const EXTENDED_BRANDING_LIMIT = 32 * 1024;
export const LEGACY_BRANDING_LIMIT = 8000;
export const EXTENDED_PRESENTATION_STORAGE_VERSION = '020';
export const EXTENDED_PRESENTATION_CHECKS = Object.freeze(['operator_packages','operator_branding_drafts'].map(table =>
  Object.freeze({table,name:`${table}_branding_check`})));
export const presentationBrandingCheck = limit => `CHECK (length(branding) >= 2 AND length(branding) <= ${limit})`;
export const EXTENDED_PRESENTATION_ALTERS = Object.freeze(EXTENDED_PRESENTATION_CHECKS.map(({table,name}) =>
  `ALTER TABLE croupier_studio.${table} DROP CONSTRAINT ${name}, ADD CONSTRAINT ${name} CHECK (length(branding) BETWEEN 2 AND 32768)`));
// This is the reviewed, normalized 020 source, including its explanatory comments.
const migrationSource = '-- Optional 020: extend immutable presentation envelopes without changing old rows.\n'
  + '-- Ordinary editable branding remains bounded to 8000 bytes in the application.\n'
  + EXTENDED_PRESENTATION_ALTERS.map(sql => sql + ';\n').join('');
export const EXTENDED_PRESENTATION_STORAGE_CHECKSUM = createHash('sha256').update(migrationSource).digest('hex');

export function isExtendedPresentationEnvelope(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join(',') === 'data,encoding,format,sha256'
    && value.format === EXTENDED_PRESENTATION_FORMAT && value.encoding === 'br-base64url'
    && typeof value.sha256 === 'string' && /^[a-f0-9]{64}$/.test(value.sha256)
    && typeof value.data === 'string' && value.data.length > 0 && value.data.length <= EXTENDED_PRESENTATION_DATA_LIMIT
    && /^[A-Za-z0-9_-]+$/.test(value.data);
}

// Keep the public/editable part bounded independently. A valid extended header
// only permits the additional server-authored compressed envelope, not a larger
// arbitrary branding object. The codec separately verifies its complete body.
export function validatePresentationBranding(value) {
  const copy = cloneStudioJson(value,{maxBytes:EXTENDED_BRANDING_LIMIT,maxNodes:200,maxDepth:6});
  if (!copy || typeof copy !== 'object' || Array.isArray(copy)) throw new StudioStorageError('studio_invalid_data',422);
  const extended = isExtendedPresentationEnvelope(copy[PRESENTATION_STORAGE_KEY]);
  if (Buffer.byteLength(canonicalStudioJson(copy)) > (extended ? EXTENDED_BRANDING_LIMIT : LEGACY_BRANDING_LIMIT))
    throw new StudioStorageError('studio_invalid_data',422);
  if (extended) {
    const ordinary = {...copy}; delete ordinary[PRESENTATION_STORAGE_KEY];
    if (Buffer.byteLength(canonicalStudioJson(ordinary)) > LEGACY_BRANDING_LIMIT) throw new StudioStorageError('studio_invalid_data',422);
  }
  return copy;
}

// query is the existing scoped operator-store runner: $1/$2 retain its scope.
// No writes, repairs, cache or fallback. Run again on the publication connection.
export async function assertExtendedPresentationStorage(query) {
  const rows = await query(`/* operator-store:extended-presentation-ready */
    SELECT m.checksum,m.structure_checksum,
      (SELECT count(*)::integer FROM pg_constraint c
        JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
        WHERE n.nspname='croupier_studio' AND c.contype='c' AND c.convalidated AND NOT c.condeferrable AND NOT c.condeferred
          AND ((t.relname='operator_packages' AND c.conname='operator_packages_branding_check')
            OR (t.relname='operator_branding_drafts' AND c.conname='operator_branding_drafts_branding_check'))
          AND pg_get_constraintdef(c.oid,true)=$3) AS matching_checks
      FROM croupier_studio.storage_migrations m
      WHERE $1::text IS NOT NULL AND $2::text IS NOT NULL AND m.version='020'`,[presentationBrandingCheck(EXTENDED_BRANDING_LIMIT)]);
  if (rows.length !== 1 || rows[0].checksum !== EXTENDED_PRESENTATION_STORAGE_CHECKSUM
    || !/^[a-f0-9]{64}$/.test(rows[0].structure_checksum ?? '') || rows[0].matching_checks !== 2)
    throw new StudioStorageError('studio_extended_presentation_storage_unavailable',503);
  return true;
}
