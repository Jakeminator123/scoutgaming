from pathlib import Path
from PIL import Image,ImageDraw
import json,hashlib
b=Path('/Users/solvifyab/Desktop/croupier/content/staging/2026-09-13/shoe-pickup/low-turn'); out=b/'cadence-comparison';out.mkdir(exist_ok=True)
im=Image.open('/tmp/astrid-next-cadence.jpg');d=ImageDraw.Draw(im)
for i,n in enumerate(range(330,451,3)):
 x=i%6*480;y=i//6*232;d.rectangle((x,y,x+160,y+25),fill='black');d.text((x+4,y+4),f'n{n}  {n/60:.3f}s',fill='white')
im.save(out/'reference-next-cards.jpg',quality=94)
ledgers={p:json.loads((b/'cycle60-draft'/p/'ledger.json').read_text()) for p in ['pickup','slide','return']}
a={p:{k:v[k] for k in ['first','last','frames','nativeFPS','outputFPS','speed','sourceVideoSHA']} for p,v in ledgers.items()}
# Proposed continuous time mapping, boundary points inclusive but elapsed intervals counted once.
phases=[('pickup',7,21,3,'extraction'),('pickup',21,36,4,'supported turnover'),('pickup',36,46,2.5,'roll completion'),('pickup',46,55,3,'low contact'),('pickup',55,62,2.5,'finger adjustment preserved'),('pickup',62,66,3,'settle'),('slide',2,54,4,'outward slide'),('return',5,8,3,'release'),('return',8,24,3,'empty hand return'),('return',24,36,3,'head settles')]
rows=[];t=0
for clip,start,end,speed,label in phases:
 dt=(end-start)/24/speed;rows.append(dict(clip=clip,start=start,end=end,speed=speed,phase=label,startSeconds=t,endSeconds=t+dt));t+=dt
receipt={'status':'offline cadence proposal, no media/public changes; visual acceptance pending','current':a,'currentDuration':sum(x['frames']/60 for x in a.values()),'currentReleaseSeconds':a['pickup']['frames']/60+a['slide']['frames']/60+3/48,'currentArmReadySeconds':a['pickup']['frames']/60+a['slide']['frames']/60+19/48,'reference':{'firstExtraction':283,'firstReleaseRange':[331,335],'nextExtractionRange':[330,336],'followingExtractionRange':[390,393],'fps':60,'eventUncertainty':'next-card bounds from every-third-native-frame sheet; first cycle from prior native sheets'},'proposal':rows,'proposedElapsedSeconds':t,'warning':'24 fps at >2.5x has fewer source intervals per output frame at60; monotonic mapping preserves entire action but cannot display every native frame separately at60. No editorial removal of turn or55–61. Interpolation cannot create measured missing motion.'}
(out/'timings.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt,indent=2))
