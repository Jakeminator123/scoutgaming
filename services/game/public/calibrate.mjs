// Live calibration overlay.
//
// Open with `?cal=1`, or press `C` at any time. Every control writes a CSS
// custom property on :root, so what you see is exactly what the game will use.
// Tweaks persist in localStorage; COPY hands you a CSS block to paste into
// styles.css (or to send back so the values get baked in for your screen).
//
// Not loaded into the player experience beyond a keydown listener.

const ROOT = document.documentElement;
const STORE = 'croupier.calibration';

// name, label, min, max, step, unit
const GROUPS = [
  ['Seat ring (all boxes)', [
    ['--arc-cx', 'centre X', 0.2, 0.8, 0.005, ''],
    ['--arc-cy', 'centre Y', -0.2, 0.6, 0.005, ''],
    ['--arc-rx', 'radius X', 0.15, 0.7, 0.005, ''],
    ['--arc-ry', 'radius Y', 0.1, 0.8, 0.005, ''],
    ['--arc-span', 'spread °', 40, 170, 1, ''],
  ]],
  ['Betting spot', [
    ['--spot-x', 'x', 0, 90, 1, 'px'],
    ['--spot-y', 'y', 0, 90, 1, 'px'],
    ['--spot-w', 'width', 20, 110, 1, 'px'],
    ['--spot-h', 'height', 16, 90, 1, 'px'],
  ]],
  ['Side-bet crescents', [
    ['--arc-x', 'x', 20, 100, 1, 'px'],
    ['--arc-y', 'y', 20, 100, 1, 'px'],
    ['--arc-w', 'width', 50, 190, 1, 'px'],
    ['--arc-h', 'height', 40, 160, 1, 'px'],
    ['--arc-rot', 'rotation', -60, 60, 0.5, 'deg'],
  ]],
  ['Crescent labels', [
    ['--pp-rot', 'PP rotation', -180, 180, 1, 'deg'],
    ['--tp-rot', '21+3 rotation', -180, 180, 1, 'deg'],
  ]],
  ['Cards on the felt', [
    ['--hand-rot', 'turn hand', -90, 90, 0.5, 'deg'],
    ['--cards-x', 'hand x', -70, 70, 1, 'px'],
    ['--cards-y', 'hand y', -110, 40, 1, 'px'],
    ['--cards-flat', 'lay flat', 0.25, 1, 0.01, ''],
    ['--cards-skew-k', 'lie into table', -1, 1, 0.01, ''],
    ['--cards-rot-k', 'follow arc', 0, 1.5, 0.05, ''],
  ]],
  ['Each card', [
    ['--card-w', 'size', 24, 80, 1, 'px'],
    ['--card-x0', 'first card x', -70, 20, 1, 'px'],
    ['--card-dx', 'spread', 4, 34, 0.5, 'px'],
    ['--card-dy', 'rise', -14, 6, 0.5, 'px'],
    ['--card-rot0', 'first card turn', -30, 30, 0.5, 'deg'],
    ['--card-rot', 'turn per card', -14, 14, 0.5, 'deg'],
  ]],
  // The rows above fan a hand uniformly. These four sections turn and shift ONE
  // card at a time, keyed by its slot in the hand (1st dealt, 2nd dealt, ...)
  // because cards are thrown away and remade every round.
  ['Card 1 alone (1st dealt)', [
    ['--card-rot-0', 'extra turn', -45, 45, 0.5, 'deg'],
    ['--card-dx-0', 'nudge x', -40, 40, 1, 'px'],
    ['--card-dy-0', 'nudge y', -40, 40, 1, 'px'],
  ]],
  ['Card 2 alone (2nd dealt)', [
    ['--card-rot-1', 'extra turn', -45, 45, 0.5, 'deg'],
    ['--card-dx-1', 'nudge x', -40, 40, 1, 'px'],
    ['--card-dy-1', 'nudge y', -40, 40, 1, 'px'],
  ]],
  ['Card 3 alone (3rd dealt)', [
    ['--card-rot-2', 'extra turn', -45, 45, 0.5, 'deg'],
    ['--card-dx-2', 'nudge x', -40, 40, 1, 'px'],
    ['--card-dy-2', 'nudge y', -40, 40, 1, 'px'],
  ]],
  ['Card 4 alone (4th dealt)', [
    ['--card-rot-3', 'extra turn', -45, 45, 0.5, 'deg'],
    ['--card-dx-3', 'nudge x', -40, 40, 1, 'px'],
    ['--card-dy-3', 'nudge y', -40, 40, 1, 'px'],
  ]],
  ['Side-bet chips', [
    ['--side-chip-r', 'distance out', 20, 80, 0.5, ''],
    ['--sidechip-dx', 'nudge x', -30, 30, 1, 'px'],
    ['--sidechip-dy', 'nudge y', -30, 30, 1, 'px'],
  ]],
  ['Floor supervisor', [
    ['--sup-x', 'across', -70, 70, 0.5, 'vh'],
    ['--sup-y', 'height on wall', -20, 40, 0.5, 'vh'],
    ['--sup-h', 'size', 20, 100, 0.5, 'vh'],
    ['--sup-bright', 'brightness', 0.4, 1.3, 0.01, ''],
    ['--sup-sat', 'saturation', 0.2, 1.4, 0.01, ''],
  ]],
  ['Lip sync', [
    ['--lipsync-offset', 'audio delay', -200, 600, 5, ''],
  ]],
  ['Dealer window', [
    ['--dealer-h', 'size', 30, 120, 0.5, 'vh'],
    ['--dealer-top', 'top', -10, 40, 0.5, 'vh'],
    ['--dealer-x', 'nudge x', -20, 20, 0.5, 'vw'],
    ['--dealer-crop', 'reveal height', 0.6, 1.15, 0.005, ''],
  ]],
];

// Everything a single box can own. The seat ring and the dealer window are
// table-wide by nature, so they always write to :root.
const PER_BOX = new Set([
  '--spot-x', '--spot-y', '--spot-w', '--spot-h',
  '--arc-x', '--arc-y', '--arc-w', '--arc-h', '--arc-rot',
  '--pp-rot', '--tp-rot',
  '--hand-rot', '--cards-x', '--cards-y', '--cards-flat', '--cards-rot-k', '--cards-skew-k',
  '--card-w', '--card-x0', '--card-dx', '--card-dy', '--card-rot0', '--card-rot',
  '--card-rot-0', '--card-dx-0', '--card-dy-0',
  '--card-rot-1', '--card-dx-1', '--card-dy-1',
  '--card-rot-2', '--card-dx-2', '--card-dy-2',
  '--card-rot-3', '--card-dx-3', '--card-dy-3',
  '--side-chip-r', '--sidechip-dx', '--sidechip-dy',
]);

const read = name => getComputedStyle(ROOT).getPropertyValue(name).trim();
const numOf = v => parseFloat(v);

// Custom properties are NOT computed to a value, so a var holding an
// expression (--dealer-h is `max(68vh, 37.94vw)`) comes back as that literal
// token stream and parseFloat gives NaN. The slider then silently showed its
// midpoint, so touching it jerked the window to a value nobody chose. Resolve
// those by measuring the expression on a throwaway element and converting the
// resulting pixels back into the slider's own unit.
function resolveNum(name, unit) {
  const direct = numOf(saved[name] ?? read(name));
  if (Number.isFinite(direct)) return direct;
  const probe = document.createElement('div');
  probe.style.cssText = `position:absolute;left:-9999px;top:0;visibility:hidden;width:var(${name});`;
  document.body.appendChild(probe);
  const px = parseFloat(getComputedStyle(probe).width) || 0;
  probe.remove();
  const per = unit === 'vh' ? innerHeight / 100 : unit === 'vw' ? innerWidth / 100 : 1;
  return Math.round((px / per) * 100) / 100;
}

let saved = {};
try { saved = JSON.parse(localStorage.getItem(STORE) || '{}'); } catch { saved = {}; }

// apply anything stored from a previous session before the first paint we control
export function applySaved() {
  for (const [k, v] of Object.entries(saved)) ROOT.style.setProperty(k, v);
  return Object.keys(saved).length;
}

let panel = null;
const INPUTS = new Map();

function build() {
  INPUTS.clear();
  panel = document.createElement('div');
  panel.id = 'calibrator';
  panel.innerHTML = `
    <header>
      <b>CALIBRATE</b>
      <span class="cal-note">click a box to edit it alone &middot; drag its lime handle to rotate</span>
      <button class="cal-side" title="move to the other side">⇄</button>
      <button class="cal-min" title="collapse">–</button>
      <button class="cal-x" title="close (C)">×</button>
    </header>
    <div class="cal-scope"><span class="cal-scope-txt">editing ALL BOXES</span><button class="cal-scope-all">EDIT ALL</button></div>
    <div class="cal-body"></div>
    <footer>
      <button class="cal-apply" title="bake these values in permanently, each box keeping its own">APPLY</button>
      <button class="cal-all" title="copy the selected box's pose onto every box">SAME FOR ALL</button>
      <button class="cal-copy">COPY CSS</button>
      <button class="cal-reset">RESET</button>
    </footer>`;
  const body = panel.querySelector('.cal-body');

  for (const [title, rows] of GROUPS) {
    const sec = document.createElement('section');
    sec.innerHTML = `<h4>${title}</h4>`;
    for (const [name, label, min, max, step, unit] of rows) {
      const cur = resolveNum(name, unit);
      const row = document.createElement('label');
      row.className = 'cal-row';
      row.innerHTML = `
        <span class="cal-label">${label}</span>
        <input type="range" min="${min}" max="${max}" step="${step}" value="${cur}">
        <input type="number" min="${min}" max="${max}" step="${step}" value="${cur}">
        <span class="cal-unit">${unit}</span>`;
      const [range, number] = row.querySelectorAll('input');
      INPUTS.set(name, { range, number, unit, min, max });
      const set = v => {
        // A selected box takes the edit; otherwise it lands on every box.
        if (selSeat && PER_BOX.has(name)) setSeatVar(selSeat, name, parseFloat(v), unit);
        else {
          const val = `${v}${unit}`;
          ROOT.style.setProperty(name, val);
          saved[name] = val;
          localStorage.setItem(STORE, JSON.stringify(saved));
        }
        range.value = v; number.value = v;
        window.dispatchEvent(new Event('resize'));   // relayout the seat ring
      };
      range.oninput = e => set(e.target.value);
      number.oninput = e => set(e.target.value);
      sec.appendChild(row);
    }
    body.appendChild(sec);
  }

  buildPerBox(body);
  // The panel sits over the felt, so it has to get out of the way: drag it by
  // its header, flip it to the other side, or collapse it to a title bar.
  const header = panel.querySelector('header');
  header.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    e.preventDefault();
    const r = panel.getBoundingClientRect();
    const off = { x: e.clientX - r.left, y: e.clientY - r.top };
    const move = ev => {
      const x = Math.max(6, Math.min(innerWidth - r.width - 6, ev.clientX - off.x));
      const y = Math.max(6, Math.min(innerHeight - 44, ev.clientY - off.y));
      panel.style.left = `${x}px`; panel.style.top = `${y}px`; panel.style.right = 'auto';
      localStorage.setItem(STORE + '.pos', JSON.stringify({ x, y }));
    };
    const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); };
    addEventListener('pointermove', move); addEventListener('pointerup', up);
  });
  try {
    const pos = JSON.parse(localStorage.getItem(STORE + '.pos') || 'null');
    if (pos) { panel.style.left = `${pos.x}px`; panel.style.top = `${pos.y}px`; panel.style.right = 'auto'; }
  } catch { /* default position */ }

  panel.querySelector('.cal-side').onclick = () => {
    const r = panel.getBoundingClientRect();
    const x = r.left < innerWidth / 2 ? innerWidth - r.width - 14 : 14;
    panel.style.left = `${x}px`; panel.style.right = 'auto';
    localStorage.setItem(STORE + '.pos', JSON.stringify({ x, y: r.top }));
  };
  panel.querySelector('.cal-min').onclick = e => {
    panel.classList.toggle('min');
    e.currentTarget.textContent = panel.classList.contains('min') ? '+' : '–';
  };

  panel.querySelector('.cal-x').onclick = toggle;
  panel.querySelector('.cal-all').onclick = applyToAll;
  panel.querySelector('.cal-scope-all').onclick = () => selectSeat(null);
  panel.querySelector('.cal-apply').onclick = async e => {
    // Bake exactly what is on screen: table-wide values plus each box's own.
    const btn = e.currentTarget;
    btn.textContent = 'SAVING...';
    try {
      const r = await fetch('/calibration', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ root: saved, boxes: perSeat }),
      });
      const out = await r.json();
      if (!out.ok) throw new Error(out.error || 'save failed');
      btn.textContent = 'APPLIED';
      say('calibration baked into calibration.css - it survives reloads now');
    } catch (err) {
      btn.textContent = 'FAILED';
      say(`could not save: ${err.message}`);
    }
    setTimeout(() => { btn.textContent = 'APPLY'; }, 1800);
  };
  panel.querySelector('.cal-reset').onclick = () => {
    for (const k of Object.keys(saved)) ROOT.style.removeProperty(k);
    saved = {}; localStorage.removeItem(STORE);
    resetSeats();
    panel.remove(); panel = null; build();
    window.dispatchEvent(new Event('resize'));
  };
  panel.querySelector('.cal-copy').onclick = async () => {
    const css = ':root {\n' + Object.entries(saved).map(([k, v]) => `  ${k}: ${v};`).join('\n') + '\n}\n' + seatCss();
    try { await navigator.clipboard.writeText(css); } catch { /* fall through to the log */ }
    console.info('[calibration]\n' + css);
    const btn = panel.querySelector('.cal-copy');
    btn.textContent = 'COPIED';
    setTimeout(() => { btn.textContent = 'COPY CSS'; }, 1400);
  };
  document.body.appendChild(panel);
  refreshScope();
}

// One rotation slider per box. Selecting a box on the felt is nice, but it can
// be fiddly, so each box also gets its own row that can only ever affect it.
function buildPerBox(body) {
  const sec = document.createElement('section');
  sec.innerHTML = '<h4>Rotation, one box at a time</h4>';
  document.querySelectorAll('.seat').forEach(seat => {
    const i = seatIdx(seat);
    const cur = seatVal(seat, '--arc-rot');
    const row = document.createElement('label');
    row.className = 'cal-row';
    row.innerHTML = `
      <span class="cal-label">box ${i + 1}</span>
      <input type="range" min="-90" max="90" step="0.5" value="${cur}">
      <input type="number" min="-90" max="90" step="0.5" value="${cur}">
      <span class="cal-unit">deg</span>`;
    const [range, number] = row.querySelectorAll('input');
    const set = v => {
      setSeatVar(seat, '--arc-rot', parseFloat(v), 'deg');
      range.value = v; number.value = v;
    };
    range.oninput = e => set(e.target.value);
    number.oninput = e => set(e.target.value);
    row.onpointerenter = () => seat.classList.add('cal-hint');
    row.onpointerleave = () => seat.classList.remove('cal-hint');
    sec.appendChild(row);
  });
  body.appendChild(sec);
}

// ---- direct manipulation, per box ----------------------------------------
// Each box can be posed on its own: click one to select it, then drag the lime
// handle round to rotate ONLY that box's crescents, or drag the crescents
// themselves to move them. Values are written to that .seat element, so they
// override the :root defaults for that box alone. "APPLY TO ALL" pushes the
// selected box's pose onto every box once it looks right.
export function setVar(name, value) {
  const spec = INPUTS.get(name);
  const unit = spec?.unit ?? '';
  const v = spec ? Math.min(spec.max, Math.max(spec.min, value)) : value;
  const rounded = Math.round(v * 1000) / 1000;
  ROOT.style.setProperty(name, `${rounded}${unit}`);
  saved[name] = `${rounded}${unit}`;
  if (spec) { spec.range.value = rounded; spec.number.value = rounded; }
  localStorage.setItem(STORE, JSON.stringify(saved));
  return rounded;
}
const curVar = name => parseFloat(saved[name] ?? read(name)) || 0;

// per-box overrides, keyed by box index
let perSeat = {};
try { perSeat = JSON.parse(localStorage.getItem(STORE + '.seats') || '{}'); } catch { perSeat = {}; }
const seatIdx = seat => Number(seat.dataset.box);
function seatVal(seat, name, unit) {
  const own = perSeat[seatIdx(seat)]?.[name];
  return own !== undefined ? parseFloat(own) : curVar(name);
}
function setSeatVar(seat, name, value, unit = 'px') {
  const i = seatIdx(seat);
  const rounded = Math.round(value * 100) / 100;
  (perSeat[i] ??= {})[name] = `${rounded}${unit}`;
  seat.style.setProperty(name, `${rounded}${unit}`);
  localStorage.setItem(STORE + '.seats', JSON.stringify(perSeat));
  const spec = INPUTS.get(name);
  if (spec && selSeat === seat) { spec.range.value = rounded; spec.number.value = rounded; }
  return rounded;
}
export function applySavedSeats() {
  for (const [i, vars] of Object.entries(perSeat)) {
    const seat = document.querySelector(`.seat[data-box="${i}"]`);
    if (seat) for (const [k, v] of Object.entries(vars)) seat.style.setProperty(k, v);
  }
}

let readout = null;
function say(text) {
  if (!readout) { readout = document.createElement('div'); readout.id = 'cal-readout'; document.body.appendChild(readout); }
  readout.textContent = text;
  readout.classList.add('show');
  clearTimeout(say.t);
  say.t = setTimeout(() => readout.classList.remove('show'), 1800);
}

let selSeat = null, handle = null, handHandle = null;
let selPiece = 'arcs';                 // 'arcs' or 'hand' - only one is ever marked
function markPiece(piece) {
  selPiece = piece;
  if (!selSeat) return;
  selSeat.classList.toggle('mark-arcs', piece === 'arcs');
  selSeat.classList.toggle('mark-hand', piece === 'hand');
  if (handle) handle.hidden = piece !== 'arcs';
  if (handHandle) handHandle.hidden = piece !== 'hand';
}
export function refreshScope() {
  if (!panel) return;
  const txt = panel.querySelector('.cal-scope-txt');
  const box = panel.querySelector('.cal-scope');
  if (selSeat) { txt.textContent = `editing BOX ${seatIdx(selSeat) + 1} only`; box.classList.add('one'); }
  else { txt.textContent = 'editing ALL BOXES'; box.classList.remove('one'); }
  // show the values that belong to whatever is selected
  for (const [name, spec] of INPUTS) {
    const v = (selSeat && PER_BOX.has(name)) ? seatVal(selSeat, name) : resolveNum(name, spec.unit);
    spec.range.value = v; spec.number.value = v;
  }
}

function selectSeat(seat) {
  document.querySelectorAll('.seat.cal-sel').forEach(s => s.classList.remove('cal-sel'));
  selSeat = seat;
  refreshScope();
  document.querySelectorAll('.seat.mark-arcs, .seat.mark-hand').forEach(s => s.classList.remove('mark-arcs', 'mark-hand'));
  if (!seat) { handle?.remove(); handle = null; handHandle?.remove(); handHandle = null; return; }
  seat.classList.add('cal-sel');
  if (!handle) {
    handle = document.createElement('div');
    handle.className = 'cal-handle';
    handle.title = 'drag to rotate the side-bet crescents';
    handle.addEventListener('pointerdown', e => startRotate(e, 'arcs'));
  }
  seat.appendChild(handle);
  if (!handHandle) {
    handHandle = document.createElement('div');
    handHandle.className = 'cal-handle cal-handle-hand';
    handHandle.title = 'drag to turn the whole hand';
    handHandle.addEventListener('pointerdown', e => startRotate(e, 'hand'));
  }
  seat.appendChild(handHandle);
  markPiece(selPiece);
  say(`box ${seatIdx(seat) + 1} selected \u2014 drag the handle to rotate`);
}

let rot = null;
function startRotate(e, what = 'arcs') {
  if (!selSeat) return;
  e.preventDefault(); e.stopPropagation();
  // turn the hand about the hand, the crescents about the crescents
  const pivotEl = what === 'hand'
    ? (selSeat.querySelector('.cards .card') ?? selSeat.querySelector('.spot'))
    : selSeat.querySelector('.sidearcs');
  const inner = pivotEl.getBoundingClientRect();
  const cx = inner.left + inner.width / 2, cy = inner.top + inner.height / 2;
  const name = what === 'hand' ? '--hand-rot' : '--arc-rot';
  rot = { cx, cy, name, a0: Math.atan2(e.clientY - cy, e.clientX - cx), r0: seatVal(selSeat, name) };
  try { (what === 'hand' ? handHandle : handle).setPointerCapture?.(e.pointerId); } catch { /* synthetic */ }
  document.body.classList.add('cal-dragging');
}

// slot of a card within its hand: cards are recreated every round, so the
// override keys on position in the hand, not on the element
const slotOf = el => {
  const card = el.closest?.('.card');
  if (!card) return null;
  const i = [...card.parentNode.children].filter(x => x.classList.contains('card')).indexOf(card);
  return i >= 0 && i <= 3 ? i : null;
};

const HANDLES = [
  // the single card comes first: otherwise the whole-hand handle swallows it
  { sel: '.card', label: 'card', card: true },
  { sel: '.sidearcs', label: 'crescents', move: ['--arc-x', '--arc-y'] },
  { sel: '.spot', label: 'betting spot', move: ['--spot-x', '--spot-y'] },
  { sel: '.seat .cards', label: 'cards', move: ['--cards-x', '--cards-y'] },
  { sel: '.side-chip', label: 'side chips', move: ['--sidechip-dx', '--sidechip-dy'] },
];
const handleFor = el => {
  for (const h of HANDLES) { const hit = el.closest?.(h.sel); if (hit) return { ...h, el: hit }; }
  return null;
};

let drag = null;
function onDown(e) {
  if (!panel || e.button !== 0 || e.target.closest('#calibrator, .cal-handle')) return;
  const seat = e.target.closest?.('.seat');
  if (seat && seat !== selSeat) {
    e.preventDefault(); e.stopPropagation();
    selPiece = e.target.closest('.card') ? 'hand' : 'arcs';
    selectSeat(seat);
    return;
  }
  const h = handleFor(e.target);
  if (!h || !seat) return;
  if (h.card) { h.move = ['--cards-x', '--cards-y']; h.label = 'hand'; markPiece('hand'); }
  else if (h.sel === '.sidearcs') markPiece('arcs');
  if (!h.move) return;
  e.preventDefault(); e.stopPropagation();
  drag = { h, seat, x0: e.clientX, y0: e.clientY,
           ax: seatVal(seat, h.move[0]), ay: seatVal(seat, h.move[1]) };
  document.body.classList.add('cal-dragging');
}
function onMove(e) {
  if (rot && selSeat) {
    e.preventDefault();
    const a = Math.atan2(e.clientY - rot.cy, e.clientX - rot.cx);
    let deg = rot.r0 + (a - rot.a0) * 180 / Math.PI;
    deg = ((deg + 180) % 360 + 360) % 360 - 180;            // keep it in (-180, 180]
    if (e.shiftKey) deg = Math.round(deg / 5) * 5;          // shift snaps to 5 degrees
    const v = setSeatVar(selSeat, rot.name, deg, 'deg');
    say(`box ${seatIdx(selSeat) + 1}  ${rot.name === '--hand-rot' ? 'hand turn' : 'crescents'} ${v}\u00b0`);
    return;
  }
  if (!drag) return;
  e.preventDefault();
  const x = setSeatVar(drag.seat, drag.h.move[0], drag.ax + (e.clientX - drag.x0));
  const y = setSeatVar(drag.seat, drag.h.move[1], drag.ay + (e.clientY - drag.y0));
  say(`box ${seatIdx(drag.seat) + 1}  ${drag.h.label}  x ${x}  y ${y}`);
}
function onUp() {
  if (!rot && !drag) return;
  rot = null; drag = null;
  document.body.classList.remove('cal-dragging');
}
function onWheel(e) {
  if (!panel) return;
  const seat = e.target.closest?.('.seat');
  if (!seat) return;
  const lbl = e.target.closest?.('.side-label');
  const cardSlot = slotOf(e.target);
  e.preventDefault();
  selectSeat(seat);
  const step = e.shiftKey ? 0.5 : 2;
  const dir = e.deltaY > 0 ? step : -step;
  if (cardSlot !== null) {
    markPiece('hand');
    const v = setSeatVar(seat, '--hand-rot', seatVal(seat, '--hand-rot') + dir, 'deg');
    say(`box ${seatIdx(seat) + 1}  hand turn ${v}\u00b0`);
    return;
  }
  if (lbl) {
    markPiece('arcs');
    const name = lbl.textContent.trim() === 'PP' ? '--pp-rot' : '--tp-rot';
    const v = setSeatVar(seat, name, seatVal(seat, name) + dir, 'deg');
    say(`box ${seatIdx(seat) + 1}  ${lbl.textContent.trim()} label ${v}\u00b0`);
  } else {
    markPiece('arcs');
    const v = setSeatVar(seat, '--arc-rot', seatVal(seat, '--arc-rot') + dir, 'deg');
    say(`box ${seatIdx(seat) + 1}  rotation ${v}\u00b0`);
  }
}
addEventListener('pointerdown', onDown, true);
addEventListener('pointermove', onMove, true);
addEventListener('pointerup', onUp, true);
addEventListener('wheel', onWheel, { passive: false, capture: true });
addEventListener('keydown', e => {
  if (!panel || !selSeat || !/^(\[|\]|ArrowLeft|ArrowRight)$/.test(e.key)) return;
  if (/^(INPUT|TEXTAREA)$/.test(e.target?.tagName ?? '')) return;
  e.preventDefault();
  const d = (e.key === ']' || e.key === 'ArrowRight') ? 1 : -1;
  const v = setSeatVar(selSeat, '--arc-rot', seatVal(selSeat, '--arc-rot') + d, 'deg');
  say(`box ${seatIdx(selSeat) + 1}  rotation ${v}\u00b0`);
});

// push the selected box's pose onto every box
export function applyToAll(confirmed) {
  if (!selSeat) { say('select a box first'); return; }
  if (!confirmed && !window.confirm(`Copy box ${seatIdx(selSeat) + 1}'s pose onto ALL boxes?\n\nThis overwrites every other box.`)) return;
  const src = perSeat[seatIdx(selSeat)] ?? {};
  document.querySelectorAll('.seat').forEach(s => {
    const i = seatIdx(s);
    perSeat[i] = { ...(perSeat[i] ?? {}), ...src };
    for (const [k, v] of Object.entries(src)) s.style.setProperty(k, v);
  });
  localStorage.setItem(STORE + '.seats', JSON.stringify(perSeat));
  say(`box ${seatIdx(selSeat) + 1} pose applied to all boxes`);
}

export function seatCss() {
  return Object.entries(perSeat).filter(([, v]) => Object.keys(v).length).map(([i, vars]) =>
    `.seat[data-box="${i}"] {\n` + Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`).join('\n') + '\n}').join('\n');
}
export function resetSeats() {
  document.querySelectorAll('.seat').forEach(s => {
    for (const k of Object.keys(perSeat[seatIdx(s)] ?? {})) s.style.removeProperty(k);
  });
  perSeat = {}; localStorage.removeItem(STORE + '.seats');
  selectSeat(null);
}

export function toggle() {
  if (panel) {
    panel.remove(); panel = null;
    document.body.classList.remove('cal-on');
    selectSeat(null);
    return;
  }
  // The entry gate covers the whole viewport. Calibrating behind it means no
  // click can reach a box, so nothing is ever selected and every edit lands on
  // all boxes - which reads as "per-box does not work".
  const gate = document.querySelector('#gate');
  if (gate && !gate.classList.contains('hidden')) {
    document.querySelector('#gate-enter')?.click();
    gate.classList.add('hidden');   // regardless of whether that handler is wired yet
  }
  build();
  document.body.classList.add('cal-on');
}

addEventListener('keydown', e => {
  if (typeof e.key !== 'string' || e.key.toLowerCase() !== 'c') return;
  if (/^(INPUT|TEXTAREA)$/.test(e.target?.tagName ?? '')) return;   // never steal chat typing
  toggle();
});

// This module is imported dynamically, usually AFTER the page's load event has
// already fired - so waiting for 'load' meant ?cal=1 silently never opened.
if (new URLSearchParams(location.search).has('cal')) {
  if (document.readyState === 'complete') toggle();
  else addEventListener('load', () => toggle(), { once: true });
}

// A button, so opening this never depends on remembering a key or a query.
addEventListener('DOMContentLoaded', mountButton);
if (document.readyState !== 'loading') mountButton();
function mountButton() {
  if (document.querySelector('#cal-btn')) return;
  const host = document.querySelector('#top-right');
  if (!host) return;
  const b = document.createElement('button');
  b.id = 'cal-btn';
  b.title = 'calibrate the table layout (C)';
  b.textContent = '⚙';
  b.onclick = toggle;
  host.insertBefore(b, host.firstChild);
}
