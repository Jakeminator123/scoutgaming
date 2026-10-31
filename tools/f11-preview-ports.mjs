// Live I/O is constructed only by the explicit --run path. No Render/Vercel
// credential or deployment port; provider API receipts arrive in a private file.
import { createRequire } from 'node:module';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { F11_TARGET, F11_MONEY_SQL } from './shared-room-f11-observer.mjs';

const need=(yes,code)=>{if(!yes)throw Object.assign(Error(`f11_${code}`),{code:`f11_${code}`});};
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);

export function validateF11DatabaseUrl(value) {
  let url;try{url=new URL(value);}catch{need(false,'database_target_invalid');}
  const host=F11_TARGET.databaseHost,pooler=host.replace('.c-','-pooler.c-');
  need(['postgres:','postgresql:'].includes(url.protocol) && [host,pooler].includes(url.hostname)
    && (!url.port||url.port==='5432') && url.pathname===`/${F11_TARGET.database}` && url.username && url.password
    && !url.hash && ['require','verify-full'].includes(url.searchParams.get('sslmode'))
    && [...url.searchParams.keys()].every(key=>['sslmode','channel_binding'].includes(key)), 'database_target_invalid');
  // Do not let pg's sslmode compatibility replace certificate verification.
  url.search='';return url.href;
}

export function f11ProviderReceipt(row,plan,now) {
  const s=row?.service,d=row?.deployment,v=row?.vercel;
  need(row?.source==='provider-api-capture' && Number.isSafeInteger(row.at) && row.at<=now && now-row.at<=60000
    && s?.id===plan.serviceId && s.branch==='preview' && s.suspended==='not_suspended' && s.serviceDetails?.url===plan.engineOrigin
    && d?.serviceId===plan.serviceId && /^dep-[a-z0-9]+$/.test(d.id) && d.status==='live' && d.commit?.id===plan.sha
    && typeof v?.id==='string' && v.projectId===plan.projectId && v.readyState==='READY' && v.meta?.githubCommitSha===plan.sha,
  'provider_receipt_invalid');
  return {...F11_TARGET,source:'provider-api',engineSha:d.commit.id,vercelSha:v.meta.githubCommitSha,
    ready:true,suspended:false,healthStatus:200,deployId:d.id};
}

export async function createF11LivePorts({run=false,plan,credentials,outputDirectory,provenanceFile,progress=()=>{}}={}) {
  need(run===true,'explicit_run_required');
  need(plan&&Object.entries(F11_TARGET).every(([key,value])=>plan[key]===value),'target_mismatch');
  need(object(credentials) && Object.keys(credentials).every(key=>['admin','databaseUrl'].includes(key))
    && typeof credentials.admin?.user==='string' && credentials.admin.user.length>0 && credentials.admin.user.length<=254
    && typeof credentials.admin?.pass==='string' && credentials.admin.pass.length>0 && credentials.admin.pass.length<=256,'credentials_invalid');
  const connectionString=validateF11DatabaseUrl(credentials.databaseUrl);
  need(typeof outputDirectory==='string' && typeof provenanceFile==='string','paths_required');
  const directory=resolve(outputDirectory),provenance=resolve(provenanceFile);
  need(!provenance.startsWith(`${directory}\\`)&&!provenance.startsWith(`${directory}/`),'paths_invalid');
  // Existing locked dependencies; no install or package modification at runtime.
  const {Pool}=createRequire(new URL('../services/game/package.json',import.meta.url))('pg');
  const WebSocket=createRequire(new URL('../services/astrid-gpu-worker/gateway/package.json',import.meta.url))('ws');
  await mkdir(directory,{mode:0o700}); // exclusive: EEXIST is a refusal, never overwrite somebody's output
  const pool=new Pool({connectionString,ssl:{rejectUnauthorized:true},max:1,connectionTimeoutMillis:5000,
    statement_timeout:5000,query_timeout:6000,idleTimeoutMillis:5000,options:'-c default_transaction_read_only=on'});
  const cookies=new Map(),revokedCookies=new Map(),ownedSockets=new Set(),saved=new Set();
  let firstDeploy=null,closed=false;
  pool.on('error',()=>{}); // never echo a connection string/provider exception

  async function records() {
    need((await stat(provenance)).size<=8*1024*1024,'provenance_too_large');
    const lines=(await readFile(provenance,'utf8')).split(/\r?\n/);
    // An append may be in progress: only complete NDJSON records are authoritative.
    lines.pop();return lines.filter(line=>line.trim()).map(line=>JSON.parse(line));
  }
  async function readTransaction(work) {
    const client=await pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const target=(await client.query("SELECT current_database() AS database, current_setting('transaction_read_only') AS readonly")).rows[0];
      need(target.database===plan.database&&target.readonly==='on','database_target_invalid');
      return await work(client);
    } finally {try{await client.query('ROLLBACK');}finally{client.release();}}
  }
  async function response(url,options={}) {
    const res=await fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(10000)});
    const chunks=[];let size=0;
    for await(const part of res.body??[]) {size+=part.length;need(size<=1024*1024,'response_too_large');chunks.push(part);}
    let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{body=null;}
    return {status:res.status,headers:res.headers,body};
  }
  async function request(actor,method,path,body,keepCookie=true) {
    const url=new URL(path,plan.origin);
    need(url.origin===plan.origin && !url.hash && ['GET','POST'].includes(method),'request_target_invalid');
    const res=await response(url,{method,headers:{Origin:plan.origin,Accept:'application/json',
      ...(body?{'Content-Type':'application/json'}:{}),...(cookies.get(actor)?{Cookie:cookies.get(actor)}:{})},
      ...(body?{body:JSON.stringify(body)}:{})});
    if(keepCookie) {
      const allowed=actor==='admin'?'bo_jwt':'player_session';
      for(const value of res.headers.getSetCookie()) {
        const pair=value.split(';')[0];if(pair.startsWith(`${allowed}=`))cookies.set(actor,pair);
      }
    }
    return {status:res.status,body:res.body};
  }
  async function socket(index,roomId,callbacks,negative=false) {
    need(index===0||index===1,'actor_invalid');
    need(/^[a-z0-9_-]{1,128}$/.test(roomId),'room_invalid');
    const jar=negative&&revokedCookies.has(index)?revokedCookies.get(index):cookies.get(index);
    need(typeof jar==='string'&&jar.startsWith('player_session='),'session_required');
    const ws=new WebSocket(`${plan.origin.replace('https:','wss:')}/shared-room/${roomId}`,{
      origin:plan.origin,headers:{Cookie:jar},followRedirects:false,handshakeTimeout:5000,maxPayload:256*1024,perMessageDeflate:false});
    ownedSockets.add(ws);
    let opened=false,completed=false,timer;
    const close=()=>new Promise(resolveClose=>{
      if(ws.readyState===WebSocket.CLOSED){resolveClose();return;}
      const deadline=setTimeout(()=>{ws.terminate();resolveClose();},1000);
      ws.once('close',()=>{clearTimeout(deadline);resolveClose();});
      if(ws.readyState===WebSocket.OPEN)ws.close(1000);else ws.terminate();
    });
    return new Promise((resolveOpen,reject)=>{
      const rejectSafe=()=>{if(completed)return;completed=true;clearTimeout(timer);ws.terminate();reject(Object.assign(Error('f11_socket_failed'),{code:'f11_socket_failed'}));};
      timer=setTimeout(rejectSafe,6000);
      ws.once('upgrade',res=>{try{if(!negative)callbacks.identity(res.headers['x-croupier-room-instance']);}catch{rejectSafe();}});
      ws.once('open',()=>{opened=true;clearTimeout(timer);if(!completed){completed=true;resolveOpen({close});}callbacks.open?.();});
      ws.on('message',data=>{try{callbacks.frame(JSON.parse(data.toString()));}catch{rejectSafe();ws.terminate();}});
      ws.once('unexpected-response',(_req,res)=>{res.resume();callbacks.rejected?.(res.statusCode);rejectSafe();});
      ws.on('error',()=>{if(!opened)rejectSafe();});
      ws.once('close',code=>{clearTimeout(timer);ownedSockets.delete(ws);callbacks.close(code);if(!opened)rejectSafe();});
    });
  }
  const ports={now:Date.now,sleep,progress:value=>progress(JSON.stringify(value)),
    async provider() {
      const until=Date.now()+(firstDeploy?60000:0);let found;
      do {
        for(const row of (await records()).filter(row=>row.source==='provider-api-capture').reverse()) {
          try{const value=f11ProviderReceipt(row,plan,Date.now());if(!firstDeploy||value.deployId!==firstDeploy){found=value;break;}}catch{}
        }
        if(!found&&Date.now()<until)await sleep(1000);
      }while(!found&&Date.now()<until);
      need(found,'provider_receipt_required');
      const health=await response(`${plan.engineOrigin}/__cloud/health`);need(health.status===200,'health_failed');
      firstDeploy??=found.deployId;return found;
    },
    async inspect(_plan,identity) {
      return readTransaction(async client=>{
        const scope=[plan.environment,plan.workspaceId];
        const docs=(await client.query('SELECT kind,value FROM croupier_studio.documents WHERE environment_id=$1 AND workspace_id=$2 AND kind=ANY($3::text[])',[...scope,['project','administration']])).rows;
        const project=docs.find(row=>row.kind==='project')?.value,administration=docs.find(row=>row.kind==='administration')?.value;
        need(project&&administration,'source_required');
        const source=project.lanes?.find(row=>row.id===plan.sourceLaneId),dealer=source?.layers?.dealer?.default;
        const laneId=`room-lane-${hash([plan.sourceLaneId,dealer]).slice(0,24)}`;
        const lane=administration.gameLanes?.find(row=>row.id===laneId);
        const sourceReady=typeof dealer==='string'&&lane?.schemaVersion===1&&lane.renderer==='portrait-video'
          && lane.dealer===dealer&&lane.mediaCollection===`${dealer}-presentation`;
        const operators=(await client.query('SELECT operator_id,status FROM croupier_studio.operators WHERE environment_id=$1 AND workspace_id=$2 AND (operator_id=$3 OR slug=$3)',[...scope,identity.operatorId])).rows;
        const packs=(await client.query('SELECT package_revision,tables::jsonb AS tables FROM croupier_studio.operator_packages WHERE environment_id=$1 AND workspace_id=$2 AND (operator_id=$3 OR tables::jsonb ? $4)',[...scope,identity.operatorId,identity.roomId])).rows;
        const accounts=(await client.query(`SELECT p.id AS "actorId",p.name AS username,p.created_at AS "createdAt",p.status,
          (p.balance*100)::bigint AS "balanceCents",a.email FROM croupier_game.players p LEFT JOIN croupier_game.player_accounts a ON a.player_id=p.id
          WHERE p.name=ANY($1::text[]) OR a.email=ANY($2::text[])`,[identity.usernames,identity.usernames.map(name=>`username:${name}`)])).rows;
        const authCount=Number((await client.query('SELECT count(*) FROM croupier_auth.users WHERE username=ANY($1::text[])',[identity.usernames])).rows[0].count);
        const configs=(await client.query('SELECT c.version,c.body::jsonb AS body FROM croupier_game.shared_table_configs c WHERE c.room_id=$1',[identity.roomId])).rows;
        const head=(await client.query('SELECT version FROM croupier_game.shared_table_config_heads WHERE room_id=$1',[identity.roomId])).rows[0];
        const rooms=(administration.rooms??[]).filter(row=>row.id===identity.roomId||row.operatorId===identity.operatorId);
        const rest={...administration,rooms:(administration.rooms??[]).filter(row=>!rooms.includes(row))};
        const absent={operators:operators.length,accounts:accounts.length+authCount,rooms:rooms.length+configs.length,packages:packs.length};
        for(const account of accounts) {
          need(account.email===`username:${account.username}`,'account_namespace_invalid');delete account.email;
          account.createdAt=Date.parse(account.createdAt);account.balanceCents=Number(account.balanceCents);
          account.openings=(await client.query(`SELECT id::text,type,(amount*100)::bigint AS "amountCents",currency,at,
            source_key AS "sourceKey",source_fingerprint AS fingerprint FROM croupier_game.transactions WHERE player_id=$1 ORDER BY id`,[account.actorId])).rows
            .map(row=>({...row,amountCents:Number(row.amountCents)}));
        }
        if(rooms.length)need(operators.length===1&&operators[0].operator_id===identity.operatorId&&operators[0].status==='active'
          && packs.length===1&&packs[0].tables.length===1&&packs[0].tables[0]===identity.roomId
          && configs.length===1&&head?.version===configs[0].version&&configs[0].body.operatorId===identity.operatorId,'fixture_readback_invalid');
        return {at:Date.now(),database:plan.database,absent,sourceReady,unchangedHash:hash([project,rest]),room:rooms[0],roomCount:rooms.length,
          packageRevision:packs.length===1?Number(packs[0].package_revision):null,configVersion:head?.version,accounts};
      });
    },
    async adminLogin() {
      const res=await request('admin','POST','/studio/api/auth/login',{user:credentials.admin.user,pass:credentials.admin.pass,returnTo:'/admin'});
      need(res.status===200&&res.body?.ok&&cookies.get('admin'),'admin_login_failed');
    },
    async http(actor,method,path,body) {
      need(actor==='admin' && ((method==='POST'&&path==='/studio/api/admin/operator-create'&&body?.slug===plan.runId&&body?.name===plan.runId)
        || new URL(path,plan.origin).pathname==='/studio/api/admin/presentation-room' && ['GET','POST'].includes(method)
          && (method==='GET'?new URL(path,plan.origin).searchParams.get('operatorId'):body?.operatorId)===plan.runId),'mutation_scope_invalid');
      const res=await request(actor,method,path,body);need(res.status===200,'fixture_api_failed');return res.body;
    },
    async register(index,username) {
      need((index===0||index===1)&&username===`${plan.runId}-${index?'b':'a'}`&&!cookies.has(index),'registration_scope_invalid');
      const result=await request(index,'POST','/api/auth/player/register',{username,password:randomBytes(32).toString('hex')});
      need(result.status===200&&result.body?.ok&&cookies.get(index),'registration_failed');
      const player=await request(index,'POST','/api/player',{});need(player.status===200&&player.body?.name===username,'player_identity_invalid');return {id:player.body.id};
    },
    socket,
    command:(index,roomId,body)=>request(index,'POST',`/api/shared-room/${roomId}/command`,body),
    money:(roomId,actors)=>readTransaction(async client=>(await client.query(F11_MONEY_SQL,[roomId,actors])).rows[0]),
    async revoke(index) {
      need(index===1&&cookies.get(index),'revocation_scope_invalid');revokedCookies.set(index,cookies.get(index));
      const res=await request(index,'POST','/api/auth/logout',{});need(res.status===200&&res.body?.ok,'session_revocation_failed');
    },
    async negative(index,roomId) {
      let stateFrames=0,status=null,connection;
      const captured=socket(index,roomId,{frame:value=>{if(value?.type==='shared-room-state')stateFrames++;},
        close:code=>{status??=code;},rejected:code=>{status=code;}},true).then(value=>{connection=value;},()=>{});
      await captured;
      if(connection) {const until=Date.now()+2000;while(status===null&&Date.now()<until)await sleep(50);await connection.close();}
      return {connectionId:randomUUID(),status,stateFrames};
    },
    async provenance(connection) {
      const until=Date.now()+30000;
      do {
        const row=(await records()).find(row=>{
          if(row.source!=='render-api-capture')return false;
          try {const message=JSON.parse(row.log?.message);return message.processId===connection.processId&&message.socketNonce===connection.nonce;}catch{return false;}
        });
        if(row)return row;
        await sleep(500);
      }while(Date.now()<until);
      need(false,'socket_provenance_missing');
    },
    async save(name,value) {
      need(['creation.json','ownership.json','connections.json','manifest.json','capture.ndjson','review.json'].includes(name),'artifact_name_invalid');
      const data=name.endsWith('.ndjson')?value.map(row=>JSON.stringify(row)).join('\n')+'\n':JSON.stringify(value,null,2)+'\n';
      await writeFile(join(directory,name),data,{mode:0o600,flag:saved.has(name)?'w':'wx'});saved.add(name);
    },
    async close() {
      if(closed)return;closed=true;
      for(const ws of ownedSockets)ws.terminate();ownedSockets.clear();cookies.clear();revokedCookies.clear();
      credentials=null;await pool.end();
    },
  };
  return ports;
}
