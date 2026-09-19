import numpy as np,wave,json
def rd(p):
    w=wave.open(p);n=w.getnframes();a=np.frombuffer(w.readframes(n),dtype=np.int16).astype(np.float64);return a,w.getframerate()
a,sr=rd('take-audio.wav');b,_=rd('greeting.wav')
n=len(a)+len(b);A=np.fft.rfft(a,n);B=np.fft.rfft(b,n);r=np.fft.irfft(A*np.conj(B),n)
lag=int(np.argmax(r));
if lag>n//2:lag-=n
# normalised peak
peak=r.max()/np.sqrt((a**2).sum()*(b**2).sum())
# onset: first sample above -40 dBFS in each
def onset(x):
    thr=32768*10**(-40/20);i=np.argmax(np.abs(x)>thr);return i
out={'takeSamples':len(a),'greetingSamples':len(b),'sampleRate':sr,'lagSamples':lag,'lagSeconds':lag/sr,'normalisedPeak':round(float(peak),4),
 'takeOnsetSec':onset(a)/sr,'greetingOnsetSec':onset(b)/sr,'takeDurationSec':len(a)/sr,'greetingDurationSec':len(b)/sr}
print(json.dumps(out,indent=1));json.dump(out,open('audio-sync.json','w'),indent=1)
