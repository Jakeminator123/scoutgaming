import pathlib
exec(open(pathlib.Path(__file__).with_name('bridge-check.py')).read().split('a=get')[0])
ss=[];rows=[]
for key in ['idle-1_idle_idle','idle-1_speak_greeting','idle-1_actions_action-deal','idle-1_actions_action-return']:
 p=r/f'web/public/dealers/astrid/streams/{key}.h264';c=cv2.VideoCapture(str(p));frames=[]
 while True:
  ok,x=c.read()
  if not ok:break
  frames.append(x)
 rows.append({'path':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'frames':len(frames),'shape':list(frames[0].shape)})
 for n in [0,len(frames)-1]:
  im=Image.fromarray(cv2.cvtColor(frames[n],cv2.COLOR_BGR2RGB));im.thumbnail((480,480));ss.append((key,n,im))
s=Image.new('RGB',(1920,1020));d=ImageDraw.Draw(s)
for k,(key,n,im) in enumerate(ss):
 xx=k%4*480;yy=k//4*510;s.paste(im,(xx,yy+25));d.text((xx,yy),f'{key} {n}',fill='white')
s.save(o/'actual-speech-actions.jpg',quality=94);(o/'actual-streams.json').write_text(json.dumps(rows,indent=2));print(rows)
