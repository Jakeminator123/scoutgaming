const DEALERS={astrid:{name:'Astrid',cut:'assets/cut-astrid.png',mask:'assets/felt-mask-astrid.png'},dragge:{name:'Dragge',cut:'assets/cut-dragge.png',mask:'assets/felt-mask-dragge.png'},paow:{name:'Paow',cut:'assets/cut-paow.png',mask:'assets/felt-mask-dragge.png'},marten:{name:'Mårten',cut:'assets/cut-marten.png',mask:'assets/felt-mask-dragge.png'}};
const ROOMS={darkhall:'Dark Hall',mahogany:'Mahogany Privé',golden:'Golden Salon',azure:'Azure Venue'};
const FELTS={prive:{name:'Privé',c:null},emerald:{name:'Emerald Club',c:'#125c43'},midnight:{name:'Midnight',c:'#213e70'},burgundy:{name:'Burgundy',c:'#70253c'},custom:{name:'Custom',c:null}};
const LANGS={en:{name:'English',tts:'en-GB',line:'Welcome to the table. Place your bets.'},es:{name:'Español',tts:'es-ES',line:'Bienvenidos a la mesa. Hagan sus apuestas.'},fr:{name:'Français',tts:'fr-FR',line:'Bienvenue à la table. Faites vos jeux.'},sv:{name:'Svenska',tts:'sv-SE',line:'Välkommen till bordet. Placera era insatser.'},zh:{name:'中文',tts:'zh-CN',line:'欢迎来到牌桌，请下注。'}};
const LIMITS={casual:{name:'Casual',range:'$1 – $500',bal:'$500.00',chips:[1,5,10,25,50,100]},prive:{name:'Privé',range:'$5 – $2,000',bal:'$1,000.00',chips:[5,10,25,50,100,500]},high:{name:'High Roller',range:'$100 – $25,000',bal:'$50,000.00',chips:[100,500,1000,5000,10000,25000]}};
const CHIP={1:['#e8e2d4','#a9a294','#5a554c','#1c1a16'],5:['#1b7866','#0e4138'],10:['#b88441','#5d3c1c'],25:['#c55b42','#713227'],50:['#a85c9e','#572c56'],100:['#424a51','#181c20'],500:['#7852b3','#402957'],1000:['#d6b46a','#7d6230','#fff5da','#201c13'],5000:['#2f6496','#163252'],10000:['#9a3443','#4d1621'],25000:['#26282c','#0b0c0e','#dbc18a','#dbc18a']};
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const KEY='scout-bj-demo';
let st=Object.assign({screen:'login',email:'',dealer:'astrid',room:'darkhall',felt:'prive',custom:'#7a5a2a',lang:'en',limit:'prive',name:'Privé Blackjack',open:'dealer',sound:true,logo:'',logoName:'',logoPos:'both'},JSON.parse(localStorage.getItem(KEY)||'{}'));
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(st))}catch(e){}};
const fmt=v=>v>=1000?(v/1000)+'K':String(v);
function chipEl(v){const e=document.createElement('span');e.className='chip';const c=CHIP[v];e.style.setProperty('--c',c[0]);e.style.setProperty('--s',c[1]);if(c[2])e.style.setProperty('--r',c[2]);if(c[3])e.style.setProperty('--t',c[3]);e.textContent=fmt(v);return e}
$$('[data-chips]').forEach(m=>LIMITS[m.dataset.chips].chips.forEach(v=>m.append(chipEl(v))));

function swapImg(img,src){if(img.getAttribute('src')===src)return;img.classList.add('fading');const n=new Image();n.onload=()=>setTimeout(()=>{img.src=src;img.classList.remove('fading')},180);n.src=src}
const maskCache={};
function paintFelt(src,fc){['#feltC','#feltS'].forEach(s=>$(s).classList.toggle('off',!fc));if(!fc)return;
const draw=img=>{['#feltC','#feltS'].forEach(s=>{const x=$(s).getContext('2d');x.globalCompositeOperation='source-over';x.clearRect(0,0,720,1280);x.drawImage(img,0,0,720,1280);x.globalCompositeOperation='source-in';x.fillStyle=fc;x.fillRect(0,0,720,1280)})};
if(maskCache[src]?.complete)draw(maskCache[src]);else{const i=maskCache[src]=new Image();i.onload=()=>draw(i);i.src=src}}
function feltColor(){return st.felt==='custom'?st.custom:FELTS[st.felt].c}
function render(){
const d=DEALERS[st.dealer],L=LIMITS[st.limit],fc=feltColor();
swapImg($('#roomImg'),'assets/rooms/'+st.room+'-720.png');swapImg($('#dealerImg'),d.cut);
paintFelt(d.mask,fc);
$('#customSw').style.background=st.felt==='custom'?st.custom:'';
$('#ovName').textContent=st.name||'Blackjack';$('#ovRange').textContent=L.range;$('#ovBal').textContent=L.bal;
$('#ovBadge').textContent=d.name+' · AI dealer · '+st.lang.toUpperCase();
const oc=$('#ovChips');oc.innerHTML='';L.chips.forEach((v,i)=>{const c=chipEl(v);if(i===0)c.classList.add('sel');oc.append(c)});
const vals={dealer:d.name,room:ROOMS[st.room],felt:FELTS[st.felt].name,lang:LANGS[st.lang].name,limit:L.name+' · '+L.range};
for(const k in vals)$('[data-v="'+k+'"]').textContent=vals[k];
$$('.opt[data-k]').forEach(o=>o.setAttribute('aria-checked',String(st[o.dataset.k]===o.dataset.val)));
const order=['dealer','room','felt','lang','limit','brand'];
$$('.step').forEach(s=>{s.classList.toggle('open',s.dataset.step===st.open);s.classList.toggle('done',order.indexOf(s.dataset.step)<order.indexOf(st.open))});
$('#rsDealer').textContent=d.name;$('#rsRoom').textContent=ROOMS[st.room];$('#rsFelt').textContent=FELTS[st.felt].name;$('#rsLang').textContent=LANGS[st.lang].name;$('#rsLimit').textContent=L.name+' · '+L.range;
const lg=st.logo,fl=$('#feltLogo'),hl=$('#hdrLogo');[fl,hl].forEach(i=>{if(lg&&i.getAttribute('src')!==lg)i.src=lg});fl.hidden=!lg||st.logoPos==='header';$('#stage').classList.toggle('has-felt-logo',!fl.hidden);hl.hidden=!lg||st.logoPos==='felt';
$('#drop').classList.toggle('has',!!lg);if(lg){$('#logoThumb').src=lg;$('#logoName').textContent=st.logoName}
const posName={both:'Felt + header',felt:'Felt',header:'Header'}[st.logoPos];$('[data-v="brand"]').textContent=lg?posName:'No logo';$('#rsLogo').textContent=lg?st.logoName+' · '+posName:'None';
$('#pnSpec').textContent=d.name+' · '+ROOMS[st.room]+' · '+L.name;$('#readyName').textContent=st.name||'Blackjack';
$('#shareUrl').textContent=st.slug?location.host+'/t/'+st.slug:location.host+'/t/'+((st.name||'blackjack').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'table');
const em=st.email||'demo@scoutgaming.com';$('#userEmail').textContent=$('#userEmail2').textContent=em;$('#avatar').textContent=$('#avatar2').textContent=em[0];
save()}
function go(screen){st.screen=screen;$$('.screen').forEach(s=>s.classList.toggle('on',s.id===screen));
const stage=$('#stage');if(screen==='ready')$('#readyHome').append(stage);else if(screen==='play'){$('#playHome').append(stage);$('#playBg').style.backgroundImage='url(assets/rooms/'+st.room+'-720.png)'}else $('#previewHome').prepend(stage);render()}
// The languages each dealer has recorded. Any other language plays the English greeting, as the table does.
// Mårten has no voice yet: his greeting is shown as text only.
const VOICES={astrid:['en','es','fr','zh'],dragge:['sv','en'],paow:['sv','en'],marten:[]};
const voiceLang=(dealer,lang)=>(VOICES[dealer]??['en']).includes(lang)?lang:'en';
function greetingClip(dealer,lang){lang=voiceLang(dealer,lang);
if(dealer==='astrid')return lang==='en'?'/media/repliker/greeting_1.mp4':`/media/repliker-${lang}/greeting_1_${lang}.mp4`;
return `/media/dealers/${dealer}/repliker/${lang}/greeting_1.mp4`}
let voice;
function speak(line,tts,force,done){if(voiceLang(st.dealer,st.lang)!==st.lang)line=LANGS.en.line;const sp=$('#speaking');sp.textContent='“'+line+'”';sp.classList.add('on');clearTimeout(sayT);const end=()=>{sp.classList.remove('on');done&&done()};
const clip=greetingClip(st.dealer,st.lang);voice?.pause();
if(!VOICES[st.dealer]?.length){sayT=setTimeout(end,4200);return}
if((force||st.sound)&&clip){voice=new Audio(clip);voice.onended=()=>setTimeout(end,300);voice.play().catch(()=>{});sayT=setTimeout(end,8000);return}
if((force||st.sound)&&'speechSynthesis' in window){speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(line);u.lang=tts;u.rate=.95;u.onend=()=>setTimeout(end,400);speechSynthesis.speak(u)}sayT=setTimeout(end,4200)}
function syncSound(){const b=$('#soundBtn');b.setAttribute('aria-pressed',String(st.sound));b.setAttribute('aria-label',st.sound?'Turn sound off':'Turn sound on')}

// login
$('#pwToggle').onclick=()=>{const p=$('#pw');p.type=p.type==='password'?'text':'password';$('#pwToggle').textContent=p.type==='password'?'Show':'Hide'};
// Sign-in checks the back office accounts on the server; nothing is trusted from this browser.
$('#loginForm').onsubmit=async e=>{e.preventDefault();const em=$('#email').value.trim(),pw=$('#pw').value;
$('#fEmail').classList.toggle('err',!em);$('#fPw').classList.toggle('err',!pw);
if(!em||!pw){$('#formErr').textContent='Enter your back office login and password.';return}
$('#formErr').textContent='Signing in…';
try{const r=await fetch('/api/studio/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user:em,pass:pw})});const me=await r.json();
if(!r.ok||!me.user){$('#fEmail').classList.add('err');$('#fPw').classList.add('err');$('#formErr').textContent=me.error||'Sign-in failed.';return}
$('#pw').value='';$('#formErr').textContent='';st.email=me.user;go('builder')}catch{$('#formErr').textContent='Sign-in is unavailable. Try again shortly.'}};
let art=0;setInterval(()=>{if(st.screen!=='login')return;art^=1;$('#artA').style.opacity=art?0:1;$('#artB').style.opacity=art?1:0;
$('#capRoom').textContent=art?'Mahogany Privé':'Golden Salon';$('#capDealer').textContent=(art?'Dragge':'Astrid')+' · AI dealer';$$('.login-dots i').forEach((d,i)=>d.classList.toggle('on',i===art))},6000);
$('#signOut').onclick=async()=>{await fetch('/api/studio/logout',{method:'POST'}).catch(()=>{});st.email='';go('login')};

// builder
const order=['dealer','room','felt','lang','limit','brand'];
$$('.step-h').forEach(h=>h.onclick=()=>{const s=h.parentElement.dataset.step;st.open=st.open===s?'':s;render()});
$$('.next').forEach(b=>b.onclick=()=>{const s=b.closest('.step').dataset.step;st.open=order[order.indexOf(s)+1];render()});
$$('.opt[data-k]').forEach(o=>{const pick=e=>{if(e.target.closest('.play'))return;st[o.dataset.k]=o.dataset.val;render()};o.addEventListener('click',pick);o.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pick(e)}})});
function setLogo(src,name){const i=new Image();i.crossOrigin='anonymous';i.onload=()=>{let w=i.naturalWidth||600,hh=i.naturalHeight||300;const k=Math.min(1,600/Math.max(w,hh));w=Math.round(w*k);hh=Math.round(hh*k);let out=src;try{const c=document.createElement('canvas');c.width=w;c.height=hh;c.getContext('2d').drawImage(i,0,0,w,hh);out=c.toDataURL('image/png');
  // The server takes logos under 400 KB: a detailed PNG falls back to WebP, then to a smaller size.
  if(out.length>380000)out=c.toDataURL('image/webp',.9);
  if(out.length>380000){const d=document.createElement('canvas'),k2=360/Math.max(w,hh);d.width=Math.round(w*k2);d.height=Math.round(hh*k2);d.getContext('2d').drawImage(i,0,0,d.width,d.height);out=d.toDataURL('image/webp',.85)}}catch(e){}st.logo=out;st.logoName=name;render()};i.onerror=()=>{$('#logoUrl').classList.add('bad')};i.src=src}
$('#logoFile').addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>setLogo(r.result,f.name);r.readAsDataURL(f);e.target.value=''});
const dz=$('#drop');['dragenter','dragover'].forEach(t=>dz.addEventListener(t,e=>{e.preventDefault();dz.classList.add('over')}));['dragleave','drop'].forEach(t=>dz.addEventListener(t,()=>dz.classList.remove('over')));
dz.addEventListener('drop',e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f&&f.type.startsWith('image/')){const r=new FileReader();r.onload=()=>setLogo(r.result,f.name);r.readAsDataURL(f)}});
$('#logoRemove').addEventListener('click',e=>{e.preventDefault();e.stopPropagation();st.logo='';st.logoName='';render()});
$('#logoUrlBtn').onclick=()=>{const u=$('#logoUrl').value.trim();$('#logoUrl').classList.remove('bad');if(!/^https?:\/\//.test(u)){$('#logoUrl').classList.add('bad');return}setLogo(u,u.split('/').pop().split('?')[0]||'logo');$('#logoUrl').value=''};
$('#logoUrl').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('#logoUrlBtn').click()}});
$('#customFelt').addEventListener('input',e=>{st.custom=e.target.value;st.felt='custom';render()});
$('#tableName').addEventListener('input',e=>{st.name=e.target.value;render()});
$$('.play').forEach(b=>b.onclick=()=>{const l=LANGS[b.dataset.say];st.lang=b.dataset.say;render();
$$('.play').forEach(p=>p.classList.remove('on'));b.classList.add('on');
speak(l.line,l.tts,true,()=>b.classList.remove('on'))});
$('#soundBtn').onclick=()=>{st.sound=!st.sound;if(!st.sound){voice?.pause();if('speechSynthesis' in window)speechSynthesis.cancel()}syncSound();save()};
$('#playBtn').onclick=()=>{if(st.slug)location.href='/t/'+st.slug};
const leave=()=>{if('speechSynthesis' in window)speechSynthesis.cancel();go('ready')};
$('#exitBtn').onclick=leave;$('#backBuild').onclick=()=>{if('speechSynthesis' in window)speechSynthesis.cancel();go('builder')};document.addEventListener('keydown',e=>{if(e.key==='Escape'&&st.screen==='play')leave()});

// create
const loaded=src=>new Promise(ok=>{const i=new Image();i.onload=i.onerror=()=>ok();i.src=src});
$('#createBtn').onclick=async()=>{const L=$('#launch');const sp=$$('.launch-steps span');sp.forEach(s=>s.classList.remove('done'));L.classList.add('on');
const fail=m=>{L.classList.remove('on');alertCreate(m)};
let t;try{const r=await fetch('/api/studio/table',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:st.name||'Blackjack',dealer:st.dealer,room:st.room,felt:st.felt,custom:st.custom,lang:st.lang,limit:st.limit,logoPos:st.logoPos,logo:st.logo||null,logoName:st.logo?st.logoName:null})});
t=await r.json();if(r.status===401){L.classList.remove('on');st.email='';go('login');$('#formErr').textContent='Sign in to create a table.';return}if(!r.ok)return fail(t.error||'Could not create the table')}catch{return fail('Could not reach the server')}
st.slug=t.slug;save();sp[0].classList.add('done');
await loaded(DEALERS[st.dealer].cut);sp[1].classList.add('done');
const clip=greetingClip(st.dealer,st.lang);if(clip)await fetch(clip,{headers:{Range:'bytes=0-65535'}}).catch(()=>{});sp[2].classList.add('done');
setTimeout(()=>{go('ready');L.classList.remove('on')},350)};
function alertCreate(m){$('#createBtn').textContent=m;setTimeout(()=>$('#createBtn').textContent='Create table →',2600)}
$('#editBtn').onclick=()=>go('builder');
$('#newBtn').onclick=()=>{Object.assign(st,{slug:'',dealer:'astrid',room:'darkhall',felt:'prive',lang:'en',limit:'prive',name:'Privé Blackjack',open:'dealer'});$('#tableName').value=st.name;go('builder')};
$('#copyBtn').onclick=()=>{navigator.clipboard?.writeText('https://'+$('#shareUrl').textContent).catch(()=>{});$('#copyBtn').textContent='Copied';setTimeout(()=>$('#copyBtn').textContent='Copy link',1600)};

let sayT;$('#tableName').value=st.name;$('#customFelt').value=st.custom;syncSound();
// Every visit starts at the sign-in. Only the game's "Back to Table Studio" (?resume) reopens where you were,
// and only with a live back office session.
const was=st.screen;st.email='';go('login');
if(new URLSearchParams(location.search).has('resume'))fetch('/api/studio/session').then(r=>r.ok?r.json():{}).then(me=>{if(me.user){st.email=me.user;go(was&&was!=='login'?was:'builder')}}).catch(()=>{});
