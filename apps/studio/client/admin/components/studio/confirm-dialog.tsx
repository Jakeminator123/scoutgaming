'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import styles from './confirm-dialog.module.css';

let sequence = 0;
export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  /** One short sentence that states the consequence. */
  description?: ReactNode;
  /** Concrete consequences, one row each. */
  consequences?: ReactNode[];
  children?: ReactNode;
  /** A server check is running inside the dialog; the confirm button waits. */
  checking?: boolean;
  checkingLabel?: string;
  error?: string;
  /** The confirmed action is running; the dialog cannot be closed. */
  busy?: boolean;
  busyLabel?: string;
  /** Without a label the dialog only informs and offers the cancel button. */
  confirmLabel?: string;
  confirmDisabled?: boolean;
  cancelLabel?: string;
  /** Destructive styling for the primary button. Default on. */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

// Native <dialog>: modal, focus kept inside by the browser, Esc arrives as the
// cancel event. The parent owns `open`; the dialog never closes itself silently.
// Content renders only while open, so a closed dialog costs nothing and tests can
// tell the two states apart.
export function ConfirmDialog({ open, title, description, consequences = [], children, checking = false, checkingLabel = 'Kontrollerar…', error = '', busy = false, busyLabel = 'Sparar…', confirmLabel, confirmDisabled = false, cancelLabel = 'Avbryt', danger = true, onConfirm, onCancel }: ConfirmDialogProps) {
  const [id] = useState(() => 'confirm-dialog-' + (++sequence));
  const dialog = useRef<HTMLDialogElement>(null), cancel = useRef<HTMLButtonElement>(null);
  const latest = useRef({ open, busy, onCancel });
  latest.current = { open, busy, onCancel };
  useEffect(() => {
    const node = dialog.current;
    if (!open || !node || typeof node.showModal !== 'function') return undefined;
    const previous = typeof document === 'undefined' ? null : document.activeElement as HTMLElement|null;
    if (!node.open) node.showModal();
    // A destructive dialog starts on the safe choice.
    cancel.current?.focus();
    return () => {
      if (node.open) node.close();
      if (previous && typeof previous.focus === 'function' && previous.isConnected) previous.focus();
    };
  }, [open]);
  const dismiss = () => { if (!latest.current.busy) latest.current.onCancel(); };
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby={id + '-title'} aria-describedby={id + '-body'} aria-busy={busy || checking || undefined} data-danger={danger || undefined}
    onCancel={event => { event.preventDefault(); dismiss(); }}
    onClose={() => { if (latest.current.open) latest.current.onCancel(); }}
    onClick={event => { if (event.target === event.currentTarget) dismiss(); }}>
    {open ? <div className={styles.panel}>
      <h2 id={id + '-title'} className={styles.title}>{title}</h2>
      <div id={id + '-body'} className={styles.body}>
        {checking ? <p role="status" className={styles.status}><span className={styles.spinner} aria-hidden="true" />{checkingLabel}</p> : <>
          {description ? <p className={styles.description}>{description}</p> : null}
          {consequences.length > 0 && <ul className={styles.consequences}>{consequences.map((row, index) => <li key={index}>{row}</li>)}</ul>}
          {children}
        </>}
        {error ? <p role="alert" className={styles.error}>{error}</p> : null}
      </div>
      <div className={styles.actions}>
        <button ref={cancel} type="button" className={styles.cancel} disabled={busy} onClick={onCancel}>{cancelLabel}</button>
        {confirmLabel ? <button type="button" className={danger ? styles.danger : styles.primary} disabled={busy || checking || confirmDisabled} onClick={onConfirm}>{busy ? busyLabel : confirmLabel}</button> : null}
      </div>
    </div> : null}
  </dialog>;
}

/** Extra acknowledgement for irreversible actions that delete files. */
export function ConfirmAcknowledgement({ checked, label, disabled = false, onChange }: { checked: boolean; label: string; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return <label className={styles.check}><input type="checkbox" checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} /><span>{label}</span></label>;
}
