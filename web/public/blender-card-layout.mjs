import {quadMatrix} from './astrid-green-dealer.mjs';

// Metres on the felt, in the betting marker's local plane. Fan growth and
// split hands stay inside their own seat instead of tilting a screen rectangle.
export function feltCardLocalQuad(index,count,hand=0,hands=1){
  const scale=hands>1?Math.min(.78,1.6/hands):1,w=.072*scale,h=.103*scale;
  const pitch=hands>1?.17/hands:0;
  const maxSpread=hands>1?Math.max(0,pitch*.95-w):.058;
  const step=Math.min(.020*scale,maxSpread/Math.max(1,count-1));
  const x=(hand-(hands-1)/2)*pitch-.018*scale+index*step;
  const y=.126+(hands>1?.010:0)+index*.003;
  return [[x-w/2,y+h/2],[x+w/2,y+h/2],[x+w/2,y-h/2],[x-w/2,y-h/2]];
}

export function layoutFeltCards(projectSeatCard){
  for(const seat of document.querySelectorAll('.seat:not(.seat-off)')){
    const root=seat.querySelector('.cards'),host=seat.querySelector('.seat-inner');
    if(!root||!host)continue;
    const bounds=host.getBoundingClientRect(),scale=bounds.width/host.offsetWidth||1;
    Object.assign(root.style,{left:'0px',top:'0px',transform:'none'});
    const subhands=[...root.querySelectorAll(':scope > .subhand')];
    const hands=subhands.length?subhands:[root];
    hands.forEach((hand,hi)=>{
      if(hand!==root)Object.assign(hand.style,{left:'0px',top:'0px',transform:'none'});
      const cards=[...hand.querySelectorAll(':scope > .card')];
      cards.forEach((el,i)=>{
        const quad=projectSeatCard(Number(seat.dataset.box),feltCardLocalQuad(i,cards.length,hi,hands.length),i,hands.length);
        if(!quad)return;
        const local=quad.map(p=>[(p.x-bounds.x)/scale,(p.y-bounds.y)/scale]);
        Object.assign(el.style,{left:'0px',top:'0px',width:'100px',height:'143.5px',transformOrigin:'0 0',animation:'none',transform:`matrix3d(${quadMatrix(local,100,143.5).join(',')})`});
        el.dataset.feltCard='true';
        el.dataset.feltCorners=JSON.stringify(quad.map(p=>[p.x,p.y]));
      });
    });
  }
}
