// Pure geometry for AI table graphics: where a filmed dealer's cards land on a
// table graphic placed by a scene template's composition (or the composition
// defaults). Everything is computed at call time from the filmed profile
// registry and that composition; no measurement is copied into Studio.
// Dealers without a filmed profile get null.
import {registeredFilmedProfile} from '../../../packages/presentation/contracts/filmed-profiles/registry.mjs';
import {validateFilmedDealProfile} from '../../../packages/presentation/contracts/filmed-profile.mjs';
import {defaultCompositionSettings,validateCompositionSettings} from '../../../packages/presentation/contracts/composition-settings.mjs';
import {stageGeometry,tableRect} from '../../../packages/presentation/compositor/geometry.js';

// Felt around a landed card, in filmed-plane pixels (the table-template draft's 13 px).
export const FILMED_TABLE_BOX_PAD = 13;
// Phone and desktop percentages are whole numbers in Admin; allow that rounding.
const LAYOUT_TOLERANCE = .5;
const SEATS = ['1','2','3','4','5','6','7'];
const round = value => Math.round(value*100)/100;
const rect = (center,width,height) => ({x:round(center.x-width/2),y:round(center.y-height/2),width:round(width),height:round(height)});

// The table rectangle in filmed-plane pixels for one layout. Width and position
// do not depend on the graphic's aspect, so a unit aspect is enough here.
function tableInPlane(composition,layout) {
  const scene={layout,stage:{mobile:composition.mobile.dealer,desktop:composition.desktop.dealer},tablePlacement:composition[layout].table};
  const geometry=stageGeometry(scene),[x,y,width]=tableRect(scene,{width:1,height:1},geometry);
  return {x:(x-geometry.x)/geometry.s,y:(y-geometry.y)/geometry.s,width:width/geometry.s,sceneWidth:width};
}

// Least-squares arc y = a + b(x - centre)^2 through the seat landings. Filmed
// seats bend toward the camera in the middle, so the rail follows the same arc.
function seatArc(points,centre) {
  const rows=points.map(point=>[(point.x-centre)**2,point.y]),n=rows.length;
  const su=rows.reduce((sum,[u])=>sum+u,0),sy=rows.reduce((sum,[,y])=>sum+y,0);
  const suu=rows.reduce((sum,[u])=>sum+u*u,0),suy=rows.reduce((sum,[u,y])=>sum+u*y,0);
  const det=n*suu-su*su;
  if (!Number.isFinite(det)||Math.abs(det)<1e-9) return null;
  const b=(n*suy-su*sy)/det,a=(sy-b*su)/n;
  return {a,b,centre};
}

/**
 * Landing template for a filmed dealer's table graphic, or null when the dealer
 * has no filmed profile, the placement differs between phone and desktop, or
 * the graphic would exceed the image model's limits. width is the graphic's
 * pixel width; by default two pixels per desktop scene pixel, so the table
 * stays sharp on a 4K or retina desktop. The graphic reaches the plane's bottom.
 */
export function filmedTableTemplate(dealerId,{profileFor=registeredFilmedProfile,composition=defaultCompositionSettings(),width}={}) {
  const profile=typeof dealerId==='string'?profileFor(dealerId):null;
  if (!profile) return null;
  validateFilmedDealProfile(profile);
  // The compositor's stage geometry is the 1080 x 1920 filmed plane.
  if (profile.plane.width!==1080||profile.plane.height!==1920) return null;
  const [mobile,desktop]=['mobile','desktop'].map(layout=>tableInPlane(composition,layout));
  // One graphic serves both formats only when both place it on the same plane rectangle.
  if (['x','y','width'].some(key=>!Number.isFinite(desktop[key])||Math.abs(mobile[key]-desktop[key])>LAYOUT_TOLERANCE)||desktop.width<=0) return null;
  const canvasWidth=width??Math.round(2*desktop.sceneWidth);
  if (!Number.isSafeInteger(canvasWidth)||canvasWidth<256||canvasWidth>3840) return null;
  const scale=canvasWidth/desktop.width,toImage=({cx,cy})=>({x:(cx-desktop.x)*scale,y:(cy-desktop.y)*scale});
  const card={width:profile.card.width*scale,height:profile.card.height*scale};
  const pad=FILMED_TABLE_BOX_PAD*scale,box={width:card.width+2*pad,height:card.height+2*pad};
  const seats=SEATS.map(id=>{const center=toImage(profile.positions[id]);return {id,center:{x:round(center.x),y:round(center.y)},box:rect(center,box.width,box.height)};});
  const dealerCenter=toImage(profile.positions.dealer);
  const arc=seatArc(seats.map(seat=>seat.center),dealerCenter.x);
  if (!arc) return null;
  const gap=box.height/2+card.height*.45,railWidth=card.height*.55;
  const curve=(x,offset)=>arc.a+arc.b*(x-arc.centre)**2+offset;
  const feltTop=Math.max(0,dealerCenter.y-card.height*2.2);
  const railBottom=Math.max(...[0,canvasWidth,arc.centre].map(x=>curve(Math.min(canvasWidth,Math.max(0,x)),gap+railWidth)))+card.height*.15;
  const height=Math.ceil(Math.max(railBottom,(profile.plane.height-desktop.y)*scale)-1e-6);
  // Within the renderer's limits (edge 3840, 8.3 MP, 3:1), and every box on the
  // felt, inside the rail and the graphic.
  if (height>3840||canvasWidth*height>8_294_400||Math.max(canvasWidth/height,height/canvasWidth)>3||seats.some(seat=>seat.box.y<feltTop||seat.box.y+seat.box.height>curve(seat.center.x,gap)||seat.box.x<0||seat.box.x+seat.box.width>canvasWidth)) return null;
  const samples=Array.from({length:33},(_,index)=>canvasWidth*index/32);
  const line=offset=>samples.map(x=>[round(x),round(Math.max(feltTop,curve(x,offset)))]);
  return Object.freeze({
    dealerId,profileId:profile.id,
    canvas:{width:canvasWidth,height},
    // Image pixel -> filmed plane: plane = offset + image / scale.
    plane:{offset:{x:round(desktop.x),y:round(desktop.y)},scale},
    card:{width:round(card.width),height:round(card.height)},
    seats,dealer:{center:{x:round(dealerCenter.x),y:round(dealerCenter.y)},box:rect(dealerCenter,box.width,box.height)},
    felt:{top:round(feltTop),railInner:line(gap),railOuter:line(gap+railWidth)},
  });
}

// The model renders sizes in multiples of 16; keep the template's aspect.
export function filmedTableRequestSize(template) {
  const width=Math.ceil(template.canvas.width/16)*16;
  return {width,height:Math.round(template.canvas.height*width/template.canvas.width/16)*16};
}

// How much of the table's width the seven boxes fill (Jakob 2026-10-29). The
// filmed reach is fixed, so the table width follows it: at 70-80 % the table
// reaches a little past the outer boxes and its rail curves up at the ends, as
// on production's Privé table (boxes about 62 % of its width, rail just past
// them). Wider and the outer seats sit far from the dealer; narrower and the
// outer boxes run into the rail.
export const AI_TABLE_FILL = Object.freeze({min:.7,target:.75,max:.8});

/** The boxes' share of the graphic's width: outermost box edge to outermost box edge. */
export function filmedTableReach(template) {
  const boxes=template.seats.map(seat=>seat.box);
  const left=Math.min(...boxes.map(box=>box.x)),right=Math.max(...boxes.map(box=>box.x+box.width));
  return {left:round(left),right:round(right),share:Math.round((right-left)/template.canvas.width*1e4)/1e4};
}

/**
 * The table width that fits the dealer's reach: the scene template's composition
 * with both layouts' table width scaled around the table's centre, so that the
 * boxes fill AI_TABLE_FILL.target. Both layouts keep one plane rectangle, so one
 * graphic still serves phone and desktop. Width is kept to six decimals (far
 * inside the half plane pixel the template allows). Null without a template.
 * `changed` is false when the current width already lies inside the range.
 */
export function filmedTableFit(dealerId,composition=defaultCompositionSettings(),{profileFor=registeredFilmedProfile}={}) {
  let current;
  try { current=validateCompositionSettings(composition??defaultCompositionSettings()); } catch { return null; }
  const before=filmedTableTemplate(dealerId,{composition:current,profileFor});
  if (!before) return null;
  const reach=filmedTableReach(before);
  const changed=reach.share<AI_TABLE_FILL.min||reach.share>AI_TABLE_FILL.max;
  const next=structuredClone(current);
  if (changed) for (const layout of ['mobile','desktop']) next[layout].table.width=Math.round(current[layout].table.width*reach.share/AI_TABLE_FILL.target*1e6)/1e6;
  let suggested=null;
  try { suggested=filmedTableTemplate(dealerId,{composition:validateCompositionSettings(next),profileFor}); } catch { suggested=null; }
  if (!suggested) return null;
  return Object.freeze({changed,current:{share:reach.share,composition:current},suggested:{share:filmedTableReach(suggested).share,composition:next}});
}

// The table body around the template: a half-moon whose felt edge runs parallel
// to the filmed seat arc just past the boxes ("the player sits close"), then a
// wood inlay, a thick padded rail, the apron under the rail and a pedestal down
// to the frame's edge. Measured against production's Privé table at the same
// box size: rail edge about a third of a card height past the boxes, inlay plus
// padded rail about 0.8 card heights, apron half a card height.
const BODY=Object.freeze({gap:.3,inlay:.2,pad:.62,apron:.5,clearance:.1,back:.25});
// The filmed seats lie close to a half ellipse around the dealer's spot (a round
// table seen in perspective: PAOW's seats within 6 plane px of one with semi-axes
// 533 x 220). The table's edges are drawn as superellipses around the same
// centre; the roundest exponent that keeps every box on the felt wins.
const EXPONENTS=[2,2.5,3,3.5,4,5,6,8];
const SAMPLES=96;

/**
 * Curves and parts of the table body in canvas pixels. Each edge is a half
 * superellipse around the dealer's spot that meets the back edge (just behind
 * the dealer's card spot) at the table's sides, so the ends curve toward the
 * dealer. `open` when no such shape keeps the outer boxes on the felt (the boxes
 * fill nearly the whole graphic): the edges then follow the seat arc and run off
 * both sides, as before.
 */
export function filmedTableBody(template) {
  const {canvas,card,seats,dealer,felt}=template,centre=dealer.center.x,middle=dealer.center.y;
  const back=Math.max(felt.top,dealer.box.y-card.height*BODY.back);
  const arc=seatArc(seats.map(seat=>seat.center),centre);
  const box=seats[0].box,half=Math.min(centre,canvas.width-centre);
  const gap=box.height/2+card.height*BODY.gap,inlay=card.height*BODY.inlay,pad=card.height*BODY.pad,apron=card.height*BODY.apron;
  const side=(inlay+pad)*.85,clearance=card.height*BODY.clearance;
  // Semi-axes per edge: width to the graphic's side, depth to the front at the centre.
  const front=arc.a+gap-middle;
  const axes={felt:[half-side,front],inlay:[half-side+side*inlay/(inlay+pad),front+inlay],rail:[half,front+inlay+pad],apron:[half,front+inlay+pad+apron]};
  const inside=(x,y,[width,depth],exponent)=>Math.abs(x-centre)<width&&(Math.abs(x-centre)/width)**exponent+(Math.max(0,y-middle)/depth)**exponent<=1;
  const fits=exponent=>axes.felt[0]>0&&seats.every(seat=>[seat.box.x,seat.box.x+seat.box.width].every(x=>[seat.box.y,seat.box.y+seat.box.height]
    .every(y=>inside(x,y,[axes.felt[0]-clearance,axes.felt[1]-clearance],exponent))));
  const exponent=EXPONENTS.find(fits)??null,open=exponent===null;
  const line=([width,depth],offset)=>{
    if (open) return Array.from({length:SAMPLES+1},(_,index)=>{const x=canvas.width*index/SAMPLES;
      return [round(x),round(Math.min(canvas.height,Math.max(back,arc.a+arc.b*(x-centre)**2+offset)))];});
    // Dense near the sides, where the curve turns up; the side runs straight up to the back edge.
    const rows=Array.from({length:SAMPLES+1},(_,index)=>{const u=Math.sin(-Math.PI/2+Math.PI*index/SAMPLES),x=centre+width*u;
      return [round(x),round(Math.min(canvas.height,middle+depth*(1-Math.abs(u)**exponent)**(1/exponent)))];});
    return [[round(centre-width),round(back)],...rows,[round(centre+width),round(back)]];
  };
  const edge=line(axes.felt,gap),inlayEdge=line(axes.inlay,gap+inlay),railEdge=line(axes.rail,gap+inlay+pad);
  const apronEdge=line(axes.apron,gap+inlay+pad+apron);
  const lowest=Math.max(...apronEdge.map(([,y])=>y));
  // A pedestal only where the frame leaves room below the apron.
  const pedestal=canvas.height-lowest>card.height?{top:round(lowest-card.height*.2),bottom:canvas.height,
    topHalf:round(half*.5),bottomHalf:round(half*.44),ring:round(canvas.height-card.height*.75),ringHeight:round(card.height*.18)}:null;
  return Object.freeze({exponent,open,centre:round(centre),top:round(back),half:round(half),edge,inlayEdge,railEdge,apronEdge,pedestal});
}

// Colours of the 3D mock-up. A style (apps/studio/lib/ai-table-style.mjs) gives
// its own; the default is a neutral charcoal table.
const DEFAULT_LOOK=Object.freeze({felt:'#3a3d42',light:'#5b6068',rail:'#151517',railLight:'#5a5a62',inlay:['#5a3a26','#2a1a10'],trim:'#bfc3c9',
  apron:['#2b2b2f','#0c0c0e'],metal:'#9a9ea6',glow:null});
const hex=value=>{const match=/^#([0-9a-f]{6})$/i.exec(value??'');return match?[0,2,4].map(at=>parseInt(match[1].slice(at,at+2),16)):null;};
const mix=(one,two,share)=>{const [a,b]=[hex(one),hex(two)];return '#'+a.map((channel,index)=>Math.round(channel+(b[index]-channel)*share).toString(16).padStart(2,'0')).join('');};
const lookOf=look=>{
  const value={...DEFAULT_LOOK,...(look??{})};
  const colours=[value.felt,value.light,value.rail,value.railLight,value.trim,value.metal,...value.inlay,...value.apron,...(value.glow?[value.glow]:[])];
  if (!colours.every(hex)||value.inlay.length!==2||value.apron.length!==2) throw Error('invalid_table_look');
  return value;
};

const points=rows=>rows.map(([x,y])=>`${x},${y}`).join(' ');
const between=(upper,lower)=>`${points(upper)} ${points([...lower].reverse())}`;
// The felt: the back edge (dealer side) at felt.top, then the felt edge.
const feltShape=(template,body)=>body.open?`0,${body.top} ${template.canvas.width},${body.top} ${points([...body.edge].reverse())}`
  :`${round(body.centre-body.half)},${body.top} ${round(body.centre+body.half)},${body.top} ${points([...body.edge].reverse())}`;
const pedestalShape=body=>{const p=body.pedestal,c=body.centre;
  return `${round(c-p.topHalf)},${p.top} ${round(c+p.topHalf)},${p.top} ${round(c+p.bottomHalf)},${p.bottom} ${round(c-p.bottomHalf)},${p.bottom}`;};
const silhouette=(template,body)=>`<polygon points="${feltShape(template,body)}"/><polygon points="${between(body.edge,body.railEdge)}"/>`
  +`<polygon points="${between(body.railEdge,body.apronEdge)}"/>${body.pedestal?`<polygon points="${pedestalShape(body)}"/>`:''}`;
const boxes=(template,stroke,width)=>[...template.seats.map(seat=>seat.box),template.dealer.box]
  .map(box=>`<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="${round(template.card.width*.16)}" fill="none" stroke="${stroke}" stroke-width="${width}"/>`).join('');

// The padded rail as bands from the felt side (light from the dealer catches
// its top) to the front face (toward the camera, in shadow).
function railBands(body,look) {
  const count=8,rows=[];
  for (let index=0;index<count;index++) {
    const from=index/count,to=(index+1)/count,mid=(from+to)/2;
    const light=Math.exp(-(((mid-.3)/.2)**2)),shade=Math.max(0,mid-.45)*1.2;
    const colour=mix(mix(look.rail,look.railLight,light*.85),'#000000',Math.min(.7,shade));
    const lerp=share=>body.inlayEdge.map(([x,y],at)=>[round(x+(body.railEdge[at][0]-x)*share),round(y+(body.railEdge[at][1]-y)*share)]);
    rows.push(`<polygon points="${between(lerp(from),lerp(to))}" fill="${colour}"/>`);
  }
  return rows.join('');
}

function render(template,body,look,stroke) {
  const {width,height}=template.canvas,card=template.card,c=body.centre,radius=round(Math.max(width,height-body.top)*.9);
  const strokeWidth=round(Math.max(3,card.width*.05)),blur=round(card.height*.22),trim=round(Math.max(2,card.height*.035));
  const defs=`<defs><radialGradient id="felt" gradientUnits="userSpaceOnUse" cx="${c}" cy="${body.top}" r="${radius}">`
    +`<stop offset="0" stop-color="${look.light}"/><stop offset=".55" stop-color="${look.felt}"/><stop offset="1" stop-color="${mix(look.felt,'#000000',.45)}"/></radialGradient>`
    +`<linearGradient id="inlay" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${look.inlay[0]}"/><stop offset="1" stop-color="${look.inlay[1]}"/></linearGradient>`
    +`<linearGradient id="apron" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${look.apron[0]}"/><stop offset="1" stop-color="${look.apron[1]}"/></linearGradient>`
    +`<linearGradient id="pedestal" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${look.apron[1]}"/><stop offset=".42" stop-color="${look.apron[0]}"/><stop offset="1" stop-color="${look.apron[1]}"/></linearGradient>`
    +`<linearGradient id="ring" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(look.metal,'#ffffff',.35)}"/><stop offset="1" stop-color="${mix(look.metal,'#000000',.4)}"/></linearGradient>`
    +`<filter id="soft" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="${blur}"/></filter>`
    +`<clipPath id="felt-area"><polygon points="${feltShape(template,body)}"/></clipPath></defs>`;
  const p=body.pedestal;
  const parts=[defs,`<rect width="${width}" height="${height}" fill="#000"/>`,
    p?`<polygon points="${pedestalShape(body)}" fill="url(#pedestal)"/><rect x="${round(c-p.bottomHalf*1.04)}" y="${p.ring}" width="${round(p.bottomHalf*2.08)}" height="${p.ringHeight}" fill="url(#ring)"/>`:'',
    `<polygon points="${between(body.railEdge,body.apronEdge)}" fill="url(#apron)"/>`,
    `<polygon points="${feltShape(template,body)}" fill="url(#felt)"/>`,
    // The rail's shadow on the felt, kept inside the felt.
    `<g clip-path="url(#felt-area)"><polyline points="${points(body.edge)}" fill="none" stroke="#000" stroke-opacity=".6" stroke-width="${round(card.height*.45)}" filter="url(#soft)"/></g>`,
    look.glow?`<polyline points="${points(body.edge)}" fill="none" stroke="${look.glow}" stroke-opacity=".75" stroke-width="${trim*5}" filter="url(#soft)"/>`:'',
    `<polygon points="${between(body.edge,body.inlayEdge)}" fill="url(#inlay)"/>`,
    railBands(body,look),
    `<polyline points="${points(body.edge)}" fill="none" stroke="${look.trim}" stroke-width="${trim}"/>`,
    look.glow?`<polyline points="${points(body.railEdge)}" fill="none" stroke="${look.metal}" stroke-opacity=".8" stroke-width="${trim}"/>`:'',
    stroke?boxes(template,stroke,strokeWidth):''];
  return parts.join('');
}

/**
 * SVG parts for one template, all in canvas pixels:
 * reference: the 3D mock-up sent to the image model (black outside; felt lit from the dealer side, the rail's
 *   shadow on it, wood inlay, padded rail, apron and pedestal) with the white boxes the server draws later;
 * surface: the same mock-up without boxes;
 * mask: the table body's silhouette for cutting the model's image;
 * boxes: the exact betting boxes and dealer spot drawn on top.
 * look: the style's colours (ai-table-style.mjs), else a neutral charcoal table.
 */
export function filmedTableSvg(template,part,{stroke='rgba(255,255,255,0.72)',look}={}) {
  const {width,height}=template.canvas,strokeWidth=round(Math.max(3,template.card.width*.05));
  const open=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
  if (part==='boxes') return `${open}${boxes(template,stroke,strokeWidth)}</svg>`;
  if (!['reference','surface','mask'].includes(part)) throw Error('invalid_table_template_part');
  const body=filmedTableBody(template);
  if (part==='mask') return `${open}<g fill="#fff">${silhouette(template,body)}</g></svg>`;
  return `${open}${render(template,body,lookOf(look),part==='reference'?'#fff':null)}</svg>`;
}
