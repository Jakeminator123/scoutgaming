from pathlib import Path
import json,subprocess,hashlib,math
root=Path(__file__).resolve().parent
specs={
'extract-edge':[(0,18,4),(18,30,2.5),(30,50,4),(50,65,1.8),(65,72,5)],
'edge-face':[(0,43,4.5),(43,49,1.5),(49,64,3),(64,72,2.5)],
'held-slide':[(0,5,4),(5,59,2.8),(59,72,4)],
'empty-return':[(0,18,5),(18,26,2),(26,52,2.3),(52,72,4)]}
ledger={'purpose':'Staging cadence diagnostic, not gameplay or native 60 fps','fit':'Uniform contain in 1920x1080; black padding, no actor retargeting','interpolation':'ffmpeg minterpolate bidirectional motion compensation per source; never across clip seams','clips':[]}
startframe=0
for name,ranges in specs.items():
 src=root.parent/(name+'.mp4')
 probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-of','json',str(src)]))['streams'][0]
 terms=[f'min(max(N-{a},0),{b-a})/{24*r}' for a,b,r in ranges]
 expr='+'.join(terms)
 frames=[{'native_frame':n,'native_seconds':n/24,'retimed_seconds':sum(max(0,min(n-a,b-a))/(24*r) for a,b,r in ranges)} for n in range(73)]
 count=math.ceil(frames[-1]['retimed_seconds']*60)+1
 filt=f"scale=1920:1080:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,settb=1/100000,setpts='({expr})/TB',tpad=stop_mode=clone:stop_duration=0.2,minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,trim=end_frame={count},setpts=N/(60*TB)"
 dest=root/(name+'-pace.mp4')
 subprocess.run(['ffmpeg','-v','error','-y','-i',str(src),'-an','-vf',filt,'-c:v','libx264','-preset','fast','-crf','16','-bf','0','-pix_fmt','yuv420p','-movflags','+faststart',str(dest)],check=True)
 ledger['clips'].append({'source':str(src),'sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'width':probe['width'],'height':probe['height'],'fps':probe['avg_frame_rate'],'ranges':[{'first_native_frame':a,'next_boundary_native_frame':b,'speed':r} for a,b,r in ranges],'native_mapping':frames,'output_first_frame':startframe,'output_frame_count':count,'output_start_seconds':startframe/60,'output_duration_seconds':count/60})
 startframe+=count
(root/'concat.txt').write_text(''.join(f"file '{n}-pace.mp4'\n" for n in specs))
subprocess.run(['ffmpeg','-v','error','-y','-f','concat','-safe','0','-i',str(root/'concat.txt'),'-c','copy','-movflags','+faststart',str(root/'cycle-pace60.mp4')],check=True)
actual=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-show_streams','-of','json',str(root/'cycle-pace60.mp4')]))['streams'][0]
assert int(actual['nb_read_frames'])==startframe, (actual['nb_read_frames'],startframe)
ledger['output_probe']=actual
ledger['total_output_frames']=startframe;ledger['total_seconds']=startframe/60
(root/'edit-ledger.json').write_text(json.dumps(ledger,indent=2)+'\n')
print(json.dumps({'frames':startframe,'seconds':startframe/60}))
