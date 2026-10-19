import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultCompositionSettings,defaultBlackjackTableGeometry,validateCompositionSettings} from '../packages/presentation/contracts/composition-settings.mjs';
import {compositionAnchorFrames,resolveAnchorRect,rebindAnchor,projectAnchorRects,moveCompositionLayer,restoreGeometryGroup} from '../packages/presentation/runtime/composition-anchors.mjs';
import {layoutGameOverlay,projectTableGamePlane} from '../packages/presentation/runtime/game-overlay-layout.mjs';
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
