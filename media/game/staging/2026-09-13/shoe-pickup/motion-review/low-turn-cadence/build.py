from pathlib import Path
import subprocess,json,hashlib,math
p=Path(__file__).resolve().parent;src=p.parent.parent/'low-turn/source.mp4'
ranges=[(7,21,2),(21,36,4),(36,54,2)]
mapping=[{'native_frame':n,'native_seconds':n/24,'output_seconds':sum(max(0,min(n-a,b-a))/(24*r) for a,b,r in ranges)} for n in range(7,55)]
count=math.ceil(mapping[-1]['output_seconds']*60)+1
expr='+'.join(f'min(max(N-{a-7},0),{b-a})/{24*r}' for a,b,r in ranges)
filt=f"trim=start_frame=7:end_frame=55,settb=1/100000,setpts='({expr})/TB',tpad=stop_mode=clone:stop_duration=0.2,minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,trim=end_frame={count},setpts=N/(60*TB)"
out=p/'pickup-turn-pace60.mp4'
subprocess.run(['ffmpeg','-v','error','-y','-i',str(src),'-an','-vf',filt,'-c:v','libx264','-preset','fast','-crf','16','-bf','0','-pix_fmt','yuv420p','-movflags','+faststart',str(out)],check=True)
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-show_streams','-of','json',str(out)]))['streams'][0]
assert int(probe['nb_read_frames'])==count
(p/'edit-ledger.json').write_text(json.dumps({'source':str(src),'sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'source_fps':24,'ranges':[{'start_frame':a,'next_boundary_frame':b,'speed':r}for a,b,r in ranges],'native_mapping':mapping,'output_frames':count,'output_seconds':count/60,'probe':probe,'note':'Single pickup-turn source timing experiment; interpolated60fps, not native capture or gameplay'},indent=2)+'\n')
print(count,count/60)
