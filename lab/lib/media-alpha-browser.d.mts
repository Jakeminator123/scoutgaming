export function alphaPixelEvidence(data:Uint8ClampedArray):{transparent:number;visible:number};
export function inspectAlphaSource(url:string,contentType:string,options?:{signal?:AbortSignal;document?:Document}):Promise<unknown>;
export function inspectAlphaFile(file:Blob,contentType:string,options?:{signal?:AbortSignal}):Promise<unknown>;
