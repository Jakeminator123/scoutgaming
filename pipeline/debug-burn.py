#!/usr/bin/env python3
# Burn the keyframe debug view INTO the video pixels - survives any player,
# any phone, fullscreen included. Draws per frame: nose anchor, mouth keyframe
# box in the viseme's color, kf-id/viseme/word/wave-id label, and a bottom
# lane with the audio envelope, wave segments, viseme-colored keyframe ticks
# and a playhead. Audio track is the same mp3.
# Usage: debug-burn.py <pilot.mp4> <track.json> <audio.mp3> <out-debug.mp4>
import json, sys, subprocess, io, tempfile, glob, os
import numpy as np
from PIL import Image, ImageDraw
mp4,trackp,mp3,outp=sys.argv[1:5]
tr=json.load(open(trackp)); FPS=tr['fps']; delay=tr['delayMs']
kfs=tr['timeline']['keyframes']; waves=tr['timeline']['waves']; env=tr['env10ms']
VC={'MM':(255,138,138),'EE':(138,210,255),'AA':(214,255,58),'AH':(255,209,102),'OH':(199,155,255)}
pr=subprocess.run(['ffprobe','-v','error','-select_streams','v:0','-show_entries','stream=width,height','-of','csv=p=0',mp4],capture_output=True,text=True).stdout.strip().split(',')
W,H=int(pr[0]),int(pr[1])
out=subprocess.run(['ffmpeg','-nostdin','-loglevel','error','-i',mp4,'-f','rawvideo','-pix_fmt','rgb24','-'],capture_output=True).stdout
nfr=len(out)//(W*H*3)
frames=[Image.frombytes('RGB',(W,H),out[i*W*H*3:(i+1)*W*H*3]) for i in range(nfr)]
durMs=len(frames)*1000/FPS
LH=170  # lane height
td=tempfile.mkdtemp()
for i,im in enumerate(frames):
    can=Image.new('RGB',(W,H+LH),(10,11,13)); can.paste(im,(0,0))
    d=ImageDraw.Draw(can)
    rec=tr['frames'][min(i,len(tr['frames'])-1)]
    # face overlay
    nxp,nyp=rec['nose']
    d.rectangle([nxp,nyp,nxp+80,nyp+70],outline=(89,200,255),width=3)
    d.text((nxp,nyp-26),'NOSE ANCHOR',fill=(89,200,255))
    if 'rect' in rec:
        x,y,w,h=rec['rect']; col=VC.get(rec['viseme'],(214,255,58))
        d.rectangle([x,y,x+w,y+h],outline=col,width=5)
        d.text((x,y+h+10),f"{rec['kf']}  {rec['viseme']}  '{rec['word']}'  {rec['wave']}  alpha={rec['alpha']}",fill=col)
    # lane
    y0=H
    d.rectangle([0,y0,W,H+LH],fill=(13,14,18))
    for wv in waves:
        x0=(wv['startMs']+delay)/durMs*W; x1=(wv['endMs']+delay)/durMs*W
        d.rectangle([x0,y0,x1,H+LH],fill=(20,30,20))
        d.text((x0+8,y0+8),wv['id'],fill=(111,175,111))
    for j,e in enumerate(env):
        x=(delay+j*10)/durMs*W
        if x>=W: break
        hh=e*70
        d.line([(x,y0+95-hh),(x,y0+95+hh)],fill=(79,159,79))
    for k in kfs:
        x=(k['startMs']+delay)/durMs*W; col=VC.get(k['viseme'],(214,255,58))
        d.polygon([(x,H+LH-40),(x+8,H+LH-30),(x,H+LH-20),(x-8,H+LH-30)],fill=col)
        d.text((x-14,H+LH-18),k['id'][-3:],fill=col)
    px=i*1000/FPS/durMs*W
    d.line([(px,y0),(px,H+LH)],fill=(242,241,237),width=4)
    ms=int(i*1000/FPS)
    d.text((10,y0+LH-30),f'frame {i}  t={ms}ms  delay={delay}ms  KEYFRAMES BURNED-IN DEBUG',fill=(150,158,168))
    can.save(f'{td}/f{i:04d}.png')
subprocess.run(['ffmpeg','-nostdin','-loglevel','error','-r',str(FPS),'-i',f'{td}/f%04d.png',
    '-itsoffset',f'{delay/1000:.3f}','-i',mp3,'-map','0:v','-map','1:a',
    '-c:v','libx264','-preset','fast','-crf','21','-pix_fmt','yuv420p','-vf',f'scale={W//2*2}:{(H+LH)//2*2}',
    '-c:a','aac','-movflags','+faststart','-y',outp],check=True)
for f in glob.glob(f'{td}/*.png'): os.remove(f)
print(f'{outp} burned ({len(frames)} frames)')
