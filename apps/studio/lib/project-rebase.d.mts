import type {StudioProject} from '../../../packages/presentation/contracts/studio-model.mjs';
export function rebaseProjectDraft(base:StudioProject,draft:StudioProject,remote:StudioProject,prefer?:'local'|'remote'):{project:StudioProject;conflicts:string[]};
