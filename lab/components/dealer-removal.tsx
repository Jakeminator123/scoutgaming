'use client';
import { useEffect, useState } from 'react';
import type { StudioProject } from '../lib/studio-model.mjs';
import { dealerRemovalStatus, removeDealerFromDraft } from '../lib/dealer-removal.mjs';

export type DealerRemovalProps = {
  project: StudioProject;
  dealerId: string;
  onEdit: (edit: (current: StudioProject) => StudioProject) => void;
  disabled?: boolean;
  onRemoved?: (dealerId: string, nextDealerId: string) => void;
};

export function DealerRemoval({ project, dealerId, onEdit, disabled = false, onRemoved }: DealerRemovalProps) {
  const [error, setError] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const status = dealerRemovalStatus(project, dealerId);
  const dealer = project.dealers.find(row => row.id === dealerId);
  useEffect(() => {
    if (!pending) return;
    if (pending !== dealerId) { setPending(null); return; }
    if (!project.dealers.some(row => row.id === pending)) {
      setPending(null);
      onRemoved?.(pending, project.dealers[0].id);
    }
  }, [pending, dealerId, project.dealers, onRemoved]);
  if (status.kind === 'base' || status.kind === 'missing') return null;

  function remove() {
    if (disabled || pending || status.kind !== 'ready') return;
    try {
      removeDealerFromDraft(project, dealerId);
      onEdit(current => removeDealerFromDraft(current, dealerId));
      setError(''); setPending(dealerId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Dealern kunde inte tas bort ur utkastet.');
    }
  }

  return <details><summary>Ta bort dealer ur utkastet</summary>
    <p>Tar bort {dealer?.label}, dess händelsekopplingar och grundloopschema ur utkastet. Mediefiler och publicerade paket finns kvar.</p>
    {status.message ? <p role="status">{status.message}</p> : null}
    <button className="sg-btn sg-btn-secondary" type="button" disabled={disabled || Boolean(pending) || status.kind !== 'ready'} onClick={remove}>
      Ta bort {dealer?.label} ur utkastet
    </button>
    <p>Spara utkastet efter ändringen.</p>
    {error ? <p role="alert">{error}</p> : null}
  </details>;
}
