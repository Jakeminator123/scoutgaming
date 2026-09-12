// Private in-game evidence controls. Captures the live WebGL canvas; no game API.
const panel=document.createElement('div');
panel.style.cssText='position:fixed;z-index:99999;right:18px;top:120px;display:flex;gap:6px;max-width:340px;flex-wrap:wrap;padding:8px;background:#101611;color:#e5e5d8;border:1px solid #a8b35c;border-radius:8px;font:12px sans-serif';
const title=document.createElement('span');title.textContent='Upright pose study · likeness unfinished';title.style.width='100%';panel.append(title);
function button(label,fn){const b=document.createElement('button');b.textContent=label;b.style.cssText='padding:8px;color:#d6ff3a;background:#142116;border:1px solid #7c8647;border-radius:5px;cursor:pointer';b.onclick=fn;panel.append(b);return b;}
async function save(blob,extension){try{const response=await fetch('http://127.0.0.1:4207/frame',{method:'POST',headers:{'Content-Type':blob.type},body:blob});if(!response.ok)throw new Error('Evidence write failed '+response.status);const result=await response.json();title.textContent='Saved '+result.file+' · '+document.visibilityState;}catch(error){title.textContent=error.message;}}
window.addEventListener('candidate-frame',event=>{save(event.detail,'.png');title.textContent='Rejected model capture · page '+document.visibilityState+' · face animation pending';});
button('Save rendered frame',()=>window.dispatchEvent(new Event('candidate-render-now')));
let recorder,stream,parts=[];
const record=button('Record silent 3D proof',()=>{if(recorder?.state==='recording'){recorder.stop();record.textContent='Record silent 3D proof';return;}parts=[];stream=document.querySelector('#table-canvas').captureStream(30);recorder=new MediaRecorder(stream,{mimeType:MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':'video/webm'});recorder.ondataavailable=e=>{if(e.data.size)parts.push(e.data)};recorder.onstop=()=>{save(new Blob(parts,{type:recorder.mimeType}),'-silent.webm');stream.getTracks().forEach(t=>t.stop());};recorder.start();record.textContent='Stop and save proof';title.textContent='Recording actual 3D canvas · silent';});
document.body.append(panel);
