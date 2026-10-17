const DISPLAY_NAME_FORBIDDEN = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;
export function normalizeDisplayName(value) {
  if (value === undefined || value === null) return 'spelaren';
  if (typeof value !== 'string') throw new Error('displayName must be a string');
  const normalized = value.normalize('NFC');
  if (DISPLAY_NAME_FORBIDDEN.test(normalized)) throw new Error('displayName contains control or formatting characters');
  const compact = normalized.replace(/\p{White_Space}+/gu, ' ').trim();
  if (!compact) throw new Error('displayName must not be empty');
  if ([...compact].length > 40) throw new Error('displayName must be at most 40 characters');
  return compact;
}
