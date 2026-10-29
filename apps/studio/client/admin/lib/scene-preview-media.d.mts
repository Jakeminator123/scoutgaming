import type {StudioProject,StudioLane,LayerAsset} from '../../../../../packages/presentation/contracts/studio-model.mjs';
import type {CompositionSettings} from '../../../../../packages/presentation/contracts/composition-settings.mjs';
import type {DealerCompositing} from '../../../../../packages/presentation/contracts/dealer-compositing.mjs';
import type {DealerFraming} from '../../../../../packages/presentation/contracts/dealer-framing.mjs';
import type {VideoEntry,VideoInventory} from './connected-studio.mjs';
export type ScenePreviewMediaItem={url:string;label:string;contentType:string};
export type ScenePreviewChoices={dealer?:string;background?:string;table?:string};
export type ScenePreviewMedia={
  dealerId:string;backgroundId:string|undefined;backgroundBases:string[];tableBases:string[];tables:LayerAsset[];tableAsset:LayerAsset|undefined;
  video:VideoEntry|null;media:(id:string|null|undefined)=>ScenePreviewMediaItem|null;
  dealer:ScenePreviewMediaItem|null;background:ScenePreviewMediaItem|null;table:ScenePreviewMediaItem|null;
  compositing:DealerCompositing|undefined;framing:DealerFraming|undefined;settings:CompositionSettings;
};
export function useScenePreviewMedia(input:{project:StudioProject|null|undefined;inventory:VideoInventory|null|undefined;lane:StudioLane|undefined;game?:string;dealerId?:string;choices?:ScenePreviewChoices}):ScenePreviewMedia;
