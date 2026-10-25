// Position controls around measured card/total bounds, never a seat offset.
export function placeActions({width,height,viewport,anchor,obstacles=[],margin=12,belowAnchor=false,preferred}) {
  if(![width,height,viewport.width,viewport.top,viewport.bottom,anchor.x,anchor.bottom,margin].every(Number.isFinite)||
    width<=0||height<=0||margin<0||width+2*margin>viewport.width||height+2*margin>viewport.bottom-viewport.top)return null;
  const maxX=viewport.width-width-margin,maxY=viewport.bottom-height-margin;
  const clamp=(n,a,b)=>Math.max(a,Math.min(Math.max(a,b),n));
  preferred??={x:anchor.x-width/2,y:anchor.bottom+margin};
  if(![preferred.x,preferred.y].every(Number.isFinite))return null;
  const xs=[preferred.x,margin,maxX,...obstacles.flatMap(r=>[r.left-width-margin,r.right+margin])];
  const ys=[preferred.y,maxY,viewport.top+margin,...obstacles.flatMap(r=>[r.top-height-margin,r.bottom+margin])];
  let best=null;
  for(const x0 of xs)for(const y0 of ys) {
    const x=clamp(x0,margin,maxX),y=clamp(y0,viewport.top+margin,maxY);
    const overlaps=obstacles.some(r=>x<r.right+margin&&x+width>r.left-margin&&y<r.bottom+margin&&y+height>r.top-margin);
    if(overlaps)continue;
    // Keep controls beneath totals whenever space exists. In a short viewport
    // prefer another clear area over covering a card, total or side bet.
    const score=(x-preferred.x)**2+(y-preferred.y)**2+(belowAnchor&&y<preferred.y?viewport.width**2+viewport.bottom**2:0);
    if(!best||score<best.score)best={x,y,score};
  }
  return best;
}

// A conversation uses the largest clear rectangle up to its Admin size. The
// panel scrolls internally when the cards leave less height than requested.
export function placeChat({width,height,viewport,position={x:1,y:0},obstacles=[]}) {
  const margin=8,minHeight=60;
  width=Math.min(width,viewport.width-2*margin);
  if(width<=0||height<minHeight)return null;
  const widths=[width,Math.min(width,240)];
  let best=null;
  for(const w of widths){
    const preferredX=margin+position.x*Math.max(0,viewport.width-w-2*margin);
    const preferredY=viewport.top+margin+position.y*Math.max(0,viewport.bottom-viewport.top-height-2*margin);
    const xs=[preferredX,margin,viewport.width-w-margin,...obstacles.flatMap(r=>[r.left-w-margin,r.right+margin])];
    const ys=[preferredY,viewport.top+margin,...obstacles.map(r=>r.bottom+margin)];
    for(const x of xs)for(const y of ys){
      if(x<margin||x+w>viewport.width-margin||y<viewport.top+margin)continue;
      const blockers=obstacles.filter(r=>x<r.right+margin&&x+w>r.left-margin&&y<r.bottom+margin);
      const h=Math.min(height,viewport.bottom-y-margin,...blockers.map(r=>r.top-y-margin));
      if(h<minHeight)continue;
      const idealX=margin+position.x*Math.max(0,viewport.width-w-2*margin);
      const idealY=viewport.top+margin+position.y*Math.max(0,viewport.bottom-viewport.top-h-2*margin);
      const area=w*h,score=area-Math.hypot(x-idealX,y-idealY)*.25;
      if(!best||score>best.score)best={x,y,width:w,height:h,score};
    }
  }
  return best;
}

// All main/side-bet targets remain usable while choosing a stake.
export function placeDealControl({width,height,viewport,targets,obstacles=[]}) {
  if(!targets.length||width<=0||height<=0||width+24>viewport.width||height+24>viewport.bottom-viewport.top)return null;
  const anchor={x:(Math.min(...targets.map(r=>r.left))+Math.max(...targets.map(r=>r.right)))/2,bottom:Math.max(...targets.map(r=>r.bottom))};
  return placeActions({width,height,viewport,anchor,obstacles:[...targets,...obstacles],belowAnchor:true});
}
