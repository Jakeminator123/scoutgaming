import type { StudioProject } from '../../../packages/presentation/contracts/studio-model.mjs';
import type { LegacyClipInventory, LegacyClipControls } from '../../../packages/presentation/contracts/legacy-clip-types.mjs';
export function loadLegacyClipInventory(options?: {repository?: string; publicRoot?: string; dataDirectory?: string}): Promise<LegacyClipInventory>;
export function legacyClipControls(project: StudioProject, options?: {repository?: string; publicRoot?: string; dataDirectory?: string}): Promise<LegacyClipControls>;
