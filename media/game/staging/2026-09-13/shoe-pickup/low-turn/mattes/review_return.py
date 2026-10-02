from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np,json,hashlib
p=Path(__file__).parent
receipt={}
for take in ['return']:
 d=p/take;frames=sorted((d/'frames').glob('*.png'));masks=sorted((d/'person').glob('*.png'))
 assert [f.name for f in frames]==[f.name for f in masks],(take,len(frames),len(masks))
 dimensions=[]
 for f,m in zip(frames,masks):
  assert Image.open(f).size==Image.open(m).size
  dimensions.append(Image.open(f).size)
 indices=[0,5,12,20,28,36,40]
 sheet=Image.new('RGB',(960,len(indices)*210),'#222222');draw=ImageDraw.Draw(sheet)
 for row,n in enumerate(indices):
  a=Image.open(frames[n]).convert('RGB');m=Image.open(masks[n]).convert('L');rgb=np.array(a);alpha=np.array(m)/255
  yy,xx=np.indices(alpha.shape);checker=np.where(((xx//24+yy//24)%2)[...,None],np.array([160,160,160]),np.array([80,80,80]))
  comp=Image.fromarray((rgb*alpha[...,None]+checker*(1-alpha[...,None])).astype('uint8'))
  for col,im in enumerate([a,m.convert('RGB'),comp]):sheet.paste(im.resize((320,180)),(col*320,row*210+25))
  draw.text((5,row*210+5),f'{take} native frame {n}',fill='white')
 sheet.save(d/'review.jpg',quality=93)
 receipt[take]={'frames':len(frames),'masks':len(masks),'dimensions':sorted(set(dimensions)),'sourceSha256':hashlib.sha256((p.parent/(take+'.mp4')).read_bytes()).hexdigest(),'sampleFrames':indices,'allMaskNamesAndDimensionsMatch':True}
(p/'return/receipt.json').write_text(json.dumps(receipt,indent=2))
print(receipt)
