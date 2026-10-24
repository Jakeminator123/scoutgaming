// One first-frame boundary for every published dealer and playback adapter.
// Asset decoding stays with the selected adapter; the page never displays a
// default dealer while that adapter or a saved player choice is loading.
export function createPresentationStartup({ document, dealerId, timeoutMs = 30000, setTimer = setTimeout, clearTimer = clearTimeout, reload = () => globalThis.location?.reload() }) {
  const root = document.documentElement;
  const status = document.querySelector('#presentation-loading');
  const loadingText = status?.textContent ?? '';
  let state = 'pending', gestureWaiting = false, timer, timerGeneration = 0;
  let resolveReady;
  const whenReady = new Promise(resolve => { resolveReady = resolve; });
  root.dataset.presentationStartup = state;
  const stopTimer = () => { ++timerGeneration; if (timer !== undefined) clearTimer(timer); timer = undefined; };
  const armTimer = () => {
    const generation = ++timerGeneration;
    timer = setTimer(() => { if (generation === timerGeneration) fail(); }, timeoutMs);
  };
  armTimer();
  function fail() {
    if (state === 'ready' || state === 'navigating' || state === 'closed') return;
    stopTimer(); gestureWaiting = false;
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
    whenReady,
    waitForGesture(presentedDealer, waiting) {
      if (presentedDealer !== dealerId || state !== 'pending' || typeof waiting !== 'boolean') return false;
      if (gestureWaiting === waiting) return true;
      gestureWaiting = waiting;
      // Waiting for a tap is not a slow page load. The film still owns its
      // absolute deadline and cancellation; the scene waits for a real frame.
      if (waiting) stopTimer(); else armTimer();
      if (status) status.textContent = waiting ? 'Tryck på Starta videon för att visa spelbordet.' : loadingText;
      return true;
    },
    ready(presentedDealer) {
      if (presentedDealer !== dealerId || ['ready','navigating','closed'].includes(state)) return false;
      stopTimer(); gestureWaiting = false; state = 'ready'; root.dataset.presentationStartup = state;
      if (status) { status.textContent = ''; status.hidden = true; }
      resolveReady();
      return true;
    },
    fail,
    navigate(url, replace) {
      stopTimer(); gestureWaiting = false; state = 'navigating'; root.dataset.presentationStartup = state;
      replace(url);
      // Suspend this module until navigation destroys it. No old dealer can
      // start in the gap between location.replace and the next document.
      return new Promise(() => {});
    },
    close() { stopTimer(); gestureWaiting = false; state = 'closed'; },
  };
}
