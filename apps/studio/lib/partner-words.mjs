// Partnerportalens ord som servern också behöver (apps/studio/docs/TERMINOLOGI.md).
// Ren modul utan React: partner-data.mjs läses i serverkomponenter och i
// app/api/partner-rutten, där en modul med useEffect/useState inte får ingå.
// Klientens texter (menyn, skalet) ligger i components/kevin-bo/partner-copy.mjs.
import { PARTNER_VIEW_PERMISSIONS } from '../../../packages/studio-access/server/partner-access-policy.mjs';

// Rollens ord: standardrollerna i apps/studio/lib/operator-admin-api.mjs.
export const PARTNER_ROLE_WORDS = Object.freeze({
  sv: Object.freeze({ 'partner-admin': 'administratör', 'partner-editor': 'redaktör', 'partner-viewer': 'läsare' }),
  en: Object.freeze({ 'partner-admin': 'administrator', 'partner-editor': 'editor', 'partner-viewer': 'reader' }),
});
export function partnerRoleWord(roleId, fallback = '', language = 'sv') {
  return PARTNER_ROLE_WORDS[language === 'en' ? 'en' : 'sv'][roleId] ?? (fallback || roleId || '');
}

// Vyernas ord, så att 403-sidan kan namnge sidan utan att läsa data.
export const PARTNER_VIEW_WORDS = Object.freeze({
  sv: Object.freeze({ overview: 'Översikt', rooms: 'Spelbord', players: 'Spelare', reports: 'Ekonomi', team: 'Team', integration: 'Integration', help: 'Hjälp och kontakt' }),
  en: Object.freeze({ overview: 'Overview', rooms: 'Tables', players: 'Players', reports: 'Finance', team: 'Team', integration: 'Integration', help: 'Help and contact' }),
});

// Texten på 403-sidan för en nekad vy. Rollen är känd när servern nekade med
// snapshotens `denied`; via direktadress utan data namnges bara sidan och behörigheten.
export function partnerDeniedText({ view, role = '', language = 'sv' } = {}) {
  const en = language === 'en', permission = PARTNER_VIEW_PERMISSIONS[view];
  const page = PARTNER_VIEW_WORDS[en ? 'en' : 'sv'][view];
  if (!permission || !page) {
    return en ? 'Your role lacks the permission this page requires. Ask the company administrator or Scoutgaming for access.'
      : 'Rollen saknar den behörighet som sidan kräver. Be bolagets administratör eller Scoutgaming om åtkomst.';
  }
  const who = role ? (en ? `The role ${role}` : `Rollen ${role}`) : (en ? 'Your role' : 'Rollen');
  return en ? `${who} lacks the permission ${permission} that the page ${page} requires. Ask the company administrator or Scoutgaming for access.`
    : `${who} saknar behörigheten ${permission} som sidan ${page} kräver. Be bolagets administratör eller Scoutgaming om åtkomst.`;
}
