import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultCompositionSettings,defaultBlackjackTableGeometry,validateCompositionSettings} from '../packages/presentation/contracts/composition-settings.mjs';
import {compositionAnchorFrames,resolveAnchorRect,rebindAnchor,projectAnchorRects,moveCompositionLayer,restoreGeometryGroup} from '../packages/presentation/runtime/composition-anchors.mjs';
import {layoutGameOverlay,projectTableGamePlane} from '../packages/presentation/runtime/game-overlay-layout.mjs';
import {createLayerComposition} from '../packages/presentation/runtime/presentation-composition.mjs';
import {stageGeometry,tableRect} from '../packages/presentation/compositor/geometry.js';
const id='00000000-0000-4000-8000-000000000002',asset={width:1672,height:941};
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const sameRect=(a,b)=>Object.keys(a).forEach(k=>close(a[k],b[k]));
function fixture(layout){const settings=defaultCompositionSettings(),board=defaultBlackjackTableGeometry(id);settings.blackjackTables=[board];settings[layout].table.y=.35;return {settings,board,frames:compositionAnchorFrames(settings,layout,asset)};}
for(const layout of ['mobile','desktop']){
  test(`${layout}: every anchor switch preserves screen position and scale, including contain margins`,()=>{
    const {settings,board,frames}=fixture(layout),g=board[layout];
    for(const group of ['cards','bets'])for(const target of ['dealer','scene','table','scene','dealer']){
      const before=resolveAnchorRect(g.anchors?.[group],frames);g.anchors??={};g.anchors[group]=rebindAnchor(g.anchors[group],target,frames);
      sameRect(before,resolveAnchorRect(g.anchors[group],frames));validateCompositionSettings(settings);
    }
    const p=projectAnchorRects(g,frames,{width:3440,height:1440}),fit=Math.min(3440/frames.scene.width,1440/frames.scene.height);
    close(p.cardsRect.x,(3440-frames.scene.width*fit)/2+frames.table.x*fit);
    close(p.cardsRect.width,frames.table.width*fit);
  });
  test(`${layout}: moving and scaling dealer leaves table and independent markers fixed`,()=>{
    const {settings,board,frames}=fixture(layout);board[layout].anchors={cards:rebindAnchor(undefined,'dealer',frames),bets:rebindAnchor(undefined,'scene',frames)};
    const moved=moveCompositionLayer(settings,layout,'dealer','x',.2),scaled=moveCompositionLayer(moved,layout,'dealer','scale',1.4),next=compositionAnchorFrames(scaled,layout,asset);
    assert.deepEqual(scaled[layout].table,settings[layout].table);sameRect(resolveAnchorRect(board[layout].anchors.bets,next),frames.table);
    close(resolveAnchorRect(board[layout].anchors.cards,next).width,frames.table.width*1.4);
    const other=layout==='mobile'?'desktop':'mobile';assert.deepEqual(scaled[other],settings[other]);
    const viewport={width:frames.scene.width,height:frames.scene.height},boxes=layout==='mobile'?[4,5,6]:[0,1,2,3,4,5,6];
    const run=f=>layoutGameOverlay({tableGeometry:board,tableLayout:layout,rect:f.table,...projectAnchorRects(board[layout],f,viewport)},boxes,{left:0,right:4000,top:0,bottom:4000});
    const a=run(frames),b=run(next);assert.deepEqual(a.seats,b.seats);close(a.controlScale,b.controlScale);assert.notEqual(a.scale,b.scale);
  });
  test(`${layout}: together transforms both layers exactly once; fixed scene anchors stay fixed`,()=>{
    const {settings,frames}=fixture(layout);
    const moved=moveCompositionLayer(settings,layout,'table','x',.15,true),m=compositionAnchorFrames(moved,layout,asset);
    close(m.dealer.x-frames.dealer.x,.15*frames.scene.width);close(m.table.x-frames.table.x,.15*frames.scene.width);
    for(const role of ['dealer','table']){
      const field=role==='dealer'?'scale':'width',next=moveCompositionLayer(settings,layout,role,field,settings[layout][role][field]*1.2,true),f=compositionAnchorFrames(next,layout,asset);
      close(f.table.width/frames.table.width,1.2);close(f.dealer.width/frames.dealer.width,1.2);
      const pivotY=role==='dealer'?frames.dealer.y+frames.dealer.height/2:frames.table.y;
      close(f.table.y,pivotY+(frames.table.y-pivotY)*1.2);close(f.dealer.y,pivotY+(frames.dealer.y-pivotY)*1.2);
    }
  });
  test(`${layout}: absent anchors retain exact old layout and linked bets retain their manual frame`,()=>{
    const {board,frames}=fixture(layout),viewport={width:390,height:844},boxes=layout==='mobile'?[4,5,6]:[0,1,2,3,4,5,6],bounds={left:0,right:390,top:0,bottom:844};
    const old=projectTableGamePlane([frames.scene.width,frames.scene.height],Object.values(frames.table),viewport,board,layout);
    assert.deepEqual(layoutGameOverlay(old,boxes,bounds),layoutGameOverlay({...old,...projectAnchorRects(board[layout],frames,viewport)},boxes,bounds));
    board[layout].anchors={bets:rebindAnchor(undefined,'scene',frames)};board[layout].anchors.bets.rect.x+=.1;
    const run=()=>layoutGameOverlay({...old,...projectAnchorRects(board[layout],frames,viewport)},boxes,bounds),manual=run();
    board[layout].betMode='under-cards';const linked=run();assert.notDeepEqual(linked.seats,manual.seats);
    delete board[layout].betMode;assert.deepEqual(run().seats,manual.seats);
  });
  test(`${layout}: reset restores only the saved group and leaves other format/points intact`,()=>{
    const {board,frames}=fixture(layout),saved=structuredClone(board);board[layout].anchors={cards:rebindAnchor(undefined,'dealer',frames),bets:rebindAnchor(undefined,'scene',frames)};
    board[layout].dealer.x=.9;board[layout].seats[0].bet.y=.8;board[layout].betMode='under-cards';
    const result=restoreGeometryGroup(board,saved,layout,'cards');assert.deepEqual(result[layout].dealer,saved[layout].dealer);
    assert.equal(result[layout].anchors.cards,undefined);assert.deepEqual(result[layout].anchors.bets,board[layout].anchors.bets);
    assert.equal(result[layout].seats[0].bet.y,.8);assert.equal(result[layout].betMode,'under-cards');
    const other=layout==='mobile'?'desktop':'mobile';assert.deepEqual(result[other],board[other]);
  });
}
test('strict anchor validation rejects unknown targets/fields, nonfinite and unbounded geometry without mutating input',()=>{
  const {settings,board,frames}=fixture('desktop');board.desktop.anchors={cards:rebindAnchor(undefined,'dealer',frames)};
  const original=structuredClone(settings);assert.deepEqual(validateCompositionSettings(settings),original);
  for(const mutate of [a=>a.cards.target='video',a=>a.cards.rect.width=0,a=>a.cards.rect.height=Infinity,a=>a.cards.rect.x=41,a=>a.cards.rect.extra=1,a=>a.extra={},a=>delete a.cards.rect.y]){
    const invalid=structuredClone(settings);mutate(invalid.blackjackTables[0].desktop.anchors);assert.throws(()=>validateCompositionSettings(invalid));
  }
  assert.deepEqual(settings,original);
});

// Admin -> referencePlane() -> overlay. Same plane the game and shared room read;
// only the GPU compositor is replaced by the shared stage/table geometry.
const backgroundId='00000000-0000-4000-8000-000000000001';
async function referencePlaneFor(settings,{width,height,framing}){
  const host={dataset:{},clientWidth:width,clientHeight:height,append(){}};
  const document={defaultView:{matchMedia:()=>({matches:width<=860})},documentElement:{dataset:{}},querySelector:()=>host,
    createElement:tag=>({tagName:tag.toUpperCase(),dataset:{},style:{setProperty(){}},complete:true,naturalWidth:asset.width,naturalHeight:asset.height,
      setAttribute(){},remove(){},addEventListener(){},removeEventListener(){},getContext:()=>({clearRect(){},drawImage(){}})})};
  class Compositor{constructor(canvas){this.canvas=canvas;}geometry(scene){return stageGeometry(scene);}tableGeometry(scene,image){return tableRect(scene,image,this.geometry(scene));}render(){}dispose(){}}
  const src=assetId=>`/api/presentation/layers/north/${assetId}`;
  const c=createLayerComposition(document,{schemaVersion:1,dealer:{enabled:true,compatibility:'per-clip'},settings,
    background:{enabled:true,mode:'image',default:backgroundId,allowed:[backgroundId]},table:{enabled:true,default:id,allowed:[id]},
    assets:[{id:backgroundId,role:'background',label:'Bakgrund',contentType:'image/png',src:src(backgroundId)},{id,role:'table',label:'Bord',contentType:'image/png',src:src(id)}]},
  {loadRuntime:async()=>({Compositor})});
  await c.prepareClip({mode:'green-screen',threshold:.23,softness:.15,despill:0},framing,{kind:'idle'});c.renderFrame({videoWidth:1080,videoHeight:1920});
  const plane=c.referencePlane();c.close();return plane;
}
const moved={scale:1.4,x:.1,y:.05};
for(const [width,height]of [[390,844],[1920,1080]]){
  const layout=width<=860?'mobile':'desktop',compact=layout==='mobile',boxes=compact?[2,3,4]:[0,1,2,3,4,5,6];
  const bounds={left:12,right:width-12,top:80,bottom:height-100};
  const scene=(dealer,anchored)=>{const {settings,board,frames}=fixture(layout);settings[layout].dealer={...dealer};
    if(anchored)board[layout].anchors={cards:rebindAnchor(undefined,'dealer',frames),bets:rebindAnchor(undefined,'dealer',frames)};return settings;};
  const overlay=plane=>layoutGameOverlay(plane,boxes,bounds,{compact});
  const same=(a,b)=>{assert.deepEqual(b.positions,a.positions);close(b.scale,a.scale);assert.deepEqual(b.seats,a.seats);close(b.controlScale,a.controlScale);assert.deepEqual(b.dealer,a.dealer);};
  test(`${layout} ${width}x${height}: default board geometry ignores Admin dealer X/Y/scale while the filmed dealer moves`,async()=>{
    const a=await referencePlaneFor(scene({scale:1,x:0,y:0}),{width,height}),b=await referencePlaneFor(scene(moved),{width,height});
    // The dealer's own source plane follows Admin: the filmed hand and prop card grow 1.4x and move.
    close(b.sourcePlane.scale/a.sourcePlane.scale,1.4);assert.ok(Math.abs(b.sourcePlane.x-a.sourcePlane.x)>10);
    // Landing point, resting card size and chip tiles stay on the table rectangle.
    const ra=overlay(a),rb=overlay(b);same(ra,rb);
    // Resting card (63 local units) no longer matches the prop card in the moved dealer's hand.
    assert.ok(rb.scale/b.sourcePlane.scale<.8,`card ${63*rb.scale}px vs prop ${63*b.sourcePlane.scale}px`);
  });
  test(`${layout} ${width}x${height}: dealer anchors follow the composition dealer, not clip framing; ${compact?"phone chip tiles stay at 1.0":"chip tiles follow the bet frame"}`,async()=>{
    const a=await referencePlaneFor(scene({scale:1,x:0,y:0},true),{width,height}),b=await referencePlaneFor(scene(moved,true),{width,height});
    const ra=overlay(a),rb=overlay(b);
    close(rb.scale/ra.scale,1.4);assert.notDeepEqual(rb.seats,ra.seats);
    // Desktop chip tiles scale with the bet frame; the phone uses a viewport-only 1.0.
    if(compact){close(ra.controlScale,1);close(rb.controlScale,1);}else close(rb.controlScale/ra.controlScale,1.4);
    // Förstoring/sidled/höjdled on the idle clip rescales the visible dealer only.
    const f=await referencePlaneFor(scene({scale:1,x:0,y:0},true),{width,height,framing:moved});
    close(f.sourcePlane.scale/a.sourcePlane.scale,1.4);same(ra,overlay(f));
  });
}
