import http from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'../../../../../..');
const routes={
  '/':path.join(here,'index.html'),
  '/cycle':path.join(here,'cycle.html'),
  '/continuous':path.join(here,'continuous.html'),
  '/continuous.mjs':path.join(here,'continuous.mjs'),
  '/continuous.mp4':path.resolve(here,'../cycle60-draft/continuous/cycle-shared60-packed-420.mp4'),
  '/continuous-preroll.mp4':path.join(here,'continuous-preroll.mp4'),
  '/continuous-preroll.json':path.join(here,'continuous-preroll.json'),
  '/continuous.json':path.resolve(here,'../cycle60-draft/continuous/manifest.json'),
  '/cycle.mjs':path.join(here,'cycle.mjs'),
  '/card-pose.mjs':path.join(here,'card-pose.mjs'),
  '/pickup-packed.mp4':path.join(here,'pickup-packed-draft.mp4'),
  '/return-packed.mp4':path.join(here,'return-packed-draft.mp4'),
  '/trajectory.json':path.resolve(here,'../pickup-card/end-refit/extended-trajectory.json'),
  '/transforms.json':path.resolve(here,'../cycle-registration/clip-transforms.json'),
  '/packed-gpu.mjs':path.join(here,'packed-gpu.mjs'),
  '/vendor/three/three.module.js':path.join(repo,'web/public/vendor/three/three.module.js'),
  '/vendor/three/three.core.min.js':path.join(repo,'web/public/vendor/three/three.core.min.js'),
  '/slide-packed.mp4':path.join(here,'slide-packed-draft.mp4'),
  '/card-art.mjs':path.join(repo,'web/public/card-art.mjs'),
  '/observations.json':path.resolve(here,'../../integration-diagnostic/slide-contact/observations.json'),
};
for(const name of ['pickup','slide','return']){routes[`/${name}-60.mp4`]=path.resolve(here,`../cycle60-draft/${name}/${name}-shared60-packed.mp4`);routes[`/${name}-60-420.mp4`]=path.resolve(here,`../cycle60-draft/${name}/${name}-shared60-packed-420.mp4`);routes[`/${name}-60.json`]=path.resolve(here,`../cycle60-draft/${name}/ledger.json`);}
const roots={'/rgb/':path.resolve(here,'../mattes/slide/frames'),'/masks/':path.resolve(here,'../composite-draft/slide-rg')};
http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  let file=routes[url.pathname];
  for(const [prefix,root] of Object.entries(roots))if(url.pathname.startsWith(prefix)){
    const name=url.pathname.slice(prefix.length);
    if(/^\d{4}\.png$/.test(name))file=path.join(root,name);
  }
  if(!file){res.writeHead(404);res.end();return;}
  try{const s=await stat(file);const headers={'Content-Type':file.endsWith('.mp4')?'video/mp4':file.endsWith('.png')?'image/png':file.endsWith('.json')?'application/json':(file.endsWith('.mjs')||file.endsWith('.js'))?'text/javascript':'text/html','Content-Length':s.size,'Cache-Control':'no-store','Accept-Ranges':'bytes'};
    const range=req.headers.range;
    if(range){const match=/^bytes=(\d*)-(\d*)$/.exec(range);let start,end;if(match&&(match[1]||match[2])){start=match[1]?Number(match[1]):Math.max(0,s.size-Number(match[2]));end=match[1]&&match[2]?Math.min(Number(match[2]),s.size-1):s.size-1;}
      if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=s.size){res.writeHead(416,{'Content-Range':`bytes */${s.size}`});res.end();return;}
      res.writeHead(206,{...headers,'Content-Length':end-start+1,'Content-Range':`bytes ${start}-${end}/${s.size}`});if(req.method==='HEAD')res.end();else createReadStream(file,{start,end}).pipe(res);return;
    }
    res.writeHead(200,headers);if(req.method==='HEAD')res.end();else createReadStream(file).pipe(res);
  }catch{res.writeHead(404);res.end('Asset not ready');}
}).listen(4189,'127.0.0.1',()=>console.log('Staging contact viewer http://127.0.0.1:4189'));
