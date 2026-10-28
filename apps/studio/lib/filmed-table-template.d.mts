export type FilmedTablePoint={x:number;y:number};
export type FilmedTableRect={x:number;y:number;width:number;height:number};
export type FilmedTableTemplate={
  readonly dealerId:string;readonly profileId:string;
  readonly canvas:{width:number;height:number};
  readonly plane:{offset:FilmedTablePoint;scale:number};
  readonly card:{width:number;height:number};
  readonly seats:{id:string;center:FilmedTablePoint;box:FilmedTableRect}[];
  readonly dealer:{center:FilmedTablePoint;box:FilmedTableRect};
  readonly felt:{top:number;railInner:[number,number][];railOuter:[number,number][]};
};
export const FILMED_TABLE_BOX_PAD: number;
export function filmedTableTemplate(dealerId:string,options?:{profileFor?:(dealerId:string)=>unknown;composition?:unknown;width?:number}):FilmedTableTemplate|null;
export function filmedTableRequestSize(template:FilmedTableTemplate):{width:number;height:number};
export function filmedTableSvg(template:FilmedTableTemplate,part:'reference'|'mask'|'boxes',options?:{stroke?:string}):string;
