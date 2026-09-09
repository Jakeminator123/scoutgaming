export const TABLES = [
  {id:'vera',name:'Vera',x:-5,z:2,color:'#164631'},
  {id:'astrid',name:'Astrid',x:5,z:2,color:'#263b3e'},
  {id:'amira',name:'Amira',x:-5,z:-6,color:'#5c442b'},
  {id:'mei',name:'Mei',x:5,z:-6,color:'#15545c'},
];
export function movePlayer(position, dx, dz, obstacles=TABLES) {
  const next={...position},steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.12));
  const clear=(x,z)=>Math.abs(x)<10.7&&z>-12.5&&z<12.5&&!obstacles.some(t=>Math.abs(x-t.x)<2.65&&z>t.z-1.2&&z<t.z+2.1);
  for(let i=0;i<steps;i++) {if(clear(next.x+dx/steps,next.z))next.x+=dx/steps;if(clear(next.x,next.z+dz/steps))next.z+=dz/steps;}
  return next;
}
export function nearestTable(position) {
  return TABLES.map(t=>({...t,distance:Math.hypot(position.x-t.x,position.z-(t.z+2.5))})).sort((a,b)=>a.distance-b.distance)[0];
}
