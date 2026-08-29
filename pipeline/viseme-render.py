#!/usr/bin/env python3
# Stage 4: OUR renderer. Composites the dealer's own mouth tiles over her idle
# loop, driven by a viseme keyframe timeline - any new line, lips always
# connected, zero generation. Tile placement rides the per-frame nose track,
# color is matched per frame, edges feathered, tile switches crossfaded.
# Usage: viseme-render.py <base> <atlas.json> <timeline.json> <audio.mp3> <out.mp4> [--delay ms]
import json, os, sys, subprocess, io, tempfile, glob
import numpy as np, cv2
from PIL import Image
FPS=24
base,atlasp,tlp,mp3,outp=sys.argv[1:6]
delay=int(sys.argv[sys.argv.index('--delay')+1]) if '--delay' in sys.argv else 400
cfg=json.load(open(f'{base}/trackcfg.json')) if os.path.exists(f'{base}/trackcfg.json') else {'crop':[560,340,340,360],'nose':[120,70,80,70],'mouthOff':[-30,60,140,90]}
cx,cy,cw,ch=cfg['crop']; nx,ny,nw,nh=cfg['nose']; dx,dy,mw,mh=cfg['mouthOff']
atlas=json.load(open(atlasp)); MX,MY=atlas['margin']
adir=os.path.dirname(atlasp)
tiles={cl:[np.array(Image.open(f'{adir}/tiles/{t["file"]}').convert('RGB'),dtype=np.float32) for t in arr]
       for cl,arr in atlas['classes'].items()}
tl=json.load(open(tlp))
kfs=tl['keyframes']
adur=max(k['endMs'] for k in kfs)+300
idx=json.load(open(f'{base}/streams/index.json'))
idle=f"{base}/streams/{idx['clips']['idle-1/idle/idle']['file']}"
# decode FULL idle frames (1440) - we rebuild complete frames
out=subprocess.run(['ffmpeg','-nostdin','-loglevel','error','-f','h264','-r',str(FPS),'-i',idle,
    '-vsync','0','-f','rawvideo','-pix_fmt','rgb24','-'],capture_output=True).stdout
FW=1440
nfr=len(out)//(FW*FW*3)
full=[np.frombuffer(out[i*FW*FW*3:(i+1)*FW*FW*3],dtype=np.uint8).reshape(FW,FW,3).astype(np.float32) for i in range(nfr)]
n=len(full)
gray=[cv2.cvtColor(f[cy:cy+ch,cx:cx+cw].astype(np.uint8),cv2.COLOR_RGB2GRAY).astype(np.float32) for f in full]
tpl=gray[0][ny:ny+nh,nx:nx+nw].copy()
R=30; pos=(nx,ny); anchors=[]
for g in gray:
    px,py=pos
    y0=max(0,py-R); y1=min(ch-nh,py+R); x0=max(0,px-R); x1=min(cw-nw,px+R)
    res=cv2.matchTemplate(g[y0:y1+nh,x0:x1+nw],tpl,cv2.TM_CCOEFF_NORMED)
    _,_,_,ml=cv2.minMaxLoc(res)
    pos=(x0+ml[0],y0+ml[1]); anchors.append(pos)
# feathered elliptical mask over the tile
th_,tw_=mh+2*MY,mw+2*MX
yy,xx=np.mgrid[0:th_,0:tw_]
eyc,exc=th_*0.52,tw_*0.5
mask=1.0-np.clip(((xx-exc)/(tw_*0.42))**2+((yy-eyc)/(th_*0.40))**2,0,1)
mask=np.clip(mask*1.8,0,1)[...,None].astype(np.float32)
def viseme_at(ms):
    for k in kfs:
        if k['startMs']<=ms<k['endMs']: return k
    return None
def pick_tile(cl,kfid):
    # ONE stable exemplar per keyframe - flipping exemplars mid-keyframe reads
    # as texture popping (Kevin: "doesn't look natural")
    arr=tiles.get(cl) or tiles.get('AH') or tiles.get('EE')
    return arr[sum(ord(c) for c in kfid)%len(arr)]
frames_needed=int(np.ceil((delay+adur)/1000*FPS))+FPS
outframes=[]; track=[]
prev_cl=None; fade=0
for i in range(frames_needed):
    src=full[i%n].copy()
    ms=i*1000/FPS - delay
    k=viseme_at(ms)
    ax,ay=anchors[i%n]
    rec={'f':i,'ms':int(i*1000/FPS),'nose':[int(cx+ax),int(cy+ay)]}
    if k is not None:
        px=cx+ax+dx-MX; py=cy+ay+dy-MY
        tile=pick_tile(k['viseme'],k['id']).copy()
        reg=src[py:py+th_,px:px+tw_]
        # per-frame color match: tile stats -> region stats (channelwise)
        for c in range(3):
            tm,ts=tile[...,c].mean(),tile[...,c].std()+1e-5
            rm,rs=reg[...,c].mean(),reg[...,c].std()+1e-5
            tile[...,c]=np.clip((tile[...,c]-tm)/ts*rs+rm,0,255)
        a=mask.copy()
        if k['viseme']!=prev_cl: fade=0
        fade=min(fade+1,3); a=a*(fade/3.0)
        prev_cl=k['viseme']
        src[py:py+th_,px:px+tw_]=reg*(1-a)+tile*a
        rec.update({'kf':k['id'],'viseme':k['viseme'],'word':k['word'],'wave':k['wave'],
                    'rect':[int(px),int(py),int(tw_),int(th_)],'alpha':round(fade/3.0,2)})
    else:
        prev_cl=None; fade=0
    track.append(rec)
    outframes.append(src.astype(np.uint8))
# audio envelope for the live waveform lane (10ms hops)
ab=subprocess.run(['ffmpeg','-nostdin','-loglevel','error','-i',mp3,'-f','f32le','-ac','1','-ar','44100','-'],capture_output=True).stdout
xw=np.abs(np.frombuffer(ab,dtype=np.float32)); hop=441
envl=[round(float(v),4) for v in (np.array([xw[j*hop:(j+1)*hop].mean() for j in range(len(xw)//hop)])/ (xw.max()+1e-9))]
json.dump({'fps':FPS,'delayMs':delay,'timeline':tl,'frames':track,'env10ms':envl},
          open(outp.replace('.mp4','.track.json'),'w'))
td=tempfile.mkdtemp()
for i,f in enumerate(outframes):
    Image.fromarray(f).save(f'{td}/f{i:04d}.png')
subprocess.run(['ffmpeg','-nostdin','-loglevel','error','-r',str(FPS),'-i',f'{td}/f%04d.png',
    '-itsoffset',f'{delay/1000:.3f}','-i',mp3,'-map','0:v','-map','1:a',
    '-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-c:a','aac',
    '-movflags','+faststart','-y',outp],check=True)
for f in glob.glob(f'{td}/*.png'): os.remove(f)
print(json.dumps({'out':outp,'frames':len(outframes),'keyframes':len(kfs),'delayMs':delay}))
