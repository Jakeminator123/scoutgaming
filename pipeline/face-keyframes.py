#!/usr/bin/env python3
# Stage 1 of the viseme rig: track KEYFRAME POINTS on a dealer's face through a
# speech clip (nose anchor via NCC, mouth box, lip corners, openness) and bind
# them to the audio waveform - the After Effects "convert audio to keyframes"
# workflow, but the keyframes are measured off her actual face.
# Outputs (to --out dir):
#   <dealer>-<key>-track.json     per-frame keyframe values
#   <dealer>-<key>-face-kf.png    face frames with keyframe markers drawn
#   <dealer>-<key>-timeline.png   AE-style: waveform + curves + keyframe diamonds
# Usage: face-keyframes.py <base> <key> <out-dir> [--frames a,b,c,...]
import json, os, sys, subprocess, io
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont
SR=44100; FPS=24
base,key,outd=sys.argv[1],sys.argv[2],sys.argv[3]
os.makedirs(outd,exist_ok=True)
dealer=os.path.basename(base.rstrip('/')) if 'dealers' in base else 'vera'
cfg=json.load(open(f'{base}/trackcfg.json')) if os.path.exists(f'{base}/trackcfg.json') else {'crop':[560,340,340,360],'nose':[120,70,80,70],'mouthOff':[-30,60,140,90]}
idx=json.load(open(f'{base}/streams/index.json'))
c=idx['clips'][f'idle-1/speak/{key}']
stream=f"{base}/streams/{c['file']}"
mp3=f'{base}/audio/en/dry/{key}.mp3'
if not os.path.exists(mp3): mp3=f'{base}/audio/en/{key}.mp3'
cx,cy,cw,ch=cfg['crop']; nx,ny,nw,nh=cfg['nose']; dx,dy,mw,mh=cfg['mouthOff']

# ---- decode frames (face crop region, full res) ----
out=subprocess.run(['ffmpeg','-nostdin','-loglevel','error','-f','h264','-r',str(FPS),'-i',stream,
    '-vf',f'crop={cw}:{ch}:{cx}:{cy}','-vsync','0','-f','image2pipe','-vcodec','png','-'],capture_output=True).stdout
sig=b'\x89PNG'; st=[i for i in range(len(out)) if out[i:i+4]==sig]
frames=[np.array(Image.open(io.BytesIO(out[s:(st[i+1] if i+1<len(st) else len(out))])).convert('RGB')) for i,s in enumerate(st)]
gray=[cv2.cvtColor(f,cv2.COLOR_RGB2GRAY).astype(np.float32) for f in frames]

# ---- nose NCC track (the anchor keyframe) ----
tpl=gray[0][ny:ny+nh,nx:nx+nw].copy()
R=30; pos=(nx,ny); tracks=[]
for g in gray:
    px,py=pos
    y0=max(0,py-R); y1=min(ch-nh,py+R); x0=max(0,px-R); x1=min(cw-nw,px+R)
    res=cv2.matchTemplate(g[y0:y1+nh,x0:x1+nw],tpl,cv2.TM_CCOEFF_NORMED)
    _,_,_,ml=cv2.minMaxLoc(res)
    pos=(x0+ml[0],y0+ml[1])
    mx=min(max(0,pos[0]+dx),cw-mw); my=min(max(0,pos[1]+dy),ch-mh)
    patch=gray[len(tracks)][my:my+mh,mx:mx+mw]
    rgb=frames[len(tracks)][my:my+mh,mx:mx+mw]
    # mouth keyframe metrics - measure the CORE of the box only, so background
    # at the edges (dark halls) never pollutes the cavity signal
    core=patch[int(mh*.20):int(mh*.85), int(mw*.22):int(mw*.78)]
    dark=(core<60).astype(np.uint8)                # open-mouth cavity
    openness=float(dark.mean())
    teeth=float((core>150).mean())
    # lip line: reddest row band
    redness=(rgb[:,:,0].astype(int)-((rgb[:,:,1].astype(int)+rgb[:,:,2].astype(int))//2))
    cols=np.where(redness.max(axis=0)>18)[0]
    width=float((cols[-1]-cols[0])/mw) if len(cols)>1 else 0.0
    tracks.append({'nose':[int(pos[0]),int(pos[1])],'mouth':[int(mx),int(my),mw,mh],
                   'open':round(openness,4),'teeth':round(teeth,4),'width':round(width,3)})

# ---- audio -> keyframes (AE convert-audio-to-keyframes) ----
a=subprocess.run(['ffmpeg','-nostdin','-loglevel','error','-i',mp3,'-f','f32le','-ac','1','-ar',str(SR),'-'],capture_output=True).stdout
x=np.frombuffer(a,dtype=np.float32)
hop=SR//FPS
amp=np.array([np.abs(x[i*hop:(i+1)*hop]).mean() if (i+1)*hop<=len(x) else 0.0 for i in range(len(frames))])
amp=amp/(amp.max()+1e-9)
delay=c.get('audioDelayMs',0)
dshift=int(round(delay*FPS/1000))
amp_al=np.zeros(len(frames)); amp_al[dshift:dshift+len(amp)]=amp[:max(0,len(frames)-dshift)]
opens=np.array([t['open'] for t in tracks])
import scipy.signal as _ss
opens=_ss.medfilt(opens,3)
opens=(opens-opens.min())/(opens.ptp()+1e-9)
corr=float(np.corrcoef(amp_al,opens)[0,1])
json.dump({'dealer':dealer,'key':key,'delayMs':delay,'corr':round(corr,3),'fps':FPS,'tracks':tracks,
           'audioKeyframes':[round(float(v),4) for v in amp_al]},open(f'{outd}/{dealer}-{key}-track.json','w'))

# ---- print screen 1: keyframes drawn on the face ----
picks=[int(v) for v in (sys.argv[sys.argv.index('--frames')+1].split(',') if '--frames' in sys.argv else [])]
if not picks:
    order=np.argsort(-amp_al)
    picks=sorted(set([0]+[int(i) for i in order[:40]][:5]))[:6]
tiles=[]
for fi in picks:
    im=Image.fromarray(frames[fi]).convert('RGB'); d=ImageDraw.Draw(im)
    t=tracks[fi]
    nxp,nyp=t['nose']; mxp,myp,mwp,mhp=t['mouth']
    d.rectangle([nxp,nyp,nxp+nw,nyp+nh],outline=(80,200,255),width=2)
    d.text((nxp+2,nyp-14),'NOSE ANCHOR',fill=(80,200,255))
    d.rectangle([mxp,myp,mxp+mwp,myp+mhp],outline=(214,255,58),width=3)
    d.text((mxp+2,myp+mhp+3),f"MOUTH KF  open={t['open']:.3f} width={t['width']:.2f}",fill=(214,255,58))
    # diamond markers at lip corners (from width scan)
    lc=(mxp+int((0.5-t['width']/2)*mwp), myp+int(mhp*0.55)); rc=(mxp+int((0.5+t['width']/2)*mwp), myp+int(mhp*0.55))
    for px,py in (lc,rc):
        d.polygon([(px,py-7),(px+7,py),(px,py+7),(px-7,py)],outline=(255,120,120),width=2)
    d.text((6,6),f'{dealer} / {key}  frame {fi}  t={fi*1000//FPS}ms  audio={amp_al[fi]:.2f}',fill=(255,255,0))
    tiles.append(im.resize((300,int(300*ch/cw))))
sheet=Image.new('RGB',(300*len(tiles),tiles[0].height),(10,11,13))
for i,t in enumerate(tiles): sheet.paste(t,(300*i,0))
sheet.save(f'{outd}/{dealer}-{key}-face-kf.png')

# ---- print screen 2: AE-style timeline ----
Wt,Ht=1600,540
tl=Image.new('RGB',(Wt,Ht),(12,13,16)); d=ImageDraw.Draw(tl)
n=len(frames); xw=Wt-120
def X(i): return 60+int(i*xw/max(1,n-1))
# waveform lane
wl_y,wl_h=70,120
d.text((60,wl_y-24),f'AUDIO WAVEFORM  ({os.path.basename(mp3)}, shifted by audioDelayMs={delay})',fill=(140,150,160))
step=max(1,len(x)//xw)
for i in range(xw):
    s=x[i*step:(i+1)*step]
    if len(s)==0: continue
    h=int(min(1,np.abs(s).max()*1.2)*wl_h/2)
    px=60+int((i*step/len(x))*xw*(len(x)/SR*FPS)/n)  # map to frame timeline incl delay
    px=60+int(((i*step/len(x))*(len(x)/SR)*FPS+dshift)*xw/max(1,n-1))
    if px<Wt-60: d.line([(px,wl_y+wl_h//2-h),(px,wl_y+wl_h//2+h)],fill=(90,170,90))
# amplitude keyframes lane
ak_y=230
d.text((60,ak_y-22),'AUDIO -> KEYFRAMES (per-frame amplitude, the AE convert-audio-to-keyframes lane)',fill=(140,150,160))
for i in range(n):
    v=amp_al[i]; py=ak_y+60-int(v*55)
    d.ellipse([X(i)-2,py-2,X(i)+2,py+2],fill=(120,220,120))
# mouth openness lane (measured off her face)
mo_y=340
d.text((60,mo_y-22),f'MOUTH OPENNESS KEYFRAMES (measured on her face)  raw-amplitude corr: {corr:.2f} - low BY NATURE: loud consonants (M/B/P) close the lips. Bind keyframes to VISEMES, use amplitude as intensity',fill=(140,150,160))
prev=None
for i in range(n):
    v=opens[i]; py=mo_y+60-int(v*55)
    if prev: d.line([prev,(X(i),py)],fill=(214,255,58),width=2)
    prev=(X(i),py)
# viseme keyframe diamonds where openness inflects
vk_y=470
d.text((60,vk_y-22),'VISEME KEYFRAMES (inflection points -> which mouth tile shows)',fill=(140,150,160))
grad=np.gradient(opens)
kf=[i for i in range(1,n-1) if (grad[i-1]>0)!=(grad[i]>0) and amp_al[i]>0.05]
for i in kf:
    cls='AA' if opens[i]>0.6 else ('EE' if tracks[i]['teeth']>0.02 else ('OH' if opens[i]>0.3 else 'MM'))
    d.polygon([(X(i),vk_y-8),(X(i)+8,vk_y),(X(i),vk_y+8),(X(i)-8,vk_y)],fill=(255,200,60))
    d.text((X(i)-8,vk_y+12),cls,fill=(255,200,60))
for fi in picks:
    d.line([(X(fi),wl_y),(X(fi),vk_y+30)],fill=(70,75,85))
    d.text((X(fi)-10,vk_y+34),f'f{fi}',fill=(120,130,145))
d.text((60,14),f'{dealer.upper()} / {key} - face keyframes bound to the waveform  ({n} frames @ {FPS}fps, {len(kf)} viseme keyframes)',fill=(240,240,240))
tl.save(f'{outd}/{dealer}-{key}-timeline.png')
print(json.dumps({'dealer':dealer,'key':key,'frames':n,'corr':round(corr,3),'visemeKeyframes':len(kf),'picks':picks}))
