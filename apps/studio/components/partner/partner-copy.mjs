import { useEffect, useState } from 'react';
import { partnerNavigationItems } from '../../../../packages/navigation/partner-navigation.mjs';
import { PARTNER_VIEW_PERMISSIONS } from '../../../../packages/studio-access/server/partner-access-policy.mjs';
import { applyThemeMode, defaultThemeMode, readThemeMode, themeModes } from '../../lib/theme-mode.mjs';
// Rollens ord bor i en ren modul (ingen React) så att servern kan läsa dem.
export { PARTNER_ROLE_WORDS, partnerRoleWord } from '../../lib/partner-words.mjs';

// Orden följer apps/studio/docs/TERMINOLOGI.md: Partnerportalen, bolag, spelbord,
// bordsgrafik, miljö, tilldelning, version, utkast/publicerad,
// administratör/redaktör/läsare. Menyvalens namn kommer ur packages/navigation/partner-navigation.mjs.
const viewLabels = language => Object.fromEntries(partnerNavigationItems.map(item => [item.id, item.label[language]]));
const COPY = Object.freeze({
  sv: {
    portal: 'Partnerportalen', level: 'Partnerportalen', partners: 'Bolag', company: 'Bolag',
    admin: 'Scoutgamings personal', member: 'Bolagets team',
    switchAccount: 'Byt konto', logOut: 'Logga ut', loggingOut: 'Loggar ut…',
    logoutError: 'Utloggningen kunde inte bekräftas. Du är kvar på sidan. Försök igen.',
    directoryIntroAdmin: 'Öppna ett bolag med samma konto. Åtkomsten kontrolleras för varje bolag.',
    directoryIntroMember: 'Här finns de bolag ditt konto har åtkomst till.',
    open: 'Öppna portalen', noPartners: 'Inga tillgängliga bolag',
    search: 'Sök bolag', noMatches: 'Inga bolag matchar', noMatchesBody: 'Prova ett annat namn eller rensa sökningen.',
    noPartnersBody: 'Ditt konto har ingen aktiv bolagskoppling. Be Scoutgaming kontrollera åtkomsten.',
    sameLogin: 'Samma konto', control: 'Admin', player: 'Spelarlobby',
    directoryNote: 'Listan hämtas från registrerade bolag. Inga exempeldata visas här.',
    theme: 'Tema', light: 'Ljust', dark: 'Mörkt', language: 'Språk', menu: 'Meny',
    ...viewLabels('sv'),
    assignmentFrom: 'Tilldelning från Scoutgaming', revision: 'Version', packageMissing: 'Ingen publicerad tilldelning',
    dealer: 'dealer', dealers: 'dealers', table: 'bordsgrafik', tables: 'bordsgrafik', background: 'bakgrund', backgrounds: 'bakgrunder', switchCompany: 'Byt bolag',
    find: 'Sök', findHint: 'Sök sidor och spelbord', findEmpty: 'Inget matchar.', pages: 'Sidor', settings: 'Inställningar', companyDefault: 'Bolagets standard',
    notConnected: 'Inte anslutet',
    deniedTitle: 'Den här sidan kräver en behörighet som rollen saknar',
    deniedBody: 'Rollen {role} får inte {permission}. Be bolagets administratör eller Scoutgaming om åtkomst.',
    toOverview: 'Till översikten',
    unsavedLeave: 'Du har osparade ändringar i spelbordets utseende. Lämna sidan och kasta dessa ändringar?',
    draftKept: 'Osparade ändringar finns kvar under Spelbord.',
  },
  en: {
    portal: 'Partner portal', level: 'Partner portal', partners: 'Companies', company: 'Company',
    admin: 'Scoutgaming staff', member: 'Company team',
    switchAccount: 'Switch account', logOut: 'Log out', loggingOut: 'Signing out…',
    logoutError: 'Sign-out could not be confirmed. You are still on this page. Please try again.',
    directoryIntroAdmin: 'Open a company with the same account. Access is checked separately for each company.',
    directoryIntroMember: 'These are the companies your account can access.',
    open: 'Open the portal', noPartners: 'No companies available',
    search: 'Search companies', noMatches: 'No matching companies', noMatchesBody: 'Try another name or clear the search.',
    noPartnersBody: 'Your account has no active company membership. Ask Scoutgaming to check your access.',
    sameLogin: 'Same account', control: 'Admin', player: 'Player lobby',
    directoryNote: 'This list comes from registered companies. No sample data is shown here.',
    theme: 'Theme', light: 'Light', dark: 'Dark', language: 'Language', menu: 'Menu',
    ...viewLabels('en'),
    assignmentFrom: 'Assignment from Scoutgaming', revision: 'Version', packageMissing: 'No published assignment',
    dealer: 'dealer', dealers: 'dealers', table: 'table graphic', tables: 'table graphics', background: 'background', backgrounds: 'backgrounds', switchCompany: 'Switch company',
    find: 'Search', findHint: 'Search pages and tables', findEmpty: 'Nothing matches.', pages: 'Pages', settings: 'Settings', companyDefault: 'Company default',
    notConnected: 'Not connected',
    deniedTitle: 'This page needs a permission your role does not have',
    deniedBody: 'The role {role} may not {permission}. Ask the company administrator or Scoutgaming for access.',
    toOverview: 'To the overview',
    unsavedLeave: 'You have unsaved changes to the table appearance. Leave this page and discard those changes?',
    draftKept: 'Unsaved changes are kept under Tables.',
  },
});

export function partnerCopy(language = 'sv') { return COPY[language === 'en' ? 'en' : 'sv']; }

// Menyn är presentation: menyvalen ur packages/navigation/partner-navigation.mjs, filtrerade på
// samma karta som servern använder för att neka en vy (PARTNER_VIEW_PERMISSIONS). Skalet och
// Hjälp läser båda härifrån.
export function partnerNavigation(language, permissions = []) {
  const lang = language === 'en' ? 'en' : 'sv', allowed = new Set(permissions);
  return partnerNavigationItems.filter(item => allowed.has(PARTNER_VIEW_PERMISSIONS[item.id]))
    .map(item => ({ id: item.id, label: item.label[lang], description: item.description[lang], icon: item.icon }));
}

// Presentation preferences only; business data and drafts remain server-owned.
// Temat är samma val som i Admin (lib/theme-mode.mjs): klassen på <html>, satt före första
// målningen, så servern renderar standardläget och effekten läser det faktiska valet.
export function usePartnerPreferences() {
  const [language, setLanguage] = useState('sv'), [theme, setTheme] = useState(defaultThemeMode);
  useEffect(() => {
    setTheme(readThemeMode());
    try {
      const savedLanguage = window.localStorage.getItem('sg-partner-language');
      if (['sv', 'en'].includes(savedLanguage)) setLanguage(savedLanguage);
    } catch { /* Restricted browser storage must not block the portal. */ }
  }, []);
  const change = (key, setter, value, values) => {
    if (!values.includes(value)) return;
    setter(value);
    try { window.localStorage.setItem(key, value); } catch { /* UI preference remains usable in memory. */ }
  };
  return { language, theme, copy: partnerCopy(language),
    setLanguage: value => change('sg-partner-language', setLanguage, value, ['sv', 'en']),
    setTheme: value => { if (themeModes.includes(value)) setTheme(applyThemeMode(value)); } };
}
