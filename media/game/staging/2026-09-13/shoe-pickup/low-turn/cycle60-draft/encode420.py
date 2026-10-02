from pathlib import Path
import sys,subprocess,json,hashlib
p=Path(__file__).resolve().parent
for c in sys.argv[1:]:
 out=p/c/f'{c}-shared60-packed-420.mp4';src=p/c/f'{c}-shared60-packed.mp4'
 subprocess.run(['ffmpeg','-v','error','-y','-framerate','60','-i',str(p/c/'frames/%04d.png'),'-c:v','libx264','-preset','fast','-crf','12','-profile:v','high','-level:v','5.2','-bf','0','-pix_fmt','yuv420p','-movflags','+faststart',str(out)],check=True)
 probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-show_streams','-of','json',str(out)]))['streams'][0]
 (p/c/'encode420-receipt.json').write_text(json.dumps({'status':'hardware-compatible codec candidate; browser A/B required','sourcePNGFrames':'same shared RGB/RG resampled frames as444 encode','sourceLedgerSHA':hashlib.sha256((p/c/'ledger.json').read_bytes()).hexdigest(),'source444SHA':hashlib.sha256(src.read_bytes()).hexdigest(),'outputSHA':hashlib.sha256(out.read_bytes()).hexdigest(),'probe':probe},indent=2)+'\n');print(c,probe['pix_fmt'],probe['nb_read_frames'])
