// "Are you sure?" before a move nobody makes on purpose (tester feedback 8 Oct): hitting or doubling on a
// hard 17 or more. A slip there costs the player and changes the cards for everyone after them.
import { total } from './game-events.js';

/** True when the hand is hard (no ace still counted as 11) and totals 17 or more. */
export function hardTotal(cards) {
  const t = total(cards);
  let raw = 0;
  for (const c of cards) raw += c.r === 'A' ? 1 : ['J', 'Q', 'K'].includes(c.r) ? 10 : Number(c.r);
  return t === raw ? t : null;   // an ace counted as 11 makes it soft
}
export function needsConfirm(action, cards) {
  const h = hardTotal(cards ?? []);
  return (action === 'hit' || action === 'double') && h !== null && h >= 17;
}

// The open dialog's answer: one at a time, and the table closes it (No) once the turn has moved on.
let open = null;
export function dismissConfirm() { open?.(false); }

/** Small in-page dialog (no window.confirm: it blocks the table and can't be styled). Resolves true on Yes. */
export function askConfirm(text) {
  dismissConfirm();
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'confirm-move';
    wrap.setAttribute('role', 'alertdialog');
    wrap.setAttribute('aria-modal', 'true');
    const p = document.createElement('p'); p.textContent = text;
    const yes = document.createElement('button'); yes.type = 'button'; yes.textContent = 'Yes';
    const no = document.createElement('button'); no.type = 'button'; no.className = 'ghost'; no.textContent = 'No';
    const done = (v) => { if (open === done) open = null; wrap.remove(); document.removeEventListener('keydown', key); resolve(v); };
    open = done;
    const key = (e) => { if (e.key === 'Escape') done(false); };
    yes.addEventListener('click', () => done(true));
    no.addEventListener('click', () => done(false));
    document.addEventListener('keydown', key);
    const row = document.createElement('div'); row.append(no, yes);
    wrap.append(p, row);
    document.body.append(wrap);
    no.focus();
  });
}
