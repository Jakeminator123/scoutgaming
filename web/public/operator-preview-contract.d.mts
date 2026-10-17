import type {CompositionSettings} from '../../packages/presentation/contracts/composition-settings.mjs';
export type PublicPreviewContext={operatorSlug:string;roomId:string;packageRevision:number;dealerId:string};
export type PublicPreviewCompositing={mode:'alpha'}|{mode:'green-screen';threshold:number;softness:number;despill:number};
export type PublicPreviewLayer={id:string;label:string;src:string;contentType:string;designId?:string};
export type PublicPreviewDealerClip={src:string;contentType:'video/mp4'|'video/webm';compositing?:PublicPreviewCompositing;framing?:import('../../packages/presentation/contracts/dealer-framing.mjs').DealerFraming};
export type PublicOperatorPreview={
 schemaVersion:1;operatorSlug:string;roomId:string;packageRevision:number;dealer:{id:string;label:string};
 independentLayers:boolean;settings:CompositionSettings|null;
 media:{dealer:(PublicPreviewDealerClip&{variants?:PublicPreviewDealerClip[];foregroundPolygons?:import('../../packages/presentation/contracts/roulette-idle-contract.mjs').RouletteForegroundPolygons;wheelStart?:(PublicPreviewDealerClip&import('../../packages/presentation/contracts/roulette-start-contract.mjs').RouletteStartProfile)})|null;tables:PublicPreviewLayer[];backgrounds:PublicPreviewLayer[]};
};
export function previewMediaPath(context:PublicPreviewContext,kind:'dealer'|'table'|'background',id:string):string;
export function validatePublicOperatorPreview(value:unknown,expected?:Partial<PublicPreviewContext>):PublicOperatorPreview;
