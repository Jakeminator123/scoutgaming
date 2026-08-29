#!/usr/bin/env python3
# Full keyframe verification sheet: EVERY viseme keyframe of a rendered line,
# as the actual rendered frame at that keyframe's midpoint, labeled with its
# id, viseme, word, bound wave id and time span. The cross-reference is total:
# what you see is what kf-### put on screen while wav-## was playing.
# Usage: kf-sheet.py <pilot.mp4> <pilot.track.json> <out.png>
import json, sys, subprocess, io
import numpy as np
from PIL import Image, ImageDraw
mp4,trackp,outp=sys.argv[1:4]
tr=json.load(open(trackp)); FPS=tr['fps']; delay=tr['delayMs']
kfs=tr['timeline']['keyframes']
tiles=[]
for k in kfs:
    mid=(k['startMs']+k['endMs'])/2 + delay
    fi=int(round(mid*FPS/1000))
    rec=next((r for r in tr['frames'] if r['f']==fi), None)
    out=subprocess.run(['ffmpeg','-nostdin','-loglevel','error','-i',mp4,'-vf',f"select=gte(n\\,{fi})",
        '-frames:v','1','-f','image2pipe','-vcodec','png','-'],capture_output=True).stdout
    im=Image.open(io.BytesIO(out)).convert('RGB')
    if rec and 'rect' in rec:
        x,y,w,h=rec['rect']
        crop=im.crop((x-90,y-150,x+w+90,y+h+60))
        d=ImageDraw.Draw(crop)
        d.rectangle([90,150,90+w,150+h],outline=(214,255,58),width=3)
    else:
        crop=im.crop((560,380,940,720))
    crop=crop.resize((240,int(240*crop.height/crop.width)))
    tiles.append((k,crop))
cols=6; rows=(len(tiles)+cols-1)//cols
tw,th=248,tiles[0][1].height+58
sheet=Image.new('RGB',(16+cols*tw,16+rows*th),(12,13,16))
d=ImageDraw.Draw(sheet)
for i,(k,im) in enumerate(tiles):
    x=16+(i%cols)*tw; y=16+(i//cols)*th
    sheet.paste(im,(x,y))
    d.text((x,y+im.height+4),f"{k['id']}  {k['viseme']}  '{k['word']}'",fill=(214,255,58))
    d.text((x,y+im.height+20),f"{k['startMs']}-{k['endMs']}ms  {k['wave']}  int={k['intensity']}",fill=(150,158,168))
sheet.save(outp)
print(f'{outp}: {len(tiles)} keyframes')
