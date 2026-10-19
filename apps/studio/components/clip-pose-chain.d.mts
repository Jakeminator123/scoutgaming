export type ClipPoseChain = { declared: boolean; text: string };
export function clipPoseChain(metadata: { game?: string; mediaType?: string; kind?: string; eventId?: string; startPose?: string; endPose?: string } | null | undefined): ClipPoseChain | null;
