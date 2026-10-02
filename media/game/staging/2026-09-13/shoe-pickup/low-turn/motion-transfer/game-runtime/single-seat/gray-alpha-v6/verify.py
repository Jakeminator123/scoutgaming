from build import *
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
proc=subprocess.Popen(['/opt/homebrew/bin/ffmpeg','-v','error','-threads','1','-i',str(out),'-f','rawvideo','-pix_fmt','rgb24','-'],stdout=subprocess.PIPE)
rows=[]
for row in data['ledger']:
 rgb,r,rear,front=original(row);raw=proc.stdout.read(w*h*9);assert len(raw)==w*h*9;a=np.frombuffer(raw,np.uint8).reshape(h*3,w,3);b=a[h:2*h,:,0]/255;f=a[2*h:,:,0]/255;alpha=f+(1-f)*b
 def err(a,b):
  d=np.abs(a-b);return {'mean':float(d.mean()),'max':float(d.max())}
 n=row['sequenceFrame'];rows.append({'frame':row['frame'],'sequenceFrame':n,'rgbSHA256':sha(source/'actor-rgb'/f'{n:04d}.png'),'rgSHA256':sha(source/'actor-rg'/f'{n:04d}.png'),'rgbError':err(rgb/255,a[:h]/255),'rearError':err(rear,b),'frontError':err(front,f),'combinedAlphaError':err(r,alpha)})
assert not proc.stdout.read(1);assert proc.wait()==0;assert len(rows)==89
receipt={'status':'UNAPPROVED v6 RG / v5 geometry selectable derivative','outputSHA256':sha(out),'bytes':out.stat().st_size,'sourceReceiptSHA256':sha(source/'receipt.json'),'mappingReceiptSHA256':sha(mappingSource),'sourceSha256':sha(source/'receipt.json'),'crop':[x,y,w,h],'layout':'RGB top, grayscale rear middle, grayscale front bottom','formula':'front=min(R,G); rear=(R-front)/(1-front), rear=0 atfront1, beforeencoding','frameCount':89,'fps':60,'limits':'Lossy High420 CRF14, no smoothness or visual approval; original RGB pixels used without modification before encoding. V6 inherited masks still have known source/background defects.','rows':rows}
(here/'receipt.json').write_text(json.dumps(receipt,indent=2));print(json.dumps({k:v for k,v in receipt.items()if k!='rows'},indent=2))
