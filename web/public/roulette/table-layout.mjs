// Registration belongs to this artwork, not to the roulette settlement rules.
// All points are pixels in the unchanged 1672 x 941 table source.
export const TABLE_ARTWORK = Object.freeze({width:1672,height:941});
const layouts={
  prototype:{...TABLE_ARTWORK,rows:[393,416,439,463,486,511,537,565,595,624,655,687,721],edges:[703,971,646,1018],zero:[[714,365],[960,365],[965,393],[709,393]],dozen:[721,752,557,1119,545,1125],outside:[751,793,398,1273,383,1290]},
  'roulette-anna-v1':{width:1708,height:920,rows:[565,582,601,620,640,661,682,704,728,753,779,808,839],edges:[740,962,668,1042],zero:[[747,546],[954,546],[958,565],[743,565]],dozen:[839,870,610,1106,600,1117],outside:[870,911,473,1241,457,1260]},
};
export function tableArtwork(designId=null) {return designId===null?layouts.prototype:layouts[designId]??null;}
const lerp=(a,b,t)=>a+(b-a)*t;
const edge=(y,column,layout)=>{
  const t=(y-layout.rows[0])/(layout.rows.at(-1)-layout.rows[0]);
  const [leftTop,rightTop,leftBottom,rightBottom]=layout.edges;
  return [lerp(lerp(leftTop,leftBottom,t),lerp(rightTop,rightBottom,t),column/3),y];
};
const cell=(number,layout)=>{
  const {rows}=layout;
  const row=Math.floor((number-1)/3), column=(number-1)%3;
  return [edge(rows[row],column,layout),edge(rows[row],column+1,layout),edge(rows[row+1],column+1,layout),edge(rows[row+1],column,layout)];
};
const centre=points=>points.reduce((sum,p)=>[sum[0]+p[0]/points.length,sum[1]+p[1]/points.length],[0,0]);
const strip=(index,count,top,bottom,leftTop,rightTop,leftBottom,rightBottom)=>[
  [lerp(leftTop,rightTop,index/count),top], [lerp(leftTop,rightTop,(index+1)/count),top],
  [lerp(leftBottom,rightBottom,(index+1)/count),bottom], [lerp(leftBottom,rightBottom,index/count),bottom],
];
const outside=['low','even','red','black','odd','high'];

export function tableBetGeometry(bet,designId=null) {
  const layout=tableArtwork(designId);
  if(!layout)return {polygon:null,anchor:null};
  const {zero}=layout;
  let polygon=null, anchor;
  if(bet.type==='straight') polygon=bet.numbers[0]===0?zero:cell(bet.numbers[0],layout);
  if(bet.type==='dozen') polygon=strip(Number(bet.id.slice(-1))-1,3,...layout.dozen);
  if(bet.type==='outside') polygon=strip(outside.indexOf(bet.id),6,...layout.outside);
  if(polygon) anchor=centre(polygon);
  else {
    anchor=centre(bet.numbers.map(n=>centre(n===0?zero:cell(n,layout))));
    if(bet.type==='street'||bet.type==='line') anchor=[edge(anchor[1],0,layout)[0]-30,anchor[1]];
    // This reference has no printed 2:1 fields: columns are selected in the
    // accessible menu and their stacks sit at the foot of the relevant column.
    if(bet.type==='column') anchor=[centre(cell(33+Number(bet.id.slice(-1)),layout))[0],layout.rows.at(-1)-5];
  }
  return {polygon,anchor};
}

export function polygonButtonStyle(polygon,designId=null) {
  const artwork=tableArtwork(designId);
  if(!artwork)throw Error('Unregistered roulette geometry');
  const xs=polygon.map(p=>p[0]),ys=polygon.map(p=>p[1]);
  const left=Math.min(...xs),top=Math.min(...ys),width=Math.max(...xs)-left,height=Math.max(...ys)-top;
  return {left:100*left/artwork.width,top:100*top/artwork.height,
    width:100*width/artwork.width,height:100*height/artwork.height,
    clip:polygon.map(([x,y])=>`${100*(x-left)/width}% ${100*(y-top)/height}%`).join(',')};
}

export function chipBreakdown(total,denominations=[1,5,25,100]) {
  let left=total;const chips=[];
  for(const value of [...denominations].sort((a,b)=>b-a)) {
    while(left>=value&&chips.length<9){chips.push(value);left-=value;}
  }
  return chips;
}
