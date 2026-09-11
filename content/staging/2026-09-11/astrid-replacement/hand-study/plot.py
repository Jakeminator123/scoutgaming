from pathlib import Path
import json
r=Path(__file__).resolve().parent; data=json.loads((r/'points.json').read_text());p=[v['p'] for v in data['points'] if v['p'][0]<0]
# A geometric projection, not a modified source image.
x0,x1=-.48,-.27;z0,z1=.72,1.08; w,h=700,1000
sx=lambda x:70+(x-x0)/(x1-x0)*560
sy=lambda z:940-(z-z0)/(z1-z0)*870
lines=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}"><rect width="100%" height="100%" fill="#101416"/>']
for j in range(8):
 z=.72+j*.05; y=sy(z);lines.append(f'<path d="M70 {y}H630" stroke="#354045"/><text x="4" y="{y}" fill="white">{z:.2f}</text>')
for j in range(5):
 x=-.47+j*.05; xx=sx(x);lines.append(f'<path d="M{xx} 40V940" stroke="#354045"/><text x="{xx}" y="978" fill="white">{x:.2f}</text>')
for x,y,z in p:lines.append(f'<circle cx="{sx(x):.2f}" cy="{sy(z):.2f}" r="1.2" fill="#e6ccae" opacity=".7"/>')
lines.append('</svg>');(r/'right-hand-projection.svg').write_text('\n'.join(lines))
