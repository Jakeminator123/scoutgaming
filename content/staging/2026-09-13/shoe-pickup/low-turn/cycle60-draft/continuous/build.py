from pathlib import Path
import json,hashlib,subprocess
p=Path(__file__).resolve().parent;b=p.parent;frames=p/'frames';frames.mkdir(exist_ok=True);rows=[];inputs={}
for clip in ['pickup','slide','return']:
 ledger=json.loads((b/clip/'ledger.json').read_text());inputs[clip]={'ledgerSHA':hashlib.sha256((b/clip/'ledger.json').read_bytes()).hexdigest(),'phase420SHA':hashlib.sha256((b/clip/f'{clip}-shared60-packed-420.mp4').read_bytes()).hexdigest(),'frames':len(ledger['ledger'])}
 for local,row in enumerate(ledger['ledger']):
  src=(b/clip/'frames'/f'{local:04d}.png').resolve();dest=frames/f'{len(rows):04d}.png'
  if dest.is_symlink():dest.unlink()
  dest.symlink_to(src)
  rows.append({'globalFrame':len(rows),'ptsNumerator':len(rows),'ptsDenominator':60,'seconds':len(rows)/60,'clip':clip,'localFrame':local,'sourcePosition':row['sourcePosition'],'sourceFrames':row['sourceFrames'],'sourceBlend':row['blend'],'packedPNG_SHA':hashlib.sha256(src.read_bytes()).hexdigest()})
out=p/'cycle-shared60-packed-420.mp4';subprocess.run(['ffmpeg','-v','error','-y','-framerate','60','-i',str(frames/'%04d.png'),'-c:v','libx264','-preset','fast','-crf','12','-profile:v','high','-level:v','5.2','-bf','0','-pix_fmt','yuv420p','-movflags','+faststart',str(out)],check=True)
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-show_streams','-show_frames','-of','json',str(out)]));fr=[x for x in probe['frames'] if x['media_type']=='video'];pts=[float(x['best_effort_timestamp_time'])for x in fr];errors=[abs(v-i/60)for i,v in enumerate(pts)];assert len(fr)==len(rows)==181;assert max(errors)<.000002;assert all(y>x for x,y in zip(pts,pts[1:]));stream=probe['streams'][0]
(p/'manifest.json').write_text(json.dumps({'status':'single-decoder staging stream; no new interpolation or seam synthesis','outputSHA256':hashlib.sha256(out.read_bytes()).hexdigest(),'dimensions':[3840,1080],'fps':60,'frameCount':181,'durationSeconds':181/60,'packedLayout':'left1920 RGB; right1920 Ractor/Ghand/B0','boundaries':{'pickup':[0,74],'slide':[75,140],'return':[141,180]},'inputReceipts':inputs,'PTS_maxErrorSeconds':max(errors),'probe':stream,'frames':rows},indent=2)+'\n');print('verified',len(rows),max(errors))
