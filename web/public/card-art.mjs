// One face bitmap for the attached 3D card and its settled table card. Keeping
// the paper, symbols and corners identical prevents a visible art swap at land.
const faces=new Map();
export function cardFaceArt(card) {
  const key=`${card.r}${card.s}`;
  if(faces.has(key))return faces.get(key);
  const canvas=document.createElement('canvas');canvas.width=184;canvas.height=264;
  const x=canvas.getContext('2d');
  x.fillStyle='#f7f5ee';x.beginPath();x.roundRect(0,0,184,264,24);x.fill();
  x.fillStyle=card.s==='♥'||card.s==='♦'?'#c22b2b':'#222';
  x.font='700 48px Inter, Arial, sans-serif';x.textAlign='center';x.textBaseline='top';
  const cornerWidth=Math.max(x.measureText(card.r).width,x.measureText(card.s).width);
  x.fillText(card.r,20+cornerWidth/2,12);x.fillText(card.s,20+cornerWidth/2,60);
  x.font='700 80px Inter, Arial, sans-serif';x.textAlign='right';x.textBaseline='bottom';
  x.fillText(card.s,160,248);
  const art={canvas,url:canvas.toDataURL()};faces.set(key,art);return art;
}
