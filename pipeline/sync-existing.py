#!/usr/bin/env python3
"""Zero-credit lip sync: restore original TTS, retime mouth span to that audio, restamp delays."""
import json, os, sys, shutil, subprocess, importlib.util
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
spec=importlib.util.spec_from_file_location('apw','pipeline/auto-phrase-warp.py')
apw=importlib.util.module_from_spec(spec); spec.loader.exec_module(apw)

CROPS=json.load(open('pipeline/mouth-crops.json'))
DEALERS={
    'vera': 'media/dealers/vera/runtime/indexed',
    'astrid': 'media/dealers/astrid/runtime/indexed',
    'amira': 'media/dealers/amira/runtime/indexed',
    'mei': 'media/dealers/mei/runtime/indexed',
}
# Vera already passed Kevin's gate; only touch her worst leftovers.
VERA_ONLY={'goodluck','peek','placebets','chatter2','rules_bj_pays','side_213','bust','win','rules_s17'}

def crop_tuple(dealer):
    c=CROPS[dealer]['crop']
    return (c[0],c[1]), (c[2],c[3],False)

def restore_orig_audio(base, key):
    orig=f'{base}/audio/en/orig/{key}.mp3'
    cur=f'{base}/audio/en/{key}.mp3'
    if os.path.exists(orig):
        shutil.copy(orig, cur)
        return True
    return False

def retime(base, key, v0, v1, a0, a1):
    r=subprocess.run(['python3','pipeline/retime-video-warp.py', base, key,
                      str(v0), str(v1), str(a0), str(a1)], capture_output=True, text=True)
    print('  retime', r.stdout.strip() or r.stderr[-300:], flush=True)
    return r.returncode==0

def process_dealer(dealer, base, only=None):
    idx=json.load(open(f'{base}/streams/index.json'))
    crop, box = crop_tuple(dealer)
    os.environ['MOUTH_CROP']=':'.join(str(x) for x in CROPS[dealer]['crop'])
    n_rt=n_skip=n_fail=0
    keys=[k.split('/')[-1] for k in idx['clips'] if '/speak/' in k]
    if only: keys=[k for k in keys if k in only]
    print(f'\n==== {dealer} ({len(keys)} clips) crop={CROPS[dealer]["crop"]} ====', flush=True)
    for key in keys:
        c=idx['clips'].get(f'idle-1/speak/{key}')
        mp3=f'{base}/audio/en/{key}.mp3'
        if not c or not os.path.exists(mp3):
            print(f'{key}: missing'); n_fail+=1; continue
        restored=restore_orig_audio(base, key)
        stream=f"{base}/streams/{c['file']}"
        try:
            aph, waves, adur = apw.analyze(stream, mp3, crop, box)
            waves = apw.reconcile(aph, waves)
        except Exception as e:
            print(f'{key}: analyze fail {e}'); n_fail+=1; continue
        if not aph or not waves:
            print(f'{key}: no phrases/waves aph={len(aph) if aph else 0} waves={len(waves) if waves else 0}'); n_skip+=1; continue
        a0,a1=aph[0][0], aph[-1][1]
        v0,v1=waves[0][0], waves[-1][1]
        md, ad = max(1.0, v1-v0), max(1.0, a1-a0)
        ratio=md/ad
        onset=v0-a0
        print(f'{key}: aph={len(aph)} waves={len(waves)} onset={onset:.0f}ms mouth={md:.0f} audio={ad:.0f} ratio={ratio:.2f} restored={restored}', flush=True)
        # Compress a slow mouth onto the TTS span. Skip if already close.
        if ratio < 1.06 and abs(onset) <= 120:
            print(f'  already close, skip retime'); n_skip+=1; continue
        if md < 180 or ad < 180:
            print(f'  spans too short, skip retime'); n_skip+=1; continue
        # Don't speed mouths more than ~1.35x (looks snappy/wrong)
        if ratio > 1.35:
            # still retime but the script clamps via frame mapping; warn
            print(f'  heavy pad-drift ratio={ratio:.2f}, retiming anyway')
        if retime(base, key, v0, v1, a0, a1):
            n_rt+=1
        else:
            n_fail+=1
    print(f'{dealer}: retimed={n_rt} skipped={n_skip} failed={n_fail}', flush=True)
    # rebuild index (frame counts changed) then stamp delays
    print(f'  build-index {dealer}', flush=True)
    subprocess.check_call(['node','pipeline/build-index.mjs', f'{base}/streams', base])
    # drop stale manual overrides for dealers we fully retimed
    if dealer != 'vera':
        ovp=f'{base}/lipsync-overrides.json'
        if os.path.exists(ovp):
            bak=ovp+'.pre-retime'
            shutil.copy(ovp, bak)
            json.dump({}, open(ovp,'w'))
            print(f'  cleared {ovp}')
    print(f'  apply-lipsync {dealer}', flush=True)
    r=subprocess.run(['python3','pipeline/apply-lipsync.py', base], capture_output=True, text=True)
    print(r.stdout)
    if r.returncode!=0: print(r.stderr[-400:])

def main():
    want=sys.argv[1:] or ['amira','mei','astrid','vera']
    for dealer in want:
        base=DEALERS[dealer]
        only=VERA_ONLY if dealer=='vera' else None
        process_dealer(dealer, base, only)

if __name__=='__main__':
    main()
