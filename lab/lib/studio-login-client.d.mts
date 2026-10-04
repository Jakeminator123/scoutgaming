export type StudioLoginReturnTo = '/studio'|'/studio/administration'|`/api/bo/game-login?state=${string}`|`/api/bo/lab-login?state=${string}`;
export function studioLoginReturnTo(value:unknown):StudioLoginReturnTo;
export function studioLoginDestination(value:unknown,authBase?:'/studio/api/auth'|'/api/auth'):string;
export function studioPasswordToken(value:unknown):string|null;
export class StudioLoginUiError extends Error { status:number; constructor(status?:number); }
export function createStudioLoginClient(options?:{authBase?:'/studio/api/auth'|'/api/auth';fetchImpl?:typeof fetch}): {
  request(action:'login'|'logout'|'reset-request'|'set-password',body:Record<string,unknown>):Promise<{ok:true}>;
};
