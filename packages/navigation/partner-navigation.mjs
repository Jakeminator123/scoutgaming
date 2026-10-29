// Partnerportalens meny, delad av skalet och Hjälp (samma stil som admin-navigation.mjs). id är
// adressledet i PARTNER_VIEWS (workspace-surfaces.mjs). Behörigheten per menyval läses ur
// PARTNER_VIEW_PERMISSIONS (packages/studio-access/server/partner-access-policy.mjs), så att menyn
// och servern aldrig har två kartor. Dealers har ingen egen sida: dealern väljs under
// Spelbord › Dealer. Spelare visas med ett ärligt tomläge tills spelare kopplats till bolaget.
// Orden följer apps/studio/docs/TERMINOLOGI.md.
import { adminRoomTabs } from './admin-navigation.mjs';

const item = (id, icon, sv, en, descriptionSv, descriptionEn) => Object.freeze({ id, icon,
  label: Object.freeze({ sv, en }), description: Object.freeze({ sv: descriptionSv, en: descriptionEn }) });

export const partnerNavigationItems = Object.freeze([
  item('overview', 'layout-dashboard', 'Översikt', 'Overview',
    'Var ni är publicerade, siffror ur spelen och det som väntar.', 'Where you are published, figures from the games and what is waiting.'),
  item('rooms', 'spade', 'Spelbord', 'Tables',
    'Era spelbord: utseende och dealer inom tilldelningen, utkast och publicering.', 'Your tables: appearance and dealer within the assignment, drafts and publishing.'),
  item('players', 'users', 'Spelare', 'Players',
    'Era spelare med konto, saldo och status, när spelare kopplats till er.', 'Your players with account, balance and status, once players are linked to you.'),
  item('reports', 'chart-column', 'Ekonomi', 'Finance',
    'Rundor, insatser, utbetalt och netto per spelbord, en valuta i taget.', 'Rounds, stakes, paid out and net per table, one currency at a time.'),
  item('team', 'users-round', 'Team', 'Team',
    'Bolagets team och roller; administratören bjuder in och ändrar roller.', 'The company team and roles; the administrator invites and changes roles.'),
  item('integration', 'plug', 'Integration', 'Integration',
    'Startadressen och bolagets egna nycklar, maskerade.', 'The launch address and the company’s own keys, masked.'),
  item('help', 'life-buoy', 'Hjälp och kontakt', 'Help and contact',
    'Vad rollen får göra, orden och hur ni begär material.', 'What the role may do, the words and how to request material.'),
]);

// Spelbordets flikar: samma id:n som Admins rumsflikar, så att Admins förhandsvisning kan landa på
// rätt flik. Bolagets val är Admins vy över bolagets val och finns inte i portalen.
export const partnerRoomTabs = Object.freeze(adminRoomTabs.filter(tab => tab.id !== 'bolagets-val').map(tab => Object.freeze({ ...tab })));
