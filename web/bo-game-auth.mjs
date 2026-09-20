import { createHash, randomBytes } from 'node:crypto';

// A BO cookie stays on the BO host. Only a single-use, browser-bound code crosses
// to the game, where it becomes an ordinary player session with no BO role.
export function backofficeGameAuth({db,auth,identity,boSession,validLaunch,publicUrl,boUrl}) {
  const game=new URL(publicUrl),bo=new URL(boUrl);
  const hash=value=>createHash('sha256').update(value).digest('hex');
  const token=()=>randomBytes(32).toString('hex');
  const validToken=value=>typeof value==='string' && /^[a-f0-9]{64}$/.test(value);
  const entry=path=>['/','/index.html','/v2','/v2/','/v2/index.html'].includes(path);
  const nextPath=value=>{
    if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//')||value.includes('\\')||value.length>2048)return '/';
    const url=new URL(value,game);
    if(url.origin!==game.origin||!entry(url.pathname))return '/';
    // Launch credentials must not persist across a separate BO login.
    url.searchParams.delete('launch');return url.pathname+url.search;
  };
  const stateCookie=(req,value,age)=>`bo_game_state=${value}; Path=/api/auth/bo/callback; HttpOnly; SameSite=Lax; Max-Age=${age}${req.socket.encrypted||process.env.NODE_ENV==='production'?'; Secure':''}`;
  db.exec(`CREATE TABLE IF NOT EXISTS bo_game_handoffs (
    state_digest TEXT PRIMARY KEY, next_path TEXT NOT NULL, expires INTEGER NOT NULL,
    code_digest TEXT UNIQUE, craig_user_id TEXT, username TEXT, source_stamp TEXT, session_until INTEGER
  )`);
  return function handle(req,res) {
    const url=new URL(req.url,game),path=url.pathname;
    if(!['/api/auth/access','/api/auth/bo/start','/api/auth/bo/callback','/api/bo/game-login'].includes(path))return false;
    const reply=(status,body='',headers={})=>{res.writeHead(status,{'Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Type':'text/plain; charset=utf-8',...headers});res.end(body);return true;};
    if(!['GET','HEAD'].includes(req.method))return reply(405,'GET required');
    if(path==='/api/auth/access') {
      if(auth.user(req))return reply(200);
      let original;
      try {original=new URL(req.headers['x-forwarded-uri']??'/',game);}catch{return reply(400,'Invalid request URL');}
      // Caddy checks the original URL before the launch handler can set a cookie.
      if(entry(original.pathname)&&validLaunch(original.searchParams.get('launch')))return reply(200);
      const method=req.headers['x-forwarded-method']??'GET';
      if(entry(original.pathname)&&['GET','HEAD'].includes(method))return reply(302,'', {Location:`/api/auth/bo/start?next=${encodeURIComponent(nextPath(original.pathname+original.search))}`});
      return reply(401,'Sign in required');
    }
    const expectedHost=path==='/api/bo/game-login'?bo.host:game.host;
    if(req.headers.host!==expectedHost)return reply(400,'Wrong sign-in host');
    if(path==='/api/auth/bo/start') {
      const next=nextPath(url.searchParams.get('next'));
      if(auth.user(req))return reply(303,'',{Location:next});
      db.prepare('DELETE FROM bo_game_handoffs WHERE expires<=?').run(Date.now());
      const state=token();
      db.prepare('INSERT INTO bo_game_handoffs (state_digest,next_path,expires) VALUES (?,?,?)').run(hash(state),next,Date.now()+300000);
      return reply(303,'',{Location:`${bo.origin}/api/bo/game-login?state=${state}`,'Set-Cookie':stateCookie(req,state,300)});
    }
    const state=url.searchParams.get('state');
    if(!validToken(state))return reply(400,'Invalid sign-in request. Open the game again.');
    if(path==='/api/bo/game-login') {
      const flow=db.prepare('SELECT * FROM bo_game_handoffs WHERE state_digest=? AND expires>? AND code_digest IS NULL').get(hash(state),Date.now());
      if(!flow)return reply(400,'Sign-in request expired. Open the game again.');
      const claims=boSession(req);
      const account=claims&&!claims.partner&&['reader','staff','admin','superadmin'].includes(claims.role)&&(!claims.aud||claims.aud==='backoffice')?identity.find(claims.sub):null;
      if(!account || (claims.source_stamp && claims.source_stamp!==account.stamp))return reply(303,'',{Location:`/bo/login.html?returnTo=${encodeURIComponent('/api/bo/game-login?state='+state)}`});
      const age=Math.min(86400,Math.floor(claims.exp-Date.now()/1000));
      if(age<1)return reply(401,'Backoffice session expired');
      const code=token();
      db.prepare('UPDATE bo_game_handoffs SET code_digest=?,craig_user_id=?,username=?,source_stamp=?,session_until=?,expires=? WHERE state_digest=?').run(hash(code),account.id,account.name,account.stamp,Date.now()+age*1000,Math.min(flow.expires,Date.now()+Math.min(60,age)*1000),hash(state));
      return reply(303,'',{Location:`${game.origin}/api/auth/bo/callback?state=${state}&code=${code}`});
    }
    const browserState=(req.headers.cookie??'').match(/(?:^|;\s*)bo_game_state=([a-f0-9]{64})(?:;|$)/)?.[1];
    const code=url.searchParams.get('code');
    if(browserState!==state||!validToken(code))return reply(400,'Sign-in did not start in this browser. Open the game again.');
    const flow=db.prepare('DELETE FROM bo_game_handoffs WHERE state_digest=? AND code_digest=? AND expires>? RETURNING *').get(hash(state),hash(code),Date.now());
    if(!flow)return reply(400,'Sign-in request expired or already used. Open the game again.');
    try {
      const age=Math.floor((flow.session_until-Date.now())/1000);
      if(age<1)throw Error('Session expired');
      const session=auth.fromBackoffice(req,{id:flow.craig_user_id,name:flow.username,stamp:flow.source_stamp},age);
      return reply(303,'',{Location:flow.next_path,'Set-Cookie':[session,stateCookie(req,'',0)]});
    }catch{return reply(401,'Scout account changed. Sign in again.',{'Set-Cookie':stateCookie(req,'',0)});}
  };
}
