import type { StudioProject } from '../../../../../packages/presentation/contracts/studio-model.mjs';
import type { DealerArchiveImpact } from '../../../lib/dealer-archive-impact.mjs';
import type { VideoInventory } from './connected-studio.mjs';
import type { DeletionPlan, LifecycleVideo } from './studio-lifecycle.mjs';

export type ActionPlan = {
  kind: string; title: string; summary: string; items: string[];
  error?: string; confirmLabel?: string; cancelLabel: string; busyLabel: string;
};
export type ClipArchivePlan = ActionPlan & { kind: 'archive'|'restore'; ids: string[]; names: string[]; uses: string[]; blocker: string; error: string };
export type ClipDeletePlan = ActionPlan & { kind: 'delete'; allowed: boolean; reason: string; error: string };
export type DealerDeletePlan = ActionPlan & { kind: 'dealer-delete'; allowed: boolean; reason: string; error: string; requiresAcknowledgement: boolean; acknowledgement: string };

export function clipArchivePlan(input: { project: StudioProject; inventory: VideoInventory; dealerId: string; ids: string[]; archived?: boolean }): ClipArchivePlan;
export function clipDeletePlan(input: { video: LifecycleVideo|undefined; eligibility?: DeletionPlan }): ClipDeletePlan;
export function dealerArchivePlan(input: { label: string; impact?: DealerArchiveImpact }): ActionPlan & { kind: 'dealer-archive' };
export function dealerRestorePlan(input: { label: string; compositions?: { id: string; label: string }[] }): ActionPlan & { kind: 'dealer-restore' };
export function dealerDeletePlan(input: { label: string; mediaCount?: number; eligibility?: DeletionPlan; pending?: boolean }): DealerDeletePlan;
