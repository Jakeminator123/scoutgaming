// Kevin 12 Oct: another dealer's table must not flash Astrid's still, then an empty table. Loaded right after the
// stage's still in index.html (classic script, runs before the first paint): for any dealer but Astrid the stage
// waits dark until dealer-layer.js has that dealer's own image (4 s at most).
(function () {
  // The still has no src in the HTML: a browser may paint while this file loads, and it must not paint Astrid then.
  var d = new URLSearchParams(location.search).get('dealer');
  var st = document.getElementById('stage'), im = st && st.querySelector('.still');
  if (!st || !im) return;
  if (!d || d === 'astrid') { im.src = '/media/startbild.png'; im.alt = 'Astrid at the blackjack table'; return; }
  st.classList.add('pending');
  setTimeout(function () { st.classList.remove('pending'); }, 4000);
})();
