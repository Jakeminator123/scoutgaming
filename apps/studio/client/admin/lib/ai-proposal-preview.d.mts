import type {CompositionSettings} from '../../../../../packages/presentation/contracts/composition-settings.mjs';
import type {AiLandingCheck} from './ai-background.mjs';

export type AiPreviewLayoutName='desktop'|'mobile';
export type AiPreviewMedia={url:string;video?:boolean;width?:number;height?:number};
export type AiPreviewLayer={kind:'background'|'table'|'dealer';url:string;video:boolean;rect:[number,number,number,number]};
export type AiPreviewLayout={layout:AiPreviewLayoutName;aspect:number;layers:AiPreviewLayer[];marks:{zone:string;rect:[number,number,number,number]}[]};
export type AiLandingWarning={zones:string[];text:string;detail:string};

export const AI_PREVIEW_LAYOUTS: readonly AiPreviewLayoutName[];
export function aiLandingWarning(check:AiLandingCheck|null|undefined|unknown,role:'background'|'table'):AiLandingWarning|null;
export function aiPreviewLayout(input:{layout:AiPreviewLayoutName;settings:CompositionSettings;background?:AiPreviewMedia|null;table?:AiPreviewMedia|null;
  dealer?:{url:string;video?:boolean}|null;dealerId?:string;warned?:readonly string[];proposalRole?:'background'|'table'|null}):AiPreviewLayout;
