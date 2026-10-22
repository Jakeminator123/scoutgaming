fetch('klipp.json').then(r=>r.json()).then(D=>{const list=document.getElementById('list');
for(const [dir,files] of Object.entries(D)){
  const d=document.createElement('details');d.dataset.k=(dir+' '+files.map(f=>f[0]).join(' ')).toLowerCase();
  d.innerHTML=`<summary>${dir} (${files.length})</summary><div class="g"></div>`;
  d.addEventListener('toggle',()=>{const g=d.querySelector('.g');if(!d.open||g.childElementCount)return;
    for(const [f,t] of files){const c=document.createElement('div');c.className='c';
      const v=document.createElement('video');v.controls=true;v.preload='metadata';v.playsInline=true;v.src='/'+dir+'/'+f;
      const n=document.createElement('div');n.className='n';n.textContent=f;c.append(v,n);
      if(t){const x=document.createElement('div');x.className='t';x.textContent=typeof t==='string'?t:JSON.stringify(t);c.append(x);}
      g.append(c);}});
  list.append(d);}
const qi=document.getElementById('q');const f=()=>{const q=qi.value.toLowerCase().trim();
  for(const d of list.children)d.style.display=!q||d.dataset.k.includes(q)?'':'none';};
qi.value=qi.value||new URLSearchParams(location.search).get('q')||'';qi.addEventListener('input',f);f();
});