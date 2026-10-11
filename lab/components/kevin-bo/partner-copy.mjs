import { useEffect, useState } from 'react';

const COPY = Object.freeze({
  sv: {
    portal: 'Partnerportal', level: 'Nivå 2 · Spelbolag', partners: 'Partners', company: 'Spelbolag',
    admin: 'Intern administratör', member: 'Operatörspersonal', signedIn: 'Inloggad som',
    directoryIntroAdmin: 'Öppna ett riktigt spelbolag med samma administratörskonto. Åtkomsten kontrolleras för varje bolag.',
    directoryIntroMember: 'Här finns de spelbolag ditt konto har åtkomst till.',
    open: 'Öppna arbetsyta', directory: 'Alla partners', noPartners: 'Inga tillgängliga spelbolag',
    search: 'Sök spelbolag', noMatches: 'Inga spelbolag matchar', noMatchesBody: 'Prova ett annat namn eller rensa sökningen.',
    noPartnersBody: 'Ditt konto har ingen aktiv bolagskoppling. Be en intern administratör kontrollera åtkomsten.',
    sameLogin: 'Samma konto', control: 'Nivå 1 · Kontrollpanel', player: 'Nivå 3 · Spelaryta',
    directoryNote: 'Listan hämtas från registrerade bolag. Inga demonstrationer eller exempeldata visas här.',
    theme: 'Tema', light: 'Ljust', dark: 'Mörkt', language: 'Språk', menu: 'Sida', overview: 'Översikt',
    games: 'Spel', playersGroup: 'Spelare', finance: 'Ekonomi', settings: 'Inställningar',
    tables: 'Bord', presentation: 'Utseende', design: 'Bordets utseende', background: 'Bakgrund',
    dealers: 'Dealers & paket', test: 'Provbord', players: 'Spelare', tx: 'Transaktioner', reports: 'Rapporter',
    team: 'Team & behörigheter', api: 'Integration', package: 'Publicerat paket', revision: 'Paketversion',
    overviewIntro: 'Ditt publicerade innehåll och dina tilldelade bord. Aktuella spelresultat visas först när spelkopplingen är ansluten.',
    tablesIntro: 'Bord som tillhör detta spelbolag. Status avser bordets konfiguration, inte en pågående spelrunda.',
    packageMissing: 'Inget publicerat paket', packageMissingBody: 'Intern personal behöver publicera bolagets paket innan innehållet blir tillgängligt.',
    profiles: 'Presentationsprofiler', tableCount: 'Tilldelade bord', configured: 'Konfigurerat', draft: 'Utkast',
    noTables: 'Inga tilldelade bord ännu', noTablesBody: 'Bord som kopplas till spelbolaget visas här.',
    game: 'Spel', status: 'Konfigurationsstatus', profile: 'Presentation',
    notConnected: 'Inte anslutet', unavailable: 'Spelkoppling återstår',
    unavailableBody: 'Spelare, transaktioner och ekonomiska rapporter är ännu inte anslutna till partnerportalen. Inga exempelvärden visas.',
    apiBody: 'Nyckelhantering och plånboksanslutning finns ännu inte i partnerportalen. Kontakta intern personal för integrationen.',
    readOnlyScope: 'Endast detta spelbolags publicerade innehåll och tilldelade resurser visas.',
  },
  en: {
    portal: 'Partner portal', level: 'Level 2 · Operators', partners: 'Partners', company: 'Operator',
    admin: 'Internal administrator', member: 'Operator staff', signedIn: 'Signed in as',
    directoryIntroAdmin: 'Open a real operator with the same administrator account. Access is checked separately for each operator.',
    directoryIntroMember: 'These are the operators your account can access.',
    open: 'Open workspace', directory: 'All partners', noPartners: 'No operators available',
    search: 'Search operators', noMatches: 'No matching operators', noMatchesBody: 'Try another name or clear the search.',
    noPartnersBody: 'Your account has no active operator membership. Ask an internal administrator to check your access.',
    sameLogin: 'Same account', control: 'Level 1 · Control panel', player: 'Level 3 · Player area',
    directoryNote: 'This list comes from registered operators. No demonstrations or sample data are shown here.',
    theme: 'Theme', light: 'Light', dark: 'Dark', language: 'Language', menu: 'Page', overview: 'Overview',
    games: 'Games', playersGroup: 'Players', finance: 'Finance', settings: 'Settings',
    tables: 'Tables', presentation: 'Appearance', design: 'Table appearance', background: 'Background',
    dealers: 'Dealers & package', test: 'Trial table', players: 'Players', tx: 'Transactions', reports: 'Reports',
    team: 'Team & permissions', api: 'Integration', package: 'Published package', revision: 'Package version',
    overviewIntro: 'Your published content and assigned tables. Live game results become available when the game connection is integrated.',
    tablesIntro: 'Tables belonging to this operator. Status describes table configuration, not a live game round.',
    packageMissing: 'No published package', packageMissingBody: 'Internal staff need to publish this operator’s package before its content is available.',
    profiles: 'Presentation profiles', tableCount: 'Assigned tables', configured: 'Configured', draft: 'Draft',
    noTables: 'No tables assigned yet', noTablesBody: 'Tables assigned to this operator will appear here.',
    game: 'Game', status: 'Configuration status', profile: 'Presentation',
    notConnected: 'Not connected', unavailable: 'Game connection pending',
    unavailableBody: 'Players, transactions and financial reports are not yet connected to the partner portal. No sample figures are shown.',
    apiBody: 'Key management and wallet connections are not yet available in the partner portal. Contact internal staff for the integration.',
    readOnlyScope: 'Only this operator’s published content and assigned resources are shown.',
  },
});

export function partnerCopy(language = 'sv') { return COPY[language === 'en' ? 'en' : 'sv']; }

const NAVIGATION = Object.freeze([
  ['ops', 'overview', 'overview'], ['bj', 'tables', 'games'], ['test', 'test', 'games'],
  ['players', 'players', 'playersGroup'], ['tx', 'tx', 'finance'], ['reports', 'reports', 'finance'],
  ['theme', 'presentation', 'settings'], ['design', 'design', 'settings'], ['background', 'background', 'settings'],
  ['dealers', 'dealers', 'settings'], ['team', 'team', 'settings'], ['api', 'api', 'settings'],
]);

export function partnerNavigation(language, permissions = []) {
  const copy = partnerCopy(language), allowed = new Set(permissions);
  return NAVIGATION.filter(([id]) => id !== 'team' || allowed.has('team.read'))
    .map(([id, label, group]) => ({ id, label: copy[label], group: copy[group] }));
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
