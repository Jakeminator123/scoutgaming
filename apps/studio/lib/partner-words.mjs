// Partnerportalens ord som servern också behöver (apps/studio/docs/TERMINOLOGI.md).
// Ren modul utan React: partner-data.mjs läses i serverkomponenter och i
// app/api/partner-rutten, där en modul med useEffect/useState inte får ingå.
// Klientens texter (menyn, skalet) ligger i components/partner/partner-copy.mjs.
// Rollens ord: standardrollerna i apps/studio/lib/operator-admin-api.mjs.
export const PARTNER_ROLE_WORDS = Object.freeze({
  sv: Object.freeze({ 'partner-admin': 'administratör', 'partner-editor': 'redaktör', 'partner-viewer': 'läsare' }),
  en: Object.freeze({ 'partner-admin': 'administrator', 'partner-editor': 'editor', 'partner-viewer': 'reader' }),
});
export function partnerRoleWord(roleId, fallback = '', language = 'sv') {
  return PARTNER_ROLE_WORDS[language === 'en' ? 'en' : 'sv'][roleId] ?? (fallback || roleId || '');
}

// Behörigheterna med vanliga ord (kodens namn står i TERMINOLOGI och i verktygstips).
export const PARTNER_PERMISSION_WORDS = Object.freeze({
  sv: Object.freeze({ 'overview.read': 'se översikten', 'tables.read': 'se spelborden', 'tables.configure': 'ändra spelbordens inställningar', 'presentations.read': 'se scenmallar och utseende',
    'presentations.configure': 'ändra spelbordets utseende och publicera', 'players.read': 'se spelare', 'reports.read': 'se ekonomi', 'integrations.read': 'se integration',
    'team.read': 'se teamet', 'team.invite': 'bjuda in medlemmar', 'team.roles.assign': 'byta roll på medlemmar', 'team.suspend': 'stänga av och återaktivera medlemmar' }),
  en: Object.freeze({ 'overview.read': 'see the overview', 'tables.read': 'see the tables', 'tables.configure': 'change table settings', 'presentations.read': 'see scene templates and appearance',
    'presentations.configure': 'change table appearance and publish', 'players.read': 'see players', 'reports.read': 'see finance', 'integrations.read': 'see integration',
    'team.read': 'see the team', 'team.invite': 'invite members', 'team.roles.assign': 'change member roles', 'team.suspend': 'suspend and reactivate members' }),
});
export function partnerPermissionWord(permission, language = 'sv') {
  return PARTNER_PERMISSION_WORDS[language === 'en' ? 'en' : 'sv'][permission] ?? permission;
}
