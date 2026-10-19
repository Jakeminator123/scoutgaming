import {cardViewDepth,normalizeCardView} from '../../../packages/presentation/contracts/card-view.mjs';
import { calibration } from '../../../packages/presentation/contracts/calibration.mjs';
export const BLACKJACK_COMPACT_QUERY='(max-width: 860px)';

// Reference coordinates are the same 1080 x 1920 plane as the card renderer.
// Include both the source framing and the compositor's logical canvas/contain.
export function projectGamePlane({ dims, s, x, y }, viewport, framing = { scale: 1, x: 0, y: 0 }) {
  const fit = Math.min(viewport.width / dims[0], viewport.height / dims[1]);
  const scale = s * fit * framing.scale;
  return {
    x: (viewport.width - dims[0] * fit) / 2 + (x + s * (540 * (1 - framing.scale) + 1920 * framing.x)) * fit,
    y: (viewport.height - dims[1] * fit) / 2 + (y + s * (960 * (1 - framing.scale) + 1920 * framing.y)) * fit,
    scale,
  };
}

// Use the compositor's exact image rectangle, including transparent margins.
// Board anchors are static UI; source-video framing must never move them.
export function projectTableGamePlane(dims, rect, viewport, tableGeometry,tableLayout) {
  const fit=Math.min(viewport.width/dims[0],viewport.height/dims[1]);
  return {tableGeometry,...(tableLayout?{tableLayout}:{}),rect:{x:(viewport.width-dims[0]*fit)/2+rect[0]*fit,
    y:(viewport.height-dims[1]*fit)/2+rect[1]*fit,width:rect[2]*fit,height:rect[3]*fit}};
}

function layoutTableGameOverlay({rect,tableGeometry,tableLayout,tableId,sourcePlane,cardsRect=rect,betsRect=rect},boxes,bounds,compact,cardView){
  const layout=tableLayout??(compact?'mobile':'desktop'),geometry=tableGeometry[layout];
  const scale=cardsRect.width*geometry.cardWidth/calibration.width;
  const local=point=>({cx:point.x*cardsRect.width/scale,cy:point.y*cardsRect.height/scale});
  const screen=(point,frame=cardsRect)=>({x:frame.x+point.x*frame.width,y:frame.y+point.y*frame.height});
  const positions={dealer:local(geometry.dealer)};
  const followCards=geometry.betMode==='under-cards';
  const controlScale=compact?Math.min(1,Math.max(.01,(bounds.right-bounds.left)/330)):(followCards?scale:betsRect.width*geometry.cardWidth/calibration.width);
  // Keep one vertical column per hand. Its chip target clears the resting card
  // and total badge in either view, including phone-sized touch controls.
  const betGap=(calibration.height/2*cardViewDepth(cardView)+38)*scale+26*controlScale+6;
  const seats=boxes.map((box,index)=>{
    const seat=geometry.seats[layout==='mobile'?index:box];
    positions[String(box+1)]=local(seat.card);
    const card=screen(seat.card);
    return {box,...(followCards?{x:card.x,y:card.y+betGap}:screen(seat.bet,betsRect))};
  });
  const inside=(x,y,left,right,top,bottom)=>x-left>=bounds.left&&x+right<=bounds.right&&y-top>=bounds.top&&y+bottom<=bounds.bottom;
  const fits=seats.every((seat,index)=>{
    const card=positions[String(seat.box+1)],x=cardsRect.x+card.cx*scale,y=cardsRect.y+card.cy*scale;
    return inside(seat.x,seat.y,49*(compact?1:controlScale),49*(compact?1:controlScale),45*controlScale,45*controlScale)
      &&inside(x,y,144*scale,90*scale,230*scale,55*scale)
      &&(!index||seat.x-seats[index-1].x>=98*(compact?1:controlScale));
  });
  const dealer=screen(geometry.dealer);
  return {x:cardsRect.x,y:cardsRect.y,scale,positions,offsets:{},boxes,seats,dealer,controlScale,adjusted:true,cardView,followCards,
    ...(sourcePlane&&tableId?{sourcePlane,tableId,tableLayout:layout}:{}),
    geometryWarning:fits&&inside(dealer.x,dealer.y,310*scale,45*scale,130*scale,55*scale)?'':'Kort eller insatsplatser ryms inte. Justera bordets placering i Sammansättning.'};
}

// Keep server seat identities and card anchors together, including a resumed
// desktop hand on a phone. A heavily cropped actor must not crop game controls.
// An adjusted plane is static presentation, never evidence of filmed contact.
export function layoutGameOverlay(plane, boxes, bounds, {compact=false,cardView='raised'}={}) {
  cardView=normalizeCardView(cardView);
  if(plane.tableGeometry)return layoutTableGameOverlay(plane,boxes,bounds,compact,cardView);
  const anchors = boxes.map(box => ({ box, ...calibration.positions[String(box + 1)] }));
  const left = Math.min(calibration.positions.dealer.cx - 310,...anchors.map(p => p.cx - 144));
  const right = Math.max(calibration.positions.dealer.cx + 45,...anchors.map(p => p.cx + 90));
  const top = calibration.positions.dealer.cy - 130;
  const bottom = Math.max(...anchors.map(p => p.cy)) + 175;
  const availableWidth=Math.max(1,bounds.right-bounds.left);
  const compactScale=compact?Math.max(.01,Math.min((availableWidth-196-49)/144,(availableWidth-196-49)/90,(availableWidth-196)/234)):Infinity;
  const scale = Math.min(plane.scale, compactScale, availableWidth / (right - left), Math.max(1,bounds.bottom - bounds.top) / (bottom - top));
  // Shrink about the original centre only when the playable group cannot fit.
  let x = plane.x + 540 * (plane.scale - scale), y = plane.y;
  x = Math.max(bounds.left - left * scale, Math.min(bounds.right - right * scale, x));
  y = Math.max(bounds.top - top * scale, Math.min(bounds.bottom - bottom * scale, y));
  const columnLeft=bounds.left+Math.max(49,144*scale),columnRight=bounds.right-Math.max(49,90*scale);
  const seats=anchors.map((p,i)=>({box:p.box,
    x:compact?columnLeft+(columnRight-columnLeft)*i/Math.max(1,anchors.length-1):x+p.cx*scale,
    y:y+(p.cy+108)*scale}));
  const offsets=Object.fromEntries(anchors.map((p,i)=>[String(p.box+1),(seats[i].x-x)/scale-p.cx]));
  const adjusted = plane.sourceAligned===false || Math.abs(scale - plane.scale) > .001 || Math.abs(x - plane.x) > .5 || Math.abs(y - plane.y) > .5
    || Object.values(offsets).some(dx=>Math.abs(dx)>.5);
  return { x, y, scale, adjusted,offsets,boxes,cardView,controlScale:compact?Math.min(1,availableWidth/330):scale,
    ...(plane.geometryWarning?{geometryWarning:plane.geometryWarning}:{}),
    seats,
    dealer: { x: x + calibration.positions.dealer.cx * scale, y: y + calibration.positions.dealer.cy * scale },
  };
}
