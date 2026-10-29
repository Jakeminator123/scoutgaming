import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {AI_TABLE_FILL,FILMED_TABLE_BOX_PAD,filmedTableBody,filmedTableFit,filmedTableReach,filmedTableRequestSize,filmedTableSvg,filmedTableTemplate} from '../lib/filmed-table-template.mjs';
import {landingCheck,tableLandingZones} from '../lib/ai-table-landing-check.mjs';
import {AI_TABLE_STYLES} from '../lib/ai-table-style.mjs';
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
  // Two pixels per desktop scene pixel (607.5 -> 1215), down to the plane's bottom edge.
  assert.deepEqual(filmedTableTemplate('paow').canvas,{width:1215,height:2074});assert.equal(filmedTableTemplate('paow').plane.scale,1.125);
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
  // The graphic's size follows the placement's table width: facit's 1920 x 1404.
  const template=filmedTableTemplate('paow',{composition});
  assert.deepEqual(template.canvas,{width:1920,height:1404});assert.deepEqual(filmedTableRequestSize(template),{width:1920,height:1408});
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
  for (const part of ['reference','surface','mask','boxes']) {
    const svg=filmedTableSvg(template,part);
    assert.match(svg,new RegExp(`^<svg xmlns="http://www.w3.org/2000/svg" width="${template.canvas.width}" height="${template.canvas.height}"`));
    assert.doesNotMatch(svg,/<text|<image|href=/);
  }
  const boxes=filmedTableSvg(template,'boxes');
  for (const seat of [...template.seats,template.dealer]) assert.ok(boxes.includes(`<rect x="${seat.box.x}" y="${seat.box.y}" width="${seat.box.width}" height="${seat.box.height}"`));
  assert.throws(()=>filmedTableSvg(template,'other'));
});

test('the table width follows the dealer\'s reach: boxes fill 70-80 % and still land exactly on the filmed landings',()=>{
  // Default placement: the boxes fill 89 % of the graphic, so the table widens around its centre.
  const fit=filmedTableFit('paow');
  assert.equal(fit.changed,true);assert.ok(Math.abs(fit.current.share-.8926)<.001);
  assert.ok(Math.abs(fit.suggested.share-AI_TABLE_FILL.target)<.005,String(fit.suggested.share));
  // Bordsbredd %: 119 % on the phone and 37.7 % on desktop instead of 100 % and 31.6 %.
  assert.deepEqual([fit.suggested.composition.mobile.table.width,fit.suggested.composition.desktop.table.width].map(value=>Math.round(value*1000)/1000),[1.19,.377]);
  for (const layout of ['mobile','desktop']) for (const key of ['x','y']) assert.equal(fit.suggested.composition[layout].table[key],fit.current.composition[layout].table[key]);
  const template=filmedTableTemplate('paow',{composition:fit.suggested.composition});
  for (const layout of ['mobile','desktop']) for (const point of scenePoints(template,fit.suggested.composition,layout)) {
    assert.ok(Math.abs(point.box.x-point.card.x)<.05&&Math.abs(point.box.y-point.card.y)<.05,`${layout} ${point.id}`);
  }
  // The table-template draft's 50 % is too wide (boxes 56 %): it narrows to the same table.
  const facit=defaultCompositionSettings();facit.desktop.table={width:.5,x:0,y:.35};facit.mobile.table={width:1.58,x:0,y:.35};
  const narrow=filmedTableFit('paow',facit);
  assert.ok(narrow.current.share<.6&&narrow.changed);assert.ok(Math.abs(narrow.suggested.share-.75)<.005);
  assert.ok(Math.abs(narrow.suggested.composition.desktop.table.width-fit.suggested.composition.desktop.table.width)<.002,'one reach, one width');
  // Inside the range nothing changes; no profile gives no suggestion.
  const kept=filmedTableFit('paow',fit.suggested.composition);
  assert.equal(kept.changed,false);assert.deepEqual(kept.suggested.composition,fit.suggested.composition);
  assert.equal(filmedTableFit('astrid'),null);assert.equal(filmedTableFit('paow',{mobile:{}}),null);
  assert.deepEqual(filmedTableReach(template),{...filmedTableReach(template),share:fit.suggested.share});
});

// Point in polygon (even-odd) for the body's closed outlines.
function inside([x,y],polygon) {
  let hit=false;
  for (let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const [xi,yi]=polygon[i],[xj,yj]=polygon[j];
    if ((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi) hit=!hit;
  }
  return hit;
}
test('the table body is a half-moon whose felt holds every box, with rail, apron and a pedestal down to the frame',()=>{
  const fit=filmedTableFit('paow'),template=filmedTableTemplate('paow',{composition:fit.suggested.composition}),body=filmedTableBody(template);
  assert.equal(body.open,false);assert.ok(body.exponent>=2&&body.exponent<=8);
  const felt=[[body.centre-body.half,body.top],[body.centre+body.half,body.top],...[...body.edge].reverse()];
  for (const seat of [...template.seats,template.dealer]) for (const corner of [[seat.box.x,seat.box.y],[seat.box.x+seat.box.width,seat.box.y],
    [seat.box.x,seat.box.y+seat.box.height],[seat.box.x+seat.box.width,seat.box.y+seat.box.height]]) assert.ok(inside(corner,felt),`${seat.id??'dealer'} ${corner}`);
  // The player sits close: the felt edge is just past the box row at the centre, the rail right after it.
  const four=template.seats.find(seat=>seat.id==='4'),centre=body.edge.reduce((best,row)=>Math.abs(row[0]-body.centre)<Math.abs(best[0]-body.centre)?row:best);
  const below=centre[1]-(four.box.y+four.box.height);
  assert.ok(below>0&&below<template.card.height*.5,String(below));
  // The ends turn up to the back edge just behind the dealer's spot; the rail is outside the felt edge.
  for (const line of [body.edge,body.inlayEdge,body.railEdge,body.apronEdge]) { assert.equal(line[0][1],body.top);assert.equal(line.at(-1)[1],body.top); }
  assert.ok(body.top<template.dealer.box.y&&body.top>=template.felt.top);
  for (const [index,[x,y]] of body.edge.entries()) assert.ok(body.railEdge[index][1]>=y-.01&&Math.abs(body.railEdge[index][0]-body.centre)>=Math.abs(x-body.centre)-.01);
  assert.ok(body.pedestal&&body.pedestal.bottom===template.canvas.height&&body.pedestal.top<template.canvas.height);
  // Boxes over nearly the whole graphic (the default 89 %): no room for the turn, the rail runs off both sides.
  const open=filmedTableBody(filmedTableTemplate('paow'));
  assert.equal(open.open,true);assert.equal(open.edge[0][0],0);assert.equal(open.edge.at(-1)[0],1215);
});

test('the 3D mock-up keeps the landings calm for every style (landing check), and the mask covers the whole body',async()=>{
  const fit=filmedTableFit('paow'),template=filmedTableTemplate('paow',{composition:fit.suggested.composition});
  for (const [id,style] of Object.entries(AI_TABLE_STYLES)) {
    const image=sharp(Buffer.from(filmedTableSvg(template,'surface',{look:style.look??undefined})));
    const check=await landingCheck(image,tableLandingZones(template),{stroke:style.stroke});
    assert.equal(check.ok,true,`${id}: ${JSON.stringify(check.worst)}`);
  }
  const {data,info}=await sharp(Buffer.from(filmedTableSvg(template,'mask'))).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const alpha=(x,y)=>data[(Math.round(y)*info.width+Math.round(x))*4+3];
  for (const seat of [...template.seats,template.dealer]) assert.equal(alpha(seat.center.x,seat.center.y),255);
  const body=filmedTableBody(template);
  assert.equal(alpha(body.centre,body.railEdge[48][1]-2),255,'the rail');assert.equal(alpha(body.centre,template.canvas.height-2),255,'the pedestal');
  assert.equal(alpha(4,4),0);assert.equal(alpha(4,template.canvas.height-2),0);assert.equal(alpha(body.centre,body.top-4),0,'behind the back edge');
  assert.throws(()=>filmedTableSvg(template,'reference',{look:{felt:'red'}}),/invalid_table_look/);
});
