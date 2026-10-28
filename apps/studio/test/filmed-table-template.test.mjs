import test from 'node:test';
import assert from 'node:assert/strict';
import {FILMED_TABLE_BOX_PAD,filmedTableRequestSize,filmedTableSvg,filmedTableTemplate} from '../lib/filmed-table-template.mjs';
import {registeredFilmedProfile} from '../../../packages/presentation/contracts/filmed-profiles/registry.mjs';
import {defaultCompositionSettings} from '../../../packages/presentation/contracts/composition-settings.mjs';
import {stageGeometry,tableRect} from '../../../packages/presentation/compositor/geometry.js';

// The compositor's own placement, not the template's mapping: where a landed
// card is drawn in the scene, and where the template's box lands once the
// graphic is placed as a table layer.
function scenePoints(template,composition,layout) {
  const scene={layout,stage:{mobile:composition.mobile.dealer,desktop:composition.desktop.dealer},tablePlacement:composition[layout].table};
  const geometry=stageGeometry(scene),[x,y,width,height]=tableRect(scene,template.canvas,geometry);
  const profile=registeredFilmedProfile(template.dealerId);
  return [...template.seats,{id:'dealer',...template.dealer}].map(seat=>({id:seat.id,
    card:{x:geometry.x+profile.positions[seat.id].cx*geometry.s,y:geometry.y+profile.positions[seat.id].cy*geometry.s},
    box:{x:x+seat.center.x*width/template.canvas.width,y:y+seat.center.y*height/template.canvas.height}}));
}

test('boxes sit exactly where the filmed dealer lands, on phone and desktop, with the default composition',()=>{
  const composition=defaultCompositionSettings();
  for (const dealerId of ['paow','dragan']) {
    const template=filmedTableTemplate(dealerId),profile=registeredFilmedProfile(dealerId);
    assert.equal(template.profileId,profile.id);
    assert.equal(template.seats.length,7);assert.deepEqual(template.seats.map(seat=>seat.id),['1','2','3','4','5','6','7']);
    for (const layout of ['mobile','desktop']) for (const point of scenePoints(template,composition,layout)) {
      assert.ok(Math.abs(point.box.x-point.card.x)<.02&&Math.abs(point.box.y-point.card.y)<.02,`${dealerId} ${layout} ${point.id}`);
    }
    // Each box holds the landed prop card with the template's felt margin.
    for (const seat of [...template.seats,template.dealer]) {
      assert.ok(Math.abs(seat.box.width-(profile.card.width+2*FILMED_TABLE_BOX_PAD)*template.plane.scale)<.02);
      assert.ok(Math.abs(seat.box.height-(profile.card.height+2*FILMED_TABLE_BOX_PAD)*template.plane.scale)<.02);
      assert.ok(seat.box.x>=0&&seat.box.x+seat.box.width<=template.canvas.width&&seat.box.y>=template.felt.top);
    }
  }
});

test('other placements are computed the same way, and a phone/desktop mismatch gives no template',()=>{
  // The table-template draft's placement: desktop 50 % at y 35 %, the phone at the same plane width.
  const composition=defaultCompositionSettings();
  composition.desktop.table={width:.5,x:0,y:.35};composition.mobile.table={width:.5*1920/(1080/1920)/1080,x:0,y:.35};
  const template=filmedTableTemplate('paow',{composition,width:1920}),profile=registeredFilmedProfile('paow');
  assert.ok(Math.abs(template.plane.scale-1.125)<1e-9);assert.ok(Math.abs(template.plane.offset.y-672)<.01);
  for (const layout of ['mobile','desktop']) for (const point of scenePoints(template,composition,layout)) {
    assert.ok(Math.abs(point.box.x-point.card.x)<.05&&Math.abs(point.box.y-point.card.y)<.05,`${layout} ${point.id}`);
  }
  const seat4=template.seats.find(seat=>seat.id==='4');
  assert.ok(Math.abs(seat4.center.x-(profile.positions['4'].cx-template.plane.offset.x)*1.125)<.01);
  const skewed=defaultCompositionSettings();skewed.mobile.table={width:1,x:.1,y:.04};
  assert.equal(filmedTableTemplate('paow',{composition:skewed}),null);
});

// Facit: the table-template work's bordsmatt-paow.json (2026-10-28), measured
// independently with the runtime's layoutGameOverlay. Its graphic is 1920 px
// wide at desktop 50 % / y 35 % and phone 158 % / y 35 %; rows are
// [seat, centre u, centre v, box x, box y, box width, box height] in table px.
const PAOW_FACIT=[['1',476.25,397.13,417.75,322.88,117,148.5],['2',637.13,453.38,578.63,379.13,117,148.5],['3',798,487.13,739.5,412.88,117,148.5],
  ['4',960,498.38,901.5,424.13,117,148.5],['5',1122,487.13,1063.5,412.88,117,148.5],['6',1282.88,453.38,1224.38,379.13,117,148.5],
  ['7',1443.75,397.13,1385.25,322.88,117,148.5],['dealer',960,250.88,901.5,176.63,117,148.5]];
test('the same computation reproduces the PAOW table measurements (bordsmatt-paow.json) for its placement',()=>{
  const composition=defaultCompositionSettings();
  composition.desktop.table={width:.5,x:0,y:.35};composition.mobile.table={width:1.58,x:0,y:.35};
  const template=filmedTableTemplate('paow',{composition,width:1920});
  assert.ok(Math.abs(template.plane.scale-1.125)<1e-3);assert.deepEqual(template.plane.offset,{x:-313.33,y:672});
  assert.deepEqual(template.card,{width:87.75,height:119.25});
  for (const [id,u,v,x,y,width,height] of PAOW_FACIT) {
    const seat=id==='dealer'?template.dealer:template.seats.find(row=>row.id===id);
    for (const [actual,expected] of [[seat.center.x,u],[seat.center.y,v],[seat.box.x,x],[seat.box.y,y],[seat.box.width,width],[seat.box.height,height]]) {
      assert.ok(Math.abs(actual-expected)<=.011,`${id}: ${actual} vs ${expected}`);
    }
  }
});

test('dealers without a filmed profile and impossible sizes get no template',()=>{
  for (const dealerId of ['astrid','ny-dealer','',null,undefined]) assert.equal(filmedTableTemplate(dealerId),null);
  assert.equal(filmedTableTemplate('paow',{width:100}),null);assert.equal(filmedTableTemplate('paow',{width:5000}),null);
});

test('renderer size keeps the template aspect in multiples of 16 within the model limits',()=>{
  for (const template of [filmedTableTemplate('paow'),filmedTableTemplate('paow',{width:1600})]) {
    const size=filmedTableRequestSize(template);
    assert.equal(size.width%16,0);assert.equal(size.height%16,0);
    assert.ok(size.width*size.height>=655_360&&size.width*size.height<=8_294_400&&Math.max(size.width,size.height)<=3840);
    assert.ok(Math.abs(size.width/size.height-template.canvas.width/template.canvas.height)<.02);
  }
});

test('the SVG parts carry the exact boxes and no text',()=>{
  const template=filmedTableTemplate('paow');
  for (const part of ['reference','mask','boxes']) {
    const svg=filmedTableSvg(template,part);
    assert.match(svg,new RegExp(`^<svg xmlns="http://www.w3.org/2000/svg" width="${template.canvas.width}" height="${template.canvas.height}"`));
    assert.doesNotMatch(svg,/<text|<image|href=/);
  }
  const boxes=filmedTableSvg(template,'boxes');
  for (const seat of [...template.seats,template.dealer]) assert.ok(boxes.includes(`<rect x="${seat.box.x}" y="${seat.box.y}" width="${seat.box.width}" height="${seat.box.height}"`));
  assert.throws(()=>filmedTableSvg(template,'other'));
});
