import type { StudioProject } from '../../packages/presentation/contracts/studio-model.mjs';
export interface IdleReactionInput { requestId: string; project: StudioProject; dealerId: string; mode: string;
  sourceRef: { kind: 'renderer-idle'; channel: string; revision: number; messageId: string; at: string };
  observedChat: { source: 'native-observation'; before: string; messages: { role: 'user' | 'assistant'; text: string; at: string }[] } }
export function idleReactionInput(value: { records: Record<string, unknown>[]; project: StudioProject; dealerId: string;
  mode: string; channel: string; revision: number | null; requestId: string; now?: number }): IdleReactionInput | null;
