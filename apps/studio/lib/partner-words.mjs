// Partnerportalens ord som servern också behöver (apps/studio/docs/TERMINOLOGI.md).
// Ren modul utan React: partner-data.mjs läses i serverkomponenter och i
// app/api/partner-rutten, där en modul med useEffect/useState inte får ingå.
// Klientens texter (menyn, skalet) ligger i components/kevin-bo/partner-copy.mjs.
// Rollens ord: standardrollerna i apps/studio/lib/operator-admin-api.mjs.
export const PARTNER_ROLE_WORDS = Object.freeze({
  sv: Object.freeze({ 'partner-admin': 'administratör', 'partner-editor': 'redaktör', 'partner-viewer': 'läsare' }),
  en: Object.freeze({ 'partner-admin': 'administrator', 'partner-editor': 'editor', 'partner-viewer': 'reader' }),
});
export function partnerRoleWord(roleId, fallback = '', language = 'sv') {
  return PARTNER_ROLE_WORDS[language === 'en' ? 'en' : 'sv'][roleId] ?? (fallback || roleId || '');
}
