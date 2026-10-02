from pathlib import Path
import sys,json
import numpy as np
from PIL import Image,ImageDraw
p=Path(__file__).resolve().parent;clip=sys.argv[1] if len(sys.argv)>1 else 'pickup';o=p/clip;rows=json.loads((o/'ledger.json').read_text())['ledger'];tiles=[]
yy,xx=np.indices((1080,1920));chk=np.where(((xx//18+yy//18)%2)[...,None],[85,100,112],[150,162,174])
for row in rows:
 n=row['outputFrame'];im=np.array(Image.open(o/'frames'/f'{n:04d}.png'));a=im[:,1920:,0:1]/255;v=np.uint8(im[:,:1920]*a+chk*(1-a));tile=Image.new('RGB',(700,300),'#222');tile.paste(Image.fromarray(v).crop((890,495,1370,710) if clip=="pickup" else (840,480,1380,900)).resize((540,242)),(0,0));tile.paste(Image.fromarray(im[:,1920:]).crop((950,520,1180,675)).resize((160,108)),(540,0));ImageDraw.Draw(tile).text((5,250),f'out{n} native{row["sourcePosition"]:.2f}; shared flow / DRAFT',fill='white');tiles.append(tile)
for page in range((len(tiles)+11)//12):
 s=Image.new('RGB',(1400,1800),'#222')
 for j,t in enumerate(tiles[page*12:page*12+12]):s.paste(t,(j%2*700,j//2*300))
 s.save(o/f'review-{page}.jpg',quality=95)
