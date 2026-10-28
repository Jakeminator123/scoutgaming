import type {StudioProject} from '../../../../../packages/presentation/contracts/studio-model.mjs';
export function setTemplateDealers(project:StudioProject,compositionId:string,ids:string[],defaultId:string):StudioProject;
export function dealerIdFromName(project: {dealers?: {id: string}[]; dealerTrash?: {dealer?: {id: string}}[]}|null|undefined, name: string): string;
