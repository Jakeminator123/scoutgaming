"""Pack reviewed staging RGB/RG with identical native frame order; never publish."""
from pathlib import Path
import hashlib,json,subprocess
root=Path(__file__).resolve().parent.parent
rgb=root/'mattes/slide/frames'
mask=root/'composite-draft/slide-rg'
out=root/'compositor-viewer/slide-packed-draft.mp4'
sources=[]
for n in range(55):
    files=[rgb/f'{n+1:04d}.png',mask/f'{n:04d}.png']
    if not all(p.is_file() for p in files):
        raise SystemExit(f'Missing native input at {n}')
    sources.append({'frame':n,'sha256':[hashlib.sha256(p.read_bytes()).hexdigest() for p in files]})
command=['ffmpeg','-v','error','-y','-framerate','24','-start_number','1','-i',str(rgb/'%04d.png'),
         '-framerate','24','-start_number','0','-i',str(mask/'%04d.png'),
         '-filter_complex','[0:v][1:v]vstack=inputs=2[v]','-map','[v]','-frames:v','55',
         '-an','-c:v','libx264','-crf','14','-bf','0','-pix_fmt','yuv420p','-movflags','+faststart',str(out)]
subprocess.run(command,check=True)
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-show_streams','-of','json',str(out)]))['streams'][0]
assert (probe['width'],probe['height'],int(probe['nb_frames']),probe['r_frame_rate'])==(1920,2160,55,'24/1'),probe
receipt={'status':'draft-not-gameplay-approved','layout':'top RGB; bottom R actor, G fingers, B zero',
         'nativeRate':24,'interpolated':False,'sourceFrames':sources,'command':command,'probe':probe,
         'outputSha256':hashlib.sha256(out.read_bytes()).hexdigest()}
out.with_suffix('.json').write_text(json.dumps(receipt,indent=2)+'\n')
