export type StudioPreviewSession = {
  sessionId: string; presentationLaneId: string; projectRevision: string; expiresAt: string; entryUrl: string;
};
export function createStudioPreview(
  request: {presentationLaneId: string; expectedProjectRevision: string},
  options?: {fetchImpl?: typeof fetch; signal?: AbortSignal; now?: () => number},
): Promise<StudioPreviewSession>;
