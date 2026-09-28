import { createHash } from 'node:crypto';
import retired from '../policies/retired-demo-fingerprints.json' with { type: 'json' };

const fingerprint = value => createHash('sha256').update(JSON.stringify(value, function (key, value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.keys(value).sort().map(k => [k, value[k]])) : value;
})).digest('hex');
const unchanged = (kind, row) => Boolean(row && retired[kind][row.id] === fingerprint(row));

// Remove only byte-equivalent old examples. Operator edits and their dependencies
// survive. The launcher saves the result with the normal revision/history lock.
export function retireDemoExamples(project) {
  const draft = structuredClone(project);
  for (const line of draft.lines) line.variants = line.variants.filter(row => row.id === line.baselineVariantId
    || !unchanged('variants', row)
    || !unchanged('assets', draft.assets.find(asset => asset.id === row.assetId))
    || row.triggerIds.some(id => !unchanged('triggers', draft.triggers.find(trigger => trigger.id === id))));
  const usedAssets = new Set(draft.lines.flatMap(line => line.variants.map(row => row.assetId)));
  const usedTriggers = new Set([...draft.lines.flatMap(line => line.variants.flatMap(row => row.triggerIds)),
    ...(draft.mediaPolicy ?? []).flatMap(family => family.variants.flatMap(row => row.triggerIds))]);
  draft.assets = draft.assets.filter(row => usedAssets.has(row.id) || !unchanged('assets', row));
  draft.triggers = draft.triggers.filter(row => usedTriggers.has(row.id) || !unchanged('triggers', row));
  return draft;
}
