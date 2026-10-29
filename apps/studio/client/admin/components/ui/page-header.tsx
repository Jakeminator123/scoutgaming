import type {ReactNode} from 'react';
import {cn} from './kit';

// The one page template (VISUELL-RIKTNING): eyebrow (mono 11px, capitals) → title (display face 30px)
// → intro → actions on the right → tabs. `note` is a quiet line under the tabs (what the tab holds).
export function PageHeader({eyebrow,title,chip,intro,actions,tabs,note,className}:{eyebrow?:ReactNode;title:ReactNode;chip?:ReactNode;intro?:ReactNode;actions?:ReactNode;tabs?:ReactNode;note?:ReactNode;className?:string}) {
  return <header className={cn('mb-6',className)}>
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0 flex-[1_1_320px]">
        {eyebrow&&<div className="mb-2 font-mono text-[11px] font-medium uppercase leading-4 tracking-[0.08em] text-sg-faint">{eyebrow}</div>}
        <h1 className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 font-display text-[30px] font-semibold leading-[1.1] tracking-[-0.02em] text-sg-text max-md:text-[24px]">{title}{chip&&<> {chip}</>}</h1>
        {intro&&<p className="mb-0 mt-2 max-w-[72ch] text-[14px] leading-normal text-sg-muted">{intro}</p>}
      </div>
      {actions&&<div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
    {tabs&&<div className="mt-6 [&>nav]:mb-0">{tabs}</div>}
    {note&&<p className="mb-0 mt-3 max-w-[90ch] text-[13px] text-sg-muted">{note}</p>}
  </header>;
}
