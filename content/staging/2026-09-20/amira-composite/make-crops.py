from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageOps
p=Path(__file__).resolve().parent
before=Image.open(p/'before-greeting.png').convert('RGB');after=Image.open(p/'after-greeting.png').convert('RGB')
assert before.size==after.size
regions={'hair':(564,42,716,206),'shoulders':(500,150,789,292),'hands':(503,282,811,369)}
font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',16)
strips=[]
for name,box in regions.items():
 a=before.crop(box);b=after.crop(box)
 a.save(p/f'before-{name}.png');b.save(p/f'after-{name}.png')
 # 2x nearest-neighbour evidence enlargement. No detail synthesis or sharpening.
 a=a.resize((a.width*2,a.height*2),Image.Resampling.NEAREST);b=b.resize(a.size,Image.Resampling.NEAREST)
 out=Image.new('RGB',(a.width*2+30,a.height+48),(20,22,24));d=ImageDraw.Draw(out)
 d.text((8,10),'BEFORE / '+name,fill='white',font=font);d.text((a.width+22,10),'AFTER / '+name,fill='white',font=font)
 out.paste(a,(8,40));out.paste(b,(a.width+22,40));out.save(p/f'compare-{name}.png');strips.append(out)
out=Image.new('RGB',(max(x.width for x in strips),sum(x.height for x in strips)+24),(20,22,24));y=0
for im in strips:out.paste(im,(0,y));y+=im.height+8
out.save(p/'before-after-crops.png')
ImageOps.grayscale(before).save(p/'before-grey.png');ImageOps.grayscale(after).save(p/'after-grey.png')
print(out.size)
