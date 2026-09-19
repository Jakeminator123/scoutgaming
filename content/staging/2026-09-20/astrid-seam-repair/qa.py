import json,numpy as np,cv2
from pathlib import Path
from PIL import Image,ImageDraw
D=Path(__file__).resolve().parent/'gameplay-qa';frames=json.loads((D/'live-frames.json').read_text());selected=[]
for state,frame in [('waiting-to-unfold',30),('unfolding',1),('unfolding',30),('unfolding',60),('ready',0),('ready',20),('folding',40)]:
 candidates=[f for f in frames if f['rest'].get('restState')==state]
 key='speech' if state=='ready' else 'rest';field='speakFrame' if state=='ready' else 'restFrame'
 if candidates:selected.append(min(candidates,key=lambda x:abs(int(x[key].get(field,0))-frame)))
for name in ['enter','exit']:
 candidates=[f for f in frames if f['speech'].get('speakState')==name]
 if candidates:selected.append(candidates[len(candidates)//2])
sheet=Image.new('RGB',(365*3,385*3),'#222');draw=ImageDraw.Draw(sheet)
for i,f in enumerate(selected):
 x,y=i%3*365,i//3*385;sheet.paste(Image.open(D/f['file']).crop((395,85,760,430)),(x,y+40));draw.text((x+5,y+5),f['rest']['restState']+' / '+f['speech'].get('speakState',''),fill='white');draw.text((x+5,y+22),f['file'],fill='white')
sheet.save(D/'transition-sheet.jpg',quality=95)
# Rendered loop wrap must look like an ordinary adjacent frame, not a reset.
r=[f for f in frames if f['rest']['restState']=='rest'];diffs=[]
for a,b in zip(r,r[1:]):
 if a['rest']['restFrame']==b['rest']['restFrame']:continue
 x=np.asarray(Image.open(D/a['file'])).astype(float);y=np.asarray(Image.open(D/b['file'])).astype(float);d=float(np.abs(x[95:375,450:690]-y[95:375,450:690]).mean())
 diffs.append({'a':a['rest']['restFrame'],'b':b['rest']['restFrame'],'diff':d,'wrap':int(b['rest']['restFrame'])<int(a['rest']['restFrame'])})
(D/'loop-differences.json').write_text(json.dumps(diffs,indent=2)+'\n');print('loop normal median',np.median([d['diff'] for d in diffs if not d['wrap']]),'wrap',[d for d in diffs if d['wrap']])
