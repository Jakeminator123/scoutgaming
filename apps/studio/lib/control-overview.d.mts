export interface OverviewOperator { id: string; slug: string; name: string; publishedPackage?: { revision: number; lanes: string[] } | null }
export interface OverviewStudio { dealers: { id: string; label: string }[]; lanes: { id: string; label: string }[] }
export interface OverviewRooms { schemaVersion: 1; operator: { slug: string; name: string }; packageRevision: number | null; rooms: { id: string; name: string; presentation: { id: string; label: string }; dealers: { id: string; label: string }[]; playUrl: string }[] }
export interface OverviewSnapshot { key: string | null; status: 'idle' | 'loading' | 'ready' | 'error'; data: OverviewRooms | null }
export interface OverviewReader { subscribe(listener: () => void): () => void; getSnapshot(): OverviewSnapshot; cancel(): void; read(operatorSlug: string): Promise<void> }
export function controlStudioSummary(project: unknown): OverviewStudio | null;
export function selectedOverviewOperator(operators: OverviewOperator[], query?: string | null): OverviewOperator | undefined;
export function overviewNextStep(input: { operatorStatus: string; operator?: OverviewOperator; studio: OverviewStudio | null; status: string; data: OverviewRooms | null }): { kind: string; title: string; text: string; label: string };
export function createOverviewReader(options?: { fetchImpl?: typeof fetch; timeoutMs?: number }): OverviewReader;
