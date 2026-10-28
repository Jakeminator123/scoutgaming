// Emil 16 Oct: the desktop table. A green-screen dealer's 1080 x 1920 frame lies unchanged in a wide 16:9 scene,
// 0.9 of the scene's height wide, its top above the window (the approved mock-up
// greenscreen/desktop/scener/bredB_s11_skala090_hela_bordet_som_mobil.mp4, metodik GREENSCREEN-DESKTOP.md), with the
// room widened around it behind (rooms-wide/). Everything the phone shows under the table moves to the sides.
// Emil 27 Oct: no side panels any more, the table takes the window: the chat lies see-through top right, the game
// panel bottom right, the table's people and the links top left (desk.css).
// The page switches by itself on every resize: the phone layout up to 820 px wide (as before), the desktop table above:
//  - two columns (dealers and chat left, the game right) when both sides of the frame have room for one;
//  - one column on the right (dealers, chat, game) with the frame to its left when only one fits;
//  - the scene a little smaller than the window when even that does not fit at full height (near-square windows).
// ?layout=desk|mobile forces it (a test). A classic script in the stage, before the first paint, like stage-pending.js,
// so the page never flashes the other layout. desk.css draws it from the custom properties set here.
(function () {
  var html = document.documentElement, KEYED = ['dragge', 'paow', 'astrid2'];
  // the rooms widened for the desktop table (dealers.js ROOMS .wide); a room without one shows its own plate in the frame
  // over a blurred copy of it. Emil 28 Oct: all four (metodik bredda-rum-gemini.py: Dark Hall's wide table, each room's wall)
  var WIDE = { darkhall: '/media/dealers/rooms-wide/darkhall.jpg?v=20261028b', azure: '/media/dealers/rooms-wide/azure.jpg?v=20261028b',
    golden: '/media/dealers/rooms-wide/golden.jpg?v=20261028b', mahogany: '/media/dealers/rooms-wide/mahogany.jpg?v=20261028b' };
  function setRoom(id, wide) {
    var url = wide || WIDE[id];
    html.classList.toggle('room-wide', !!url);
    if (url) { html.style.setProperty('--room', 'url("' + url + '")'); html.dataset.roomWide = url; }   // desk-felt.js recolours it for a coloured felt
    else { html.style.removeProperty('--room'); delete html.dataset.roomWide; }
  }
  var forced = null, keyed = false;
  try {
    var q = new URLSearchParams(location.search), asked = q.get('dealer'), saved = localStorage.getItem('dealer');
    var allowed = q.has('table') ? KEYED : KEYED.filter(function (k) { return k !== 'marten'; });
    var d = asked === 'astrid' || allowed.indexOf(asked) >= 0 ? asked : allowed.indexOf(saved) >= 0 ? saved : 'astrid';
    // a Table Studio table keeps the dealer it was built with: the page learns it later (app.js setKeyed)
    keyed = KEYED.indexOf(d) >= 0 || q.has('table');
    forced = { desk: true, mobile: false }[q.get('layout')];
    var r = q.get('room'); if (!r) r = localStorage.getItem('room'); setRoom(r || 'darkhall');
  } catch (e) {}

  var COL_MIN = 268, COL_MAX = 430, FRAME = .9, on = false, mode = '';
  function layout(w, h) {
    var gut = Math.round(Math.min(26, Math.max(14, w * .016))), fw = FRAME * h, side = (w - fw) / 2 - 2 * gut;
    if (side >= COL_MIN) return { mode: 'two', sh: h, fx: (w - fw) / 2, col: Math.min(COL_MAX, side), gut: gut };
    var right = w - fw - 2 * gut;
    if (right >= COL_MIN) { var col = Math.min(COL_MAX, right); return { mode: 'one', sh: h, fx: (w - col - 2 * gut - fw) / 2, col: col, gut: gut }; }
    return { mode: 'one', sh: (w - COL_MIN - 2 * gut) / FRAME, fx: 0, col: COL_MIN, gut: gut };
  }
  function apply() {
    var w = innerWidth, h = innerHeight;
    // Kevin 23 Oct: the desktop table is retracted until DESKTOP_LAYOUT=1 (server.mjs /layout-flag.js): the phone layout for all
    var want = globalThis.DESKTOP_LAYOUT === true && (forced === true || forced !== false && keyed && w > 820);
    if (want) {
      var g = layout(w, h), s = html.style;
      s.setProperty('--sh', g.sh + 'px'); s.setProperty('--fx', g.fx + 'px'); s.setProperty('--col', g.col + 'px'); s.setProperty('--gut', g.gut + 'px');
      if (g.mode !== mode) { html.classList.toggle('desk-two', g.mode === 'two'); html.classList.toggle('desk-one', g.mode === 'one'); mode = g.mode; }
    }
    if (want === on && html.classList.contains('desk') === want) return;
    on = want;
    html.classList.toggle('desk', on);
    if (!on) { html.classList.remove('desk-two', 'desk-one'); mode = ''; }
    try { dispatchEvent(new Event('deskchange')); } catch (e) {}
  }
  apply();
  addEventListener('resize', apply);
  // the chat stops above the game panel and the hand log sits under the table's people, whatever their heights
  function watch(sel, prop) {
    var el = document.querySelector(sel);
    if (el && window.ResizeObserver) new ResizeObserver(function () { html.style.setProperty(prop, el.offsetHeight + 'px'); }).observe(el);
  }
  function watchAll() { watch('#gameDock', '--dock-h'); watch('.side .table-company', '--company-h'); }
  // this script runs inside the stage, before the game panel exists
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchAll);
  else watchAll();
  // app.js calls this once it knows the dealer for sure (a studio table's own dealer, or Astrid's filmed table)
  window.deskMode = { setKeyed: function (k) { keyed = !!k; apply(); }, setRoom: function (room) { setRoom(room && room.id, room && room.wide); },
    get on() { return on; } };
})();
