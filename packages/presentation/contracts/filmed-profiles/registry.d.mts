export function registeredFilmedProfile(dealerId:string): {
  id:string;
  positions:Record<string,{cx:number;cy:number}>;
  card:{width:number;height:number};
  takes:{key:string;sha256:string;target:string;variant:string;startPose:'VILA'|'REDO';endPose:'VILA'|'REDO'}[];
  [key:string]:unknown;
}|null;
export function filmedProfileOrPaow(dealerId:string): (NonNullable<ReturnType<typeof registeredFilmedProfile>> & {inherited?:'paow'})|null;
