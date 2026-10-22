'use client';
import { useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { StudioProject } from '../../../../../../packages/presentation/contracts/studio-model.mjs';
import type { Catalog, VideoInventory } from '../../lib/connected-studio.mjs';
import { createLifecycleClient, lifecycleFingerprint, lifecycleMessage, type DeletionPlan } from '../../lib/studio-lifecycle.mjs';
import { clipArchivePlan, clipDeletePlan } from '../../lib/lifecycle-actions.mjs';
import { ConfirmDialog } from './confirm-dialog';

const client = createLifecycleClient();
const defaultClass = 'inline-flex items-center justify-center gap-2 rounded border border-sg-line px-3 py-2 text-xs disabled:opacity-40';
export type ClipDeleteResult =
  | { kind: 'archived'|'deleted'; videoId: string; dealerId: string; project?: StudioProject; inventory?: VideoInventory }
  | { kind: 'kept'; videoId: string; dealerId: string; reason: string }
  | { kind: 'failed'; videoId: string; dealerId: string; reason: string; message: string };
export type ClipDeleteActionProps = {
  project: StudioProject; inventory: VideoInventory; catalog: Catalog; dealerId: string; videoId: string;
  disabled?: boolean; onDone?: (result: ClipDeleteResult) => void;
  /** `archive` moves the clip to the archive (reversible); `permanent` deletes an archived clip after the server check. */
  variant?: 'archive'|'permanent';
  onBusyChange?: (busy: boolean) => void; className?: string; label?: string;
};
type Stage = { fingerprint: string; checking: boolean; eligibility?: DeletionPlan; error: string };

// One button and one dialog per clip. The check runs inside the dialog; the
// exact snapshot captured at open must still match when the user confirms.
export function ClipDeleteAction({ project, inventory, catalog, dealerId, videoId, disabled = false, onDone, variant = 'archive', onBusyChange, className, label }: ClipDeleteActionProps) {
  const [stage, setStage] = useState<Stage|null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const latest = useRef({ project, inventory, dealerId, videoId, onDone, onBusyChange });
  latest.current = { project, inventory, dealerId, videoId, onDone, onBusyChange };
  const registered = catalog.source === 'registered' && catalog.administration.dealers.some(row => row.id === dealerId);
  const video = inventory.videos.find(row => row.id === videoId);
  const fingerprint = lifecycleFingerprint(project, inventory, dealerId, [videoId]);
  const stale = stage !== null && stage.fingerprint !== fingerprint;
  const plan = variant === 'archive' ? clipArchivePlan({ project, inventory, dealerId, ids: [videoId], archived: true }) : clipDeletePlan({ video, eligibility: stage?.eligibility });
  const current = () => lifecycleFingerprint(latest.current.project, latest.current.inventory, latest.current.dealerId, [latest.current.videoId]);
  async function open() {
    if (disabled || lock.current || !video || !registered) return;
    const captured = fingerprint;
    if (variant === 'archive') { setStage({ fingerprint: captured, checking: false, error: '' }); return; }
    setStage({ fingerprint: captured, checking: true, error: '' });
    const settle = (patch: Partial<Stage>) => setStage(value => value && value.fingerprint === captured ? { ...value, checking: false, ...patch } : value);
    try { settle({ eligibility: await client.checkClipDeletion(project, inventory, dealerId, videoId) }); }
    catch (cause) { settle({ error: lifecycleMessage(cause) }); }
  }
  async function confirm() {
    if (!stage || stage.checking || stale || busy || lock.current || !plan.confirmLabel) return;
    const captured = stage.fingerprint, unchanged = () => current() === captured;
    lock.current = true; setBusy(true); latest.current.onBusyChange?.(true);
    let result: ClipDeleteResult;
    try {
      if (variant === 'archive') { await client.archiveClips({ project, inventory, dealerId, ids: [videoId], archived: true, stillCurrent: unchanged }); result = { kind: 'archived', videoId, dealerId }; }
      else { const response = await client.deleteClip(project, inventory, dealerId, videoId, unchanged); result = { kind: 'deleted', videoId, dealerId, project: response.project, inventory: response.inventory }; }
    } catch (cause) {
      const reason = typeof (cause as { code?: unknown })?.code === 'string' ? (cause as { code: string }).code : 'studio_lifecycle_response_invalid';
      result = { kind: 'failed', videoId, dealerId, reason, message: lifecycleMessage(cause) };
    }
    lock.current = false; setBusy(false); setStage(null);
    latest.current.onBusyChange?.(false);
    latest.current.onDone?.(result);
  }
  function cancel() {
    if (busy) return;
    const denied = stage?.eligibility && !stage.eligibility.allowed ? stage.eligibility.reason ?? 'studio_conflict' : '';
    setStage(null);
    if (denied) latest.current.onDone?.({ kind: 'kept', videoId, dealerId, reason: denied });
  }
  const error = stale ? 'Registret har ändrats sedan dialogen öppnades. Stäng och försök igen.' : stage?.error || plan.error;
  return <>
    <button type="button" className={className ?? defaultClass} disabled={disabled || busy || !video || !registered} aria-haspopup="dialog" onClick={() => void open()}><Trash2 size={13} />{label ?? (variant === 'archive' ? 'Radera' : 'Radera permanent')}</button>
    <ConfirmDialog open={stage !== null} title={plan.title} description={plan.summary} consequences={plan.items}
      checking={stage?.checking ?? false} checkingLabel="Kontrollerar klippets användning…" error={error}
      busy={busy} busyLabel={plan.busyLabel} confirmLabel={stale || stage?.error ? undefined : plan.confirmLabel} cancelLabel={stale || stage?.error ? 'Stäng' : plan.cancelLabel}
      onConfirm={() => void confirm()} onCancel={cancel} />
  </>;
}
