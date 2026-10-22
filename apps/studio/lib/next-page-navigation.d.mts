export function nextStudioLoginRedirect(returnTo?: unknown, publicOrigin?: string): string;

export function nextStudioAuthEntryRedirect(request:Request,config: {
  allowedOrigins:readonly string[];publicHosts:readonly string[];
  apiBase:'/studio/api/admin'|'/api/admin';authBase:'/studio/api/auth'|'/api/auth';
},options?:{mode?:'login'|'set-password';returnTo?:unknown;token?:unknown}):string|null;
