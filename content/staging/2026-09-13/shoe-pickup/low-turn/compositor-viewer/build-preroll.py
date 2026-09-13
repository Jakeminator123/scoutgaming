from pathlib import Path
import json,hashlib,subprocess
p=Path(__file__).resolve().parent
source=p.parent/'cycle60-draft/continuous'
manifest=json.loads((source/'manifest.json').read_text())
out=p/'continuous-preroll.mp4'
command=['ffmpeg','-v','error','-y','-framerate','60','-i',str(source/'frames/%04d.png'),'-vf','tpad=start=4:start_mode=clone','-frames:v','185','-c:v','libx264','-preset','fast','-crf','12','-profile:v','high','-level:v','5.2','-bf','0','-pix_fmt','yuv420p','-movflags','+faststart',str(out)]
subprocess.run(command,check=True)
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_frames','-of','json',str(out)]))
frames=probe['frames'];assert len(frames)==185
assert max(abs(float(f['best_effort_timestamp_time'])-n/60)for n,f in enumerate(frames))<.000002
manifest.update(decoderPrerollFrames=4,encodedFrameCount=185,outputSHA256=hashlib.sha256(out.read_bytes()).hexdigest(),status='four decoder warmup frames before unchanged181 motion frames; no added intra-action hold',command=command)
(p/'continuous-preroll.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('185 frames verified:4 hidden decoder preroll+181 original motion')
