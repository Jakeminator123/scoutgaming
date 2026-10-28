// Kevin's H/S/D/P behaviour, adapted to the shared-room controller through its
// existing buttons. No global letter shortcuts: the decision controls must have
// focus. In particular P is split, never the 24-hour pause or a betting action.
const keys = new Map([['h','hit'],['s','stand'],['d','double'],['p','split']]);
const panels = '#actions-top, #actions';

export function installSharedRoomShortcuts(document) {
  // A non-browser/DOM-only renderer has no visible, focusable controls.
  if (typeof document.defaultView?.getComputedStyle !== 'function') return () => {};
  const controls = [...document.querySelectorAll('[data-act]')]
    .filter(node => [...keys.values()].includes(node.dataset.act));
  const cleanups = [];
  let closed = false;
  const visible = node => {
    if (!node?.isConnected || node.closest('[hidden], [inert], [aria-hidden="true"]') || !node.getClientRects().length) return false;
    const style = document.defaultView.getComputedStyle(node);
    return style.display !== 'none' && !['hidden','collapse'].includes(style.visibility) && style.opacity !== '0';
  };
  const enabled = node => visible(node) && !node.disabled && !node.matches(':disabled')
    && !node.closest('[aria-disabled="true"]');
  for (const control of controls) {
    const key = [...keys].find(([,action]) => action === control.dataset.act)[0].toUpperCase();
    const oldShortcut = control.getAttribute('aria-keyshortcuts'), oldTitle = control.getAttribute('title');
    control.setAttribute('aria-keyshortcuts',key);
    if (!oldTitle) control.setAttribute('title',`${key} när en beslutsknapp har fokus`);
    const onKey = event => {
      if (closed || document.hidden || event.defaultPrevented || event.repeat || event.isComposing || event.keyCode === 229
        || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || typeof event.key !== 'string') return;
      const action = keys.get(event.key.toLowerCase());
      // Only a real decision button with focus can activate its panel. Editing
      // fields, contenteditable ancestors, native selects and other panels keep
      // their keys. A modal must not leak keyboard commands to the table.
      if (!action || document.activeElement !== control || control.isContentEditable || !enabled(control)) return;
      if ([...document.querySelectorAll('dialog[open], [role="dialog"][aria-modal="true"]')].some(visible)) return;
      const panel = control.closest(panels);
      if (!panel) return;
      const target = controls.find(node => node.dataset.act === action && node.closest(panels) === panel && enabled(node));
      if (!target) return;
      event.preventDefault();
      // The existing click listener calls controller.dispatch. Its current turn,
      // deadline, pause, connection and in-flight-command gates still apply.
      target.click();
    };
    control.addEventListener('keydown',onKey);
    cleanups.push(() => {
      control.removeEventListener('keydown',onKey);
      if (oldShortcut === null) control.removeAttribute('aria-keyshortcuts'); else control.setAttribute('aria-keyshortcuts',oldShortcut);
      if (oldTitle === null) control.removeAttribute('title'); else control.setAttribute('title',oldTitle);
    });
  }
  return () => { if (closed) return; closed = true; cleanups.forEach(cleanup => cleanup()); };
}
