export const sourceSize = Object.freeze([1920,1080]);
export const textureContract = Object.freeze({asset:'card-allowed.png',colorSpace:'NoColorSpace',flipY:false,channel:'r',application:'card alpha only'});
const windows=new Map([[1,[4,11]],[2,[31,37]],[3,[55,62]],[4,[83,89]]]);
export function shoeMaskEnabled({id,nativeFrame,status}) {
 const range=windows.get(id);
 return status==='active' && Number.isFinite(nativeFrame) && Boolean(range) && nativeFrame>=range[0] && nativeFrame<=range[1];
}
export function sourcePixelUV(x,y) { return [x/sourceSize[0],y/sourceSize[1]]; }
