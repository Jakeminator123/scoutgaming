import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';

export function playerAuth(db, createPlayer, identity = null) {
  db.exec(`CREATE TABLE IF NOT EXISTS player_accounts (email TEXT PRIMARY KEY, player_id TEXT UNIQUE NOT NULL, salt TEXT NOT NULL, hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS player_sessions (digest TEXT PRIMARY KEY, player_id TEXT NOT NULL, expires INTEGER NOT NULL);`);
  db.exec('CREATE TABLE IF NOT EXISTS craig_player_links (craig_user_id TEXT PRIMARY KEY, player_id TEXT UNIQUE NOT NULL)');
  if(!db.prepare('PRAGMA table_info(player_sessions)').all().some(c=>c.name==='source_stamp'))db.exec('ALTER TABLE player_sessions ADD COLUMN source_stamp TEXT');
  const digest=t=>createHash('sha256').update(t).digest('hex');
  const attempts=new Map();
  function user(req) {
    const token=(req.headers.cookie??'').match(/(?:^|;\s*)player_session=([a-f0-9]{64})(?:;|$)/)?.[1];
    if (!token) return null;
    const session=db.prepare('SELECT player_id,source_stamp FROM player_sessions WHERE digest=? AND expires>?').get(digest(token),Date.now());
    if(!session)return null;
    // Partner-launched sessions belong to an operator's player, not a Craig user, so they carry a partner stamp instead of a Craig fingerprint.
    if(identity && !String(session.source_stamp??'').startsWith('partner:')){const link=db.prepare('SELECT craig_user_id FROM craig_player_links WHERE player_id=?').get(session.player_id);if(!link || !session.source_stamp || identity.stamp(link.craig_user_id)!==session.source_stamp)return null;}
    return session.player_id;
  }
  const cookie=(req,token,age)=>`player_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${(req.socket.encrypted || process.env.NODE_ENV==='production') ? '; Secure' : ''}`;
  async function handle(req,res) {
    if (!['/api/auth/login','/api/auth/register','/api/auth/logout'].includes(req.url)) return false;
    const reply=(status,data,headers={})=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store',...headers});res.end(JSON.stringify(data));};
    if(req.method!=='POST'){reply(405,{error:'POST required'});return true;}
    if(req.headers.origin && (!URL.canParse(req.headers.origin)||new URL(req.headers.origin).host!==req.headers.host)){reply(403,{error:'Invalid origin'});return true;}
    if(req.url==='/api/auth/logout') {
      const token=(req.headers.cookie??'').match(/(?:^|;\s*)player_session=([a-f0-9]{64})(?:;|$)/)?.[1];
      if(token)db.prepare('DELETE FROM player_sessions WHERE digest=?').run(digest(token));
      reply(200,{ok:true},{'Set-Cookie':cookie(req,'',0)});return true;
    }
    if(identity && req.url==='/api/auth/register'){reply(403,{error:'Use your existing Scout account. New accounts are managed in the backoffice.'});return true;}
    const ip=req.socket.remoteAddress, now=Date.now();
    for(const [key,v] of attempts) if(now-v.at>600000)attempts.delete(key);
    const limit=attempts.get(ip)??{at:now,n:0};limit.n++;attempts.set(ip,limit);
    if(limit.n>12){reply(429,{error:'Too many attempts. Try again in 10 minutes.'});return true;}
    try {
      let raw='';for await(const part of req){raw+=part;if(raw.length>4096)throw Error('Request too large');}
      const {email:input,password}=JSON.parse(raw);
      const email=String(input??'').trim().toLowerCase();
      if(!email || email.length>254 || typeof password!=='string' || password.length<(identity?1:12) || password.length>128 || (!identity && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))throw Error(identity?'Enter your email or username and existing password.':'Enter an email and a password of 12–128 characters.');
      let account=db.prepare('SELECT * FROM player_accounts WHERE email=?').get(email);
      if(identity){
        const existing=identity.authenticate(email,password);
        if(!existing)throw Error('Email, username or password is incorrect.');
        db.exec('BEGIN IMMEDIATE');
        try {
          let link=db.prepare('SELECT player_id FROM craig_player_links WHERE craig_user_id=?').get(existing.id);
          if(!link){const p=createPlayer({name:existing.name});link={player_id:p.id};db.prepare('INSERT INTO craig_player_links VALUES (?,?)').run(existing.id,p.id);}
          account={...link,source_stamp:existing.stamp};db.exec('COMMIT');
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
        if(!account||!timingSafeEqual(computed,Buffer.from(account.hash,'hex')))throw Error('Email or password is incorrect.');
      }
      const token=randomBytes(32).toString('hex');
      db.prepare('DELETE FROM player_sessions WHERE expires<=?').run(now);
      db.prepare('INSERT INTO player_sessions (digest,player_id,expires,source_stamp) VALUES (?,?,?,?)').run(digest(token),account.player_id,now+86400000,account.source_stamp??null);
      reply(200,{ok:true},{'Set-Cookie':cookie(req,token,86400)});
    }catch(e){reply(400,{error:e.message});}
    return true;
  }
  return {user,handle};
}
