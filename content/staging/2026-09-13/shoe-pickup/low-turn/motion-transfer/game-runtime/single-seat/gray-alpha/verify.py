from build import *
def decoder(path,height):return subprocess.Popen(['/opt/homebrew/bin/ffmpeg','-v','error','-threads','1','-i',str(path),'-f','rawvideo','-pix_fmt','rgb24','-'],stdout=subprocess.PIPE)
def stats(a,b):
 e=np.abs(a-b);return {'mean':float(e.mean()),'max':float(e.max()),'p99':float(np.quantile(e,.99))}
if __name__=='__main__':
 paths={'gray':out,'packedRGHigh':source/'web-surface/actor-cropped-high-crf14-3x60.mp4'};pipes={k:decoder(v,h*(3 if k=='gray' else 2)) for k,v in paths.items()};rows=[]
 for row in data['ledger']:
  rgb,r,rear,front=original(row);record={'frame':row['frame']}
  for k,proc in pipes.items():
   height=h*(3 if k=='gray' else 2);a=np.frombuffer(proc.stdout.read(w*height*3),np.uint8).reshape(height,w,3);crgb=a[:h].astype(np.float32)/255
   if k=='gray':b=a[h:2*h,:,0].astype(np.float32)/255;f=a[2*h:,:,0].astype(np.float32)/255
   else:
    rr=a[h:,:,0].astype(np.float32)/255;gg=a[h:,:,1].astype(np.float32)/255;f=np.minimum(rr,gg);b=(rr-f)/np.maximum(1-f,.00001)
   combined=f+(1-f)*b;truth=rgb.astype(np.float32)/255
   record[k]={'rearAlpha':stats(rear,b),'frontAlpha':stats(front,f),'combinedAlpha':stats(r,combined),'rgb':stats(truth,crgb),'blackCompositeRGB':stats(truth*r[:,:,None],crgb*combined[:,:,None]),'layerVisibilityChangedPixels':int(np.count_nonzero(((rear>=.01)|(front>=.01))!=((b>=.01)|(f>=.01))))}
  rows.append(record)
 for p in pipes.values():assert p.wait()==0
 probe=json.loads(subprocess.check_output(['/opt/homebrew/bin/ffprobe','-v','error','-count_frames','-show_entries','stream=profile,pix_fmt,width,height,nb_read_frames,bit_rate','-of','json',str(out)]));summary={}
 for k in paths:
  summary[k]={metric:{'meanAcrossFrames':float(np.mean([r[k][metric]['mean'] for r in rows])),'maxAcrossFrames':max(r[k][metric]['max'] for r in rows)} for metric in ['rearAlpha','frontAlpha','combinedAlpha','rgb','blackCompositeRGB']}
 receipt={'status':'unapproved grayscale-alpha codec experiment, no browser integration','formula':'front=min(R,G); rear=(R-front)/(1-front), rear=0 whenfront=1; derived from original PNG masks before encoding','crop':[x,y,w,h],'layout':'RGB top, grayscale rear middle, grayscale front bottom','sourceReceiptSHA256':hashlib.sha256((source/'web-surface/receipt.json').read_bytes()).hexdigest(),'outputSHA256':hashlib.sha256(out.read_bytes()).hexdigest(),'bytes':out.stat().st_size,'probe':probe,'summary':summary,'rows':rows,'limits':'Lossy CRF14 RGB+alpha. Comparisons all89frames against original PNG source masks; units normalized0..1. Canonical cardcoords1920x1080 unchanged; renderer not implemented. No hardwaredecode or visualacceptance claim.'};(here/'receipt.json').write_text(json.dumps(receipt,indent=2));print(json.dumps({'probe':probe,'bytes':receipt['bytes'],'summary':summary},indent=2))
