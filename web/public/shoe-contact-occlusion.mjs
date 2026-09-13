// Optional geometry for a measured, low, planar extraction only. This does not
// establish pickup timing or contact. The caller must bind an inspected source
// extraction window and remove baked source paper before enabling it.
// Dimensions mirror shoe-model.mjs: lip = roundedBox(w*.75,3,8), at (0,5,l*.46).
// The plane uses the unbeveled lip's FRONT TOP edge (y=6.5,z=l*.46+4).
// Bevels (.45), transparent side walls and elevated/turning cards are not modeled.
// During the supplied extraction window only, extrapolate that edge across the
// current card. Disable at the measured fully-extracted frame, never by a timer.
const finite=Number.isFinite;
function vector(v,n,name){if(!Array.isArray(v)||v.length!==n||!v.every(finite))throw new Error(`Invalid ${name}`);return v;}
function transform(m,p){return [0,1,2,3].map(r=>m[r]*p[0]+m[r+4]*p[1]+m[r+8]*p[2]+m[r+12]*p[3]);}
function view(world,p){
  // camera.matrixWorld is a rigid orthonormal transform, not a scaled actor.
  for(let a=0;a<3;a++)for(let b=0;b<3;b++){
    const dot=[0,1,2].reduce((s,r)=>s+world[a*4+r]*world[b*4+r],0);
    if(Math.abs(dot-(a===b?1:0))>1e-7)throw new Error('Camera transform must be rigid');
  }
  const d=p.slice(0,3).map((v,i)=>v-world[12+i]);
  return [0,1,2].map(c=>d.reduce((s,v,r)=>s+world[c*4+r]*v,0)).concat(1);
}
/** fit is the actual uniformRegistration(sourceCamera, viewport) result.
 * registration is tableScene.registration(); size is the actual makeShoe size.
 * Returned coordinates are normalized source canvas coordinates (y downward).
 */
export function projectShoeMouth({size,registration,fit}){
  if(!finite(size)||size<=0)throw new Error('Invalid shoe size');
  const matrix=vector(registration?.shoe?.matrix,16,'shoe matrix');
  const world=vector(registration?.camera?.world,16,'camera world');
  const projection=vector(registration?.camera?.projection,16,'camera projection');
  if(registration.camera.type!=='orthographic')throw new Error('Orthographic camera required');
  const viewport=registration.viewport;
  if(![viewport?.width,viewport?.height,fit?.width,fit?.height].every(x=>finite(x)&&x>0)||![fit?.x,fit?.y].every(finite))throw new Error('Invalid registration dimensions');
  const project=p=>{
    const clip=transform(projection,view(world,transform(matrix,[...p,1])));
    if(Math.abs(clip[3])<1e-12)throw new Error('Invalid projected point');
    return [((clip[0]/clip[3]+1)*viewport.width/2-fit.x)/fit.width,((1-clip[1]/clip[3])*viewport.height/2-fit.y)/fit.height];
  };
  const w=size*.37,l=size*.88,y=6.5,z=l*.46+4;
  const edge=[project([-w*.75/2,y,z]),project([w*.75/2,y,z])];
  const outside=project([0,y,z+Math.max(size*.1,1)]);
  const dx=edge[1][0]-edge[0][0],dy=edge[1][1]-edge[0][1],length=Math.hypot(dx,dy);
  if(length<1e-10)throw new Error('Shoe lip projects to a point');
  let plane=[-dy/length,dx/length,0];plane[2]=-plane[0]*edge[0][0]-plane[1]*edge[0][1];
  if(signed(plane,outside)<0)plane=plane.map(v=>-v);
  return {edge,plane,outside,assumption:'low-planar-extraction-unbeveled-lip',lipTopY:y,lipFrontZ:z};
}
function signed(plane,p){return plane[0]*p[0]+plane[1]*p[1]+plane[2];}
/** Clips just the current card polygon, preserving source UVs and depth.
 * Vertices are {position:[normalized x,y,z],uv:[u,v]} in winding order.
 * Output can have 0..5 vertices. Triangulate as a fan; do not move the corners.
 */
export function clipExtractingCard(vertices,{mouth,frame,pickupFrame,fullyExtractedFrame}){
  if(!Array.isArray(vertices)||vertices.length!==4)throw new Error('A rigid card requires four vertices');
  vertices.forEach(v=>{vector(v.position,3,'card position');vector(v.uv,2,'card UV');});
  if(![frame,pickupFrame,fullyExtractedFrame].every(Number.isInteger)||pickupFrame<0||fullyExtractedFrame<=pickupFrame)throw new Error('Measured extraction frame window required');
  const plane=vector(mouth?.plane,3,'mouth plane');
  const active=frame>=pickupFrame&&frame<fullyExtractedFrame;
  if(!active)return {active:false,vertices:vertices.map(v=>({position:[...v.position],uv:[...v.uv]}))};
  const out=[];
  const copy=v=>({position:[...v.position],uv:[...v.uv]});
  const equal=(a,b)=>a.position.every((v,i)=>v===b.position[i])&&a.uv.every((v,i)=>v===b.uv[i]);
  const append=v=>{if(!out.length||!equal(out[out.length-1],v))out.push(v);};
  for(let i=0;i<vertices.length;i++){
    const a=vertices[i],b=vertices[(i+1)%vertices.length],da=signed(plane,a.position),db=signed(plane,b.position);
    if(da>=0)append(copy(a));
    if((da>=0)!==(db>=0)){
      const t=da/(da-db),lerp=(a,b)=>a.map((v,j)=>v+(b[j]-v)*t);
      // Preserve exact endpoints: recomputing b at t=1 can introduce rounding
      // and leave two almost-identical vertices at a corner on the lip.
      append(t===0?copy(a):t===1?copy(b):{position:lerp(a.position,b.position),uv:lerp(a.uv,b.uv)});
    }
  }
  if(out.length>1&&equal(out[0],out[out.length-1]))out.pop();
  return {active:true,vertices:out};
}
