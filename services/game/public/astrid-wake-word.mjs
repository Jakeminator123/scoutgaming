// Wake audio stays in the browser's on-device recognizer. This module neither
// records nor uploads audio and never exposes recognition transcripts to callers.
function nameMatcher(names) {
  if (!Array.isArray(names) || !names.length || names.length > 4) throw new TypeError('A dealer wake name is required');
  const escaped = names.map(name => {
    if (typeof name !== 'string' || !name.trim() || name.length > 120 || /[\u0000-\u001f]/.test(name)) throw new TypeError('Invalid dealer wake name');
    return name.trim().replace(/[.*+?^{}$()|[\]\\]/g, char => '\\' + char);
  });
  return new RegExp('(^|[^\\p{L}\\p{N}\\p{M}_])(?:' + escaped.join('|') + ')(?=$|[^\\p{L}\\p{N}\\p{M}_])', 'iu');
}
const REARM_DELAY_MS = 300;
const START_TIMEOUT_MS = 10000;
const MAX_REARMS_PER_MINUTE = 3;

const messages = {
  unsupported: 'This browser does not support on-device wake-word recognition.',
  'local-unavailable': 'On-device speech recognition is unavailable for this language. No cloud service is used.',
  'gesture-required': 'Click Record to install the on-device language pack.',
  'language-downloading': 'The language pack is downloading. Try again when it is ready.',
  'install-failed': 'The on-device language pack could not be installed. Try again later.',
  'availability-failed': 'The browser could not check the on-device language pack.',
  'not-allowed': 'Microphone permission is missing. Allow the microphone and click Record again.',
  'service-not-allowed': 'The browser does not allow on-device speech recognition here.',
  'audio-capture': 'The microphone could not be opened for local wake-word recognition.',
  'language-not-supported': 'The on-device language pack is unavailable. No cloud service is used.',
  'no-speech': 'No speech was heard. Click Record to listen again.',
  network: 'On-device recognition was interrupted. No cloud fallback is started.',
  aborted: 'Wake-word recognition was interrupted. Click Record to listen again.',
  'start-failed': 'On-device wake-word recognition could not start.',
  'start-timeout': 'The browser did not confirm microphone startup. Try again.',
  'restart-limit': 'Wake-word recognition stopped repeatedly. Click Record to try again.',
  'guard-failed': 'Wake-word recognition stopped because the player state could not be checked.',
  'wake-handler-failed': 'Recording could not start after the wake word.',
};

function wakeError(code) {
  return Object.assign(new Error(messages[code] ?? messages['start-failed']), { code });
}

/**
 * start(): Promise<boolean>, true only after the browser confirms onstart.
 * Call start directly from the user's record click when a pack may need install.
 * onStatus({state,message,active}); onError(Error with code); onWake() has no data.
 * A wake/error stops the recognizer. The owner decides when to call start again.
 */
export function createAstridWakeWord({ onWake = () => {}, onStatus = () => {}, onError = () => {},
  canWake = () => true, RecognitionClass = globalThis.window?.SpeechRecognition || globalThis.window?.webkitSpeechRecognition,
  language = 'en-US', wakeNames = ['Astrid'] } = {}) {
  const dealerMatcher = nameMatcher(wakeNames), dealerName = wakeNames[0].trim();
  let generation = 0, wanted = false, listening = false, recognition = null;
  let pending = null, resolveStart = null, rearmTimer = null, startTimer = null, rearms = [];
  const valid = token => wanted && generation === token;
  const emit = (state, message) => onStatus({ state, message, active: listening });
  function settle(value) {
    const resolve = resolveStart;
    resolveStart = null; pending = null;
    resolve?.(value);
  }
  function abort(instance) { try { instance?.abort(); } catch { /* Already ended or never started. */ } }
  function detach(instance) {
    if (!instance) return;
    instance.onresult = instance.onerror = instance.onend = null;
    // A delayed permission grant must not leave an old microphone running.
    instance.onstart = () => abort(instance);
  }
  function halt(state, message) {
    const token = ++generation;
    wanted = false; listening = false;
    clearTimeout(rearmTimer); clearTimeout(startTimer); rearmTimer = startTimer = null;
    const previous = recognition; recognition = null;
    detach(previous); abort(previous); settle(false);
    emit(state, message);
    return token;
  }
  function fail(token, error) {
    if (!valid(token)) return;
    halt('error', error.message);
    onError(error);
  }
  function permitted(token) {
    try { return canWake() === true; }
    catch { fail(token, wakeError('guard-failed')); return false; }
  }
  function makeRecognition() {
    if (typeof RecognitionClass !== 'function' || typeof RecognitionClass.available !== 'function'
      || typeof RecognitionClass.install !== 'function') throw wakeError('unsupported');
    const instance = new RecognitionClass();
    if (!('processLocally' in instance) || typeof instance.start !== 'function' || typeof instance.abort !== 'function') throw wakeError('unsupported');
    instance.processLocally = true;
    if (instance.processLocally !== true) throw wakeError('unsupported');
    instance.lang = language;
    instance.continuous = true;
    instance.interimResults = true;
    instance.maxAlternatives = 1;
    return instance;
  }
  function beginRecognition(token, instance) {
    if (!valid(token)) { abort(instance); return; }
    recognition = instance;
    let suppressedThrough = -1;
    const current = () => valid(token) && recognition === instance;
    instance.onstart = () => {
      if (!current()) { abort(instance); return; }
      clearTimeout(startTimer); startTimer = null;
      listening = true;
      settle(true);
      emit('listening', `Listening locally for ${dealerName}. No audio is uploaded before the wake word.`);
    };
    instance.onresult = event => {
      if (!current() || !listening) return;
      const results = event?.results;
      if (!results || !Number.isInteger(results.length)) return;
      if (!permitted(token)) {
        suppressedThrough = Math.max(suppressedThrough, results.length - 1);
        return;
      }
      const first = Math.max(suppressedThrough + 1, Number.isInteger(event.resultIndex) ? event.resultIndex : 0);
      for (let index = first; index < results.length; index++) {
        const transcript = results[index]?.[0]?.transcript;
        if (typeof transcript !== 'string' || !dealerMatcher.test(transcript)) continue;
        if (!permitted(token) || !current()) return;
        const stopped = halt('wake', `${dealerName} heard. Wake-word recognition has stopped for recording.`);
        if (generation !== stopped) return;
        try {
          Promise.resolve(onWake()).catch(() => {
            if (generation === stopped) onError(wakeError('wake-handler-failed'));
          });
        } catch { if (generation === stopped) onError(wakeError('wake-handler-failed')); }
        return;
      }
    };
    instance.onerror = event => {
      if (!current()) return;
      fail(token, wakeError(Object.hasOwn(messages, event?.error) ? event.error : 'start-failed'));
    };
    instance.onend = () => {
      if (!current()) return;
      listening = false; recognition = null;
      detach(instance); clearTimeout(startTimer); startTimer = null;
      const now = performance.now();
      rearms = rearms.filter(time => now - time < 60000);
      if (rearms.length >= MAX_REARMS_PER_MINUTE) { fail(token, wakeError('restart-limit')); return; }
      rearms.push(now);
      emit('rearming', 'Restarting on-device listening.');
      if (!valid(token)) return;
      rearmTimer = setTimeout(() => {
        rearmTimer = null;
        if (!valid(token)) return;
        try { beginRecognition(token, makeRecognition()); }
        catch (error) { fail(token, error?.code ? error : wakeError('start-failed')); }
      }, REARM_DELAY_MS);
    };
    emit('starting', 'Starting on-device listening.');
    if (!current()) return;
    startTimer = setTimeout(() => fail(token, wakeError('start-timeout')), START_TIMEOUT_MS);
    try { instance.start(); }
    catch { fail(token, wakeError('start-failed')); }
  }
  async function prepare(token, userActivated) {
    try {
      const instance = makeRecognition();
      if (!valid(token)) return;
      recognition = instance;
      emit('checking', 'Checking on-device speech support.');
      if (!valid(token)) return;
      const options = { langs: [language], processLocally: true };
      let available;
      try { available = await RecognitionClass.available(options); }
      catch { throw wakeError('availability-failed'); }
      if (!valid(token)) return;
      if (available === 'downloadable') {
        if (!userActivated) throw wakeError('gesture-required');
        emit('installing', 'Installing the on-device language pack. Wake-word recognition has not started.');
        if (!valid(token)) return;
        try {
          if (await RecognitionClass.install(options) !== true) throw wakeError('install-failed');
          if (!valid(token)) return;
          available = await RecognitionClass.available(options);
        } catch { throw wakeError('install-failed'); }
        if (!valid(token)) return;
      }
      if (available === 'downloading') throw wakeError('language-downloading');
      if (available !== 'available') throw wakeError('local-unavailable');
      beginRecognition(token, instance);
    } catch (error) { fail(token, error?.code ? error : wakeError('start-failed')); }
  }
  return {
    async start() {
      if (wanted) {
        if (pending) return pending;
        if (listening) return true;
        // A duplicate start during the normal rearm waits for its real onstart.
        pending = new Promise(resolve => { resolveStart = resolve; });
        return pending;
      }
      wanted = true; listening = false; rearms = [];
      const token = ++generation;
      const userActivated = globalThis.navigator?.userActivation?.isActive === true;
      const ready = new Promise(resolve => { resolveStart = resolve; });
      pending = ready;
      void prepare(token, userActivated);
      return ready;
    },
    stop() { halt('stopped', 'On-device listening is off.'); },
    get active() { return listening; },
  };
}
