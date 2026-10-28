import React from 'react';

const listeners = new Set();

/** @param {import('react').ReactNode} node */
export function publishShellStatus(node) {
  for (const listener of listeners) listener(node);
}

/** @param {(node: import('react').ReactNode) => void} listener */
export function subscribeShellStatus(listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/**
 * @param {{
 *   eyebrow: import('react').ReactNode,
 *   title: import('react').ReactNode,
 *   intro?: import('react').ReactNode,
 *   primary?: import('react').ReactNode,
 *   status?: import('react').ReactNode,
 *   tabs?: import('react').ReactNode,
 *   children?: import('react').ReactNode,
 * }} props
 */
export function PageTemplate({ eyebrow, title, intro, primary, status, tabs, children }) {
  const actions = primary || status
    ? React.createElement('div', { className: 'sg-page-actions' }, status ?? null, primary ?? null)
    : null;
  return React.createElement('section', { className: 'sg-page' },
    React.createElement('header', { className: 'sg-page-head' },
      React.createElement('div', { className: 'sg-page-copy' },
        // A section inside a page with its own heading passes neither.
        eyebrow == null ? null : React.createElement('p', { className: 'sg-eyebrow' }, eyebrow),
        title == null ? null : React.createElement('h1', null, title),
        intro ? React.createElement('p', { className: 'sg-intro' }, intro) : null,
      ),
      actions,
    ),
    tabs ? React.createElement('div', { className: 'sg-tabs' }, tabs) : null,
    children ?? null,
  );
}

/**
 * @param {{ count: number, onSave?: () => void, onUndo?: () => void, saveLabel?: string, undoLabel?: string }} props
 */
export function UnsavedBar({ count, onSave, onUndo, saveLabel = 'Spara alla', undoLabel = 'Ångra' }) {
  const n = Number(count) || 0;
  return React.createElement('div', { className: 'sg-unsaved', role: 'status' },
    React.createElement('p', null, `${n} ändringar`),
    React.createElement('div', { className: 'sg-unsaved-actions' },
      React.createElement('button', { type: 'button', className: 'sg-btn sg-btn-primary', onClick: onSave }, saveLabel),
      React.createElement('button', { type: 'button', className: 'sg-btn sg-btn-ghost', onClick: onUndo }, undoLabel),
    ),
  );
}
