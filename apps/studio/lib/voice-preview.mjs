import { StudioError } from './project-store.mjs';

// The social service still reports this retired capability and rejects its
// legacy fallback. Generated speech uses its separate Render service.
const disabledMessage = 'Det fristående röstprovet är avstängt. Tal i molnläget kräver Render och dess beständiga kostnadsjournal.';

export function voicePreviewStatus() { return { configured: false }; }

export async function generateVoicePreview() {
  throw new StudioError(disabledMessage, 503);
}
