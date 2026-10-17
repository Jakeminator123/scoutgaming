export const NATIVE_MEDIA_ACCEPT:string;
export function nativeMediaFileError(file:Blob&{name?:string},contentType?:string):string;
export function assertNativeMediaFiles(files:ReadonlyArray<File>):void;
