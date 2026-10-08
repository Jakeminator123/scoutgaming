import {timingSafeEqual} from 'node:crypto';
export function authorized(headers,token){
 if(!token)return false;const a=Buffer.from(headers.authorization??''),b=Buffer.from(`Bearer ${token}`);
 return a.length===b.length&&timingSafeEqual(a,b);
}
export function sameOrigin(req){
 try{const origin=new URL(req.headers.origin);return ['http:','https:'].includes(origin.protocol)&&origin.host===req.headers.host;}catch{return false;}
}
export function createRateLimit({limit=8,windowMs=60000,now=Date.now}={}){
 const entries=new Map();
 return key=>{const time=now();for(const [k,v] of entries)if(v.until<=time)entries.delete(k);let entry=entries.get(key);if(!entry){if(entries.size>=10000)return false;entry={count:0,until:time+windowMs};entries.set(key,entry);}return ++entry.count<=limit;};
}
export const guestToken=headers=>/(?:^|;\s*)astrid_guest=([a-f0-9]{64})(?:;|$)/.exec(headers.cookie??'')?.[1]??/(?:^|;\s*)astrid_demo=([a-f0-9]{64})(?:;|$)/.exec(headers.cookie??'')?.[1];
export function clientAddress(req){
 const peer=req.socket.remoteAddress??'unknown';
 // Only the local reverse proxy may supply the right-most forwarded address.
 if(['127.0.0.1','::1','::ffff:127.0.0.1'].includes(peer))return String(req.headers['x-forwarded-for']??peer).split(',').at(-1).trim();
 return peer;
}
