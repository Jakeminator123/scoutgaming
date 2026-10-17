import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { LAB_ROOT, readSettings } from './settings.mjs';
import { validateCatalog, normalizeInput, prepareDecision } from '../../../../packages/director/engine.mjs';
import { providerStatus } from '../../../../packages/director/openclaw.mjs';

const catalog = JSON.parse(await readFile(join(LAB_ROOT, 'config/catalog.json'), 'utf8'));
const result = validateCatalog(catalog);
if (!result.valid) { console.error(result.errors); process.exitCode = 1; }
else {
  const fixtures = JSON.parse(await readFile(join(LAB_ROOT, 'fixtures/scenarios.json'), 'utf8'));
  let count = 0;
  for (const scenario of fixtures) for (const event of scenario.events) {
    prepareDecision(catalog, normalizeInput({ event, context: scenario.context })); count++;
  }
  console.log(JSON.stringify({ catalog: 'valid', nodes: catalog.events.length, assets: catalog.assets.length, fixtureEvents: count, openclaw: providerStatus(readSettings()) }, null, 2));
}
