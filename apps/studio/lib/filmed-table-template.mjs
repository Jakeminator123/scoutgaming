// Pure geometry for AI table graphics: where a filmed dealer's cards land on a
// table graphic placed by a scene template's composition (or the composition
// defaults). Everything is computed at call time from the filmed profile
// registry and that composition; no measurement is copied into Studio.
// Dealers without a filmed profile get null.
import {registeredFilmedProfile} from '../../../packages/presentation/contracts/filmed-profiles/registry.mjs';
import {validateFilmedDealProfile} from '../../../packages/presentation/contracts/filmed-profile.mjs';
import {defaultCompositionSettings} from '../../../packages/presentation/contracts/composition-settings.mjs';
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

const points=rows=>rows.map(([x,y])=>`${x},${y}`).join(' ');
const outline=template=>{
  const {canvas,felt}=template,outer=[...felt.railOuter].reverse();
  return `0,${felt.top} ${canvas.width},${felt.top} ${points(outer)}`;
};
const boxes=(template,stroke,width)=>[...template.seats.map(seat=>seat.box),template.dealer.box]
  .map(box=>`<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="${round(template.card.width*.16)}" fill="none" stroke="${stroke}" stroke-width="${width}"/>`).join('');

/**
 * SVG parts for one template, all in canvas pixels:
 * reference: the landing template sent to the image model (black outside, grey felt, darker rail, white boxes);
 * mask: the table shape for cutting the model's image;
 * boxes: the exact betting boxes and dealer spot drawn on top.
 */
export function filmedTableSvg(template,part,{stroke='rgba(255,255,255,0.72)'}={}) {
  const {width,height}=template.canvas,strokeWidth=round(Math.max(3,template.card.width*.05));
  const open=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
  if (part==='mask') return `${open}<polygon points="${outline(template)}" fill="#fff"/></svg>`;
  if (part==='boxes') return `${open}${boxes(template,stroke,strokeWidth)}</svg>`;
  if (part!=='reference') throw Error('invalid_table_template_part');
  const rail=`${points(template.felt.railInner)} ${points([...template.felt.railOuter].reverse())}`;
  return `${open}<rect width="${width}" height="${height}" fill="#000"/><polygon points="${outline(template)}" fill="#7a7a7a"/>`
    +`<polygon points="${rail}" fill="#3c3c3c"/>${boxes(template,'#fff',strokeWidth)}</svg>`;
}
