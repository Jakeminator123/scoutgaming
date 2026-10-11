import type {StudioProject} from './studio-model.mjs';
export function validateLibraryDraft(project:StudioProject,...knownProjects:StudioProject[]):StudioProject;
export function registerLibraryLayer(base:StudioProject,draft:StudioProject,remote:StudioProject,asset:{id:string;role:'background'|'table'}):{project:StudioProject;conflicts:string[]};
