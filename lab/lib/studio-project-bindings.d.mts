import type { StudioProject } from '../../packages/presentation/contracts/studio-model.mjs';
import type { VideoRegistry } from './video-registry.mjs';
export function createStudioProjectBindings(options: {
  videoRegistry(): Promise<VideoRegistry>;
  legacyControls?(project: StudioProject): Promise<{clips: any[];reviewSafetyVerified?: boolean}>;
}): (project: StudioProject) => Promise<void>;
