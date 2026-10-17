import type { StudioProject } from '../../packages/presentation/contracts/studio-model.mjs';
import type { VideoRegistry } from '../../packages/studio-registry/server/registry-core.mjs';
export function createStudioProjectBindings(options: {
  videoRegistry(): Promise<VideoRegistry>;
  legacyControls?(project: StudioProject): Promise<{clips: any[];reviewSafetyVerified?: boolean}>;
}): (project: StudioProject) => Promise<void>;
