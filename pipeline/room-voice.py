#!/usr/bin/env python3
# Room/distance treatment for dealer voices: the TTS is close-mic dry, a real
# dealer speaks across the table in a hall. Convolve each playback mp3 with a
# synthesized venue impulse response whose t=0 tap is the unity direct path -
# the voice's own timing is untouched, so every audioDelayMs stamp stays valid.
# Pristine synced-dry copies live in audio/en/dry/ and are ALWAYS the source.
# Usage: room-voice.py <base> <venue>   (venues: prive darkhall goldensalon azure)
import numpy as np, subprocess, sys, os, glob, shutil, struct, wave
SR=44100
VENUES={  # rt60_s, tail_lowpass_hz, predelay_ms, wet_energy_db (reverb energy vs direct)
 'studio':      (0.20, 6500,  8, -22),  # Kevin 08-29: "too much echo, studio" - air only
 'prive':       (0.35, 5500, 12, -16),
 'darkhall':    (0.60, 4500, 20, -15),
 'goldensalon': (0.45, 5500, 15, -16),
 'azure':       (0.70, 7500, 22, -15),
}
def make_ir(rt60, lp, predelay_ms, wet_db):
    rng=np.random.default_rng(7)
    n=int(SR*(rt60*1.6)); t=np.arange(n)/SR
    tail=rng.standard_normal(n)*np.exp(-6.91*t/rt60)
    # one-pole lowpass tint for air/wall absorption
    a=np.exp(-2*np.pi*lp/SR); y=np.empty(n); acc=0.0
    for i in range(n): acc=(1-a)*tail[i]+a*acc; y[i]=acc
    pre=int(SR*predelay_ms/1000)
    ir=np.zeros(pre+n)
    for ms,g in [(11,.28),(23,.22),(37,.17),(53,.12)]: # early reflections
        ir[min(pre+n-1,int(SR*ms/1000))]+=g
    ir[pre:]+=y
    # calibrate by ENERGY: reverb loudness is energy, not peak
    ir*=np.sqrt(10**(wet_db/10)/((ir**2).sum()+1e-12))
    return ir.astype(np.float32)
def write_wav(path, x):
    with wave.open(path,'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(x,-1,1)*32767).astype('<i2').tobytes())
def decode(path):
    out=subprocess.run(['ffmpeg','-nostdin','-loglevel','error','-i',path,'-f','f32le','-ac','1','-ar',str(SR),'-'],capture_output=True).stdout
    return np.frombuffer(out,dtype=np.float32).copy()
def encode(x, path):
    subprocess.run(['ffmpeg','-nostdin','-loglevel','error','-f','f32le','-ac','1','-ar',str(SR),'-i','-','-codec:a','libmp3lame','-q:a','3','-y',path],input=np.clip(x,-1,1).astype(np.float32).tobytes(),check=True)
def room(x, ir):
    n=len(x)
    wet=np.fft.irfft(np.fft.rfft(x,n+len(ir))*np.fft.rfft(ir,n+len(ir)))[:n]
    return x+wet
def main():
    base,venue=sys.argv[1],sys.argv[2]
    os.makedirs('pipeline/irs',exist_ok=True)
    rt60,lp,pre,wetlvl=VENUES[venue]
    irp=f'pipeline/irs/{venue}.wav'
    if not os.path.exists(irp): write_wav(irp, make_ir(rt60,lp,pre,wetlvl))
    import wave as _w
    with _w.open(irp) as w: ir=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').astype(np.float32)/32767.0
    ir=ir.copy()   # tail+reflections only; the direct path is the original signal
    dry=f'{base}/audio/en/dry'; os.makedirs(dry,exist_ok=True)
    done=0
    for mp3 in sorted(glob.glob(f'{base}/audio/en/*.mp3')):
        k=os.path.basename(mp3); d=f'{dry}/{k}'
        if not os.path.exists(d): shutil.copy(mp3,d)
        x=decode(d)
        # distance EQ: high-pass 110Hz (kill mic proximity) + gentle top tilt
        r=subprocess.run(['ffmpeg','-nostdin','-loglevel','error','-i',d,'-af','highpass=f=100','-f','f32le','-ac','1','-ar',str(SR),'-'],capture_output=True)
        x=np.frombuffer(r.stdout,dtype=np.float32).copy()
        y=room(x, ir)
        y*=np.sqrt((x**2).mean()/((y**2).mean()+1e-12))   # exact loudness parity with dry
        encode(y, mp3); done+=1
    print(f'{base}: {done} voices roomed ({venue})')
if __name__=='__main__': main()
