import type { StudioProject } from './studio-model.mjs';

export interface SequenceDelivery {
  source: string;
  receivedAt: string | null;
  envelopeId: string | null;
  upstreamId: string | null;
  replay: boolean;
  recordIndex: number;
}
export interface PresentationStep extends SequenceDelivery {
  id: string;
  requestId: string | null;
  version: number | null;
  presentationIndex: number;
  channel: string;
  op: string | null;
  phase: string | null;
  event: unknown;
  sourceEvent: unknown;
  eventId: string | null;
  eventLabel: string | null;
  candidateEventIds: string[];
  label: string;
  evidence: 'instruction';
  actualPlaybackCaptured: false;
  uncertainty: string[];
  issue: string | null;
  blocked: boolean;
  deliveries: SequenceDelivery[];
}
export interface PresentationSequenceData {
  steps: PresentationStep[];
  notices: { kind: 'invalid' | 'gap' | 'connection' | 'conflict' | 'limit'; recordIndex: number | null; message: string }[];
  duplicates: number;
  batchCount: number;
  receivedCount: number;
  truncated: boolean;
}
export const SEQUENCE_STEP_LIMIT: number;
export function buildPresentationSequence(records: readonly unknown[], project: Pick<StudioProject, 'events'>): PresentationSequenceData;
