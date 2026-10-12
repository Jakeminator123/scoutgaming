// One height-based source transform for both viewports. Mobile crops the
// horizontal centre of this wide plane; it never rescales the actor.
export const DEFAULT_DEALER_FRAMING = Object.freeze({scale:1,x:0,y:0});
export const DEFAULT_GREEN_SCREEN = Object.freeze({mode:'green-screen',threshold:.23,softness:.15,despill:.5});
export function validateDealerFraming(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).sort().join(',') !== 'scale,x,y'
    || !Number.isFinite(value.scale) || value.scale < .25 || value.scale > 6
    || ['x','y'].some(key => !Number.isFinite(value[key]) || Math.abs(value[key]) > 2)) throw Error('Ogiltig dealerinramning.');
  return {...value};
}
export function dealerFrameRect(sourceWidth,sourceHeight,width,height,framing=DEFAULT_DEALER_FRAMING) {
  const {scale,x,y}=validateDealerFraming(framing);
  if (![sourceWidth,sourceHeight,width,height].every(value=>Number.isFinite(value)&&value>0)) throw Error('Videon saknar bildmått.');
  const h=height*scale,w=h*sourceWidth/sourceHeight;
  return [(width-w)/2+x*height,(height-h)/2+y*height,w,h];
}
export function drawDealerFrame(context,video,width,height,framing,green=false) {
  context.clearRect(0,0,width,height);
  if(green){context.fillStyle='#00ff00';context.fillRect(0,0,width,height);}
  context.drawImage(video,...dealerFrameRect(video.videoWidth,video.videoHeight,width,height,framing));
}
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
// Matches the shared compositor's key. Soft alpha and spill correction preserve
// the source alpha and touch only keyed pixels, as in the reviewed Gronstripp method.
export function keyGreenPixels(data,key) {
  for(let i=0;i<data.length;i+=4){
    const r=data[i]/255,g=data[i+1]/255,b=data[i+2]/255;
    const green=smooth(key.threshold,key.threshold+key.softness,(g-Math.max(r,b))/Math.max(g,.001))*smooth(.012,.065,g);
    data[i+3]*=1-green;
    data[i+1]=255*(g+(Math.min(g,Math.max(r,b))-g)*key.despill*green);
  }
  return data;
}
