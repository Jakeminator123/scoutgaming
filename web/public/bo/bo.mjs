// Scout Live Casino backoffice - live data from the game server.
import { createSinglePreviewController } from './media-preview.mjs';
import { canOpenLab, workspaceUrl, isEmbeddedWorkspace } from './workspace-navigation.mjs';

const $=s=>document.querySelector(s);
const fmt=n=>'$'+Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const pill=(t,k)=>`<span class="pill ${k}">${t}</span>`;
const toast=t=>{const e=$('#toast');e.textContent=t;e.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('on'),2200);};
const api=async(p,body)=>{const r=await fetch(p,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:undefined);return r.json();};
const labWorkspace=workspaceUrl(location.href);
document.body.classList.toggle('lab-embedded',isEmbeddedWorkspace(location.href,document.referrer,parent!==window));
api('/api/bo/me').then(me=>{
  $('#account-name').textContent=me.user||'Ej inloggad';
  $('#account-avatar').textContent=me.user?.slice(0,1).toUpperCase()||'?';
  $('#account-role').textContent=me.role?.toUpperCase()||'INGEN BEHÖRIGHET';
  const link=$('#workspace-link');
  if(canOpenLab(me.role)&&labWorkspace){link.hidden=false;link.href=labWorkspace;link.target='_top';}
}).catch(()=>{$('#account-role').textContent='KUNDE INTE LÄSA BEHÖRIGHET';});

const SECTIONS=[
 ['ops','Operations','SCOUT LIVE CASINO · ALL SYSTEMS'],
 ['voice','Voice Lines','SYNC VERIFICATION · EVERY TAKE, AS THE GAME PLAYS IT'],
 ['clips','Äldre klipp och granskning','ÄLDRE BO-VAL · AKTIVA KLIPPVAL SPARAS I LAB'],
 ['gens','Generations','EVERY HIGGSFIELD VIDEO · WITH ITS PROMPT'],
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
const ICONS={gens:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M10 9 l5 3 -5 3 z"/>',apikeys:'<circle cx="8" cy="14" r="4"/><path d="M11 11 L20 2 M16 6 l2 2 M13 9 l2 2"/>',clips:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9 l5 3 -5 3 Z"/>',users:'<circle cx="12" cy="8" r="3.5"/><path d="M5 20 c1.2-4.5 4-6.5 7-6.5 s5.8 2 7 6.5"/><path d="M17 3 l1 2 2 .3 -1.5 1.5 .4 2 -1.9 -1 -1.9 1 .4 -2 L14 5.3 16 5 Z"/>',emails:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7 l9 6 9-6"/>',voice:'<path d="M12 4 v16 M8 8 v8 M16 8 v8 M4 11 v2 M20 11 v2"/>',ops:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
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
  if(!SECTIONS.some(section=>section[0]===id))id='ops';
  render.closePreview?.(false);
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
  if(id==='gens'){
    const [gens,vr]=await Promise.all([fetch('/bo/generations.json').then(r=>r.json()),api('/api/bo/gen-verdicts')]);
    let verdicts=vr.genVerdicts??{};let landings=vr.genLandings??{};const GPARTS=vr.parts??['box0','box1','box2','box3','box4','box5','box6','dealer-up','dealer-hole','return','idle'];
    const GP={box0:'Box 0 (far left)',box1:'Box 1',box2:'Box 2',box3:'Box 3 (centre)',box4:'Box 4',box5:'Box 5',box6:'Box 6 (far right)','dealer-up':'Dealer upcard','dealer-hole':'Dealer hole card',return:'Return to idle',idle:'Idle'};
    const landBadge=id=>landings[id]?`<span class="pill live" style="background:#7cc6ff;color:#111">&#9673; LANDED &middot; ${(GP[landings[id].part]||landings[id].part).toUpperCase()}</span>`:'';
    const st=render.genState??={q:'',model:'',croupier:true,v:'todo',land:''};
    const models=[...new Set(gens.map(g=>g.model))].sort();
    const byId=Object.fromEntries(gens.map(g=>[g.id,g]));
    const esc=t=>String(t??'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
    const thumb=g=>g.thumb?`/bo/gen/${g.id}-thumb${(g.thumb.match(/\.\w+$/)||['.jpg'])[0]}`:'';
    const badge=g=>{const v=verdicts[g.id]?.verdict;return v==='want'?pill('&#10003; WANT','live'):v==='no'?`<span class="pill" style="border-color:var(--red);color:var(--red)">&#10006; DON'T WANT</span>`:'';};
    const setVerdict=async(id,verdict,reason)=>{const r=await api('/api/bo/gen-verdict',{id,verdict,reason});if(!r.ok){toast(r.error||'failed');return false;}verdicts=r.genVerdicts;return true;};
    const draw=()=>{
      mediaPreviews.release(C);
      const q=st.q.toLowerCase();
      const base=gens.filter(g=>(!st.croupier||g.croupier)&&(!st.model||g.model===st.model)&&(!q||g.prompt.toLowerCase().includes(q)||g.id.includes(q))&&(!st.land||(st.land==='verified'?!!landings[g.id]:st.land==='unmarked'?!landings[g.id]:landings[g.id]?.part===st.land)));
      const count=k=>base.filter(g=>k==='all'||(k==='todo'?!verdicts[g.id]:verdicts[g.id]?.verdict===k)).length;
      const list=base.filter(g=>st.v==='all'||(st.v==='todo'?!verdicts[g.id]:verdicts[g.id]?.verdict===st.v));
      C.innerHTML=`<div class="panel"><div class="t">FILTERS &middot; ${list.length} OF ${gens.length} GENERATIONS</div><div class="pad" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <input id="g-q" value="${esc(st.q)}" placeholder="search prompts" style="flex:1;min-width:200px;padding:6px 8px;background:var(--panel);border:1px solid var(--line);border-radius:6px;color:var(--paper)">
        <select id="g-model"><option value="">All models</option>${models.map(m=>`<option ${st.model===m?'selected':''}>${m}</option>`).join('')}</select>
        <label style="font-size:11px;display:flex;gap:6px;align-items:center"><input type="checkbox" id="g-cr" ${st.croupier?'checked':''}> Croupier only</label>
        <select id="g-land"><option value="">Landed at: any</option><option value="verified" ${st.land==='verified'?'selected':''}>Landed at: marked</option><option value="unmarked" ${st.land==='unmarked'?'selected':''}>Landed at: not marked</option>${GPARTS.map(p=>`<option value="${p}" ${st.land===p?'selected':''}>Landed at: ${GP[p]||p}</option>`).join('')}</select>
        <span style="display:flex;border:1px solid var(--line);border-radius:8px;overflow:hidden">${[['todo','UNREVIEWED'],['want','&#10003; WANT'],['no',"&#10006; DON'T WANT"],['all','ALL']].map(([k,l])=>`<button data-v="${k}" style="border:0;border-radius:0;${st.v===k?(k==='no'?'background:rgba(255,80,80,.18);color:var(--red)':'background:rgba(214,255,58,.15);color:var(--lime)'):''}">${l} (${count(k)})</button>`).join('')}</span>
        ${list.length?`<button id="g-swipe" style="margin-left:auto;background:var(--lime);color:#111;border-color:var(--lime)">&#8646; SWIPE MODE (${list.length})</button>`:''}
      </div></div>
      <div class="pad" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px">
      ${list.map(g=>`<div data-g="${g.id}" style="border:1px solid ${verdicts[g.id]?.verdict==='want'?'var(--lime)':verdicts[g.id]?.verdict==='no'?'var(--red)':'var(--line)'};border-radius:10px;overflow:hidden;background:var(--panel2);position:relative">
        <div style="position:absolute;top:8px;left:8px;z-index:2;display:flex;gap:4px">${badge(g)}<span data-gland-badge="${g.id}">${landBadge(g.id)}</span></div>
        <video data-bo-preview src="/bo/gen/${g.id}.mp4" poster="${thumb(g)}" preload="none" controls muted playsinline style="width:100%;aspect-ratio:16/9;display:block;background:#000;object-fit:contain"></video>
        <div style="padding:9px 11px">
          <div style="display:flex;justify-content:space-between;gap:6px"><span class="mono" style="font-size:10px">${g.at.replace('T',' ')}</span>${pill(g.model,'live')}</div>
          <div style="font-size:10px;color:var(--mut);margin-top:3px">${g.duration?g.duration+'s':''}${g.aspect?' &middot; '+g.aspect:''} &middot; <span class="mono">${g.id.slice(0,8)}</span>${verdicts[g.id]?.reason?` &middot; ${esc(verdicts[g.id].reason)}`:''}</div>
          <div data-p style="font-size:11px;margin-top:6px;line-height:1.45;display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden;cursor:pointer" title="click to expand">${esc(g.prompt)||'<span style="color:var(--mut)">no prompt</span>'}</div>
          <div style="margin-top:8px;display:flex;gap:6px;align-items:center;flex-wrap:wrap"><span class="mono" style="font-size:9px;letter-spacing:.1em;color:var(--mut);white-space:nowrap">LANDED AT</span><select data-gland-part="${g.id}" style="flex:1 1 130px;min-width:0"><option value="">not marked</option>${GPARTS.map(p=>`<option value="${p}" ${landings[g.id]?.part===p?'selected':''}>${GP[p]||p}</option>`).join('')}</select><input data-gland-note="${g.id}" value="${esc(landings[g.id]?.note)}" placeholder="note" style="flex:1 1 80px;min-width:0;font-size:11px;padding:4px 6px;background:var(--panel);border:1px solid var(--line);border-radius:6px;color:var(--paper)"><button data-gland="${g.id}" style="flex:0 0 auto;border-color:#7cc6ff;color:#7cc6ff;font-size:9px">MARK</button></div>
          <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">
            ${(v=>`<button data-set="${g.id}" data-to="want" style="font-size:9px;${v==='want'?'background:var(--lime);color:#111;border-color:var(--lime)':'border-color:var(--lime);color:var(--lime)'}">&#10003; WANT</button><button data-set="${g.id}" data-to="no" style="font-size:9px;${v==='no'?'background:var(--red);color:#111;border-color:var(--red)':'border-color:rgba(255,80,80,.5);color:var(--red)'}">&#10006; DON'T WANT</button>${v?`<button data-set="${g.id}" data-to="" style="font-size:9px">&#8630; UNDO</button>`:''}`)(verdicts[g.id]?.verdict)}
            <button data-copy="${g.id}" style="font-size:9px">COPY PROMPT</button><a href="/bo/gen/${g.id}.mp4" download style="font-size:9px" class="mono">MP4</a></div>
        </div></div>`).join('')}</div>`;
      mediaPreviews.bind(C);
      $('#g-q').oninput=e=>{st.q=e.target.value;clearTimeout(draw.t);draw.t=setTimeout(()=>{if(location.hash!=='#gens')return;draw();const i=$('#g-q');i.focus();i.setSelectionRange(i.value.length,i.value.length);},250);};
      $('#g-model').onchange=e=>{st.model=e.target.value;draw();};
      $('#g-cr').onchange=e=>{st.croupier=e.target.checked;draw();};
      $('#g-land').onchange=e=>{st.land=e.target.value;draw();};
      C.querySelectorAll('[data-gland]').forEach(b=>b.onclick=async()=>{const id=b.dataset.gland;const part=C.querySelector(`[data-gland-part="${id}"]`).value;const note=C.querySelector(`[data-gland-note="${id}"]`).value;const r=await api('/api/bo/gen-landing',{id,part:part||null,note});if(!r.ok){toast(r.error||'failed');return;}landings=r.genLandings;const bd=C.querySelector(`[data-gland-badge="${id}"]`);if(bd)bd.innerHTML=landBadge(id);const t=b.textContent;b.textContent='\u2713 MARKED';b.style.background='#7cc6ff';b.style.color='#111';setTimeout(()=>{b.textContent=t;b.style.background='';b.style.color='';},1400);toast(part?`${id.slice(0,8)} landed at ${GP[part]||part}`:'landing cleared');});
      C.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>{st.v=b.dataset.v;draw();});
      C.querySelectorAll('[data-p]').forEach(el=>el.onclick=()=>{el.style.webkitLineClamp=el.style.webkitLineClamp==='unset'?'5':'unset';});
      C.querySelectorAll('[data-copy]').forEach(b=>b.onclick=async()=>{try{await navigator.clipboard.writeText(byId[b.dataset.copy].prompt);}catch{}toast('prompt copied');});
      C.querySelectorAll('[data-set]').forEach(b=>b.onclick=async()=>{if(await setVerdict(b.dataset.set,b.dataset.to||null)){toast(b.dataset.to==='want'?'want':b.dataset.to==='no'?"don't want":'reset');draw();}});
      const sw=$('#g-swipe');if(sw)sw.onclick=()=>swipe(list.map(g=>g.id));
    };
    // Swipe mode: right = want, left = don't want, Z = undo, Esc = close.
    const swipe=ids=>{
      mediaPreviews.release(C);
      let i=0,busy=false,closed=false;const hist=[];const ov=document.createElement('div');
      ov.style.cssText='position:fixed;inset:0;z-index:50;background:rgba(0,0,0,.94);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:16px;touch-action:none';
      document.body.appendChild(ov);
      const close=(redraw=true)=>{if(closed)return;closed=true;document.removeEventListener('keydown',key);mediaPreviews.release(ov);ov.remove();render.closePreview=null;if(redraw)draw();};
      render.closePreview=close;
      const show=()=>{
        if(closed)return;
        mediaPreviews.release(ov);
        if(i>=ids.length){ov.innerHTML=`<div class="mono" style="letter-spacing:.14em;color:var(--lime)">ALL ${ids.length} SWIPED</div><div style="display:flex;gap:10px">${hist.length?'<button data-u>&#8630; UNDO</button>':''}<button data-x>CLOSE</button></div>`;ov.querySelector('[data-x]').onclick=close;const u=ov.querySelector('[data-u]');if(u)u.onclick=undo;return;}
        const g=byId[ids[i]];
        ov.innerHTML=`<div class="mono" style="font-size:10px;letter-spacing:.14em;color:var(--mut)">${i+1} / ${ids.length} &middot; &larr; DON'T WANT &middot; &rarr; WANT &middot; Z UNDO &middot; ESC CLOSE</div>
          <div data-card style="width:min(820px,100%);border:1px solid var(--line);border-radius:14px;overflow:hidden;background:var(--panel2);transition:transform .22s,opacity .22s;position:relative;cursor:grab">
            <div style="position:absolute;top:16px;left:16px;right:16px;z-index:2;display:flex;justify-content:space-between;pointer-events:none"><span data-l class="mono" style="opacity:0;border:2px solid var(--red);color:var(--red);padding:4px 10px;border-radius:6px;letter-spacing:.14em;background:rgba(0,0,0,.6)">DON'T WANT</span><span data-r class="mono" style="opacity:0;border:2px solid var(--lime);color:var(--lime);padding:4px 10px;border-radius:6px;letter-spacing:.14em;background:rgba(0,0,0,.6)">WANT</span></div>
            <video data-bo-preview src="/bo/gen/${g.id}.mp4" poster="${thumb(g)}" autoplay loop muted playsinline style="width:100%;max-height:55vh;display:block;background:#000;object-fit:contain;pointer-events:none"></video>
            <div style="padding:10px 14px"><div style="display:flex;justify-content:space-between;gap:8px"><span class="mono" style="font-size:10px">${g.at.replace('T',' ')} &middot; ${g.duration?g.duration+'s':''} &middot; ${g.id.slice(0,8)}</span>${pill(g.model,'live')}</div>
            <div style="font-size:11px;margin-top:6px;line-height:1.45;max-height:16vh;overflow:auto">${esc(g.prompt)}</div></div>
          </div>
          <input data-reason placeholder="why not (optional)" style="width:min(820px,100%);font-size:12px;padding:6px 8px;background:var(--panel);border:1px solid var(--line);border-radius:6px;color:var(--paper)">
          <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center"><button data-a="left" style="border-color:rgba(255,80,80,.5);color:var(--red);padding:10px 18px">&#10006; DON'T WANT</button><button data-a="skip" style="padding:10px 18px">SKIP</button><button data-a="right" style="border-color:var(--lime);color:var(--lime);padding:10px 18px">&#10003; WANT</button><button data-u ${hist.length?'':'disabled'}>&#8630; UNDO</button><button data-x>CLOSE</button></div>`;
        mediaPreviews.bind(ov);
        ov.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>act(b.dataset.a));
        ov.querySelector('[data-u]').onclick=undo;ov.querySelector('[data-x]').onclick=close;
        const card=ov.querySelector('[data-card]');let x0=null,dx=0;
        card.onpointerdown=e=>{x0=e.clientX;card.setPointerCapture(e.pointerId);card.style.transition='none';};
        card.onpointermove=e=>{if(x0===null)return;dx=e.clientX-x0;card.style.transform=`translateX(${dx}px) rotate(${dx/20}deg)`;ov.querySelector('[data-l]').style.opacity=Math.max(0,-dx/120);ov.querySelector('[data-r]').style.opacity=Math.max(0,dx/120);};
        card.onpointerup=()=>{if(x0===null)return;x0=null;card.style.transition='';if(dx>120)act('right');else if(dx<-120)act('left');else{card.style.transform='';ov.querySelectorAll('[data-l],[data-r]').forEach(e=>e.style.opacity=0);}dx=0;};
      };
      const act=async dir=>{
        const g=byId[ids[i]];if(!g||busy||closed)return;busy=true;
        try{
          const prev=verdicts[g.id]?.verdict??null;
          if(dir!=='skip'){const ok=await setVerdict(g.id,dir==='right'?'want':'no',dir==='left'?ov.querySelector('[data-reason]').value:'');if(!ok)return;}
          if(closed)return;
          hist.push({id:g.id,prev,skip:dir==='skip'});
          const card=ov.querySelector('[data-card]');card.style.transform=dir==='left'?'translateX(-120vw) rotate(-25deg)':dir==='right'?'translateX(120vw) rotate(25deg)':'translateY(-120vh)';card.style.opacity=0;
          await new Promise(r=>setTimeout(r,220));i++;show();
        }finally{busy=false;}
      };
      const undo=async()=>{const h=hist.pop();if(!h)return;if(!h.skip)await setVerdict(h.id,h.prev);i--;show();toast('undone');};
      const key=e=>{if(e.target.matches('input,select'))return;if(e.key==='ArrowLeft')act('left');else if(e.key==='ArrowRight')act('right');else if(e.key==='ArrowDown'||e.key===' '){e.preventDefault();act('skip');}else if(e.key==='z'||e.key==='Backspace')undo();else if(e.key==='Escape')close();};
      document.addEventListener('keydown',key);
      show();
    };
    draw();
    return;
  }
  if(id==='clips'){
    const lib=await api('/api/bo/clips');
    const st=render.clipState??={dealer:'astrid',part:'',mode:'all',landing:''};
    const PARTN={box0:'Box 0',box1:'Box 1',box2:'Box 2',box3:'Box 3',box4:'Box 4',box5:'Box 5',box6:'Box 6','dealer-up':'Dealer upcard','dealer-hole':'Dealer hole card',return:'Return to idle',idle:'Idle'};
    const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
    const draw=()=>{
      mediaPreviews.release(C);
      const never=lib.neverAgain??{},land=lib.landings??{},assignments=lib.assignments?.[st.dealer]??{};
      const clips=lib.clips.filter(clip=>(!st.dealer||clip.dealer===st.dealer)&&(!st.part||clip.part===st.part)
        &&(st.mode==='never'?Boolean(never[clip.id]):st.mode==='all'||!never[clip.id])
        &&(!st.landing||(st.landing==='verified'?Boolean(land[clip.id]):!land[clip.id])));
      C.innerHTML=`<div class="panel"><div class="t">AKTIVA KLIPPVAL REDIGERAS I BACKOFFICE/LAB</div><div class="pad">
        <p>Det här är den äldre BO-katalogen. Äldre tilldelningar visas för granskning och är inte aktiva klippval. Lab:s sparade projekt styr spelarnas klippflöden.</p>
        ${labWorkspace?`<a href="${esc(labWorkspace)}#upload" target="_top" style="color:var(--lime)">Öppna Studio och aktiva klippval →</a>`:'<p>Öppna den konfigurerade Lab-arbetsytan för att ändra klippval.</p>'}
        <p>Never again är en granskningsspärr som kan göra en befintlig äldre Lab-koppling inaktiv; den ändrar inte Studios separata mediaPolicy. Landningsanteckningar väljer inga klipp och bevisar inte godkänd synk.</p>
      </div></div><div class="panel"><div class="t">FILTER · ${clips.length} AV ${lib.clips.length} KLIPP</div><div class="pad" style="display:flex;gap:10px;flex-wrap:wrap">
        <select id="cf-dealer"><option value="">Alla dealers</option>${lib.dealers.map(dealer=>`<option value="${esc(dealer.key)}" ${st.dealer===dealer.key?'selected':''}>${esc(dealer.name)}</option>`).join('')}</select>
        <select id="cf-part"><option value="">Alla bordsdelar</option>${lib.parts.map(part=>`<option value="${esc(part)}" ${st.part===part?'selected':''}>${esc(PARTN[part]||part)}</option>`).join('')}</select>
        <select id="cf-mode">${[['all','Alla klipp'],['keep','Ej markerade Never again'],['never','Never again']].map(([id,label])=>`<option value="${id}" ${st.mode===id?'selected':''}>${label}</option>`).join('')}</select>
        <select id="cf-landing"><option value="">Alla landningsanteckningar</option><option value="verified" ${st.landing==='verified'?'selected':''}>Markerade</option><option value="unverified" ${st.landing==='unverified'?'selected':''}>Ej markerade</option></select>
      </div></div>${st.dealer?`<div class="panel"><div class="t">ÄLDRE BO-TILLDELNINGAR · ${esc(st.dealer.toUpperCase())} · INAKTIVA I ORDINARIE KLIPPURVAL</div><div class="pad">
        ${Object.entries(assignments).length?Object.entries(assignments).map(([part,assignment])=>`<div class="kv"><b>${esc(PARTN[part]||part)}</b><code>${esc(assignment.clip)}</code></div>`).join(''):'Inga äldre tilldelningar.'}
      </div></div>`:''}<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:12px">
        ${clips.map(clip=>`<div class="panel">
          ${clip.src?`<video data-bo-preview src="/${esc(clip.src)}" controls playsinline preload="metadata" style="width:100%;max-height:260px;object-fit:contain;background:#000"></video>`:'<div class="pad mono">Ingen MP4-förhandsvisning</div>'}
          ${clip.audio&&!clip.src?`<audio data-bo-preview src="/${esc(clip.audio)}" controls preload="none" style="width:100%"></audio>`:''}
          <div class="pad"><strong>${esc(clip.name)}</strong><div class="mono" style="font-size:10px;color:var(--mut)">${esc(clip.dealer)} · ${esc(PARTN[clip.part]||clip.part||'utan bordsdel')} · ${esc(clip.kind)} · ${esc(clip.id)}</div>
          ${clip.text?`<p>${esc(clip.text)}</p>`:''}<small>Källa: ${esc(clip.route||clip.src||clip.audio||'engine')}</small>
          ${never[clip.id]?`<p style="color:var(--red)">Never again · ${esc(never[clip.id].reason)}</p><button data-restore="${esc(clip.id)}">Ångra granskningsmarkering</button>`:`<div style="display:flex;gap:6px;margin-top:12px"><input data-never-note="${esc(clip.id)}" placeholder="Granskningsorsak"><button data-never="${esc(clip.id)}">Never again</button></div>`}
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:12px"><label>Observerad landning <select data-land-part="${esc(clip.id)}"><option value="">Ej markerad</option>${lib.parts.map(part=>`<option value="${esc(part)}" ${land[clip.id]?.part===part?'selected':''}>${esc(PARTN[part]||part)}</option>`).join('')}</select></label><input data-land-note="${esc(clip.id)}" value="${esc(land[clip.id]?.note)}" placeholder="Landningsanteckning"><button data-land="${esc(clip.id)}">Spara granskningsanteckning</button></div>
          </div></div>`).join('')}</div>`;
      for(const [id,key] of [['cf-dealer','dealer'],['cf-part','part'],['cf-mode','mode'],['cf-landing','landing']])C.querySelector('#'+id).onchange=event=>{st[key]=event.target.value;draw();};
      C.querySelectorAll('[data-never]').forEach(button=>button.onclick=async()=>{
        const clip=button.dataset.never,reason=C.querySelector(`[data-never-note="${CSS.escape(clip)}"]`).value;
        const result=await api('/api/bo/clip-never',{clip,reason});if(!result.ok){toast(result.error||'Kunde inte spara.');return;}lib.neverAgain=result.neverAgain;lib.assignments=result.assignments;draw();
      });
      C.querySelectorAll('[data-restore]').forEach(button=>button.onclick=async()=>{
        const result=await api('/api/bo/clip-never',{clip:button.dataset.restore,undo:true});if(!result.ok){toast(result.error||'Kunde inte spara.');return;}lib.neverAgain=result.neverAgain;lib.assignments=result.assignments;draw();
      });
      C.querySelectorAll('[data-land]').forEach(button=>button.onclick=async()=>{
        const clip=button.dataset.land,part=C.querySelector(`[data-land-part="${CSS.escape(clip)}"]`).value,note=C.querySelector(`[data-land-note="${CSS.escape(clip)}"]`).value;
        const result=await api('/api/bo/clip-landing',{clip,part,note});if(!result.ok){toast(result.error||'Kunde inte spara.');return;}lib.landings=result.landings;toast('Granskningsanteckning sparad.');draw();
      });
      mediaPreviews.bind(C);
    };
    draw();return;
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
