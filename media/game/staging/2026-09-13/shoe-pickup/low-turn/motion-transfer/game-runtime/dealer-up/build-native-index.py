"""Lossless container conversion for bounded native-frame playback review."""
from pathlib import Path
import json,hashlib,re,subprocess
p=Path(__file__).resolve().parent
m=json.loads((p/'media-receipt.json').read_text());video=p/'actor-gray.mp4'
assert hashlib.sha256(video.read_bytes()).hexdigest()==m['outputSHA256']
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v','-show_entries','stream=has_b_frames,width,height','-of','json',str(video)]))['streams'][0]
assert probe['has_b_frames']==0
out=p/'native-frames';out.mkdir(exist_ok=True)
subprocess.run(['ffmpeg','-v','error','-y','-i',str(video),'-map','0:v','-c:v','copy','-bsf:v','h264_mp4toannexb,h264_metadata=aud=insert','-f','h264',str(out/'actor.h264')],check=True)
b=(out/'actor.h264').read_bytes();ns=[(x.start(),x.end(),b[x.end()]&31) for x in re.finditer(b'\x00\x00(?:\x00)?\x01',b)]
a=[x for x,_,t in ns if t==9];assert len(a)==85 and a[0]==0
sps=next(i for _,i,t in ns if t==7);codec='avc1.'+b[sps+1:sps+4].hex()
f=[[off,(a[i+1] if i+1<len(a) else len(b))-off] for i,off in enumerate(a)]
ix={'version':1,'codec':codec,'width':probe['width'],'height':probe['height'],'sourceMP4SHA256':m['outputSHA256'],'streamSHA256':hashlib.sha256(b).hexdigest(),'clips':{'dealer/upcard/first':{'file':'actor.h264','fps':60,'frameCount':85,'frames':f}}}
(out/'index.json').write_text(json.dumps(ix,indent=2))
print(codec,len(a),len(b))
