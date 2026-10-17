// Window popstate is dispatched at-target: capture does not move a later
// listener ahead of Next. RootLayout installs this inert proxy before hydration.
// It forwards only while an editor/Admin history owner is subscribed.
export const studioHistoryBootstrap = `(()=>{const key=Symbol.for('scout.studio-history');if(window[key])return;const bridge={handler:null};window[key]=bridge;const dispatch=event=>bridge.handler?.(event);window.addEventListener('popstate',dispatch,true);window.addEventListener('hashchange',dispatch,true);})();`;

// One history owner per document, shared by the native Lab editors and Admin.
// Keep the existing key so entries made by Admin before an editor mounts work.
const historyKey = '__scoutAdminHistory';
const owners = new WeakMap();
const isRecord = value => Object.prototype.toString.call(value) === '[object Object]';

export function studioHistory(window) {
  if (owners.has(window)) return owners.get(window);
  const {history, location} = window;
  const bridge = window[Symbol.for('scout.studio-history')];
  const subscribers = new Set(), guards = new Set();
  let previousHref = '', previousEntry = null, previousState = null;
  let restoring = false, deferredContext = null, listening = false;
  const currentHref = () => location.pathname + location.search + location.hash;
  const canonicalHref = href => {const url = new URL(href, location.href); return url.pathname + url.search + url.hash;};
  const newEntry = href => ({session: (window.crypto ?? globalThis.crypto).randomUUID(), index: 0, href});
  const readEntry = () => {
    const entry = isRecord(history.state) ? history.state[historyKey] : null;
    return isRecord(entry) && typeof entry.session === 'string' && Number.isSafeInteger(entry.index)
      && entry.href === currentHref() ? entry : null;
  };
  // Arrays, primitives and other non-record states belong to their consumer.
  // Preserve their type/value; without an index they use the fallback below.
  const withEntry = (state, entry) => state == null || isRecord(state) ? {...state, [historyKey]: entry} : state;
  const rememberCurrent = () => {
    previousHref = currentHref(); previousEntry = readEntry();
    if (!previousEntry) {
      // Metadata only: omit the URL so Next does not dispatch a navigation.
      history.replaceState(withEntry(history.state, newEntry(previousHref)), '');
      previousEntry = readEntry();
    }
    previousState = history.state;
  };
  const notify = event => subscribers.forEach(callback => callback(event));
  // Next's patched native API copies its router tree and publishes the new URL.
  // Passing __NA/_N would bypass that patch. Keep every other consumer's state,
  // and restore the flags if no Next wrapper is installed (e.g. native Admin).
  const writeUrl = (method, state, href) => {
    const flags = isRecord(state) ? Object.fromEntries(['__NA', '_N'].filter(key => Object.hasOwn(state, key)).map(key => [key, state[key]])) : {};
    const data = Object.keys(flags).length ? {...state} : state;
    for (const key of Object.keys(flags)) delete data[key];
    history[method](data, '', href);
    if (Object.entries(flags).some(([key, value]) => history.state?.[key] !== value)) {
      history.replaceState({...history.state, ...flags}, '');
    }
  };
  const canNavigate = href => !restoring
    && window.dispatchEvent(new CustomEvent('studio:before-navigate', {cancelable: true, detail: {href}}))
    && window.dispatchEvent(new CustomEvent('scout:navigate', {cancelable: true, detail: {href}}));
  const replaceContext = href => {
    if (restoring) {deferredContext = href; return;}
    const entry = readEntry() ?? newEntry(currentHref());
    writeUrl('replaceState', withEntry(history.state, {...entry, href: canonicalHref(href)}), href);
    rememberCurrent();
  };
  const finishRestore = () => {
    restoring = false;
    if (deferredContext !== null) {
      const href = deferredContext, restoredHref = previousHref; deferredContext = null;
      replaceContext(href);
      if (previousHref !== restoredHref) notify();
    }
    stopUnused();
  };
  const restorePrevious = entry => {
    if (entry && previousEntry && entry.session === previousEntry.session && entry.index !== previousEntry.index) {
      restoring = true; history.go(previousEntry.index - entry.index); return;
    }
    // The History API cannot locate older/external unindexed same-document
    // entries. Preserve the draft and forward stack, but replace this unknown
    // destination. A new session prevents using a guessed delta on later moves.
    // This is restoration, not a new URL publication: the accepted Next query
    // is still active. Keep its router tree; Next's copy hook would take the
    // rejected destination's tree if we stripped the accepted __NA flag.
    history.replaceState(withEntry(previousState, newEntry(previousHref)), '', previousHref);
    previousEntry = readEntry(); previousState = history.state; finishRestore();
  };
  const changed = event => {
    const href = currentHref(), entry = readEntry();
    // A traversal with a fragment also emits hashchange. It has already been
    // accepted or compensated by popstate; never run its guard twice.
    if (event.type === 'hashchange') {
      if (restoring) {event.stopImmediatePropagation(); return;}
      if (href === previousHref) return;
    }
    if (restoring) {
      event.stopImmediatePropagation();
      if (entry && previousEntry && entry.session === previousEntry.session && entry.index === previousEntry.index && href === previousHref) {
        previousState = history.state; finishRestore();
      } else restorePrevious(entry);
      return;
    }
    if ([...guards].some(guard => guard(href, event) === false) || !canNavigate(href)) {
      // Lab's early proxy runs before Next; native Admin has no Next listener.
      // Rejected destinations cannot publish a query or unmount this draft.
      event.stopImmediatePropagation(); restorePrevious(entry); return;
    }
    rememberCurrent(); notify(event);
  };
  const start = () => {
    if (listening) return;
    restoring = false; deferredContext = null; rememberCurrent(); listening = true;
    if (bridge) bridge.handler = changed;
    else {
      window.addEventListener('popstate', changed, true);
      window.addEventListener('hashchange', changed, true);
    }
  };
  const stopUnused = () => {
    if (subscribers.size || guards.size || restoring) return;
    if (bridge) {if (bridge.handler === changed) bridge.handler = null;}
    else {
      window.removeEventListener('popstate', changed, true);
      window.removeEventListener('hashchange', changed, true);
    }
    listening = false;
  };
  const owner = {
    subscribe(callback) {subscribers.add(callback); start(); return () => {subscribers.delete(callback); stopUnused();};},
    guardTraversal(guard) {guards.add(guard); start(); return () => {guards.delete(guard); stopUnused();};},
    snapshotHref: () => restoring ? previousHref : currentHref(),
    isRestoring: () => restoring,
    canNavigate,
    replaceContext,
    push(href, replace = false) {
      if (restoring) return false;
      const current = readEntry(), target = canonicalHref(href);
      const entry = current ? {...current, index: current.index + (replace ? 0 : 1), href: target} : newEntry(target);
      writeUrl(replace ? 'replaceState' : 'pushState', withEntry(history.state, entry), href);
      rememberCurrent(); notify(); return true;
    },
  };
  owners.set(window, owner);
  return owner;
}
