#!/usr/bin/env python3
"""Isolate existing Astrid pixels without changing speech frames or audio."""
from pathlib import Path
import hashlib,json,subprocess,sys

repo=Path(__file__).resolve().parents[1]
root=Path(sys.argv[1]).resolve()
output=root/'public/dealers/astrid/actor'
encoded=root/'encoded'
encoded.mkdir(parents=True,exist_ok=True)
source=repo/'media/dealers/astrid/runtime/indexed'
index=json.loads((source/'streams/index.json').read_text())
provenance={"version":1,"dealer":"astrid","sources":{},"nativeSpeech":{}}
# Room generation is a separate reviewed asset. Preserve it when rebuilding
# actor mattes, rather than silently generating a different camera/background.
live_provenance=source/'actor/provenance.json'
if live_provenance.exists():
 prior=json.loads(live_provenance.read_text())
 if prior.get('room'):
  import shutil
  provenance['room']=prior['room']
  output.mkdir(parents=True,exist_ok=True)
  shutil.copy2(source/'actor/room.jpg',output/'room.jpg')
def run(args): subprocess.run([str(x) for x in args],check=True,stdout=subprocess.DEVNULL)
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def masks(file,stem):
 d=root/stem;frames=d/'frames';alpha=d/'alpha'
 frames.mkdir(parents=True,exist_ok=True);alpha.mkdir(exist_ok=True)
 run(['ffmpeg','-v','error','-y','-i',file,'-vf','scale=720:720','-vsync','0',frames/'%04d.png'])
 run([repo/'pipeline/person-mask',frames,alpha])
 count=len(list(frames.glob('*.png')))
 if count!=len(list(alpha.glob('*.png'))): raise RuntimeError('Missing alpha frames: '+stem)
 return alpha,count
encode=['-c:v','libx264','-profile:v','main','-level:v','5.1','-crf','15','-bf','0','-pix_fmt','yuv420p','-x264-params','aud=1:keyint=10000:min-keyint=10000:scenecut=0:repeat-headers=1']
for key,clip in index['clips'].items():
 file=source/'streams'/clip['file'];alpha,count=masks(file,Path(clip['file']).stem)
 if count!=clip['frameCount']: raise RuntimeError('Frame count changed: '+key)
 dest=encoded/clip['file']
 run(['ffmpeg','-v','error','-y','-framerate','24','-i',alpha/'%04d.png','-vf','scale=1440:1440',*encode,'-an','-f','h264',dest])
 provenance['sources'][key]={"file":clip['file'],"sha256":sha(file),"matteSha256":sha(dest),"frames":count}
 print('Isolated',key,count,flush=True)
run(['node',repo/'pipeline/build-index.mjs',encoded,output,'--codec','avc1.4D4033','--wh','1440'])
actor_index_path=output/'streams/index.json'
actor_index=json.loads(actor_index_path.read_text())
actor_index['fullActor']=True
for key,clip in actor_index['clips'].items():
 clip['sha256']=provenance['sources'][key]['sha256']
 clip['matteSha256']=provenance['sources'][key]['matteSha256']
actor_index_path.write_text(json.dumps(actor_index)+'\n')
for name in ['goodluck','win']:
 file=source/'speech'/f'{name}.mp4';alpha,count=masks(file,'native-'+name)
 dest=output/f'{name}-packed.mp4'
 run(['ffmpeg','-v','error','-y','-i',file,'-framerate','24','-i',alpha/'%04d.png',
      '-filter_complex','[1:v]scale=1440:1440,format=yuv420p[mask];[0:v][mask]vstack=inputs=2[v]',
      '-map','[v]','-map','0:a',*encode,'-c:a','copy','-movflags','+faststart',dest])
 def audio_hash(p):return subprocess.check_output(['ffmpeg','-v','error','-i',str(p),'-map','0:a','-c','copy','-f','hash','-hash','sha256','-'],text=True).strip()
 if audio_hash(file)!=audio_hash(dest):raise RuntimeError('Embedded audio changed')
 provenance['nativeSpeech'][name]={"src":f'dealers/astrid/actor/{name}-packed.mp4',"sha256":sha(dest),"sourceSha256":sha(file),"audioHash":audio_hash(file),"frames":count,"width":1440,"height":1440}
 print('Embedded speech preserved:',name,flush=True)
(output/'provenance.json').write_text(json.dumps(provenance,indent=2)+'\n')
print('Ready for review:',output,flush=True)
