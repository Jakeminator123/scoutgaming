"""Stage ready motion at the existing game camera; never installs incomplete media."""
from pathlib import Path
from PIL import Image
import numpy as np
import cv2,json,subprocess,math,hashlib
ROOT=Path(__file__).resolve().parent
cv2.setNumThreads(4)
flow=cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
W,H=930,675
STEP=.4 # Native 24 fps duration, interpolated to 60; no speed-up.
grid=np.stack(np.meshgrid(np.arange(W,dtype=np.float32),np.arange(H,dtype=np.float32)),axis=-1)
def generated(n):
    raw,matte=ROOT/'raw',ROOT/'masks'
    im=Image.open(raw/f'{n+1:04}.png').convert('RGB');mask=Image.open(matte/f'{n+1:04}.png').convert('L')
    # The service pads custom-aspect references into 4:3. Crop the padding,
    # retaining equal horizontal and vertical scale, rather than stretching.
    h=im.width*H/W;y=(im.height-h)/2;box=(0,round(y),im.width,round(y+h))
    rgb=np.array(im.crop(box).resize((W,H),Image.Resampling.LANCZOS))
    alpha=np.array(mask.crop(box).resize((W,H),Image.Resampling.LANCZOS))
    # Vision extends the torso into the solid-black area below these cutouts.
    # Limit its matte to the photographed silhouette, filling interior dark
    # cloth but excluding exterior black. Never key black pixels inside a suit.
    seed=(rgb.max(axis=2)>10).astype('uint8')*255
    seed=cv2.morphologyEx(seed,cv2.MORPH_CLOSE,np.ones((3,3),dtype='uint8'))
    contours,_=cv2.findContours(seed,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
    support=np.zeros_like(alpha)
    cv2.drawContours(support,[c for c in contours if cv2.contourArea(c)>100],-1,255,cv2.FILLED)
    support=cv2.GaussianBlur(support,(3,3),.6)
    return rgb,np.minimum(alpha,support)
def fields(a,am,b,bm):
    def small(rgb,mask):
        rgb=(rgb.astype(float)*(mask[:,:,None]/255)).astype('uint8')
        return cv2.cvtColor(cv2.resize(rgb,(465,338)),cv2.COLOR_RGB2GRAY)
    aa,bb=small(a,am),small(b,bm)
    f=flow.calc(aa,bb,None);r=flow.calc(bb,aa,None)
    scale=np.array([W/465,H/338],dtype=np.float32)
    return cv2.resize(f,(W,H))*scale,cv2.resize(r,(W,H))*scale
def interpolate(a,b,ma,mb,t):
    return cv2.addWeighted(cv2.remap(a,ma,None,cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT),1-t,cv2.remap(b,mb,None,cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT),t,0)

count=len(list((ROOT/'raw').glob('*.png')))
assert count==len(list((ROOT/'masks').glob('*.png'))) and count>1
out=ROOT/'ready-packed60.mp4'
output_frames=math.ceil((count-1)/STEP)+1
process=subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s','1920x2160','-r','60','-i','-','-an','-c:v','libx264','-preset','fast','-crf','14','-bf','0','-pix_fmt','yuv420p','-movflags','+faststart',str(out)],stdin=subprocess.PIPE)
pair=-1
for j in range(output_frames):
    pos=min(count-1,j*STEP);i=min(count-2,int(pos));t=pos-i
    if i!=pair:a,am=generated(i);b,bm=generated(i+1);ab,ba=fields(a,am,b,bm);pair=i
    rgb=interpolate(a,b,grid-ab*t,grid-ba*(1-t),t)
    mask=interpolate(am,bm,grid-ab*t,grid-ba*(1-t),t)
    packed=np.zeros((2160,1920,3),dtype='uint8')
    packed[:H,570:1500]=rgb;packed[1080:1080+H,570:1500,0]=mask
    process.stdin.write(packed.tobytes())
process.stdin.close()
assert process.wait()==0
(ROOT/'packed-review.json').write_text(json.dumps({'status':'staged-not-integrated','sourceFrames':count,'frames':output_frames,'fps':60,'sourceFps':24,'interpolation':'DIS bidirectional optical flow','camera':{'width':1920,'height':1080},'crop':[570,0,1500,675],'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'missingBridges':[21,34,'speech-idle'],'limitation':'Interpolation does not add source detail or prove loop seams. Requires rendered handoff review.'},indent=2)+'\n')
print(f'Packed {output_frames} frames at 60 fps: {out}',flush=True)
