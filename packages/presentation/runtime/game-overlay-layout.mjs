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

function layoutTableGameOverlay({rect,tableGeometry,tableLayout,tableId,sourcePlane,dealerPlane,cardsRect=rect,betsRect=rect},boxes,bounds,compact,cardView,filmedProfile){
  const layout=tableLayout??(compact?'mobile':'desktop'),geometry=tableGeometry[layout];
  // Kevin's model, opt-in per layout: the composited dealer plane decides the
  // filmed landing, the resting card size (the dealer's prop card) and the
  // chips. Absent, or without a dealer plane, the table geometry is unchanged.
  const auto=dealerPlane?geometry.autoScale:undefined,adjust=auto?.adjust??{},chips=adjust.chips??{dx:0,dy:0,scale:1};
  const film=filmedProfile?.positions??calibration.positions,prop=filmedProfile?.card?.width??calibration.width;
  const scale=auto?.cardSize?dealerPlane.scale*prop/calibration.width*(adjust.cards?.scale??1):cardsRect.width*geometry.cardWidth/calibration.width;
  const origin=auto?.landing?dealerPlane:cardsRect;
  // A filmed landing keeps its real box, also for the phone's visible seats.
  const local=(seat,point)=>auto?.landing?{cx:film[seat].cx*dealerPlane.scale/scale,cy:film[seat].cy*dealerPlane.scale/scale}
    :{cx:point.x*cardsRect.width/scale,cy:point.y*cardsRect.height/scale};
  const screen=(point,frame=cardsRect)=>({x:frame.x+point.x*frame.width,y:frame.y+point.y*frame.height});
  const cardAt=(seat,point)=>auto?.landing?{x:dealerPlane.x+film[seat].cx*dealerPlane.scale,y:dealerPlane.y+film[seat].cy*dealerPlane.scale}:screen(point);
  const positions={dealer:local('dealer',geometry.dealer)};
  const followCards=Boolean(auto?.chips)||geometry.betMode==='under-cards';
  // Automatic chip tiles scale with the dealer plane, like the boxes in Kevin's
  // frame; a phone keeps the shared room's 0.8 minimum.
  const controlScale=auto?.chips?Math.max(compact?.8:0,dealerPlane.scale*chips.scale)
    :compact?Math.min(1,Math.max(.01,(bounds.right-bounds.left)/330)):(followCards?scale:betsRect.width*geometry.cardWidth/calibration.width);
  // Keep one vertical column per hand. Its chip target clears the resting card
  // and total badge in either view, including phone-sized touch controls.
  const betGap=(calibration.height/2*cardViewDepth(cardView)+38)*scale+26*controlScale+6;
  const seats=boxes.map((box,index)=>{
    const seat=geometry.seats[layout==='mobile'?index:box],id=String(box+1);
    positions[id]=local(id,seat.card);
    const card=cardAt(id,seat.card);
    return {box,...(auto?.chips?{x:card.x+chips.dx*1080*dealerPlane.scale,y:card.y+betGap+chips.dy*1920*dealerPlane.scale}
      :followCards?{x:card.x,y:card.y+betGap}:screen(seat.bet,betsRect))};
  });
  // Touch targets may spread independently; film contacts and server box IDs stay fixed.
  // Apply an explicit Admin offset after fitting, so it remains an actual override.
  const touchScale=compact?Math.max(1,controlScale):controlScale;
  if(compact&&auto?.chips){
    const half=49*touchScale,gap=2*half,dx=chips.dx*1080*dealerPlane.scale;
    const left=bounds.left+half,right=bounds.right-half;
    if(right-left>=gap*(seats.length-1)){
      seats.forEach((seat,i)=>{seat.x=Math.max(left+i*gap,Math.min(right-(seats.length-1-i)*gap,seat.x-dx));
        if(i)seat.x=Math.max(seat.x,seats[i-1].x-dx+gap);seat.x+=dx;});
    }
  }
  const inside=(x,y,left,right,top,bottom)=>x-left>=bounds.left-1e-6&&x+right<=bounds.right+1e-6&&y-top>=bounds.top-1e-6&&y+bottom<=bounds.bottom+1e-6;
  // A filmed landing keeps the film's box spacing, which never leaves room for
  // a worst-case fan on a phone. Check the landed card and the touch row then.
  const [hand,dealerHand]=auto?.landing?Array(2).fill([calibration.width/2,calibration.width/2,calibration.height/2,calibration.height/2])
    :[[144,90,230,55],[310,45,130,55]];
  const fits=seats.every((seat,index)=>{
    const card=positions[String(seat.box+1)],x=origin.x+card.cx*scale,y=origin.y+card.cy*scale;
    return inside(seat.x,seat.y,49*touchScale,49*touchScale,45*controlScale,45*controlScale)
      &&inside(x,y,...hand.map(value=>value*scale))
      &&(!index||seat.x-seats[index-1].x>=98*touchScale-1e-6);
  });
  const dealer=cardAt('dealer',geometry.dealer);
  return {x:origin.x,y:origin.y,scale,positions,offsets:{},boxes,seats,dealer,controlScale,adjusted:true,cardView,followCards,
    ...(sourcePlane&&tableId?{sourcePlane,tableId,tableLayout:layout}:{}),
    geometryWarning:fits&&inside(dealer.x,dealer.y,...dealerHand.map(value=>value*scale))?''
      :`Kort eller insatsplatser ryms inte. Justera ${auto?.landing?'dealerns':'bordets'} placering i Sammansättning.`};
}

// Keep server seat identities and card anchors together, including a resumed
// desktop hand on a phone. A heavily cropped actor must not crop game controls.
// An adjusted plane is static presentation, never evidence of filmed contact.
// filmedProfile only supplies an autoScale layout's prop card size and landings.
/** @param {{compact?:boolean, cardView?:string, filmedProfile?:{positions:Record<string,{cx:number,cy:number}>,card:{width:number}}|null}} [options] */
export function layoutGameOverlay(plane, boxes, bounds, options={}) {
  const {compact=false,filmedProfile=null}=options;
  let {cardView}=options;
  const format=plane.tableLayout??(compact?'mobile':'desktop');
  cardView=normalizeCardView(plane.tableGeometry?.[format]?.cardView??cardView??'table');
  if(plane.tableGeometry)return layoutTableGameOverlay(plane,boxes,bounds,compact,cardView,filmedProfile);
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
