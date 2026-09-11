"""Read-only connected digit regions on welded original canonical topology."""
import bpy,json,os,heapq,hashlib
import numpy as np
from pathlib import Path
from mathutils.kdtree import KDTree
base=Path(__file__).resolve().parent
src=base/'rig-corrected-transfer/original-pbr-body-rig.blend'
out=base/'digit-topology';out.mkdir(exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(src))
m=max((o for o in bpy.data.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices))
p=np.array([m.matrix_world@v.co for v in m.data.vertices]);n=len(p)
parent=list(range(n))
def root(i):
 while parent[i]!=i:parent[i]=parent[parent[i]];i=parent[i]
 return i
kd=KDTree(n)
for i,v in enumerate(p):kd.insert(v,i)
kd.balance()
for i,v in enumerate(p):
 for _,j,d in kd.find_range(v,.000003):
  a,b=root(i),root(j)
  if a!=b:parent[max(a,b)]=min(a,b)
rep=[root(i) for i in range(n)];members={}
for i,r in enumerate(rep):members.setdefault(r,[]).append(i)
adj={r:set() for r in members}
for e in m.data.edges:
 a,b=map(lambda i:rep[i],e.vertices)
 if a!=b:adj[a].add(b);adj[b].add(a)
def components(allowed):
 todo=set(allowed);cs=[]
 while todo:
  seed=todo.pop();stack=[seed];c={seed}
  while stack:
   a=stack.pop()
   for b in adj[a]:
    if b in todo:todo.remove(b);c.add(b);stack.append(b)
  cs.append(c)
 return sorted(cs,key=len,reverse=True)
land=json.loads((base.parent/'hand-study/measured-landmark-depths.json').read_text())
result={'source':str(src),'sourceSha256':hashlib.sha256(src.read_bytes()).hexdigest(),'vertexCount':n,'weldToleranceMetres':.000003,'hands':{}}
for side,sign in [('left',1),('right',-1)]:
 hand={r for r in members if p[r,0]*sign>.28 and .76<p[r,2]<1.02}
 tips={d:np.array(a[-1]['xyz']) for d,a in land[side].items()}
 trials=[];chosen=None
 for z in [.870,.869,.868,.867,.866,.865,.864,.863,.862,.860,.858]:
  cs=components({r for r in hand if p[r,2]<z})
  labels={d:min(range(len(cs)),key=lambda k:min(np.linalg.norm(p[r]-v) for r in cs[k])) for d,v in tips.items() if d!='Thumb'}
  trials.append({'z':z,'componentSizes':[len(c) for c in cs[:10]],'tipComponents':labels})
  if len(set(labels.values()))==4 and min(len(cs[k]) for k in labels.values())>20:
   chosen=(z,{d:cs[k] for d,k in labels.items()});break
 assert chosen,(side,trials)
 regions=chosen[1];thumbtrials=[]
 xyz=[np.array(a['xyz']) for a in land[side]['Thumb']];direction=xyz[2]-xyz[1];direction/=np.linalg.norm(direction)
 for t in [0,.1,.2,.3,.4,.5,.6,.7,.8,1.0]:
  origin=xyz[1]*(1-t)+xyz[2]*t
  cs=components({r for r in hand if np.dot(p[r]-origin,direction)>0})
  ti=min(range(len(cs)),key=lambda k:min(np.linalg.norm(p[r]-tips['Thumb']) for r in cs[k]))
  thumb=cs[ti];minother=min(np.linalg.norm(p[r]-v) for r in thumb for d,v in tips.items() if d!='Thumb')
  thumbtrials.append({'fractionMCPtoIP':t,'componentSize':len(thumb),'nearestOtherTipMm':minother*1000})
  if minother>.025 and len(thumb)>20:
   regions['Thumb']=thumb;thumbcut={'origin':origin.tolist(),'normal':direction.tolist(),'fractionMCPtoIP':t};break
 assert 'Thumb' in regions,(side,thumbtrials)
 output={}
 for digit,region in regions.items():
  boundary={r for r in region if any(v not in region for v in adj[r])}
  distances={r:0. for r in boundary};q=[(0.,r) for r in boundary];heapq.heapify(q)
  while q:
   d,a=heapq.heappop(q)
   if d>distances[a]:continue
   for b in adj[a]&region:
    nd=d+float(np.linalg.norm(p[a]-p[b]))
    if nd<distances.get(b,float('inf')):distances[b]=nd;heapq.heappush(q,(nd,b))
  ids=sorted(i for r in region for i in members[r])
  output[digit]={'vertexIds':ids,'boundaryVertexIds':sorted(i for r in boundary for i in members[r]),'inwardGeodesicMetres':[distances[rep[i]] for i in ids],'weldedVertexCount':len(region)}
 result['hands'][side]={'fingerCutZ':chosen[0],'thumbCutPlane':thumbcut,'fingerCutTrials':trials,'thumbCutTrials':thumbtrials,'regions':output,'handVertices':{str(i):p[i].tolist() for r in hand for i in members[r]}}
(out/'connected-regions.json').write_text(json.dumps(result))
print(json.dumps({s:{'z':v['fingerCutZ'],'thumbPlane':v['thumbCutPlane'],'sizes':{d:len(r['vertexIds']) for d,r in v['regions'].items()},'trials':v['thumbCutTrials']} for s,v in result['hands'].items()}),flush=True)
os._exit(0)
