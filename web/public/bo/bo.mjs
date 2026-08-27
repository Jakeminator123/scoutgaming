// Scout Live Casino backoffice - live data from the game server.
const $=s=>document.querySelector(s);
const fmt=n=>'$'+Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const pill=(t,k)=>`<span class="pill ${k}">${t}</span>`;
const toast=t=>{const e=$('#toast');e.textContent=t;e.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('on'),2200);};
const api=async(p,body)=>{const r=await fetch(p,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:undefined);return r.json();};

const SECTIONS=[
 ['ops','Operations','SCOUT LIVE CASINO · ALL SYSTEMS'],
 ['voice','Voice Lines','SYNC VERIFICATION · EVERY TAKE, AS THE GAME PLAYS IT'],
 ['rooms','Tables & Rooms','ROOMS · TIERS · RULES'],
 ['dealers','Dealers','EVERY FACE · ROSTER & PIPELINE'],
 ['pit','Pit Bosses','SUPERVISION · FAIRNESS'],
 ['tours','Tournaments','COMPETITIVE BLACKJACK'],
 ['players','Players','ACCOUNTS · SESSIONS · RG'],
 ['pay','Payments','WALLET · LEDGER'],
 ['shoes','Shoes & Decks','GAME INTEGRITY · RNG'],
];
const ICONS={voice:'<path d="M12 4 v16 M8 8 v8 M16 8 v8 M4 11 v2 M20 11 v2"/>',ops:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
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

async function render(id){
  document.querySelectorAll('#nav a').forEach(a=>a.classList.toggle('on',a.dataset.id===id));
  const meta=SECTIONS.find(s=>s[0]===id)||SECTIONS[0];
  $('#title').textContent=meta[1]; $('#sub').textContent=meta[2];
  const C=$('#content'); C.innerHTML='<div class="mono" style="color:var(--mut);font-size:11px">loading&hellip;</div>';
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
  if(id==='voice'){
    const vl=await api('/api/bo/voicelines');
    C.innerHTML=vl.dealers.filter(d=>d.lines.length).map(d=>`
    <div class="panel"><div class="t"><span>${d.name.toUpperCase()} &middot; ${d.lines.filter(l=>l.clip).length} LIP-SYNCED &middot; ${d.lines.filter(l=>!l.clip).length} VOICE-OVER</span></div>
    <div class="pad" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px">
    ${d.lines.map(l=>`
      <div style="border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--panel2)">
        ${l.preview?`<video src="${l.preview}" preload="none" controls playsinline style="width:100%;aspect-ratio:1;display:block;background:#000"></video>`
                   :`<div style="width:100%;aspect-ratio:2.6;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;background:#000">
                      <audio src="${l.audio}" controls preload="none" style="width:88%;height:30px"></audio>
                      <span class="mono" style="font-size:8px;letter-spacing:.12em;color:var(--mut)">VOICE ONLY - NO CLIP YET</span></div>`}
        <div style="padding:9px 11px">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:6px">
            <span class="mono" style="font-size:10px;letter-spacing:.1em">${l.key.toUpperCase()}</span>
            ${l.clip?pill((l.delay??0)+'MS','live'):pill('VOICE-OVER','pending')}
          </div>
          <div style="font-size:11px;color:var(--mut);margin-top:4px">${l.text||'&mdash;'}</div>
        </div>
      </div>`).join('')}
    </div></div>`).join('');
  }
  if(id==='rooms'){
    C.innerHTML=`<div class="row">${ov.rooms.map(r=>{const d=ov.dealers.find(x=>x.key===r.dealer)||{};
    return `<div class="kpi" style="min-width:280px;padding:0;overflow:hidden">
      <div style="position:relative"><img src="${ROOMIMG[r.id]}" style="width:100%;aspect-ratio:16/9;object-fit:cover;display:block">
      <div style="position:absolute;top:10px;right:10px">${pill(r.state.toUpperCase(),r.state)}</div>
      <img src="${PORTRAIT(r.dealer)}" title="${d.name||''}" style="position:absolute;bottom:-14px;left:14px;width:44px;height:44px;object-fit:cover;object-position:top;border-radius:50%;border:2px solid var(--panel)"></div>
      <div style="padding:20px 14px 12px">
      <div style="font-family:'Space Grotesk';font-weight:700;font-size:16px">${r.name}</div>
      <div class="kv" style="margin-top:6px"><b>Scene</b><span>${r.scene}</span></div>
      <div class="kv"><b>Felt</b><span>${r.felt}</span></div>
      <div class="kv"><b>Dealer</b><span>${d.name||'-'}</span></div>
      </div></div>`;}).join('')}</div>
    <div class="grid2"><div class="panel"><div class="t">HOUSE RULES &middot; ALL TABLES</div><div class="pad">
    ${[['Decks','8, reshuffled every round'],['Dealer stands','All 17s'],['Blackjack pays','3 : 2'],['Insurance pays','2 : 1'],['Split','Any pair, up to 4 hands'],['Split aces','One card each'],['Double after split','Allowed'],['Side bets','Perfect Pairs 25:1 · 21+3 100:1']].map(([k,v])=>`<div class="kv"><b>${k}</b><span>${v}</span></div>`).join('')}
    </div></div>
    <div class="panel"><div class="t">TIER LIMITS</div><div class="pad">
    ${[['CLASSIC','$5 - $2,000'],['HIGH ROLLER','$100 - $50,000'],['VIP SALON','$1,000 - $1,000,000']].map(([k,v])=>`<div class="kv"><b>${k}</b><span class="mono">${v}</span></div>`).join('')}
    </div></div></div>`;
  }
  if(id==='dealers'){
    C.innerHTML=`<div class="row">${ov.dealers.map(d=>{const [lbl,cls]=DSTATE(d);const full=d.key==='vera'?32:17;const pct=Math.min(100,Math.round(d.speak/full*100));
    return `<div class="kpi" style="min-width:250px;padding:0;overflow:hidden">
      <div style="position:relative"><img src="${PORTRAIT(d.key)}" alt="${d.name}" style="width:100%;aspect-ratio:16/10;object-fit:cover;object-position:top;display:block;filter:${d.speak===0&&d.clips===0?'saturate(.5) brightness(.75)':'none'}">
      <div style="position:absolute;top:10px;right:10px">${pill(lbl,cls)}</div>
      <div style="position:absolute;bottom:0;left:0;right:0;padding:24px 14px 10px;background:linear-gradient(transparent,rgba(10,11,13,.92))"><div style="font-family:'Space Grotesk';font-weight:700;font-size:17px">${d.name}</div><div class="mono" style="font-size:9px;letter-spacing:.12em;color:var(--mut)">${d.room.toUpperCase()}</div></div></div>
      <div style="padding:12px 14px">
      <div class="kv"><b>Clips</b><span class="mono">${d.clips} (${d.speak} speech)</span></div>
      <div class="kv"><b>Voice</b><span>${d.voice}</span></div>
      <div style="margin-top:10px" class="bar"><i style="width:${pct}%"></i></div>
      <div style="display:flex;gap:8px;margin-top:12px"><button onclick="window.open('/?dealer=${d.key}','_blank')">OPEN TABLE</button></div>
      </div>
    </div>`;}).join('')}</div>
    <div class="panel"><div class="t">TABLE ASSIGNMENT &middot; CLICK A DEALER TO SEAT HER &middot; CHANGES THE LIVE GAME</div>
    <div class="pad" style="display:flex;flex-direction:column;gap:16px">
    ${Object.entries(ov.tiers).map(([t,cur])=>{
      return `<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;border:1px solid var(--line);border-radius:10px;padding:12px;background:var(--panel2)">
        <div style="position:relative;width:190px;flex-shrink:0"><img src="${ROOMIMG[DEALER_ROOM[cur]]}" style="width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:8px;display:block">
          <div class="mono" style="position:absolute;bottom:6px;left:8px;font-size:9px;letter-spacing:.14em;text-shadow:0 1px 4px #000">${TIERN[t]}</div></div>
        <div style="min-width:130px"><div style="font-family:'Space Grotesk';font-weight:600">${TIERN[t]}</div><div class="mono" style="font-size:10px;color:var(--mut)">${{classic:'$5 - $2,000',high:'$100 - $50,000',vip:'$1,000 - $1,000,000'}[t]}</div></div>
        <div style="display:flex;gap:10px;flex:1;flex-wrap:wrap">
        ${ov.dealers.map(d=>{const on=d.key===cur;const ok=d.clips>0;
          return `<div data-tier="${t}" data-dealer="${d.key}" title="${d.name}${ok?'':' - no clips yet'}" style="cursor:${ok?'pointer':'not-allowed'};text-align:center;opacity:${ok?1:.35}">
            <img src="${PORTRAIT(d.key)}" style="width:58px;height:58px;object-fit:cover;object-position:top;border-radius:50%;display:block;border:2px solid ${on?'var(--lime)':'var(--line)'};box-shadow:${on?'0 0 0 3px rgba(214,255,58,.2)':'none'}">
            <div class="mono" style="font-size:8px;letter-spacing:.1em;margin-top:4px;color:${on?'var(--lime)':'var(--mut)'}">${d.name.toUpperCase()}</div></div>`;}).join('')}
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
