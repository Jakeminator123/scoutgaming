'use client';

import type { ReactNode } from 'react';
import { PageTemplate as PageTemplateView, UnsavedBar as UnsavedBarView, publishShellStatus, subscribeShellStatus } from './page-template.mjs';

export { publishShellStatus, subscribeShellStatus };

export type PageTemplateProps = {
  eyebrow: ReactNode;
  title: ReactNode;
  intro?: ReactNode;
  primary?: ReactNode;
  status?: ReactNode;
  tabs?: ReactNode;
  children?: ReactNode;
};

/** Staff page header. Markup lives in page-template.mjs so the existing VM harnesses can load it. */
export function PageTemplate(props: PageTemplateProps) {
  return <PageTemplateView {...props} />;
}

export function UnsavedBar({ count, onSave, onUndo, saveLabel, undoLabel }: {
  count: number;
  onSave?: () => void;
  onUndo?: () => void;
  saveLabel?: string;
  undoLabel?: string;
}) {
  return <UnsavedBarView count={count} onSave={onSave} onUndo={onUndo} saveLabel={saveLabel} undoLabel={undoLabel} />;
}
