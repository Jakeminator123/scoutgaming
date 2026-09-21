// Scout Live Casino backoffice - live data from the game server.
import { createSinglePreviewController } from './media-preview.mjs';

const $=s=>document.querySelector(s);
const fmt=n=>'$'+Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const pill=(t,k)=>`<span class="pill ${k}">${t}</span>`;
const toast=t=>{const e=$('#toast');e.textContent=t;e.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('on'),2200);};
const api=async(p,body)=>{const r=await fetch(p,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:undefined);return r.json();};

const SECTIONS=[
 ['ops','Operations','SCOUT LIVE CASINO · ALL SYSTEMS'],
 ['voice','Voice Lines','SYNC VERIFICATION · EVERY TAKE, AS THE GAME PLAYS IT'],
 ['clips','Dealing Clips','CLIP LIBRARY · TRANSPARENT FILTER · ASSIGN TO TABLE PARTS'],
 ['apikeys','API Keys','PARTNER INTEGRATIONS · SIGNED KEYS · SEAMLESS WALLET'],
 ['emails','Emails','BRAND TEMPLATES · TRANSACTIONAL & LIFECYCLE'],
 ['users','Users','CRAIG · ROLES & INVITES'],
 ['rooms','Tables & Rooms','ROOMS · TIERS · RULES'],
 ['dealers','Dealers','EVERY FACE · ROSTER & PIPELINE'],
 ['pit','Pit Bosses','SUPERVISION · FAIRNESS'],
 ['tours','Tournaments','COMPETITIVE BLACKJACK'],
 ['players','Players','ACCOUNTS · SESSIONS · RG'],
 ['pay','Payments','WALLET · LEDGER'],
 ['shoes','Shoes & Decks','GAME INTEGRITY · RNG'],
];
const ICONS={apikeys:'<circle cx="8" cy="14" r="4"/><path d="M11 11 L20 2 M16 6 l2 2 M13 9 l2 2"/>',clips:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9 l5 3 -5 3 Z"/>',users:'<circle cx="12" cy="8" r="3.5"/><path d="M5 20 c1.2-4.5 4-6.5 7-6.5 s5.8 2 7 6.5"/><path d="M17 3 l1 2 2 .3 -1.5 1.5 .4 2 -1.9 -1 -1.9 1 .4 -2 L14 5.3 16 5 Z"/>',emails:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7 l9 6 9-6"/>',voice:'<path d="M12 4 v16 M8 8 v8 M16 8 v8 M4 11 v2 M20 11 v2"/>',ops:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
 rooms:'<ellipse cx="12" cy="12" rx="9" ry="6"/><path d="M5 16 v3 M19 16 v3"/>',
 dealers:'<circle cx="12" cy="9" r="4"/><path d="M4 21 c1.5-5 4.5-7 8-7 s6.5 2 8 7"/>',
 pit:'<path d="M12 3 L20 6 V12 C20 17 16.5 20 12 21.5 C7.5 20 4 17 4 12 V6 Z"/>',
 tours:'<path d="M7 4 h10 v5 a5 5 0 0 1 -10 0 Z M7 6 H4 a3 3 0 0 0 3 4 M17 6 h3 a3 3 0 0 1 -3 4 M12 14 v4 M8 20 h8"/>',
 players:'<circle cx="9" cy="9" r="3.5"/><path d="M3 20 c1-4 3.5-5.5 6-5.5 s5 1.5 6 5.5 M16 5.5 a3.5 3.5 0 0 1 0 7 M18 14.8 c2 .8 3 2.5 3.5 5.2"/>',
 pay:'<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10 h18"/>',
 shoes:'<rect x="7" y="3" width="12" height="16" rx="2"/><path d="M5 7 v12 a2 2 0 0 0 2 2 h8"/>'};
$('#nav').innerHTML=SECTIONS.map(([id,name])=>`<a href="#${id}" data-id="${id}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[id]}</svg>${name}</a>`).join('');

const TIERN={classic:'CLASSIC',high:'HIGH ROLLER',vip:'VIP SALON'};
const PORTRAIT=k=>`/bo/img/${k}-portrait.jpg`;
const ROOMIMG={prive:'/bo/img/prive-room.jpg',darkhall:'/bo/img/darkhall-room.jpg',goldensalon:'/bo/img/goldensalon-room.jpg',azure:'/bo/img/azure-room.jpg'};
const DEALER_ROOM={vera:'prive',astrid:'darkhall',amira:'goldensalon',mei:'azure'};
const DSTATE=d=>d.speak>=10?['LIVE-READY','live']:d.speak>0?['PREVIEW','preview']:d.stills?['STILLS READY','pending']:['PENDING','pending'];
const mediaPreviews=createSinglePreviewController();
addEventListener('pagehide',()=>mediaPreviews.release(document));
addEventListener('pageshow',event=>{if(event.persisted)void render(location.hash.slice(1)||'ops');});

async function render(id){
  document.querySelectorAll('#nav a').forEach(a=>a.classList.toggle('on',a.dataset.id===id));
  const meta=SECTIONS.find(s=>s[0]===id)||SECTIONS[0];
  $('#title').textContent=meta[1]; $('#sub').textContent=meta[2];
  const C=$('#content'); mediaPreviews.release(C); C.innerHTML='<div class="mono" style="color:var(--mut);font-size:11px">loading&hellip;</div>';
  const ov=await api('/api/bo/overview');
  const sum=t=>ov.tx.find(x=>x.type===t)||{n:0,sum:0};
  if(id==='ops'){
    const deals=sum('deal'), settles=sum('settle'), deposits=sum('deposit'), sides=sum('sidebets');
    const ggr=-(deals.sum||0)-(settles.sum||0)-(sides.sum||0);
    C.innerHTML=`<div class="row">
      <div class="kpi"><div class="l">ROUNDS TODAY</div><div class="v">${deals.n}</div><div class="d">real ledger count</div></div>
      <div class="kpi"><div class="l">STAKED TODAY</div><div class="v">${fmt(-(deals.sum||0))}</div><div class="d">${deals.n} deals</div></div>
      <div class="kpi"><div class="l">RETURNED TODAY</div><div class="v">${fmt((settles.sum||0)+(sides.sum||0))}</div><div class="d">incl. side bets</div></div>
      <div class="kpi"><div class="l">GGR TODAY</div><div class="v" style="color:${ggr>=0?'var(--lime)':'var(--red)'}">${fmt(ggr)}</div><div class="d">stakes minus returns</div></div>
      <div class="kpi"><div class="l">DEPOSITS TODAY</div><div class="v">${fmt(deposits.sum||0)}</div><div class="d">${deposits.n} on demo rail</div></div>
      <div class="kpi"><div class="l">PLAYERS</div><div class="v">${ov.players}</div><div class="d">registered accounts</div></div>
    </div>
    <div class="panel"><div class="t">TIER ASSIGNMENTS &middot; LIVE GAME CONTROL</div><table><thead><tr><th>TIER</th><th>LIMITS</th><th>DEALER</th><th>ROOM</th><th>STATE</th></tr></thead><tbody>
    ${Object.entries(ov.tiers).map(([t,d])=>{const dd=ov.dealers.find(x=>x.key===d);const [lbl,cls]=DSTATE(dd);return `<tr><td class="mono">${TIERN[t]}</td><td class="mono" style="color:var(--mut)">${{classic:'$5 - $2,000',high:'$100 - $50,000',vip:'$1,000 - $1,000,000'}[t]}</td><td>${dd.name}</td><td style="color:var(--mut)">${dd.room}</td><td>${pill(lbl,cls)}</td></tr>`;}).join('')}
    </tbody></table></div>`;
  }


  if(id==='apikeys'){
    const d=await api('/api/bo/apikeys');
    const SC={launch:'Launch (get game URL for a player)',play:'Play (drive the table server-side)',wallet:'Wallet (balance queries)',history:'History (round log export)',lobby:'Lobby (tables, limits, rules)',events:'Events (read-only observation stream; no table or wallet commands)'};
    const draw=(fresh)=>{C.innerHTML=`
      ${fresh?`<div class="panel" style="border-color:var(--lime)"><div class="t" style="color:var(--lime)">NEW KEY &middot; ${fresh.name} &middot; SECRET SHOWN ONCE</div><div class="pad">
        <div class="mono" style="font-size:12px;line-height:1.9;user-select:all">X-Api-Key: <b>${fresh.key}</b><br>Secret: <b>${fresh.secret}</b><br>Scopes: ${fresh.scopes.join(', ')}${fresh.walletUrl?`<br>Wallet URL: ${fresh.walletUrl}`:''}</div>
        <div style="font-size:11px;color:var(--mut);margin-top:8px">Send both to the partner over a secure channel. The secret is not stored in readable form and cannot be shown again. Docs: <a href="/docs/partner-api.html" target="_blank" style="color:var(--lime)">/docs/partner-api.html</a></div></div></div>`:''}
      <div class="panel"><div class="t">CREATE PARTNER KEY</div><div class="pad" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;max-width:760px">
        <input id="k-name" placeholder="Partner name (e.g. Acme Aggregator)" style="grid-column:1/3">
        <input id="k-wallet" placeholder="Seamless wallet URL (optional; blank = internal demo wallet)">
        <input id="k-ip" placeholder="IP allowlist, comma separated (optional)">
        <div style="grid-column:1/3;display:flex;gap:14px;flex-wrap:wrap">${d.scopes.map(sc=>`<label style="font-size:11px;display:flex;gap:6px;align-items:center"><input type="checkbox" data-scope="${sc}" checked> ${SC[sc]}</label>`).join('')}</div>
        <button id="k-create" style="grid-column:1/3;justify-self:start">CREATE KEY</button>
      </div></div>
      <div class="panel"><div class="t">KEYS &middot; ${d.keys.length}</div><table><thead><tr><th>NAME</th><th>KEY</th><th>SCOPES</th><th>WALLET</th><th>LAST USED</th><th>STATE</th><th></th></tr></thead><tbody>
      ${d.keys.map(k=>`<tr style="${k.revoked_at?'opacity:.45':''}"><td>${k.name}<div class="mono" style="font-size:9px;color:var(--mut)">by ${k.created_by??'?'} &middot; ${k.created_at.slice(0,10)}</div></td><td class="mono" style="font-size:10px">${k.key}</td><td style="font-size:10px">${k.scopes.join(', ')}</td><td style="font-size:10px">${k.wallet_url?'seamless':'internal'}</td><td class="mono" style="font-size:10px">${k.last_used?k.last_used.slice(0,16).replace('T',' '):'never'}</td><td>${k.revoked_at?pill('REVOKED','bad'):pill('ACTIVE','live')}</td>
        <td style="white-space:nowrap">${k.revoked_at?'':`<button data-launch="${k.id}" style="font-size:9px;border-color:var(--lime);color:var(--lime)">MINT TEST TOKEN</button> <button data-rotate="${k.id}" style="font-size:9px">ROTATE SECRET</button> <button data-revoke="${k.id}" style="font-size:9px;color:var(--red);border-color:rgba(255,80,80,.5)">REVOKE</button>`}</td></tr>
      ${k.revoked_at?'':`<tr data-launchrow="${k.id}" hidden><td colspan="7" style="background:var(--panel2)"></td></tr>`}`).join('')||'<tr><td colspan="7" style="color:var(--mut)">no keys yet</td></tr>'}
      </tbody></table></div>
      <div class="panel"><div class="t">INTEGRATION DOCS</div><div class="pad" style="font-size:12px">Partner API v1 documentation, signing example and wallet contract: <a href="/docs/partner-api.html" target="_blank" style="color:var(--lime)">/docs/partner-api.html</a></div></div>`;
      $('#k-create').onclick=async()=>{const scopes=[...C.querySelectorAll('[data-scope]:checked')].map(x=>x.dataset.scope);const r=await api('/api/bo/apikeys/create',{name:$('#k-name').value,walletUrl:$('#k-wallet').value.trim(),ipAllow:$('#k-ip').value.trim(),scopes});if(r.ok){toast('key created');const d2=await api('/api/bo/apikeys');d.keys=d2.keys;draw(r.key);}else toast(r.error||'failed');};
      C.querySelectorAll('[data-revoke]').forEach(b=>b.onclick=async()=>{if(!confirm('Revoke this key? The partner loses access immediately.'))return;const r=await api('/api/bo/apikeys/revoke',{id:b.dataset.revoke});if(r.ok){toast('revoked');render('apikeys');}});
      C.querySelectorAll('[data-launch]').forEach(btn=>btn.onclick=async()=>{
        const id=btn.dataset.launch, row=C.querySelector(`[data-launchrow="${id}"]`), cell=row.firstElementChild;
        const r=await api('/api/bo/apikeys/launch',{id});
        if(!r.ok){toast(r.error||'failed');return;}
        row.hidden=false;
        cell.innerHTML=`<div style="padding:10px 12px;font-size:12px;line-height:1.8">
          <div class="mono" style="font-size:10px;letter-spacing:.1em;color:var(--mut)">TEST PLAYER ${r.playerId} &middot; ${r.currency} ${r.balance.toFixed(2)} &middot; TOKEN VALID 6 H</div>
          <div style="margin-top:6px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <a href="${r.url}" target="_blank" style="color:var(--lime)">Open the game as this player &rarr;</a>
            <button data-copyurl style="font-size:9px">COPY URL</button>
            <input data-amount value="500" style="width:80px;font-size:11px;padding:3px 6px;background:var(--panel);border:1px solid var(--line);border-radius:6px;color:var(--paper)">
            <button data-credit style="font-size:9px">ADD DEMO FUNDS</button>
          </div>
          <div class="mono" style="margin-top:8px;font-size:10px;color:var(--mut)">Equivalent signed call (5 min validity). Signed string: <span style="color:var(--paper)">${(r.signedString||'').replace(/</g,'&lt;')}</span></div>
          <pre style="margin:4px 0 0;background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:9px;font-size:10px;overflow:auto">${(r.curlLines||[]).join(' \\\n').replace(/</g,'&lt;')}</pre>
          <button data-copycurl style="font-size:9px;margin-top:6px">COPY CURL</button></div>`;
        const copy=async(el,text,label)=>{try{await navigator.clipboard.writeText(text);}catch{}toast(label);};
        cell.querySelector('[data-copyurl]').onclick=()=>copy(null,r.url,'launch URL copied');
        cell.querySelector('[data-copycurl]').onclick=()=>copy(null,(r.curlLines||[]).join(' \\\n'),'curl copied');
        cell.querySelector('[data-credit]').onclick=async()=>{const amount=Number(cell.querySelector('[data-amount]').value);const c=await api('/api/bo/apikeys/credit',{id,playerId:r.playerId,amount});toast(c.ok?`${r.playerId}: ${c.balance} ${c.currency}`:(c.error||'failed'));};
      });
      C.querySelectorAll('[data-rotate]').forEach(b=>b.onclick=async()=>{const r=await api('/api/bo/apikeys/rotate',{id:b.dataset.rotate});if(r.ok){toast('secret rotated');const d2=await api('/api/bo/apikeys');d.keys=d2.keys;const k=d.keys.find(x=>x.id===r.id);draw({name:k.name,key:k.key+' (unchanged)',secret:r.secret,scopes:k.scopes,walletUrl:k.wallet_url});}else toast(r.error||'failed');});
    };
    draw(null);
    return;
  }
  if(id==='clips'){
    const lib=await api('/api/bo/clips');
    const st=render.clipState??={dealer:'astrid',part:'',mode:'transparent',sort:'dealer',selected:null};
    const PARTN={box0:'Box 0 (far left)',box1:'Box 1',box2:'Box 2',box3:'Box 3 (centre)',box4:'Box 4',box5:'Box 5',box6:'Box 6 (far right)','dealer-up':'Dealer upcard','dealer-hole':'Dealer hole card',return:'Return to idle',idle:'Idle'};
    const byId=Object.fromEntries(lib.clips.map(c=>[c.id,c]));
    const assignedParts=id=>Object.entries(lib.assignments[st.dealer]??{}).filter(([,a])=>a.clip===id).map(([p])=>p);
    const tileInner=p=>{const a=(lib.assignments[st.dealer]??{})[p];const c=a?byId[a.clip]:null;return `<div class="mono" style="font-size:9px;letter-spacing:.12em;color:var(--mut)">${PARTN[p].toUpperCase()}</div>
          <div style="font-size:11px;margin-top:4px;${c?'':'color:var(--mut)'}">${c?c.name:a?'(missing '+a.clip+')':'legacy / none'}</div>
          ${c?`<div style="margin-top:4px;display:flex;gap:4px;align-items:center">${pill(c.transparent?'TRANSPARENT':'FULL-SCENE',c.transparent?'live':'pending')}<button data-clear="${p}" style="padding:1px 6px;font-size:9px">clear</button></div>`:''}`;};
    const cardBadge=c=>{const ps=assignedParts(c.id);return ps.length?`<span class="pill live" style="background:var(--lime);color:#111">&#10003; ASSIGNED &middot; ${ps.map(p=>PARTN[p].toUpperCase()).join(' + ')}</span>`:'';};
    const markCard=id=>{const el=C.querySelector(`[data-clip="${id}"]`);if(!el)return;const ps=assignedParts(id);el.style.borderColor=ps.length||st.selected===id?'var(--lime)':'var(--line)';el.style.boxShadow=ps.length?'0 0 0 2px rgba(214,255,58,.25)':'';el.querySelector('[data-badge]').innerHTML=cardBadge(byId[id]);};
    const draw=()=>{
      mediaPreviews.release(C);
      const never=lib.neverAgain??{};
      let list=lib.clips.filter(c=>(!st.dealer||c.dealer===st.dealer)&&(!st.part||c.part===st.part)&&(st.mode==='never'?!!never[c.id]:!never[c.id]&&(st.mode==='all'||(st.mode==='transparent'?c.transparent:!c.transparent))));
      const cmp={dealer:(a,b)=>a.dealer.localeCompare(b.dealer)||(a.part??'zz').localeCompare(b.part??'zz')||a.name.localeCompare(b.name),name:(a,b)=>a.name.localeCompare(b.name),part:(a,b)=>(a.part??'zz').localeCompare(b.part??'zz')||a.dealer.localeCompare(b.dealer),frames:(a,b)=>(b.frames??0)-(a.frames??0)}[st.sort];
      list.sort(cmp);
      const asg=lib.assignments[st.dealer]??{};
      const sel=st.selected?byId[st.selected]:null;
      C.innerHTML=`
      <div class="panel"><div class="t">FILTERS &middot; ${list.length} OF ${lib.clips.length} CLIPS</div><div class="pad" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <select id="cf-dealer"><option value="">All dealers</option>${lib.dealers.map(d=>`<option value="${d.key}" ${st.dealer===d.key?'selected':''}>${d.name}</option>`).join('')}</select>
        <select id="cf-part"><option value="">All table parts</option>${lib.parts.map(p=>`<option value="${p}" ${st.part===p?'selected':''}>${PARTN[p]}</option>`).join('')}</select>
        <span style="display:flex;border:1px solid var(--line);border-radius:8px;overflow:hidden">${[['transparent','TRANSPARENT ONLY'],['full','FULL-SCENE ONLY'],['all','ALL'],['never',`&#10006; NEVER AGAIN (${Object.keys(never).length})`]].map(([k,l])=>`<button data-mode="${k}" style="border:0;border-radius:0;${st.mode===k?(k==='never'?'background:rgba(255,80,80,.18);color:var(--red)':'background:rgba(214,255,58,.15);color:var(--lime)'):''}">${l}</button>`).join('')}</span>
        <select id="cf-sort">${[['dealer','Sort: dealer'],['part','Sort: table part'],['name','Sort: name'],['frames','Sort: length']].map(([k,l])=>`<option value="${k}" ${st.sort===k?'selected':''}>${l}</option>`).join('')}</select>
      </div></div>
      ${st.dealer?`<div class="panel"><div class="t">ASSIGNMENTS &middot; ${st.dealer.toUpperCase()} ${sel?`&middot; <span style="color:var(--lime)">SELECTED: ${sel.name}</span> &rarr; click a part to assign`:'&middot; click a clip below, then a part here'}</div>
      <div class="pad" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px">
        ${lib.parts.map(p=>`<div data-part="${p}" style="border:1px solid ${sel?'var(--lime)':'var(--line)'};border-radius:8px;padding:8px 10px;cursor:${sel?'pointer':'default'};background:var(--panel2)">${tileInner(p)}</div>`).join('')}
      </div></div>`:''}
      <div class="pad" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px">
      ${list.map(c=>`<div data-clip="${c.id}" style="border:1px solid ${st.selected===c.id||assignedParts(c.id).length?'var(--lime)':'var(--line)'};${assignedParts(c.id).length?'box-shadow:0 0 0 2px rgba(214,255,58,.25);':''}border-radius:10px;overflow:hidden;background:var(--panel2);cursor:pointer;position:relative"><div data-badge style="position:absolute;top:8px;left:8px;z-index:2">${cardBadge(c)}</div>
        ${c.src?`<video data-bo-preview src="/${c.src}" preload="metadata" muted playsinline controls style="width:100%;max-height:220px;display:block;background:#000;object-fit:contain"></video>`:`<div style="height:90px;display:flex;align-items:center;justify-content:center;background:#000"><span class="mono" style="font-size:8px;letter-spacing:.12em;color:var(--mut)">ENGINE STREAM &middot; NO MP4 PREVIEW</span></div>`}
        <div style="padding:9px 11px">
          <div style="display:flex;justify-content:space-between;gap:6px;align-items:flex-start"><span class="mono" style="font-size:10px;letter-spacing:.06em;word-break:break-all">${c.name}</span>${pill(c.transparent?'TRANSPARENT':'FULL-SCENE',c.transparent?'live':'pending')}</div>
          <div style="font-size:11px;color:var(--mut);margin-top:4px">${c.dealer.toUpperCase()} &middot; ${c.part?PARTN[c.part]:'unassigned part'} &middot; ${c.kind}${c.status?' &middot; '+c.status:''}</div>
          ${c.text?`<div style="font-size:11px;margin-top:5px;padding:6px 8px;border-left:2px solid var(--lime);background:rgba(214,255,58,.05)">&ldquo;${c.text}&rdquo;</div>`:''}${c.audio&&!c.src?`<audio src="/${c.audio}" controls preload="none" style="width:100%;height:26px;margin-top:5px"></audio>`:''}
          <div style="font-size:10px;color:var(--mut);margin-top:3px">${c.layout??''}${c.width?` &middot; ${c.width}&times;${c.height}`:''}${c.frames?` &middot; ${c.frames}f`:''}${c.fps?` @${c.fps}`:''}${c.route?`<br>route: <span class="mono">${c.route}</span>`:''}</div>
          ${never[c.id]?`<div style="margin-top:8px;padding:6px 8px;border:1px solid var(--red);border-radius:6px;font-size:11px"><span class="mono" style="color:var(--red);font-size:9px;letter-spacing:.12em">NEVER AGAIN</span> ${never[c.id].reason?'&middot; '+never[c.id].reason:''}<div style="font-size:9px;color:var(--mut);margin-top:2px">${never[c.id].by??''} ${never[c.id].at?never[c.id].at.slice(0,16).replace('T',' '):''}</div><button data-restore="${c.id}" style="margin-top:6px;padding:2px 8px;font-size:9px">RESTORE</button></div>`
          :`<div style="margin-top:8px;display:flex;gap:6px;align-items:center"><select data-assign-part="${c.id}" style="flex:1"><option value="">Assign to&hellip;</option>${lib.parts.map(p=>`<option value="${p}" ${c.part===p?'selected':''}>${PARTN[p]}</option>`).join('')}</select><button data-assign="${c.id}">ASSIGN</button></div>
          <div data-never-row="${c.id}" style="margin-top:6px;display:flex;gap:6px;align-items:center"><input data-never-reason="${c.id}" placeholder="why it's awful (optional)" style="flex:1;font-size:11px;padding:4px 6px;background:var(--panel);border:1px solid var(--line);border-radius:6px;color:var(--paper)"><button data-never="${c.id}" style="border-color:rgba(255,80,80,.5);color:var(--red);font-size:10px">&#10006; NEVER AGAIN</button></div>`}
        </div></div>`).join('')}
      </div>`;
      mediaPreviews.bind(C);
      $('#cf-dealer').onchange=e=>{st.dealer=e.target.value;st.selected=null;draw();};
      $('#cf-part').onchange=e=>{st.part=e.target.value;draw();};
      $('#cf-sort').onchange=e=>{st.sort=e.target.value;draw();};
      C.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{st.mode=b.dataset.mode;draw();});
      const assign=async(dealer,part,clip,btn)=>{const prev=(lib.assignments[dealer]??{})[part]?.clip;const r=await api('/api/bo/clip-assign',{dealer,part,clip});if(!r.ok){toast(r.error||'failed');return;}
        lib.assignments=r.assignments;toast(clip?`${PARTN[part]} ← ${byId[clip]?.name??clip}`:`${PARTN[part]} cleared`);
        const tile=C.querySelector(`[data-part="${part}"]`);if(tile){tile.innerHTML=tileInner(part);tile.style.borderColor=clip?'var(--lime)':'var(--line)';tile.animate([{background:'rgba(214,255,58,.35)'},{background:'var(--panel2)'}],{duration:900});tile.querySelectorAll('[data-clear]').forEach(b=>b.onclick=()=>assign(dealer,b.dataset.clear,null));}
        if(prev)markCard(prev);if(clip)markCard(clip);
        if(btn){const t=btn.textContent;btn.textContent='✓ ASSIGNED';btn.style.background='var(--lime)';btn.style.color='#111';setTimeout(()=>{btn.textContent=t;btn.style.background='';btn.style.color='';},1500);}
        if(st.selected){const old=st.selected;st.selected=null;markCard(old);C.querySelectorAll('[data-part]').forEach(t=>{t.style.cursor='default';if(!(lib.assignments[dealer]??{})[t.dataset.part])t.style.borderColor='var(--line)';});const head=C.querySelector('.panel:nth-of-type(2) .t');if(head)head.innerHTML=`ASSIGNMENTS &middot; ${st.dealer.toUpperCase()} &middot; click a clip below, then a part here`;}};
      C.querySelectorAll('[data-clip]').forEach(el=>el.onclick=e=>{if(e.target.closest('video,select,button'))return;const id=el.dataset.clip;if(!st.dealer||st.dealer!==byId[id].dealer){st.dealer=byId[id].dealer;st.selected=id;draw();return;}const old=st.selected;st.selected=st.selected===id?null:id;if(old)markCard(old);markCard(id);const on=!!st.selected;C.querySelectorAll('[data-part]').forEach(t=>{t.style.cursor=on?'pointer':'default';t.style.borderColor=on||(lib.assignments[st.dealer]??{})[t.dataset.part]?'var(--lime)':'var(--line)';});const head=C.querySelector('.panel:nth-of-type(2) .t');if(head)head.innerHTML=`ASSIGNMENTS &middot; ${st.dealer.toUpperCase()} ${on?`&middot; <span style="color:var(--lime)">SELECTED: ${byId[id].name}</span> &rarr; click a part to assign`:'&middot; click a clip below, then a part here'}`;});
      C.querySelectorAll('[data-part]').forEach(el=>el.onclick=e=>{if(e.target.closest('button'))return;if(!st.selected)return;assign(st.dealer,el.dataset.part,st.selected);});
      C.querySelectorAll('[data-clear]').forEach(b=>b.onclick=()=>assign(st.dealer,b.dataset.clear,null));
      const neverAgain=async(id,undo)=>{const reason=C.querySelector(`[data-never-reason="${id}"]`)?.value??'';const r=await api('/api/bo/clip-never',{clip:id,reason,undo});if(!r.ok){toast(r.error||'failed');return;}lib.neverAgain=r.neverAgain;lib.assignments=r.assignments;
        const el=C.querySelector(`[data-clip="${id}"]`);if(el){el.animate([{opacity:1},{opacity:0,transform:'scale(.96)'}],{duration:350,fill:'forwards'});setTimeout(()=>el.remove(),360);}
        C.querySelectorAll('[data-part]').forEach(t=>{t.innerHTML=tileInner(t.dataset.part);t.querySelectorAll('[data-clear]').forEach(b=>b.onclick=()=>assign(st.dealer,b.dataset.clear,null));});
        const nb=C.querySelector('[data-mode="never"]');if(nb)nb.innerHTML=`&#10006; NEVER AGAIN (${Object.keys(lib.neverAgain).length})`;
        toast(undo?`restored ${byId[id]?.name??id}`:`never again: ${byId[id]?.name??id}`);};
      C.querySelectorAll('[data-never]').forEach(b=>b.onclick=()=>neverAgain(b.dataset.never,false));
      C.querySelectorAll('[data-restore]').forEach(b=>b.onclick=()=>neverAgain(b.dataset.restore,true));
      C.querySelectorAll('[data-assign]').forEach(b=>b.onclick=()=>{const c=byId[b.dataset.assign];const part=C.querySelector(`[data-assign-part="${c.id}"]`).value;if(!part){toast('pick a table part first');return;}if(st.dealer!==c.dealer){st.dealer=c.dealer;draw();}assign(c.dealer,part,c.id,C.querySelector(`[data-assign="${c.id}"]`));});
    };
    draw();
    return;
  }
  if(id==='voice'){
    const vl=await api('/api/bo/voicelines');
    C.innerHTML=vl.dealers.filter(d=>d.lines.length).map(d=>`
    <div class="panel"><div class="t"><span>${d.name.toUpperCase()} &middot; ${d.lines.filter(l=>l.clip).length} LIP-SYNCED &middot; ${d.lines.filter(l=>!l.clip).length} VOICE-OVER</span></div>
    <div class="pad" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px">
    ${d.lines.map(l=>`
      <div style="border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--panel2)">
        ${l.preview?`<video data-bo-preview src="${l.preview}" preload="none" controls playsinline style="width:100%;aspect-ratio:1;display:block;background:#000"></video>`
                   :`<div style="width:100%;aspect-ratio:2.6;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;background:#000">
                      <audio data-bo-preview src="${l.audio}" controls preload="none" style="width:88%;height:30px"></audio>
                      <span class="mono" style="font-size:8px;letter-spacing:.12em;color:var(--mut)">VOICE ONLY - NO CLIP YET</span></div>`}
        <div style="padding:9px 11px">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:6px">
            <span class="mono" style="font-size:10px;letter-spacing:.1em">${l.key.toUpperCase()}</span>
            <span style="display:flex;gap:5px">${l.clip?pill((l.delay??0)+'MS','live'):pill('VOICE-OVER','pending')}${l.review==='approved'?pill('CONFIRMED','live'):l.review==='rejected'?pill('REJECTED','bad'):''}</span>
          </div>
          <div style="font-size:11px;color:var(--mut);margin-top:4px">${l.text||'&mdash;'}</div>
          <div style="display:flex;gap:8px;margin-top:9px">
            <button data-rv="approved" data-d="${d.dealer}" data-l="${l.key}" style="border-color:${l.review==='approved'?'var(--lime)':'rgba(242,241,237,.2)'};color:${l.review==='approved'?'var(--lime)':'var(--paper)'}">&#10003; CONFIRM</button>
            <button data-rv="rejected" data-d="${d.dealer}" data-l="${l.key}" style="border-color:${l.review==='rejected'?'var(--red)':'rgba(242,241,237,.2)'};color:${l.review==='rejected'?'var(--red)':'var(--paper)'}">&#10005; REJECT</button>
          </div>
        </div>
      </div>`).join('')}
    </div></div>`).join('');
    mediaPreviews.bind(C);
    C.querySelectorAll('button[data-rv]').forEach(b=>b.onclick=async()=>{
      const r=await api('/api/bo/voiceline-review',{dealer:b.dataset.d,line:b.dataset.l,verdict:b.dataset.rv});
      if(r.ok){toast(`${b.dataset.d}/${b.dataset.l}: ${b.dataset.rv}`);render('voice');}
    });
  }
  if(id==='users'){
    const me=await api('/api/bo/me');
    if(me.role!=='superadmin'){C.innerHTML='<div class="mono" style="color:var(--mut);font-size:11px">SUPERADMIN ONLY</div>';return;}
    const u=await api('/api/bo/users');
    const ROLES=['reader','staff','admin','superadmin'];
    C.innerHTML=`<div class="panel"><div class="t">BACKOFFICE USERS &middot; CRAIG</div><table><thead><tr><th>USER</th><th>EMAIL</th><th>ROLE</th><th>STATE</th><th>SINCE</th><th></th></tr></thead><tbody>
    ${u.users.map(x=>{const self=x.username===me.user;
      return `<tr><td>${x.username}${self?' <span class="mono" style="color:var(--lime);font-size:8px">YOU</span>':''}</td><td style="color:var(--mut)">${x.email||'—'}</td>
      <td>${self?`<span class="mono">${x.role.toUpperCase()}</span>`:`<select data-role-user="${x.username}">${ROLES.map(r=>`<option value="${r}" ${r===x.role?'selected':''}>${r.toUpperCase()}</option>`).join('')}</select>`}</td>
      <td>${x.active?pill('ACTIVE','live'):pill('INVITED','pending')}</td><td style="color:var(--mut)">${(x.created_at||'').slice(0,10)}</td>
      <td style="white-space:nowrap">${x.email?`<button data-resend="${x.username}">${x.active?'SEND RESET':'RESEND INVITE'}</button> `:''}${self?'':`<button data-remove="${x.username}" style="color:var(--red);border-color:rgba(232,106,94,.4)">REMOVE</button>`}</td></tr>`;}).join('')}
    </tbody></table></div>
    <div class="panel" style="max-width:640px"><div class="t">INVITE BY EMAIL &middot; THEY CHOOSE THEIR OWN PASSWORD</div>
    <div class="pad" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <input id="inv-email" type="email" placeholder="name@company.com" style="flex:2;min-width:200px">
      <select id="inv-role"><option value="reader">READER (read-only)</option><option value="staff">STAFF</option><option value="admin">ADMIN</option><option value="superadmin">SUPER ADMIN</option></select>
      <button class="pri" id="inv-send">SEND INVITE</button>
    </div><div class="pad" id="inv-out" style="padding-top:0"></div></div>`;
    C.querySelectorAll('select[data-role-user]').forEach(sel=>sel.onchange=async()=>{
      const r=await api('/api/bo/users/role',{username:sel.dataset.roleUser,role:sel.value});
      if(r.ok)toast(`${sel.dataset.roleUser} → ${sel.value.toUpperCase()}`);else{toast(r.error);render('users');}
    });
    C.querySelectorAll('button[data-resend]').forEach(b=>b.onclick=async()=>{
      const r=await api('/api/bo/users/resend',{username:b.dataset.resend});
      if(r.ok)toast(r.emailSent?`${r.kind} email sent`:`${r.kind} created, email failed: ${r.reason||''}`);
      else toast(r.error);
    });
    C.querySelectorAll('button[data-remove]').forEach(b=>b.onclick=async()=>{
      if(!confirm(`Remove ${b.dataset.remove}? This cannot be undone.`))return;
      const r=await api('/api/bo/users/remove',{username:b.dataset.remove});
      if(r.ok){toast('removed');render('users');}else toast(r.error);
    });
    $('#inv-send').onclick=async()=>{
      const r=await api('/api/bo/users/invite',{email:$('#inv-email').value,role:$('#inv-role').value});
      const out=$('#inv-out');
      if(r.ok){toast(r.emailSent?'invite email sent':'invite created');out.innerHTML=`<div class="kv"><b>${r.emailSent?'Email sent':'Email not sent ('+(r.reason||'')+') - share this link'}</b><span class="mono" style="font-size:10px;word-break:break-all">${r.emailSent?'':r.link}</span></div>`;render('users');}
      else out.innerHTML=`<div class="kv"><b style="color:var(--red)">${r.error}</b></div>`;
    };
  }
  if(id==='emails'){
    const T=[['welcome','Welcome / account created'],['deposit-receipt','Deposit receipt'],['tournament-invite','Tournament invite'],['rg-checkin','Responsible gambling check-in']];
    C.innerHTML='<div class="row">'+T.map(([f,label])=>`
      <div class="kpi" style="min-width:300px;padding:0;overflow:hidden">
        <iframe src="/bo/emails/${f}.html" style="width:100%;height:360px;border:none;background:#0A0B0D;pointer-events:none" scrolling="no"></iframe>
        <div style="padding:12px 14px;display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:13px">${label}</span>
          <button onclick="window.open('/bo/emails/${f}.html','_blank')">OPEN</button>
        </div>
      </div>`).join('')+'</div>';
  }
  if(id==='rooms'){
    C.innerHTML=`<div class="row">${ov.rooms.map(r=>{const d=ov.dealers.find(x=>x.key===r.dealer)||{};
    return `<div class="kpi" style="min-width:280px;padding:0;overflow:hidden">
      <div style="position:relative"><img src="${ROOMIMG[r.id]}" style="width:100%;aspect-ratio:16/9;object-fit:cover;display:block">
      <div style="position:absolute;top:10px;right:10px">${pill(r.state.toUpperCase(),r.state)}</div>
      <img src="${PORTRAIT(r.dealer)}" title="${d.name||''}" style="position:absolute;bottom:-14px;left:14px;width:44px;height:44px;object-fit:cover;border-radius:50%;border:2px solid var(--panel)"></div>
      <div style="padding:20px 14px 12px">
      <div style="font-family:'Space Grotesk';font-weight:700;font-size:16px">${r.name}</div>
      <div class="kv" style="margin-top:6px"><b>Scene</b><span>${r.scene}</span></div>
      <div class="kv"><b>Felt</b><span>${r.felt}</span></div>
      <div class="kv"><b>Dealer</b><span>${d.name||'-'} &middot; ${d.speak||0} lines</span></div>
      <div class="kv"><b>Serving tier</b><span>${Object.entries(ov.tiers).filter(([,dk])=>dk===r.dealer).map(([t])=>TIERN[t]).join(' · ')||'—'}</span></div>
      <div style="display:flex;gap:7px;margin-top:12px;flex-wrap:wrap">
        <button onclick="window.open('/?dealer=${r.dealer}','_blank')">OPEN TABLE</button>
        <button onclick="location.hash='dealers'">SEAT DEALER</button>
        <button data-room="${r.id}" data-next="${r.state==='live'?'preview':'live'}" class="${r.state==='live'?'':'pri'}">${r.state==='live'?'SET PREVIEW':'GO LIVE'}</button>
      </div>
      </div></div>`;}).join('')}</div>
    <div class="grid2"><div class="panel"><div class="t">HOUSE RULES &middot; ALL TABLES</div><div class="pad">
    ${[['Decks','8, reshuffled every round'],['Dealer stands','All 17s'],['Blackjack pays','3 : 2'],['Insurance pays','2 : 1'],['Split','Any pair, up to 4 hands'],['Split aces','One card each'],['Double after split','Allowed'],['Side bets','Perfect Pairs 25:1 · 21+3 100:1']].map(([k,v])=>`<div class="kv"><b>${k}</b><span>${v}</span></div>`).join('')}
    </div></div>
    <div class="panel"><div class="t">TIER LIMITS</div><div class="pad">
    ${[['CLASSIC','$5 - $2,000'],['HIGH ROLLER','$100 - $50,000'],['VIP SALON','$1,000 - $1,000,000']].map(([k,v])=>`<div class="kv"><b>${k}</b><span class="mono">${v}</span></div>`).join('')}
    </div></div></div>`;
    C.querySelectorAll('button[data-room]').forEach(b=>b.onclick=async()=>{
      const r=await api('/api/bo/room',{id:b.dataset.room,state:b.dataset.next});
      if(r.ok){toast(`${b.dataset.room} → ${b.dataset.next.toUpperCase()}`);render('rooms');}
    });
  }
  if(id==='dealers'){
    C.innerHTML=`<div class="row">${ov.dealers.map(d=>{const [lbl,cls]=DSTATE(d);const full=d.key==='vera'?32:17;const pct=Math.min(100,Math.round(d.speak/full*100));
    return `<div class="kpi" style="min-width:250px;padding:0;overflow:hidden">
      <div style="position:relative"><img src="${PORTRAIT(d.key)}" alt="${d.name}" style="width:100%;aspect-ratio:16/10;object-fit:cover;display:block;filter:${d.speak===0&&d.clips===0?'saturate(.5) brightness(.75)':'none'}">
      <div style="position:absolute;top:10px;right:10px">${pill(lbl,cls)}</div>
      <div style="position:absolute;bottom:0;left:0;right:0;padding:24px 14px 10px;background:linear-gradient(transparent,rgba(10,11,13,.92))"><div style="font-family:'Space Grotesk';font-weight:700;font-size:17px">${d.name}</div><div class="mono" style="font-size:9px;letter-spacing:.12em;color:var(--mut)">${d.room.toUpperCase()}</div></div></div>
      <div style="padding:12px 14px">
      <div class="kv"><b>Clips</b><span class="mono">${d.clips} (${d.speak} speech)</span></div>
      <div class="kv"><b>Voice</b><span>${d.voice}</span></div>
      <div style="margin-top:10px" class="bar"><i style="width:${pct}%"></i></div>
      <div style="display:flex;gap:8px;margin-top:12px"><button onclick="window.open('/?dealer=${d.key}','_blank')">OPEN TABLE</button></div>
      </div>
    </div>`;}).join('')}</div>
    <div class="panel"><div class="t"><span>TABLE ASSIGNMENT &middot; CLICK A DEALER TO SEAT HER &middot; CHANGES THE LIVE GAME</span><span class="mono" style="font-size:8px;letter-spacing:.1em;color:var(--mut)">A DEALER BRINGS HER OWN ENVIRONMENT &middot; NEW DEALER+ROOM COMBOS = GENERATION PASS</span></div>
    <div class="pad" style="display:flex;flex-direction:column;gap:16px">
    ${Object.entries(ov.tiers).map(([t,cur])=>{
      return `<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;border:1px solid var(--line);border-radius:10px;padding:12px;background:var(--panel2)">
        <div style="position:relative;width:190px;flex-shrink:0"><img src="${ROOMIMG[DEALER_ROOM[cur]]}" style="width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:8px;display:block">
          <div class="mono" style="position:absolute;bottom:6px;left:8px;font-size:9px;letter-spacing:.14em;text-shadow:0 1px 4px #000">${TIERN[t]}</div></div>
        <div style="min-width:150px"><div style="font-family:'Space Grotesk';font-weight:600">${TIERN[t]}</div><div class="mono" style="font-size:10px;color:var(--mut)">${{classic:'$5 - $2,000',high:'$100 - $50,000',vip:'$1,000 - $1,000,000'}[t]}</div><div class="mono" style="font-size:9px;color:var(--lime);margin-top:3px">${({prive:'MAHOGANY PRIVÉ',darkhall:'DARK HALL',goldensalon:'GOLDEN SALON',azure:'AZURE VENUE'})[DEALER_ROOM[cur]]}</div></div>
        <div style="display:flex;gap:10px;flex:1;flex-wrap:wrap">
        ${ov.dealers.map(d=>{const on=d.key===cur;const ok=d.clips>0;const venue=({vera:'PRIVÉ',astrid:'DARK HALL',amira:'GOLDEN SALON',mei:'AZURE'})[d.key];
          return `<div ${ok?`data-tier="${t}" data-dealer="${d.key}"`:''} title="${d.name} &middot; ${venue}${ok?'':' — needs clips first (generate under Dealers)'}" style="cursor:${ok?'pointer':'not-allowed'};text-align:center;opacity:${ok?1:.35}">
            <img src="${PORTRAIT(d.key)}" style="width:58px;height:58px;object-fit:cover;border-radius:50%;display:block;border:2px solid ${on?'var(--lime)':'var(--line)'};box-shadow:${on?'0 0 0 3px rgba(214,255,58,.2)':'none'}">
            <div class="mono" style="font-size:8px;letter-spacing:.1em;margin-top:4px;color:${on?'var(--lime)':'var(--mut)'}">${d.name.toUpperCase()}</div>
            <div class="mono" style="font-size:7px;letter-spacing:.08em;color:var(--mut)">${venue}</div></div>`;}).join('')}
        </div></div>`;}).join('')}
    </div></div>`;
    C.querySelectorAll('[data-tier][data-dealer]').forEach(el=>el.onclick=async()=>{
      const r=await api('/api/bo/tier',{tier:el.dataset.tier,dealer:el.dataset.dealer});
      if(r.ok){toast(`${TIERN[el.dataset.tier]} → ${el.dataset.dealer.toUpperCase()} — live on next table load`);render('dealers');}
      else toast('rejected: '+r.error);
    });
  }
  if(id==='pit'){
    const cfg=await api('/api/bo/config');
    C.innerHTML=`<div class="panel"><div class="t">SUPERVISORS</div><table><thead><tr><th>PIT BOSS</th><th>MODEL</th><th>ROOMS</th><th>STATE</th></tr></thead><tbody>
    <tr><td>Kevin N.</td><td class="mono" style="color:var(--mut)">pitboss-kevin · 2 clips</td><td>Mahogany Privé · Dark Hall</td><td>${pill('ACTIVE','live')}</td></tr>
    <tr><td>Unassigned</td><td class="mono" style="color:var(--mut)">to generate</td><td>Golden Salon · Azure Venue</td><td>${pill('PENDING','pending')}</td></tr>
    </tbody></table></div>
    <div class="panel" style="max-width:520px"><div class="t">WALK-ON TRIGGERS</div><div class="pad">
      <div class="kv"><b>Payout above 10&times; stake</b><button data-k="payout10x">${cfg.pitboss.payout10x?'ON':'OFF'}</button></div>
      <div class="kv"><b>Win streak &ge; 5 rounds</b><button data-k="streak5">${cfg.pitboss.streak5?'ON':'OFF'}</button></div>
      <div class="kv"><b>Random floor walk</b><span class="mono">EVERY ${cfg.pitboss.randomWalkMin} MIN</span></div>
    </div></div>`;
    C.querySelectorAll('button[data-k]').forEach(b=>b.onclick=async()=>{
      const k=b.dataset.k;const cur=b.textContent==='ON';
      const r=await api('/api/bo/pitboss',{[k]:!cur});
      if(r.ok){b.textContent=cur?'OFF':'ON';toast('trigger updated');}
    });
  }
  if(id==='tours'){
    const cfg=await api('/api/bo/config');
    C.innerHTML=`<div class="panel"><div class="t"><span>TOURNAMENTS</span></div><table><thead><tr><th>NAME</th><th>FORMAT</th><th>BUY-IN</th><th>POOL</th><th>ENTRIES</th><th>STARTS</th><th>STATE</th></tr></thead><tbody>
    ${cfg.tournaments.map(t=>`<tr><td>${t.name}</td><td style="color:var(--mut)">${t.format}</td><td class="mono">${t.buyin?fmt(t.buyin):'Free'}</td><td class="mono">${fmt(t.pool)}</td><td class="mono">${t.entries}${t.cap?'/'+t.cap:''}</td><td style="color:var(--mut)">${t.starts}</td><td>${pill(t.state.toUpperCase(),t.state==='live'?'live':t.state==='registering'?'live':'pending')}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="panel" style="max-width:640px"><div class="t">NEW TOURNAMENT</div><div class="pad" style="display:flex;gap:10px;flex-wrap:wrap">
      <input id="tn" placeholder="Name" style="flex:2;min-width:180px">
      <input id="tf" placeholder="Format" style="flex:2;min-width:140px">
      <input id="tb" placeholder="Buy-in $" style="flex:1;min-width:90px">
      <input id="tp" placeholder="Pool $" style="flex:1;min-width:90px">
      <input id="ts" placeholder="Starts" style="flex:1;min-width:110px">
      <button class="pri" id="tc">CREATE</button>
    </div></div>`;
    $('#tc').onclick=async()=>{
      const b={name:$('#tn').value||'Untitled',format:$('#tf').value||'Elimination',buyin:+($('#tb').value||0),pool:+($('#tp').value||0),starts:$('#ts').value||'TBD'};
      const r=await api('/api/bo/tournament',b);
      if(r.ok){toast('tournament created');render('tours');}
    };
  }
  if(id==='players'){
    const p=await api('/api/bo/players');
    C.innerHTML=`<div class="panel"><div class="t">PLAYERS &middot; LIVE FROM THE GAME DATABASE</div><table><thead><tr><th>NAME</th><th>ID</th><th>CURRENCY</th><th>BALANCE</th><th>OPENED</th></tr></thead><tbody>
    ${p.players.map(x=>`<tr><td>${x.name}</td><td class="mono" style="color:var(--mut)">${x.id.slice(0,8)}&hellip;</td><td class="mono">${x.currency}</td><td class="mono">${x.currency==='USD'?fmt(x.balance):Number(x.balance).toLocaleString()+' '+x.currency}</td><td style="color:var(--mut)">${(x.created_at||'').slice(0,10)}</td></tr>`).join('')}
    </tbody></table></div>`;
  }
  if(id==='pay'){
    const p=await api('/api/bo/transactions');
    C.innerHTML=`<div class="panel"><div class="t"><span>TRANSACTION LEDGER &middot; LAST 100 &middot; LIVE</span><button id="csv">EXPORT CSV</button></div><table><thead><tr><th>AT</th><th>PLAYER</th><th>TYPE</th><th>AMOUNT</th><th>CCY</th><th>META</th></tr></thead><tbody>
    ${p.tx.map(x=>`<tr><td class="mono" style="color:var(--mut)">${(x.at||'').slice(5,16).replace('T',' ')}</td><td class="mono">${(x.player_id||'').slice(0,8)}&hellip;</td><td class="mono">${x.type}</td><td class="mono" style="color:${x.amount>=0?'var(--paper)':'var(--red)'}">${Number(x.amount).toLocaleString('en-US',{minimumFractionDigits:2})}</td><td class="mono">${x.currency}</td><td style="color:var(--mut)">${x.meta||''}</td></tr>`).join('')}
    </tbody></table></div>`;
    $('#csv').onclick=()=>{
      const rows=[['at','player','type','amount','currency','meta'],...p.tx.map(x=>[x.at,x.player_id,x.type,x.amount,x.currency,x.meta])];
      const blob=new Blob([rows.map(r=>r.map(c=>`"${String(c??'').replace(/"/g,'""')}"`).join(',')).join('\n')],{type:'text/csv'});
      const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='scout-ledger.csv';a.click();
    };
  }
  if(id==='shoes'){
    C.innerHTML=`<div class="row">
      <div class="kpi"><div class="l">RNG CERTIFICATE</div><div class="v" style="color:var(--lime)">VALID</div><div class="d">v2.1 · renews 2027-01</div></div>
      <div class="kpi"><div class="l">DECKS PER SHOE</div><div class="v">8</div><div class="d">416 cards</div></div>
      <div class="kpi"><div class="l">RESHUFFLE</div><div class="v">EVERY ROUND</div><div class="d">no penetration play</div></div>
      <div class="kpi"><div class="l">ROUNDS LOGGED TODAY</div><div class="v">${sum('deal').n}</div><div class="d">full hand history</div></div>
    </div>
    <div class="panel" style="max-width:640px"><div class="t">INTEGRITY</div><div class="pad">
    ${[['Outcome source','Certified RNG - fresh 8-deck shoe every round'],['Dealer knowledge of cards','None, by design'],['Card back','Scout-branded (assets/cardback-scout-branded)'],['End-card compliance','18+ · play responsibly · licence line']].map(([k,v])=>`<div class="kv"><b>${k}</b><span style="text-align:right">${v}</span></div>`).join('')}
    </div></div>`;
  }
}
addEventListener('hashchange',()=>render(location.hash.slice(1)||'ops'));
render(location.hash.slice(1)||'ops');
