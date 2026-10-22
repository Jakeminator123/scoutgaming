import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createOperatorAppearanceApi} from '../services/game/operator-appearance-api.mjs';
import {createOperatorPackageReader} from '../services/game/storage/operator-package-reader.mjs';
import {createOperatorAppearanceBoundary,preserveAppearanceBets,consumeAppearanceBets} from '../services/game/public/operator-appearance-boundary.mjs';
import {backendPlatformPath} from '../packages/navigation/server/platform-routing.mjs';
import {handleSharedRoomHttp} from '../services/game/shared-room-http.mjs';

const {parse}=createRequire(new URL('../apps/studio/package.json',import.meta.url))('next/dist/compiled/acorn');
const [serverSource,appSource]=await Promise.all(['../services/game/server.mjs','../services/game/public/app.mjs'].map(path=>readFile(new URL(path,import.meta.url),'utf8')));
const serverTree=parse(serverSource,{ecmaVersion:'latest',sourceType:'module'}),appTree=parse(appSource,{ecmaVersion:'latest',sourceType:'module'});
function walk(node,visit){if(!node||typeof node!=='object')return;visit(node);for(const value of Object.values(node))if(Array.isArray(value))value.forEach(child=>walk(child,visit));else if(value&&typeof value==='object')walk(value,visit);}
function declaration(tree,name){const found=tree.body.find(node=>node.type==='VariableDeclaration'&&node.declarations.some(row=>row.id.type==='Identifier'&&row.id.name===name));assert.ok(found,`actual runtime declaration ${name} must exist`);return found;}
function functionNode(tree,name){const found=tree.body.find(node=>node.type==='FunctionDeclaration'&&node.id.name===name);assert.ok(found,`actual runtime function ${name} must exist`);return found;}
function text(source,node){return source.slice(node.start,node.end);}
function importsAsDependencies(source,node){let result=text(source,node);const imports=[];walk(node,child=>{if(child.type==='ImportExpression')imports.push(child);});for(const item of imports.sort((a,b)=>b.start-a.start))result=result.slice(0,item.start-node.start)+'qaImport('+text(source,item.source)+')'+result.slice(item.end-node.start);return result;}
function compile(bindings,source){return Function(...Object.keys(bindings),source)(...Object.values(bindings));}

// Execute the real server initializer and HTTP callback without evaluating its
// startup side effects, opening a product server, or touching real accounts.
async function serverFixture({authenticated=true,available=true}={}){
  const scope={environment:'integration-qa',workspaceId:'appearance'};
  let revision=4,reads=0,queries=0;
  const sql={async query(statement,values){queries++;assert.deepEqual(values.slice(0,2),[scope.environment,scope.workspaceId]);
    const shared={environment_id:scope.environment,workspace_id:scope.workspaceId,operator_id:'north'};
    if(statement.includes('operator-store:operator-by-slug'))return {rows:values[2]==='north'?[{...shared,slug:'north',name:'North',status:'active',created_at_ms:0}]:[]};
    if(statement.includes('operator-store:current-package')){reads++;return {rows:[{...shared,package_revision:revision,lanes:'["qa-lane"]',games:'["blackjack"]',tables:'["qa-room"]',branding:'{}',published_at_ms:0}]};}
    throw Error('Unexpected appearance query');
  }};
  const initializers=['selectGameEntry','operatorAppearanceApi'].map(name=>importsAsDependencies(serverSource,declaration(serverTree,name))).join('\n');
  const initialized=await compile({studioPolicyRuntime:available?{scope,policy:{}}:null,storage:{pool:sql},
    createGameEntrySelector:({packages})=>async params=>{
      const context=await packages.resolve(params.get('operator'));
      if(!context?.operator||!context.package||!context.package.tables.includes(params.get('table')))return {status:404};
      return {status:200,selection:{operator:context.operator.slug,roomId:params.get('table'),packageRevision:context.package.revision}};
    },qaImport:async specifier=>{
      if(specifier==='./storage/operator-package-reader.mjs')return {createOperatorPackageReader};
      if(specifier==='./operator-appearance-api.mjs')return {createOperatorAppearanceApi};
      throw Error('Unapproved fixture import '+specifier);
    }},`return (async()=>{${initializers};return {operatorAppearanceApi};})();`);
  const server=declaration(serverTree,'server').declarations.find(row=>row.id.name==='server');
  assert.equal(server.init.callee.name,'createServer');const handlerNode=server.init.arguments[0];assert.equal(handlerNode.type,'ArrowFunctionExpression');
  const handler=compile({URL,Request,Response,Buffer,process:{env:{}},gameOrigin:'https://game.example.invalid',frontendOrigin:'https://frontend.example.invalid',
    nativeP6QaRouter:null,studioPreview:null,movingSpeechService:null,sharedRoomsEnabled:false,handleSharedRoomHttp,sharedRoomCommand:null,sharedRoomQa:null,studioLabSession:null,studioPolicyRuntime:available?{}:null,neonStudioEnabled:true,studioGameCommand:null,
    presentationCapabilitiesResponse:()=>null,compositionRuntimeResponse:async()=>null,layerPacksRoute:async()=>false,isRetiredBackofficePost:()=>false,
    boGameAuth:async()=>false,boLabAuth:async()=>false,auth:{handle:async()=>false},legacyBackofficeRedirect:()=>null,
    playerSession:async()=>authenticated?{playerId:'isolated-player'}:null,guestPreview:false,lissabonProfiles:{handle:async()=>false,enabled:false},
    playerPostOriginOk:()=>true,playerAccounts:true,...initialized},`return (${text(serverSource,handlerNode)});`);
  async function invoke(path='/api/operator/appearance?operator=north&table=qa-room',method='GET'){
    let body='';const headers={};const res={statusCode:0,headersSent:false,writableEnded:false,destroyed:false,
      setHeader(key,value){headers[key.toLowerCase()]=value;},writeHead(status,values={}){this.statusCode=status;this.headersSent=true;for(const [key,value]of Object.entries(values))this.setHeader(key,value);},
      end(value=''){body+=value;this.writableEnded=true;},destroy(){this.destroyed=true;}};
    await handler({url:path,method,headers:{host:'game.example.invalid',cookie:authenticated?'fixture-session=isolated':''}},res);
    assert.equal(res.writableEnded,true,'real route must terminate the response');
    return {status:res.statusCode,headers,body:body?JSON.parse(body):null};
  }
  return {invoke,setRevision(value){revision=value;},get reads(){return reads;},get queries(){return queries;}};
}

test('real server appearance route requires player authentication before any operator read',async()=>{
  const f=await serverFixture({authenticated:false});const result=await f.invoke();assert.equal(result.status,401);assert.equal(f.queries,0);
});
test('real server appearance route uses the uncached scoped package reader for every round boundary',async()=>{
  const f=await serverFixture();const first=await f.invoke();assert.equal(first.status,200);assert.deepEqual(first.body,{operator:'north',roomId:'qa-room',packageRevision:4});
  f.setRevision(5);const second=await f.invoke();assert.equal(second.status,200);assert.equal(second.body.packageRevision,5);assert.equal(f.reads,2);
  assert.equal(second.headers['cache-control'],'private, no-store');
});
test('real server route bounds methods, operator query and room scope; unavailable runtime fails closed',async()=>{
  const f=await serverFixture();assert.equal((await f.invoke(undefined,'POST')).status,405);
  for(const query of ['operator=north&operator=south&table=qa-room','operator=north&table=qa-room&private=yes','operator=../north&table=qa-room'])assert.equal((await f.invoke('/api/operator/appearance?'+query)).status,400);
  assert.equal(f.queries,0);assert.equal((await f.invoke('/api/operator/appearance?operator=south&table=qa-room')).status,404);
  assert.equal((await f.invoke('/api/operator/appearance?operator=north&table=foreign-room')).status,404);
  assert.equal((await(await serverFixture({available:false})).invoke()).status,503);
});

const entry={operator:'north',roomId:'qa-room',lane:'qa-lane',packageRevision:4};
const selectedBets=[{main:10,pp:2,tp:0},{main:0,pp:0,tp:0}];
function browserStorage({failWrite=false}={}){const data=new Map();return {data,getItem:key=>data.get(key)??null,removeItem:key=>data.delete(key),setItem(key,value){if(failWrite)throw Error('quota');data.set(key,value);}};}
function appFixture({responseRevision=4,requestError=false,storage=browserStorage(),activeRound=null,preview=false,initialBets=selectedBets,readGate=null,initialBusy=false,session={authenticated:true},expectedBets=selectedBets}={}){
  const events=[],hints=[],tableErrors=[],classList=new Set(activeRound?["in-round"]:[]);let reloaded=0,starts=0,reads=0;
  const init=text(appSource,declaration(appTree,'operatorAppearanceBoundary'));
  const restore=appTree.body.find(node=>node.type==='IfStatement'&&(()=>{let found=false;walk(node,child=>{if(child.type==='CallExpression'&&child.callee.name==='consumeAppearanceBets')found=true;});return found;})());assert.ok(restore,'actual app must consume preserved bets');
  let clickNode;walk(appTree,node=>{if(node.type==='AssignmentExpression'&&node.left.type==='MemberExpression'&&node.left.property.name==='onclick'&&node.left.object.type==='CallExpression'&&node.left.object.callee.name==='$'&&node.left.object.arguments[0]?.value==='#deal-now')clickNode=node.right;});assert.ok(clickNode,'actual deal button handler must exist');
  const runtime=compile({createOperatorAppearanceBoundary,preserveAppearanceBets,consumeAppearanceBets,entrySelection:entry,studioPreview:preview?{}:null,
    sessionStorage:storage,SEATS:2,bets:structuredClone(initialBets),round:activeRound,busy:initialBusy,balance:100,
    apiFetch:async(url,options)=>{reads++;events.push('appearance');assert.equal(url,'/api/operator/appearance?operator=north&table=qa-room');assert.equal(options.cache,'no-store');if(readGate)await readGate;if(requestError)throw Error('fixture network unavailable');return new Response(JSON.stringify({operator:'north',roomId:'qa-room',packageRevision:responseRevision}));},
    location:{reload(){reloaded++;events.push('reload');}},hint:(...args)=>hints.push(args),tableReady:Promise.resolve(),
    document:{body:{classList:{add:value=>classList.add(value),remove:value=>classList.delete(value)}}},renderBets:()=>events.push('render'),
    tableCommand:async(op,payload)=>{if(op==='state'){events.push('state');return {round:null,shoe:{}};}starts++;events.push('start');assert.equal(op,'start');assert.deepEqual(payload.bets,expectedBets);throw Error('fixture stops after actual start dispatch');},
    ensureLogin:async()=>true,tableError:error=>tableErrors.push(error.message),gameApi:{session:async()=>session},$:()=>({}),showShoe:()=>{},player:'isolated-player',
    allSides:false,LIMITS:{max:1000},selected:10,undoStack:[],flyChip:()=>events.push('chip'),sfx:{play(){}},
  },`${init}\n${text(appSource,declaration(appTree,'betTotal'))}\n${text(appSource,functionNode(appTree,'placeBet'))}\n${text(appSource,functionNode(appTree,'dealSequence'))}\n${text(appSource,functionNode(appTree,'prepareTable'))}\nreturn {deal:dealSequence,click:${text(appSource,clickNode)},prepare:prepareTable,place:()=>placeBet(0,'main',{}),restore:()=>{${text(appSource,restore)}},state:()=>({bets,busy,round,balance})};`);
  return {...runtime,events,hints,tableErrors,classList,storage,get reads(){return reads;},get starts(){return starts;},get reloaded(){return reloaded;}};
}

for(const [mode,options] of [['signed-in',{}],['guest',{session:{guest:true}}],['Studio rehearsal',{preview:true}]]){
  test(`actual ${mode} startup opens betting and dispatches the selected chips to the server`,async()=>{
    const empty=[{main:0,pp:0,tp:0},{main:0,pp:0,tp:0}];
    const expected=[{main:10,pp:0,tp:0},{main:0,pp:0,tp:0}];
    const f=appFixture({...options,initialBusy:true,initialBets:empty,expectedBets:expected});
    f.place();assert.deepEqual(f.state().bets,empty,'bets stay locked until the server table loads');
    await f.prepare();assert.equal(f.state().busy,false);assert.ok(f.events.includes('state'));
    f.place();assert.deepEqual(f.state().bets,expected);assert.ok(f.events.includes('chip'));
    await f.click();await new Promise(resolve=>setImmediate(resolve));
    assert.equal(f.starts,1);assert.deepEqual(f.tableErrors,['fixture stops after actual start dispatch']);
    assert.equal(f.reads,options.preview?0:1);
  });
}

test('actual dealSequence checks fresh appearance before dispatching the server start command',async()=>{
  const f=appFixture();await f.deal();assert.deepEqual(f.events.slice(0,2),['appearance','start']);assert.equal(f.starts,1);assert.equal(f.reloaded,0);
});
test('actual dealSequence preserves pending bets and reloads before sending a start for a newer package',async()=>{
  const f=appFixture({responseRevision:5});await f.deal();assert.equal(f.starts,0);assert.equal(f.reloaded,1);assert.equal(f.storage.data.size,1);
  const saved=JSON.parse([...f.storage.data.values()][0]);assert.equal(saved.revision,5);assert.deepEqual(saved.bets,selectedBets);assert.equal(f.state().busy,false);assert.equal(f.classList.has('in-round'),false);
  await f.deal();assert.equal(f.starts,0);assert.equal(f.reloaded,1);
});
test('actual appearance failures restore idle controls without entering tableError or losing selected bets',async()=>{
  for(const options of [{requestError:true},{responseRevision:3}]){
    const f=appFixture(options);await f.deal();assert.equal(f.starts,0);assert.equal(f.reloaded,0);assert.equal(f.state().busy,false);assert.equal(f.classList.has('in-round'),false);
    assert.deepEqual(f.tableErrors,[]);assert.deepEqual(f.state().bets,selectedBets);assert.ok(f.hints.length>0);
  }
});
test('actual refresh callback refuses reload when storage cannot preserve unsubmitted bets',async()=>{
  const f=appFixture({responseRevision:5,storage:browserStorage({failWrite:true})});await f.deal();assert.equal(f.starts,0);assert.equal(f.reloaded,0);assert.equal(f.state().busy,false);assert.deepEqual(f.state().bets,selectedBets);assert.deepEqual(f.tableErrors,[]);
  assert.match(f.hints[0][1],/sparas/);await f.deal();assert.equal(f.reads,2,'storage failure permits an explicit retry');assert.equal(f.reloaded,0);
});
test('actual app leaves active rounds untouched and excludes isolated Studio rehearsal from appearance refresh',async()=>{
  const active=appFixture({activeRound:{phase:'playing'},responseRevision:5});await active.click();assert.equal(active.reads,0);assert.equal(active.starts,0);assert.equal(active.reloaded,0);assert.equal(active.classList.has("in-round"),true);assert.equal(active.state().busy,false);assert.deepEqual(active.events,[]);
  const preview=appFixture({preview:true,responseRevision:5});await preview.deal();assert.equal(preview.reads,0);assert.equal(preview.starts,1);assert.equal(preview.reloaded,0);
});
test('actual startup consumes preserved bets once and authoritative idle preparation keeps those UI selections',async()=>{
  const storage=browserStorage();assert.equal(preserveAppearanceBets(storage,{...entry,packageRevision:3},4,selectedBets),true);
  const f=appFixture({storage,initialBets:[{main:0,pp:0,tp:0},{main:0,pp:0,tp:0}]});f.restore();assert.equal(storage.data.size,0);await f.prepare();assert.deepEqual(f.state().bets,selectedBets);assert.equal(f.starts,0);assert.equal(f.state().busy,false);
  f.restore();assert.deepEqual(f.state().bets,selectedBets);assert.equal(f.starts,0);
});
test('player frontend exposes exactly the appearance endpoint without opening adjacent operator APIs',()=>{
  assert.equal(backendPlatformPath('/api/operator/appearance'),true);
  for(const path of ['/api/operator','/api/operator/appearance/extra','/api/operator/appearance-edit','/api/operator/branding','/api/operator/appearance%2fprivate'])assert.equal(backendPlatformPath(path),false,path);
});

test('actual deal button coalesces concurrent clicks while appearance verification is pending',async()=>{
  let release;const readGate=new Promise(resolve=>{release=resolve;});const f=appFixture({readGate});
  await Promise.all([f.click(),f.click()]);assert.equal(f.reads,1);assert.equal(f.starts,0);assert.equal(f.state().busy,true);
  release();await new Promise(resolve=>setImmediate(resolve));assert.equal(f.starts,1);assert.equal(f.reads,1);
});
