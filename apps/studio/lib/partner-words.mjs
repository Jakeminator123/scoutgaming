// Partnerportalens ord som servern också behöver (apps/studio/docs/TERMINOLOGI.md).
// Ren modul utan React: partner-data.mjs läses i serverkomponenter och i
// app/api/partner-rutten, där en modul med useEffect/useState inte får ingå.
// Klientens texter (menyn, skalet) ligger i components/kevin-bo/partner-copy.mjs.
import { PARTNER_VIEW_PERMISSIONS } from '../../../packages/studio-access/server/partner-access-policy.mjs';
import { resolveWorkspaceSurfacePath } from '../../../packages/navigation/workspace-surfaces.mjs';

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

// Texten på 403-sidan (app/forbidden.tsx). Sidan har ingen data: ur adressen
// vet den vilken vy och behörighet det gäller, inte rollen eller bolaget.
// Utanför Partnerportalen, eller för ett bolag kontot inte tillhör, är texten allmän.
export function partnerForbiddenText(pathname, language = 'sv') {
  const en = language === 'en';
  const route = resolveWorkspaceSurfacePath(typeof pathname === 'string' ? pathname : '');
  const view = route?.surface === 'partner' && route.operatorSlug ? route.view : null;
  const permission = view ? PARTNER_VIEW_PERMISSIONS[view] : null, page = view ? PARTNER_VIEW_WORDS[en ? 'en' : 'sv'][view] : null;
  return {
    title: en ? 'Access denied (403)' : 'Åtkomst nekad (403)',
    body: permission
      ? (en ? `The page ${page} requires the permission ${permission}, which your role in this company lacks, or your account is not a member of the company. Ask the company administrator or Scoutgaming for access.`
        : `Sidan ${page} kräver behörigheten ${permission}, som din roll i bolaget saknar, eller så är kontot inte medlem i bolaget. Be bolagets administratör eller Scoutgaming om åtkomst.`)
      : (en ? 'Your account may not open this page. Ask the company administrator or Scoutgaming for access.'
        : 'Kontot får inte öppna den här sidan. Be bolagets administratör eller Scoutgaming om åtkomst.'),
    link: route?.surface === 'partner' && route.operatorSlug ? `/partner/${route.operatorSlug}` : '/partner',
    linkText: en ? 'To Partnerportalen' : 'Till Partnerportalen',
  };
}
