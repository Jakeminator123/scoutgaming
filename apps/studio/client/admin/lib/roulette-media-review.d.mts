import type {VideoEntry,VideoInventory} from './connected-studio.mjs';
import type {VideoMetadata} from '../../../../../packages/presentation/contracts/video-intake.mjs';
export type RouletteReviewForm={startPose:NonNullable<VideoMetadata['startPose']>;endPose:NonNullable<VideoMetadata['endPose']>;scale:string;x:string;y:string};
export function rouletteReviewForm(video:VideoEntry):RouletteReviewForm;
export function rouletteReviewMetadata(video:VideoEntry,dealerId:string,form:RouletteReviewForm):VideoMetadata;
export function saveRouletteReview(video:VideoEntry,dealerId:string,form:RouletteReviewForm,options?:{fetchImpl?:typeof fetch;signal?:AbortSignal}):Promise<VideoInventory>;
