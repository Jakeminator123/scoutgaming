export declare const adminContextKeys: readonly ['operator','table','dealer','composition','lane','game'];
export declare function isInternalAdminPathname(pathname:string):boolean;
export declare function hasAdminContext(search:string):boolean;
export declare function isRegisteredRoomListRoute(path:string,search:string):boolean;
export declare function isStudioAdminRoute(path:string,search:string):boolean;
export declare function withAdminContext(href:string,currentSearch:string):string;
