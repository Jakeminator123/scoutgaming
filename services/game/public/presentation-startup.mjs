// One first-frame boundary for every published dealer and playback adapter.
// Asset decoding stays with the selected adapter; the page never displays a
// default dealer while that adapter or a saved player choice is loading.
export function createPresentationStartup({ document, dealerId, timeoutMs = 30000, setTimer = setTimeout, clearTimer = clearTimeout, reload = () => globalThis.location?.reload() }) {
  const root = document.documentElement;
  const status = document.querySelector('#presentation-loading');
  let state = 'pending';
  root.dataset.presentationStartup = state;
  const timer = setTimer(() => fail(), timeoutMs);
  function fail() {
    if (state === 'ready' || state === 'navigating' || state === 'closed') return;
    state = 'failed'; root.dataset.presentationStartup = state;
    if (status) {
      status.textContent = 'Spelbordet kunde inte visas. Ladda om sidan för att försöka igen.';
      status.setAttribute('role', 'alert');
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = 'Ladda om';
      button.onclick = () => { if (state === 'failed') reload(); };
      status.append(button);
    }
  }
  return {
    get state() { return state; },
    ready(presentedDealer) {
      if (presentedDealer !== dealerId || ['ready','navigating','closed'].includes(state)) return false;
      clearTimer(timer); state = 'ready'; root.dataset.presentationStartup = state;
      if (status) { status.textContent = ''; status.hidden = true; }
      return true;
    },
    fail,
    navigate(url, replace) {
      clearTimer(timer); state = 'navigating'; root.dataset.presentationStartup = state;
      replace(url);
      // Suspend this module until navigation destroys it. No old dealer can
      // start in the gap between location.replace and the next document.
      return new Promise(() => {});
    },
    close() { clearTimer(timer); state = 'closed'; },
  };
}
