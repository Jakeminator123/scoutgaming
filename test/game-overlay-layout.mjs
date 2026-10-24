import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {projectGamePlane,projectTableGamePlane,layoutGameOverlay,BLACKJACK_COMPACT_QUERY} from '../packages/presentation/runtime/game-overlay-layout.mjs';
import {stageGeometry,tableRect} from '../packages/presentation/compositor/geometry.js';
import {sceneForComposition,defaultCompositionSettings,defaultBlackjackTableGeometry,defaultBlackjackAutoScale} from '../packages/presentation/contracts/composition-settings.mjs';
import {calibration} from '../packages/presentation/contracts/calibration.mjs';
import {DRAGAN_KEVIN_PROFILE} from '../packages/presentation/contracts/filmed-profiles/kevin-dragan-f15b2af1.mjs';
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
  const source=readFileSync(new URL('../services/game/public/app.mjs',import.meta.url),'utf8');
  const fragment=source.slice(source.indexOf('const COMPACT_BOXES ='),source.indexOf('layerComposition?.onGeometryChange(layoutSeats)'));
  const query={matches:false},geometry=defaultBlackjackTableGeometry('00000000-0000-4000-8000-000000000002');
  let width=1920,height=1080,projection;
  const node=()=>({dataset:{},style:{setProperty(){}},classList:{toggle(){}},setAttribute(){},getBoundingClientRect:()=>({left:0,top:0,width,height})});
  const scene=node(),nodes={'#scene':scene,'#banner':node(),'#table2d':node(),'#dealer-cards':node(),'#hud-bottom':{getBoundingClientRect:()=>({top:height-80,height:80})}};
  scene.append=element=>{nodes['#'+element.id]=element;};
  const plane=()=>{
    const settings=defaultCompositionSettings(),layout=query.matches?'mobile':'desktop';settings[layout].table.y=.35;
    const scene=sceneForComposition(settings,layout),g=stageGeometry(scene);
    return projectTableGamePlane(g.dims,tableRect(scene,{width:1672,height:941},g),{width,height},geometry,layout);
  };
  const context=vm.createContext({layoutDealControl(){},cardViewChoice:{hidden:true},cardView:'raised',registeredFilmedProfile:()=>null,DEALER:{key:"astrid"},BLACKJACK_COMPACT_QUERY,layoutGameOverlay,matchMedia:()=>query,SEATS:7,seatEls:Array.from({length:7},node),round:null,
    $:selector=>nodes[selector],document:{createElement:node},layerComposition:{referencePlane:plane},localCards:{setProjection(value){projection=structuredClone(value);}}});
  vm.runInContext(fragment,context);assert.deepEqual(projection.boxes,[0,1,2,3,4,5,6]);
  width=390;height=844;query.matches=true;context.round={active:0,live:()=>[{box:6}]};
  // No change event has updated the app's earlier compactSeats value yet.
  vm.runInContext('layoutSeats()',context);assert.deepEqual(projection.boxes,[4,5,6]);
  width=900;height=1200;query.matches=false;
  vm.runInContext('layoutSeats()',context);assert.deepEqual(projection.boxes,[0,1,2,3,4,5,6]);
});

for(const width of [320,390,768,1440])test('linked bets clear the resting cards and totals in either view at '+width,()=>{
  const board=defaultBlackjackTableGeometry('00000000-0000-4000-8000-000000000002');
  const compact=width<=860,layout=compact?'mobile':'desktop',boxes=compact?[4,5,6]:[0,1,2,3,4,5,6];
  board[layout].betMode='under-cards';
  board[layout].seats.forEach(seat=>{seat.bet={x:0,y:0};});
  const plane={rect:{x:0,y:160,width,height:width*.56},tableGeometry:board,tableLayout:layout};
  const bounds={left:0,right:width,top:0,bottom:1500};
  const raised=layoutGameOverlay(plane,boxes,bounds,{compact,cardView:'raised'});
  const flat=layoutGameOverlay(plane,boxes,bounds,{compact,cardView:'table'});
  for(let i=0;i<boxes.length;i++){
    for(const [result,depth]of [[raised,1],[flat,.62]]){
      const anchor=result.positions[String(boxes[i]+1)],seat=result.seats[i];
      close(seat.x,result.x+anchor.cx*result.scale);
      assert.ok(seat.y-26*result.controlScale>result.y+(anchor.cy+85/2*depth+34)*result.scale,'chip clears card and total');
    }
    assert.ok(flat.seats[i].y<raised.seats[i].y,'flat view brings the target closer without moving its card anchor');
  }
  assert.deepEqual(flat.positions,raised.positions);assert.deepEqual(flat.boxes,boxes);
});

test('compact collision check counts unscaled touch buttons even when graphics shrink',()=>{
  const board=defaultBlackjackTableGeometry('00000000-0000-4000-8000-000000000002');
  board.mobile.seats.forEach((row,i)=>row.bet={x:(55+i*93)/320,y:.5});
  const result=layoutGameOverlay({tableGeometry:board,rect:{x:0,y:100,width:320,height:180}},[2,3,4],{left:0,right:320,top:0,bottom:800},{compact:true});
  assert.match(result.geometryWarning,/ryms inte/,'93px gaps overlap the actual 98px target row');
});

test('autoScale parts are independent: landing, card size and chips each follow the dealer plane only when chosen',()=>{
  const board=defaultBlackjackTableGeometry('00000000-0000-4000-8000-000000000002'),rect={x:300,y:500,width:1200,height:675};
  const dealerPlane={x:420,y:-200,scale:.7},boxes=[0,1,2,3,4,5,6],bounds={left:0,right:1920,top:0,bottom:1500};
  const run=autoScale=>{const b=structuredClone(board);if(autoScale)b.desktop.autoScale=autoScale;
    return layoutGameOverlay({tableGeometry:b,tableLayout:'desktop',rect,dealerPlane},boxes,bounds,{filmedProfile:DRAGAN_KEVIN_PROFILE});};
  const manual=run(),screen=(r,seat)=>({x:r.x+r.positions[seat].cx*r.scale,y:r.y+r.positions[seat].cy*r.scale});
  // A plane without the dealer (an older caller) keeps the exact manual layout.
  assert.deepEqual(layoutGameOverlay({tableGeometry:{...board,desktop:{...board.desktop,autoScale:defaultBlackjackAutoScale()}},tableLayout:'desktop',rect},boxes,bounds),
    layoutGameOverlay({tableGeometry:board,tableLayout:'desktop',rect},boxes,bounds));
  const landing=run({landing:true,cardSize:false,chips:false});
  close(landing.scale,manual.scale);assert.deepEqual(landing.seats,manual.seats);assert.equal(landing.followCards,false);
  for(const seat of ['dealer','1','4','7']){const p=screen(landing,seat);close(p.x,420+calibration.positions[seat].cx*.7);close(p.y,-200+calibration.positions[seat].cy*.7);}
  const size=run({landing:false,cardSize:true,chips:false});
  close(size.scale,.7*78/63);for(const seat of ['dealer','4'])for(const axis of ['x','y'])close(screen(size,seat)[axis],screen(manual,seat)[axis]);
  assert.deepEqual(size.seats,manual.seats);close(size.controlScale,manual.controlScale);
  const chips=run({landing:false,cardSize:false,chips:true});
  close(chips.scale,manual.scale);close(chips.controlScale,.7);assert.equal(chips.followCards,true);
  chips.seats.forEach((seat,i)=>{const card=screen(chips,String(i+1));close(seat.x,card.x);assert.ok(seat.y>card.y);});
});

test('phone autoScale: three seats land on their own filmed boxes, resumed outer hands are reported, chip tiles keep a 0.8 minimum',()=>{
  const board=defaultBlackjackTableGeometry('00000000-0000-4000-8000-000000000002'),rect={x:0,y:420,width:390,height:220};
  board.mobile.autoScale=defaultBlackjackAutoScale();
  // The mobile dealer plane, centred on box 4 like an Admin dealer zoom.
  const plane=scale=>({x:195-540*scale,y:422-960*scale,scale});
  const run=(scale,boxes,adjust)=>{const b=structuredClone(board);if(adjust)b.mobile.autoScale.adjust=adjust;
    return layoutGameOverlay({tableGeometry:b,tableLayout:'mobile',rect,dealerPlane:plane(scale)},boxes,{left:12,right:378,top:80,bottom:800},{compact:true});};
  for(const boxes of [[0,1,2],[2,3,4],[4,5,6]]){
    const r=run(.8,boxes),d=plane(.8);assert.deepEqual(r.seats.map(s=>s.box),boxes);
    boxes.forEach((box,i)=>{const seat=String(box+1),x=d.x+calibration.positions[seat].cx*d.scale;
      close(r.x+r.positions[seat].cx*r.scale,x);close(r.y+r.positions[seat].cy*r.scale,d.y+calibration.positions[seat].cy*d.scale);if(boxes[0]===2)close(r.seats[i].x,x);});
    // Never moved off its filmed box: a hand outside the zoomed phone frame is reported.
    assert.equal(r.geometryWarning,boxes[0]===2?'':'Kort eller insatsplatser ryms inte. Justera dealerns placering i Sammansättning.');
  }
  // At the plate's own size the filmed boxes are 52 px apart: the touch row overlaps.
  const small=run(.36,[2,3,4]);assert.equal(small.geometryWarning,'');
  for(let i=1;i<small.seats.length;i++)assert.ok(small.seats[i].x-small.seats[i-1].x>=98);
  const shifted=run(.36,[2,3,4],{chips:{dx:.1,dy:0,scale:1}});
  small.seats.forEach((seat,i)=>close(shifted.seats[i].x-seat.x,.1*1080*.36));
  close(run(.36,[2,3,4]).controlScale,.8);close(run(1.2,[2,3,4]).controlScale,1.2);
  close(run(1.2,[2,3,4],{chips:{dx:0,dy:0,scale:.5}}).controlScale,.8);close(run(1.2,[2,3,4],{chips:{dx:0,dy:0,scale:1.5}}).controlScale,1.8);
});

test('published card display wins over a browser preference and stays format-specific',()=>{
 const board=defaultBlackjackTableGeometry('00000000-0000-4000-8000-000000000002');
 board.mobile.cardView='table';board.desktop.cardView='raised';
 for(const layout of ['mobile','desktop']){
  const compact=layout==='mobile',boxes=compact?[2,3,4]:[0,1,2,3,4,5,6];
  const plane={rect:{x:0,y:0,width:900,height:500},tableGeometry:board,tableLayout:layout};
  const result=layoutGameOverlay(plane,boxes,{left:0,right:900,top:0,bottom:1000},{compact,cardView:compact?'raised':'table'});
  assert.equal(result.cardView,board[layout].cardView);assert.deepEqual(result.boxes,boxes);
 }
 delete board.mobile.cardView;
 assert.equal(layoutGameOverlay({rect:{x:0,y:0,width:390,height:500},tableGeometry:board,tableLayout:'mobile'},[2,3,4],{left:0,right:390,top:0,bottom:844},{compact:true}).cardView,'table');
});

test('fractional manual offsets on a 320px phone do not create false overlap warnings',()=>{
 const board=defaultBlackjackTableGeometry('00000000-0000-4000-8000-000000000002');
 board.mobile.autoScale={...defaultBlackjackAutoScale(),adjust:{chips:{dx:-.005,dy:0,scale:1}}};
 const result=layoutGameOverlay({tableGeometry:board,tableLayout:'mobile',rect:{x:0,y:420,width:320,height:180},dealerPlane:{x:160-540*.34,y:422-960*.34,scale:.34}},[2,3,4],{left:12,right:308,top:80,bottom:800},{compact:true});
 assert.equal(result.geometryWarning,'');[61.164,159.164,257.164].forEach((x,i)=>close(result.seats[i].x,x));
});
