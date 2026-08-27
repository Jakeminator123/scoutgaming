#!/usr/bin/env bash
# Mux every speech clip with its audio at the SHIPPED delay into a preview mp4
# - the backoffice Voice Lines board plays these, so what Kevin hears there is
# byte-for-byte what the game plays. Run after any clip/audio/delay change.
set -uo pipefail
cd "$(dirname "$0")/.."
for base in web/public/dealer web/public/dealers/astrid web/public/dealers/amira web/public/dealers/mei; do
  [ -f "$base/streams/index.json" ] || continue
  mkdir -p "$base/preview"
  python3 - "$base" <<'PYEOF'
import json, subprocess, sys, os
base=sys.argv[1]
idx=json.load(open(f'{base}/streams/index.json'))
made=0
for key,c in idx['clips'].items():
    if '/speak/' not in key: continue
    k=key.split('/')[-1]
    mp3=f'{base}/audio/en/{k}.mp3'
    if not os.path.exists(mp3): continue
    out=f'{base}/preview/{k}.mp4'
    stream=f"{base}/streams/{c['file']}"
    delay=c.get('audioDelayMs',0)
    src_m= max(os.path.getmtime(stream), os.path.getmtime(mp3))
    if os.path.exists(out) and os.path.getmtime(out) > src_m: continue
    r=subprocess.run(['ffmpeg','-nostdin','-loglevel','error','-f','h264','-r','24','-i',stream,
        '-itsoffset',f'{delay/1000:.3f}','-i',mp3,'-map','0:v','-map','1:a',
        '-c:v','libx264','-preset','fast','-crf','23','-vf','scale=720:720','-pix_fmt','yuv420p',
        '-c:a','aac','-shortest','-movflags','+faststart','-y',out],capture_output=True)
    if r.returncode==0: made+=1
    else: print(f'preview FAILED {base}/{k}')
print(f'{base}: {made} previews built')
PYEOF
done
