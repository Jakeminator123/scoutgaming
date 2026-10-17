import { assertPartnerPreviewResourceAccess, PARTNER_PREVIEW_OPERATORS } from './partner-preview-policy.mjs';

// In-memory demonstration content only. This module has no repository, SQL,
// filesystem, provider or fetch dependency and cannot fall back to global data.
const fixtureFor = operator => {
  const north = operator.slug === 'demo-north';
  const owned = value => ({ ...value, operatorId: operator.id, preview: true });
  const presentations = [owned({ id: `${operator.id}-presentation-1`, name: north ? 'Nordic blue' : 'Amber evening',
    dealer: 'Demo dealer', language: 'sv-SE', background: north ? 'Blue studio' : 'Amber studio', status: 'demo' })];
  return {
    brands: [owned({ id: 'scout', name: operator.name, code: north ? 'DN' : 'DS' })],
    tables: Array.from({ length: north ? 2 : 1 }, (_, index) => owned({ id: `${operator.id}-table-${index + 1}`,
      name: `${operator.name} ${index + 1}`, game: 'blackjack', status: 'demo', playerCount: 0,
      presentationId: presentations[0].id })),
    team: [owned({ id: `${operator.id}-team-admin`, name: `${operator.name} Admin`, email: `admin@${operator.slug}.invalid`,
      role: 'partner-admin', status: 'demo' }), owned({ id: `${operator.id}-team-editor`, name: `${operator.name} Editor`,
      email: `editor@${operator.slug}.invalid`, role: 'partner-editor', status: 'demo' })],
    presentations, players: [], transactions: [], reports: [],
  };
};

export function readPartnerPreviewFixture(context, { now = Date.now } = {}) {
  const operator = PARTNER_PREVIEW_OPERATORS.find(item => item.id === context?.operatorId);
  assertPartnerPreviewResourceAccess(context, { action: 'preview.read', resource: { preview: true, operatorId: operator?.id } });
  const fixture = fixtureFor(operator);
  for (const resources of Object.values(fixture)) {
    for (const resource of resources) assertPartnerPreviewResourceAccess(context, { action: 'preview.read', resource });
  }
  return { schemaVersion: 1, preview: true, mode: 'fixture', accessClass: 'internal',
    viewer: { user: context.actor, accessClass: context.accessClass },
    source: { repository: 'GitLab Croupier', commit: '7dee0901c75b7470c16a178079d5a5ebe4f11b9f' },
    generatedAt: new Date(now()).toISOString(), operator: { ...operator },
    operators: PARTNER_PREVIEW_OPERATORS.map(item => ({ ...item })), ...fixture,
    integration: { status: 'not-connected' },
    summary: { activeTables: 0, playersToday: 0, roundsToday: 0, currency: 'SEK' },
    unavailableSections: ['players', 'transactions', 'reports', 'integration'],
  };
}
