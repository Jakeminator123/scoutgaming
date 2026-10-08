import {authorized} from './request-safety.mjs';
// Server-to-server only. The existing backoffice authenticates the human user.
export function auditAuthorized(req,token){
 return ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)&&!req.headers.origin&&authorized(req.headers,token);
}
