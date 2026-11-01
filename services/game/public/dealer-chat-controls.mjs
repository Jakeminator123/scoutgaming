import { createAstridCameraControl } from './astrid-camera-control.mjs';

// Conversation visibility is independent of playback and never exposes Studio preview chat.
export function createDealerChatVisibility({ document, studioPreview, getToggle, scheduleInterfaceLayout }) {
  const log = () => document.querySelector('#chat-log');
  function setChatOpen(open) {
    if (studioPreview) return;
    log().classList.toggle('open', open);
    const toggle = getToggle();
    toggle?.setAttribute('aria-expanded', String(open));
    if (open && toggle) delete toggle.dataset.unread;
    scheduleInterfaceLayout();
  }
  function noteChatMessage(role) {
    if (studioPreview) return;
    const toggle = getToggle();
    if (role === 'user') setChatOpen(true);
    else if (!log().classList.contains('open') && toggle) toggle.dataset.unread = 'true';
  }
  return { setChatOpen, noteChatMessage };
}

// Camera readiness is server-validated by the camera control. Until then, keep
// the ordinary chat shell; a public dealer name alone cannot enable voice UI.
export function mountDealerVoiceControl({ document, studioPreview, dealer, setChatOpen,
  getChatState, ...options }, createControl = createAstridCameraControl) {
  if (studioPreview) return null;
  return createControl({ ...options, container: document.querySelector('#chat'),
    dealerName: dealer.name, wakeNames: [...new Set([dealer.name, dealer.key])],
    canStart: () => { const { busy, speaking } = getChatState(); return !busy && !speaking; },
    onReady: () => {
      document.body.classList.add('astrid-voice-ui');
      const style = document.createElement('link');
      style.rel = 'stylesheet'; style.href = '/astrid-voice-shell.css'; document.head.append(style);
      setChatOpen(false);
    } });
}
