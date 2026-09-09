// Position controls around measured card/total bounds, never a seat offset.
export function placeActions({width,height,viewport,anchor,obstacles=[],margin=12}) {
  const maxX=viewport.width-width-margin,maxY=viewport.bottom-height-margin;
  const clamp=(n,a,b)=>Math.max(a,Math.min(Math.max(a,b),n));
  const preferred={x:anchor.x-width/2,y:anchor.bottom+margin};
  const xs=[preferred.x,margin,maxX,...obstacles.flatMap(r=>[r.left-width-margin,r.right+margin])];
  const ys=[preferred.y,maxY,viewport.top+margin,...obstacles.flatMap(r=>[r.top-height-margin,r.bottom+margin])];
  let best=null;
  for(const x0 of xs)for(const y0 of ys) {
    const x=clamp(x0,margin,maxX),y=clamp(y0,viewport.top+margin,maxY);
    const overlaps=obstacles.some(r=>x<r.right+margin&&x+width>r.left-margin&&y<r.bottom+margin&&y+height>r.top-margin);
    if(overlaps)continue;
    const score=(x-preferred.x)**2+(y-preferred.y)**2;
    if(!best||score<best.score)best={x,y,score};
  }
  return best;
}
