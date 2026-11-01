import { chatPresentationContext } from './chat-presentation-context.mjs';
import { readChatResponse } from '../../../packages/presentation/contracts/chat-response.mjs';

function chatBody({ requestId, message, history, dealer, entrySelection, identity }) {
  const presentationContext = chatPresentationContext(entrySelection, dealer);
  return { requestId, message, history, dealer,
    ...(presentationContext ? { presentationContext } : {}),
    sessionRevision: identity.sessionRevision, roundRevision: identity.roundRevision };
}

// Both paths use the game's existing API client. Only the native player can
// consume origin-bound speech streams; the linked lab transfers finished bytes.
export async function requestPlayerChat({ request, requestId, message, history, dealer, entrySelection, identity,
  signal, progressEvents = false, presentationVersion, images = [], profileRevision = null, onProgress, onPreview }) {
  const response = await request('/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: progressEvents ? 'application/x-ndjson' : 'application/json' }, signal,
    body: JSON.stringify({ ...chatBody({ requestId, message, history, dealer, entrySelection, identity }), acceptsSpeechStream: true,
      ...(presentationVersion !== undefined ? { presentationVersion } : {}),
      ...(images.length ? { observation: { version: 1, turnId: requestId, consentTurnId: requestId, profileRevision, images } } : {}) }),
  });
  return readChatResponse(response, onProgress, onPreview);
}

export function createLinkedChatSubmit({ request, tableReady, isBusy, setBusy, getIdentity, getContext, onChat, onReady }) {
  return async ({ requestId, text, signal }) => {
    if (isBusy()) throw new Error('A chat request is already active');
    await tableReady;
    if (signal.aborted) return;
    if (isBusy()) throw new Error('A chat request is already active');
    setBusy(true);
    const identity = getIdentity();
    onChat({ role: 'user', text, source: 'linked-lab-chat', requestId });
    try {
      const { dealer, entrySelection } = getContext();
      const response = await request('/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
        body: JSON.stringify(chatBody({ requestId, message: text, history: [], dealer, entrySelection, identity })),
      });
      if (!response.ok) throw new Error('Linked chat unavailable');
      const decision = await response.json();
      const current = getIdentity();
      if (signal.aborted || current.dealerId !== identity.dealerId || current.sessionRevision !== identity.sessionRevision || current.roundRevision !== identity.roundRevision) throw new Error('Stale linked chat');
      await onReady(decision);
    } finally { setBusy(false); }
  };
}
