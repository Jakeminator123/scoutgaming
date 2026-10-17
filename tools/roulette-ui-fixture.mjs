import {presentationPublicSource} from '../packages/presentation/public-modules.mjs';
// Short-lived UI acceptance only. No env files, production accounts or writes.
// node tools/roulette-ui-fixture.mjs (prints its random loopback URL)
import {createServer} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createSqliteRouletteCommand} from '../web/games/roulette/storage.mjs';
import {rouletteDocument} from '../web/games/roulette/http.mjs';
import {createRoulettePreview} from '../web/games/roulette/preview.mjs';
import {createSpinResult} from '../web/games/roulette/index.mjs';
import {defaultCompositionSettings,validateCompositionSettings} from '../packages/presentation/contracts/composition-settings.mjs';
import {previewMediaPath} from '../packages/presentation/contracts/operator-preview-contract.mjs';
import {rouletteSceneFixture} from './roulette-scene-fixture.mjs';

// Explicit local file copies only; no provider import, publication or guessed IDs.
// --dealer-video accepts already verified silent alpha WebM, not opaque MP4.
const args=process.argv.slice(2);
const options=new Map();
for(let i=0;i<args.length;i+=2) {
  if(!['--background-video','--dealer-video','--scene-settings','--scene-manifest'].includes(args[i])||!args[i+1]||options.has(args[i]))
    throw Error('Usage: [--background-video <local.mp4>] [--dealer-video <verified-alpha.webm>] [--scene-settings <composition.json>]');
  options.set(args[i],args[i+1]);
}
if(options.has('--dealer-video')&&!options.get('--dealer-video').toLowerCase().endsWith('.webm'))throw Error('Dealer fixture requires verified alpha WebM');
const videoBytes=options.has('--background-video')?await readFile(options.get('--background-video')):null;
const dealerBytes=options.has('--dealer-video')?await readFile(options.get('--dealer-video')):null;
const frozenScene=options.has('--scene-manifest')?await rouletteSceneFixture(options.get('--scene-manifest')):null;
const settings=options.has('--scene-settings')?validateCompositionSettings(JSON.parse(await readFile(options.get('--scene-settings'),'utf8'))):defaultCompositionSettings();
const backgroundId='00000000-0000-4000-8000-000000000001';
const dealerMediaId='00000000-0000-4000-8000-000000000002';
const mediaEvidence={dealer:dealerBytes?{sha256:createHash('sha256').update(dealerBytes).digest('hex'),size:dealerBytes.length}:null,
  background:videoBytes?{sha256:createHash('sha256').update(videoBytes).digest('hex'),size:videoBytes.length}:null};

const db=new DatabaseSync(':memory:');
db.exec(`CREATE TABLE players(id TEXT PRIMARY KEY,name TEXT,currency TEXT,balance NUMERIC);
  CREATE TABLE transactions(id INTEGER PRIMARY KEY,player_id TEXT,type TEXT,amount NUMERIC,currency TEXT,meta TEXT,at TEXT);
  INSERT INTO players VALUES ('roulette-ui-qa','Isolerad UI-test','USD',500),('roulette-ui-other','Annat testkonto','USD',500);`);
let draws=0,dropNext=false,player='roulette-ui-qa',preview;
const requests=[];
const run=createSqliteRouletteCommand({db,draw:context=>{draws++;return createSpinResult(context);}});
const room={id:'isolated-room',operatorId:'isolated-operator',name:'Roulette · isolerad UI-test',operator:'isolated',operatorName:'UI-labb',dealer:frozenScene?'anna-jonsson':'fixture',packageRevision:1};
const mediaPath=previewMediaPath({operatorSlug:room.operator,roomId:room.id,packageRevision:1,dealerId:room.dealer},'background',backgroundId);
const dealerPath=previewMediaPath({operatorSlug:room.operator,roomId:room.id,packageRevision:1,dealerId:room.dealer},'dealer',dealerMediaId);
const server=createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://127.0.0.2');
    const json=(code,value)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
    if(req.headers.host!==new URL(base).host){json(403,{error:'fixture_host_required'});return;}
    if(req.method==='POST'&&req.headers.origin!==base){json(403,{error:'fixture_origin_required'});return;}
    if(frozenScene){
      const response=await frozenScene.preview.handle(new Request(base+req.url,{method:req.method,headers:req.headers}));
      if(response){res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;}
      if(await frozenScene.rooms.handle(req,res,url.pathname))return;
    }
    if((videoBytes||dealerBytes) && req.method==='GET') {
      if(videoBytes&&url.pathname===mediaPath){res.writeHead(200,{'Content-Type':'video/mp4','Content-Length':videoBytes.length,'Cache-Control':'no-store'});res.end(videoBytes);return;}
      if(dealerBytes&&url.pathname===dealerPath){res.writeHead(200,{'Content-Type':'video/webm','Content-Length':dealerBytes.length,'Cache-Control':'no-store'});res.end(dealerBytes);return;}
      if(url.pathname==='/api/operators/isolated/rooms'){
        json(200,{schemaVersion:1,operator:{slug:'isolated',name:'UI-labb'},packageRevision:1,rooms:[{id:room.id,name:room.name,laneId:'fixture',game:'roulette',presentation:{id:'fixture',label:'Isolerad komposition'},dealerDefault:'fixture',playUrl:'/play/roulette?operator=isolated&table=isolated-room',dealers:[{id:'fixture',label:'Isolerat dealerprov',presentation:'layered',independentLayers:true,table:{enabled:false,default:null,allowed:[]},background:{enabled:Boolean(videoBytes),mode:'video',default:videoBytes?backgroundId:null,allowed:videoBytes?[{id:backgroundId,label:'Isolerad videobakgrund'}]:[]}}]}]});return;
      }
      if(url.pathname==='/api/operators/isolated/rooms/isolated-room/preview'){
        if(url.searchParams.get('revision')!=='1'||url.searchParams.get('dealer')!=='fixture'){json(409,{error:'preview_changed'});return;}
        json(200,{schemaVersion:1,operatorSlug:'isolated',roomId:room.id,packageRevision:1,dealer:{id:'fixture',label:'Isolerat dealerprov'},independentLayers:true,settings,media:{dealer:dealerBytes?{src:dealerPath,contentType:'video/webm',compositing:{mode:'alpha'}}:null,tables:[],backgrounds:videoBytes?[{id:backgroundId,label:'Isolerad videobakgrund',src:mediaPath,contentType:'video/mp4'}]:[]}});return;
      }
      if(videoBytes&&url.pathname==='/fixture/masked-table'){
        res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
        res.end(`<!doctype html><html lang="sv"><title>Isolerad MP4-maskkontroll</title><h1>Isolerad MP4-maskkontroll</h1><canvas id="scene" style="width:80vw;aspect-ratio:16/9"></canvas><p id="status">Laddar</p><button id="toggle">Spela/pausa</button><script type="module">import {mountPublishedScene} from '/published-scene.mjs';import {rouletteSceneSettings} from '/roulette/media.mjs';const scene=mountPublishedScene(document.querySelector('canvas'),{dealer:null,table:{src:'${mediaPath}',contentType:'video/mp4'},tableMask:{src:'/roulette/assets/roulette-bord.png',contentType:'image/png'},settings:rouletteSceneSettings(),layout:'desktop',onReady:()=>document.querySelector('#status').textContent='Masken är laddad',onFailure:()=>document.querySelector('#status').textContent='Mediafel',onPlaying:playing=>document.querySelector('button').textContent=playing?'Pausa video':'Spela video'});document.querySelector('button').onclick=()=>scene.toggle();addEventListener('pagehide',()=>scene.close(),{once:true});</script>`);return;
      }
    }
    if(['/roulette-idle-contract.mjs','/roulette-start-contract.mjs','/material-catalog.mjs','/background-materials.mjs'].includes(url.pathname)){
      res.writeHead(200,{'Content-Type':'text/javascript'});res.end(await readFile(new URL('../web/public'+url.pathname,import.meta.url)));return;
    }
    if(['/composition-runtime/compositor.js','/composition-runtime/geometry.js'].includes(url.pathname)){
      res.writeHead(200,{'Content-Type':'text/javascript'});res.end(await readFile(new URL('../packages/presentation/compositor/'+url.pathname.split('/').at(-1),import.meta.url)));return;
    }
    if(url.pathname==='/fixture'&&req.method==='GET') {
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
      res.end('<!doctype html><html lang="sv"><title>Isolerad roulettefixtur</title><h1>Isolerad roulettefixtur</h1><p>SQLite i minnet. Ingen produktionsanslutning.</p><form method="post" action="/fixture/drop"><button>Tappa nästa svar efter commit</button></form><form method="post" action="/fixture/switch"><button>Byt testkonto</button></form><a href="/play/roulette?operator=isolated&table=isolated-room">Öppna rouletterummet</a><p><a href="/roulette-test#experiments">Öppna rörelselabbet</a></p></html>');return;
    }
    if(url.pathname==='/fixture/evidence'&&req.method==='GET') {json(200,{draws,requests,media:frozenScene?.evidence??mediaEvidence,settings:frozenScene?.settings??settings,productionCapture:Boolean(frozenScene),players:db.prepare('SELECT * FROM players').all(),ledger:db.prepare('SELECT * FROM transactions').all()});return;}
    if(req.method==='POST'&&['/fixture/drop','/fixture/switch'].includes(url.pathname)) {
      req.resume();if(url.pathname.endsWith('/drop'))dropNext=true;else player=player==='roulette-ui-qa'?'roulette-ui-other':'roulette-ui-qa';
      res.writeHead(303,{Location:'/play/roulette?operator=isolated&table=isolated-room'});res.end();return;
    }
    if(url.pathname==='/api/roulette/table'&&req.method==='POST') {
      let body='';for await(const chunk of req){body+=chunk;if(body.length>16384)throw Error('too_large');}
      const {context,playerId,...request}=JSON.parse(body);
      if(playerId&&playerId!==player){json(401,{error:'session_changed'});return;}
      if(context?.operator!=='isolated'||context?.table!=='isolated-room'){json(404,{error:'roulette_room_not_found'});return;}
      if(request.op==='spin')requests.push({playerId,...request});
      const result=run({id:player,...request},{room});
      if(dropNext&&request.op==='spin'){
        // A partial receipt avoids Chromium's transparent socket-level POST retry.
        dropNext=false;res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end('{');return;
      }
      json(200,result);return;
    }
    // Exercise the real scene loader's unavailable-media fallback.
    const publicSource = presentationPublicSource(url.pathname);
    if(url.pathname==='/roulette/scene.mjs'||publicSource) {
      const source=publicSource??'web/public/roulette/scene.mjs';
      res.writeHead(200,{'Content-Type':source.endsWith('.json')?'application/json':'text/javascript'});
      res.end(await readFile(new URL('../'+source,import.meta.url)));return;
    }
    if(await rouletteDocument(req,res,{authenticated:true,guestPreview:false}))return;
    if(await preview(req,res))return;
    json(404,{error:'fixture_unavailable'});
  }catch(error){if(!res.destroyed){res.writeHead(error.statusCode??400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.message}));}}
});
await new Promise(resolve=>server.listen(0,'127.0.0.2',resolve));
const base=`http://127.0.0.2:${server.address().port}`;
preview=createRoulettePreview({origin:base});
console.log(base+'/fixture');
let closing=false;
function close(){if(closing)return;closing=true;clearTimeout(lifetime);server.close(()=>db.close());server.closeAllConnections();}
const lifetime=setTimeout(close,30*60*1000);
process.once('SIGINT',close);process.once('SIGTERM',close);
