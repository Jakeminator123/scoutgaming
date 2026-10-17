export type DealerClipPose = 'VILA' | 'REDO' | 'WHEEL';
export interface DealerClipGuideSlot {
  id: string;
  category?: string;
  game?: string;
  eventId?: string;
  situation?: string;
  kind?: string;
  group?: string;
  pose?: string;
  label?: string;
  start?: string;
  end?: string;
}
export interface DealerClipGuide {
  schemaVersion: 1;
  slotId: string;
  known: boolean;
  title: string;
  summary: string;
  steps: { title: string; detail: string; pose: DealerClipPose | null }[];
  poses: {
    start: DealerClipPose | null;
    end: DealerClipPose | null;
    status: 'slot-template' | 'not-specified' | 'not-applicable';
    note: string;
    versions: { label: string; start: DealerClipPose; end: DealerClipPose; requirement: 'required' | 'conditional' }[];
  };
  filenames: { examples: string[]; note: string };
  variations: {
    library: 'multiple-takes' | 'none' | 'unspecified';
    runtime: 'configured-policy' | 'not-verified' | 'not-applicable';
    note: string;
  };
  trigger: { title: string; detail: string };
  speech: { defaultSource: 'openclaw-text'; recordedAlternative: 'own-audio'; note: string } | null;
  verification: { status: 'guide-only'; label: string; checks: string[] };
}
/** Display guidance only. Never chooses a take, classifies a filename or approves media. */
export function dealerClipGuide(slot: DealerClipGuideSlot): DealerClipGuide;
