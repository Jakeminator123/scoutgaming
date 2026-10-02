from pathlib import Path
import hashlib,json,subprocess,zipfile
import numpy as np
from PIL import Image
D=Path(__file__).resolve().parent; root=D.parents[3];out=root/'web/public/review/astrid-a9fa1da6'
source=root/'content/staging/2026-09-17/seven-seat-reach/box2-reach.mp4'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def probe(p):return json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-show_entries','stream=codec_name,width,height,r_frame_rate,nb_read_frames:stream_tags=alpha_mode:format=duration','-of','json',str(p)]))
frames=sorted((D/'frames').glob('*.png'));assert len(frames)==73
for p in frames:
 rgb=np.array(Image.open(p).convert('RGB'));rgba=np.array(Image.open(D/'rgba'/p.name));a=np.array(Image.open(D/'alpha'/p.name))
 assert np.array_equal(rgb,rgba[:,:,:3]),f'RGB changed {p.name}'
 assert np.array_equal(a,rgba[:,:,3]),f'Alpha mismatch {p.name}'
 assert a.min()==0 and a.max()==255
 assert not np.any(a[:40]) and not np.any(a[601:]),'Unexpected outer background retained'
outputs={}
for name in ['astrid-transparent.webm','astrid-packed.mp4','preview.mp4']:
 p=out/name;q=probe(p);s=q['streams'][0]
 assert s['nb_read_frames']=='73' and s['r_frame_rate']=='24/1'
 assert s['width']==1280 and s['height']==(1440 if 'packed' in name else 720)
 if name.endswith('.webm'):assert s['tags']['alpha_mode']=='1'
 outputs[name]={'sha256':sha(p),'probe':q}
alphaBytes=subprocess.check_output(['ffmpeg','-v','error','-c:v','libvpx-vp9','-i',str(out/'astrid-transparent.webm'),'-vf','alphaextract','-frames:v','1','-f','rawvideo','-pix_fmt','gray','-'])
a=np.frombuffer(alphaBytes,dtype=np.uint8).reshape(720,1280)
assert a[10,10]==0 and a[230,650]>250,'Actual encoded transparency failed'
with zipfile.ZipFile(out/'alpha-masks.zip','w',zipfile.ZIP_DEFLATED) as z:
 for p in sorted((D/'alpha').glob('*.png')):z.write(p,'alpha/'+p.name)
 z.writestr('README.txt','Astrid a9fa1da6: 73 masks at 24 fps, 1280 x 720. 0001.png pairs with source frame zero. White keeps the pixel; black removes it. Includes Astrid and the original card.\n')
receipt={'sourceJob':'a9fa1da6-066c-47f4-8466-7f4924a3bfe2','sourceFile':str(source.relative_to(root)),'sourceSha256':sha(source),'sourceProbe':probe(source),'scope':'Astrid and original dealt card; room, table and shoe removed. Standalone review, no gameplay assignment.','processing':'Apple Vision person segmentation followed by source-colour GrabCut and bounded source-observed shoe, shoulder, rail and card masks. Native frames preserved.','frames':73,'fps':24,'rgbPngsUnchanged':True,'newGenerationJobs':0,'outputs':outputs,'maskArchiveSha256':sha(out/'alpha-masks.zip'),'review':'All 73 frames inspected in contact sheets; actual transparent playback reviewed separately. Original generated motion/shape defects and small edge imperfections may remain; not gameplay acceptance.'}
(D/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
print('Verified: 73 unchanged RGB frames, paired alpha, all output timings, real WebM transparency.')
