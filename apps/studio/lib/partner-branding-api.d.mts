export const TABLE_COLOR_BRANDING_KEY: 'color';
export interface PartnerDraft {
  revision:number; basePackageRevision:number; branding:Record<string,unknown>;
  sourcePackageRevision:number|null; updatedAt:number;
}
export interface PartnerBrandingView {
  operatorId:string;packageRevision:number;lanes:string[];branding:Record<string,unknown>;adjustable:string[];
  presentation?:import('../../../packages/presentation/contracts/presentation-layers.mjs').PresentationPackage;
  dealerChoices?:Record<string,string[]>;roomDealerChoices?:Record<string,string[]>;
  draft?:PartnerDraft|null;draftRevision?:number;
  rooms?:{id:string;label:string;presentationLaneId:string;game:'blackjack'|'roulette'}[];
  history?:{revision:number;publishedAt:number;branding:Record<string,unknown>}[];
}
export interface PartnerPackageRecord {
 operatorId:string;revision:number;lanes:readonly string[];games:readonly string[];tables:readonly string[];
 branding:Record<string,unknown>;publishedAtMs?:number;
}
type Audit={actorId:string;accessClass:string;requestId:string;action?:string};
type DraftInput={operatorId:string;actor:string;audit?:Audit;expectedDraftRevision:number;expectedPackageRevision:number;branding:Record<string,unknown>;sourcePackageRevision?:number};
type PresentationMutation={kind:'presentation-package';value:import('../../../packages/presentation/contracts/presentation-layers.mjs').PresentationPackage};
type Store={
 scope?:unknown;
 getCurrentPackage(operatorId:string):Promise<PartnerPackageRecord|null>;
 publishPackage(input:{actor:string;audit?:Audit;expectedRevision:number;operatorId:string;lanes:readonly string[];games:readonly string[];tables:readonly string[];branding:Record<string,unknown>}):Promise<PartnerPackageRecord>;
 getPackage?(operatorId:string,revision:number):Promise<PartnerPackageRecord|null>;
 listPackages?(operatorId:string,options?:{limit?:number;beforeRevision?:number|null}):Promise<PartnerPackageRecord[]>;
 getBrandingDraft?(operatorId:string):Promise<(PartnerDraft & {action:string})|null>;
 saveBrandingDraft?(input:DraftInput):Promise<PartnerDraft>;
 publishBrandingDraft?(input:DraftInput):Promise<{package:PartnerPackageRecord;draft:PartnerDraft}>;
};
export function adjustableForPackage(laneIds:readonly string[],saved:unknown):string[];
export function createPartnerBrandingApi(options:{
 store:Store;readProject():Promise<unknown>;
 readAdministration():Promise<{revision:string;value:unknown}>;
 withWriteContext<T>(work:(context:{store:Store;readAdministration():Promise<{revision:string;value:unknown}>;reauthorize():Promise<boolean>;
   withMutationContext?<T>(work:()=>Promise<T>,descriptor:PresentationMutation):Promise<T>;
   materials?:{listMaterials(operatorId:string):Promise<readonly unknown[]>}})=>Promise<T>,options?:{presentationMutation?:PresentationMutation}):Promise<T>;
}):{
 read(input:{operatorId:string}):Promise<PartnerBrandingView>;
 readState(input:{operatorId:string}):Promise<PartnerBrandingView>;
 command(input:{operatorId:string;actor:string;audit?:Audit;action:'save-draft'|'review'|'publish'|'restore';expectedDraftRevision:number;expectedPackageRevision:number;branding?:Record<string,unknown>;sourcePackageRevision?:number;reviewToken?:string}):Promise<PartnerBrandingView|{reviewToken:string;draftRevision:number;packageRevision:number;branding:Record<string,unknown>;changes:{roomId:string|null;key:string;before:unknown;after:unknown}[];affectedRooms:string[]}>;
 write(input:{operatorId:string;actor:string;audit?:Audit;expectedRevision:number;branding:Record<string,unknown>}):Promise<PartnerBrandingView>;
};
