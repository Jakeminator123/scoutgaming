// Kevin 24 Oct: the maintenance banner. /notice.js sets MAINTENANCE_NOTICE at load (server.mjs); empty means no banner.
// Kevin 28 Oct: the banner follows RunPod (server/runpod-notice.mjs): every 30 s the page asks /api/notice for its dealer
// (html[data-dealer] from app.js, else ?dealer=) and shows or hides the banner as RunPod's state changes.
// The page moves down under it (Kevin: the logo, the table name and Settings stay uncovered). The table is sized to
// the screen (100dvh, fixed bars), so it moves down and shrinks by the banner's height as one piece; the studio
// scrolls, so it only gets the space at the top.
(function () {
  var root = document.documentElement, el = null, css = null, shown = '';
  function fit() {
    if (!el) return;
    var h = el.getBoundingClientRect().height, vh = window.innerHeight || 1;
    root.style.setProperty('--maint-h', h + 'px');
    root.style.setProperty('--maint-s', String(Math.max(0.5, (vh - h) / vh)));
  }
  function show(text) {
    if (!el) {
      el = document.createElement('div');
      el.id = 'maintenance-notice';
      el.setAttribute('role', 'status');
      el.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483000;padding:8px 16px;text-align:center;' +
        'font:600 14px/1.35 system-ui,sans-serif;color:#1a1300;background:#ffc400;pointer-events:none;' +
        'padding-top:calc(8px + env(safe-area-inset-top,0px))';
      // outside body: the table's body gets a transform below, and the banner must not move with it
      root.appendChild(el);
      css = document.createElement('style');
      css.textContent =
        'html.maint{background:#0b0c0e}' +
        'html.maint-fit{overflow:hidden}' +
        'html.maint body.maint-fit{transform-origin:top center;transform:translateY(var(--maint-h)) scale(var(--maint-s));overflow:hidden}' +
        'html.maint body:not(.maint-fit){padding-top:var(--maint-h)}';
      document.head.appendChild(css);
      window.addEventListener('resize', fit);
    }
    el.textContent = text;
    // the table: a transformed body holds its fixed bars too, so everything keeps its place relative to the table
    // (the move would otherwise let the screen-sized table scroll)
    if (document.querySelector('.app')) { document.body.classList.add('maint-fit'); root.classList.add('maint-fit'); }
    root.classList.add('maint');
    fit();
  }
  function hide() {
    if (!el) return;
    el.remove(); css.remove(); el = css = null;
    window.removeEventListener('resize', fit);
    root.classList.remove('maint', 'maint-fit'); document.body.classList.remove('maint-fit');
    root.style.removeProperty('--maint-h'); root.style.removeProperty('--maint-s');
  }
  function apply(text) {
    text = text || '';
    if (text === shown) return;
    shown = text;
    if (text) show(text); else hide();
  }
  function dealer() {
    return root.dataset.dealer || new URLSearchParams(location.search).get('dealer') || '';
  }
  function poll() {
    if (document.hidden) return;
    try {
      fetch('/api/notice?dealer=' + encodeURIComponent(dealer()), { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) { if (d) apply(d.text); })
        .catch(function () {});
    } catch (e) {}
  }
  apply(globalThis.MAINTENANCE_NOTICE);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', poll); else poll();
  setInterval(poll, 30000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) poll(); });
})();
