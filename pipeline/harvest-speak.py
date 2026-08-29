#!/usr/bin/env python3
"""Download finished Seedance speak jobs, encode, index, measure."""
import json, os, subprocess, time, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAN = f'{ROOT}/content/speak-jobs.json'
jobs = json.load(open(MAN))

def run(cmd, timeout=None):
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)

def list_jobs():
    r = run(['higgsfield','generate','list','--video','--size','50','--json'])
    try:
        return json.loads(r.stdout)
    except Exception:
        print('list parse fail', r.stdout[:300], r.stderr[:300])
        return []

def encode_one(j):
    dealer, key, jid = j['dealer'], j['key'], j['id']
    raw = f'{ROOT}/content/dealers/{dealer}/raw/speak_{key}.mp4'
    h264 = f'{ROOT}/content/dealers/{dealer}/stage/idle-1_speak_{key}.h264'
    stream = f'{ROOT}/web/public/dealers/{dealer}/streams/idle-1_speak_{key}.h264'
    if os.path.exists(raw) and os.path.getsize(raw) > 10000 and j.get('harvested'):
        return 'already'
    url = j.get('result_url')
    if not url:
        return 'no-url'
    os.makedirs(os.path.dirname(raw), exist_ok=True)
    os.makedirs(os.path.dirname(h264), exist_ok=True)
    print(f'DL {dealer}/{key}', flush=True)
    r = run(['curl','-fsSL','-o',raw, url])
    if r.returncode != 0 or not os.path.exists(raw) or os.path.getsize(raw) < 10000:
        print('  download fail', r.stderr[-200:])
        return 'dl-fail'
    r = run([f'{ROOT}/pipeline/encode.sh', raw, h264])
    print(' ', r.stdout.strip() or r.stderr[-200:], flush=True)
    os.makedirs(os.path.dirname(stream), exist_ok=True)
    subprocess.check_call(['cp', h264, stream])
    j['harvested'] = True
    json.dump(jobs, open(MAN,'w'), indent=2)
    return 'ok'

def measure_dealer(dealer):
    base = f'{ROOT}/web/public/dealers/{dealer}'
    run(['node', f'{ROOT}/pipeline/build-index.mjs', f'{base}/streams', base])
    r = run(['python3', f'{ROOT}/pipeline/apply-lipsync.py', base])
    print(r.stdout)
    return r.stdout

def main():
    deadline = time.time() + 25*60
    while time.time() < deadline:
        listed = {x['id']: x for x in list_jobs()}
        pending = 0
        for j in jobs:
            info = listed.get(j['id'])
            if not info:
                pending += 1
                print(f'? {j["dealer"]}/{j["key"]} not in recent list')
                continue
            j['status'] = info.get('status')
            j['result_url'] = info.get('result_url')
            if info.get('status') == 'completed' and info.get('result_url'):
                if not j.get('harvested'):
                    encode_one(j)
            elif info.get('status') in ('failed','error'):
                print(f'FAIL {j["dealer"]}/{j["key"]} {info.get("status")}')
                j['status'] = info.get('status')
            else:
                pending += 1
                print(f'... {j["dealer"]}/{j["key"]} {info.get("status")}')
        json.dump(jobs, open(MAN,'w'), indent=2)
        done = sum(1 for j in jobs if j.get('harvested'))
        fail = sum(1 for j in jobs if j.get('status') in ('failed','error'))
        print(f'progress harvested={done} failed={fail} pending={pending}/{len(jobs)}')
        if pending == 0:
            break
        time.sleep(20)
    for dealer in ['amira','mei']:
        print(f'\\n==== measure {dealer} ====')
        measure_dealer(dealer)
    print('credits:')
    print(run(['higgsfield','account','status','--json']).stdout)

if __name__ == '__main__':
    main()
