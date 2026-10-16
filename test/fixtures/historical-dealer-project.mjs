import { createEmptyProject, addDealer } from '../../lab/lib/studio-model.mjs';

// Test-only reconstruction of an already saved profile, independent of active seeds.
export function historicalDealerProject(dealerId) {
  const project = addDealer(createEmptyProject(), 'historical-fixture', 'Historical dealer');
  project.dealers[0].id = dealerId;
  for (const line of project.lines) {
    line.dealerId = dealerId;
    line.baselineVariantId = line.baselineVariantId.replace(/^historical-fixture\./, `${dealerId}.`);
    for (const variant of line.variants) variant.id = variant.id.replace(/^historical-fixture\./, `${dealerId}.`);
  }
  return project;
}
