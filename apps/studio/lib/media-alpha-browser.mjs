// Browser preflight complements the server's WebM track/payload inspection.
// Three decoded samples are not acceptance of every frame or of the matte edges.
export function alphaPixelEvidence(data) {
  let transparent=0,visible=0;
  for(let i=3;i<data.length;i+=4){if(data[i]<250)transparent++;if(data[i]>5)visible++;}
  if(!transparent||!visible)throw Error('Alfaprovet saknar både synlig dealer och genomskinlig yta. Svart bakgrund eller ett tomt alfaspår räcker inte.');
  return {transparent,visible};
}
export async function inspectAlphaSource(url,contentType,{signal,document:doc=globalThis.document}={}) {
  if(!doc||!['image/png','video/webm'].includes(contentType))throw Error('Alfa behöver avkodas som PNG eller WebM i webbläsaren.');
  signal?.throwIfAborted();
  const isVideo=contentType==='video/webm',element=doc.createElement(isVideo?'video':'img'),canvas=doc.createElement('canvas');
  const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)throw Error('Alfaprovet kunde inte starta.');
  const wait=(event,action)=>new Promise((resolve,reject)=>{
    const finish=error=>{clearTimeout(timer);element.removeEventListener(event,ok);element.removeEventListener('error',bad);signal?.removeEventListener('abort',abort);error?reject(error):resolve();};
    const ok=()=>finish(),bad=()=>finish(Error('Alfafilen kunde inte avkodas.')),abort=()=>finish(signal.reason??Error('Avbrutet alfaprov.'));
    const timer=setTimeout(()=>finish(Error('Alfafilen tog för lång tid att avkoda.')),20000);
    element.addEventListener(event,ok,{once:true});element.addEventListener('error',bad,{once:true});signal?.addEventListener('abort',abort,{once:true});
    try{signal?.throwIfAborted();action();}catch(error){finish(error);}
  });
  try{
    if(isVideo){element.muted=true;element.playsInline=true;element.preload='auto';}
    await wait(isVideo?'loadeddata':'load',()=>{element.src=url;if(isVideo)element.load();});
    const width=isVideo?element.videoWidth:element.naturalWidth,height=isVideo?element.videoHeight:element.naturalHeight;
    if(!width||!height||isVideo&&(!Number.isFinite(element.duration)||element.duration<=0))throw Error('Alfafilen saknar mått eller längd.');
    const scale=Math.min(1,480/width,480/height);
    canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
    const seconds=isVideo?[0,element.duration/2,Math.max(0,element.duration-.1)]:[0],samples=[];
    for(const second of seconds){signal?.throwIfAborted();if(isVideo&&Math.abs(element.currentTime-second)>.001)await wait('seeked',()=>{element.currentTime=second;});context.clearRect(0,0,canvas.width,canvas.height);context.drawImage(element,0,0,canvas.width,canvas.height);samples.push({second,...alphaPixelEvidence(context.getImageData(0,0,canvas.width,canvas.height).data)});}
    return {width,height,samples};
  }finally{if(isVideo)element.pause();element.removeAttribute('src');if(isVideo)element.load();canvas.width=canvas.height=1;}
}
export async function inspectAlphaFile(file,contentType,options={}) {
  const url=URL.createObjectURL(file);try{return await inspectAlphaSource(url,contentType,options);}finally{URL.revokeObjectURL(url);}
}
