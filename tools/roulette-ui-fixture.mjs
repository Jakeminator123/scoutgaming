// Short-lived UI acceptance only. No env files, production accounts or media.
// node tools/roulette-ui-fixture.mjs (prints its random loopback URL)
import {createServer} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import {createSqliteRouletteCommand} from '../web/games/roulette/storage.mjs';
import {rouletteDocument} from '../web/games/roulette/http.mjs';
import {createRoulettePreview} from '../web/games/roulette/preview.mjs';
import {createSpinResult} from '../web/games/roulette/index.mjs';
import {defaultCompositionSettings} from '../web/public/composition-settings.mjs';
import {previewMediaPath} from '../web/public/operator-preview-contract.mjs';

// Optional local-only decode acceptance. Supply a disposable test MP4, never live media.
const args=process.argv.slice(2);
if(args.length && (args.length!==2 || args[0]!=='--background-video'))throw Error('Usage: --background-video <local-test.mp4>');
const videoBytes=args.length?await readFile(args[1]):null;
const backgroundId='00000000-0000-4000-8000-000000000001';

const db=new DatabaseSync(':memory:');
db.exec(`CREATE TABLE players(id TEXT PRIMARY KEY,name TEXT,currency TEXT,balance NUMERIC);
  CREATE TABLE transactions(id INTEGER PRIMARY KEY,player_id TEXT,type TEXT,amount NUMERIC,currency TEXT,meta TEXT,at TEXT);
  INSERT INTO players VALUES ('roulette-ui-qa','Isolerad UI-test','USD',500),('roulette-ui-other','Annat testkonto','USD',500);`);
let draws=0,dropNext=false,player='roulette-ui-qa',preview;
const requests=[];
const run=createSqliteRouletteCommand({db,draw:context=>{draws++;return createSpinResult(context);}});
const room={id:'isolated-room',operatorId:'isolated-operator',name:'Roulette · isolerad UI-test',operator:'isolated',operatorName:'UI-labb',dealer:'fixture',packageRevision:1};
const mediaPath=previewMediaPath({operatorSlug:room.operator,roomId:room.id,packageRevision:1,dealerId:room.dealer},'background',backgroundId);
const server=createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://127.0.0.2');
    const json=(code,value)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
    if(req.headers.host!==new URL(base).host){json(403,{error:'fixture_host_required'});return;}
    if(req.method==='POST'&&req.headers.origin!==base){json(403,{error:'fixture_origin_required'});return;}
    if(videoBytes && req.method==='GET') {
      if(url.pathname===mediaPath){res.writeHead(200,{'Content-Type':'video/mp4','Content-Length':videoBytes.length,'Cache-Control':'no-store'});res.end(videoBytes);return;}
      if(url.pathname==='/api/operators/isolated/rooms'){
        json(200,{schemaVersion:1,operator:{slug:'isolated',name:'UI-labb'},packageRevision:1,rooms:[{id:room.id,name:room.name,laneId:'fixture',game:'roulette',presentation:{id:'fixture',label:'Isolerad komposition'},dealerDefault:'fixture',playUrl:'/play/roulette?operator=isolated&table=isolated-room',dealers:[{id:'fixture',label:'Ej inspelad testdealer',presentation:'layered',independentLayers:true,table:{enabled:false,default:null,allowed:[]},background:{enabled:true,mode:'video',default:backgroundId,allowed:[{id:backgroundId,label:'Isolerad videobakgrund'}]}}]}]});return;
      }
      if(url.pathname==='/api/operators/isolated/rooms/isolated-room/preview'){
        if(url.searchParams.get('revision')!=='1'||url.searchParams.get('dealer')!=='fixture'){json(409,{error:'preview_changed'});return;}
        json(200,{schemaVersion:1,operatorSlug:'isolated',roomId:room.id,packageRevision:1,dealer:{id:'fixture',label:'Ej inspelad testdealer'},independentLayers:true,settings:defaultCompositionSettings(),media:{dealer:null,tables:[],backgrounds:[{id:backgroundId,label:'Isolerad videobakgrund',src:mediaPath,contentType:'video/mp4'}]}});return;
      }
      if(url.pathname==='/fixture/masked-table'){
        res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
        res.end(`<!doctype html><html lang="sv"><title>Isolerad MP4-maskkontroll</title><h1>Isolerad MP4-maskkontroll</h1><canvas id="scene" style="width:80vw;aspect-ratio:16/9"></canvas><p id="status">Laddar</p><button id="toggle">Spela/pausa</button><script type="module">import {mountPublishedScene} from '/published-scene.mjs';import {rouletteSceneSettings} from '/roulette/media.mjs';const scene=mountPublishedScene(document.querySelector('canvas'),{dealer:null,table:{src:'${mediaPath}',contentType:'video/mp4'},tableMask:{src:'/roulette/assets/roulette-bord.png',contentType:'image/png'},settings:rouletteSceneSettings(),layout:'desktop',onReady:()=>document.querySelector('#status').textContent='Masken är laddad',onFailure:()=>document.querySelector('#status').textContent='Mediafel',onPlaying:playing=>document.querySelector('button').textContent=playing?'Pausa video':'Spela video'});document.querySelector('button').onclick=()=>scene.toggle();addEventListener('pagehide',()=>scene.close(),{once:true});</script>`);return;
      }
    }
    if(['/composition-runtime/compositor.js','/composition-runtime/geometry.js'].includes(url.pathname)){
      res.writeHead(200,{'Content-Type':'text/javascript'});res.end(await readFile(new URL('../packages/presentation/compositor/'+url.pathname.split('/').at(-1),import.meta.url)));return;
    }
    if(url.pathname==='/fixture'&&req.method==='GET') {
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
      res.end('<!doctype html><html lang="sv"><title>Isolerad roulettefixtur</title><h1>Isolerad roulettefixtur</h1><p>SQLite i minnet. Ingen produktionsanslutning.</p><form method="post" action="/fixture/drop"><button>Tappa nästa svar efter commit</button></form><form method="post" action="/fixture/switch"><button>Byt testkonto</button></form><a href="/play/roulette?operator=isolated&table=isolated-room">Öppna rouletterummet</a><p><a href="/roulette-test#experiments">Öppna rörelselabbet</a></p></html>');return;
    }
    if(url.pathname==='/fixture/evidence'&&req.method==='GET') {json(200,{draws,requests,players:db.prepare('SELECT * FROM players').all(),ledger:db.prepare('SELECT * FROM transactions').all()});return;}
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
    if(url.pathname==='/roulette/scene.mjs'||url.pathname==='/published-scene.mjs'||['/operator-rooms-contract.mjs','/operator-preview-contract.mjs','/player-choices.mjs','/composition-settings.mjs','/game-lanes.mjs','/dealer-identity.mjs','/dealer-framing.mjs','/presentation-composition.mjs','/dealer-compositing.mjs','/background-playback-policy.mjs','/background-playback.mjs','/game-overlay-layout.mjs','/card-presentation/calibration.mjs'].includes(url.pathname)) {
      const file=url.pathname.slice(1);res.writeHead(200,{'Content-Type':'text/javascript'});res.end(await readFile(new URL('../web/public/'+file,import.meta.url)));return;
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
