from pathlib import Path
import subprocess,json,hashlib
from PIL import Image,ImageDraw
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
SRC=ROOT/'youtube-reference/watch/download/video.mp4'
OUT=HERE/'consecutive-deals-native60.mp4'
def run(args): return subprocess.check_output(args,text=True)
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
command=['ffmpeg','-v','error','-i',str(SRC),'-vf','trim=start_frame=240:end_frame=540,setpts=PTS-STARTPTS','-an','-c:v','libx264','-crf','0','-preset','fast','-fps_mode','passthrough','-movflags','+faststart','-y',str(OUT)]
# Rebuild only explicitly; verification default preserves existing artifact.
import sys
if '--build' in sys.argv: subprocess.run(command,check=True)
probe=json.loads(run(['ffprobe','-v','error','-count_frames','-show_entries','stream=width,height,r_frame_rate,nb_read_frames,pix_fmt:format=duration','-of','json',str(OUT)]))
for name,path,vf in [('source',SRC,'trim=start_frame=240:end_frame=540,setpts=PTS-STARTPTS'),('output',OUT,'null')]:
 text=run(['ffmpeg','-v','error','-i',str(path),'-vf',vf,'-an','-f','framehash','-hash','sha256','-'])
 (HERE/f'{name}-frames.sha256').write_text(text)
frames=lambda p:[l.split(',')[-1].strip() for l in p.read_text().splitlines() if l and not l.startswith('#')]
a=frames(HERE/'source-frames.sha256');b=frames(HERE/'output-frames.sha256')
assert len(a)==len(b)==300 and a==b, 'Decoded frame mismatch'
assert probe['streams'][0]['r_frame_rate']=='60/1'
assert probe['streams'][0]['width']==1280 and probe['streams'][0]['height']==720
receipt={'source':str(SRC),'sourceSHA256':sha(SRC),'output':str(OUT),'outputSHA256':sha(OUT),'sourceNativeFramesInclusive':[240,539],'sourceSecondsHalfOpen':[4,9],'durationSeconds':5,'frameCount':300,'decodedAllFrameSHA256Equal':True,'speed':1,'crop':None,'scale':None,'audio':'omitted in silent motion reference; original untouched','command':command,'probe':probe}
(HERE/'motion-reference-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt,indent=2))
