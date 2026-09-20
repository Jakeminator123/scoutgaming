#!/usr/bin/env python3
"""Key the supplied Amira speech without retiming, scaling RGB or repainting faces.

Run under /tmp/astrid-a9mask-env/bin/python. The common native crop is placed
uniformly at 1.5x within the 1920x1080 virtual plate, centered vertically.
"""
import argparse, hashlib, importlib.util, json, subprocess, wave
from pathlib import Path
from fractions import Fraction
import cv2
import numpy as np
from PIL import Image, ImageDraw

HERE=Path(__file__).resolve().parent
REPO=HERE.parents[3]
RAW=REPO/'content/staging/2026-09-19/amira-green/speak-elevenlabs'
PREP=REPO/'content/staging/2026-09-19/astrid-elevated-camera/mask-prep'
MEDIA=HERE/'media'; MEDIA.mkdir(exist_ok=True)
spec=importlib.util.spec_from_file_location('chroma_key',PREP/'key.py')
key=importlib.util.module_from_spec(spec); spec.loader.exec_module(key)
SETTINGS=json.loads((PREP/'settings.json').read_text())
SETTINGS.update({'purpose':'Measured Amira native 1280x704 speech framing, opaque enclosed head interior',
                 'markerWorkAreaNormalized':[0,.40,1,1]})
CROP=[420,0,470,464]
CAMERA={'width':CROP[2],'height':CROP[3],'placement':{'width':1920,'height':1080,'scale':1.5,'x':CROP[0]*1.5,'y':12,'framingScale':.85}}
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
jobs=json.loads((RAW/'jobs.json').read_text())
texts=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {SPEECH_LINES} from './web/public/speech-lines.mjs';console.log(JSON.stringify(SPEECH_LINES));"],cwd=REPO))
texts.update({k:v['text'] for k,v in json.loads((REPO/'web/public/dealers/amira/audio/en/bank.json').read_text()).items()})

def run(cmd):subprocess.run([str(c) for c in cmd],check=True)
def probe(path):return json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-select_streams','v:0','-show_entries','stream=width,height,avg_frame_rate,nb_read_frames','-of','json',str(path)]))['streams'][0]
def audio_sync(source,line,d):
    arrays=[]
    for label,p in [('take',source),('paired',REPO/f'web/public/dealers/amira/audio/en/{line}.mp3')]:
        out=d/f'{label}.wav';run(['ffmpeg','-v','error','-y','-i',p,'-vn','-ac','1','-ar','44100',out])
        with wave.open(str(out)) as w:arrays.append(np.frombuffer(w.readframes(w.getnframes()),np.int16).astype(float))
        out.unlink()
    a,b=arrays;n=len(a)+len(b);corr=np.fft.irfft(np.fft.rfft(a,n)*np.conj(np.fft.rfft(b,n)),n)
    lag=int(corr.argmax());lag=lag-n if lag>n//2 else lag
    peak=float(corr.max()/np.sqrt((a*a).sum()*(b*b).sum()))
    return {'method':'Cross-correlation of embedded AAC and exact paired mp3 decoded 44100Hz mono',
      'lagSamples':lag,'lagSeconds':lag/44100,'normalisedPeak':peak,'sampleRate':44100,
      'takeDurationSeconds':len(a)/44100,'pairedDurationSeconds':len(b)/44100}

def main(line):
    cv2.setNumThreads(1)
    source=RAW/f'take-{line}-creatify-aurora.mp4';d=HERE/line
    for part in ('frames','vision','alpha','qa'):(d/part).mkdir(parents=True,exist_ok=True)
    p=probe(source);assert [p['width'],p['height']]==[1280,704],p
    count=int(p['nb_read_frames']);rate=p['avg_frame_rate'];fps=float(Fraction(rate))
    if len(list((d/'frames').glob('*.png')))!=count:run(['ffmpeg','-v','error','-y','-i',source,'-vsync','0','-start_number','0',d/'frames/%04d.png'])
    if len(list((d/'vision').glob('*.png')))!=count:run([REPO/'pipeline/person-mask',d/'frames',d/'vision'])
    rows=[];x,y,w,h=CROP;union=[1280,704,0,0];thumbs=[]
    for n in range(count):
        rgb=np.asarray(Image.open(d/'frames'/f'{n:04d}.png').convert('RGB'))
        person=np.asarray(Image.open(d/'vision'/f'{n:04d}.png').convert('L'))
        alpha=key.actor_alpha(rgb,SETTINGS,person)
        exterior=1-np.uint8(alpha>=128);cv2.floodFill(exterior,None,(0,0),2)
        distance=cv2.distanceTransform(np.uint8(exterior!=2),cv2.DIST_L2,5)
        yy,xx=np.indices(alpha.shape)
        # Measured Amira head/hair ends around y165. Protect enclosed eyes,
        # face and hair interiors, leaving silhouette and all green gaps keyed.
        namebadge=(xx>=662)&(xx<718)&(yy>=248)&(yy<275)
        # Vision itself mistakes the shiny badge for a background hole in
        # some frames. Its measured interior rectangle is strictly enclosed
        # by the jacket; fill only there, never outside the actor silhouette.
        facecore=(xx>=605)&(xx<665)&(yy>=55)&(yy<125)
        protected=(distance>=4)&(((person>=250)&(yy<180))|facecore|namebadge)
        alpha[protected]=255
        eyemask=(yy>=66)&(yy<100)&(xx>=592)&(xx<674)
        ys,xs=np.where(alpha>0);bounds=[int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1)]
        union=[min(union[0],bounds[0]),min(union[1],bounds[1]),max(union[2],bounds[2]),max(union[3],bounds[3])]
        assert bounds[0]>=x and bounds[1]>=y and bounds[2]<=x+w and bounds[3]<=y+h,(line,n,bounds,CROP)
        Image.fromarray(alpha).save(d/'alpha'/f'{n:04d}.png')
        rows.append({'frame':n,'alphaBounds':bounds,'protectedPixels':int(protected.sum()),'eyeMinimumAlpha':int(alpha[eyemask].min())})
        if n==0:
            Image.fromarray(np.dstack([rgb,alpha])).crop((x,y,x+w,y+h)).save(d/'rest.png')
        if n%10==0 or n==count-1:
            a=alpha[y:y+h,x:x+w,None]/255
            comp=np.round(rgb[y:y+h,x:x+w]*a+np.array([65,45,57])*(1-a)).astype(np.uint8)
            thumb=Image.fromarray(comp);thumb.thumbnail((282,280));thumbs.append((n,thumb))
            if n in [0,30,60,90,count-1]:
                sheet=Image.new('RGB',(w*3,h+24),'#17191b');draw=ImageDraw.Draw(sheet)
                for col,bg in enumerate(([65,45,57],[210,210,210],[27,46,39])):
                    comp=np.round(rgb[y:y+h,x:x+w]*a+np.array(bg)*(1-a)).astype(np.uint8)
                    sheet.paste(Image.fromarray(comp),(col*w,24));draw.text((col*w+5,5),f'{line} native {n}',fill='white')
                sheet.save(d/'qa'/f'grounds-{n:04d}.jpg',quality=95)
    sheet=Image.new('RGB',(282*5,304*((len(thumbs)+4)//5)),'#191b1e');draw=ImageDraw.Draw(sheet)
    for i,(n,im) in enumerate(thumbs):
        px,py=i%5*282,i//5*304;sheet.paste(im,(px,py+24));draw.text((px+5,py+4),f'{line} native {n}',fill='white')
    sheet.save(d/'qa/contact.jpg',quality=95)
    packed=MEDIA/f'{line}.mp4'
    vf=f'[0:v]crop={w}:{h}:{x}:{y},format=yuv420p[rgb];[1:v]crop={w}:{h}:{x}:{y},format=yuv420p[a];[rgb][a]vstack=inputs=2[v]'
    run(['ffmpeg','-v','error','-y','-framerate',rate,'-start_number','0','-i',d/'frames/%04d.png','-framerate',rate,'-start_number','0','-i',d/'alpha/%04d.png','-filter_complex',vf,'-map','[v]','-c:v','libx264','-threads','2','-preset','slow','-crf','15','-bf','0','-pix_fmt','yuv420p','-an','-movflags','+faststart',packed])
    enc=probe(packed);assert int(enc['nb_read_frames'])==count
    sync=audio_sync(source,line,d)
    data={'jobId':jobs[line],'media':{'src':f'review/amira-green-speak/{line}.mp4','sha256':sha(packed),'matteRevision':'amira-opaque-head-namebadge-native-v2','layout':'rgb-over-alpha','width':w,'height':h,'fps':fps,'frames':count,'sourceSha256':sha(source),'nativeTakeSha256':sha(source),'crop':CROP},
      'camera':CAMERA,'audio':f'dealers/amira/audio/en/{line}.mp3','audioSha256':sha(REPO/f'web/public/dealers/amira/audio/en/{line}.mp3'),'text':texts[line],
      'cutIn':0,'cutOut':count-1,'audioOffsetSeconds':-sync['lagSeconds'],'audioMeasurement':sync,
      'registration':{'method':'Native source RGB crop, no resampling; uniform display placement 1.5x, centred in 1920x1080 virtual plate','scale':1.5,'offset':[0,12],'sourceFrames':count},
      'readyPose':'Source first frame, current plate has separate resting hands on felt'}
    (d/'line.json').write_text(json.dumps(data,indent=2)+'\n')
    receipt={'line':line,'source':str(source),'sourceSha256':sha(source),'dimensions':[1280,704],'nativeFrameRate':rate,'nativeFrameCount':count,'crop':CROP,'alphaUnion':union,'packedSha256':sha(packed),'packedBytes':packed.stat().st_size,'audio':sync,'headPolicy':'Enclosed silhouette interior >=4 native pixels: head y<180 additionally requires semantic confidence >=250; known facecore [605,55,665,125] and solid namebadge [662,248,718,275] restored despite semantic pinholes. Original RGB unchanged','rows':rows}
    (d/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
    print(json.dumps({k:v for k,v in receipt.items() if k!='rows'}),flush=True)

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('lines',nargs='*',default=['greeting']);args=ap.parse_args()
    for line in args.lines:main(line)
