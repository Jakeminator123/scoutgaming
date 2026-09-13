from pathlib import Path
from PIL import Image
import numpy as np,cv2,json,subprocess,hashlib
from clean import clean_upper
ROOT=Path(__file__).resolve().parent
PUBLIC=ROOT.parents[3]/'web/public'
cv2.setNumThreads(4)
records=[]
for group,key in [('smooth60','takes'),('joins','joins')]:
    manifest=json.loads((PUBLIC/f'dealers/astrid/performance/{group}/manifest.json').read_text())
    for item in manifest[key]:
        src=PUBLIC/item['media']['src'];dest=ROOT/group/src.name;dest.parent.mkdir(exist_ok=True)
        decode=subprocess.Popen(['ffmpeg','-v','error','-i',str(src),'-f','rawvideo','-pix_fmt','rgb24','-'],stdout=subprocess.PIPE)
        encode=subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s','1920x2160','-r','60','-i','-','-an','-c:v','libx264','-crf','14','-preset','fast','-bf','0','-pix_fmt','yuv420p','-movflags','+faststart',str(dest)],stdin=subprocess.PIPE)
        frames=0;changed=0
        while True:
            data=decode.stdout.read(1920*2160*3)
            if not data:break
            assert len(data)==1920*2160*3
            p=np.frombuffer(data,dtype='uint8').reshape((2160,1920,3)).copy()
            old=p[1080:,:,0].copy();new=clean_upper(old)
            if group=='joins':
                # Match preserved speech-idle matte exactly at its endpoint.
                distance=frames if item['id'].startswith('entry-') else item['media']['frames']-1-frames
                mix=min(1,distance/12);mix=mix*mix*(3-2*mix)
                new=np.rint(old*(1-mix)+new*mix).astype('uint8')
            assert np.array_equal(old[460:],new[460:])
            p[1080:,:,0]=new;changed+=int(np.count_nonzero(new!=old))
            encode.stdin.write(p.tobytes());frames+=1
            if frames in [1,item['media']['frames']]:
                im=(p[:1080].astype(float)*new[:,:,None]/255).astype('uint8')
                Image.fromarray(im).crop((570,0,1500,675)).save(dest.with_name(dest.stem+f'-{frames}.png'))
        decode.stdout.close();encode.stdin.close();assert decode.wait()==0 and encode.wait()==0
        assert frames==item['media']['frames']
        records.append({'id':item['id'],'group':group,'src':item['media']['src'],'inputSha256':hashlib.sha256(src.read_bytes()).hexdigest(),'outputSha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'frames':frames,'changedMaskPixels':changed})
        print(f'{group}/{src.name}: {frames} frames',flush=True)
(ROOT/'receipt.json').write_text(json.dumps(records,indent=2)+'\n')
