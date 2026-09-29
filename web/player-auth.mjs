import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';

// Vercel's preview proxy is trusted only when the cloud launcher has supplied
// one exact origin. Web still expects its own public Host behind the proxy.
export function playerPostOriginOk(req, { gameOrigin = '', frontendOrigin = '' } = {}) {
  const host = req.headers.host;
  if (frontendOrigin && host !== new URL(gameOrigin).host) return false;
  const origin = req.headers.origin;
  if (origin === undefined) return true;
  if (typeof origin !== 'string' || !URL.canParse(origin)) return false;
  const parsed = new URL(origin);
  if (parsed.origin !== origin) return false;
  if (frontendOrigin && origin === frontendOrigin) {
    const site = req.headers['sec-fetch-site'];
    return site === undefined || site === 'same-origin';
  }
  return parsed.host === host && (!frontendOrigin || origin === gameOrigin);
}

export function playerAuth(db, createPlayer, identity = null, { playerAccounts = false, gameOrigin = '', frontendOrigin = '' } = {}) {
  db.exec(`CREATE TABLE IF NOT EXISTS player_accounts (email TEXT PRIMARY KEY, player_id TEXT UNIQUE NOT NULL, salt TEXT NOT NULL, hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS player_sessions (digest TEXT PRIMARY KEY, player_id TEXT NOT NULL, expires INTEGER NOT NULL);`);
  db.exec('CREATE TABLE IF NOT EXISTS craig_player_links (craig_user_id TEXT PRIMARY KEY, player_id TEXT UNIQUE NOT NULL)');
  if(!db.prepare('PRAGMA table_info(player_sessions)').all().some(c=>c.name==='source_stamp'))db.exec('ALTER TABLE player_sessions ADD COLUMN source_stamp TEXT');
  if(!db.prepare('PRAGMA table_info(player_sessions)').all().some(c=>c.name==='display_name'))db.exec('ALTER TABLE player_sessions ADD COLUMN display_name TEXT');
  const digest=t=>createHash('sha256').update(t).digest('hex');
  const accountStamp = account => account ? `local:${digest(`${account.salt}:${account.hash}`)}` : null;
  // The cloud gateway connects to Web over loopback and does not forward a
  // trusted client IP. Limit failed password guesses for each account instead
  // of sharing one loopback bucket across every player.
  const attempts=new Map();
  const failureWindowMs=600000, maxFailures=12;
  function loginBlocked(key) {
    const now=Date.now();
    for(const [account,entry] of attempts)if(now-entry.at>=failureWindowMs)attempts.delete(account);
    return (attempts.get(key)?.n??0)>=maxFailures;
  }
  function loginFailed(key) {
    const previous=attempts.get(key);
    attempts.set(key,{at:Date.now(),n:(previous?.n??0)+1});
  }
  function session(req) {
    const token=(req.headers.cookie??'').match(/(?:^|;\s*)player_session=([a-f0-9]{64})(?:;|$)/)?.[1];
    if (!token) return null;
    const session=db.prepare('SELECT player_id,source_stamp,display_name FROM player_sessions WHERE digest=? AND expires>?').get(digest(token),Date.now());
    if(!session)return null;
    // Partner-launched sessions belong to an operator's player, not a Craig user, so they carry a partner stamp instead of a Craig fingerprint.
    if(String(session.source_stamp??'').startsWith('local:')) {
      if(!playerAccounts || accountStamp(db.prepare('SELECT salt,hash FROM player_accounts WHERE player_id=?').get(session.player_id))!==session.source_stamp)return null;
    } else if(identity && !String(session.source_stamp??'').startsWith('partner:')){const link=db.prepare('SELECT craig_user_id FROM craig_player_links WHERE player_id=?').get(session.player_id);if(!link || !session.source_stamp || identity.stamp(link.craig_user_id)!==session.source_stamp)return null;}
    const partnerKeyId=String(session.source_stamp ?? '').startsWith('partner:') ? session.source_stamp.slice(8) || null : null;
    return partnerKeyId
      ? { playerId: session.player_id, partnerKeyId, displayName: session.display_name || 'spelaren' }
      : { playerId: session.player_id, partnerKeyId: null };
  }
  const user = req => session(req)?.playerId ?? null;
  const cookie=(req,token,age,sameSite='Strict')=>`player_session=${token}; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=${age}${(req.socket.encrypted || process.env.NODE_ENV==='production') ? '; Secure' : ''}`;
  function linkIdentity(existing) {
    if(!identity || !existing?.stamp || identity.stamp(existing.id)!==existing.stamp)throw Error('Scout session expired. Sign in again.');
    let link=db.prepare('SELECT player_id FROM craig_player_links WHERE craig_user_id=?').get(existing.id);
    if(!link){const p=createPlayer({name:existing.name});link={player_id:p.id};db.prepare('INSERT INTO craig_player_links VALUES (?,?)').run(existing.id,p.id);}
    return {...link,source_stamp:existing.stamp};
  }
  function issue(req,account,maxAge=86400,sameSite='Strict') {
    const token=randomBytes(32).toString('hex'),now=Date.now();
    db.prepare('DELETE FROM player_sessions WHERE expires<=?').run(now);
    db.prepare('INSERT INTO player_sessions (digest,player_id,expires,source_stamp,display_name) VALUES (?,?,?,?,?)').run(digest(token),account.player_id,now+maxAge*1000,account.source_stamp??null,account.display_name??null);
    return cookie(req,token,maxAge,sameSite);
  }
  function fromBackoffice(req,existing,maxAge=86400) {
    db.exec('BEGIN IMMEDIATE');
    try {const header=issue(req,linkIdentity(existing),maxAge,'Lax');db.exec('COMMIT');return header;}
    catch(e){db.exec('ROLLBACK');throw e;}
  }
  function fromPartner(req,claims,maxAge=21600) {
    if(typeof claims?.sub!=='string'||!claims.sub||typeof claims?.partner!=='string'||!claims.partner)throw Error('Invalid Partner launch claims.');
    const displayName=typeof claims.displayName==='string'&&claims.displayName ? claims.displayName : 'spelaren';
    return issue(req,{player_id:claims.sub,source_stamp:`partner:${claims.partner}`,display_name:displayName},maxAge,'Lax');
  }
  async function handle(req,res) {
    const localAccount = ['/api/auth/player/login','/api/auth/player/register'].includes(req.url);
    if (!localAccount && !['/api/auth/login','/api/auth/register','/api/auth/logout'].includes(req.url)) return false;
    const reply=(status,data,headers={})=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store',...headers});res.end(JSON.stringify(data));};
    if(req.method!=='POST'){reply(405,{error:'POST required'});return true;}
    if(!playerPostOriginOk(req,{gameOrigin,frontendOrigin})){reply(403,{error:'Invalid origin'});return true;}
    if(localAccount && !playerAccounts){reply(403,{error:'Player accounts are not enabled.'});return true;}
    if(req.url==='/api/auth/logout') {
      const token=(req.headers.cookie??'').match(/(?:^|;\s*)player_session=([a-f0-9]{64})(?:;|$)/)?.[1];
      if(token)db.prepare('DELETE FROM player_sessions WHERE digest=?').run(digest(token));
      reply(200,{ok:true},{'Set-Cookie':cookie(req,'',0)});return true;
    }
    if(identity && req.url==='/api/auth/register'){reply(403,{error:'Use your existing Scout account. New accounts are managed in the backoffice.'});return true;}
    try {
      let raw='';for await(const part of req){raw+=part;if(raw.length>4096)throw Error('Request too large');}
      const body=JSON.parse(raw);
      if(localAccount) {
        const username=String(body.username??'').trim().toLowerCase(), password=body.password;
        const registering=req.url.endsWith('/register');
        if(!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username) || typeof password!=='string' || password.length<(registering?12:1) || password.length>128)throw Error('Use a username of 3–32 letters/numbers and a password of 12–128 characters when creating an account.');
        // A separate namespace cannot shadow a Scout/CRAIG operator identity.
        const key=`username:${username}`;
        const loginKey=`player:${key}`;
        if(!registering && loginBlocked(loginKey)){reply(429,{error:'Too many attempts. Try again in 10 minutes.'});return true;}
        let account=db.prepare('SELECT * FROM player_accounts WHERE email=?').get(key);
        if(registering) {
          if(account)throw Error('Account unavailable. Try signing in.');
          const salt=randomBytes(16).toString('hex'), hash=scryptSync(password,salt,64).toString('hex');
          db.exec('BEGIN IMMEDIATE');
          try {
            const player=createPlayer({name:username});
            db.prepare('INSERT INTO player_accounts VALUES (?,?,?,?)').run(key,player.id,salt,hash);
            account={player_id:player.id,salt,hash};
            const header=issue(req,{...account,source_stamp:accountStamp(account)});
            db.exec('COMMIT');
            attempts.delete(loginKey);
            reply(200,{ok:true},{'Set-Cookie':header});
          }catch(error){db.exec('ROLLBACK');throw error;}
        } else {
          const computed=scryptSync(password,account?.salt??'invalid-account',64);
          if(!account||!timingSafeEqual(computed,Buffer.from(account.hash,'hex'))){loginFailed(loginKey);throw Error('Username or password is incorrect.');}
          const header=issue(req,{...account,source_stamp:accountStamp(account)});
          attempts.delete(loginKey);
          reply(200,{ok:true},{'Set-Cookie':header});
        }
        return true;
      }
      const {email:input,password}=body;
      const email=String(input??'').trim().toLowerCase();
      if(!email || email.length>254 || typeof password!=='string' || password.length<(identity?1:12) || password.length>128 || (!identity && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))throw Error(identity?'Enter your email or username and existing password.':'Enter an email and a password of 12–128 characters.');
      // CRAIG accepts both username and email. Resolve aliases to the same
      // account so changing the spelling cannot reset its failure budget.
      const loginKey=identity ? `craig:${identity.find(email)?.id??`unknown:${email}`}` : `email:${email}`;
      if(req.url==='/api/auth/login' && loginBlocked(loginKey)){reply(429,{error:'Too many attempts. Try again in 10 minutes.'});return true;}
      let account=db.prepare('SELECT * FROM player_accounts WHERE email=?').get(email);
      if(identity){
        const existing=identity.authenticate(email,password);
        if(!existing){loginFailed(loginKey);throw Error('Email, username or password is incorrect.');}
        db.exec('BEGIN IMMEDIATE');
        try {
          account=linkIdentity(existing);db.exec('COMMIT');
        }catch(e){db.exec('ROLLBACK');throw e;}
      }else if(req.url==='/api/auth/register') {
        if(account)throw Error('Account unavailable. Try signing in.');
        const salt=randomBytes(16).toString('hex'), hash=scryptSync(password,salt,64).toString('hex');
        db.exec('BEGIN IMMEDIATE');
        try {
          const p=createPlayer({name:email.split('@')[0]});
          db.prepare('INSERT INTO player_accounts VALUES (?,?,?,?)').run(email,p.id,salt,hash);
          db.exec('COMMIT');account={player_id:p.id};
        }catch(e){db.exec('ROLLBACK');throw e;}
      }else {
        const computed=scryptSync(password,account?.salt??'invalid-account',64);
        if(!account||!timingSafeEqual(computed,Buffer.from(account.hash,'hex'))){loginFailed(loginKey);throw Error('Email or password is incorrect.');}
      }
      const header=issue(req,account);
      attempts.delete(loginKey);
      reply(200,{ok:true},{'Set-Cookie':header});
    }catch(e){reply(400,{error:e.message});}
    return true;
  }
  return {user,session,handle,fromBackoffice,fromPartner};
}
