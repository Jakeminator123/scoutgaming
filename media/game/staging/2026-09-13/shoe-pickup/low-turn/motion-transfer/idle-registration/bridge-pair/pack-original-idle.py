from pathlib import Path
import sys,json,hashlib,subprocess
sys.path.insert(0,'/tmp/astrid-optical-flow')
import cv2,numpy as np
D=Path(__file__).resolve().parent
P=Path('/Users/solvifyab/Desktop/croupier/web/public/dealers/astrid')
registration=json.loads((D.parent/'registration.json').read_text())['currentUniformRegistration']['idleToScene']
s=registration['scale'];tx,ty=registration['translation'];A=np.float64([[s,0,tx],[0,s,ty]])
paths=[P/'streams/idle-1_idle_idle.h264',P/'actor/streams/idle-1_idle_idle-hand-repair.h264']
caps=[cv2.VideoCapture(str(p)) for p in paths]
assert all(c.isOpened() for c in caps)
out=D/'original-idle-moving-packed.mp4'
proc=subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s','1920x2160','-r','24','-i','pipe:0','-an','-c:v','libx264','-preset','fast','-crf','14','-pix_fmt','yuv420p','-movflags','+faststart',str(out)],stdin=subprocess.PIPE)
count=0
while True:
 reads=[c.read() for c in caps]
 assert reads[0][0]==reads[1][0]
 if not reads[0][0]:break
 rgb=cv2.cvtColor(reads[0][1],cv2.COLOR_BGR2RGB)
 alpha=cv2.cvtColor(reads[1][1],cv2.COLOR_BGR2GRAY)
 assert rgb.shape==(1440,1440,3) and alpha.shape==(1440,1440)
 rgb=cv2.warpAffine(rgb,A,(1920,1080),flags=cv2.INTER_LANCZOS4)
 alpha=cv2.warpAffine(alpha,A,(1920,1080),flags=cv2.INTER_LANCZOS4)
 mask=np.zeros_like(rgb);mask[:,:,0]=alpha
 proc.stdin.write(np.concatenate([rgb,mask],axis=0).tobytes());count+=1
proc.stdin.close();assert proc.wait()==0
assert count==145,count
for c in caps:c.release()
receipt={'status':'original moving idle staging derivative, not gameplay acceptance','frameCount':count,'fps':24,'registration':A.tolist(),'G':'disabled in renderer; zero before encoding','RGB':'original source, uniform registration only','inputs':{str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in paths},'outputSHA256':hashlib.sha256(out.read_bytes()).hexdigest()}
(D/'original-idle-moving-packed.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({'frames':count,'output':str(out)}))
