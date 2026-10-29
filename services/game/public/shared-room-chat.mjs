import { CHAT_STAGES, readChatResponse } from '../../../packages/presentation/contracts/chat-response.mjs';

// Chat in the shared table (PR 1b): a small panel that can be folded away. Lines arrive from the room
// socket (shared-room-client onChat) for everyone; the asker's own POST result fills in a line the
// socket has not delivered. Text is always textContent. Chat never touches the table's controls.
const offline = 'Dealerns chatt är inte inkopplad i den här miljön. Spelet fortsätter som vanligt.';
const notices = Object.freeze({
  openclaw_not_configured: offline, product_speech_relay_not_configured: offline,
  shared_room_chat_too_soon: 'Vänta några sekunder innan nästa fråga.',
  shared_room_chat_busy: 'Dealern svarar redan på din fråga.',
  stale_round_revision: 'Rundan hann ändras. Skicka frågan igen.',
  shared_room_chat_not_member: 'Ta en plats vid bordet för att chatta med dealern.',
  shared_room_authentication_required: 'Logga in för att chatta med dealern.',
  shared_room_forbidden: 'Logga in för att chatta med dealern.',
});
const failure = 'Dealern kunde inte svara just nu. Spelet fortsätter.';
const maxLines = 30;
const label = line => line.who === 'dealer' ? 'dealern' : line.who === 'you' ? 'du' : line.seat ? `plats ${line.seat}` : 'spelare';
const round = snapshot => snapshot.roundId ?? 'window:' + snapshot.windowId;

// speak(descriptor): presentation.speak of the room (PR 3); everyone plays the dealer's answer through it (PR 4).
// A muted player gets the text and a "Slå på ljud" button (enableSound).
export function createSharedRoomChatPanel({ document, roomId, state, fetchImpl, randomId = () => globalThis.crypto.randomUUID(), speak = null, enableSound = null } = {}) {
  if (typeof document?.createElement !== 'function' || !/^[a-z0-9_-]{1,128}$/.test(roomId ?? '')
    || typeof state !== 'function' || typeof fetchImpl !== 'function' || typeof randomId !== 'function'
    || (speak !== null && typeof speak !== 'function') || (enableSound !== null && typeof enableSound !== 'function')) throw new TypeError('shared_room_chat_invalid_options');
  const make = (tag, className, text) => { const node = document.createElement(tag); node.className = className; if (text !== undefined) node.textContent = text; return node; };
  const panel = make('section', 'room-chat'), toggle = make('button', 'room-chat-toggle', 'Chatt'), unreadBadge = make('span', 'room-chat-unread');
  const body = make('div', 'room-chat-body'), log = make('ol', 'room-chat-log'), status = make('p', 'room-chat-status');
  const form = make('form', 'room-chat-form'), input = make('input', 'room-chat-input'), send = make('button', 'room-chat-send', 'Skicka');
  const shut = make('button', 'room-chat-close', '×');
  panel.id = 'shared-room-chat'; panel.setAttribute('aria-label', 'Chatt med dealern');
  body.id = 'shared-room-chat-body'; body.hidden = true;
  toggle.type = 'button'; toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-controls', body.id);
  unreadBadge.hidden = true; unreadBadge.setAttribute('aria-label', 'olästa');
  log.setAttribute('aria-live', 'polite'); status.setAttribute('role', 'status');
  input.type = 'text'; input.maxLength = 1000; input.autocomplete = 'off'; input.placeholder = 'Fråga dealern…';
  input.setAttribute('aria-label', 'Meddelande till dealern'); send.type = 'submit';
  const sound = make('button', 'room-chat-sound'); sound.type = 'button'; sound.hidden = true;
  shut.type = 'button'; shut.setAttribute('aria-label', 'Stäng chatten');
  toggle.append(unreadBadge); form.append(input, send); body.append(log, status, form, sound, shut); panel.append(toggle, body);
  // The folded pill is one of the seat controls in the header's flow (shared-room-view), so it can never cover a seat,
  // a bet or a decision at any width; opened, the log is an overlay below the header with its own close button.
  const host = document.getElementById?.('shared-room-controls');
  if (host) { panel.classList.toggle('room-chat-docked', true); host.append(panel); } else document.body.append(panel);
  // Sit just below the header, whose height wraps with its buttons (phones get two rows).
  const header = document.getElementById?.('hud-top');
  const place = () => { const bottom = header?.getBoundingClientRect?.().bottom;
    if (Number.isFinite(bottom)) panel.style.setProperty('--room-chat-top', Math.round(bottom + 6) + 'px'); };
  const observer = header && typeof globalThis.ResizeObserver === 'function' ? new globalThis.ResizeObserver(place) : null;
  observer?.observe(header); place();
  const seen = new Set(), spoken = new Set();
  let open = false, unread = 0, pending = null, closed = false;
  // One playback per answer line: the asker's NDJSON result and this socket's frame carry the same lineId.
  function play(key, descriptor) {
    if (!speak || !key || !descriptor || spoken.has(key)) return;
    spoken.add(key);
    Promise.resolve().then(() => speak(descriptor)).then(result => {
      if (closed || result?.speech !== 'text-only' || !result.action || !enableSound) return;
      sound.textContent = result.action; sound.hidden = false;
    }).catch(() => {});
  }
  function onSound() { sound.hidden = true; enableSound?.(); }
  function receive(line) {
    if (closed) return;
    // Deduplicate on the server's line id (q-/a-<hex>), never on requestId: another member can reuse
    // anyone's requestId, and that must not hide or replace a line here (review fix).
    const key = typeof line.lineId === 'string' && /^[qa]-[0-9a-f]{24}$/.test(line.lineId) ? line.lineId : null;
    if (line.who === 'dealer' && line.speech) play(key, line.speech);
    if (key && seen.has(key)) return;
    if (key) seen.add(key);
    const item = make('li', 'room-chat-line room-chat-' + line.who);
    item.append(make('span', 'room-chat-who', label(line)), make('span', 'room-chat-text', line.text));
    log.append(item);
    while (log.children.length > maxLines) log.firstElementChild.remove();
    log.scrollTop = log.scrollHeight;
    if (!open && line.who !== 'you') { unread++; unreadBadge.textContent = String(unread); unreadBadge.hidden = false; }
  }
  function onToggle() {
    open = !open; body.hidden = !open; toggle.setAttribute('aria-expanded', String(open)); panel.classList.toggle('open', open);
    if (open) { unread = 0; unreadBadge.hidden = true; log.scrollTop = log.scrollHeight; input.focus(); }
  }
  function onClose() { if (open) onToggle(); toggle.focus(); }
  function onKey(event) { if (event.key === 'Escape') { event.preventDefault?.(); onClose(); } }
  async function onSubmit(event) {
    event.preventDefault();
    const message = input.value.trim(), snapshot = state()?.snapshot;
    if (closed || pending || !message) return;
    if (!snapshot) { status.textContent = 'Bordet laddas fortfarande.'; return; }
    const controller = new AbortController(), requestId = 'chat-' + randomId();
    pending = controller; send.disabled = true; status.textContent = CHAT_STAGES.text;
    try {
      const response = await fetchImpl(`/api/shared-room/${roomId}/chat`, { method: 'POST', credentials: 'same-origin', mode: 'same-origin',
        redirect: 'error', cache: 'no-store', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
        body: JSON.stringify({ requestId, message, roundRevision: round(snapshot), acceptsSpeechStream: Boolean(speak) }) });
      const decision = await readChatResponse(response);
      if (closed) return;
      input.value = ''; status.textContent = '';
      receive({ lineId: decision?.questionLineId, requestId, who: 'you', seat: null, text: message });
      if (decision?.kind === 'generatedText' && typeof decision.exactText === 'string') receive({ lineId: decision.lineId, requestId, who: 'dealer', seat: null, text: decision.exactText,
        ...(decision.speechStream ? { speech: decision.speechStream } : {}) });
      else status.textContent = 'Dealern lät frågan vara.';
    } catch (error) {
      if (!closed && !controller.signal.aborted) status.textContent = notices[error?.message] ?? failure;
    } finally {
      if (pending === controller) { pending = null; if (!closed) send.disabled = false; }
    }
  }
  toggle.addEventListener('click', onToggle); form.addEventListener('submit', onSubmit); sound.addEventListener('click', onSound);
  shut.addEventListener('click', onClose); body.addEventListener('keydown', onKey);
  return Object.freeze({
    receive,
    close() {
      if (closed) return;
      closed = true; pending?.abort(); pending = null; observer?.disconnect();
      toggle.removeEventListener('click', onToggle); form.removeEventListener('submit', onSubmit); sound.removeEventListener('click', onSound);
      shut.removeEventListener('click', onClose); body.removeEventListener('keydown', onKey); panel.remove();
    },
  });
}
