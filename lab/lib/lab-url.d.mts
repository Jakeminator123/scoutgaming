export function labBasePath():''|'/studio';
export function labUrl<T>(value:T):T|string;
export function labUrl(value:string):string;
export function publicAbsoluteUrl(headerList:{get(name:string):string|null}|null|undefined,pathname:string):string;
export function stripLabBasePath(value:string):string;
