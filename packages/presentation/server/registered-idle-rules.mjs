import { isActiveDealerId, registeredDealerIds } from '../contracts/dealer-identity.mjs';
import { buildRuntimeCatalog } from '../contracts/studio-model.mjs';
import { selectionFor } from '../contracts/video-intake.mjs';
import { registeredIdleInventory, registeredIdlePolicy } from '../runtime/registered-idle-policy.mjs';

// The application supplies its shared Director evaluator; this package never imports it.
export function createRegisteredIdleRuleSelector({ prepareDecision }) {
/**
 * Select a saved own-dealer idle reaction to an already verified game event.
 * The API must supply its receipt-backed sourceEvent, then bind the result to
 * that request's mode/version/presentation context. This helper never accepts
 * client examples as proof and never supplies simulated chat/history values.
 */
function selectRegisteredIdleRule({ project, dealerId, sourceEvent, mode } = {}, { inventory } = {}) {
  if (mode !== 'rules' || !['deal', 'reveal', 'turn', 'settle'].includes(sourceEvent?.type)
    || !isActiveDealerId(dealerId) || !registeredDealerIds(project).has(dealerId)) return null;
  const policy = registeredIdlePolicy(project, dealerId) ?? (dealerId === 'astrid' ? project.idlePolicy : null);
  if (!policy?.variants.some(item => item.use === 'rules')) return null;
  const catalog = buildRuntimeCatalog(project, dealerId);
  const line = project.lines.find(item => item.dealerId === dealerId && item.eventId === 'idle.ready');
  const baseline = line.variants.find(item => item.id === line.baselineVariantId);
  if (baseline.videoGenerationId !== policy.base[0].videoId) return null;
  const idleInventory = registeredIdleInventory(inventory, { dealerId, policy });
  if (!idleInventory.videos.some(item => item.id === baseline.videoGenerationId && item.role === 'standard')) return null;
  const allowed = new Set(idleInventory.videos.filter(item => item.role === 'variant').map(item => item.id));
  const ruleVideos = new Set(policy.variants.filter(item => item.use === 'rules').map(item => item.videoId));
  const definitions = new Map(line.variants.map(item => [item.id, item]));
  const idleNode = catalog.events.find(item => item.id === 'idle.ready');
  const candidates = idleNode.variants.filter(item => {
    const saved = definitions.get(item.id);
    return item.id !== line.baselineVariantId && saved.triggerIds.length > 0 && selectionFor(saved).rules
      && ruleVideos.has(saved.videoGenerationId) && allowed.has(saved.videoGenerationId)
      && item.when.all.every(predicate => predicate.path.startsWith('event.'));
  });
  if (!candidates.length) return null;

  // Keep the shared source projection, hidden-card redaction and predicate
  // evaluator. Transplant only this idle rule pool into the matched source node;
  // all locked game mappings stay intact and no original catalog is mutated.
  const input = { event: sourceEvent, mode: 'off' };
  const observed = prepareDecision(catalog, input);
  const node = catalog.events.find(item => item.id === observed.node.id);
  if (!node) return null;
  const pool = [idleNode.variants.find(item => item.id === line.baselineVariantId), ...candidates]
    .sort((a, b) => a.id.localeCompare(b.id));
  const aliases = new Map();
  node.variants = pool.map((item, index) => {
    const id = 'idle-rule:' + String(index).padStart(2, '0');
    aliases.set(id, definitions.get(item.id));
    if (item.id === line.baselineVariantId) node.baselineVariantId = id;
    return { ...item, id };
  });
  const selected = aliases.get(prepareDecision(catalog, input).eligible[0]?.id);
  if (!selected || selected.id === line.baselineVariantId) return null;
  return { videoId: selected.videoGenerationId, variantId: selected.id, reason: 'deterministic_rules' };
}

return selectRegisteredIdleRule;
}
