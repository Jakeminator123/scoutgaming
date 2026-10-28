import { useEffect, useState } from 'react';
import { PARTNER_VIEWS } from '../../../../packages/navigation/workspace-surfaces.mjs';
import { PARTNER_VIEW_PERMISSIONS } from '../../../../packages/studio-access/server/partner-access-policy.mjs';

// Orden följer apps/studio/docs/TERMINOLOGI.md: Partnerportalen, bolag, spelbord,
// bordsgrafik, scenmall, tilldelning, revision, utkast/publicerad,
// administratör/redaktör/läsare.
const COPY = Object.freeze({
  sv: {
    portal: 'Partnerportalen', level: 'Partnerportalen', partners: 'Bolag', company: 'Bolag',
    admin: 'Scoutgamings personal', member: 'Bolagets team', signedIn: 'Inloggad som',
    switchAccount: 'Byt konto', logOut: 'Logga ut', loggingOut: 'Loggar ut…',
    logoutError: 'Utloggningen kunde inte bekräftas. Du är kvar på sidan. Försök igen.',
    directoryIntroAdmin: 'Öppna ett bolag med samma konto. Åtkomsten kontrolleras för varje bolag.',
    directoryIntroMember: 'Här finns de bolag ditt konto har åtkomst till.',
    open: 'Öppna portalen', directory: 'Alla bolag', noPartners: 'Inga tillgängliga bolag',
    search: 'Sök bolag', noMatches: 'Inga bolag matchar', noMatchesBody: 'Prova ett annat namn eller rensa sökningen.',
    noPartnersBody: 'Ditt konto har ingen aktiv bolagskoppling. Be Scoutgaming kontrollera åtkomsten.',
    sameLogin: 'Samma konto', control: 'Admin', player: 'Spelarlobby',
    directoryNote: 'Listan hämtas från registrerade bolag. Inga exempeldata visas här.',
    theme: 'Tema', light: 'Ljust', dark: 'Mörkt', language: 'Språk', menu: 'Meny',
    overview: 'Översikt', rooms: 'Spelbord', players: 'Spelare', reports: 'Ekonomi', team: 'Team', integration: 'Integration', help: 'Hjälp och kontakt',
    assignmentFrom: 'Tilldelning från Scoutgaming', revision: 'revision', packageMissing: 'Ingen publicerad tilldelning',
    dealers: 'dealers', lanes: 'scenmallar', tables: 'bordsgrafik', backgrounds: 'bakgrunder', switchCompany: 'Byt bolag',
    notConnected: 'Inte anslutet',
    deniedTitle: 'Den här sidan kräver en behörighet som rollen saknar',
    deniedBody: 'Rollen {role} saknar behörigheten {permission}. Be bolagets administratör eller Scoutgaming om åtkomst.',
    toOverview: 'Till översikten',
    unsavedLeave: 'Du har osparade ändringar i spelbordets utseende. Lämna sidan och kasta dessa ändringar?',
    draftKept: 'Osparade ändringar finns kvar under Spelbord.',
  },
  en: {
    portal: 'Partner portal', level: 'Partner portal', partners: 'Companies', company: 'Company',
    admin: 'Scoutgaming staff', member: 'Company team', signedIn: 'Signed in as',
    switchAccount: 'Switch account', logOut: 'Log out', loggingOut: 'Signing out…',
    logoutError: 'Sign-out could not be confirmed. You are still on this page. Please try again.',
    directoryIntroAdmin: 'Open a company with the same account. Access is checked separately for each company.',
    directoryIntroMember: 'These are the companies your account can access.',
    open: 'Open the portal', directory: 'All companies', noPartners: 'No companies available',
    search: 'Search companies', noMatches: 'No matching companies', noMatchesBody: 'Try another name or clear the search.',
    noPartnersBody: 'Your account has no active company membership. Ask Scoutgaming to check your access.',
    sameLogin: 'Same account', control: 'Admin', player: 'Player lobby',
    directoryNote: 'This list comes from registered companies. No sample data is shown here.',
    theme: 'Theme', light: 'Light', dark: 'Dark', language: 'Language', menu: 'Menu',
    overview: 'Overview', rooms: 'Tables', players: 'Players', reports: 'Finance', team: 'Team', integration: 'Integration', help: 'Help and contact',
    assignmentFrom: 'Assignment from Scoutgaming', revision: 'revision', packageMissing: 'No published assignment',
    dealers: 'dealers', lanes: 'scene templates', tables: 'table graphics', backgrounds: 'backgrounds', switchCompany: 'Switch company',
    notConnected: 'Not connected',
    deniedTitle: 'This page needs a permission your role does not have',
    deniedBody: 'The role {role} lacks the permission {permission}. Ask the company administrator or Scoutgaming for access.',
    toOverview: 'To the overview',
    unsavedLeave: 'You have unsaved changes to the table appearance. Leave this page and discard those changes?',
    draftKept: 'Unsaved changes are kept under Tables.',
  },
});

export function partnerCopy(language = 'sv') { return COPY[language === 'en' ? 'en' : 'sv']; }

// Rollens ord (TERMINOLOGI): standardrollerna i apps/studio/lib/operator-admin-api.mjs.
export const PARTNER_ROLE_WORDS = Object.freeze({
  sv: Object.freeze({ 'partner-admin': 'administratör', 'partner-editor': 'redaktör', 'partner-viewer': 'läsare' }),
  en: Object.freeze({ 'partner-admin': 'administrator', 'partner-editor': 'editor', 'partner-viewer': 'reader' }),
});
export function partnerRoleWord(roleId, fallback = '', language = 'sv') {
  return PARTNER_ROLE_WORDS[language === 'en' ? 'en' : 'sv'][roleId] ?? (fallback || roleId || '');
}

// Menyn är presentation: samma karta som servern använder för att neka en vy.
export function partnerNavigation(language, permissions = []) {
  const copy = partnerCopy(language), allowed = new Set(permissions);
  return PARTNER_VIEWS.filter(view => allowed.has(PARTNER_VIEW_PERMISSIONS[view])).map(id => ({ id, label: copy[id] }));
}

// Presentation preferences only; business data and drafts remain server-owned.
export function usePartnerPreferences() {
  const [language, setLanguage] = useState('sv'), [theme, setTheme] = useState('light');
  useEffect(() => {
    try {
      const savedLanguage = window.localStorage.getItem('sg-partner-language');
      const savedTheme = window.localStorage.getItem('sg-partner-theme');
      if (['sv', 'en'].includes(savedLanguage)) setLanguage(savedLanguage);
      if (['light', 'dark'].includes(savedTheme)) setTheme(savedTheme);
    } catch { /* Restricted browser storage must not block the portal. */ }
  }, []);
  const change = (key, setter, value, values) => {
    if (!values.includes(value)) return;
    setter(value);
    try { window.localStorage.setItem(key, value); } catch { /* UI preference remains usable in memory. */ }
  };
  return { language, theme, copy: partnerCopy(language),
    setLanguage: value => change('sg-partner-language', setLanguage, value, ['sv', 'en']),
    setTheme: value => change('sg-partner-theme', setTheme, value, ['light', 'dark']) };
}
