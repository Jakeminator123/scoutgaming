// Kevin 24 Oct: the maintenance banner. /notice.js sets MAINTENANCE_NOTICE when the env has MAINTENANCE_NOTICE=1
// (server.mjs); empty means no banner. It sits over the top of the table and lets taps through to the game.
(function () {
  var text = globalThis.MAINTENANCE_NOTICE;
  if (!text) return;
  var el = document.createElement('div');
  el.id = 'maintenance-notice';
  el.setAttribute('role', 'status');
  el.textContent = text;
  el.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483000;padding:8px 16px;text-align:center;' +
    'font:600 14px/1.35 system-ui,sans-serif;color:#1a1300;background:rgba(255,196,0,.94);pointer-events:none;' +
    'padding-top:calc(8px + env(safe-area-inset-top,0px))';
  document.body.appendChild(el);
})();
