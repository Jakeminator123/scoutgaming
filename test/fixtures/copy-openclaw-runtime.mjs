import { cp, copyFile, mkdir, readdir, symlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { presentationPublicModules } from '../../packages/presentation/public-modules.mjs';

// Disposable server copies keep the repository's sibling-module layout. Copy
// source modules only, never credentials, persisted settings or runtime data.
export async function copyOpenClawRuntime(root) {
  for (const file of ['packages/presentation/capability-contract.mjs', 'packages/studio-access/account-role.mjs', 'packages/presentation/public-modules.mjs',
    'packages/presentation/server/studio-project-bindings.mjs',
    'packages/presentation/server/default-video-bindings.mjs',
    'packages/presentation/server/legacy-clip-inventory.mjs',
    'web/storage/studio-media-runtime.mjs',
    'web/storage/video-registry.mjs',
    'web/storage/legacy-clip-inventory.mjs',

    'packages/director/admin-error.mjs',
    'packages/director/astrid-observation.mjs',
    'packages/director/companion-personas.mjs',
    'packages/director/companion-search.mjs',
    'packages/director/companion.mjs',
    'packages/director/configuration.mjs',
    'packages/director/conversation-memory.mjs',
    'packages/director/dashboard-handoff-contract.mjs',
    'packages/director/engine.mjs',
    'packages/director/openclaw.mjs',
    'packages/director/product-probe.mjs',
    'packages/director/product-speech.mjs',
    'packages/director/social.mjs',
    'packages/director/speech-routing.mjs',
    'packages/director/studio-admin-contract.mjs',
    'packages/director/node/companion-store.mjs',
    'packages/director/node/settings-reader.mjs',

    'packages/studio-access/server/account-credentials.mjs', 'packages/studio-access/display-name.mjs',
    'packages/navigation/operator-entry.mjs',
    // Private neutral publication sources are copied for isolated Node fixtures only.
    'packages/presentation/contracts/dealer-media-features.mjs',
    'packages/presentation/contracts/dealer-sets.mjs',
    'packages/presentation/contracts/frozen-dealer-playback.mjs',
    'packages/presentation/contracts/operator-lifecycle-key.mjs',
    'packages/presentation/contracts/policies/probe-policy.seed.json',
    'packages/presentation/contracts/policies/project.seed.json',
    'packages/presentation/contracts/policies/studio-contract.json',
    'packages/presentation/contracts/presentation-layers.mjs',
    'packages/presentation/contracts/presentation-material-game.mjs',
    'packages/presentation/contracts/presentation-room.mjs',
    'packages/presentation/contracts/probe-policy.mjs',
    'packages/presentation/contracts/roulette-media.mjs',
    'packages/presentation/contracts/schemas/video.schema.json',
    'packages/presentation/contracts/studio-model.mjs',
    'packages/presentation/contracts/video-intake.mjs',
    'packages/presentation/runtime/legacy-clip-policy.mjs',
    'packages/presentation/runtime/media-families.mjs',
    'packages/presentation/runtime/media-family-policy.mjs',
    'packages/presentation/runtime/media-family-resolver.mjs',
    'packages/presentation/runtime/recorded-speech-selection.mjs',
    'packages/presentation/runtime/registered-idle-policy.mjs',
    'packages/presentation/runtime/registered-idle.mjs',
    'packages/presentation/server/frozen-dealer-idle.mjs',
    'packages/presentation/server/frozen-dealer-presentation.mjs',
    'packages/presentation/server/frozen-presentation-capture.mjs',
    'packages/presentation/server/package-rooms.mjs',
    'packages/presentation/server/presentation-package.mjs',
    'packages/presentation/server/saved-game-policy.mjs',
    'packages/shared/media-file-types.mjs',
    'packages/shared/studio-error.mjs',
    'packages/studio-access/server/partner-access-policy.mjs',
    'packages/studio-access/studio-scope.mjs',
    ...presentationPublicModules.map(row => row.source)]) {
    await mkdir(join(root, dirname(file)), {recursive: true});
    await copyFile(new URL('../../' + file, import.meta.url), join(root, file));
  }
  await cp(new URL('../../packages/studio-registry/', import.meta.url), join(root, 'packages/studio-registry'), {recursive:true});
  await cp(new URL('../../packages/storage/', import.meta.url), join(root, 'packages/storage'), {recursive:true});
  await cp(new URL('../../packages/operators/', import.meta.url), join(root, 'packages/operators'), {recursive:true});
  await mkdir(join(root,'tools'),{recursive:true});
  await copyFile(new URL('../../tools/media-blob-index-reader.mjs', import.meta.url),join(root,'tools/media-blob-index-reader.mjs'));
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
