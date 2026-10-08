#!/usr/bin/env python3
"""Bake Dragge's English speech takes (MuseTalk lip sync on his KLARA VILA still, 2026-10-08) into opaque portrait films.

Every take is a green 1080x1920 film with sound that starts and ends on the VILA still. Each frame is keyed and
laid over the deal bank's plate with the deal bake's own functions (../klara-bake/build.py, loaded by path and
checked by sha256), so speech and deal films share one key, one plate and one rest still. Video is encoded like
the deal bank (H.264 crf 12, preset slow, yuv420p, BT.709, 24 fps, faststart); the AAC stream is copied packet
for packet, so sound and timing are the take's own.

<line>_1 becomes repliker/<line>/<line>.mp4 (the standard); <line>_2 and <line>_3 go to repliker/<line>/variant/.
The 15 extra lines of the delivery (greet_*, remark_*, banter_1, table_*) have no trigger in this repository and
are left out. Also writes repliker/bank.json (the exact English text of every standard), repliker/README.md,
receipt.json and takes.md (one take record per film, lab/docs/templates/media-take.md).

Usage: python -I build.py --takes <croupier-dragge-live/public/media/dealers/dragge/repliker/en>
                          --lines <dragge-voice-lines.csv> [--voice <voice/en-wav>] --out <new directory>
Review <out>/bank/repliker, copy it into media/dealers/dragge/runtime/presentation/repliker/ and keep
<out>/receipt.json and <out>/takes.md next to this script.
"""
import argparse, csv, hashlib, importlib.util, json, os, platform, subprocess, sys
import concurrent.futures as cf
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
DEAL_BAKE = (os.path.join(HERE, '..', 'klara-bake', 'build.py'), '7473991f23bb8f176474b5bcbf0a145f8f3c098dcd68edf087f0577e751068f9')
REST = (os.path.join(HERE, '..', '..', '..', 'runtime', 'presentation', 'rest.png'), '03256209954cdc06acec2a7169f82ded0ebc92256aa2220a14938073a8b69f36')
LINES_CSV = 'b0a91cdb849dc4cb694f4dc96be954455134c15d62b6cc740974126286ce12fb'
# presentation-runtime/media-families.mjs: the 17 speech lines and their events.
LINES = ['greeting', 'placebets', 'goodluck', 'sidebet', 'insurance', 'double', 'bust', 'blackjack', 'dealerblackjack',
         'dealerbust', 'win', 'push', 'lose', 'peek', 'farewell', 'chatter1', 'chatter2']
EVENT = lambda line: f'speak.{line}' if line in ('goodluck', 'insurance', 'double') else 'speak.other'
# web/public/app.mjs say(...) calls on this commit.
TRIGGER = {
    'greeting': 'the player arrives', 'placebets': 'a new round opens for bets', 'goodluck': 'bets close',
    'sidebet': 'a side bet wins', 'insurance': 'insurance is offered', 'double': 'the player doubles',
    'bust': "the player's hand goes over 21", 'blackjack': 'the player has blackjack', 'dealerblackjack': 'the dealer has blackjack',
    'dealerbust': 'the dealer goes over 21', 'win': 'the player wins', 'push': 'a push', 'lose': 'the player loses',
    'peek': 'not called today', 'farewell': 'not called today', 'chatter1': 'not called today', 'chatter2': 'not called today',
}
TAKES = {
    'blackjack_1.mp4': '0947cb9aa95031d69d0cdd2703a6bcbd3ab2e65a751b1d086d024caa97149f9e', 'blackjack_2.mp4': '859922faca2b025ca5931a5c33125dd3845ae2c77e20f39947e4cc4716c18cb5', 'blackjack_3.mp4': '7472ec2a700f17bb40feac503faaae82470fd4175b45457c9a3b381fe2d5d967',
    'bust_1.mp4': 'e8222b168c793d74f0c2a5a01e2cc88ae8077645ba2c9707792ab6f0c3db5e31', 'bust_2.mp4': '6e74a021094e20c7f314a53c31fd7c3fc428b5e3c5e3383ec011f0e6b796709f', 'bust_3.mp4': 'c84b33da8daf690c23f1407b86cddb07bfc7e505d87fe3ee1f59a5efbe120051',
    'chatter1_1.mp4': 'c13df6e611251148791fbb29720cc59d3d799a19912201a32e9a7066106b388f', 'chatter1_2.mp4': 'a54f6746d3e03328711e624a9bdc3d4263abca981b0e59aea910f9ae2bd1f342', 'chatter1_3.mp4': 'dcac43967dc2902e9eb592bffc30f2efff67889565ae9fcab6498838810abba3',
    'chatter2_1.mp4': '5c7cd4548816558bcced8f9ac3e2ccce9ff7ed8b7bba72a8ae6ceead8d4cfa55', 'chatter2_2.mp4': '1d33ede80cb6c9ed42179f071ca9f6037de8d1abe63386c6414bdf7888d1402d', 'chatter2_3.mp4': 'c20255bb2a7598980c23f7564098cb3aa02621ee780873161c2e997100bb1949',
    'dealerblackjack_1.mp4': '807ff17ec0251cb44c15fd6c35bd6dcf1dbd2fba36284f151de1944c3c7abcd2', 'dealerblackjack_2.mp4': 'd8d7b2be7237e55128b8c14a812f984ea049c4bf1d9ac568a20b90e993111f18', 'dealerblackjack_3.mp4': 'aa846766bc089d4e794939486f282666298c84ede3da7981da5d24fd42d6cad3',
    'dealerbust_1.mp4': 'd8b6ab4f4006ddced8475425332c3e3288fc6cf9d1aee5c29b160f40ff5a6a48', 'dealerbust_2.mp4': 'fc4d54c3a2cf6c2989ad053b172db8dd9c49cabc9eb5bff99bd12cd1573e70d8', 'dealerbust_3.mp4': '50e9c39cbdc9b952d7cf72cda92573e77a6797294b98d53ced9fb7c462354f3a',
    'double_1.mp4': 'd4501fe9521f30a06f96556977404ff56b361e1afa2d96a9eedcbfaf91c07012', 'double_2.mp4': '094838006a7b6102c75249754b8bc1feae88634de50465a6b0a7459cf31f0fde', 'double_3.mp4': '2a632a7f3a51fb6a1a8f1534a020f64198baa08f9822ef6cae8828ee41015968',
    'farewell_1.mp4': 'e3e18b37dc0b6f836e21b84848299421ccb387367a33d6f1c0990a06de888cde', 'farewell_2.mp4': 'edf33c03c2c0ca24f0443c8572a436bd2a7b06aa54fd39dd48bc4ad4413ad0ef', 'farewell_3.mp4': 'ca6390a92c72b5b0161da9d2fdeace988ceef8e71c7f4bbb2febd616eadbc0ec',
    'goodluck_1.mp4': 'b508a25e8339e985816ba7831c3f4348182e6f6f12003c14ded5a9ebaa7659e2', 'goodluck_2.mp4': '12a40a06cb1a747cddaf8490705696eee3c5c33651860a290de8d50c47b86564', 'goodluck_3.mp4': '0e75b61e7ae59bb151bd67e3e55d4caecfbbd0538f8649a20889a4fcb373f1b9',
    'greeting_1.mp4': 'd419f419c97a9ce5e8950faddaf9f201e6764ee9e4da7f045222eba85e384153', 'greeting_2.mp4': '1b197678e3aabc1b2b7b4f74c01593deb60ba6b5b20d735cee26f52342d574e0', 'greeting_3.mp4': '89f706f2b5849aa8523e9958390c5762f896fa25a5fa2a2e51987de816c1eacd',
    'insurance_1.mp4': 'df23df88f009f9b8b3df32654ffb01cfa5ac378ec6402b36ba6953c7b914634a', 'insurance_2.mp4': '6383387e473708290c2d69f630f33ebc2f5d3d917c201671bbab6ac91a6c4b11', 'insurance_3.mp4': '9e9049ce8372b05e38e783561865e3eb952675e9d5cad4665618c95101177a85',
    'lose_1.mp4': '43be073971cf47a580f7c1e4b006db17eb8be92e77904e6477fac5d3e83990f5', 'lose_2.mp4': '78ba2bd9f9528219b913ddabdf3e7c31893632783e2df0d9773ade06e31ed922', 'lose_3.mp4': 'eba9ce581e42410d06c3a1d41a76dec665eb1e82789736a7e53b0c6c37ccbb13',
    'peek_1.mp4': '9cd74736a427da0ca9549f28832f0136d3219d879116e10569bf84adc5d87428', 'peek_2.mp4': 'c8e36618eb0e8129ea09ad411b737c2974ab6a4aafadf009edfddbd4ddd67f41', 'peek_3.mp4': '18ae85d7acade4c691ded8b40dc29cabdc2360d1a1e123da675f9510f2d37fb5',
    'placebets_1.mp4': '37a2479b7dc9e31c342941d5a9e93fb8f951998542d14b40d8dd3c613565f013', 'placebets_2.mp4': '5889fa4aa696cfcc758953e0c3021d8968d57950bbf53ab9e9ba853f4127f9d9', 'placebets_3.mp4': '515646a1ce70e3205fa69a0e185d199c7150df2c59ceac07c5af9d36b658a31b',
    'push_1.mp4': 'f5551a30459450bff80912ae4cdebc17c11687de69eed29589dee04a9ac882c5', 'push_2.mp4': 'fb6610a97a40bffb77f4fb13443fab16de1ffe16f03d726067af0a3d2290952c', 'push_3.mp4': 'fda5bf9b598e6a52e5635769d56dbe3ee3e2faf68a9e5b3184c1fd9cdaebde3e',
    'sidebet_1.mp4': '5c0e45e7b4c46b89dbae3358e3bda334a1ed47b2e22f32268342fa887c9d862e', 'sidebet_2.mp4': 'dfced69bed771ce9d50693b262e41b87234fcc270a6030d7b3c3e9354d25e084', 'sidebet_3.mp4': '628345fb88804215160dab65741f95670e8bc484197eaf40b4e8525b754d311e',
    'win_1.mp4': '206724f5e69f2178f9544d8eac15114458349b4d79722d66e82ea0375a3c06f7', 'win_2.mp4': '7945ef43d74557accaffd46ae2095993e51ef1db386da1dda49f08b278e3851d', 'win_3.mp4': 'b833c6d46f144f7daa9aadbf1620234c6d76ee2124947eb2eb5cb379e2574d0a',
}
MIN_REST_PSNR = 40   # the takes start and end on the still; anything lower is a different picture


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''): h.update(chunk)
    return h.hexdigest()


def load_deal_bake():
    path, expected = DEAL_BAKE
    if sha256(path) != expected: sys.exit('../klara-bake/build.py changed; speech must use the key the deal films were baked with')
    sys.dont_write_bytecode = True   # no __pycache__ next to the committed deal bake
    spec = importlib.util.spec_from_file_location('klara_bake', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


deal = load_deal_bake()
W, H = deal.W, deal.H
VIDEO = [arg for arg in deal.ENCODE if arg != '-an'] + ['-c:a', 'copy']


def video_id(digest):
    return f'{digest[:8]}-{digest[8:12]}-{digest[12:16]}-{digest[16:20]}-{digest[20:32]}'


def frames(path):
    """Decoded rgb24 frames, one at a time (BT.709, like the deal bake)."""
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', path, '-map', '0:v:0', '-vf', deal.DECODE, '-f', 'rawvideo', '-'], stdout=subprocess.PIPE)
    size = W * H * 3
    while True:
        buf = p.stdout.read(size)
        if not buf: break
        if len(buf) != size: sys.exit(f'short frame in {path}')
        yield np.frombuffer(buf, np.uint8).reshape(H, W, 3)
    if p.wait() != 0: sys.exit(f'ffmpeg could not decode {path}')


def run(*args):
    return subprocess.run(args, capture_output=True, check=True).stdout


def streams(path):
    info = json.loads(run('ffprobe', '-v', 'error', '-count_frames', '-show_entries',
                          'stream=index,codec_type,codec_name,profile,nb_read_frames,start_time,duration,sample_rate,channels',
                          '-of', 'json', path))
    return info['streams']


def audio_packets(path):
    """Every audio packet's timing, size and MD5 (ffmpeg framemd5)."""
    return run('ffmpeg', '-v', 'error', '-i', path, '-map', '0:a:0', '-c', 'copy', '-f', 'framemd5', '-').decode()


def voice_span(path):
    """First and last 10 ms window above -40 dBFS. Information for the reviewer, not a lip-sync measure."""
    pcm = np.frombuffer(run('ffmpeg', '-v', 'error', '-i', path, '-map', '0:a:0', '-f', 's16le', '-ac', '1', '-ar', '24000', '-'), np.int16)
    n = len(pcm) // 240
    rms = np.sqrt((pcm[:n * 240].astype(np.float64).reshape(n, 240) ** 2).mean(axis=1)) / 32768
    loud = np.where(rms > 10 ** (-40 / 20))[0]
    return [round(loud[0] * .01, 2), round((loud[-1] + 1) * .01, 2)] if len(loud) else None


def bake(job, plate, plate_green, rest):
    src, target = job['source'], job['target']
    os.makedirs(os.path.dirname(target), exist_ok=True)
    enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', '24', '-i', '-',
                            '-i', src, '-map', '0:v:0', '-map', '1:a:0', *VIDEO, target], stdin=subprocess.PIPE)
    first = last = None
    count = 0
    for f in frames(src):
        out = deal.to8(deal.over(*deal.key(f), plate))
        enc.stdin.write(np.ascontiguousarray(out).tobytes())
        first = out if first is None else first
        last, count = out, count + 1
    enc.stdin.close()
    if enc.wait() != 0: sys.exit(f'ffmpeg failed: {target}')

    back_first = back_last = None
    fringe = back_count = 0
    for f in frames(target):
        back_first = f if back_first is None else back_first
        back_last, back_count = f, back_count + 1
        fringe = max(fringe, int(((deal.green_excess(f) > 20) & (plate_green < 10)).sum()))
    probe = streams(target)
    video = [s for s in probe if s['codec_type'] == 'video']
    audio = [s for s in probe if s['codec_type'] == 'audio']
    take_audio = [s for s in streams(src) if s['codec_type'] == 'audio'][0]
    same_packets = audio_packets(src) == audio_packets(target)
    payload = hashlib.sha256(run('ffmpeg', '-v', 'error', '-i', target, '-map', '0:a:0', '-c', 'copy', '-f', 'data', '-')).hexdigest()
    checks = {
        'firstFrameVsRestPsnr': deal.psnr(back_first, rest),
        'lastFrameVsRestPsnr': deal.psnr(back_last, rest),
        'encodeVsCompositePsnr': [deal.psnr(back_first, first), deal.psnr(back_last, last)],
        'greenFringePixelsMax': fringe,
        'audioPacketsIdenticalToTake': same_packets,
    }
    film = {
        'path': job['path'], 'take': job['take'], 'line': job['line'], 'role': job['role'],
        'familyId': f"dragge/{EVENT(job['line'])}/{job['line']}", 'text': job['text'],
        'frames': back_count, 'seconds': round(back_count / 24, 3),
        'audio': {'codec': audio[0]['codec_name'] if audio else None, 'profile': audio[0].get('profile') if audio else None,
                  'sampleRate': int(audio[0]['sample_rate']) if audio else None, 'channels': audio[0].get('channels') if audio else None,
                  'startSeconds': float(audio[0]['start_time']) if audio else None, 'seconds': float(audio[0]['duration']) if audio else None,
                  'takeStartSeconds': float(take_audio['start_time']), 'takeSeconds': float(take_audio['duration']),
                  'payloadSha256': payload, 'voiceSpanSeconds': voice_span(target)},
        'checks': checks,
    }
    ok = (count == back_count == int(video[0]['nb_read_frames']) == job['takeFrames'] and len(video) == 1 and len(audio) == 1 and len(probe) == 2
          and same_packets and float(audio[0]['start_time']) == float(take_audio['start_time'])
          and min(checks['firstFrameVsRestPsnr'], checks['lastFrameVsRestPsnr']) >= MIN_REST_PSNR)
    if not ok: sys.exit(f"{job['path']} failed its checks: {json.dumps(film)}")
    print(job['path'], json.dumps(checks), 'frames', back_count, flush=True)
    return film


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f: f.write(text)


def readme(films):
    standards = [f for f in films if f['role'] == 'standard']
    rows = '\n'.join(f"| `{f['line']}/{f['line']}.mp4` | {f['text']} | {TRIGGER[f['line']]} | {f['seconds']:.1f} s |" for f in standards)
    psnrs = [x for f in films for x in (f['checks']['firstFrameVsRestPsnr'], f['checks']['lastFrameVsRestPsnr'])]
    spans = [f['audio']['voiceSpanSeconds'] for f in films if f['audio']['voiceSpanSeconds']]
    lead = [s[0] for s in spans]
    tail = [round(f['audio']['seconds'] - f['audio']['voiceSpanSeconds'][1], 2) for f in films if f['audio']['voiceSpanSeconds']]
    variants = '\n'.join(f"| `{f['path'][len('repliker/'):]}` | {f['text']} | {f['seconds']:.1f} s |" for f in films if f['role'] == 'variant')
    return f"""# Dragge – speech films, English (baked 2026-10-08)

The 17 lines of the game's speech catalogue as lip-synced films on Dragge's rest still, for the local presentation
lane. The folder name is the line id, the same ids as `presentation-runtime/media-families.mjs` and
`web/public/speech-lines.mjs`. `bank.json` here, published as `/dealers/dragge/audio/en/bank.json`, holds the
exact English text of each standard film. How the films were made and measured, and one take record per film:
`media/dealers/dragge/staging/2026-10-08/speech-en-bake/`.

## Format

| | |
|---|---|
| Films | MP4, H.264 (crf 12, preset slow), yuv420p, BT.709, 24 fps, **1080×1920**, faststart, **with sound**: AAC-LC, mono, 24 kHz, copied packet for packet from the lip-sync take |
| Rest still | `../rest.png`. Frame 0 and the last frame of every film match it at {min(psnrs)}–{max(psnrs)} dB PSNR (the deal films' frame 0: 46.3 dB), so speech and deal films start and end on the same picture |
| Movement | only the mouth and jaw; the rest of the picture is the still |
| Silence | {min(lead):.2f}–{max(lead):.2f} s before the voice and {min(tail):.2f}–{max(tail):.2f} s after it (no 10 ms window above -40 dBFS) |
| Voice | Dragge's cloned voice (ElevenLabs), English. Lip sync: MuseTalk, avatar `dragan_vila2x` (his KLARA `VILA.png`) |

## Standard films

| File | Text | Played when (`web/public/app.mjs`) | Length |
|---|---|---|---|
{rows}

## variant/

Other wordings of the same moment. The player never chooses one by itself: only an explicit, reviewed Studio
media policy entry can select a variant, and the rehearsal panel plays the standard.

| File | Text | Length |
|---|---|---|
{variants}

## Known limits

- While he speaks, the mouth area is softer and the lips paler than in the still: that is MuseTalk's mouth, and
  each take eases into it and back over about five frames at either end. The bake does not change it.
- `chatter1` and `chatter2` are not called by the game, and `/api/presentation/select` accepts letter-only line
  ids, so neither can be played yet. The same holds for Astrid's.

## Not done

- Visual lip-sync approval of every film. The take records are filled in as far as automated checks go and wait
  for a human reviewer.
- Swedish: the speech catalogue has no language dimension, so the Swedish takes are not included.
- The 15 extra lines of the delivery (`greet_*`, `remark_*`, `banter_1`, `table_*`) have no trigger here and are
  left out.
"""


def takes_md(films, receipt):
    out = ['# Dragge – English speech: take records (2026-10-08)', '',
           'One record per film, fields as in `lab/docs/templates/media-take.md`. Written by `build.py` from the checks in',
           '`receipt.json`. Automated checks pass for every film; nobody has reviewed the lip sync yet, so every take is',
           '**ogranskad** (unreviewed). A changed text, audio or video hash invalidates any later approval.', '']
    for f in films:
        rel = f"media/dealers/dragge/runtime/presentation/{f['path']}"
        out_sha = receipt['outputs'][f['path']]['sha256']
        take = receipt['inputs']['takes'][f['take']]
        wav = receipt['inputs'].get('voice', {}).get(f['take'][:-4] + '.wav')
        a, c = f['audio'], f['checks']
        variant = (f"Standard of the family; `{f['take'][:-4]}`. Selected whenever the game speaks the line."
                   if f['role'] == 'standard' else
                   f"Folder variant `{f['take'][:-4]}`. Never chosen automatically; only an explicit, reviewed Studio media policy entry may select it.")
        span = f"voice from {a['voiceSpanSeconds'][0]:.2f} s to {a['voiceSpanSeconds'][1]:.2f} s (above -40 dBFS, information only)" if a['voiceSpanSeconds'] else 'no voice above -40 dBFS'
        out += [
            f"## `{f['path']}`", '',
            f"- Dealer och avsedd identitet: `dragge` (Dragge), the KLARA VILA rest pose (`rest.png` of the deal bank).",
            f"- Eventgrupp och exakt situation/replik-ID: `{EVENT(f['line'])}`, line `{f['line']}` (family `{f['familyId']}`).",
            f"- Variant-ID, standard/alternativ, urvalstillåtelser och trigger-ID:n: {variant} " + (f"Trigger: none; the game does not call `say('{f['line']}')` today." if TRIGGER[f['line']] == 'not called today' else f"Trigger: `say('{f['line']}')`, {TRIGGER[f['line']]}."),
            f"- Video-ID, revisionsnamn, relativ materialreferens, SHA-256: `{video_id(out_sha)}`, speech-en-bake 2026-10-08, `{rel}`, `{out_sha}`.",
            f"- Filformat, codec, fps, dimensioner, duration: MP4, H.264 crf 12 yuv420p BT.709 + {a['codec'].upper()}-{a['profile']} mono {a['sampleRate']} Hz, 24 fps, 1080×1920, {f['frames']} frames ({f['seconds']:.3f} s; sound {a['seconds']:.3f} s), {receipt['outputs'][f['path']]['size']} bytes.",
            f"- Exakt text och språk (tal): English: \"{f['text']}\"",
            f"- Ljudreferens och SHA-256 (tal): the AAC stream of take `{f['take']}` (`{take['sha256']}`), copied packet for packet (identical packets: {'yes' if c['audioPacketsIdenticalToTake'] else 'no'}); payload `{a['payloadSha256']}`."
            + (f" Lip-sync input `voice/en-wav/{f['take'][:-4]}.wav` (`{wav['sha256']}`)." if wav else ''),
            f"- Frame-index, audio delay och kalibreringsreferens: frames 0–{f['frames'] - 1}; sound and picture start together at {a['startSeconds']:.3f} s in the same file, audio delay 0 ms; {span}. No card calibration (no card in a speech film).",
            f"- Mask/kontakt/landning/övergångar (om relevant): green key of `../klara-bake/build.py` over `darkhall.png`; no contact or landing. Starts and ends on the rest still: frame 0 {c['firstFrameVsRestPsnr']} dB, last frame {c['lastFrameVsRestPsnr']} dB PSNR against `rest.png`; green fringe pixels {c['greenFringePixelsMax']}.",
            "- Producent, datum, källmaterial och överlämningsplats: Kevin, 2026-10-08. Voice: ElevenLabs, Dragge's cloned voice. Lip sync: MuseTalk on RunPod Serverless, avatar `dragan_vila2x`. "
            f"Take handed over in `croupier-dragge-live/public/media/dealers/dragge/repliker/en/{f['take']}` (outside the repository, not tracked); baked by `build.py` here.",
            f"- Matchande eventprov och icke-matchande kontrollfall: automated, `lab/test/presentation-banks.test.mjs`: Dragge's `{{type:'speak', line:'{f['line']}'}}` resolves to family `{f['familyId']}` in the repository registry"
            + (" with this film's video ID among its variants" if f['role'] == 'variant' else " with this film's video ID as its standard; `test/presentation-select-dealers.mjs`: "
               + ("`/api/presentation/select` refuses the line, because it accepts letter-only line ids (the same for every dealer)" if any(ch.isdigit() for ch in f['line'])
                  else "`/api/presentation/select` serves this film for Dragge's line")) + "; Paow's same request finds no family.",
            '- Uppspelningskvitton, två plays i följd och avbrottsprov: **saknas**. Needs `/blackjack?lane=mobile-phone-dragge&rehearsal=1`, "Play twice", and an interrupted play, in a browser.'
            + (' The game does not call this line today, and select refuses its id, so the player cannot play it yet.' if any(ch.isdigit() for ch in f['line']) else
               ' The rehearsal panel plays the standard; this variant needs a Studio media policy entry to be heard in the player.' if f['role'] == 'variant' else ''),
            '- Visuell granskare, datum, exakt granskade bytes och resultat per punkt: **saknas**, pending a human reviewer (lip sync, mouth closed at the end, seams to the rest still).',
            '- Kvarvarande luckor, status (ogranskad / review / avvisad / accepterad): ogranskad. Open: visual lip-sync approval, browser rehearsal, Blob publish.',
            '- Kevin: eventuell produktbindning och aktiveringsrevision: none. Not published to Blob and not active in BO or live.',
            '']
    return '\n'.join(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--takes', required=True, help='the repliker/en directory of the lip-sync delivery')
    ap.add_argument('--lines', required=True, help='dragge-voice-lines.csv')
    ap.add_argument('--voice', help='voice/en-wav, the lip-sync input; hashes are recorded as provenance')
    ap.add_argument('--out', required=True, help='new directory for bank/, receipt.json and takes.md')
    ap.add_argument('--jobs', type=int, default=3)
    args = ap.parse_args()
    if os.path.exists(args.out) and os.listdir(args.out): sys.exit('--out must be new or empty')
    bank = os.path.join(args.out, 'bank')

    if sha256(args.lines) != LINES_CSV: sys.exit(f'{args.lines} is not the reviewed text list')
    with open(args.lines, encoding='utf-8', newline='') as f: texts = {row['id']: row['english'] for row in csv.DictReader(f)}
    plate_path = os.path.join(os.path.dirname(DEAL_BAKE[0]), deal.PLATE[0])
    if sha256(plate_path) != deal.PLATE[1]: sys.exit('the plate changed')
    if sha256(REST[0]) != REST[1]: sys.exit('the rest still changed')
    plate8 = deal.read_png(plate_path)
    plate, plate_green = plate8.astype(np.float32) / 255, deal.green_excess(plate8)
    rest = deal.read_png(REST[0])

    inputs = {'takes': {}, 'lines': {'file': os.path.basename(args.lines), 'sha256': LINES_CSV}}
    jobs = []
    for line in LINES:
        for n in (1, 2, 3):
            take = f'{line}_{n}.mp4'
            src = os.path.join(os.path.abspath(args.takes), take)
            got = sha256(src)
            if got != TAKES[take]: sys.exit(f'{take}: sha256 {got} is not the reviewed take')
            if f'{line}_{n}' not in texts: sys.exit(f'no text for {line}_{n}')
            video = [s for s in streams(src) if s['codec_type'] == 'video'][0]
            inputs['takes'][take] = {'sha256': got, 'size': os.path.getsize(src), 'frames': int(video['nb_read_frames'])}
            path = f'repliker/{line}/{line}.mp4' if n == 1 else f'repliker/{line}/variant/{line}_{n}.mp4'
            jobs.append({'take': take, 'source': src, 'line': line, 'role': 'standard' if n == 1 else 'variant', 'path': path,
                         'target': os.path.join(bank, path), 'text': texts[f'{line}_{n}'], 'takeFrames': int(video['nb_read_frames'])})
    if args.voice:
        inputs['voice'] = {}
        for job in jobs:
            wav = os.path.join(args.voice, job['take'][:-4] + '.wav')
            inputs['voice'][os.path.basename(wav)] = {'sha256': sha256(wav), 'size': os.path.getsize(wav)}

    with cf.ThreadPoolExecutor(max(1, args.jobs)) as ex:
        films = list(ex.map(lambda job: bake(job, plate, plate_green, rest), jobs))

    for line in LINES:
        keep = os.path.join(bank, 'repliker', line, 'variant', '.gitkeep')
        open(keep, 'w').close()
    write(os.path.join(bank, 'repliker', 'bank.json'),
          json.dumps({f['line']: {'text': f['text']} for f in films if f['role'] == 'standard'}, indent=2, ensure_ascii=False) + '\n')
    write(os.path.join(bank, 'repliker', 'README.md'), readme(films))

    outputs = {}
    for root, _, names in os.walk(bank):
        for name in sorted(names):
            full = os.path.join(root, name)
            outputs[os.path.relpath(full, bank).replace(os.sep, '/')] = {'sha256': sha256(full), 'size': os.path.getsize(full)}
    receipt = {
        'dealer': 'dragge', 'language': 'en',
        'delivery': 'MuseTalk lip sync on the KLARA VILA still (avatar dragan_vila2x), ElevenLabs voice, 2026-10-08',
        'inputs': inputs,
        'dealBake': {'file': '../klara-bake/build.py', 'sha256': DEAL_BAKE[1]},
        'plate': {'file': '../klara-bake/' + deal.PLATE[0], 'sha256': deal.PLATE[1]},
        'restStill': {'file': 'media/dealers/dragge/runtime/presentation/rest.png', 'sha256': REST[1]},
        'buildScriptSha256': sha256(os.path.abspath(__file__)),
        'encode': ' '.join(VIDEO), 'decode': deal.DECODE,
        'tools': {'ffmpeg': subprocess.run(['ffmpeg', '-version'], capture_output=True, text=True).stdout.split('\n')[0],
                  'python': platform.python_version(), 'numpy': np.__version__, 'opencv': deal.cv2.__version__},
        'films': films, 'outputs': outputs,
    }
    with open(os.path.join(args.out, 'receipt.json'), 'w', encoding='utf-8') as f:
        json.dump(receipt, f, indent=1, ensure_ascii=False); f.write('\n')
    write(os.path.join(args.out, 'takes.md'), takes_md(films, receipt))


if __name__ == '__main__':
    main()
