export interface ActivityEntry {
  id: string;
  time: string;
  runId?: string;
  source: 'lab' | 'manual' | 'social' | 'partner' | 'native' | 'player' | 'config';
  stage: 'input' | 'decision' | 'playback' | 'connection' | 'configuration';
  title: string;
  owner: string;
  reason: string;
  status: 'received' | 'waiting' | 'selected' | 'started' | 'completed' | 'failed' | 'cancelled' | 'observed';
  data?: unknown;
}
export const ACTIVITY_LIMIT: number;
export function createIdleLogFilter(): ((record: Record<string, unknown>) => boolean) & { reset(): void };
export function safeActivityData(value: unknown): unknown;
export function appendActivity(entries: ActivityEntry[], entry: ActivityEntry): ActivityEntry[];
export function decisionAttribution(mode: string, reason?: string, provider?: string): string;
export function eventSummary(event: unknown): string;
