"""Extract actual rendered actor endpoints; no new pose or body deformation.
These are generation references, never a claim that a transition exists.
"""
from pathlib import Path
from PIL import Image
import subprocess,json,hashlib
ROOT=Path(__file__).resolve().parent
PUBLIC=ROOT.parents[3]/'web/public'
# Coordinate fit measured in the actual 1280x720 staged game, mapped back to
# the common 1920x1080 actor canvas. At most one source pixel of rounding.
CROP=(570,0,1500,675)
def extract(src,n,out):
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(src),'-vf',f'select=eq(n\\,{n})','-frames:v','1',str(out)],check=True)
for source_frame,action,index in [(3,'right',0),(21,'centre',0),(34,'centre',41),(47,'left',41)]:
    packed=ROOT/f'pose-{source_frame}-packed.png'
    extract(PUBLIC/f'dealers/astrid/performance/smooth60/deal-{action}.mp4',index,packed)
    p=Image.open(packed);rgb=p.crop((0,0,1920,1080));mask=p.crop((0,1080,1920,2160)).getchannel('R')
    actor=Image.new('RGB',(1920,1080));actor.paste(rgb,(0,0),mask)
    actor.crop(CROP).save(ROOT/f'pose-{source_frame}.png')
extract(PUBLIC/'dealers/astrid/streams/idle-1_idle_idle.h264',0,ROOT/'idle-rgb.png')
extract(PUBLIC/'dealers/astrid/actor/streams/idle-1_idle_idle-hand-repair.h264',0,ROOT/'idle-mask.png')
rgb=Image.open(ROOT/'idle-rgb.png').convert('RGB').resize((692,692),Image.Resampling.LANCZOS)
mask=Image.open(ROOT/'idle-mask.png').convert('L').resize((692,692),Image.Resampling.LANCZOS)
actor=Image.new('RGB',(1920,1080));actor.paste(rgb,(614,-45),mask)
actor.crop(CROP).save(ROOT/'idle-endpoint.png')
