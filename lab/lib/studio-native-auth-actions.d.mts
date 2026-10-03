import type { NativeStudioSession } from './studio-native-auth.mjs';
import type { StudioAdminScope } from './studio-admin-api.mjs';
export interface StudioPasswordInvitation { to:string; kind:'invite'|'reset'; role:NativeStudioSession['role']; link:string; }
export interface StudioPasswordMail { send(invitation: Readonly<StudioPasswordInvitation>): Promise<{sent:boolean}>; }
export interface StudioAuthRateLimitInput { clientKey:string; user:string; action:'login'|'reset-request'|'set-password'; }
export function createStudioPasswordDelivery(options:{boDb:unknown;mail:StudioPasswordMail;publicOrigin:string;now?:()=>number}): {
  mint(input:{username:string;email:string;role:NativeStudioSession['role'];kind:'invite'|'reset'}):Promise<StudioPasswordInvitation>;
  send(invitation:StudioPasswordInvitation):Promise<boolean>;
};
export function createStudioLoginRateLimit(options:{boDb:unknown;now?:()=>number;maxEntries?:number}): (input:StudioAuthRateLimitInput)=>Promise<boolean>;
export function createStudioNativeAuthActions(options:{
  boDb:unknown;scope:StudioAdminScope;authorize(request:Request):Promise<NativeStudioSession>;
  mail?:StudioPasswordMail;publicOrigin?:string;allowedOrigins?:string[];authBase?:'/studio/api/auth'|'/api/auth';
  rateLimit?:(input:StudioAuthRateLimitInput)=>Promise<boolean>;clientAddress?:(request:Request)=>string|Promise<string>;now?:()=>number;
}):Readonly<{handle(request:Request):Promise<Response>;availableActions:readonly string[]}>;
