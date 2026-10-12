import test from 'node:test';
import assert from 'node:assert/strict';
import {projectGamePlane,layoutGameOverlay} from '../web/public/game-overlay-layout.mjs';
import {stageGeometry} from '../test-videoeditor/program/web/geometry.js';
import {sceneForComposition,defaultCompositionSettings} from '../web/public/composition-settings.mjs';
import {calibration} from '../web/public/card-presentation/calibration.mjs';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const settings=defaultCompositionSettings();
for(const [width,height]of [[390,844],[493,1438],[844,390],[1920,1080],[3440,1440]]){
  test(`overlay and dealer share contain coordinates at ${width}x${height}`,()=>{
    const scene=sceneForComposition(settings,width<height?'mobile':'desktop'),g=stageGeometry(scene);
    const p=projectGamePlane(g,{width,height});
    close(p.x+540*p.scale,width/2);close(p.y+960*p.scale,height/2);
    close(p.scale,Math.min(width/g.dims[0],height/g.dims[1])*g.s);
    const shifted=structuredClone(settings);shifted[scene.layout].dealer={scale:1.6,x:.1,y:-.1};
    const q=projectGamePlane(stageGeometry(sceneForComposition(shifted,scene.layout)),{width,height});
    close(q.scale,p.scale*1.6);
    const fit=Math.min(width/g.dims[0],height/g.dims[1]);
    close(q.x+540*q.scale,width/2+.1*g.dims[0]*fit);
    close(q.y+960*q.scale,height/2-.1*g.dims[1]*fit);
  });
}
test('source framing uses height-based offsets before stage and contain',()=>{
  const g=stageGeometry(sceneForComposition(settings,'desktop'));
  const p=projectGamePlane(g,{width:1920,height:1080},{scale:.75,x:.1,y:-.2});
  close(p.scale,.5625*.75);close(p.x+540*p.scale,960+108);close(p.y+960*p.scale,540-216);
});
test('PAOW desktop crop retains all seven controls above the HUD and never claims contact',()=>{
  const s=structuredClone(settings);s.desktop.dealer={scale:2,x:0,y:.4};
  const plane=projectGamePlane(stageGeometry(sceneForComposition(s,'desktop')),{width:1920,height:1080});
  const layout=layoutGameOverlay(plane,[0,1,2,3,4,5,6],{left:12,right:1908,top:80,bottom:960});
  assert.equal(layout.adjusted,true);assert.ok(layout.scale>1);
  for(const seat of layout.seats){assert.ok(seat.y<960);assert.ok(seat.x>12&&seat.x<1908);}
  assert.ok(layout.seats[6].x-layout.seats[0].x>900,'widescreen seats no longer trapped in a 450px portrait strip');
});
for(const boxes of [[0,1,2],[2,3,4],[4,5,6]])test(`phone keeps cards, bets and server box ids together: ${boxes}`,()=>{
  const plane=projectGamePlane(stageGeometry(sceneForComposition(settings,'mobile')),{width:390,height:844});
  const result=layoutGameOverlay(plane,boxes,{left:12,right:378,top:80,bottom:650},{compact:true});
  assert.deepEqual(result.seats.map(s=>s.box),boxes);assert.equal(result.controlScale,1);
  assert.equal(result.adjusted,true);
  result.seats.forEach((seat,i)=>{
    const anchor=calibration.positions[String(seat.box+1)],offset=result.offsets[String(seat.box+1)];
    close(result.x+(anchor.cx+offset)*result.scale,seat.x);
    close(result.y+anchor.cy*result.scale+108*result.scale,seat.y);
    assert.ok(seat.x-49>=12&&seat.x+49<=378);
    if(i)assert.ok(seat.x-result.seats[i-1].x>110);
  });
  assert.ok(result.dealer.x>=12&&result.dealer.x<=378);
});
test('different source crop disables contact even if the plane fits',()=>{
  const p={x:420,y:0,scale:.5625,sourceAligned:false};
  assert.equal(layoutGameOverlay(p,[0,1,2,3,4,5,6],{left:0,right:1920,top:0,bottom:1080}).adjusted,true);
});
test('compact reflow reserves split-hand space and nonoverlapping touch targets at small and large phone sizes',()=>{
  for(const width of [320,390,768])for(const factor of [.5,1,1.4,3]){
    const p={x:-width/2,y:-100,scale:width/1080*factor};
    const r=layoutGameOverlay(p,[0,1,2],{left:12,right:width-12,top:80,bottom:800},{compact:true});
    for(const seat of r.seats){assert.ok(seat.x-144*r.scale>=12-.001);assert.ok(seat.x+90*r.scale<=width-12+.001);}
    assert.ok(r.seats[1].x-r.seats[0].x>=98-.001);
  }
});
test('short landscape and temporarily collapsed HUD bounds never create negative scale',()=>{
  const p={x:0,y:0,scale:2};
  for(const bottom of [240,80,0]){
    const r=layoutGameOverlay(p,[0,1,2,3,4,5,6],{left:12,right:832,top:80,bottom});
    assert.ok(Number.isFinite(r.scale)&&r.scale>0);
  }
});
