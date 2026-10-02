#!/usr/bin/env python3
"""Per-line pipeline, identical to the greeting: resample the 1280x704 take onto
the plate registration (scale 1.5, offset 0,+15; 24 fps by frame drop; audio
copied), measure the embedded audio against the line's mp3, then key it with
the vetted matte.  /tmp/astrid-a9mask-env/bin/python build-lines.py [line ...]"""
import json,subprocess,sys,hashlib,wave,numpy as np
from pathlib import Path
HERE=Path(__file__).resolve().parent;REPO=HERE.parents[3]
AUDIO=REPO/'web/public/dealers/astrid/audio/en';BUILD=HERE.parent/'astrid-green-box-right/mask/build.py'
PY=sys.executable
jobs=json.loads((HERE/'jobs.json').read_text())
lines=sys.argv[1:] or list(jobs)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def wav(src,dst):subprocess.run(['ffmpeg','-v','error','-y','-i',str(src),'-vn','-ac','1','-ar','44100',str(dst)],check=True)
def rd(p):
    w=wave.open(str(p));a=np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16).astype(np.float64);return a,w.getframerate()
def xcorr(a,b):
    n=len(a)+len(b);r=np.fft.irfft(np.fft.rfft(a,n)*np.conj(np.fft.rfft(b,n)),n);lag=int(np.argmax(r))
    if lag>n//2:lag-=n
    return lag,float(r.max()/np.sqrt((a**2).sum()*(b**2).sum()))
for line in lines:
    d=HERE/'lines'/line;(d/'registration').mkdir(parents=True,exist_ok=True)
    take=HERE/f'take-{line}-creatify-aurora.mp4';src=d/'source.mp4'
    if not src.exists():
        subprocess.run(['ffmpeg','-v','error','-y','-i',str(take),'-vf','scale=1920:1056:flags=lanczos,pad=1920:1080:0:15:color=0x196f2d,fps=24,format=yuv420p',
            '-c:v','libx264','-preset','slow','-crf','12','-bf','0','-pix_fmt','yuv420p','-c:a','copy','-movflags','+faststart',str(src)],check=True)
    frames=int(subprocess.check_output(['ffprobe','-v','error','-count_frames','-select_streams','v:0','-show_entries','stream=nb_read_frames','-of','csv=p=0',str(src)]).decode().strip())
    wav(take,d/'registration/take-audio.wav');wav(AUDIO/f'{line}.mp3',d/'registration/line.wav')
    a,sr=rd(d/'registration/take-audio.wav');b,_=rd(d/'registration/line.wav')
    lag,peak=xcorr(a,b)
    thr=32768*10**(-40/20)
    sync={'line':line,'takeSamples':len(a),'lineSamples':len(b),'sampleRate':sr,'lagSamples':lag,'lagSeconds':lag/sr,'normalisedPeak':round(peak,4),
        'takeOnsetSec':int(np.argmax(np.abs(a)>thr))/sr,'lineOnsetSec':int(np.argmax(np.abs(b)>thr))/sr,'takeDurationSec':len(a)/sr,'lineDurationSec':len(b)/sr}
    (d/'registration/audio-sync.json').write_text(json.dumps(sync,indent=1)+'\n')
    config={'generationId':jobs[line],'jobId':jobs[line],'provider':'ElevenLabs Image & Video API, model creatify-aurora 720p','action':'speak','line':line,
        'sourceSha256':sha(src),'nativeTake':take.name,'nativeTakeSha256':sha(take),
        'status':'Kevin 2026-09-19: approved the greeting install and asked for all other lines the same way. Zero generation.',
        'registration':{'method':'greeting registration reused (verified on blackjack/win/bust frame 0, registration/verify-take.py)','scale':1.5,'offset':[0,15],
            'resample':'scale=1920:1056 lanczos, pad=1920:1080 at (0,15) with backdrop green 0x196f2d, fps=24 by frame drop (timing kept), audio copied','sourceFrames':frames},
        'readyPose':'frame 0 and the last frame (plate ready pose)'}
    (d/'take-config.json').write_text(json.dumps(config,indent=2)+'\n')
    print(line,'frames',frames,'lag',lag,'peak',round(peak,3),flush=True)
    for p in (d/'registration').glob('*.wav'):p.unlink()
    if not (d/'mask/manifest.json').exists():
        subprocess.run([PY,str(BUILD),'--take-dir',str(d)],check=True,stdout=open(d/'mask-build.log','w'),stderr=subprocess.STDOUT)
    m=json.loads((d/'mask/manifest.json').read_text());print(line,'crop',m['crop'],'union',m['actorUnionBounds'],flush=True)
