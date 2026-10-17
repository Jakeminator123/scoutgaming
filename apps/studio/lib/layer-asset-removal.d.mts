import type {StudioProject} from '../../../packages/presentation/contracts/studio-model.mjs';
import type {LayerAsset} from '../../../packages/presentation/contracts/studio-model.mjs';
export function layerAssetReferences(project:StudioProject,id:string):Array<{id:string;label:string}>;
export function removeLayerAsset(project:StudioProject,id:string):StudioProject;
export function restoreLayerAsset(project:StudioProject,asset:LayerAsset):StudioProject;
