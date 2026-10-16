// Kevin 12 Oct: another dealer's table must not flash Astrid's still, then an empty table. Loaded right after the
// stage's still in index.html (classic script, runs before the first paint): for any dealer but Astrid the stage
// waits dark until dealer-layer.js has that dealer's own image (4 s at most).
(function () {
  // The still has no src in the HTML: a browser may paint while this file loads, and it must not paint Astrid then.
  // Same choice as dealers.js pick() and savedRoom(): ?dealer / ?room first, then the viewer's saved one. Keep V and the
  // lists in step with dealers.js.
  var V = '?v=20261011a', KEYED = ['dragge', 'paow', 'astrid2'], ROOMS = ['darkhall', 'mahogany', 'golden', 'azure'];
  var st = document.getElementById('stage'), im = st && st.querySelector('.still');
  if (!st || !im) return;
  var d = 'astrid', room = 'darkhall';
  try {
    var q = new URLSearchParams(location.search), asked = q.get('dealer'), saved = localStorage.getItem('dealer');
    d = asked === 'astrid' || KEYED.indexOf(asked) >= 0 ? asked : KEYED.indexOf(saved) >= 0 ? saved : 'astrid';
    var r = q.get('room'); if (ROOMS.indexOf(r) < 0) r = localStorage.getItem('room'); if (ROOMS.indexOf(r) >= 0) room = r;
  } catch (e) {}
  if (d === 'astrid') { im.src = '/media/startbild.png'; im.alt = 'Astrid at the blackjack table'; return; }
  st.classList.add('pending');
  setTimeout(function () { st.classList.remove('pending'); }, 4000);
  // Start the room and the dealer's VILA plate now, not when the game's modules have run (about 0.7 s later).
  im.src = '/media/dealers/rooms-v2/' + room + '.png' + V;
  new Image().src = '/media/dealers/' + d + '/v2/vila.png' + V;
})();
