"""Native RGB reconstruction, shared RGB/matte optical flow, 60 fps at 80% pace.
The extra frames and card footprints are estimates, never new measured contacts.
"""
from pathlib import Path
import json,math,hashlib,subprocess,shutil
import numpy as np
import cv2
from PIL import Image
ROOT=Path(__file__).resolve().parent
PUBLIC=ROOT.parents[4]/'web/public'
BASE=PUBLIC/'dealers/astrid/performance/rhythm'
OUT=PUBLIC/'dealers/astrid/performance/smooth60'
OUT.mkdir(parents=True,exist_ok=True)
manifest=json.loads((BASE/'manifest.json').read_text())
W,H,FPS,SPEED=1920,1080,60,.8
cv2.setNumThreads(4)
flow=cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
grid=np.stack(np.meshgrid(np.arange(W,dtype=np.float32),np.arange(H,dtype=np.float32)),axis=-1)
def frame(n):
    source=Image.open(ROOT/'native'/f'{n+1:04}.png').convert('RGB').resize((1698,1272),Image.Resampling.LANCZOS)
    rgb=Image.new('RGB',(W,H));rgb.paste(source,(111,-168))
    p=Image.open(ROOT.parent/'integration/packed-frames'/f'{n+1:04}.png')
    masks=p.crop((0,720,1280,1440)).resize((W,H),Image.Resampling.LANCZOS)
    return np.array(rgb),np.array(masks)
def fields(a,b):
    small=lambda x:cv2.cvtColor(cv2.resize(x,(W//2,H//2)),cv2.COLOR_RGB2GRAY)
    a,b=small(a),small(b)
    forward=flow.calc(a,b,None);backward=flow.calc(b,a,None)
    return cv2.resize(forward,(W,H))*2,cv2.resize(backward,(W,H))*2
def warp(a,b,ab,ba,t):
    # Exactly the same maps are applied to RGB and all matte channels.
    ma=grid-ab*t;mb=grid-ba*(1-t)
    aa=cv2.remap(a,ma,None,cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
    bb=cv2.remap(b,mb,None,cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
    return cv2.addWeighted(aa,1-t,bb,t,0)
done={};receipts=[]
for take in manifest['takes']:
    old=json.loads(json.dumps(take));start=old['tracking']['sourceStart'];count=old['media']['frames']
    step=old['media']['fps']*SPEED/FPS
    frames=math.ceil((count-1)/step)+1
    out=OUT/(take['action']+'.mp4')
    key=(start,count)
    if key in done:shutil.copyfile(done[key],out)
    else:
        process=subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H*2}','-r',str(FPS),'-i','-','-an','-c:v','libx264','-preset','fast','-crf','14','-bf','0','-pix_fmt','yuv420p','-movflags','+faststart',str(out)],stdin=subprocess.PIPE)
        pair=-1
        for j in range(frames):
            at=min(count-1,j*step);i=min(count-2,int(at));t=at-i
            if i!=pair:
                a,am=frame(start+i);b,bm=frame(start+i+1);ab,ba=fields(a,b);pair=i
            rgb=warp(a,b,ab,ba,t);masks=warp(am,bm,ab,ba,t)
            process.stdin.write(np.concatenate([rgb,masks],axis=0).tobytes())
        process.stdin.close()
        if process.wait()!=0:raise RuntimeError('Encoding failed')
        done[key]=out
    take['id']=old['id'].replace('rhythm','smooth60')
    take['media'].update(src=str(out.relative_to(PUBLIC)),sha256=hashlib.sha256(out.read_bytes()).hexdigest(),width=W,height=H,fps=FPS,frames=frames)
    take['camera'].update(width=W,height=H)
    events={k:round(v/step) for k,v in old['events'].items()};events['rest']=frames-1
    take['events']=events
    take['tracking']['resampling']={'method':'bidirectional-DIS-shared-RGB-matte','sourceFps':24,'outputFps':60,'speed':SPEED,'inputCalibrationSha256':old['calibrationSha256'],'inputMediaSha256':old['media']['sha256'],'nativeRGB':True}
    records=[]
    def lerp(a,b,t):return [x+(y-x)*t for x,y in zip(a,b)]
    for j in range(frames):
        at=min(count-1,j*step);i=min(count-2,int(at));t=at-i
        finger=lerp(old['frames'][i]['contact']['finger'],old['frames'][i+1]['contact']['finger'],t)
        card=None
        if events['pickup']<=j<=events['land']:
            atcard=max(old['events']['pickup'],min(old['events']['land'],at));k=min(old['events']['land'],int(atcard));nextk=min(old['events']['land'],k+1)
            a=old['frames'][k]['card'];b=old['frames'][nextk]['card']
            card={'corners':[lerp(x,y,atcard-k) for x,y in zip(a['corners'],b['corners'])],'faceUp':a['faceUp']}
        records.append({'frame':j,'card':card,'contact':{'finger':finger,'measured':False,'method':'resampled hand proxy'}})
    take['frames']=records
    receipts.append({'id':take['id'],'inputFrames':count,'outputFrames':frames,'restSeconds':events['rest']/FPS})
manifest['reviewCandidates']=[t['id'] for t in manifest['takes']]
(OUT/'manifest.json').write_text(json.dumps(manifest))
subprocess.run(['node','--input-type=module','-e',"import fs from 'node:fs';import{createHash}from'node:crypto';import{calibrationPayload,validateContactTake}from'./web/public/performance-contact.mjs';const p='web/public/dealers/astrid/performance/smooth60/manifest.json';const m=JSON.parse(fs.readFileSync(p));for(const t of m.takes){t.calibrationSha256=createHash('sha256').update(calibrationPayload(t)).digest('hex');const e=validateContactTake(t);if(e.length)throw Error(e.join(';'));}fs.writeFileSync(p,JSON.stringify(m));"],cwd=PUBLIC.parents[1],check=True)
(ROOT/'receipt.json').write_text(json.dumps(receipts,indent=2))
print(json.dumps(receipts),flush=True)
