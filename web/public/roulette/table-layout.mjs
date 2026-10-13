// Registration belongs to this artwork, not to the roulette settlement rules.
// All points are pixels in the unchanged 1672 x 941 table source.
export const TABLE_ARTWORK = Object.freeze({width:1672,height:941});
const rows=[393,416,439,463,486,511,537,565,595,624,655,687,721];
const lerp=(a,b,t)=>a+(b-a)*t;
const edge=(y,column)=>{
  const t=(y-393)/(721-393);
  return [lerp(lerp(703,646,t),lerp(971,1018,t),column/3),y];
};
const cell=number=>{
  const row=Math.floor((number-1)/3), column=(number-1)%3;
  return [edge(rows[row],column),edge(rows[row],column+1),edge(rows[row+1],column+1),edge(rows[row+1],column)];
};
const centre=points=>points.reduce((sum,p)=>[sum[0]+p[0]/points.length,sum[1]+p[1]/points.length],[0,0]);
const strip=(index,count,top,bottom,leftTop,rightTop,leftBottom,rightBottom)=>[
  [lerp(leftTop,rightTop,index/count),top], [lerp(leftTop,rightTop,(index+1)/count),top],
  [lerp(leftBottom,rightBottom,(index+1)/count),bottom], [lerp(leftBottom,rightBottom,index/count),bottom],
];
const zero=[[714,365],[960,365],[965,393],[709,393]];
const outside=['low','even','red','black','odd','high'];

export function tableBetGeometry(bet) {
  let polygon=null, anchor;
  if(bet.type==='straight') polygon=bet.numbers[0]===0?zero:cell(bet.numbers[0]);
  if(bet.type==='dozen') polygon=strip(Number(bet.id.slice(-1))-1,3,721,752,557,1119,545,1125);
  if(bet.type==='outside') polygon=strip(outside.indexOf(bet.id),6,751,793,398,1273,383,1290);
  if(polygon) anchor=centre(polygon);
  else {
    anchor=centre(bet.numbers.map(n=>centre(n===0?zero:cell(n))));
    if(bet.type==='street'||bet.type==='line') anchor=[edge(anchor[1],0)[0]-30,anchor[1]];
    // This reference has no printed 2:1 fields: columns are selected in the
    // accessible menu and their stacks sit at the foot of the relevant column.
    if(bet.type==='column') anchor=[centre(cell(33+Number(bet.id.slice(-1))))[0],716];
  }
  return {polygon,anchor};
}

export function polygonButtonStyle(polygon) {
  const xs=polygon.map(p=>p[0]),ys=polygon.map(p=>p[1]);
  const left=Math.min(...xs),top=Math.min(...ys),width=Math.max(...xs)-left,height=Math.max(...ys)-top;
  return {left:100*left/TABLE_ARTWORK.width,top:100*top/TABLE_ARTWORK.height,
    width:100*width/TABLE_ARTWORK.width,height:100*height/TABLE_ARTWORK.height,
    clip:polygon.map(([x,y])=>`${100*(x-left)/width}% ${100*(y-top)/height}%`).join(',')};
}

export function chipBreakdown(total,denominations=[1,5,25,100]) {
  let left=total;const chips=[];
  for(const value of [...denominations].sort((a,b)=>b-a)) {
    while(left>=value&&chips.length<9){chips.push(value);left-=value;}
  }
  return chips;
}
