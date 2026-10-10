import type { DealerId, LegacyClipBinding, StudioProject } from './studio-model.mjs';
export interface LegacyClipEntry { id: string; dealerId: DealerId; kind: 'engine' | 'performance' | 'recorded-speech'; engineKey?: string; source: string; file: string; exactParts: string[]; lineId: string | null; text: string | null; available: boolean; previewSrc: string | null; route: string; reviewStatus: string; actualPlayback: false }
export interface LegacyClipConflict extends LegacyClipBinding { reason: string; active: false }
export interface LegacyClipRuntime { source: 'lab/project.json'; projectRevision: string; dealers: Record<DealerId, { engine: Record<string, string>; staged: Record<string, string> }>; conflicts: LegacyClipConflict[]; actualPlayback: false }
export interface LegacyClipInventory { source: string; clips: LegacyClipEntry[]; defaults: Record<string,string>; actualPlayback: false }
export interface LegacyClipControls extends LegacyClipInventory { runtime: LegacyClipRuntime; editor: string; legacyWrites: false }
export function loadLegacyClipInventory(options?: {repository?: string; publicRoot?: string; dataDirectory?: string}): Promise<LegacyClipInventory>;
export function legacyClipControls(project: StudioProject, options?: {repository?: string; publicRoot?: string; dataDirectory?: string}): Promise<LegacyClipControls>;
