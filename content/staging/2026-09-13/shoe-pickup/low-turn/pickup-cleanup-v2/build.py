from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np,json,hashlib
p=Path(__file__).parent;r=p.parent;(p/'rg').mkdir(exist_ok=True)
# Narrow polygons manually traced only on visible card-border protrusions.
polys={23:[(1118,565),(1128,561),(1128,568),(1120,571)],24:[(1089,557),(1116,545),(1117,550),(1091,564)],25:[(1066,530),(1097,528),(1097,543),(1066,543)],26:[(1080,520),(1089,520),(1089,527),(1080,527)],27:[(1063,498),(1087,505),(1087,514),(1063,512)]}
sheet=Image.new('RGB',(1500,5*230),'#222');d=ImageDraw.Draw(sheet);rows=[]
for j,n in enumerate(range(23,28)):
 rgb=np.array(Image.open(r/'mattes/source/frames'/f'{n+1:04}.png').convert('RGB'));before=np.array(Image.open(r/'pickup-draft/pickup-rg'/f'{n:04}.png').convert('RGB'));a=before.copy();mask=Image.new('L',(1920,1080));ImageDraw.Draw(mask).polygon(polys[n],fill=255);cut=np.array(mask)>0;a[cut,:2]=0;Image.fromarray(a).save(p/'rg'/f'{n:04}.png')
 yy,xx=np.indices((1080,1920));checker=np.where(((xx//12+yy//12)%2)[...,None],[145,155,165],[75,90,105]);views=[]
 for rg in [before,a]:views.append(Image.fromarray((rgb*(rg[:,:,:1]/255)+checker*(1-rg[:,:,:1]/255)).astype('uint8')))
 for c,im in enumerate([Image.fromarray(rgb),*views]):sheet.paste(im.crop((1000,480,1250,680)).resize((500,200)),(c*500,j*230+25))
 d.text((5,j*230+5),f'n{n} nativeRGB | before | candidate',fill='white');rows.append({'frame':n,'paperPolygonNative':polys[n],'changedRGpixels':int(np.any(a!=before,axis=2).sum()),'inputSha256':hashlib.sha256((r/'pickup-draft/pickup-rg'/f'{n:04}.png').read_bytes()).hexdigest(),'outputSha256':hashlib.sha256((p/'rg'/f'{n:04}.png').read_bytes()).hexdigest()})
sheet.save(p/'comparison.png');(p/'receipt.json').write_text(json.dumps({'status':'manualvisiblepaperonly-draft','rows':rows},indent=2))
