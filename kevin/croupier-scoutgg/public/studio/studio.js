// The keyed dealers' rooms carry Emil's shoe like the game's rooms-v2 (Emil 11 Oct: the shoe was wrong for all dealers);
// their felt masks leave that shoe and the dealer himself out (croupier-dealer-dragge/studio_rooms_v2.py). Astrid too (Emil: her old
// room had the shoe over "PAYS 3 TO 2" and her cut-out kept a patch of her own shoe): cut-astrid-v3 drops that patch,
// felt-mask-astrid-v2 = the keyed dealers' v2 table minus her cut-out.
const DEALERS={astrid:{name:'Astrid',cut:'assets/cut-astrid-v3.png',mask:'assets/felt-mask-astrid-v2.png',room:'-v2'},dragge:{name:'Dragan',cut:'assets/cut-dragge.png',mask:'assets/felt-mask-dragge-v2.png',room:'-v2'},paow:{name:'Paow',cut:'assets/cut-paow.png',mask:'assets/felt-mask-paow-v2.png',room:'-v2'},astrid2:{name:'Astrid',cut:'assets/cut-astrid2.png',mask:'assets/felt-mask-astrid2-v2.png',room:'-v2'},marten:{name:'Mårten',cut:'assets/cut-marten.png',mask:'assets/felt-mask-marten-v2.png',room:'-v2'}};
const ROOMS={darkhall:'Dark Hall',mahogany:'Mahogany Privé',golden:'Golden Salon',azure:'Azure Venue'};
const FELTS={prive:{name:'Privé',c:null},emerald:{name:'Emerald Club',c:'#125c43'},midnight:{name:'Midnight',c:'#213e70'},burgundy:{name:'Burgundy',c:'#70253c'},custom:{name:'Custom',c:null}};
const LANGS={en:{name:'English',tts:'en-GB',line:'Welcome to the table. Place your bets.'},es:{name:'Español',tts:'es-ES',line:'Bienvenidos a la mesa. Hagan sus apuestas.'},fr:{name:'Français',tts:'fr-FR',line:'Bienvenue à la table. Faites vos jeux.'},sv:{name:'Svenska',tts:'sv-SE',line:'Välkommen till bordet. Placera era insatser.'},zh:{name:'中文',tts:'zh-CN',line:'欢迎来到牌桌，请下注。'},pt:{name:'Português',tts:'pt-BR',line:'Bem-vindos à mesa. Façam suas apostas.'}};
const LIMITS={casual:{name:'Casual',range:'$1 – $500',bal:'$500.00',chips:[1,5,10,25,50,100]},prive:{name:'Privé',range:'$5 – $2,000',bal:'$1,000.00',chips:[5,10,25,50,100,500]},high:{name:'High Roller',range:'$100 – $25,000',bal:'$50,000.00',chips:[100,500,1000,5000,10000,25000]}};
const CHIP={1:['#e8e2d4','#a9a294','#5a554c','#1c1a16'],5:['#1b7866','#0e4138'],10:['#b88441','#5d3c1c'],25:['#c55b42','#713227'],50:['#a85c9e','#572c56'],100:['#424a51','#181c20'],500:['#7852b3','#402957'],1000:['#d6b46a','#7d6230','#fff5da','#201c13'],5000:['#2f6496','#163252'],10000:['#9a3443','#4d1621'],25000:['#26282c','#0b0c0e','#dbc18a','#dbc18a']};
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const KEY='scout-bj-demo';
let st=Object.assign({screen:'login',email:'',dealer:'astrid2',room:'darkhall',felt:'prive',custom:'#7a5a2a',lang:'en',limit:'prive',name:'Privé Blackjack',open:'dealer',sound:true,logo:'',logoName:'',logoPos:'both'},JSON.parse(localStorage.getItem(KEY)||'{}'));
// Emil 14 Oct: the first Astrid is retired from the builder; Astrid 2.0 is shown as "Astrid" (a saved choice of her moves over)
const RETIRED=['astrid'];if(RETIRED.includes(st.dealer))st.dealer='astrid2';
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
// Emil 11 Oct: only the languages this dealer has recorded are offered (Mårten: Swedish, English, Spanish and Portuguese).
const langs=VOICES[st.dealer]?.length?VOICES[st.dealer]:['en'];if(!langs.includes(st.lang))st.lang=langs.includes('en')?'en':langs[0];
$$('.lang-opt').forEach(o=>{o.hidden=!langs.includes(o.dataset.val)});
const d=DEALERS[st.dealer],L=LIMITS[st.limit],fc=feltColor();
swapImg($('#roomImg'),'assets/rooms/'+st.room+DEALERS[st.dealer].room+'-720.png');swapImg($('#dealerImg'),d.cut);
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
const lg=st.logo,fl=$('#feltLogo'),hl=$('#hdrLogo');showLogo(lg,fl,hl);fl.hidden=!lg||st.logoPos==='header';$('#stage').classList.toggle('has-felt-logo',!fl.hidden);hl.hidden=!lg||st.logoPos==='felt';
$('#drop').classList.toggle('has',!!lg);if(lg){$('#logoThumb').src=lg;$('#logoName').textContent=st.logoName}
const posName={both:'Felt + header',felt:'Felt',header:'Header'}[st.logoPos];$('[data-v="brand"]').textContent=lg?posName:'No logo';$('#rsLogo').textContent=lg?st.logoName+' · '+posName:'None';
$('#pnSpec').textContent=d.name+' · '+ROOMS[st.room]+' · '+L.name;$('#readyName').textContent=st.name||'Blackjack';
$('#shareUrl').textContent=st.slug?location.host+'/t/'+st.slug:location.host+'/t/'+((st.name||'blackjack').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'table');
const em=st.email||'demo@scoutgaming.com';$('#userEmail').textContent=$('#userEmail2').textContent=em;$('#avatar').textContent=$('#avatar2').textContent=em[0];
save()}
function go(screen){st.screen=screen;$$('.screen').forEach(s=>s.classList.toggle('on',s.id===screen));
const stage=$('#stage');if(screen==='ready')$('#readyHome').append(stage);else if(screen==='play'){$('#playHome').append(stage);$('#playBg').style.backgroundImage='url(assets/rooms/'+st.room+DEALERS[st.dealer].room+'-720.png)'}else $('#previewHome').prepend(stage);render()}
// The languages each dealer has recorded. Any other language plays the English greeting, as the table does.
// Mårten has his voice since 14 Oct (sv, en, es). Emil 15 Oct: every dealer speaks Brazilian Portuguese too.
const VOICES={astrid:['en','es','fr','zh'],dragge:['sv','en','pt'],paow:['sv','en','pt'],astrid2:['en','pt'],marten:['sv','en','es','pt']};
const voiceLang=(dealer,lang)=>(VOICES[dealer]??['en']).includes(lang)?lang:'en';
function greetingClip(dealer,lang){lang=voiceLang(dealer,lang);
if(dealer==='astrid')return lang==='en'?'/media/repliker/greeting_1.mp4':`/media/repliker-${lang}/greeting_1_${lang}.mp4`;
return `/media/dealers/${dealer}/repliker/${lang}/greeting_1.mp4`}
let voice;
// Emil 11 Oct: "Hear" lets the dealer say the greeting on film, lip-synced, in the preview (not only its sound). Green-screen
// dealers are keyed like the game (dealer-layer.js); Astrid's lines are shot in her own room, so her cut-out masks them.
const talk=(()=>{const cv=$('#talk'),gl=cv.getContext('webgl',{premultipliedAlpha:true,alpha:true});if(!gl)return null;
const sh=(t,src)=>{const o=gl.createShader(t);gl.shaderSource(o,src);gl.compileShader(o);return o},pr=gl.createProgram();
gl.attachShader(pr,sh(gl.VERTEX_SHADER,'attribute vec2 p;varying vec2 uv;void main(){uv=vec2((p.x+1.)*.5,(1.-p.y)*.5);gl_Position=vec4(p,0.,1.);}'));
gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,`precision mediump float;varying vec2 uv;uniform sampler2D v,m;uniform float keyed;
void main(){vec3 c=texture2D(v,uv).rgb;float a;if(keyed>.5){float g=c.g-max(c.r,c.b);a=clamp((1.-smoothstep(.015,.24,g)-.04)/.92,0.,1.);c.g=min(c.g,max(c.r,c.b)+.02);}
else a=texture2D(m,uv).a;gl_FragColor=vec4(c*a,a);}`));
gl.linkProgram(pr);gl.useProgram(pr);gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
const at=gl.getAttribLocation(pr,'p');gl.enableVertexAttribArray(at);gl.vertexAttribPointer(at,2,gl.FLOAT,false,0,0);
const tex=u=>{const t=gl.createTexture();gl.activeTexture(gl.TEXTURE0+u);gl.bindTexture(gl.TEXTURE_2D,t);for(const[k,x]of[[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,x);return t};
const tv=tex(0),tm=tex(1);gl.uniform1i(gl.getUniformLocation(pr,'v'),0);gl.uniform1i(gl.getUniformLocation(pr,'m'),1);const uk=gl.getUniformLocation(pr,'keyed');
const vid=document.createElement('video');vid.playsInline=true;vid.preload='auto';let busy=false;
function frame(){if(!busy)return;gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tv);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,vid);
gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);cv.classList.add('on');$('#dealerImg').classList.add('fading');vid.requestVideoFrameCallback?vid.requestVideoFrameCallback(frame):requestAnimationFrame(frame)}
function stop(){busy=false;vid.pause();cv.classList.remove('on');$('#dealerImg').classList.remove('fading')}
// Plays the dealer's own clip, keyed or masked by his still; resolves false if it cannot play (no clip, no sound allowed).
function play(src,keyed,maskSrc,onEnd){stop();busy=true;gl.uniform1f(uk,keyed?1:0);
if(!keyed){const im=new Image();im.onload=()=>{gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,tm);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,im)};im.src=maskSrc}
vid.src=src;vid.onended=()=>{stop();onEnd()};vid.onerror=()=>{stop();onEnd(false)};
return vid.play().then(()=>{frame();return true},()=>{stop();return false})}
return{play,stop}})();
function speak(line,tts,force,done){if(voiceLang(st.dealer,st.lang)!==st.lang)line=LANGS.en.line;const sp=$('#speaking');sp.textContent='“'+line+'”';sp.classList.add('on');clearTimeout(sayT);const end=()=>{sp.classList.remove('on');done&&done()};
const clip=greetingClip(st.dealer,st.lang);voice?.pause();talk?.stop();
if(!VOICES[st.dealer]?.length){sayT=setTimeout(end,4200);return}
if((force||st.sound)&&clip&&talk){talk.play(clip,st.dealer!=='astrid',DEALERS[st.dealer].cut,()=>setTimeout(end,300)).then(ok=>{if(!ok){voice=new Audio(clip);voice.onended=()=>setTimeout(end,300);voice.play().catch(()=>{})}});sayT=setTimeout(()=>{talk.stop();end()},12000);return}
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
$('#pw').value='';$('#formErr').textContent='';st.email=me.user;access(me);go('builder')}catch{$('#formErr').textContent='Sign-in is unavailable. Try again shortly.'}};
$('#signOut').onclick=async()=>{await fetch('/api/studio/logout',{method:'POST'}).catch(()=>{});st.email='';go('login')};

// builder
const order=['dealer','room','felt','lang','limit','brand'];
$$('.step-h').forEach(h=>h.onclick=()=>{const s=h.parentElement.dataset.step;st.open=st.open===s?'':s;render()});
$$('.next').forEach(b=>b.onclick=()=>{const s=b.closest('.step').dataset.step;st.open=order[order.indexOf(s)+1];render()});
$$('.opt[data-k]').forEach(o=>{const pick=e=>{if(e.target.closest('.play'))return;st[o.dataset.k]=o.dataset.val;render()};o.addEventListener('click',pick);o.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pick(e)}})});
// Emil 14 Oct: the preview shows the logo exactly as the game will (the same felt-logo.js prepareLogo): own colours in the
// header (a dark logo on a light badge), the felt's printed ink below
let logoLook={src:null,p:null};
function showLogo(lg,fl,hl){if(!lg)return;const set=p=>{if(logoLook.src!==lg)return;hl.src=p?.header??lg;fl.src=p?.felt??lg};
if(logoLook.src===lg){if(logoLook.p)set(logoLook.p);return}logoLook={src:lg,p:null};import('/felt-logo.js').then(m=>m.prepareLogo(lg)).then(p=>{if(logoLook.src===lg){logoLook.p=p;set(p)}}).catch(()=>set(null))}
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
$('#soundBtn').onclick=()=>{st.sound=!st.sound;if(!st.sound){voice?.pause();talk?.stop();if('speechSynthesis' in window)speechSynthesis.cancel()}syncSound();save()};
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
$('#newBtn').onclick=()=>{Object.assign(st,{slug:'',dealer:'astrid2',room:'darkhall',felt:'prive',lang:'en',limit:'prive',name:'Privé Blackjack',open:'dealer'});$('#tableName').value=st.name;go('builder')};
$('#copyBtn').onclick=()=>{navigator.clipboard?.writeText('https://'+$('#shareUrl').textContent).catch(()=>{});$('#copyBtn').textContent='Copied';setTimeout(()=>$('#copyBtn').textContent='Copy link',1600)};

let sayT;$('#tableName').value=st.name;$('#customFelt').value=st.custom;syncSound();
// Every visit starts at the sign-in. Only the game's "Back to Table Studio" (?resume) reopens where you were,
// and only with a live back office session.
// Dealers the back office hides for this account (Kevin 12 Oct: chosen when an aggregator is invited). Their cards go,
// and a hidden dealer that was selected moves to the first one still shown.
function access(me){const hide=Array.isArray(me.hiddenDealers)?me.hiddenDealers:[];
$$('.opt[data-k="dealer"]').forEach(o=>{o.hidden=RETIRED.includes(o.dataset.val)||hide.includes(o.dataset.val)});
if(hide.includes(st.dealer)||RETIRED.includes(st.dealer)){const first=$$('.opt[data-k="dealer"]').find(o=>!o.hidden);if(first)st.dealer=first.dataset.val}render()}
const was=st.screen;st.email='';go('login');
// After choosing a password the backoffice can send ?email=… so the sign-in is not typed twice (Kevin 12 Oct).
{const pre=new URLSearchParams(location.search).get('email');if(pre&&/^[^@\s]+@[^@\s]+$/.test(pre)){$('#email').value=pre;$('#pw').focus()}}
if(new URLSearchParams(location.search).has('resume'))fetch('/api/studio/session').then(r=>r.ok?r.json():{}).then(me=>{if(me.user){st.email=me.user;access(me);go(was&&was!=='login'?was:'builder')}}).catch(()=>{});
