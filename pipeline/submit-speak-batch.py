#!/usr/bin/env python3
"""Submit Seedance 2.5 speak takes. Stretch refs under 2.0s; never silence-pad."""
import json, os, subprocess, sys, math, time, shutil
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOOK = {
  'amira': 'a brunette dealer in a camel blazer with a gold name tag at a tan felt casino table with a softly glowing rim, warm golden salon behind',
  'mei': 'an East Asian dealer in a navy uniform with a brass badge at a cyan-lit casino table, curved white futuristic venue behind',
  'astrid': 'a blonde dealer in a black blazer at a dark casino table with an illuminated rail, dark hall with linear pendant lights behind',
}
GAME = ['greeting','goodluck','win','lose','bust','placebets','blackjack','dealerblackjack','dealerbust','insurance','double','peek','push','sidebet','farewell']

def dur(path):
    r = subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',path], capture_output=True, text=True)
    return float(r.stdout.strip())

def gen_duration(audio_s):
    return max(4, min(12, math.ceil(audio_s) + 1))

def prompt_for(dealer, text):
    return (f'Continue this exact static shot, same camera, same framing, same lighting: {LOOK[dealer]}. '
            f'She speaks the provided audio line directly to camera in one continuous breath with PRECISE lip sync - '
            f'her lips move only while the voice speaks, at its exact pace - then returns calmly to rest with lips closed. '
            f'No camera movement.')

def ensure_ref(dealer, key, mp3):
    dstdir = f'{ROOT}/content/dealers/{dealer}/audio-ref'
    os.makedirs(dstdir, exist_ok=True)
    ref = f'{dstdir}/{key}.mp3'
    d = dur(mp3)
    if d >= 2.0:
        if not os.path.exists(ref) or abs(dur(ref) - d) > 0.05:
            shutil.copy(mp3, ref)
        return ref, d, False
    # stretch (slow down) to 2.05s so Seedance accepts it without trailing silence
    target = 2.05
    tempo = max(0.5, d / target)
    subprocess.check_call(['ffmpeg','-nostdin','-hide_banner','-loglevel','error','-y','-i',mp3,
        '-filter:a', f'atempo={tempo:.4f}', ref])
    print(f'  stretched {dealer}/{key} {d:.2f}s -> {dur(ref):.2f}s tempo={tempo:.3f}')
    return ref, d, True

def submit(dealer, key, text):
    still = f'{ROOT}/content/dealers/{dealer}/canonical-frame0.png'
    mp3 = f'{ROOT}/web/public/dealers/{dealer}/audio/en/{key}.mp3'
    audio, d, stretched = ensure_ref(dealer, key, mp3)
    duration = gen_duration(d)
    res = '720p'
    outdir = f'{ROOT}/content/dealers/{dealer}/gen'
    os.makedirs(outdir, exist_ok=True)
    cmd = [
        'higgsfield','generate','create','seedance_2_5',
        '--prompt', prompt_for(dealer, text),
        '--mode','omni_reference',
        '--start-image', still,
        '--end-image', still,
        '--audio', audio,
        '--aspect_ratio','1:1',
        '--resolution', res,
        '--duration', str(duration),
        '--generate_audio','false',
        '--json',
    ]
    print(f'SUBMIT {dealer}/{key} dur={duration}s {res} audio={d:.2f}s stretched={stretched}', flush=True)
    r = subprocess.run(cmd, capture_output=True, text=True)
    open(f'{outdir}/{key}-create.json','w').write(r.stdout + '\n' + r.stderr)
    if r.returncode != 0:
        print(f'  FAIL {dealer}/{key}: {(r.stderr or r.stdout)[-500:]}', flush=True)
        return None
    try:
        data = json.loads(r.stdout)
        jid = data[0] if isinstance(data, list) else data.get('id') or data.get('job_id')
    except Exception as e:
        print(f'  PARSE {dealer}/{key}: {e} {r.stdout[:400]}', flush=True)
        return None
    rec = {'id': jid, 'dealer': dealer, 'key': key, 'duration': duration, 'resolution': res, 'stretched': stretched}
    open(f'{outdir}/{key}-job.json','w').write(json.dumps(rec, indent=2))
    print(f'  OK {jid}', flush=True)
    return rec

def main():
    dealers = ['amira','mei']
    lines = GAME[:]
    skip = {('amira','greeting')}  # already measured good at 1080p
    args = sys.argv[1:]
    for i,a in enumerate(args):
        if a == '--dealers' and i+1 < len(args):
            dealers = args[i+1].split(',')
        if a == '--lines' and i+1 < len(args):
            lines = args[i+1].split(',')
        if a == '--also-greeting':
            skip.discard(('amira','greeting'))
    jobs = []
    manifest = f'{ROOT}/content/speak-jobs.json'
    existing = json.load(open(manifest)) if os.path.exists(manifest) else []
    have = {(j['dealer'], j['key']) for j in existing if j.get('id')}
    for dealer in dealers:
        bank = json.load(open(f'{ROOT}/web/public/dealers/{dealer}/audio/en/bank.json'))
        for key in lines:
            if (dealer, key) in skip: continue
            if (dealer, key) in have:
                print(f'SKIP {dealer}/{key} already submitted')
                continue
            rec = submit(dealer, key, bank[key]['text'])
            if rec:
                existing.append(rec)
                json.dump(existing, open(manifest,'w'), indent=2)
                jobs.append(rec)
            time.sleep(0.3)
    print(f'submitted {len(jobs)} new jobs, manifest {len(existing)}')

if __name__ == '__main__':
    main()
