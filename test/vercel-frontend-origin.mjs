import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { scryptSync } from 'node:crypto';
import { once } from 'node:events';
import { copyFile, mkdir, mkdtemp, readdir, rm, symlink } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { copyOpenClawRuntime } from './fixtures/copy-openclaw-runtime.mjs';

const game='https://game.example.test';
const frontend='https://preview.example.vercel.app';
const password='Synthetic-Proxy-Test-Password';

async function fixture(t) {
  const root=await mkdtemp(join(tmpdir(),'croupier-vercel-origin-'));
  const webDir=join(root,'web'),dataDir=join(root,'data');
  let child;
  t.after(async()=>{
    if(child && child.exitCode===null){const stopped=once(child,'exit');child.kill();await stopped;}
    await rm(root,{recursive:true,force:true});
  });
  await mkdir(webDir);
  await mkdir(dataDir);
  await copyOpenClawRuntime(root);
  const source=new URL('../web/',import.meta.url);
  for(const file of await readdir(source))if(file.endsWith('.mjs'))await copyFile(new URL(file,source),join(webDir,file));
  await symlink(new URL('public',source),join(webDir,'public'),process.platform==='win32'?'junction':'dir');
  const craig=new DatabaseSync(join(dataDir,'craig.db'));
  try{
    craig.exec('CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT UNIQUE,email TEXT,salt TEXT,hash TEXT,role TEXT,created_at TEXT)');
    const salt='isolated-proxy-salt';
    craig.prepare('INSERT INTO users VALUES (?,?,?,?,?,?,?)').run(1,'pilot-reader','reader@example.invalid',salt,
      scryptSync(password,salt,64).toString('hex'),'reader',new Date().toISOString());
  }finally{craig.close();}
  const socket=createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');
  const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
  async function start(extra={}){
    child=spawn(process.execPath,[join(webDir,'server.mjs')],{cwd:webDir,windowsHide:true,
      env:{PATH:process.env.PATH??process.env.Path??'',NODE_ENV:'production',HOST:'127.0.0.1',PORT:String(port),
        PUBLIC_URL:game,BO_URL:game,LAB_PUBLIC_URL:game,CROUPIER_CLOUD_LAYOUT:'single-origin',
        CROUPIER_CLOUD_RUNTIME:'1',CROUPIER_DATA_DIR:dataDir,...extra},stdio:['ignore','pipe','pipe']});
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('isolated Web fixture did not start')),10000);
      const fail=()=>{clearTimeout(timer);reject(Error('isolated Web fixture exited before ready'));};
      child.once('error',fail);child.once('exit',fail);
      child.stdout.on('data',chunk=>{
        if(String(chunk).includes('croupier demo on')){
          clearTimeout(timer);child.off('error',fail);child.off('exit',fail);resolve();
        }
      });
    });
  }
  async function stop(){
    if(child && child.exitCode===null){const stopped=once(child,'exit');child.kill();await stopped;}
    child=undefined;
  }
  function request(path,{method='GET',host=new URL(game).host,origin,site,cookie='',body}={}){
    return new Promise((resolve,reject)=>{
      const headers={Host:host,...(origin?{Origin:origin}:{}),...(site?{'Sec-Fetch-Site':site}:{}),
        ...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})};
      const req=httpRequest(`http://127.0.0.1:${port}${path}`,{method,headers},res=>{
        const chunks=[];res.on('data',chunk=>chunks.push(chunk));
        res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks).toString('utf8')}));
      });
      req.on('error',reject);req.end(body?JSON.stringify(body):undefined);
    });
  }
  return {start,stop,request};
}

test('opt-in Vercel Origin permits player POSTs with the observed Preview Host and keeps cookies host-only',async t=>{
  const f=await fixture(t);
  const login={email:'pilot-reader',password};
  const post=(path,body,options={})=>f.request(path,{method:'POST',body,origin:frontend,site:'same-origin',...options});
  await f.start({CROUPIER_VERCEL_FRONTEND_ORIGIN:frontend});
  assert.equal((await post('/api/auth/login',login,{origin:'https://evil.example.test'})).status,403);
  assert.equal((await post('/api/auth/login',login,{origin:`${frontend}/path`})).status,403);
  assert.equal((await post('/api/auth/login',login,{host:'attacker.invalid'})).status,403);
  assert.equal((await post('/api/auth/login',login,{site:'cross-site'})).status,403);
  const signedIn=await post('/api/auth/login',login);
  assert.equal(signedIn.status,200);
  assert.equal((await post('/api/auth/login',login,{host:new URL(frontend).host})).status,200,
    'Vercel external rewrite forwards its Preview Host');
  assert.equal((await post('/api/auth/login',login,{host:new URL(frontend).host,site:'cross-site'})).status,403);
  const setCookie=signedIn.headers['set-cookie']?.[0]??'';
  assert.match(setCookie,/^player_session=[a-f0-9]{64}/);
  assert.match(setCookie,/; HttpOnly; SameSite=Strict;/);
  assert.match(setCookie,/; Secure/);
  assert.doesNotMatch(setCookie,/; Domain=/i);
  assert.equal(signedIn.headers.location,undefined,'password login never redirects to Render');
  const cookie=setCookie.split(';')[0];
  const state=await post('/api/table',{op:'state'},{cookie});
  assert.equal(state.status,200,'authenticated game POST accepts the trusted preview origin');
  assert.equal((await post('/api/table',{op:'state'},{cookie,origin:'https://evil.example.test'})).status,403);
  assert.equal((await post('/api/table',{op:'state'},{cookie,host:new URL(frontend).host})).status,200);
  assert.equal((await post('/api/table',{op:'state'},{cookie,host:'attacker.invalid'})).status,403);
  assert.equal((await post('/api/bo/login',{user:'pilot-reader',pass:password})).status,403,
    'trusted Vercel player origin never crosses the stricter BO POST origin gate');
  const boStart=await f.request('/api/auth/bo/start?next=%2F',{host:new URL(game).host});
  assert.equal(boStart.status,303);
  assert.match(boStart.headers.location??'',new RegExp(`^${game}/api/bo/game-login\\?state=`));
  assert.equal((await f.request('/api/auth/bo/start',{host:new URL(frontend).host})).status,400);
  const logout=await post('/api/auth/logout',{}, {cookie});
  assert.equal(logout.status,200);
  assert.match(logout.headers['set-cookie']?.[0]??'',/Max-Age=0/);
  assert.equal((await f.request('/api/auth/session',{cookie})).body.includes('"authenticated":false'),true);
  await f.stop();
  await f.start();
  assert.equal((await post('/api/auth/login',login)).status,403,'default configuration does not trust Vercel');
  assert.equal((await post('/api/auth/login',login,{origin:game})).status,200,'Render origin still works');
});
