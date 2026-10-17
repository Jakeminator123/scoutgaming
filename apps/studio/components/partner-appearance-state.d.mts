import type {PresentationPackage} from '../../../packages/presentation/contracts/presentation-layers.mjs';
export type EditableBranding = {lane?:string;table?:string;background?:string;dealer?:string;color?:string;roomOverrides?:Record<string,Record<string,string>>};
export type AppearanceDraft = {revision:number;basePackageRevision:number;branding:Readonly<Record<string,unknown>>;sourcePackageRevision?:number|null;updatedAt?:number|string};
export type PartnerAppearanceInitial = {
 operatorId:string; packageRevision:number; lanes:readonly string[]; branding:Readonly<Record<string,unknown>>;adjustable:readonly string[];
 presentation?:PresentationPackage;canConfigure?:boolean;dealerChoices?:Readonly<Record<string,readonly string[]>>;roomDealerChoices?:Readonly<Record<string,readonly string[]>>;
 draft?:AppearanceDraft|null;draftRevision?:number;history?:readonly {revision:number;publishedAt?:number|string;branding:Readonly<Record<string,unknown>>}[];
 rooms?:readonly {id:string;label:string;presentationLaneId:string;game?:'blackjack'|'roulette'}[];
};
export type AppearanceReview = {reviewToken:string;draftRevision:number;packageRevision:number;branding:EditableBranding;changes:{roomId:string|null;key:string;before:string|null;after:string|null}[];affectedRooms:string[]};
export function appearanceBranding(value:unknown):EditableBranding;
export function sameAppearance(left:unknown,right:unknown):boolean;
export function appearanceDraftRevision(state:PartnerAppearanceInitial):number;
export function appearanceDraftBranding(state:PartnerAppearanceInitial):EditableBranding;
export function appearanceReceipt(value:unknown,operatorId:string):value is PartnerAppearanceInitial;
export function appearanceReview(value:unknown,expected:{draftRevision:number;packageRevision:number;branding:unknown}):value is AppearanceReview;
export function changeAppearance(value:EditableBranding,change:{roomId?:string|null;key:string;selection:string|null}):EditableBranding;
export function resetAppearanceRoom(value:EditableBranding,roomId:string):EditableBranding;
