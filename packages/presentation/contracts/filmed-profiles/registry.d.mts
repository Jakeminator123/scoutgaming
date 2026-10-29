export type RegisteredFilmedProfile = {
  id:string;
  positions:Record<string,{cx:number;cy:number}>;
  card:{width:number;height:number};
  takes:{key:string;sha256:string;target:string;variant:string;startPose:'VILA'|'REDO';endPose:'VILA'|'REDO'}[];
  [key:string]:unknown;
};
export function registeredFilmedProfile(dealerId:string): RegisteredFilmedProfile|null;
export function registeredFilmedProfileById(profileId:string): RegisteredFilmedProfile|null;
