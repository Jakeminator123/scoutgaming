import { calibration } from './card-presentation/calibration.mjs';

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

// Keep server seat identities and card anchors together, including a resumed
// desktop hand on a phone. A heavily cropped actor must not crop game controls.
// An adjusted plane is static presentation, never evidence of filmed contact.
export function layoutGameOverlay(plane, boxes, bounds, {compact=false}={}) {
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
  return { x, y, scale, adjusted,offsets,boxes,controlScale:compact?Math.min(1,availableWidth/330):scale,
    seats,
    dealer: { x: x + calibration.positions.dealer.cx * scale, y: y + calibration.positions.dealer.cy * scale },
  };
}
