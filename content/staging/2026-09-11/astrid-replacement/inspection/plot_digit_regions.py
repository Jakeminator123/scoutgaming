"""Read-only orthographic plots of connected source digit labels."""
from pathlib import Path
import json
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
base=Path(__file__).resolve().parent/'digit-topology'
d=json.loads((base/'connected-regions.json').read_text())
fig,axes=plt.subplots(1,2,figsize=(10,7),layout='constrained')
colors={'Thumb':'#ff8e38','Index':'#ee586b','Middle':'#48afc4','Ring':'#668bdd','Pinky':'#bd7cc4'}
for ax,(side,h) in zip(axes,d['hands'].items()):
 p={int(k):np.array(v) for k,v in h['handVertices'].items()}
 cloud=np.array(list(p.values()));ax.scatter(cloud[:,0],cloud[:,2],s=2,c='#cccccc',alpha=.5)
 for digit,r in h['regions'].items():
  points=np.array([p[i] for i in r['vertexIds']]);ax.scatter(points[:,0],points[:,2],s=7,c=colors[digit],label=digit)
  boundary=np.array([p[i] for i in r['boundaryVertexIds']]);ax.scatter(boundary[:,0],boundary[:,2],s=10,c='#111111')
 ax.set_aspect('equal');ax.set_ylim(.785,.98);ax.set_title(side.title()+' hand — connected distal regions');ax.set_xlabel('Source X (m)');ax.set_ylabel('Source Z (m)');ax.legend(loc='upper '+('left' if side=='left' else 'right'),fontsize=8)
fig.suptitle('Original geometry unchanged • black points are cut boundaries • grey remains hand')
fig.savefig(base/'connected-regions.png',dpi=160)
