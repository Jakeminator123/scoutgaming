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

function build() {
  panel = document.createElement('div');
  panel.id = 'calibrator';
  panel.innerHTML = `
    <header>
      <b>CALIBRATE</b>
      <span class="cal-note">drag a slider, or click a number and use ↑↓</span>
      <button class="cal-x" title="close (C)">×</button>
    </header>
    <div class="cal-body"></div>
    <footer>
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
  panel.querySelector('.cal-reset').onclick = () => {
    for (const k of Object.keys(saved)) ROOT.style.removeProperty(k);
    saved = {}; localStorage.removeItem(STORE);
    panel.remove(); panel = null; build();
    window.dispatchEvent(new Event('resize'));
  };
  panel.querySelector('.cal-copy').onclick = async () => {
    const css = ':root {\n' + Object.entries(saved).map(([k, v]) => `  ${k}: ${v};`).join('\n') + '\n}';
    try { await navigator.clipboard.writeText(css); } catch { /* fall through to the log */ }
    console.info('[calibration]\n' + css);
    const btn = panel.querySelector('.cal-copy');
    btn.textContent = 'COPIED';
    setTimeout(() => { btn.textContent = 'COPY CSS'; }, 1400);
  };
  document.body.appendChild(panel);
}

export function toggle() {
  if (panel) { panel.remove(); panel = null; return; }
  build();
}

addEventListener('keydown', e => {
  if (e.key.toLowerCase() !== 'c') return;
  if (/^(INPUT|TEXTAREA)$/.test(e.target?.tagName ?? '')) return;   // never steal chat typing
  toggle();
});

if (new URLSearchParams(location.search).has('cal')) addEventListener('load', () => toggle());
