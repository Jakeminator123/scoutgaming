// PostgreSQL implementation; explicit schema is installed before service initialization.
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { createAccountCredentialResolver } from '../../../packages/studio-access/server/account-credentials.mjs';
import { readBackofficePlayerSource } from '../bo-player-session.mjs';
import { claimedOperator, keyOperator, partnerRefusal, PARTNER_OPERATOR_MISMATCH } from '../partner-operator.mjs';

// Vercel's preview proxy is trusted only when the cloud launcher has supplied
// one exact origin. Web still expects its own public Host behind the proxy.
export function playerPostOriginOk(req, { gameOrigin = '', frontendOrigin = '' } = {}) {
  const host = req.headers.host;
  const gameHost = frontendOrigin ? new URL(gameOrigin).host : host;
  const origin = req.headers.origin;
  if (origin === undefined) return host === gameHost;
  if (typeof origin !== 'string' || !URL.canParse(origin)) return false;
  const parsed = new URL(origin);
  if (parsed.origin !== origin) return false;
  if (frontendOrigin && origin === frontendOrigin) {
    const site = req.headers['sec-fetch-site'];
    return (host === gameHost || host === new URL(frontendOrigin).host)
      && (site === undefined || site === 'same-origin');
  }
  return host === gameHost && parsed.host === host && (!frontendOrigin || origin === gameOrigin);
}

export function playerAuth(db, createPlayer, identity = null, { playerAccounts = false, gameOrigin = '', frontendOrigin = '', administratorSession, partnerAuthority, sharedBackofficeOrigin = false, backofficeLogout,authEpoch,
  allowLegacyPartnerSessions = process.env.CROUPIER_STUDIO_NEON_POLICY !== '1' } = {}) {

  const credentials = createAccountCredentialResolver({identity,playerDb:db,playerAccounts});
  const digest=t=>createHash('sha256').update(t).digest('hex');
  // The key row while it may still act for its sessions, otherwise null.
  const partnerKey=async (id, stamp)=>{
    if(typeof id!=='string'||!id||typeof partnerAuthority!=='function')return null;
    const key=await partnerAuthority(id);
    if(!key||key.id!==id||key.revoked_at||key.wallet_url)return null;
    if(stamp===undefined||stamp===null)return allowLegacyPartnerSessions?key:null;
    return typeof stamp==='string'&&/^[a-f0-9]{64}$/.test(stamp)&&typeof key.secret==='string'
      && digest(key.secret)===stamp ? key : null;
  };
  const partnerAllowed=async (id, stamp)=>Boolean(await partnerKey(id,stamp));
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
  async function validatedSession(sessionDigest) {
    const session=(await db.prepare('SELECT player_id,source_stamp,display_name,expires FROM player_sessions WHERE digest=? AND expires>?').get(sessionDigest,Date.now()));
    if(!session)return null;
    const player = await db.prepare('SELECT status FROM players WHERE id=?').get(session.player_id);
    if (!player || player.status !== 'active') return null;
    // Partner-launched sessions belong to an operator's player, not a Craig user, so they carry a partner stamp instead of a Craig fingerprint.
    if(String(session.source_stamp??'').startsWith('local:')) {
      if(identity && !playerAccounts || accountStamp((await db.prepare('SELECT salt,hash FROM player_accounts WHERE player_id=?').get(session.player_id)))!==session.source_stamp)return null;
    } else if(!String(session.source_stamp??'').startsWith('partner:') && (identity || session.source_stamp!=null)) {
      const source=readBackofficePlayerSource(session.source_stamp),credential=/^credential:([a-f0-9]{64})$/.exec(session.source_stamp??'');
      // Old bare fingerprints have ambiguous provenance and require a fresh login.
      if(!identity || !source && !credential)return null;
      const link=await db.prepare('SELECT craig_user_id FROM craig_player_links WHERE player_id=?').get(session.player_id);
      if(!link || (await identity.stamp(link.craig_user_id))!==(source?.stamp??credential[1]))return null;
      if(source && (typeof authEpoch!=='function' || (await authEpoch(link.craig_user_id))!==source.authEpoch))return null;
    }
    const partnerSource = String(session.source_stamp ?? '');
    const partner = partnerSource.startsWith('partner:') ? /^partner:([^:]+)(?::([a-f0-9]{64}))?$/.exec(partnerSource) : null;
    if(partnerSource.startsWith('partner:')&&!partner)return null;
    const partnerKeyId=partner?.[1]??null, partnerKeyStamp=partner?.[2];
    // Historical sessions stay in storage, but revoked keys and unsupported
    // external wallets cannot bypass partner API checks through the native UI.
    let operatorId=null;
    if(partnerKeyId){
      const key=await partnerKey(partnerKeyId,partnerKeyStamp);
      if(!key)return null;
      // Nyckel→bolag: the company comes from the key row, never from the session (null before 012).
      operatorId=keyOperator(key);
    }
    const publicSession = partnerKeyId
      ? { playerId: session.player_id, partnerKeyId, ...(partnerKeyStamp?{partnerKeyStamp}:{}), displayName: session.display_name || 'spelaren' }
      : { playerId: session.player_id, partnerKeyId: null };
    return { publicSession, expiresAt: session.expires, operatorId };
  }
  async function session(req) {
    const token=(req.headers.cookie??'').match(/(?:^|;\s*)player_session=([a-f0-9]{64})(?:;|$)/)?.[1];
    return token ? (await validatedSession(digest(token)))?.publicSession ?? null : null;
  }
  // Internal read-only transport bindings, never an HTTP session payload. Keep
  // expiry from the validated row; revalidation needs no retained bearer cookie.
  // These DB reads do not implement cancellation: callers bound their own wait.
  async function bindingById(sessionId) {
    const sessionDigest=typeof sessionId==='string' && /^player-([a-f0-9]{64})$/.exec(sessionId)?.[1];
    if(!sessionDigest)return null;
    const verified=await validatedSession(sessionDigest);
    if(!verified || !Number.isSafeInteger(verified.expiresAt) || verified.expiresAt<=0)return null;
    // Keep partner provenance explicit; new room access must not reinterpret it as native.
    // A partner binding also names its key's company (null for a key without one).
    const partnerKeyId=verified.publicSession.partnerKeyId;
    return Object.freeze({actorId:verified.publicSession.playerId,sessionId,expiresAt:verified.expiresAt,partnerKeyId,
      ...(partnerKeyId===null?{}:{operatorId:verified.operatorId})});
  }
  async function binding(req) {
    const header=req.headers.cookie;
    if(typeof header!=='string')return null;
    const cookies=header.split(';').map(value=>value.trim()).filter(value=>value.split('=',1)[0].trim()==='player_session');
    if(cookies.length!==1)return null;
    const token=/^player_session=([a-f0-9]{64})$/.exec(cookies[0])?.[1];
    return token ? bindingById('player-'+digest(token)) : null;
  }
  const user = async req => (await session(req))?.playerId ?? null;
  const cookie=(req,token,age,sameSite='Strict')=>`player_session=${token}; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=${age}${(req.socket.encrypted || process.env.NODE_ENV==='production') ? '; Secure' : ''}`;
  async function linkIdentity(existing) {
    if(!identity || !existing?.stamp || (await identity.stamp(existing.id))!==existing.stamp)throw Error('Scout session expired. Sign in again.');
    let link=(await db.prepare('SELECT player_id FROM craig_player_links WHERE craig_user_id=?').get(existing.id));
    if(!link){const p=(await createPlayer({name:existing.name}));link={player_id:p.id};(await db.prepare('INSERT INTO craig_player_links VALUES (?,?)').run(existing.id,p.id));}
    return {...link,source_stamp:`credential:${existing.stamp}`};
  }
  async function issue(req,account,maxAge=86400,sameSite='Strict') {
    const player = await db.prepare('SELECT status FROM players WHERE id=? FOR UPDATE').get(account.player_id);
    if (!player || player.status !== 'active') throw Error('Player account is unavailable');
    const token=randomBytes(32).toString('hex'),now=Date.now();
    (await db.prepare('DELETE FROM player_sessions WHERE expires<=?').run(now));
    (await db.prepare('INSERT INTO player_sessions (digest,player_id,expires,source_stamp,display_name) VALUES (?,?,?,?,?)').run(digest(token),account.player_id,now+maxAge*1000,account.source_stamp??null,account.display_name??null));
    return cookie(req,token,maxAge,sameSite);
  }
  async function fromPartner(req,claims,maxAge=21600) {
    if(typeof claims?.sub!=='string'||!claims.sub||typeof claims?.partner!=='string'||!claims.partner)throw Error('Invalid Partner launch claims.');
    const displayName=typeof claims.displayName==='string'&&claims.displayName ? claims.displayName : 'spelaren';
    return db.transaction(async () => {
      // Rotation/revocation and session issuance use the same product lock.
      // Old signed launch claims cannot establish a session after that change.
      const key=await partnerKey(claims.partner,claims.partner_key_stamp);
      if(!key)throw Error('Partner launch is unavailable');
      // Nyckel→bolag: the signed company must be the key's own. Until PR C a key without a
      // company still launches with a token without one; any other combination is refused.
      if(keyOperator(key)!==claimedOperator(claims))throw partnerRefusal(PARTNER_OPERATOR_MISMATCH);
      const stamp = claims.partner_key_stamp ? `:${claims.partner_key_stamp}` : '';
      return issue(req,{player_id:claims.sub,source_stamp:`partner:${claims.partner}${stamp}`,display_name:displayName},maxAge,'Lax');
    });
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
      try {
        if(sharedBackofficeOrigin && typeof backofficeLogout==='function')await backofficeLogout(req);
        if(token)await db.prepare('DELETE FROM player_sessions WHERE digest=?').run(digest(token));
      } catch {reply(503,{error:'Logout unavailable'});return true;}
      const secure=req.socket.encrypted || process.env.NODE_ENV==='production' ? '; Secure' : '';
      const cleared=sharedBackofficeOrigin ? [cookie(req,'',0),
        'bo_jwt=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'+secure,
        'lab_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'+secure] : cookie(req,'',0);
      reply(200,{ok:true},{'Set-Cookie':Array.isArray(cleared)?cleared:[cleared]});return true;
    }
    if(identity && req.url==='/api/auth/register'){reply(403,{error:'Use your existing Scout account. New accounts are managed in the backoffice.'});return true;}
    try {
      let raw='';for await(const part of req){raw+=part;if(raw.length>4096)throw Error('Request too large');}
      const body=JSON.parse(raw);
      if (req.url === '/api/auth/login') {
        if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).sort().join(',') !== 'email,password'
          || typeof body.email !== 'string' || !body.email.trim() || body.email.length > 254
          || typeof body.password !== 'string' || !body.password.length || body.password.length > 256) {
          reply(400,{error:'Invalid login request'}); return true;
        }
        try {
          const loginKey = await credentials.keyFor(body.email);
          if (loginBlocked(loginKey)) { reply(429,{error:'Too many attempts. Try again in 10 minutes.'}); return true; }
          const establish = async () => {
            const existing = await credentials.authenticate(body.email,body.password);
            if (!existing) return null;
            const adminCookie = existing.kind === 'craig' && existing.role === 'admin' && typeof administratorSession === 'function'
              ? await administratorSession(req,existing) : null;
            const account = existing.kind === 'craig' ? await linkIdentity(existing) : {player_id:existing.playerId,source_stamp:existing.sourceStamp};
            const header = await issue(req,account);
            return {header,adminCookie,role:existing.role};
          };
          const accepted = await db.transaction(establish);
          if (!accepted) { loginFailed(loginKey); reply(401,{error:'Username or password is incorrect.'}); return true; }
          attempts.delete(loginKey);
          const secure=req.socket.encrypted || process.env.NODE_ENV==='production' ? '; Secure' : '';
          const cleared = typeof administratorSession === 'function' && accepted.role === 'player'
            ? [`bo_jwt=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,`lab_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`] : [];
          reply(200,{ok:true},{'Set-Cookie':accepted.adminCookie ? [accepted.header,accepted.adminCookie] : cleared.length ? [accepted.header,...cleared] : accepted.header});
        } catch { reply(503,{error:'Authentication unavailable'}); }
        return true;
      }
      if(localAccount) {
        const username=String(body.username??'').trim().toLowerCase(), password=body.password;
        const registering=req.url.endsWith('/register');
        if(!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username) || typeof password!=='string' || password.length<(registering?12:1) || password.length>128)throw Error('Use a username of 3–32 letters/numbers and a password of 12–128 characters when creating an account.');
        // A separate namespace cannot shadow a Scout/CRAIG operator identity.
        const key=`username:${username}`;
        const loginKey=registering ? `player:${key}` : await credentials.keyFor(username);
        if(!registering && loginBlocked(loginKey)){reply(429,{error:'Too many attempts. Try again in 10 minutes.'});return true;}
        let account=(await db.prepare('SELECT * FROM player_accounts WHERE email=?').get(key));
        if(registering) {
          if(identity && (await identity.candidates(username)).length)throw Error('Account unavailable. Try signing in.');
          if(account)throw Error('Account unavailable. Try signing in.');
          const salt=randomBytes(16).toString('hex'), hash=scryptSync(password,salt,64).toString('hex');
          const header = await db.transaction(async () => {
            const player=(await createPlayer({name:username}));
            (await db.prepare('INSERT INTO player_accounts VALUES (?,?,?,?)').run(key,player.id,salt,hash));
            account={player_id:player.id,salt,hash};
            return issue(req,{...account,source_stamp:accountStamp(account)});
          });
          attempts.delete(loginKey);
          reply(200,{ok:true},{'Set-Cookie':header});
        } else {
          const computed=scryptSync(password,account?.salt??'invalid-account',64);
          if(!account||!timingSafeEqual(computed,Buffer.from(account.hash,'hex'))){loginFailed(loginKey);throw Error('Username or password is incorrect.');}
          const header=await db.transaction(() => issue(req,{...account,source_stamp:accountStamp(account)}));
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
      const loginKey=identity ? `craig:${(await identity.find(email))?.id??`unknown:${email}`}` : `email:${email}`;
      if(req.url==='/api/auth/login' && loginBlocked(loginKey)){reply(429,{error:'Too many attempts. Try again in 10 minutes.'});return true;}
      let account=(await db.prepare('SELECT * FROM player_accounts WHERE email=?').get(email));
      if(identity){
        const existing=(await identity.authenticate(email,password));
        if(!existing){loginFailed(loginKey);throw Error('Email, username or password is incorrect.');}
        account=await db.transaction(() => linkIdentity(existing));
      }else if(req.url==='/api/auth/register') {
        if(account)throw Error('Account unavailable. Try signing in.');
        const salt=randomBytes(16).toString('hex'), hash=scryptSync(password,salt,64).toString('hex');
        account=await db.transaction(async () => {
          const p=(await createPlayer({name:email.split('@')[0]}));
          (await db.prepare('INSERT INTO player_accounts VALUES (?,?,?,?)').run(email,p.id,salt,hash));
          return {player_id:p.id};
        });
      }else {
        const computed=scryptSync(password,account?.salt??'invalid-account',64);
        if(!account||!timingSafeEqual(computed,Buffer.from(account.hash,'hex'))){loginFailed(loginKey);throw Error('Email or password is incorrect.');}
      }
      const header=await db.transaction(() => issue(req,account));
      attempts.delete(loginKey);
      reply(200,{ok:true},{'Set-Cookie':header});
    }catch(e){reply(400,{error:e.message});}
    return true;
  }
  return {user,session,binding,bindingById,handle,fromPartner,partnerAllowed};
}
