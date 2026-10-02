import json,numpy as np
from PIL import Image,ImageDraw
from calibrate import HERE,PUB,read,fit,grade
idle=json.loads((PUB/'review/astrid-green-waiting/idle.json').read_text());speak=json.loads((PUB/'review/astrid-green-speak/speak.json').read_text())
items=[('ready',read(PUB/idle['base']['src'])),('folded-rest',read(PUB/idle['rest']['loop']['src'])),('bridge',read(PUB/idle['rest']['out']['src'],36))]
items += [(name,read(PUB/speak['lines'][name]['media']['src'],0,20)) for name in ['greeting','goodluck','insurance','win']]
sheet=Image.new('RGB',(250*len(items),375),'#222');draw=ImageDraw.Draw(sheet);report={}
for i,(name,a) in enumerate(items):
 report[name]={**fit(a),'remainingGain':grade(a)};rgb=np.uint8(a[:,:,:3]*(a[:,:,3:4]/255)+35*(1-a[:,:,3:4]/255));sheet.paste(Image.fromarray(rgb).crop((275,20,550,380)).resize((250,327)),(i*250,35));draw.text((i*250+3,7),name,fill='white')
sheet.save(HERE/'after-compare.jpg',quality=95);(HERE/'after-measurements.json').write_text(json.dumps(report,indent=2)+'\n')
