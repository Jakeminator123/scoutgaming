import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { partnerLoginReturnTo } from '../lib/partner-login-return.mjs';
import { studioLoginReturnTo } from '../lib/studio-login-client.mjs';
import { handlePartnerAuth, internalSessionPresent } from '../lib/partner-session.mjs';
import { partnerWorkspaceInitialData } from '../lib/partner-data.mjs';
import { resolveWorkspaceSurfacePath } from '../lib/workspace-surfaces.mjs';
import { nextStudioLoginRedirect } from '../lib/next-page-navigation.mjs';
import { controlToolPath } from '../lib/control-workspace.mjs';
import { publicAbsoluteUrl } from '../lib/lab-url.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');
const sourceUrl = new URL('../components/partner-login.tsx', import.meta.url);

function loadPartnerLogin(overrides = {}, globals = {}) {
  const output = transformSync(readFileSync(sourceUrl, 'utf8'), {
    filename: fileURLToPath(sourceUrl),
    jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } },
    module: { type: 'commonjs' },
  });
  const module = { exports: {} };
  vm.runInNewContext(output.code, {
    module, exports: module.exports, ...globals,
    require: name => {
      if (Object.hasOwn(overrides, name)) return overrides[name];
      if (name.endsWith('.module.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
      return require(name);
    },
  });
  return module.exports;
}

const { PartnerLogin, internalLoginHref } = loadPartnerLogin();

function loadLoginPage(authBase) {
  const file = new URL('../app/partner/login/page.tsx', import.meta.url);
  const {code} = transformSync(readFileSync(file,'utf8'),{filename:fileURLToPath(file),
    jsc:{parser:{syntax:'typescript',tsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
  const module={exports:{}}, overrides={
    '@/components/partner-login':{PartnerLogin},
    '@/lib/partner-login-return.mjs':{partnerLoginReturnTo},
    '@/lib/studio-native-runtime.mjs':{nativeStudioAdminEnabled:()=>true,
      nativeStudioAdminConfiguration:()=>({apiBase:authBase.replace('/partner','/admin')})},
  };
  vm.runInNewContext(code,{module,exports:module.exports,require:name=>Object.hasOwn(overrides,name)?overrides[name]:require(name)});
  return module.exports.default;
}

const safeReturns = [
  ['/partner','/partner'], ['/studio/partner/north','/partner/north'],
  ['/partner/north/overview','/partner/north'], ['/partner/north/team','/partner/north/team'],
  ['/partner/north/rooms?room=room-7','/partner/north/rooms?room=room-7'],
  ['/studio/partner/north/tables?room=room-7','/partner/north/rooms?room=room-7'],
];
const rejectedReturns = [undefined, [' /partner'], ['/partner/north','/partner/south'],
  'https://outside.invalid/partner/north','//outside.invalid/partner/north','javascript:alert(1)',
  '/\\outside.invalid','/partner/login','/studio/partner/login','/partner/set-password',
  '/partner/logout','/admin','/control','/partner/north/api/secret','/partner/north/../south',
  '/%2foutside.invalid','%2Fpartner%2Fnorth','%252F%252Foutside.invalid',
  '/partner/%6eorth','/partner/north/rooms?room=%72oom-7','/partner/north/rooms?room=%252foutside',
  '/partner/north/rooms?room=room-7&room=other','/partner/north/rooms?room=room-7&token=secret',
  '/partner/north/rooms?room=room-7#other','/partner/north/rooms?room=room-7?next=outside',
  '/partner/north/team?room=room-7','/partner/north/rooms?room=','/partner/north/rooms?room=../other',
  '/partner/north/rooms?room='+'a'.repeat(65),'/partner/north\r\nLocation: https://outside.invalid',
];

test('partner returns allow only canonical documents and one actual room selector',()=>{
  for(const [input,expected] of safeReturns) assert.equal(partnerLoginReturnTo(input),expected,String(input));
  for(const input of rejectedReturns) assert.equal(partnerLoginReturnTo(input),'/partner',String(input));
});

test('the real login page and N1 link preserve safe return context and reject unsafe or repeated parameters',async()=>{
  for(const authBase of ['/api/partner','/studio/api/partner']){
    const Page=loadLoginPage(authBase);
    for(const [input,expected] of [...safeReturns,...rejectedReturns.map(input=>[input,'/partner'])]){
      const tree=await Page({searchParams:Promise.resolve({returnTo:input})});
      assert.equal(tree.props.authBase,authBase);assert.equal(tree.props.returnTo,expected);
      const login=new URL(internalLoginHref(authBase,input),'https://fixture.invalid');
      assert.equal(login.pathname,authBase.startsWith('/studio/')?'/studio/login':'/login');
      assert.equal(login.searchParams.get('returnTo'),expected);assert.equal(login.searchParams.size,1);
      assert.equal(studioLoginReturnTo(login.searchParams.get('returnTo')),expected);
    }
  }
});

test('internal administrators are sent to the N1 login with a return to /partner', () => {
  assert.equal(internalLoginHref('/studio/api/partner'), '/studio/login?returnTo=%2Fpartner');
  assert.equal(internalLoginHref('/api/partner'), '/login?returnTo=%2Fpartner');
  for (const authBase of ['/studio/api/partner', '/api/partner']) {
    const html = renderToStaticMarkup(React.createElement(PartnerLogin, { authBase }));
    assert.ok(html.includes(`href="${internalLoginHref(authBase).replace(/&/g, '&amp;')}"`), html);
    assert.match(html, /Logga in som intern administratör/);
    assert.ok(html.includes(`action="${authBase}/login"`), 'the operator form still posts to the partner login');
  }
});

test('successful partner login retains the requested company and actual room for both API bases', async () => {
  const returnTo = '/partner/north/rooms?room=room-7';
  for (const authBase of ['/api/partner', '/studio/api/partner']) {
    const calls = [], destinations = [];
    class Input { value = 'isolated-password'; }
    const password = new Input();
    const loaded = loadPartnerLogin({react:{...React,useState:initial=>[initial,()=>{}]}}, {
      FormData: class {get(key) {return key === 'user' ? 'north-staff' : 'isolated-password';}},
      HTMLInputElement: Input,
      fetch: async (...args) => {calls.push(args);return {ok:true};},
      window: {location:{assign:target=>destinations.push(target)}},
    });
    const all = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(all) : [node,...all(node.props?.children)];
    const form = all(loaded.PartnerLogin({authBase,returnTo})).find(node=>node.type==='form');
    form.props.onSubmit({preventDefault(){},currentTarget:{elements:{namedItem:()=>password}}});
    await new Promise(resolve=>setImmediate(resolve));
    assert.deepEqual(destinations,[returnTo]);
    assert.equal(password.value,'');
    assert.equal(calls[0][0],authBase+'/login');
    assert.equal(calls[0][1].credentials,'same-origin');
    assert.deepEqual(JSON.parse(calls[0][1].body),{user:'north-staff',pass:'isolated-password'});
  }
});

test('the failed-login notice stays generic and does not reveal the account role', () => {
  const source = readFileSync(sourceUrl, 'utf8');
  const notice = source.match(/status === 401 \|\| status === 400\) return '([^']+)'/);
  assert.ok(notice, 'the 401/400 notice is defined');
  assert.match(notice[1], /^Inloggningen kunde inte verifieras\./);
  assert.doesNotMatch(notice[1], /\b(admin\w*|roll|role)\b/i);
});

const browserModule = process.env.CROUPIER_BROWSER_FIXTURE_MODULE;

// The actual form, page, surface redirect and session handlers run against a
// loopback HTTP fixture with in-memory records. The destination receipt exposes
// the real server component props; it does not claim full Partner UI acceptance.
test('actual browser partner login returns to the authorized operator and room with a purpose-bound cookie', {skip:!browserModule}, async () => {
  const {chromium} = await import(pathToFileURL(browserModule).href);
  const {DatabaseSync} = await import('node:sqlite');
  const {scryptSync} = await import('node:crypto');
  const {createServer} = await import('node:http');
  const {once} = await import('node:events');
  const {build} = await import('esbuild');
  const redirects = require('next/dist/client/components/redirect.js');
  const navigation = {...redirects,notFound:require('next/dist/client/components/not-found.js').notFound};
  const bundle = (await build({absWorkingDir:fileURLToPath(new URL('../',import.meta.url)),write:false,bundle:true,format:'iife',
    define:{'process.env.NODE_ENV':'"production"'},stdin:{resolveDir:fileURLToPath(new URL('../',import.meta.url)),loader:'tsx',
      contents:'import React from "react";import {createRoot} from "react-dom/client";import {PartnerLogin} from "./components/partner-login";createRoot(document.getElementById("root")).render(React.createElement(PartnerLogin,JSON.parse(document.getElementById("props").textContent)));'},
    plugins:[{name:'fixture-css',setup(plugin){plugin.onLoad({filter:/\.module\.css$/},()=>({contents:'export default {}',loader:'js'}));}}],
  })).outputFiles[0].text;
  const origin = 'https://partner.fixture.invalid', password = 'Isolated-Partner-Return-Only';
  const target = '/partner/north/rooms?room=room-7';
  const browser = await chromium.launch({headless:true,...(process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL?{channel:process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL}:{})});
  try {
    for (const prefix of ['', '/studio']) {
      const bo = new DatabaseSync(':memory:'), game = new DatabaseSync(':memory:');
      const context = await browser.newContext(), failures = [], posts = [], receipts = [];
      let server;
      try {
        bo.exec('CREATE TABLE users(id TEXT PRIMARY KEY,username TEXT,email TEXT,role TEXT,salt TEXT,hash TEXT); CREATE TABLE bo_auth_epochs(user_id TEXT PRIMARY KEY,epoch INTEGER); CREATE TABLE lab_sessions(token_digest TEXT PRIMARY KEY,craig_user_id TEXT,role TEXT,source_stamp TEXT,auth_epoch INTEGER,expires INTEGER);');
        game.exec('CREATE TABLE player_accounts(email TEXT,player_id TEXT,salt TEXT,hash TEXT);');
        bo.prepare('INSERT INTO users VALUES (?,?,?,?,?,?)').run('42','north-staff','north@fixture.invalid','partner','fixture-salt',scryptSync(password,'fixture-salt',64).toString('hex'));
        bo.prepare('INSERT INTO bo_auth_epochs VALUES (?,?)').run('42',2);
        const adapter = db => ({prepare:sql=>db.prepare(sql.replace(/ FOR UPDATE\b/g,'')),transaction:async work=>{
          db.exec('BEGIN IMMEDIATE');try{const result=await work();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}
        }});
        const scope={environment:'fixture',workspaceId:'croupier'};
        const north={id:'operator-north',slug:'north',name:'North fixture',status:'active',scope};
        const south={id:'operator-south',slug:'south',name:'South fixture',status:'active',scope};
        const role={id:'north-role',operatorId:north.id,scope,permissions:['overview.read','tables.read']};
        const membership={userId:'42',operatorId:north.id,roleId:role.id,status:'active',scope};
        const store={listOperators:async()=>[north,south],getOperatorBySlug:async slug=>[north,south].find(item=>item.slug===slug),
          getMembership:async(operatorId,userId)=>operatorId===north.id&&userId==='42'?membership:null,
          getRole:async(operatorId,roleId)=>operatorId===north.id&&roleId===role.id?role:null,
          resolvePartnerContext:async({account,operatorSlug})=>account.userId==='42'&&operatorSlug==='north'
            ?{account:{...account,status:'active'},scope,operator:north,membership,role}:null,
          getCurrentPackage:async operatorId=>{assert.equal(operatorId,north.id);return {operatorId,package_revision:3,
            lanes:[{id:'composition-2',name:'Composition fixture',dealer:'astrid'}],
            tables:[{id:'room-7',name:'North room',game:'blackjack',presentationId:'composition-2'}]};},
        };
        const authBase=prefix+'/api/partner';
        const config={boDb:adapter(bo),gameDb:adapter(game),scope,store,allowedOrigins:[origin,'https://studio.fixture.invalid'],publicHosts:['partner.fixture.invalid','studio.fixture.invalid'],
          apiBase:prefix+'/api/admin',authBase:prefix+'/api/auth',rateLimit:async()=>true,clientAddress:async()=> 'fixture-partner'};
        const LoginPage=loadLoginPage(authBase);
        const surfaceSource=new URL('../app/control/surface-page.tsx',import.meta.url);
        const surfaceCode=transformSync(readFileSync(surfaceSource,'utf8'),{filename:fileURLToPath(surfaceSource),
          jsc:{parser:{syntax:'typescript',tsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}}).code;
        const renderSurface=async(request,url)=>{
          const module={exports:{}}, unused=()=>assert.fail('unexpected fixture preview or control');
          const overrides={
            'next/headers':{headers:async()=>request.headers},'next/navigation':navigation,
            '@/components/kevin-bo/kevin-backoffice':{KevinBackoffice:()=>null},
            '@/components/control-workspace':{ControlWorkspace:unused},'@/components/partner-workspace':{PartnerWorkspace:()=>null},
            '@/lib/partner-data.mjs':{partnerWorkspaceInitialData:(req,options)=>partnerWorkspaceInitialData(req,{...options,config,store})},
            '@/lib/partner-preview.mjs':{partnerPreviewInitialData:unused},
            '../../lib/studio-native-runtime.mjs':{nativeStudioAdminEnabled:()=>false,studioNativeRuntime:unused},
            '@/lib/control-workspace.mjs':{controlToolPath},'@/lib/lab-url.mjs':{publicAbsoluteUrl},
            '@/lib/partner-session.mjs':{internalSessionPresent},'@/lib/partner-login-return.mjs':{partnerLoginReturnTo},
            '@/lib/next-page-navigation.mjs':{nextStudioLoginRedirect},'@/lib/workspace-surfaces.mjs':{resolveWorkspaceSurfacePath},
          };
          const localRequire=createRequire(surfaceSource);
          vm.runInNewContext(surfaceCode,{module,exports:module.exports,Request,require:name=>Object.hasOwn(overrides,name)?overrides[name]:localRequire(name)});
          const path=url.pathname.replace(/^\/studio(?=\/)/,'').split('/').slice(2);
          const tree=await module.exports.WorkspaceSurfacePage({surface:'partner',path,
            ...(url.searchParams.has('room')?{initialRoomId:url.searchParams.get('room')}:{})});
          const receipt={operator:tree.props.initialSnapshot?.operator?.slug??null,room:tree.props.initialRoomId??null,view:tree.props.initialView??null};
          if(receipt.room){const room=tree.props.initialSnapshot.tables.find(item=>item.id===receipt.room);assert.ok(room);assert.notEqual(room.id,room.presentationId);}
          receipts.push(receipt);
          return '<pre id="receipt">'+JSON.stringify(receipt)+'</pre>';
        };
        server=createServer(async(req,res)=>{
          try {
            const chunks=[];for await(const chunk of req)chunks.push(chunk);
            const url=new URL(req.url,origin),headers=new Headers(req.headers);
            // Node's loopback fetch owns Host; the browser-facing origin was
            // checked before transport and remains the server's logical host.
            headers.set('host',url.host);
            const request=new Request(url,{method:req.method,headers,...(req.method==='POST'?{body:Buffer.concat(chunks)}:{})});
            let response;
            if(url.pathname==='/fixture.js')response=new Response(bundle,{headers:{'content-type':'text/javascript'}});
            else if(url.pathname===authBase+'/login'){
              posts.push({path:url.pathname,body:JSON.parse(Buffer.concat(chunks).toString())});
              response=await handlePartnerAuth(request,config);
            }else if(['/partner/login','/studio/partner/login'].includes(url.pathname)){
              const values=url.searchParams.getAll('returnTo');
              const tree=await LoginPage({searchParams:Promise.resolve({returnTo:values.length>1?values:values[0]})});
              response=new Response('<meta name="referrer" content="no-referrer"><div id="root"></div><script id="props" type="application/json">'
                +JSON.stringify(tree.props).replace(/</g,'\\u003c')+'</script><script src="/fixture.js" defer></script>',{headers:{'content-type':'text/html'}});
            }else{
              try{response=new Response(await renderSurface(request,url),{headers:{'content-type':'text/html'}});}
              catch(error){
                const location=redirects.getURLFromRedirectError(error);
                if(location)response=new Response('<script>location.replace('+JSON.stringify(location)+')</script>',{headers:{'content-type':'text/html'}});
                else if(error.statusCode===403)response=new Response('Forbidden',{status:403});
                else throw error;
              }
            }
            res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
          }catch(error){failures.push(error);res.writeHead(500);res.end('Fixture failed');}
        });
        server.listen(0,'127.0.0.1');await once(server,'listening');
        await context.route('**/*',async route=>{
          try{
            const incoming=route.request(),url=new URL(incoming.url());
            assert.equal(url.origin,origin,'all external requests are blocked');
            const headers=await incoming.allHeaders();headers.host=url.host;
            if(incoming.method()==='POST'&&!headers['sec-fetch-site']){
              assert.equal(new URL(incoming.frame().url()).origin,origin);assert.equal(headers.origin,origin);headers['sec-fetch-site']='same-origin';
            }
            const response=await fetch(`http://127.0.0.1:${server.address().port}${url.pathname}${url.search}`,{
              method:incoming.method(),headers,body:incoming.postDataBuffer()??undefined,redirect:'manual'});
            await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
          }catch(error){failures.push(error);await route.abort();}
        });
        const page=await context.newPage();
        assert.equal((await page.goto(origin+prefix+target)).status(),200);
        assert.equal(failures.length,0,failures.map(error=>error.stack).join('\n'));
        await page.waitForURL(origin+'/partner/login?returnTo='+encodeURIComponent(target));
        // Both deployed login document addresses consume the same safe return.
        await page.goto(origin+prefix+'/partner/login?returnTo='+encodeURIComponent(prefix+target));
        const internal=page.getByRole('link',{name:'Logga in som intern administratör'});
        assert.equal(await internal.getAttribute('href'),prefix+'/login?returnTo='+encodeURIComponent(target));
        await page.getByLabel('Användarnamn eller e-post').fill('north-staff');await page.getByLabel('Lösenord').fill(password);
        await page.getByRole('button',{name:'Logga in',exact:true}).click();await page.waitForURL(origin+target);
        assert.deepEqual(JSON.parse(await page.locator('#receipt').textContent()),{operator:'north',room:'room-7',view:'bj'});
        await page.reload();assert.deepEqual(receipts.at(-1),{operator:'north',room:'room-7',view:'bj'});
        const cookies=await context.cookies();assert.equal(cookies.length,1);
        assert.equal(cookies[0].name,'partner_session');assert.equal(cookies[0].httpOnly,true);assert.equal(cookies[0].secure,true);assert.equal(cookies[0].sameSite,'Lax');
        assert.equal((await page.goto(origin+'/partner/south/rooms?room=room-7')).status(),403);
        await page.goto(origin+prefix+'/partner/login?returnTo='+encodeURIComponent('%2F%2Foutside.invalid'));
        assert.equal(await internal.getAttribute('href'),prefix+'/login?returnTo=%2Fpartner');
        await page.getByLabel('Användarnamn eller e-post').fill('north-staff');await page.getByLabel('Lösenord').fill(password);
        await page.getByRole('button',{name:'Logga in',exact:true}).click();await page.waitForURL(origin+'/partner');
        assert.deepEqual(JSON.parse(await page.locator('#receipt').textContent()),{operator:null,room:null,view:null});
        assert.deepEqual(posts,[{path:authBase+'/login',body:{user:'north-staff',pass:password}},{path:authBase+'/login',body:{user:'north-staff',pass:password}}]);
        assert.equal(failures.length,0,failures.map(String).join('\n'));
      }finally{
        await context.close();if(server)await new Promise(resolve=>server.close(resolve));bo.close();game.close();
      }
    }
  }finally{await browser.close();}
});
