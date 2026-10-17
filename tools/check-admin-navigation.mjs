import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runChecks } from './precommit-checks.mjs';

const navigationTests = [
  'apps/studio/client/runtime/admin-routing.test.mjs',
  'apps/studio/client/runtime/navigation.test.mjs',
  'apps/studio/test/studio-history.test.mjs',
  'apps/studio/test/admin-workspace.test.mjs',
  'apps/studio/test/next-page-navigation.test.mjs',
  'apps/studio/test/studio-login-client.test.mjs',
  'apps/studio/test/studio-login-form.test.mjs',
  'apps/studio/test/partner-session.test.mjs',
  'apps/studio/test/partner-login.test.mjs',
  'apps/studio/test/workspace-surfaces.test.mjs',
  'apps/studio/test/workspace-surface-pages.test.mjs',
  'apps/studio/components/kevin-bo/partner-navigation-guard.test.mjs',
  'apps/studio/test/partner-workspace-visual.test.mjs',
  'apps/studio/test/studio-navigation.test.mjs',
  'apps/studio/test/partner-presentation-flow.test.mjs',
];
const notice = 'Focused Admin/partner navigation checks only; this does not replace mandatory full delivery/CI checks.';

export function adminNavigationPlan() {
  return {
    scope: 'admin-partner-navigation', completeDeliveryCheck: false, notice,
    commands: [[process.execPath, '--test', '--test-concurrency=4', ...navigationTests]],
  };
}

export function main(args = process.argv.slice(2), { run = runChecks, output = console.log } = {}) {
  if (args.some(arg => arg !== '--plan')) throw Error('Usage: node tools/check-admin-navigation.mjs [--plan]');
  const plan = adminNavigationPlan();
  if (args.includes('--plan')) { output(JSON.stringify(plan)); return 0; }
  output(plan.notice);
  return run(plan.commands);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = main(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
