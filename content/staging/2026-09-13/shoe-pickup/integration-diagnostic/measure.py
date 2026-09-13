from pathlib import Path
from PIL import Image, ImageDraw
import math,json,hashlib
p=Path(__file__).resolve().parent
w,h=1280,720
size=min(w*.12,h*.19);rx=w*.485;depth=h*.39*math.sqrt(2)
shoeX=min(rx*.34,w/2-size*.60);shoeZ=depth*.10
l=size*.88; sh=size*.29;angle=-.62
x=shoeX+math.sin(angle)*l*.53
y=5+sh*.16
z=shoeZ+math.cos(angle)*l*.53
# Orthographic camera at (0,2000,2000) looking at origin;
# staged group y=0 and rear alignment is .52 of registered scene height.
outlet=[(w/2+x)/w,.52+(z-y)/math.sqrt(2)/h]
im=Image.open(p/'fast-frame0.png').convert('RGB')
sw,sh=im.size
scale=min(1920/sw,1080/sh);dx=(1920-sw*scale)/2;dy=(1080-sh*scale)/2
# Manual visual estimate of the exposed card at the mouth, not a calibration.
source_point=[1226,634];source_uncertainty=12
source_registered=[dx+source_point[0]*scale,dy+source_point[1]*scale]
game=[outlet[0]*1920,outlet[1]*1080]
old=[.63265625*1920,.5511111111111111*1080]
canvas=Image.new('RGB',(1920,1080));canvas.paste(im.resize((round(sw*scale),round(sh*scale))),(round(dx),round(dy)))
d=ImageDraw.Draw(canvas)
for point,color,label,off in [(source_registered,'#22ffff','Filmed lip: manual estimate +/-12px',(-440,-30)),(game,'#ff44bb','Game modeled outlet: code projection',(30,15)),(old,'#ffff22','Old manifest outlet (not current model)',(30,-40))]:
    x,y=point;d.line((x-12,y,x+12,y),fill=color,width=3);d.line((x,y-12,x,y+12),fill=color,width=3);d.text((x+off[0],y+off[1]),label,fill=color)
canvas.save(p/'registration-overlay.jpg',quality=94)
receipt={'status':'diagnostic-only-not-contact-calibration','sourceSha256':hashlib.sha256((p.parent/'fast.mp4').read_bytes()).hexdigest(),'nativeDimensions':[sw,sh],'uniformFit1920':{'scale':scale,'offset':[dx,dy]},'filmedLip':{'nativePixels':source_point,'uncertaintyPixels':source_uncertainty,'method':'manual visual estimate from frame 0 and cropped frame 10','registeredPixels':source_registered},'modeledOutlet':{'normalized':outlet,'registeredPixels':game,'method':'analytic reproduction of staged table-scene.mjs and shoe-model.mjs transforms; no browser observation'},'oldManifestOutletPixels':old,'filmedToModelDistancePixels':math.dist(source_registered,game),'oldManifestToModelDistancePixels':math.dist(old,game)}
(p/'measurements.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt,indent=2))
