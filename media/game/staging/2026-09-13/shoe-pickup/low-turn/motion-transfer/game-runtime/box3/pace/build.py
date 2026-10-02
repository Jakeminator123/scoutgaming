from pathlib import Path
import subprocess,json,hashlib,math
here=Path(__file__).resolve().parent
repo=next(p for p in here.parents if (p/'web/public/app.mjs').is_file())
source=repo/'web/public/dealers/astrid/performance/centre-native-review.mp4'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert sha(source)=='7ccca94b5332f28cdd962fd70d34ac59152aecbac4748738bf53ac87331a7726'
# Whole prefixed source, including every phase; only time changes.
# Each pair is (output frame at60fps, source packed native frame at24fps).
anchors=[(0,0),(9,23),(10,24),(22,48),(30,62),(39,73),(57,98),(60,113),(63,116),(75,134),(84,168)]
frames=[]
for out in range(85):
 a,b=next((a,b) for a,b in zip(anchors,anchors[1:]) if a[0]<=out<=b[0])
 native=math.floor(a[1]+(out-a[0])/(b[0]-a[0])*(b[1]-a[1])+.5)
 frames.append({'outputFrame':out,'outputPTS':out/60,'packedNative':native,'sourceNative':native-24 if native>=24 else None,'phase':'entry' if native<24 else 'source'})
assert len(set(f['packedNative'] for f in frames))==85
assert frames[62]['sourceNative']==91 and frames[63]['sourceNative']==92
selector='+'.join('eq(n\\,%d)'%f['packedNative'] for f in frames)
out=here/'whole-action-rgb60.mp4'
subprocess.run(['ffmpeg','-v','error','-y','-i',str(source),'-an','-vf',f'crop=1920:1080:0:0,select={selector},settb=1/60,setpts=N','-r','60','-fps_mode','cfr','-frames:v','85','-c:v','libx264','-crf','14','-pix_fmt','yuv420p','-movflags','+faststart',str(out)],check=True)
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-show_entries','stream=width,height,nb_frames,avg_frame_rate,duration','-of','json',str(out)]))['streams'][0]
assert (probe['width'],probe['height'],int(probe['nb_frames']),probe['avg_frame_rate'])==(1920,1080,85,'60/1')
(here/'receipt.json').write_text(json.dumps({'status':'WHOLE ACTION PACE REVIEW ONLY. No turnover, no gameplay or target acceptance.','sourceSHA256':sha(source),'outputSHA256':sha(out),'probe':probe,'anchors':anchors,'frames':frames,'events':{'sourceLastFingerContact91':62,'sourceRelease92':63},'policy':'Whole169frame prefixed source temporally sampled to85 native RGB frames. No crossfade, flow interpolation, actor warp or made-up motion.84 intermediate frames omitted. Output encoding is lossy.24-frame entry preserved as10 sampled frames. Existing camera/skin differences and mask/sourcepaper remain visible.'},indent=2)+'\n')
print(json.dumps(probe))
