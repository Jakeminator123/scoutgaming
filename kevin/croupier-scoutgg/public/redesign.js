// Kevin 27 Oct, Claude Design "Privé Blackjack" handoff: everything around the felt follows the new design (header,
// dealer pill, one dock per phase, a status bar, the result over the table, chat and menu as sheets). The felt, the
// boxes and the cards are not touched. Every control here only forwards to the existing button, so the game logic
// and the server calls stay where they were. Styles in redesign.css.
const $ = s => document.querySelector(s);
const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
const icon = name => `<span class="rd-ic" aria-hidden="true">${ICONS[name]}</span>`;
const ICONS = {
  menu: '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  sound: '<svg viewBox="0 0 24 24"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
  muted: '<svg viewBox="0 0 24 24"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>',
  chat: '<svg viewBox="0 0 24 24"><path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H10l-4.5 3.5V16H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  seat: '<svg viewBox="0 0 24 24"><path d="M7 4v8h10M7 12v8M17 12v8M5 12h14"/></svg>',
  tune: '<svg viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>',
  rules: '<svg viewBox="0 0 24 24"><path d="M5 5.5A1.5 1.5 0 0 1 6.5 4H19v14H6.5A1.5 1.5 0 0 0 5 19.5zM5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3"/></svg>',
  info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.6v.1"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M5 9h11v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4zM16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5v2.5M11.5 3.5v2.5"/></svg>',
  leave: '<svg viewBox="0 0 24 24"><path d="M14 5H6v14h8M10 12h10M17 9l3 3-3 3"/></svg>',
  send: '<svg viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
  expand: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"/></svg>',
  help: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.4a2.5 2.5 0 0 1 4.8 1c0 1.7-2.4 2.1-2.4 3.6M12 17.2v.1"/></svg>',
  full: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  replay: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4"/></svg>',
  invite: '<svg viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7L11.5 6.8M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5"/></svg>',
};
const stage = $('#stage'), frame = $('.game-frame'), header = $('.table-header'), settings = $('.table-settings');
if (stage && frame && header && settings) {
  document.documentElement.classList.add('rd');

  // Header: round sound and menu buttons; the text buttons (Boxes, Settings, Chat) move into the menu and status bar.
  const mute = $('#muteAudio');
  const syncMute = () => { const off = mute.getAttribute('aria-pressed') === 'true'; soundBtn.innerHTML = icon(off ? 'muted' : 'sound'); soundBtn.setAttribute('aria-label', off ? 'Unmute audio' : 'Mute audio'); soundRow && (soundRow.querySelector('.rd-meta').textContent = off ? 'Off' : 'On'); };
  const soundBtn = el('button', 'rd-round'); soundBtn.type = 'button'; soundBtn.addEventListener('click', () => mute.click());
  const menuBtn = el('button', 'rd-round', icon('menu')); menuBtn.type = 'button'; menuBtn.id = 'rdMenuBtn'; menuBtn.setAttribute('aria-label', 'Table menu'); menuBtn.setAttribute('aria-haspopup', 'dialog');
  // Wide table (design 2a): settings, help and fullscreen beside sound; the menu keeps the rest.
  const deskBtn = (ic, label, act) => { const b = el('button', 'rd-round rd-desk-only', icon(ic)); b.type = 'button'; b.setAttribute('aria-label', label); b.title = label; b.addEventListener('click', act); return b; };
  const tuneBtn = deskBtn('tune', 'Settings', () => { const d = $('.audio-settings'); if (d) d.open = !d.open; });
  const helpBtn = deskBtn('help', 'Game rules', () => window.open('/demo-information.html#rules', '_blank', 'noopener'));
  const fullBtn = deskBtn('full', 'Fullscreen', () => document.fullscreenElement ? document.exitFullscreen?.() : document.documentElement.requestFullscreen?.().catch(() => {}));
  // Kevin 27 Oct 21:52: the chat icon sits up top with the other buttons on the phone too, with its unread count
  const chatTop = el('button', 'rd-round rd-chat-top', icon('chat') + '<em hidden>0</em>'); chatTop.type = 'button'; chatTop.setAttribute('aria-label', 'Open chat');
  chatTop.addEventListener('click', () => $('#chatIcon')?.click());
  settings.prepend(soundBtn, chatTop, tuneBtn, helpBtn, fullBtn, menuBtn);

  // The dealer pill: "● Dragan AI dealer". The table line keeps name and limits; the dealer's name moves into the pill.
  const line = $('.brand-lockup p'), badge = $('.dealer-badge');
  const pill = el('div', 'rd-pill', '<i></i><b></b><span>AI dealer</span>');
  frame.append(pill);
  const pillRow = pill.cloneNode(true); pillRow.classList.add('rd-pill-row'); $('.brand-lockup')?.append(pillRow);
  const tableLine = el('p', 'rd-line'); line?.after(tableLine);
  const syncLine = () => { const parts = (line?.textContent ?? '').split(' · '); const name = parts.length > 2 ? parts.pop() : ''; pill.querySelector('b').textContent = name || 'Dealer'; pillRow && (pillRow.querySelector('b').textContent = name || 'Dealer'); tableLine.textContent = parts.join(' · '); };
  if (line) { new MutationObserver(syncLine).observe(line, { childList: true, characterData: true, subtree: true }); syncLine(); }
  badge?.setAttribute('hidden', '');

  // Status bar: balance, bet and last win from the wallet, and the chat button with its unread count.
  const wallet = $('.table-wallet');
  const status = el('div', 'rd-status'); status.id = 'rdStatus';
  const chatBtn = el('button', 'rd-chat', icon('chat') + '<em hidden>0</em>'); chatBtn.type = 'button'; chatBtn.setAttribute('aria-label', 'Open chat');
  chatBtn.addEventListener('click', () => $('#chatIcon')?.click());
  if (wallet) status.append(wallet);
  status.append(chatBtn); frame.append(status);
  // Wide table (design 2a-2c): Boxes, Take a break and Leave table as pills at the bottom right.
  const deskActs = el('div', 'rd-desk-acts');
  for (const [ic, label, id, danger] of [['seat', 'Boxes', 'changeSeats'], ['pause', 'Take a break', 'pauseDemo'], ['leave', 'Leave table', 'leaveTable', true]]) {
    const b = el('button', 'rd-pillbtn' + (danger ? ' danger' : ''), icon(ic) + `<span>${label}</span>`); b.type = 'button'; b.dataset.for = id;
    b.addEventListener('click', () => document.getElementById(id)?.click()); deskActs.append(b);
  }
  const syncActs = () => { for (const b of deskActs.children) { const src = document.getElementById(b.dataset.for); b.hidden = !src || (b.dataset.for === 'leaveTable' && src.hidden); b.disabled = !!src?.disabled; const t = src?.textContent?.trim(); if (t && b.dataset.for !== 'changeSeats' && b.lastChild.textContent !== t) b.lastChild.textContent = t; } };
  for (const id of ['changeSeats', 'pauseDemo', 'leaveTable']) { const n = document.getElementById(id); if (n) new MutationObserver(syncActs).observe(n, { attributes: true, attributeFilter: ['hidden', 'disabled'], childList: true, characterData: true, subtree: true }); }
  syncActs(); document.body.append(deskActs);
  const badgeSrc = $('#chatBadge'), badgeDst = chatBtn.querySelector('em');
  const syncBadge = () => { badgeDst.hidden = !badgeSrc || badgeSrc.hidden; badgeDst.textContent = badgeSrc?.textContent ?? ''; const em = chatTop.querySelector('em'); em.hidden = badgeDst.hidden; em.textContent = badgeDst.textContent; };
  if (badgeSrc) { new MutationObserver(syncBadge).observe(badgeSrc, { attributes: true, childList: true, characterData: true, subtree: true }); syncBadge(); }

  // The dock heading follows the phase: "Place your bets" / "Your turn · Box 4" with the status line under it.
  const controls = $('#gameControls'), dock = $('#gameDock');
  const syncPhase = () => { const ph = controls?.dataset.phase ?? ''; dock?.setAttribute('data-rd-phase', controls?.hidden ? 'off' : ph); document.documentElement.dataset.rdPhase = controls?.hidden ? 'off' : ph; };
  if (controls) { new MutationObserver(syncPhase).observe(controls, { attributes: true, attributeFilter: ['data-phase', 'hidden'] }); syncPhase(); }

  // Dock heading as in the design: "Place your bets" + "Box 4 · $15 on the felt", "Make your decision" + "Box 4 · You 14
  // vs dealer 2" (wide) or "Your turn · Box 4" + "You 14 · Dealer shows 2" (phone). Other lines (dealing, ready, notices)
  // pass through. The game's own status line stays for screen readers.
  const statusEl = $('#gameStatus'), dockStatus = $('.dock-status');
  const head = el('div', 'rd-head', '<b class="rd-title"></b><span class="rd-sub"></span>');
  dockStatus?.prepend(head); statusEl?.classList.add('rd-sr');
  const myBoxes = () => [...document.querySelectorAll('#tableBoxes .table-box[data-mine=true]')].map(g => (g.querySelector('[aria-label^="Bet on box"]')?.getAttribute('aria-label')?.match(/\d+/) ?? [''])[0]).filter(Boolean);
  const dealerTotal = () => document.querySelector('#gameCards .card-totals [data-hand=dealer] text')?.textContent?.trim() ?? '';
  const isDesk = () => document.documentElement.classList.contains('desk');
  const syncHead = () => {
    const text = statusEl?.textContent?.trim() ?? '', stake = $('#totalStake')?.textContent?.trim() ?? '', boxes = myBoxes(), limits = tableLine.textContent.split(' · ').slice(1).join(' · ');
    let title = text, sub = '';
    const turn = text.match(/^Your turn · box (\S+) · (\S+)/);
    if (/^Choose a chip/.test(text)) { title = 'Place your bets'; sub = stake && stake !== '$0.00' && boxes.length ? `Box ${boxes.join(', ')} · ${stake} on the felt` : `Tap a spot on the felt${limits ? ' · ' + limits : ''}`; }
    else if (turn) { const d = dealerTotal(); if (isDesk()) { title = 'Make your decision'; sub = `Box ${turn[1]} · You ${turn[2]}${d ? ` vs dealer ${d}` : ''}`; } else { title = `Your turn · Box ${turn[1]}`; sub = `You ${turn[2]}${d ? ` · Dealer shows ${d}` : ''}`; } }
    else if (/^Ready\. Waiting/.test(text)) { title = 'Bets placed'; sub = 'Dealing when the timer ends'; }
    // Kevin 27 Oct: nothing over the dealer while she deals or another player plays (no "Paow is dealing")
    else if (/ is (dealing|playing)$/.test(text)) title = '';
    const t = head.querySelector('.rd-title'), u = head.querySelector('.rd-sub');
    if (t.textContent !== title) t.textContent = title; if (u.textContent !== sub) u.textContent = sub;
  };
  if (statusEl) { new MutationObserver(syncHead).observe(statusEl, { childList: true, characterData: true, subtree: true }); const ts = $('#totalStake'); ts && new MutationObserver(syncHead).observe(ts, { childList: true, characterData: true, subtree: true }); setInterval(syncHead, 1000); syncHead(); }

  // Your hand and the dealer's, top right on the wide table (design 2a): totals with small cards.
  const hands = el('div', 'rd-hands'); hands.setAttribute('aria-hidden', 'true'); document.body.append(hands);
  const mini = c => { const red = /[♥♦]/.test(c); const m = c.match(/^(.+?)([♠♥♦♣])$/); return `<i class="rd-card${red ? ' red' : ''}"><b>${m ? m[1] : ''}</b><em>${m ? m[2] : ''}</em></i>`; };
  const syncHands = () => {
    const d = dealerTotal(), me = ($('#who')?.value ?? '').trim();
    const rows = [...document.querySelectorAll('#handList .hand-summary')].map(r => r.textContent);
    const mine = rows.find(r => me && r.startsWith(me + ' · box')) ?? rows.find(r => /· box/.test(r) && boxes2().some(b => r.includes(`box ${b} ·`)));
    let html = '';
    if (d) html += `<div class="rd-hand"><div><strong>${d}</strong><small>Dealer</small></div><div class="rd-cards"><i class="rd-card back">[S]</i></div></div>`;
    if (mine) { const m = mine.match(/box (\S+) · ([^·]+)/), cards = (m?.[2] ?? '').trim().split(/\s+/).filter(Boolean); const bj = cs => { let v = 0, a = 0; for (const c of cs) { const r = c.replace(/[♠♥♦♣]$/, ''); if (r === 'A') { a++; v += 11; } else v += /^[JQK]$/.test(r) ? 10 : Number(r) || 0; } while (v > 21 && a) { v -= 10; a--; } return cs.length ? String(v) + (v > 21 ? ' ×' : '') : ''; }; const t = bj(cards); html += `<div class="rd-hand mine"><div><strong>${t || ''}</strong><small>You · Box ${m?.[1] ?? ''}</small></div><div class="rd-cards">${cards.map(mini).join('')}</div></div>`; }
    if (hands.innerHTML !== html) hands.innerHTML = html;
  };
  const boxes2 = myBoxes;
  setInterval(syncHands, 500);

  // The result sits over the table: "YOU WIN $30.00" with the boxes under it. The dock keeps Next round.
  const result = $('#roundResult');
  // Design v2 (Kevin 17:53, 1d/1g/2d/2e): one net number, "1 box won · 1 bust · dealer 19", and Rebet / Rebet 2x /
  // Next round. A loss stays calm (white net, "THIS ROUND"); only a win gets the lime "YOU WON" pill.
  const banner = el('div', 'rd-result', '<small></small><strong></strong><p></p>'); banner.hidden = true; banner.setAttribute('role', 'status');
  frame.append(banner);
  const usd = v => (v > 0 ? '+' : v < 0 ? '\u2212' : '') + '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const num = t => { const m = String(t ?? '').replace(/,/g, '').match(/([+\-\u2212]?)\$?([+\-\u2212]?)(\d+(?:\.\d+)?)/); return m ? (m[1] || m[2] ? -1 : 1) * Number(m[3]) * (/^\+/.test(String(t).trim()) ? -1 : 1) : 0; };
  const settled = $('.settled-actions'), resNet = el('div', 'rd-res-net', '<b></b><span></span>');
  const rebetBtn = el('button', 'rd-rebet', icon('replay') + '<span class="rd-rebet-label">Rebet</span><kbd>R</kbd>'); rebetBtn.type = 'button';
  const rebet2Btn = el('button', 'rd-rebet2', 'Rebet 2×'); rebet2Btn.type = 'button';
  const resActs = el('div', 'rd-res-acts'); resActs.append(rebetBtn, rebet2Btn);
  if (settled) { settled.prepend(resNet, resActs); }
  // Rebet: the next round, then the last stake again (and doubled for 2x), with the game's own buttons
  const rebet = async double => {
    $('#nextRound')?.click();
    for (let i = 0; i < 40; i++) { const r = $('#repeatBet'); if (r && !r.hidden && !r.disabled) { r.click(); break; } await new Promise(z => setTimeout(z, 100)); }
    if (double) for (let i = 0; i < 20; i++) { const d = $('#doubleBets'); if (d && !d.hidden && !d.disabled) { d.click(); break; } await new Promise(z => setTimeout(z, 100)); }
  };
  rebetBtn.addEventListener('click', () => rebet(false)); rebet2Btn.addEventListener('click', () => rebet(true));
  addEventListener('keydown', e => { if (e.key.toLowerCase() === 'r' && !e.metaKey && !e.ctrlKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? '') && !$('#nextRound')?.hidden) { e.preventDefault(); rebet(false); } });
  // Kevin 27 Oct 20:5x ("you won dyker upp innan man ser hennes kort"): the result is said only after the dealer's last
  // card is face up and her clips are done (Next round shown, no card back on the table), and then a beat later.
  let resultTimer = 0;
  const cardsDown = () => !!document.querySelector('#gameCards .playing-card[data-card="hidden"]');
  const syncResult = () => {
    if (!result) return;
    const raw = $('#roundNet').textContent.trim(), on = !result.hidden && !!raw;
    clearTimeout(resultTimer);
    // Kevin 22:12 ("gamla förlusten var kvar"): no result on screen means no old numbers in the dock either
    dock?.classList.toggle('rd-has-result', on);
    if (!on) { delete banner.dataset.armed; banner.hidden = true; resNet.querySelector('b').textContent = ''; resNet.querySelector('span').textContent = ''; return; }
    const v = (raw.includes('-') || raw.includes('\u2212')) ? -Math.abs(num(raw.replace(/[-\u2212+]/g, ''))) : Math.abs(num(raw.replace(/[-\u2212+]/g, '')));
    const lis = [...result.querySelectorAll('#roundBoxes li')], won = lis.filter(li => li.dataset.outcome === 'win').length, bust = lis.filter(li => li.dataset.outcome === 'bust').length;
    const d = dealerTotal();
    // Kevin 22:08 ("she went bust, I won"): the main bets and the side bets (PP / 21+3) are told apart, with amounts
    const amt = t => { const m = String(t).replace(/,/g, '').match(/([+\-\u2212])\$(\d+(?:\.\d+)?)/); return m ? (m[1] === '+' ? 1 : -1) * Number(m[2]) : 0; };
    const mainNet = lis.reduce((n, li) => n + amt(li.textContent), 0), side = Math.round((v - mainNet) * 100) / 100;
    const sub = [won && `${won} ${won > 1 ? 'boxes' : 'box'} won${mainNet ? ' ' + usd(mainNet) : ''}`, bust && (bust === lis.length && bust > 1 ? `All ${bust} boxes bust` : `${bust} bust${!won && mainNet ? ' ' + usd(mainNet) : ''}`), Math.abs(side) >= .01 && `side bets ${usd(side)}`, d && `dealer ${d}`].filter(Boolean).join(' · ');
    const label = v > 0 ? 'YOU WON' : v < 0 ? 'THIS ROUND' : 'PUSH';
    banner.dataset.win = String(v > 0);
    banner.querySelector('small').textContent = label; banner.querySelector('strong').textContent = usd(v); banner.querySelector('p').textContent = sub;
    resNet.dataset.win = String(v > 0); resNet.querySelector('b').textContent = usd(v); resNet.querySelector('span').textContent = sub;
    const staked = Number((($('#roundReturn')?.textContent ?? '').match(/staked \$([\d,.]+)/) ?? [])[1]?.replace(/,/g, '') ?? 0);
    rebetBtn.querySelector('.rd-rebet-label').textContent = staked ? `Rebet $${Number.isInteger(staked) ? staked : staked.toFixed(2)}` : 'Rebet';
    // the dock's net and Rebet are filled at once (above); only the banner over the table waits for her cards and a beat
    if (cardsDown() || $('#nextRound')?.hidden) { banner.hidden = true; resultTimer = setTimeout(syncResult, 250); return; }
    if (banner.hidden && !banner.dataset.armed) { banner.dataset.armed = '1'; resultTimer = setTimeout(syncResult, 700); return; }
    banner.hidden = false;
  };
  if (result) { new MutationObserver(syncResult).observe(result, { attributes: true, childList: true, characterData: true, subtree: true }); syncResult(); }

  // The chat opens as a sheet with its own heading and close button.
  const side = $('aside.side');
  if (side) {
    const head = el('div', 'rd-sheet-head', '<div><b>Table chat</b><span id="rdChatCount"></span></div>');
    const close = el('button', 'rd-x', icon('close')); close.type = 'button'; close.setAttribute('aria-label', 'Close chat');
    close.addEventListener('click', () => $('#chatIcon')?.click());
    head.append(close); side.prepend(head);
    const roster = $('#playersAtTable'), count = $('#rdChatCount');
    const syncCount = () => { const n = roster?.querySelectorAll('.player-tag').length ?? 0; count.textContent = n ? `${n} at the table` : ''; };
    if (roster) { new MutationObserver(syncCount).observe(roster, { childList: true }); syncCount(); }
  }

  // Chat like a live broadcast (design 1c / 2a): the last three messages float over the stream, older ones fainter.
  // A tap on them, the status bar's chat button or (wide screens) the field under them opens the full chat.
  const openChat = () => { $('#toggleChat')?.click(); if (side?.classList.contains('chat-open')) $('#input')?.focus({ preventScroll: true }); };
  chatBtn.replaceWith(chatBtn.cloneNode(true)); const chatBtn2 = status.querySelector('.rd-chat'); chatBtn2.addEventListener('click', openChat);
  const syncBadge2 = () => { const em = chatBtn2.querySelector('em'); em.hidden = !badgeSrc || badgeSrc.hidden; em.textContent = badgeSrc?.textContent ?? ''; };
  if (badgeSrc) new MutationObserver(syncBadge2).observe(badgeSrc, { attributes: true, childList: true, characterData: true, subtree: true });
  side?.querySelector('.rd-x')?.replaceWith(Object.assign(el('button', 'rd-x', icon('close')), { type: 'button', onclick: () => $('#toggleChat')?.click() }));
  side?.querySelector('.rd-x')?.setAttribute('aria-label', 'Close chat');
  const float = el('div', 'rd-float');
  const floatMsgs = el('div', 'rd-float-msgs');
  const floatBar = el('div', 'rd-float-bar');
  // Kevin 27 Oct: the field under the floating lines is a real input (design 2a). Typing and sending stay on the stream;
  // only the expand button (or a tap on the lines) opens the full chat panel.
  const floatField = el('form', 'rd-float-field', icon('chat') + '<input class="rd-ff-label" maxlength="280" autocomplete="off" aria-label="Message"><button type="submit" aria-label="Send"><i>' + ICONS.send + '</i></button>');
  const floatInput = floatField.querySelector('input');
  floatField.addEventListener('submit', e => { e.preventDefault(); const text = floatInput.value.trim(), input = $('#input'), form = $('#form'); if (!text || !input || !form) return; input.value = text; form.requestSubmit(); floatInput.value = ''; });
  const floatOpen = el('button', 'rd-round rd-float-open', icon('expand') + '<em hidden></em>'); floatOpen.type = 'button';
  floatOpen.addEventListener('click', openChat); floatMsgs.addEventListener('click', openChat);
  floatBar.append(floatField, floatOpen); float.append(floatMsgs, floatBar); document.body.append(float);
  const log = $('#log');
  const syncFloat = () => {
    // the same line can sit in the log more than once (a reply shown when its clip starts): the last three distinct ones
    const seen = new Set(), msgs = [...(log?.querySelectorAll('.msg') ?? [])].reverse().filter(m => { const k = m.textContent.trim(); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 3).reverse();
    floatMsgs.replaceChildren(...msgs.map((m, i) => {
      const name = m.querySelector('.name')?.textContent ?? (m.classList.contains('me') ? 'You' : '');
      const text = [...m.childNodes].filter(n => !(n.nodeType === 1 && (n.classList.contains('name') || n.classList.contains('meta')))).map(n => n.textContent).join('').trim();
      const row = el('div', 'rd-fm' + (m.classList.contains('her') ? ' her' : ''));
      row.style.opacity = String([0.6, 0.8, 1][i + 3 - msgs.length]);
      row.append(Object.assign(el('b'), { textContent: name }), ' ', Object.assign(el('span'), { textContent: text }));
      return row;
    }));
    const dealerName = pill.querySelector('b').textContent;
    const want = `Say something to ${dealerName}`; if (floatInput.placeholder !== want) floatInput.placeholder = want;
    const em = floatOpen.querySelector('em'); em.hidden = !badgeSrc || badgeSrc.hidden; em.textContent = badgeSrc?.textContent ?? '';
  };
  if (log) new MutationObserver(syncFloat).observe(log, { childList: true, subtree: true, characterData: true });
  if (badgeSrc) new MutationObserver(syncFloat).observe(badgeSrc, { attributes: true, childList: true });
  syncFloat();

  // Take a seat (design 1a): who you play as, with Change, above the one primary action.
  const gateCard = $('.gate-card'), enter = $('#enter'), changeName = $('#changeName');
  if (gateCard && enter) {
    const as = el('div', 'rd-as', '<div><small>Playing as</small><b></b></div>');
    const change = el('button', 'rd-change', icon('edit') + 'Change'); change.type = 'button';
    change.addEventListener('click', () => changeName?.click());
    as.append(change); gateCard.querySelector('.entry-actions')?.before(as);
    const syncAs = () => {
      const name = $('#who')?.value || $('#playerName')?.value || '';
      const box = ($('#selectedBoxes')?.textContent.match(/\d+/g) ?? []);
      const label = box.length === 1 && enter.textContent.trim() === 'Play' ? `Sit at box ${box[0]}` : ''; if (enter.dataset.rdLabel !== label) enter.dataset.rdLabel = label;
      const shown = name || 'Guest', hide = !changeName || changeName.hidden || !name; if (as.querySelector('b').textContent !== shown) as.querySelector('b').textContent = shown; if (as.hidden !== hide) as.hidden = hide;
    };
    for (const n of [changeName, $('#selectedBoxes'), enter].filter(Boolean)) new MutationObserver(syncAs).observe(n, { attributes: n !== enter, attributeFilter: n === changeName ? ['hidden'] : undefined, childList: true, characterData: true, subtree: true });
    $('#who')?.addEventListener('input', syncAs); $('#playerName')?.addEventListener('input', syncAs); setInterval(syncAs, 1500); syncAs();
  }

  // The menu: boxes, sound, settings, rules, demo information, break and leave, as one sheet.
  const sheet = el('div', 'rd-menu'); sheet.id = 'rdMenu'; sheet.hidden = true; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Table menu');
  const scrim = el('div', 'rd-scrim'); scrim.hidden = true;
  const panel = el('div', 'rd-menu-panel', '<i class="rd-grab"></i>');
  const rows = el('div', 'rd-rows');
  const row = (ic, label, act, { meta = '', danger = false, id } = {}) => {
    const b = el('button', 'rd-row' + (danger ? ' danger' : ''), `${icon(ic)}<span>${label}</span><span class="rd-meta">${meta}</span>`); b.type = 'button'; if (id) b.id = id;
    b.addEventListener('click', () => { setMenu(false); act(); }); rows.append(b); return b;
  };
  const seatsMeta = () => { const mine = document.querySelectorAll('#tableBoxes .table-box[data-mine=true]').length; return mine ? `${mine} of 7` : ''; };
  const boxesRow = row('seat', 'Boxes', () => $('#changeSeats')?.click());
  const soundRow = row('sound', 'Sound', () => mute.click(), { meta: 'On' });
  row('tune', 'Settings', () => { const d = $('.audio-settings'); if (d) d.open = true; });
  row('invite', 'Invite a friend', () => $('#copyTableLink')?.click());
  row('rules', 'Game rules', () => window.open('/demo-information.html#rules', '_blank', 'noopener'));
  row('info', 'Demo information', () => window.open('/demo-information.html', '_blank', 'noopener'));
  const pauseRow = row('pause', 'Take a break', () => $('#pauseDemo')?.click(), { meta: 'Pause play' });
  const leaveRow = row('leave', 'Leave table', () => $('#leaveTable')?.click(), { danger: true });
  panel.append(rows, el('p', 'rd-help', 'Demo play with session-based limits. Need to talk about gambling? Visit <a href="https://stodlinjen.se" target="_blank" rel="noopener">Stödlinjen</a>.'));
  sheet.append(scrim, panel); document.body.append(sheet);
  function setMenu(on) {
    sheet.hidden = !on; scrim.hidden = !on; menuBtn.setAttribute('aria-expanded', String(on));
    if (on) {
      boxesRow.querySelector('.rd-meta').textContent = seatsMeta(); boxesRow.disabled = !!$('#changeSeats')?.disabled;
      const leave = $('#leaveTable'); leaveRow.hidden = !leave || leave.hidden; leaveRow.disabled = !!leave?.disabled;
      leaveRow.querySelector('span:not(.rd-ic):not(.rd-meta)').textContent = leave?.textContent?.trim() || 'Leave table';
      const pause = $('#pauseDemo'); pauseRow.querySelector('span:not(.rd-ic):not(.rd-meta)').textContent = pause?.textContent?.trim() || 'Take a break';
      rows.querySelector('button:not([hidden]):not(:disabled)')?.focus();
    } else menuBtn.focus({ preventScroll: true });
  }
  menuBtn.addEventListener('click', () => setMenu(sheet.hidden));
  scrim.addEventListener('click', () => setMenu(false));
  addEventListener('keydown', e => { if (e.key === 'Escape' && !sheet.hidden) setMenu(false); });

  new MutationObserver(syncMute).observe(mute, { attributes: true, attributeFilter: ['aria-pressed'] }); syncMute();

  // H / S / D / P as on the design's buttons, when no field has the focus.
  addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? '')) return;
    const action = { h: 'hit', s: 'stand', d: 'double', p: 'split' }[e.key.toLowerCase()];
    const b = action && document.querySelector(`#actionControls:not([hidden]) [data-action=${action}]`);
    if (b && !b.disabled) { e.preventDefault(); b.click(); }
  });

  // Kevin 17:26: in a low view the dock had no room between the boxes and the status bar and was cut off. When the room
  // under the boxes is too small for it, it floats over the dealer instead (as on the wide table), never over the boxes.
  const fit = () => {
    if (document.documentElement.classList.contains('desk')) { document.documentElement.classList.remove('rd-tight'); return; }
    // Kevin 18:23: the dock never floats over the dealer (not in the design). It always sits at the foot, as 1b; the whole
    // scene (video, felt, boxes, cards, all layers alike) is scaled so the boxes end above it: up to 10 % larger with room
    // to spare (1a), smaller in a low view.
    const frameH = Math.min(innerWidth, innerHeight * .5625) * 16 / 9, room = innerHeight - frameH * .684 - 84;
    document.documentElement.classList.remove('rd-tight');
    let sc = 1, sh = 0;
    if (innerWidth <= 820) {
      // Kevin 20:13 ("kan inte klicka på Deal vid en viss skärm, ingen scroll, bättre lösning"): the room under the boxes is
      // sized for the whole bet dock (heading, chips, Undo/2x/Rebet/Deal: 206 px, 168 px compact); when the window is
      // too low for the full dock the dock turns compact first, and the scene shrinks only after that.
      const room = innerHeight - 84 - 8, full = 206, compact = 168;
      const fits = h => (room - h) / (frameH * .684);
      const useCompact = fits(full) < .8;
      document.documentElement.classList.toggle('rd-compact', useCompact);
      const need = fits(useCompact ? compact : full);
      sc = Math.max(.5, Math.min(1.1, need));
      if (sc >= 1.1) sh = Math.min(48, room - full - frameH * .684 * 1.1);
    }
    document.documentElement.style.setProperty('--rd-s', String(sc)); document.documentElement.style.setProperty('--rd-t', sh + 'px');
  };
  addEventListener('resize', fit); fit();

  // Emil 27 Oct (828f9356, "the desktop table"): on the wide table Emil's desk.css owns the layout (game panel bottom
  // right, see-through chat top right, people and links top left). The redesign chrome is the phone's only: html.rd is
  // set when the page is not in desk mode and dropped when it is (desk-mode.js switches on every resize), the wallet
  // goes back into the game panel and the originals the redesign hid come back.
  const walletHome = $('#gameDock'), walletEl = $('.table-wallet');
  const applyMode = () => {
    const desk = document.documentElement.classList.contains('desk');
    if (desk === !document.documentElement.classList.contains('rd')) return;
    document.documentElement.classList.toggle('rd', !desk);
    if (desk) { if (walletEl && walletHome && walletEl.parentElement !== walletHome) walletHome.append(walletEl); badge?.removeAttribute('hidden'); statusEl?.classList.remove('rd-sr'); }
    else { if (walletEl && walletEl.parentElement !== status) status.prepend(walletEl); badge?.setAttribute('hidden', ''); statusEl?.classList.add('rd-sr'); }
  };
  new MutationObserver(applyMode).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  applyMode();
  // Kevin 27 Oct 22:3x ("chat keeps disappearing"): a chat folded away with the chat icon was remembered per browser
  // (panel-toggle.js) and stayed folded on every reload. The chat opens on every load; the icon still folds it for now.
  const reopen = () => { const app = $('.app'); if (app?.classList.contains('panel-closed')) $('#showPanel')?.click(); };
  reopen(); setTimeout(reopen, 300);
}
