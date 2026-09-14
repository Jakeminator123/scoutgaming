"""Build an unapproved native-clock actor atlas from two existing sources."""
from pathlib import Path
import hashlib,json,subprocess,os
import numpy as np
from PIL import Image
p=Path(__file__).resolve().parent
root=next(q for q in p.parents if (q/'web/public').is_dir())
hashfile=lambda q:hashlib.sha256(q.read_bytes()).hexdigest()
plan=json.loads((p/'pace/plan.json').read_text())
maskdir=p/'selected85-rg';manifest=json.loads((maskdir/'receipt.json').read_text())
assert manifest['pacePlanSHA256']==hashfile(p/'pace/plan.json')
assert len(plan['frames'])==85
sources=[dict(role='centrePrepared',path='web/public/dealers/astrid/performance/centre-native-review.mp4'),dict(role='right',path='content/staging/2026-09-09/cac-side-delivery/right/source.mp4')]
for s in sources:s['sha256']=hashfile(root/s['path'])
assert sources[0]['sha256']=='7ccca94b5332f28cdd962fd70d34ac59152aecbac4748738bf53ac87331a7726'
assert sources[1]['sha256']=='4e0d75e55c35c5b42a1a81ae0067145f29ec1b2083b6598147469455c79b2dc3'
bundle=hashlib.sha256(json.dumps([{k:s[k] for k in ('role','sha256')} for s in sources],separators=(',',':')).encode()).hexdigest()
processes=[];readers={}
for s in sources:
 cmd=['ffmpeg','-v','error','-threads','1','-i',str(root/s['path'])]
 if s['role']=='centrePrepared':cmd+=['-vf','crop=1920:1080:0:0']
 proc=subprocess.Popen(cmd+['-f','rawvideo','-pix_fmt','rgb24','-'],stdout=subprocess.PIPE);processes.append(proc);readers[s['role']]={'proc':proc,'index':-1,'raw':None}
tmp=p/'actor-gray.build.mp4'
encoder=subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s','1920x3240','-r','60','-i','-','-an','-c:v','libx264','-threads','1','-preset','fast','-profile:v','high','-crf','14','-pix_fmt','yuv420p','-movflags','+faststart',str(tmp)],stdin=subprocess.PIPE)
rows=[]
try:
 for row in plan['frames']:
  r=readers['right' if row['source']=='right' else 'centrePrepared'];index=row['sourceNative'] if row['source']=='right' else row['combinedNative']
  assert index>=r['index']
  while r['index']<index:
   r['raw']=r['proc'].stdout.read(1920*1080*3);r['index']+=1;assert len(r['raw'])==1920*1080*3
  file=maskdir/f'{row["outputFrame"]:04d}.png';mr=manifest['frames'][row['outputFrame']]
  assert all(mr[k]==row[k] for k in ('outputFrame','source','sourceNative','combinedNative'))
  assert hashfile(file)==mr['sha256']
  im=Image.open(file).convert('RGB');assert im.size==(1920,1080)
  m=np.asarray(im);assert np.all(m[:,:,1]<=m[:,:,0])
  total=m[:,:,0].astype(np.float32)/255;front=m[:,:,1].astype(np.float32)/255
  rear=np.divide(total-front,1-front,out=np.zeros_like(total),where=front<1)
  gray=lambda a:np.repeat(np.floor(np.clip(a,0,1)*255+.5).astype(np.uint8)[:,:,None],3,axis=2)
  rgb=np.frombuffer(r['raw'],dtype=np.uint8).reshape(1080,1920,3)
  encoder.stdin.write(np.concatenate([rgb,gray(rear),gray(front)]).tobytes())
  rows.append({**row,'maskSHA256':hashfile(file),'decodedRGBSHA256':hashlib.sha256(r['raw']).hexdigest()})
 encoder.stdin.close();assert encoder.wait()==0
finally:
 for proc in processes:
  if proc.poll() is None:proc.terminate()
  try:proc.wait(timeout=3)
  except subprocess.TimeoutExpired:proc.kill();proc.wait()
 if encoder.poll() is None:encoder.terminate();encoder.wait()
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-show_entries','stream=nb_read_frames,width,height,r_frame_rate','-of','json',str(tmp)]))['streams'][0]
assert (int(probe['nb_read_frames']),probe['width'],probe['height'],probe['r_frame_rate'])==(85,1920,3240,'60/1')
os.replace(tmp,p/'actor-gray.mp4')
receipt=dict(status='UNAPPROVED candidate; actual gameplay validation required',sourceBundleSHA256=bundle,sources=sources,outputSHA256=hashfile(p/'actor-gray.mp4'),maskReceiptSHA256=hashfile(maskdir/'receipt.json'),pacePlanSHA256=hashfile(p/'pace/plan.json'),frameCount=85,fps=60,crop=[0,0,1920,1080],rows=rows,encoding='Selected original decoded RGB unchanged before lossy CRF14 atlas encoding; per-source uniform registration happens in renderer')
(p/'media-receipt.json').write_text(json.dumps(receipt,indent=2))
print(json.dumps({k:v for k,v in receipt.items() if k!='rows'}))
