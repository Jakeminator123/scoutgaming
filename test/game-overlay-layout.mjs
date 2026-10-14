import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {projectGamePlane,projectTableGamePlane,layoutGameOverlay,BLACKJACK_COMPACT_QUERY} from '../web/public/game-overlay-layout.mjs';
import {stageGeometry,tableRect} from '../packages/presentation/compositor/geometry.js';
import {sceneForComposition,defaultCompositionSettings,defaultBlackjackTableGeometry} from '../web/public/composition-settings.mjs';
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

for(const [width,height,boxes]of [[390,844,[0,1,2]],[390,844,[2,3,4]],[390,844,[4,5,6]],[1920,1080,[0,1,2,3,4,5,6]]]){
  test(`saved board anchors follow image placement, not dealer crop, at ${width}x${height}: ${boxes}`,()=>{
    const s=defaultCompositionSettings(),layout=width<height?'mobile':'desktop';s[layout].table.y=.35;
    const board=defaultBlackjackTableGeometry('00000000-0000-4000-8000-000000000002');
    const image={width:1672,height:941},scene=sceneForComposition(s,layout),g=stageGeometry(scene),viewport={width,height};
    const rect=tableRect(scene,image,g),plane=projectTableGamePlane(g.dims,rect,viewport,board);
    const compact=width<=860,result=layoutGameOverlay(plane,boxes,{left:12,right:width-12,top:80,bottom:height-100},{compact});
    assert.equal(result.adjusted,true);assert.equal(result.geometryWarning,'');
    assert.deepEqual(result.seats.map(row=>row.box),boxes);
    boxes.forEach((box,i)=>{
      const slot=board[compact?'mobile':'desktop'].seats[compact?i:box],anchor=result.positions[String(box+1)];
      close(result.x+anchor.cx*result.scale,plane.rect.x+slot.card.x*plane.rect.width);
      close(result.y+anchor.cy*result.scale,plane.rect.y+slot.card.y*plane.rect.height);
      close(result.seats[i].x,plane.rect.x+slot.bet.x*plane.rect.width);
      close(result.seats[i].y,plane.rect.y+slot.bet.y*plane.rect.height);
    });
    scene.stage[layout]={scale:3,x:.7,y:-1};const moved=stageGeometry(scene);
    assert.deepEqual(projectTableGamePlane(moved.dims,tableRect(scene,image,moved),viewport,board),plane);
    scene.tablePlacement.y+=.1;
    const shifted=projectTableGamePlane(g.dims,tableRect(scene,image,g),viewport,board);
    close(shifted.rect.y-plane.rect.y,g.dims[1]*.1*Math.min(width/g.dims[0],height/g.dims[1]));
  });
}
test('static geometry reports clipped or overlapping controls instead of silently moving them off the board',()=>{
  const board=defaultBlackjackTableGeometry('00000000-0000-4000-8000-000000000002');
  const plane={tableGeometry:board,rect:{x:0,y:700,width:390,height:220}};
  const r=layoutGameOverlay(plane,[4,5,6],{left:12,right:378,top:80,bottom:650},{compact:true});
  assert.match(r.geometryWarning,/ryms inte/);close(r.y,700);
  plane.rect.y=300;board.mobile.seats[1].bet.x=board.mobile.seats[0].bet.x;
  assert.match(layoutGameOverlay(plane,[2,3,4],{left:12,right:378,top:80,bottom:700},{compact:true}).geometryWarning,/ryms inte/);
});

test('actual seat layout handles compositor resize before the query change event and retains a resumed outer hand',()=>{
  const source=readFileSync(new URL('../web/public/app.mjs',import.meta.url),'utf8');
  const fragment=source.slice(source.indexOf('const COMPACT_BOXES ='),source.indexOf('layerComposition?.onGeometryChange(layoutSeats)'));
  const query={matches:false},geometry=defaultBlackjackTableGeometry('00000000-0000-4000-8000-000000000002');
  let width=1920,height=1080,projection;
  const node=()=>({style:{setProperty(){}},classList:{toggle(){}},setAttribute(){},getBoundingClientRect:()=>({left:0,top:0,width,height})});
  const scene=node(),nodes={'#scene':scene,'#banner':node(),'#table2d':node(),'#dealer-cards':node(),'#hud-bottom':{getBoundingClientRect:()=>({top:height-80,height:80})}};
  scene.append=element=>{nodes['#'+element.id]=element;};
  const plane=()=>{
    const settings=defaultCompositionSettings(),layout=query.matches?'mobile':'desktop';settings[layout].table.y=.35;
    const scene=sceneForComposition(settings,layout),g=stageGeometry(scene);
    return projectTableGamePlane(g.dims,tableRect(scene,{width:1672,height:941},g),{width,height},geometry,layout);
  };
  const context=vm.createContext({registeredFilmedProfile:()=>null,DEALER:{key:"astrid"},BLACKJACK_COMPACT_QUERY,layoutGameOverlay,matchMedia:()=>query,SEATS:7,seatEls:Array.from({length:7},node),round:null,
    $:selector=>nodes[selector],document:{createElement:node},layerComposition:{referencePlane:plane},localCards:{setProjection(value){projection=structuredClone(value);}}});
  vm.runInContext(fragment,context);assert.deepEqual(projection.boxes,[0,1,2,3,4,5,6]);
  width=390;height=844;query.matches=true;context.round={active:0,live:()=>[{box:6}]};
  // No change event has updated the app's earlier compactSeats value yet.
  vm.runInContext('layoutSeats()',context);assert.deepEqual(projection.boxes,[4,5,6]);
  width=900;height=1200;query.matches=false;
  vm.runInContext('layoutSeats()',context);assert.deepEqual(projection.boxes,[0,1,2,3,4,5,6]);
});
