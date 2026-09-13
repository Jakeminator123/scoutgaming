"""Pack reviewed fixed-pose joins, preserving actor registration and source data."""
from pathlib import Path
from PIL import Image
import numpy as np
import cv2,json,subprocess,math,hashlib,sys
ROOT=Path(__file__).resolve().parent;PUBLIC=ROOT.parents[3]/'web/public';OUT=PUBLIC/'dealers/astrid/performance/joins'
OUT.mkdir(parents=True,exist_ok=True)
cv2.setNumThreads(4);flow=cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
W,H=930,675;FPS=60;STEP=.8 # 24 fps source at 2x, no change to dealing clocks.
grid=np.stack(np.meshgrid(np.arange(W,dtype=np.float32),np.arange(H,dtype=np.float32)),axis=-1)
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def idle():
    rgb=Image.open(ROOT/'idle-rgb.png').convert('RGB').resize((692,692),Image.Resampling.LANCZOS)
    mask=Image.open(ROOT/'idle-mask.png').convert('L').resize((692,692),Image.Resampling.LANCZOS)
    a=Image.new('RGB',(1920,1080));m=Image.new('L',a.size);a.paste(rgb,(614,-45));m.paste(mask,(614,-45))
    return np.array(a.crop((570,0,1500,675))),np.array(m.crop((570,0,1500,675)))
IDLE=idle()
def generated(pose,n):
    raw,matte=directories(pose)
    if pose==3:n=len(list(raw.glob('*.png')))-1-n
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
def endpoint(pose):
    p=Image.open(ROOT/f'pose-{pose}-packed.png');a=p.crop((570,0,1500,675));m=p.crop((570,1080,1500,1755)).getchannel('R')
    return np.array(a),np.array(m)
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
base=json.loads((PUBLIC/'dealers/astrid/performance/smooth60/manifest.json').read_text())
contract=json.loads((ROOT/'contract.json').read_text());joins=[]
poses=[int(x) for x in sys.argv[1:]] or [3,21,34,47]
def directories(pose):
    # Original return-3 is rejected: it invents a wide-arm starting pose.
    # Pose 3 uses only the separately generated forward entry, read backwards
    # here so the standard encoder can produce both playback directions.
    suffix='entry-3' if pose==3 else str(pose)
    return ROOT/f'raw-{suffix}',ROOT/f'masks-{suffix}'
if (OUT/'manifest.json').exists():joins=[j for j in json.loads((OUT/'manifest.json').read_text())['joins'] if int(j['id'].split('-')[1]) not in poses]
for pose in poses:
    count=len(list(directories(pose)[0].glob('*.png')))
    if count<2:raise RuntimeError(f'Missing source {pose}')
    output_frames=math.ceil((count-1)/STEP)+1
    ret=OUT/f'return-{pose}.mp4'
    process=subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s','1920x2160','-r','60','-i','-','-an','-c:v','libx264','-preset','fast','-crf','14','-bf','0','-pix_fmt','yuv420p','-movflags','+faststart',str(ret)],stdin=subprocess.PIPE)
    def frame(n):
        # Exact source frames at the seams; interpolation of the near-identical
        # generated first/last poses absorbs codec differences, not a pose cut.
        if n==0:return endpoint(pose)
        if n==count-1:return IDLE
        return generated(pose,n)
    pair=-1
    for j in range(output_frames):
        pos=min(count-1,j*STEP);i=min(count-2,int(pos));t=pos-i
        if i!=pair:a,am=frame(i);b,bm=frame(i+1);ab,ba=fields(a,am,b,bm);pair=i
        ma=grid-ab*t;mb=grid-ba*(1-t)
        rgb=interpolate(a,b,ma,mb,t);mask=interpolate(am,bm,ma,mb,t)
        packed=np.zeros((2160,1920,3),dtype='uint8');packed[:H,570:1500]=rgb;packed[1080:1080+H,570:1500,0]=mask
        process.stdin.write(packed.tobytes())
    process.stdin.close()
    if process.wait()!=0:raise RuntimeError('Return encode failed')
    ent=OUT/f'entry-{pose}.mp4'
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(ret),'-vf','reverse','-an','-c:v','libx264','-preset','fast','-crf','14','-bf','0','-pix_fmt','yuv420p','-movflags','+faststart',str(ent)],check=True)
    for edge,file in [('entry',ent),('exit',ret)]:
        bindings=[]
        for take in base['takes']:
            physical=take['tracking']['sourceStart'] if edge=='entry' else take['tracking']['sourceStop']-1
            if physical==pose:bindings.append({'edge':edge,'takeId':take['id'],'mediaSha256':take['media']['sha256'],'calibrationSha256':take['calibrationSha256']})
        if not bindings:continue
        joins.append({'id':f'{edge}-{pose}','status':'review','camera':{'width':1920,'height':1080},'media':{'src':str(file.relative_to(PUBLIC)),'sha256':sha(file),'width':1920,'height':1080,'fps':60,'frames':output_frames},'bindings':bindings,'idle':{'rgbSha256':contract['idle']['rgbSha256'],'maskSha256':contract['idle']['maskSha256']},'calibrationSha256':'0'*64})
    print(f'Packed pose {pose}: {output_frames} frames',flush=True)
(OUT/'manifest.json').write_text(json.dumps({'version':1,'joins':joins}))
subprocess.run(['node','--input-type=module','-e',"import fs from'node:fs';import{createHash}from'node:crypto';import{sceneJoinPayload,validateSceneJoin}from'./web/public/scene-join.mjs';const p='web/public/dealers/astrid/performance/joins/manifest.json',m=JSON.parse(fs.readFileSync(p));for(const j of m.joins){j.calibrationSha256=createHash('sha256').update(sceneJoinPayload(j)).digest('hex');const e=validateSceneJoin(j);if(e.length)throw Error(e.join(';'));}fs.writeFileSync(p,JSON.stringify(m));"],cwd=PUBLIC.parents[1],check=True)
