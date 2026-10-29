// K10 (Kevin's kevin/croupier-scoutgg/public/redesign.js at de31659c): H, S, D and P choose Hit, Stand, Double and
// Split. Kevin listened on the whole page; here a key acts only while a button of the decision panel has focus
// (WCAG 2.1.4: a single-letter shortcut is active only on focus), so a stray letter never doubles or splits a
// stake. Tab or a click gives the panel focus, and the view gives it back after each snapshot (keepFocus).
// The panel is one composite control: with focus on any of its buttons every key is armed, also D and P, which
// move money. Requiring focus on Double itself would make D say no more than Enter does, and the panel only
// exists during the player's own decision, when the controller checks each action's legality again (KEVIN-PORT K10).
// A key clicks the panel's own button: the controller checks turn, deadline, pause, connection and a pending
// command as it does for a pointer, and builds the same server command.
const KEYS = new Map([['h','hit'],['s','stand'],['d','double'],['p','split']]);
const keyOf = action => [...KEYS].find(([, value]) => value === action)?.[0].toUpperCase();
// The typed letter decides, so a Dvorak or AZERTY player's H is H. A layout without Latin letters (Cyrillic,
// Greek, Arabic) types another character, and then the physical key (`code` KeyH, KeyS, KeyD, KeyP) stands in.
// A named key (Dead, Process, Enter) types nothing and never stands for a letter.
const letterOf = event => /^[a-z]$/i.test(event.key) ? event.key.toLowerCase()
  : event.key.length === 1 && /^Key[A-Z]$/.test(event.code ?? '') ? event.code.slice(3).toLowerCase() : '';

// panel: the decision panel (#actions-top). decisions: its buttons, the same ones the view listens to.
export function installDecisionShortcuts(panel, decisions) {
  if (typeof panel?.addEventListener !== 'function') return () => {};
  const buttons = decisions.filter(node => keyOf(node.dataset.act));
  const saved = buttons.map(node => [node, node.getAttribute('aria-keyshortcuts'), node.getAttribute('title')]);
  for (const [node, , title] of saved) {
    node.setAttribute('aria-keyshortcuts', keyOf(node.dataset.act));
    if (!title) node.setAttribute('title', `Kortkommando ${keyOf(node.dataset.act)}`);
  }
  const onKey = event => {
    // Modifiers belong to the browser and the system, a held key repeats, and an input method composes text.
    if (event.defaultPrevented || event.repeat || event.isComposing || event.keyCode === 229
      || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || typeof event.key !== 'string') return;
    const action = KEYS.get(letterOf(event));
    if (!action || panel.hidden || !buttons.includes(event.target)) return;
    const target = buttons.find(node => node.dataset.act === action);
    if (!target || target.disabled) return;
    event.preventDefault();
    target.click();
  };
  panel.addEventListener('keydown', onKey);
  return () => {
    panel.removeEventListener('keydown', onKey);
    for (const [node, shortcut, title] of saved) {
      if (shortcut === null) node.removeAttribute('aria-keyshortcuts'); else node.setAttribute('aria-keyshortcuts', shortcut);
      if (title === null) node.removeAttribute('title'); else node.setAttribute('title', title);
    }
  };
}
