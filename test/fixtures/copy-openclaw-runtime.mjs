import { copyFile, mkdir, readdir, symlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { presentationPublicModules } from '../../packages/presentation/public-modules.mjs';

// Disposable server copies keep the repository's sibling-module layout. Copy
// source modules only, never credentials, persisted settings or runtime data.
export async function copyOpenClawRuntime(root) {
  for (const file of ['packages/presentation/capability-contract.mjs', 'packages/studio-access/account-role.mjs', 'packages/presentation/public-modules.mjs',
    'packages/studio-access/server/account-credentials.mjs', 'packages/studio-access/display-name.mjs',
    ...presentationPublicModules.map(row => row.source)]) {
    await mkdir(join(root, dirname(file)), {recursive: true});
    await copyFile(new URL('../../' + file, import.meta.url), join(root, file));
  }
  const rouletteTarget = join(root, 'web/games/roulette');
  await mkdir(rouletteTarget, { recursive: true });
  for (const file of ['index.mjs', 'preview.mjs', 'room.mjs', 'storage.mjs', 'http.mjs', 'access.mjs', 'rules.mjs']) {
    await copyFile(new URL(`../../web/games/roulette/${file}`, import.meta.url), join(rouletteTarget, file));
  }
  const source = new URL('../../open-claw/lab/src/', import.meta.url);
  const target = join(root, 'open-claw/lab/src');
  await mkdir(target, { recursive: true });
  for (const file of await readdir(source)) if (file.endsWith('.mjs')) {
    await copyFile(new URL(file, source), join(target, file));
  }
  // The web server's speech profile adapters are source-only sibling imports.
  // Keep the disposable layout complete without copying provider config/data.
  const speechSource = new URL('../../services/astrid-gpu-worker/gateway/', import.meta.url);
  const speechTarget = join(root, 'services/astrid-gpu-worker/gateway');
  await mkdir(speechTarget, { recursive: true });
  for (const file of ['worker-binding.mjs', 'cartesia-source.mjs', 'elevenlabs-source.mjs', 'pcm-source.mjs']) {
    await copyFile(new URL(file, speechSource), join(speechTarget, file));
  }
  await mkdir(join(root, 'tools'), {recursive: true});
  await copyFile(new URL('../../tools/media-layout.mjs', import.meta.url), join(root, 'tools/media-layout.mjs'));
  // Media consumers resolve their canonical metadata beneath the disposable
  // repository root. Only test databases and runtime state remain writable.
  await symlink(new URL('../../media/', import.meta.url), join(root, 'media'), process.platform === 'win32' ? 'junction' : 'dir');
}
