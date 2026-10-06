// A menu is presentation, never an authorization policy. Both surfaces currently
// require the server's existing internal administrator session.
import { WORKSPACE_VIEW_SLUGS } from '../../lib/workspace-surfaces.mjs';
export const DESTINATIONS = Object.freeze([
  { id: 'ops', label: 'Casino live', group: 'Operations', owner: 'shared' },
  { id: 'players', label: 'Players', group: 'Operations', owner: 'partner' },
  { id: 'tx', label: 'Transactions', group: 'Operations', owner: 'partner' },
  { id: 'pit', label: 'Pit bosses', group: 'Operations', owner: 'shared' },
  { id: 'theme', label: 'Colours, chips & cards', group: 'Branding', owner: 'partner' },
  { id: 'design', label: 'Table', group: 'Branding', owner: 'partner' },
  { id: 'background', label: 'Casino background', group: 'Branding', owner: 'shared' },
  { id: 'bj', label: 'Blackjack', group: 'Games', owner: 'partner' },
  { id: 'roulette', label: 'Roulette', group: 'Games', owner: 'planned' },
  { id: 'baccarat', label: 'Baccarat', group: 'Games', owner: 'planned' },
  { id: 'dealers', label: 'Dealers', group: 'Games', owner: 'shared' },
  { id: 'shoes', label: 'Shoes & decks', group: 'Games', owner: 'shared' },
  { id: 'test', label: 'Test a table', group: 'Test', owner: 'shared' },
  { id: 'stats', label: 'Statistics', group: 'Insights', owner: 'partner' },
  { id: 'reports', label: 'Reports', group: 'Insights', owner: 'partner' },
  { id: 'team', label: 'Team & access', group: 'Settings', owner: 'shared' },
  { id: 'api', label: 'API keys', group: 'Settings', owner: 'shared' },
  { id: 'archive', label: 'Dealer archive', group: 'Internal library', owner: 'internal' },
  { id: 'tables', label: 'Rooms (legacy)', group: 'Internal library', owner: 'internal' },
  { id: 'voice', label: 'Voice lines', group: 'Studio', owner: 'internal' },
  { id: 'clips', label: 'Dealing clips', group: 'Studio', owner: 'internal' },
  { id: 'media', label: 'Game media', group: 'Studio', owner: 'internal' },
  { id: 'tree', label: 'Presentation events', group: 'Studio', owner: 'internal', originalLabel: 'Action tree' },
  { id: 'gen', label: 'Generations', group: 'Studio', owner: 'internal' },
]);

export function destinationsFor(surface) {
  if (surface !== 'partner' && surface !== 'internal') return [];
  return DESTINATIONS.filter(item => surface === 'internal' || item.owner !== 'internal');
}

export function normalizeView(value, surface) {
  const aliases = { overview: 'ops', presentation: 'theme', integration: 'api', transactions: 'tx', operations: 'ops', events: 'tree', users: 'team', apikeys: 'api', voicelines: 'voice', generations: 'gen' };
  const raw = typeof value === 'string' ? value.split('?')[0].replace(/^#/, '') : '';
  const view = surface === 'partner' && raw === 'tables' ? 'bj' : aliases[raw]
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
