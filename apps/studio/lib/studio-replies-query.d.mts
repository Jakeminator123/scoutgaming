export type StudioRepliesRequest={kind:'list';dealerId:string;category?:string;cursor?:string}|{kind:'item';dealerId:string;id:string}|{kind:'media';dealerId:string;id:string;mediaKind:'audio'|'video'}|{kind:'categorize';id:string};
export function parseStudioRepliesRequest(method:string,url:URL):StudioRepliesRequest;
export function isStudioRepliesReadQuery(method:string,url:URL):boolean;
export function isReplyCursor(value:unknown):boolean;
