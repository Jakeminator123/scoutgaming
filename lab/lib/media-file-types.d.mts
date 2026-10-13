export const MEDIA_FILE_TYPES: Readonly<Record<string,string>>;
export const NATIVE_MEDIA_FILE_TYPES: Readonly<Record<string,string>>;
export function mediaContentType(name:string):string;
export function mediaHeaderMatches(type:string,header:Uint8Array):boolean;
