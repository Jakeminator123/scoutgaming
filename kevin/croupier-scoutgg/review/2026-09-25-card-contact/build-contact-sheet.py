import json,subprocess,sys
from PIL import Image,ImageDraw,ImageFont
from io import BytesIO
m=json.load(open('public/media/manifest.json'))
seat=sys.argv[1]; start=int(sys.argv[2]); count=int(sys.argv[3])
c=next(c for c in m['deal'] if c['id']=='deal_pos'+seat)
cx,cy=c['kort']['cx'],c['kort']['cy']
left=max(0,min(1080-250,cx-125));top=cy-185
raw=subprocess.check_output(['ffmpeg','-v','error','-i','public'+c['url'],'-vf',f'select=between(n\\,{start}\\,{start+count-1}),crop=250:280:{left}:{top}','-fps_mode','passthrough','-f','rawvideo','-pix_fmt','rgb24','-'])
w=250;h=300;cols=6
out=Image.new('RGB',(cols*w,((count+cols-1)//cols)*h),'#141414')
font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',17)
for i in range(count):
    im=Image.frombytes('RGB',(250,280),raw[i*250*280*3:(i+1)*250*280*3]);d=ImageDraw.Draw(im)
    # Runtime projected card footprint (known 63 x 85 rectangle, depth=0.625).
    shear=(cx-540)*.00045
    pts=[(cx-left+x+shear*y,cy-top+y*.625) for x,y in [(-31.5,-42.5),(31.5,-42.5),(31.5,42.5),(-31.5,42.5)]]
    d.line(pts+[pts[0]],fill=(255,206,50),width=1)
    x=(i%cols)*w;y=(i//cols)*h;out.paste(im,(x,y+20));ImageDraw.Draw(out).text((x+4,y),f'{seat} · f{start+i:02d} · {(start+i)/24:.3f}s',font=font,fill='white')
p=f'review/2026-09-25-card-contact/seat-{seat}-f{start}.jpg';out.save(p,quality=90);print(p)
