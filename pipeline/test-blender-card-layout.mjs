import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../web/public/vendor/three/three.module.js';
import {feltCardLocalQuad} from '../web/public/blender-card-layout.mjs';
import {quadMatrix} from '../web/public/astrid-green-dealer.mjs';
import {pointOnSurface} from '../web/public/blender-table-scene.mjs';
import {cardLandingCorners} from '../web/public/performance-player.mjs';

test('each card corner projects onto the felt and its landing shares that exact quad',()=>{
  const camera=new THREE.PerspectiveCamera(38,16/9,.01,100);
  camera.position.set(0,2.2,2.1);camera.lookAt(0,.76,0);camera.updateMatrixWorld(true);
  for(let seat=0;seat<7;seat++){
    const phi=(145-seat*110/6)*Math.PI/180;
    const plane=new THREE.Object3D();plane.position.set(.83*Math.cos(phi),.7605,.65*Math.sin(phi));
    plane.rotation.set(-Math.PI/2,0,-(phi-Math.PI/2)*.65);plane.updateMatrixWorld(true);
    const native=feltCardLocalQuad(2,3);
    const points=native.map(([x,y])=>plane.localToWorld(new THREE.Vector3(x,y,0)));
    const quad=points.map(p=>{const q=p.clone().project(camera);return [(q.x+1)*640,(1-q.y)*360];});
    const h=quadMatrix(quad,100,143.5);
    [[0,0],[100,0],[100,143.5],[0,143.5]].forEach(([x,y],i)=>{
      const z=h[3]*x+h[7]*y+1,px=(h[0]*x+h[4]*y+h[12])/z,py=(h[1]*x+h[5]*y+h[13])/z;
      assert.ok(Math.hypot(px-quad[i][0],py-quad[i][1])<1e-8);
      const hit=pointOnSurface(camera,new THREE.Vector2(px/640-1,1-py/360),.7605);
      assert.ok(hit.distanceTo(points[i])<1e-8);
    });
    assert.deepEqual(cardLandingCorners({dataset:{feltCorners:JSON.stringify(quad)}}),quad);
  }
});

test('long hands and repeated splits retain paper proportions without overlapping adjacent fans',()=>{
  for(const hands of [1,2,3,4])for(const count of [2,5,12,21]){
    let previousRight=-Infinity;
    for(let hand=0;hand<hands;hand++){
      const quads=Array.from({length:count},(_,i)=>feltCardLocalQuad(i,count,hand,hands));
      const xs=quads.flat().map(p=>p[0]);
      assert.ok(Math.min(...xs)>previousRight);
      previousRight=Math.max(...xs);
      for(const q of quads)assert.ok(Math.abs((q[1][0]-q[0][0])/(q[0][1]-q[3][1])-.072/.103)<1e-8);
    }
    assert.ok(previousRight<.11,'whole split group remains inside its seat');
  }
});
