"""Pack registered Kling bridges with exact game endpoints and a bounded ready loop."""
from pathlib import Path
from PIL import Image
import numpy as np,cv2,subprocess,json,hashlib,math,sys
ROOT=Path(__file__).resolve().parent;PUBLIC=ROOT.parents[3]/'web/public';OUT=PUBLIC/'dealers/astrid/performance/joins/ready';OUT.mkdir(parents=True,exist_ok=True)
sys.path.insert(0,str(ROOT.parent/'edge-cleanup'));from clean import clean_upper
cv2.setNumThreads(4);flow=cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
W,H=930,675;grid=np.stack(np.meshgrid(np.arange(W,dtype=np.float32),np.arange(H,dtype=np.float32)),axis=-1)
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def fields(a,am,b,bm):
 def small(rgb,mask):return cv2.cvtColor(cv2.resize((rgb.astype(float)*mask[:,:,None]/255).astype('uint8'),(465,338)),cv2.COLOR_RGB2GRAY)
 aa,bb=small(a,am),small(b,bm);scale=np.array([2,H/338],dtype=np.float32)
 return cv2.resize(flow.calc(aa,bb,None),(W,H))*scale,cv2.resize(flow.calc(bb,aa,None),(W,H))*scale
def mix(a,b,ab,ba,t):return cv2.addWeighted(cv2.remap(a,grid-ab*t,None,cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT),1-t,cv2.remap(b,grid-ba*(1-t),None,cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT),t,0)
def decode(src,end=False):
 args=['ffmpeg','-v','error']+(['-sseof','-0.02']if end else[])+['-i',str(src),'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','-']
 p=np.frombuffer(subprocess.check_output(args),dtype='uint8').reshape((2160,1920,3))
 return p[:H,570:1500].copy(),p[1080:1080+H,570:1500,0].copy()
READY=decode(ROOT/'ready-packed60.mp4')
base=json.loads((PUBLIC/'dealers/astrid/performance/smooth60/manifest.json').read_text());takes=base['takes'];idle=json.loads((PUBLIC/'dealers/astrid/actor/provenance.json').read_text())['sources']['idle-1/idle/idle']
IDLE=decode(PUBLIC/'dealers/astrid/performance/joins/return-34-edge-v2.mp4',True)
endpoints={3:decode(PUBLIC/next(t['media']['src'] for t in takes if t['action']=='deal-right'))}
for pose,action in [(21,'deal-right'),(34,'deal-centre'),(47,'deal-left')]:endpoints[pose]=decode(PUBLIC/next(t['media']['src']for t in takes if t['action']==action),True)
def encode(name,frame,count,step):
 frames=math.ceil((count-1)/step)+1;out=OUT/(name+'.mp4')
 p=subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s','1920x2160','-r','60','-i','-','-an','-c:v','libx264','-preset','fast','-crf','14','-bf','0','-pix_fmt','yuv420p','-movflags','+faststart',str(out)],stdin=subprocess.PIPE)
 pair=-1
 for j in range(frames):
  pos=min(count-1,j*step);i=min(count-2,int(pos));t=pos-i
  if i!=pair:a,am=frame(i);b,bm=frame(i+1);ab,ba=fields(a,am,b,bm);pair=i
  rgb=mix(a,b,ab,ba,t);mask=mix(am,bm,ab,ba,t)
  packed=np.zeros((2160,1920,3),dtype='uint8');packed[:H,570:1500]=rgb;packed[1080:1080+H,570:1500,0]=mask;p.stdin.write(packed.tobytes())
 p.stdin.close();assert p.wait()==0
 return {'src':str(out.relative_to(PUBLIC)),'sha256':sha(out),'width':1920,'height':1080,'fps':60,'frames':frames}
def generated(name,n):
 rgb=np.asarray(Image.open(ROOT/f'raw-kling-{name}/{n+1:04}.png').convert('RGB')).copy()
 m=np.asarray(Image.open(ROOT/f'masks-kling-{name}/{n+1:04}.png').convert('L')).copy()
 # Exclude black surrounding the filmed silhouette, including the empty
 # space below the bust that person segmentation sometimes fills.
 seed=(rgb.max(axis=2)>12).astype('uint8')*255;seed=cv2.morphologyEx(seed,cv2.MORPH_CLOSE,np.ones((3,3),dtype='uint8'))
 contours,_=cv2.findContours(seed,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE);support=np.zeros_like(m)
 cv2.drawContours(support,[c for c in contours if cv2.contourArea(c)>100],-1,255,cv2.FILLED)
 m=np.minimum(m,cv2.GaussianBlur(support,(3,3),.6));m=clean_upper(m)
 return rgb[:H,570:1500],m[:H,570:1500]
# The first second has downwards gaze and slight real breathing. Close only
# this near-identical rest pose, bounding action response to 1.12 seconds.
loopframes=[]
p=subprocess.Popen(['ffmpeg','-v','error','-i',str(ROOT/'ready-packed60.mp4'),'-frames:v','61','-f','rawvideo','-pix_fmt','rgb24','-'],stdout=subprocess.PIPE)
for n in range(61):
 a=np.frombuffer(p.stdout.read(2160*1920*3),dtype='uint8').reshape((2160,1920,3));loopframes.append((a[:H,570:1500].copy(),a[1080:1080+H,570:1500,0].copy()))
p.stdout.close();assert p.wait()==0
last,lm=loopframes[-1];first,fm=READY;ab,ba=fields(last,lm,first,fm)
for n in range(1,7):loopframes.append((mix(last,first,ab,ba,n/6),mix(lm,fm,ab,ba,n/6)))
loopmedia=encode('loop',lambda n:loopframes[n],len(loopframes),1)
bindall=[{'edge':'exit','takeId':t['id'],'mediaSha256':t['media']['sha256'],'calibrationSha256':t['calibrationSha256']}for t in takes]
def clip(name,kind,media,bindings):return {'id':'ready-'+name,'status':'review','camera':{'width':1920,'height':1080},'media':media,'bindings':bindings,'idle':{'rgbSha256':idle['sha256'],'maskSha256':idle['matteSha256']},'ready':{'kind':kind,'loopSha256':loopmedia['sha256']},'calibrationSha256':'0'*64}
manifest={'version':1,'status':'review','loop':clip('loop','loop',loopmedia,bindall),'speech':None,'joins':[]}
for name in sys.argv[1:] or ['3','21','34','47','idle']:
 count=len(list((ROOT/f'raw-kling-{name}').glob('*.png')));assert count==73
 start=READY if name in ['3','idle']else endpoints[int(name)];end=IDLE if name=='idle'else endpoints[3]if name=='3'else READY
 def frame(n):return start if n==0 else end if n==count-1 else generated(name,n)
 media=encode(name,frame,count,.8)
 if name=='idle':manifest['speech']=clip('speech','speech',media,bindall);continue
 pose=int(name)
 for edge in ['entry','exit']:
  bindings=[{'edge':edge,'takeId':t['id'],'mediaSha256':t['media']['sha256'],'calibrationSha256':t['calibrationSha256']}for t in takes if t['tracking']['sourceStart'if edge=='entry'else 'sourceStop']-(0 if edge=='entry'else 1)==pose]
  if not bindings:continue
  forward=(pose==3 and edge=='entry')or(pose!=3 and edge=='exit')
  output=media
  if not forward:
   out=OUT/f'{name}-reverse.mp4';subprocess.run(['ffmpeg','-v','error','-y','-i',str(PUBLIC/media['src']),'-vf','reverse','-c:v','libx264','-crf','14','-bf','0','-pix_fmt','yuv420p','-movflags','+faststart',str(out)],check=True)
   output={**media,'src':str(out.relative_to(PUBLIC)),'sha256':sha(out)}
  manifest['joins'].append(clip(f'{edge}-{name}',edge,output,bindings))
 print('Packed',name,flush=True)
(ROOT/'ready-manifest-draft.json').write_text(json.dumps(manifest))
