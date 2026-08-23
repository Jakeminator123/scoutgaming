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
    ['--cards-x', 'x', -70, 70, 1, 'px'],
    ['--cards-y', 'y', -110, 40, 1, 'px'],
    ['--cards-flat', 'lay flat', 0.25, 1, 0.01, ''],
    ['--cards-rot-k', 'follow arc', 0, 1.5, 0.05, ''],
  ]],
  ['Side-bet chips', [
    ['--ppchip-x', 'PP x', -20, 110, 1, 'px'],
    ['--ppchip-y', 'PP y', -20, 110, 1, 'px'],
    ['--tpchip-x', '21+3 x', -20, 130, 1, 'px'],
    ['--tpchip-y', '21+3 y', -20, 110, 1, 'px'],
  ]],
  ['Dealer window', [
    ['--dealer-h', 'size', 30, 120, 0.5, 'vh'],
    ['--dealer-top', 'top', -10, 40, 0.5, 'vh'],
  ]],
];

const read = name => getComputedStyle(ROOT).getPropertyValue(name).trim();
const numOf = v => parseFloat(v);

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
      <span class="cal-note">click a box on the felt, drag its lime handle to rotate. wheel = rotate, shift = fine</span>
      <button class="cal-x" title="close (C)">×</button>
    </header>
    <div class="cal-body"></div>
    <footer>
      <button class="cal-all">APPLY TO ALL</button>
      <button class="cal-copy">COPY CSS</button>
      <button class="cal-reset">RESET</button>
    </footer>`;
  const body = panel.querySelector('.cal-body');

  for (const [title, rows] of GROUPS) {
    const sec = document.createElement('section');
    sec.innerHTML = `<h4>${title}</h4>`;
    for (const [name, label, min, max, step, unit] of rows) {
      const cur = numOf(saved[name] ?? read(name));
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
        const val = `${v}${unit}`;
        ROOT.style.setProperty(name, val);
        saved[name] = val;
        range.value = v; number.value = v;
        localStorage.setItem(STORE, JSON.stringify(saved));
        window.dispatchEvent(new Event('resize'));   // relayout the seat ring
      };
      range.oninput = e => set(e.target.value);
      number.oninput = e => set(e.target.value);
      sec.appendChild(row);
    }
    body.appendChild(sec);
  }

  panel.querySelector('.cal-x').onclick = toggle;
  panel.querySelector('.cal-all').onclick = applyToAll;
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

let selSeat = null, handle = null;
function selectSeat(seat) {
  document.querySelectorAll('.seat.cal-sel').forEach(s => s.classList.remove('cal-sel'));
  selSeat = seat;
  if (!seat) { handle?.remove(); handle = null; return; }
  seat.classList.add('cal-sel');
  if (!handle) {
    handle = document.createElement('div');
    handle.className = 'cal-handle';
    handle.title = 'drag to rotate this box';
    handle.addEventListener('pointerdown', startRotate);
  }
  seat.appendChild(handle);
  say(`box ${seatIdx(seat) + 1} selected \u2014 drag the handle to rotate`);
}

let rot = null;
function startRotate(e) {
  if (!selSeat) return;
  e.preventDefault(); e.stopPropagation();
  const inner = selSeat.querySelector('.sidearcs').getBoundingClientRect();
  const cx = inner.left + inner.width / 2, cy = inner.top + inner.height / 2;
  rot = { cx, cy, a0: Math.atan2(e.clientY - cy, e.clientX - cx), r0: seatVal(selSeat, '--arc-rot') };
  try { handle.setPointerCapture?.(e.pointerId); } catch { /* synthetic pointer, capture not needed */ }
  document.body.classList.add('cal-dragging');
}

const HANDLES = [
  { sel: '.sidearcs', label: 'crescents', move: ['--arc-x', '--arc-y'] },
  { sel: '.spot', label: 'betting spot', move: ['--spot-x', '--spot-y'] },
  { sel: '.seat .cards', label: 'cards', move: ['--cards-x', '--cards-y'] },
  { sel: '.pp-chip', label: 'PP chip', move: ['--ppchip-x', '--ppchip-y'] },
  { sel: '.tp-chip', label: '21+3 chip', move: ['--tpchip-x', '--tpchip-y'] },
];
const handleFor = el => {
  for (const h of HANDLES) { const hit = el.closest?.(h.sel); if (hit) return { ...h, el: hit }; }
  return null;
};

let drag = null;
function onDown(e) {
  if (!panel || e.button !== 0 || e.target.closest('#calibrator, .cal-handle')) return;
  const seat = e.target.closest?.('.seat');
  if (seat && seat !== selSeat) { e.preventDefault(); e.stopPropagation(); selectSeat(seat); return; }
  const h = handleFor(e.target);
  if (!h || !seat) return;
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
    if (e.shiftKey) deg = Math.round(deg / 5) * 5;          // shift snaps to 5 degrees
    const v = setSeatVar(selSeat, '--arc-rot', deg, 'deg');
    say(`box ${seatIdx(selSeat) + 1}  rotation ${v}\u00b0`);
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
  e.preventDefault();
  selectSeat(seat);
  const step = e.shiftKey ? 0.5 : 2;
  const dir = e.deltaY > 0 ? step : -step;
  if (lbl) {
    const name = lbl.textContent.trim() === 'PP' ? '--pp-rot' : '--tp-rot';
    const v = setSeatVar(seat, name, seatVal(seat, name) + dir, 'deg');
    say(`box ${seatIdx(seat) + 1}  ${lbl.textContent.trim()} label ${v}\u00b0`);
  } else {
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
export function applyToAll() {
  if (!selSeat) { say('select a box first'); return; }
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
  if (panel) { panel.remove(); panel = null; document.body.classList.remove('cal-on'); return; }
  build();
  document.body.classList.add('cal-on');
}

addEventListener('keydown', e => {
  if (e.key.toLowerCase() !== 'c') return;
  if (/^(INPUT|TEXTAREA)$/.test(e.target?.tagName ?? '')) return;   // never steal chat typing
  toggle();
});

if (new URLSearchParams(location.search).has('cal')) addEventListener('load', () => toggle());
