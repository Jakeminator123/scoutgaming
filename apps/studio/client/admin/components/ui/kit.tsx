import {cloneElement,isValidElement,useId,type ComponentProps,type ReactElement,type ReactNode} from 'react';
import {cva,type VariantProps} from 'class-variance-authority';
import {clsx,type ClassValue} from 'clsx';
import {twMerge} from 'tailwind-merge';

// The Admin kit: shadcn-style primitives on the --sg-* tokens (light by default, dark with the system
// setting). Pages build from these and from the layout in hub.tsx; nothing here reads data.
export function cn(...inputs:ClassValue[]) { return twMerge(clsx(inputs)); }

export const focusRing='focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sg-lime focus-visible:ring-offset-2 focus-visible:ring-offset-sg-surface';
export const buttonVariants=cva(
  'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg border font-semibold no-underline transition-[background-color,border-color,color,box-shadow] duration-150 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 '+focusRing,
  {variants:{
    variant:{
      primary:'border-transparent bg-sg-lime text-sg-on-accent shadow-sm hover:bg-[#c8f21f]',
      secondary:'border-sg-border bg-sg-surface text-sg-text shadow-sm hover:border-sg-faint hover:bg-sg-surface-2',
      ghost:'border-transparent bg-transparent text-sg-muted hover:bg-sg-hover hover:text-sg-text',
      ink:'border-transparent bg-sg-ink text-sg-side-text hover:opacity-90',
      danger:'border-sg-border bg-sg-surface text-sg-danger hover:border-sg-danger-line hover:bg-sg-danger-bg',
      destructive:'border-transparent bg-sg-danger text-sg-surface shadow-sm hover:opacity-90',
      link:'h-auto border-0 bg-transparent p-0 text-sg-accent-text underline-offset-4 hover:underline',
    },
    size:{sm:'h-8 px-3 text-[12.5px]',md:'h-9 px-3.5 text-[13px]',lg:'h-10 px-4 text-sm',icon:'size-9 p-0','icon-sm':'size-8 p-0'},
  },defaultVariants:{variant:'secondary',size:'md'}});
export type ButtonVariant=NonNullable<VariantProps<typeof buttonVariants>['variant']>;
export function Button({className,variant,size,type='button',...props}:ComponentProps<'button'>&VariantProps<typeof buttonVariants>) {
  return <button type={type} className={cn(buttonVariants({variant,size}),className)} {...props}/>;
}

export type Tone=''|'ok'|'warn'|'danger'|'info'|'accent'|'ink';
export const badgeVariants=cva('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 align-middle text-xs font-semibold leading-5',{variants:{tone:{
  '':'border-sg-border bg-sg-surface-2 text-sg-muted',
  ok:'border-transparent bg-sg-ok-bg text-sg-ok',
  warn:'border-transparent bg-sg-warn-bg text-sg-warn',
  danger:'border-transparent bg-sg-danger-bg text-sg-danger',
  info:'border-transparent bg-sg-info-bg text-sg-info',
  accent:'border-transparent bg-sg-accent-bg text-sg-text',
  ink:'border-transparent bg-sg-ink text-sg-side-text',
}},defaultVariants:{tone:''}});
export function Badge({tone='',dot,children,title,className}:{tone?:Tone;dot?:boolean;children:ReactNode;title?:string;className?:string}) {
  return <span className={cn(badgeVariants({tone}),className)} title={title}>{dot&&<span className="size-1.5 rounded-full bg-current" aria-hidden="true"/>}{children}</span>;
}

export const cardClass='min-w-0 rounded-xl border border-sg-border bg-sg-surface p-5 shadow-sg';
export function Card({title,aside,children,className='',id,as:Tag='section',flush=false}:{title?:ReactNode;aside?:ReactNode;children:ReactNode;className?:string;id?:string;as?:'section'|'article'|'div'|'li';flush?:boolean}) {
  return <Tag className={cn(cardClass,flush&&'p-0',className)} id={id}>
    {title&&<div className={cn('mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1',flush&&'mb-0 border-b border-sg-line-2 px-5 py-4')}><h2 className="m-0 text-[15px] font-semibold tracking-[-0.01em] text-sg-text">{title}</h2>{aside&&<div className="text-[12.5px] text-sg-muted">{aside}</div>}</div>}
    {children}
  </Tag>;
}

export function Skeleton({className}:{className?:string}) {
  return <span aria-hidden="true" className={cn('block animate-pulse rounded-md bg-sg-hover',className)}/>;
}
/** A loading placeholder that still says what is being read. */
export function Loading({label,rows=3}:{label:string;rows?:number}) {
  return <div role="status" className="grid gap-2.5"><span className="sr-only">{label}</span>{Array.from({length:rows},(_,index)=><Skeleton key={index} className={cn('h-4',index===rows-1?'w-2/5':'w-full')}/>)}</div>;
}

/** Hover and keyboard-focus tooltip. The text is also the trigger's accessible description. */
export function Tooltip({content,children,side='top'}:{content:ReactNode;children:ReactElement<{'aria-describedby'?:string}>;side?:'top'|'bottom'}) {
  const id=useId();
  return <span className="group/tip relative inline-flex">
    {isValidElement(children)?cloneElement(children,{'aria-describedby':id}):children}
    <span role="tooltip" id={id} className={cn('pointer-events-none absolute left-1/2 z-50 w-max max-w-64 -translate-x-1/2 rounded-md bg-sg-ink px-2.5 py-1.5 text-xs font-medium leading-snug text-sg-side-text opacity-0 shadow-lg transition-opacity duration-150 group-hover/tip:opacity-100 group-focus-within/tip:opacity-100',side==='top'?'bottom-full mb-2':'top-full mt-2')}>{content}</span>
  </span>;
}
export function Kbd({children}:{children:ReactNode}) {
  return <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-sg-border bg-sg-surface-2 px-1 font-sans text-[11px] font-semibold text-sg-muted">{children}</kbd>;
}

/** A number with its label; `hint` says where it comes from or what it means. */
export function Stat({label,value,hint,icon,tone=''}:{label:ReactNode;value:ReactNode;hint?:ReactNode;icon?:ReactNode;tone?:Tone}) {
  return <div className={cn(cardClass,'grid gap-1 p-4')}>
    <div className="flex items-center justify-between gap-2 text-[12.5px] font-medium text-sg-muted"><span>{label}</span>{icon&&<span className={cn('grid size-7 place-items-center rounded-lg [&_svg]:size-4',tone?badgeVariants({tone}).replace(/rounded-full|px-2\.5|py-0\.5/g,''):'bg-sg-surface-2 text-sg-muted')} aria-hidden="true">{icon}</span>}</div>
    <div className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-sg-text tabular-nums">{typeof value==='number'?formatNumber(value):value}</div>
    {hint&&<div className="text-xs text-sg-faint">{hint}</div>}
  </div>;
}

/** Swedish number formatting (1 234, 2,5) for counts and amounts shown in Admin. */
export function formatNumber(value:number,options?:Intl.NumberFormatOptions) { return value.toLocaleString('sv-SE',options); }

/** Plain-language plural: plural(1,'scenmall','scenmallar') → "1 scenmall". */
export function plural(count:number,one:string,many:string) { return `${formatNumber(count)} ${count===1?one:many}`; }

/** Technical identities stay out of names and cards; they live folded at the bottom of an object's page. */
export function TechnicalDetails({items}:{items:[string,ReactNode][]}) {
  if(!items.length)return null;
  return <details className="group mt-8 rounded-xl border border-dashed border-sg-border px-4 py-3 text-[12.5px] text-sg-muted">
    <summary className={cn('cursor-pointer select-none font-semibold text-sg-muted marker:text-sg-faint hover:text-sg-text',focusRing)}>Tekniska detaljer</summary>
    <dl className="mt-3 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-6 gap-y-1.5">{items.map(([key,value])=><div key={key} className="contents"><dt>{key}</dt><dd className="m-0 min-w-0 break-all font-mono text-xs text-sg-text">{value}</dd></div>)}</dl>
  </details>;
}
