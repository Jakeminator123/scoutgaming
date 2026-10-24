// Kevin 24 Oct: the maintenance banner. /notice.js sets MAINTENANCE_NOTICE when the env has MAINTENANCE_NOTICE=1
// (server.mjs); empty means no banner. The page moves down under it (Kevin: the logo, the table name and Settings
// stay uncovered). The table is sized to the screen (100dvh, fixed bars), so it moves down and shrinks by the banner's
// height as one piece; the studio scrolls, so it only gets the space at the top.
(function () {
  var text = globalThis.MAINTENANCE_NOTICE;
  if (!text) return;
  var root = document.documentElement, el = document.createElement('div');
  el.id = 'maintenance-notice';
  el.setAttribute('role', 'status');
  el.textContent = text;
  el.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483000;padding:8px 16px;text-align:center;' +
    'font:600 14px/1.35 system-ui,sans-serif;color:#1a1300;background:#ffc400;pointer-events:none;' +
    'padding-top:calc(8px + env(safe-area-inset-top,0px))';
  // outside body: the table's body gets a transform below, and the banner must not move with it
  root.appendChild(el);
  var css = document.createElement('style');
  css.textContent =
    'html.maint{background:#0b0c0e}' +
    'html.maint-fit{overflow:hidden}' +
    'html.maint body.maint-fit{transform-origin:top center;transform:translateY(var(--maint-h)) scale(var(--maint-s));overflow:hidden}' +
    'html.maint body:not(.maint-fit){padding-top:var(--maint-h)}';
  document.head.appendChild(css);
  // the table: a transformed body holds its fixed bars too, so everything keeps its place relative to the table
  // (the move would otherwise let the screen-sized table scroll)
  if (document.querySelector('.app')) { document.body.classList.add('maint-fit'); root.classList.add('maint-fit'); }
  root.classList.add('maint');
  function fit() {
    var h = el.getBoundingClientRect().height, vh = window.innerHeight || 1;
    root.style.setProperty('--maint-h', h + 'px');
    root.style.setProperty('--maint-s', String(Math.max(0.5, (vh - h) / vh)));
  }
  fit();
  window.addEventListener('resize', fit);
})();
