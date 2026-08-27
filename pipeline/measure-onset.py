#!/usr/bin/env python3
# Onset-based lipsync for short lines: first sustained mouth motion in the
# clip vs first speech energy in the audio. lagMs = how long the audio must
# wait after clip start so the first word lands on the first mouth movement.
import sys, json, importlib.util
spec=importlib.util.spec_from_file_location('m','pipeline/measure-lipsync.py')
m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
import numpy as np
FPS=24
def main(stream,mp3):
    mt=m.mouth_track(stream)
    if len(mt)<20: return {'ok':False}
    base=np.median(mt[:4]); thr=max(3.0, base+0.25*(mt.max()-base))
    mouth=None
    for i in range(1,len(mt)-2):
        if mt[i]>thr and mt[i+1]>thr*0.6 and mt[i+2]>thr*0.6: mouth=i; break
    e=m.audio_env(mp3,len(mt)+48)
    if mouth is None or e.max()<=0: return {'ok':False}
    audio=next((i for i,v in enumerate(e) if v>e.max()*0.12), None)
    if audio is None: return {'ok':False}
    return {'ok':True,'lagMs':round((mouth-audio)*1000/FPS),'mouthF':mouth,'audioF':audio}
print(json.dumps(main(sys.argv[1],sys.argv[2])))
