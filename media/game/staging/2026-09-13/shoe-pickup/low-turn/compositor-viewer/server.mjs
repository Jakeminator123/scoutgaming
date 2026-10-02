import http from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'../../../../../..');
const routes={
  '/full-cycle-v5-packed.mp4':path.resolve(here,'../motion-transfer/camera-review/seven-targets/far-left-anchor/motion/release-continuation/motion-registration/full-cycle-candidate-v5/web-surface/actor-packed-3x60.mp4'),
  '/full-cycle-v5-ledger.json':path.resolve(here,'../motion-transfer/camera-review/seven-targets/far-left-anchor/motion/release-continuation/motion-registration/full-cycle-candidate-v5/web-surface/receipt.json'),
  '/full-cycle-v4-packed.mp4':path.resolve(here,'../motion-transfer/camera-review/seven-targets/far-left-anchor/motion/release-continuation/motion-registration/full-cycle-candidate-v4/web-surface/actor-packed-3x60.mp4'),
  '/full-cycle-v4-ledger.json':path.resolve(here,'../motion-transfer/camera-review/seven-targets/far-left-anchor/motion/release-continuation/motion-registration/full-cycle-candidate-v4/web-surface/receipt.json'),
  '/full-cycle':path.join(here,'full-cycle.html'),
  '/full-cycle.mjs':path.join(here,'full-cycle.mjs'),
  '/full-cycle-packed.mp4':path.resolve(here,'../motion-transfer/camera-review/seven-targets/far-left-anchor/motion/release-continuation/motion-registration/full-cycle-candidate-v2/web-surface/actor-packed-3x60.mp4'),
  '/full-cycle-ledger.json':path.resolve(here,'../motion-transfer/camera-review/seven-targets/far-left-anchor/motion/release-continuation/motion-registration/full-cycle-candidate-v2/web-surface/receipt.json'),
  '/far-left-pace3.mp4':path.resolve(here,'../cadence-comparison/far-left-timing/cut66-source-pace-3x.mp4'),
  '/far-left-pace25.mp4':path.resolve(here,'../cadence-comparison/far-left-timing/cut66-source-pace-2.5x.mp4'),
  '/real-dealer-cadence.mp4':path.resolve(here,'../cadence-comparison/consecutive-deals-native60.mp4'),
  '/seven-seat-targets.json':path.resolve(here,'../motion-transfer/camera-review/seven-targets/isolated-game-targets.json'),
  '/return-join':path.join(here,'return-join.html'),
  '/return-join.mjs':path.join(here,'return-join.mjs'),
  '/far-left-return.mp4':path.resolve(here,'../motion-transfer/camera-review/seven-targets/far-left-anchor/motion/release-continuation/source.mp4'),
  '/far-left-endpoint':path.join(here,'far-left-endpoint.html'),
  '/far-left-endpoint.mjs':path.join(here,'far-left-endpoint.mjs'),
  '/far-left-source.mp4':path.resolve(here,'../motion-transfer/camera-review/seven-targets/far-left-anchor/motion/source.mp4'),
  '/native-phase-review':path.join(here,'native-phase-review.html'),
  '/native-phase-review.mjs':path.join(here,'native-phase-review.mjs'),
  '/farleft-source.mp4':path.resolve(here,'../motion-transfer/camera-review/seven-targets/far-left-anchor/motion/source.mp4'),
  '/native-opaque-709.webm':path.resolve(here,'../motion-transfer/camera60-draft/cadence-full/native-alpha-feasibility/opaque-174-233-yuv420-bt709.webm'),
  '/native-rear-joined709.webm':path.resolve(here,'../motion-transfer/camera60-draft/cadence-full/native-alpha-feasibility/rear-joined350-yuv420-bt709.webm'),
  '/native-front-joined709.webm':path.resolve(here,'../motion-transfer/camera60-draft/cadence-full/native-alpha-feasibility/front-joined350-yuv420-bt709.webm'),
  '/native-rear-709.webm':path.resolve(here,'../motion-transfer/camera60-draft/cadence-full/native-alpha-feasibility/rear-174-233-yuv420-bt709.webm'),
  '/native-front-709.webm':path.resolve(here,'../motion-transfer/camera60-draft/cadence-full/native-alpha-feasibility/front-174-233-yuv420-bt709.webm'),
  '/native-rear-601.webm':path.resolve(here,'../motion-transfer/camera60-draft/cadence-full/native-alpha-feasibility/rear-174-233-yuv420-bt601.webm'),
  '/native-front-601.webm':path.resolve(here,'../motion-transfer/camera60-draft/cadence-full/native-alpha-feasibility/front-174-233-yuv420-bt601.webm'),

  '/native-rear-420.webm':path.resolve(here,'../motion-transfer/camera60-draft/cadence-full/native-alpha-feasibility/rear-174-233-yuv420.webm'),
  '/native-front-420.webm':path.resolve(here,'../motion-transfer/camera60-draft/cadence-full/native-alpha-feasibility/front-174-233-yuv420.webm'),
  '/native-layers':path.join(here,'native-layers.html'),
  '/native-layers.mjs':path.join(here,'native-layers.mjs'),
  '/native-rear.webm':path.resolve(here,'../motion-transfer/camera60-draft/cadence-full/native-alpha-feasibility/rear-174-233.webm'),
  '/native-front.webm':path.resolve(here,'../motion-transfer/camera60-draft/cadence-full/native-alpha-feasibility/front-174-233.webm'),
  '/alpha-probe':path.join(here,'alpha-probe.html'),
  '/probe-420.webm':path.resolve(here,'../motion-transfer/camera60-draft/cadence-full/native-alpha-feasibility/probe-yuva420p.webm'),
  '/probe-gbr.webm':path.resolve(here,'../motion-transfer/camera60-draft/cadence-full/native-alpha-feasibility/probe-gbrap-experimental.webm'),
  '/bridge-review':path.join(here,'bridge-review.html'),
  '/bridge-review.mjs':path.join(here,'bridge-review.mjs'),
  '/speech-bridge-residual.mp4':path.resolve(here,'../motion-transfer/idle-registration/bridge-pair/mattes/residual-clean/bridge-native-R-residual-clean-draft.mp4'),
  '/speech-bridge-edge.mp4':path.resolve(here,'../motion-transfer/idle-registration/bridge-pair/mattes/edge-clean/bridge-native-R-edge-clean-draft.mp4'),
  '/speech-bridge.mp4':path.resolve(here,'../motion-transfer/idle-registration/bridge-pair/mattes/bridge-native-R-only-draft.mp4'),
  '/speech-idle-moving.mp4':path.resolve(here,'../motion-transfer/idle-registration/bridge-pair/original-idle-moving-packed.mp4'),
  '/speech-idle-reference.mp4':path.resolve(here,'../motion-transfer/idle-registration/bridge-pair/idle0-reference-packed.mp4'),
  '/speech-registration.json':path.resolve(here,'../motion-transfer/idle-registration/bridge-pair/review/endpoint-registration.json'),
  '/camera60':path.join(here,'camera60.html'),
  '/camera60.mjs':path.join(here,'camera60.mjs'),
  '/camera60.mp4':path.resolve(here,'../motion-transfer/camera60-draft/cadence-full/camera-cadence60-draft.mp4'),
  '/camera60-repaired.mp4':path.resolve(here,'../motion-transfer/camera60-draft/cadence-full/camera-cadence60-knuckle-repaired.mp4'),
  '/camera60-720.mp4':path.resolve(here,'../motion-transfer/camera60-draft/cadence-full/camera-cadence60-knuckle-720.mp4'),
  '/camera60.json':path.resolve(here,'../motion-transfer/camera60-draft/cadence-full/ledger.json'),
  '/camera60-joined.json':path.resolve(here,'../motion-transfer/camera60-draft/cadence-full/joined-ledger.json'),
  '/camera60-joined.mp4':path.resolve(here,'../motion-transfer/camera60-draft/cadence-full/camera-joined60-cleanup.mp4'),
  '/camera60-joined-720.mp4':path.resolve(here,'../motion-transfer/camera60-draft/cadence-full/camera-joined60-cleanup-720.mp4'),
  '/camera60-contour-mixed5.mp4':path.resolve(here,'../motion-transfer/camera60-draft/cadence-full/camera-joined60-background-mixed-v5-720.mp4'),
  '/camera60-contour.mp4':path.resolve(here,'../motion-transfer/camera60-draft/cadence-full/camera-joined60-contour-v3-720.mp4'),
  '/':path.join(here,'index.html'),
  '/camera-shoe-mask.png':path.resolve(here,'../motion-transfer/camera-card-fit/shoe-mask/card-allowed.png'),
  '/camera-shoe-contract.mjs':path.resolve(here,'../motion-transfer/camera-card-fit/shoe-mask/contract.mjs'),
  '/camera-working.mp4':path.resolve(here,'../motion-transfer/camera-working/camera-working-native.mp4'),
  '/camera-cycle':path.join(here,'camera-cycle.html'),
  '/camera-cycle.mjs':path.join(here,'camera-cycle.mjs'),
  '/camera-return-packed.mp4':path.resolve(here,'../motion-transfer/camera-review/return-plan/return-packed-draft.mp4'),
  '/camera-return-join.json':path.resolve(here,'../motion-transfer/camera-review/return-plan/join-metrics.json'),
  '/camera':path.join(here,'camera.html'),
  '/camera.mjs':path.join(here,'camera.mjs'),
  '/camera-first40-v3.mp4':path.resolve(here,'../motion-transfer/camera-paper-first/camera-first40-manual-v3-draft.mp4'),
  '/camera-first40.mp4':path.resolve(here,'../motion-transfer/camera-paper-first/camera-first40-manual-v2-draft.mp4'),
  '/camera-edge-packed.mp4':path.resolve(here,'../motion-transfer/camera-composite/camera-native-R-edge-draft.mp4'),
  '/camera-packed.mp4':path.resolve(here,'../motion-transfer/camera-composite/camera-native-R-only-draft.mp4'),
  '/camera-trajectory.json':path.resolve(here,'../motion-transfer/camera-card-fit/trajectories.json'),
  '/camera-table.json':path.resolve(here,'../motion-transfer/camera-card-fit/shared-table-camera.json'),
  '/cycle':path.join(here,'cycle.html'),
  '/continuous':path.join(here,'continuous.html'),
  '/continuous.mjs':path.join(here,'continuous.mjs'),
  '/continuous.mp4':path.resolve(here,'../cycle60-draft/continuous/cycle-shared60-packed-420.mp4'),
  '/continuous-preroll.mp4':path.join(here,'continuous-preroll.mp4'),
  '/continuous-preroll.json':path.join(here,'continuous-preroll.json'),
  '/continuous.json':path.resolve(here,'../cycle60-draft/continuous/manifest.json'),
  '/cycle.mjs':path.join(here,'cycle.mjs'),
  '/card-state.mjs':path.join(here,'card-state.mjs'),
  '/card-pose.mjs':path.join(here,'card-pose.mjs'),
  '/pickup-packed.mp4':path.join(here,'pickup-packed-draft.mp4'),
  '/return-packed.mp4':path.join(here,'return-packed-draft.mp4'),
  '/trajectory.json':path.resolve(here,'../pickup-card/end-refit/extended-trajectory.json'),
  '/transforms.json':path.resolve(here,'../cycle-registration/clip-transforms.json'),
  '/packed-gpu.mjs':path.join(here,'packed-gpu.mjs'),
  '/vendor/three/three.module.js':path.join(repo,'web/public/vendor/three/three.module.js'),
  '/vendor/three/three.core.min.js':path.join(repo,'web/public/vendor/three/three.core.min.js'),
  '/slide-packed.mp4':path.join(here,'slide-packed-draft.mp4'),
  '/assets/cardback.png':path.join(repo,'web/public/assets/cardback.png'),
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
  try{const s=await stat(file);const headers={'Content-Type':file.endsWith('.mp4')?'video/mp4':file.endsWith('.webm')?'video/webm':file.endsWith('.png')?'image/png':file.endsWith('.json')?'application/json':(file.endsWith('.mjs')||file.endsWith('.js'))?'text/javascript':'text/html','Content-Length':s.size,'Cache-Control':'no-store','Accept-Ranges':'bytes'};
    const range=req.headers.range;
    if(range){const match=/^bytes=(\d*)-(\d*)$/.exec(range);let start,end;if(match&&(match[1]||match[2])){start=match[1]?Number(match[1]):Math.max(0,s.size-Number(match[2]));end=match[1]&&match[2]?Math.min(Number(match[2]),s.size-1):s.size-1;}
      if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=s.size){res.writeHead(416,{'Content-Range':`bytes */${s.size}`});res.end();return;}
      res.writeHead(206,{...headers,'Content-Length':end-start+1,'Content-Range':`bytes ${start}-${end}/${s.size}`});if(req.method==='HEAD')res.end();else createReadStream(file,{start,end}).pipe(res);return;
    }
    res.writeHead(200,headers);if(req.method==='HEAD')res.end();else createReadStream(file).pipe(res);
  }catch{res.writeHead(404);res.end('Asset not ready');}
}).listen(4189,'127.0.0.1',()=>console.log('Staging contact viewer http://127.0.0.1:4189'));
