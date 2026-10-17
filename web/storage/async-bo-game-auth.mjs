import {backofficePlayerHandoffRequired,currentBackofficeAccount,backofficePlayerSource,readBackofficePlayerSource} from '../bo-player-session.mjs';
import {playerHandoffPath} from '../public/player-handoff.mjs';
// PostgreSQL implementation; explicit schema is installed before service initialization.
import { createHash, randomBytes } from 'node:crypto';

// A BO cookie stays on the BO host. Only a single-use, browser-bound code crosses
// to the game, where it becomes an ordinary player session with no BO role.
export function backofficeGameAuth({db,auth,identity,boSession,validLaunch,publicUrl,boUrl,publicGamePath='/'}) {
  if (!['/', '/game','/blackjack'].includes(publicGamePath)) throw Error('Invalid public game path');
  const game=new URL(publicUrl),bo=new URL(boUrl);
  const hash=value=>createHash('sha256').update(value).digest('hex');
  const token=()=>randomBytes(32).toString('hex');
  const validToken=value=>typeof value==='string' && /^[a-f0-9]{64}$/.test(value);
  const entry=path=>['/','/index.html','/v2','/v2/','/v2/index.html', ...(publicGamePath !== '/' ? ['/game','/game/'] : []),...(publicGamePath === '/blackjack' ? ['/blackjack','/blackjack/'] : [])].includes(path);
  const nextPath=async value=>{
    const playerReturn=playerHandoffPath(value,{origin:game.origin});
    if(playerReturn) return playerReturn;
    if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//')||value.includes('\\')||value.length>2048)return publicGamePath === '/blackjack' ? '/blackjack' : '/';
    const url=new URL(value,game);
    if(url.origin!==game.origin||!entry(url.pathname))return publicGamePath === '/blackjack' ? '/blackjack' : '/';
    if(publicGamePath === '/blackjack') {
      const { canonicalGameDestination } = await import('../../packages/navigation/game-entry.mjs');
      return canonicalGameDestination(url,{includeLaunch:false});
    }
    // Launch credentials must not persist across a separate BO login.
    url.searchParams.delete('launch');return url.pathname+url.search;
  };
  const stateCookie=(req,value,age)=>`bo_game_state=${value}; Path=/api/auth/bo/callback; HttpOnly; SameSite=Lax; Max-Age=${age}${req.socket.encrypted||process.env.NODE_ENV==='production'?'; Secure':''}`;

  return async function handle(req,res) {
    const url=new URL(req.url,game),path=url.pathname;
    if(!['/api/auth/access','/api/auth/bo/start','/api/auth/bo/callback','/api/bo/game-login'].includes(path))return false;
    const reply=(status,body='',headers={})=>{res.writeHead(status,{'Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Type':'text/plain; charset=utf-8',...headers});res.end(body);return true;};
    if(!['GET','HEAD'].includes(req.method))return reply(405,'GET required');
    if(path==='/api/auth/access') {
      if((await auth.user(req)))return reply(200);
      let original;
      try {original=new URL(req.headers['x-forwarded-uri']??'/',game);}catch{return reply(400,'Invalid request URL');}
      // Caddy checks the original URL before the launch handler can set a cookie.
      if(entry(original.pathname)&&(await validLaunch(original.searchParams.get('launch'))))return reply(200);
      const method=req.headers['x-forwarded-method']??'GET';
      if(entry(original.pathname)&&['GET','HEAD'].includes(method))return reply(302,'', {Location:`/api/auth/bo/start?next=${encodeURIComponent(await nextPath(original.pathname+original.search))}`});
      return reply(401,'Sign in required');
    }
    const expectedHost=path==='/api/bo/game-login'?bo.host:game.host;
    if(req.headers.host!==expectedHost)return reply(400,'Wrong sign-in host');
    if(path==='/api/auth/bo/start') {
      const next=await nextPath(url.searchParams.get('next'));
      const playerId=await auth.user(req);
      if(playerId && !await backofficePlayerHandoffRequired(req,{db,identity,boSession,publicUrl,boUrl,playerId}))return reply(303,'',{Location:next});
      (await db.prepare('DELETE FROM bo_game_handoffs WHERE expires<=?').run(Date.now()));
      const state=token();
      (await db.prepare('INSERT INTO bo_game_handoffs (state_digest,next_path,expires) VALUES (?,?,?)').run(hash(state),next,Date.now()+300000));
      return reply(303,'',{Location:`${bo.origin}/api/bo/game-login?state=${state}`,'Set-Cookie':stateCookie(req,state,300)});
    }
    const state=url.searchParams.get('state');
    if(!validToken(state))return reply(400,'Invalid sign-in request. Open the game again.');
    if(path==='/api/bo/game-login') {
      const flow=(await db.prepare('SELECT * FROM bo_game_handoffs WHERE state_digest=? AND expires>? AND code_digest IS NULL').get(hash(state),Date.now()));
      if(!flow)return reply(400,'Sign-in request expired. Open the game again.');
      const claims=(await boSession(req));
      const account=claims&&!claims.partner&&['reader','staff','admin','superadmin'].includes(claims.role)&&(!claims.aud||claims.aud==='backoffice')?(await identity.find(claims.sub)):null;
      if(!account || claims.source_stamp!==account.stamp || !Number.isSafeInteger(claims.auth_epoch) || claims.auth_epoch<0
        || !Number.isFinite(claims.exp))return reply(303,'',{Location:`/studio/login?returnTo=${encodeURIComponent('/api/bo/game-login?state='+state)}`});
      const age=Math.min(86400,Math.floor(claims.exp-Date.now()/1000));
      if(age<1)return reply(401,'Backoffice session expired');
      const code=token();
      (await db.prepare('UPDATE bo_game_handoffs SET code_digest=?,craig_user_id=?,username=?,source_stamp=?,session_until=?,expires=? WHERE state_digest=?').run(hash(code),account.id,account.name,backofficePlayerSource(account.stamp,claims.auth_epoch),Date.now()+age*1000,Math.min(flow.expires,Date.now()+Math.min(60,age)*1000),hash(state)));
      return reply(303,'',{Location:`${game.origin}/api/auth/bo/callback?state=${state}&code=${code}`});
    }
    const browserState=(req.headers.cookie??'').match(/(?:^|;\s*)bo_game_state=([a-f0-9]{64})(?:;|$)/)?.[1];
    const code=url.searchParams.get('code');
    if(browserState!==state||!validToken(code))return reply(400,'Sign-in did not start in this browser. Open the game again.');
    const flow=(await db.prepare('DELETE FROM bo_game_handoffs WHERE state_digest=? AND code_digest=? AND expires>? RETURNING *').get(hash(state),hash(code),Date.now()));
    if(!flow)return reply(400,'Sign-in request expired or already used. Open the game again.');
    try {
      const source=readBackofficePlayerSource(flow.source_stamp);
      if(!source)throw Error('Backoffice handoff must be renewed');
      // On the shared host the BO cookie accompanies this callback. Recheck its
      // epoch and identity so logout or an account switch cancels pending codes.
      if(game.origin===bo.origin) {
        const account=await currentBackofficeAccount(req,{identity,boSession,roles:['reader','staff','admin','superadmin']});
        if(!account || account.id!==flow.craig_user_id || account.stamp!==source.stamp || account.authEpoch!==source.authEpoch)throw Error('Backoffice session changed');
      }
      const age=Math.floor((flow.session_until-Date.now())/1000);
      if(age<1)throw Error('Session expired');
      const session=(await auth.fromBackoffice(req,{id:flow.craig_user_id,name:flow.username,...source},age));
      return reply(303,'',{Location:flow.next_path,'Set-Cookie':[session,stateCookie(req,'',0)]});
    }catch{return reply(401,'Scout account changed. Sign in again.',{'Set-Cookie':stateCookie(req,'',0)});}
  };
}
