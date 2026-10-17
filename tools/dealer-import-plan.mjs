#!/usr/bin/env node
// Read-only preview. Supply private, current project/inventory exports yourself.
// No cloud connection, media download, source write, apply or deletion exists here.
import { readFile, realpath } from 'node:fs/promises';
import { resolve, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFrozenKevinImportPlan, frozenKevinImportSource, verifyImportSourceBytes } from '../apps/studio/lib/dealer-import-plan.mjs';

const usage = 'node tools/dealer-import-plan.mjs --plan --project <project.json> --dealer <registered-id> --source-alias dragge [--inventory <inventory.json>] [--source-root <existing-kevin-checkout> | --source-map <local-path-map.json>]';
const fail = code => { throw Object.assign(Error(code), { code }); };
export async function runDealerImportPlan(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--plan') { if (options.plan) fail('duplicate_option'); options.plan = true; }
    else if (['--project', '--dealer', '--source-alias', '--inventory', '--source-root', '--source-map'].includes(arg)) {
      if (options[arg] !== undefined || !args[i + 1] || args[i + 1].startsWith('--')) fail('invalid_option');
      options[arg] = args[++i];
    } else fail('unknown_option');
  }
  if (!options.plan || !options['--project'] || !options['--dealer'] || !options['--source-alias']) fail('plan_project_dealer_alias_required');
  if (options['--source-root'] && options['--source-map']) fail('conflicting_source_options');
  const json = async path => JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, ''));
  const project = await json(options['--project']);
  const inventory = options['--inventory'] ? await json(options['--inventory']) : undefined;
  const verifiedFiles = {};
  const readSource = async (root, entry, candidate) => {
    const actual = await realpath(candidate);
    const inside = relative(root, actual);
    if (isAbsolute(inside) || inside === '..' || inside.startsWith('..' + sep)) fail('source_path_outside_root');
    verifiedFiles[entry.path] = verifyImportSourceBytes(entry, await readFile(actual));
  };
  if (options['--source-root']) {
    const root = await realpath(resolve(options['--source-root']));
    for (const entry of frozenKevinImportSource().files) {
      const candidate = resolve(root, ...entry.path.split('/'));
      try { await readSource(root, entry, candidate); }
      catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    }
  }
  if (options['--source-map']) {
    // This is an explicit local path map, never a supplied hash attestation.
    // UUID-named originals can be verified without copying or renaming them.
    const map = await json(options['--source-map']);
    if (!map || Object.keys(map).sort().join(',') !== 'files,root,schemaVersion' || map.schemaVersion !== 1
      || typeof map.root !== 'string' || !isAbsolute(map.root) || !map.files || typeof map.files !== 'object' || Array.isArray(map.files)) fail('invalid_source_map');
    const root = await realpath(map.root), entries = frozenKevinImportSource().files;
    for (const [path, local] of Object.entries(map.files)) {
      const entry = entries.find(file => file.path === path);
      if (!entry || typeof local !== 'string' || !local) fail('invalid_source_map');
      await readSource(root, entry, resolve(root, local));
    }
  }
  return createFrozenKevinImportPlan({ project, dealerId: options['--dealer'], sourceAlias: options['--source-alias'], inventory, verifiedFiles });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.includes('--help')) console.log(usage);
    else console.log(JSON.stringify(await runDealerImportPlan(process.argv.slice(2)), null, 2));
  } catch (error) {
    console.error(JSON.stringify({ error: error.code ?? 'invalid_import_plan_input', usage }));
    process.exitCode = 1;
  }
}
