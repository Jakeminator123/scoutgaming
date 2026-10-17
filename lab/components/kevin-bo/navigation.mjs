// A menu is presentation, never an access grant. Both surfaces currently
// require the server's existing internal administrator session.
import { WORKSPACE_VIEW_SLUGS } from '../../../packages/navigation/workspace-surfaces.mjs';

export const STUDIO_GROUP = 'Produktion';

export const DESTINATIONS = Object.freeze([
  { id: 'ops', label: 'Livebord', group: 'Översikt', owner: 'shared' },
  { id: 'pit', label: 'Pitbossar', group: 'Översikt', owner: 'shared' },
  { id: 'players', label: 'Spelare', group: 'Spelare', owner: 'partner' },
  { id: 'tx', label: 'Transaktioner', group: 'Spelare', owner: 'partner' },
  { id: 'theme', label: 'Färger, marker och kort', group: 'Presentation', owner: 'partner' },
  { id: 'design', label: 'Bord', group: 'Presentation', owner: 'partner' },
  { id: 'background', label: 'Bakgrund', group: 'Presentation', owner: 'shared' },
  { id: 'dealers', label: 'Presentationslanes', group: 'Presentation', owner: 'shared' },
  { id: 'bj', label: 'Blackjack', group: 'Spel', owner: 'partner' },
  { id: 'roulette', label: 'Roulette', group: 'Spel', owner: 'planned' },
  { id: 'baccarat', label: 'Baccarat', group: 'Spel', owner: 'planned' },
  { id: 'shoes', label: 'Skor och kortlekar', group: 'Spel', owner: 'shared' },
  { id: 'test', label: 'Provbord', group: 'Spel', owner: 'shared' },
  { id: 'stats', label: 'Statistik', group: 'Rapporter', owner: 'partner' },
  { id: 'reports', label: 'Rapporter', group: 'Rapporter', owner: 'partner' },
  { id: 'team', label: 'Medlemskap', group: 'Team & åtkomst', owner: 'shared' },
  { id: 'api', label: 'Integrationer', group: 'Team & åtkomst', owner: 'shared' },
  { id: 'archive', label: 'Dealerarkiv', group: 'Internt bibliotek', owner: 'internal' },
  { id: 'tables', label: 'Rum (äldre)', group: 'Internt bibliotek', owner: 'internal' },
  { id: 'voice', label: 'Röstklipp', group: STUDIO_GROUP, owner: 'internal' },
  { id: 'clips', label: 'Deal-klipp', group: STUDIO_GROUP, owner: 'internal' },
  { id: 'media', label: 'Spelmedia', group: STUDIO_GROUP, owner: 'internal' },
  { id: 'tree', label: 'Presentationshändelser', group: STUDIO_GROUP, owner: 'internal', originalLabel: 'Action tree' },
  { id: 'gen', label: 'Genereringar', group: STUDIO_GROUP, owner: 'internal' },
]);

export function destinationsFor(surface) {
  if (surface !== 'partner' && surface !== 'internal') return [];
  return DESTINATIONS.filter(item => surface === 'internal' || item.owner !== 'internal');
}

export function normalizeView(value, surface) {
  const aliases = { overview: 'ops', presentation: 'theme', integration: 'api', transactions: 'tx', operations: 'ops', events: 'tree', users: 'team', apikeys: 'api', voicelines: 'voice', generations: 'gen' };
  const raw = typeof value === 'string' ? value.split('?')[0].replace(/^#/, '') : '';
  const view = surface === 'partner' && ['rooms', 'tables'].includes(raw) ? 'bj' : aliases[raw]
    || Object.keys(WORKSPACE_VIEW_SLUGS).find(id => WORKSPACE_VIEW_SLUGS[id] === raw) || raw;
  return destinationsFor(surface).some(item => item.id === view) ? view : null;
}

export const INTERNAL_LINKS = Object.freeze({
  ops: ['/openclaw', 'Drift och jobb'],
  pit: ['/administration', 'Intern administration'],
  dealers: ['/', 'Dealerproduktion'],
  background: ['/', 'Presentationsprofiler'],
  team: ['/administration', 'Personal och åtkomst'],
  api: ['/administration', 'Interna integrationer'],
  archive: ['/videos', 'Dealerbibliotek'],
  tables: ['/administration', 'Bord och administration'],
  voice: ['/', 'Presentationsprofiler och media'],
  clips: ['/', 'Klipp och presentationsprofiler'],
  media: ['/videos', 'Media och presentationsprofiler'],
  tree: ['/tree', 'Presentationshändelser'],
  gen: ['/probe', 'Produktionsjobb'],
  test: ['/', 'Befintlig repetition'],
});
