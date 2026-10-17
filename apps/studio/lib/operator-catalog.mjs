import { createHash } from 'node:crypto';
import { buildRuntimeCatalog, validateProject } from '../../../packages/presentation/contracts/studio-model.mjs';
import { dealFrequencyPolicies, mediaExampleEvent, mediaFamilyFolder, mediaLineForEvent, mediaVariantPolicy, usesMediaFamilies } from '../../../packages/presentation/runtime/media-family-policy.mjs';
import { selectionFor } from '../../../packages/presentation/contracts/video-intake.mjs';

const label = text => text.slice(0, 120);
const fileLabel = (name, use) => {
  const limit = Math.max(1, 120 - use.length - 3);
  const fileName = name.length > limit ? `${name.slice(0, Math.max(0, limit - 1))}…` : name;
  return label(`${fileName} · ${use}`);
};
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const selectionLabel = selection => [selection.rules && 'regler', selection.model && 'OpenClaw', selection.random && 'slump'].filter(Boolean).join('+') || 'manuell';

// Read-only operator inventory, NOT an executable replacement for the Director
// catalog. It uses the existing strict catalog wire format so older deployed
// relays see the real files too. No filesystem paths, URLs or unprojected state
// cross the boundary. Selection flags are descriptive labels, not permissions.
export function buildOperatorCatalog(project, inventory, dealerId, { scope = 'saved' } = {}) {
  validateProject(project);
  const catalog = buildRuntimeCatalog(project, dealerId);
  const managed = usesMediaFamilies(inventory, dealerId);
  const triggers = new Map(project.triggers.map(trigger => [trigger.id, trigger]));
  const predicates = ids => ids.map(id => {
    const { path, op, value } = triggers.get(id);
    return { path, op, value };
  });
  const files = new Map((inventory?.videos ?? []).map(video => [video.id, video]));
  catalog.sourceNote = `Operatörens läsande katalogvy: ${scope === 'draft' ? 'osparat utkast' : 'senast sparat projekt'} och aktuellt videomanifest. Inte en spelobservation eller ett variantbeslut. Etiketter visar tillåtna urval, inte att ett klipp är visuellt godkänt eller uppspelat. Box 0–6 motsvarar plats 1–7. Idlepolicy är separat från eventens variantval.`;
  catalog.events = catalog.events.flatMap(node => {
    const saved = project.lines.find(line => line.dealerId === dealerId && line.eventId === node.id);
    if (!managed) return [{ ...node, variants: node.variants.map(variant => {
      const source = saved.variants.find(item => item.id === variant.id);
      return { ...variant, label: label(`${variant.label} · ${source.videoGenerationId ? 'videokoppling' : '2D-prov'} · ${variant.id === node.baselineVariantId ? 'standard' : selectionLabel(selectionFor(source))}`) };
    }) }];
    const families = (inventory.families ?? []).filter(family => family.dealerId === dealerId && family.eventId === node.id);
    if (!families.length) {
      const baseline = node.variants.find(variant => variant.id === node.baselineVariantId);
      return [{ ...node, label: label(`${node.label} · ingen manifestfamilj`), variants: [{ ...baseline, label: 'Ingen exakt video · 2D-reserv' }] }];
    }
    return families.map(family => {
      const event = mediaExampleEvent(node, family.situation);
      // The locked dealer example is face-down. A catalogue-only upcard example
      // needs a valid synthetic visible card; reuse the locked public example,
      // never any player state. Operator prompts do not receive example cards.
      if (event.type === 'deal' && event.faceDown === false && !event.card) {
        event.card = { ...project.events.find(item => item.sourceType === 'deal' && item.exampleEvent.card)?.exampleEvent.card };
      }
      const media = mediaLineForEvent(project, inventory, dealerId, node.id, event);
      const prefix = `operator.${dealerId}.${hash(family.id).slice(0, 16)}`;
      const baselineId = `${prefix}.standard`;
      const baseline = media.line.variants.find(variant => variant.id === media.line.baselineVariantId);
      const idle = family.playbackType === 'idle-pool';
      const frequency = dealFrequencyPolicies(project, family);
      const member = (id, role) => {
        const video = files.get(id);
        return video?.familyId === family.id && video.role === role ? video : null;
      };
      const primary = member(baseline.videoGenerationId, 'standard');
      const idleBaseLabel = id => {
        const base = project.idlePolicy?.base.find(item => item.videoId === id);
        return base ? `grundloop ${base.weight} % grundvikt` : 'ej vald grundloop';
      };
      const variants = [{ id: baselineId, label: primary ? fileLabel(primary.fileName, idle ? idleBaseLabel(primary.id) : 'standard') : 'Ingen tillgänglig standardvideo · 2D-reserv',
        priority: baseline.priority, assetId: baseline.assetId, when: { all: [] } }];
      // Every real base/variant remains visible, including unavailable files.
      // Presence alone never enables rules, model selection or random playback.
      const ids = [...(idle ? family.standardIds.filter(id => id !== primary?.id) : []), ...family.variantIds];
      for (const id of ids) {
        const isBase = family.standardIds.includes(id);
        const video = member(id, isBase ? 'standard' : 'variant');
        if (!video) continue;
        const policy = mediaVariantPolicy(project, family, id);
        let use = frequency ? `${policy.frequencyPercent ?? 0} % per utdelning; lokalt frekvensval` : selectionLabel(policy.selection);
        if (idle) {
          const idleVariant = project.idlePolicy?.variants.find(item => item.videoId === id);
          const automatic = idleVariant?.automatic;
          use = isBase ? idleBaseLabel(id) : idleVariant?.use === 'automatic' && automatic
            ? `automatisk ${automatic.averageEveryMs / 1000}±${automatic.jitterMs / 1000} s; paus ${automatic.cooldownMs / 1000} s; max ${automatic.maxPerMinute}/min`
            : ({ openclaw: 'OpenClaw (idlepolicy)', rules: 'regler (idlepolicy)', manual: 'manuell' }[idleVariant?.use] ?? 'ej vald i idlepolicy');
        }
        variants.push({ id: `${prefix}.file-${id}`, label: fileLabel(video.fileName, video.available ? use : 'otillgänglig; ' + use),
          priority: idle || frequency ? 0 : policy.priority, assetId: baseline.assetId, when: { all: idle || frequency ? [] : predicates(policy.triggerIds) } });
      }
      const match = { ...node.match };
      if (node.sourceType === 'speak') match.line = family.situation;
      else if (/^box[0-6]$/.test(family.situation)) match.box = Number(family.situation.slice(3));
      else if (node.sourceType === 'deal' && (family.situation === 'dealer-up' || family.situation === 'dealer-hole')) match.faceDown = family.situation === 'dealer-hole';
      return { ...node, id: prefix, label: label(`${family.id} · ${mediaFamilyFolder(family) ?? family.situation}`),
        description: `Inventering för ${node.id}, exakt situation ${family.situation}. ${idle ? 'Grundloopar och engångsvarianter styrs separat av idlepolicyn.' : 'Standard används när inga tillåtna och matchande filvarianter finns.'} Detta är inte bevis på uppspelning eller visuell granskning.`,
        exampleEvent: event, match, baselineVariantId: baselineId, variants };
    });
  });
  const usedAssets = new Set(catalog.events.flatMap(node => node.variants.map(variant => variant.assetId)));
  catalog.assets = catalog.assets.filter(asset => usedAssets.has(asset.id));
  catalog.revision = `operator-${scope === 'draft' ? 'draft' : 'saved'}-${hash(catalog)}`;
  return catalog;
}
