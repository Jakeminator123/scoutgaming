import {type ComponentProps,type ReactElement,type ReactNode} from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import {Slot} from '@radix-ui/react-slot';
import {cva,type VariantProps} from 'class-variance-authority';
import {clsx,type ClassValue} from 'clsx';
import {twMerge} from 'tailwind-merge';
import {ChevronRight,Inbox} from 'lucide-react';

// The Admin kit (docs/plans/DESIGNSYSTEM.md): shadcn-style primitives on Radix and the --sg-* tokens
// (packages/ui/tokens.css), dark by default and light through the same tokens. No hex colours here.
// The rest of the kit: tabs.tsx, table.tsx, form.tsx, dropdown-menu.tsx, dialog.tsx (Dialog, Sheet),
// page-header.tsx; hub.tsx composes the page layout. Nothing in the kit reads data.
export function cn(...inputs:ClassValue[]) { return twMerge(clsx(inputs)); }

export const focusRing='focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sg-mark focus-visible:ring-offset-2 focus-visible:ring-offset-sg-surface';
export const buttonVariants=cva(
  'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg border font-semibold no-underline transition-[background-color,border-color,color,box-shadow] duration-150 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 '+focusRing,
  {variants:{
    variant:{
      primary:'border-transparent bg-sg-lime text-sg-on-accent hover:bg-sg-lime-hover',
      secondary:'border-sg-border bg-sg-surface text-sg-text hover:border-sg-strong hover:bg-sg-surface-2',
      ghost:'border-transparent bg-transparent text-sg-muted hover:bg-sg-hover hover:text-sg-text',
      ink:'border-transparent bg-sg-ink text-sg-side-text hover:opacity-90',
      danger:'border-sg-border bg-sg-surface text-sg-danger hover:border-sg-danger-line hover:bg-sg-danger-bg',
      destructive:'border-transparent bg-sg-danger text-sg-surface hover:opacity-90',
      link:'h-auto border-0 bg-transparent p-0 text-sg-accent-text underline-offset-4 hover:underline',
    },
    size:{sm:'h-8 px-3 text-[12.5px]',md:'h-9 px-3.5 text-[13px]',lg:'h-10 px-4 text-sm',icon:'size-9 p-0','icon-sm':'size-8 p-0'},
  },defaultVariants:{variant:'secondary',size:'md'}});
export type ButtonVariant=NonNullable<VariantProps<typeof buttonVariants>['variant']>;
/** `asChild` styles the single child (a Link) as the button instead of rendering a <button>. */
export function Button({className,variant,size,asChild=false,type='button',...props}:ComponentProps<'button'>&VariantProps<typeof buttonVariants>&{asChild?:boolean}) {
  if(asChild)return <Slot className={cn(buttonVariants({variant,size}),className)} {...props as ComponentProps<typeof Slot>}/>;
  return <button type={type} className={cn(buttonVariants({variant,size}),className)} {...props}/>;
}

/** Status tones (VISUELL-RIKTNING): live, warn (pausad), info (granskas), draft (utkast), off (inte
 *  anslutet, hollow dot) and danger (fel); ok, accent and ink remain for the older pages. */
export type Tone=''|'ok'|'live'|'warn'|'info'|'draft'|'off'|'danger'|'accent'|'ink';
export const toneClasses:Record<Tone,string>={
  '':'border-sg-border bg-sg-surface-2 text-sg-muted',
  ok:'border-transparent bg-sg-ok-bg text-sg-ok',
  live:'border-transparent bg-sg-live-bg text-sg-live-text',
  warn:'border-transparent bg-sg-warn-bg text-sg-warn',
  info:'border-transparent bg-sg-info-bg text-sg-info-text',
  draft:'border-transparent bg-sg-surface-2 text-sg-chip-text',
  off:'border-transparent bg-sg-surface-2 text-sg-chip-text',
  danger:'border-transparent bg-sg-danger-bg text-sg-danger',
  accent:'border-transparent bg-sg-accent-bg text-sg-text',
  ink:'border-transparent bg-sg-ink text-sg-side-text',
};
export const badgeVariants=cva('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 align-middle text-xs font-medium leading-5',{variants:{tone:toneClasses},defaultVariants:{tone:''}});
/** A status chip: dot and word. `dot` is hollow for `off`. */
export function Badge({tone='',dot,children,title,className}:{tone?:Tone;dot?:boolean;children:ReactNode;title?:string;className?:string}) {
  return <span className={cn(badgeVariants({tone}),className)} title={title}>{dot&&<span className={cn('size-1.5 shrink-0 rounded-full',tone==='off'?'border border-current':'bg-current')} aria-hidden="true"/>}{children}</span>;
}

/** A filter chip (link or button); `selected` marks the active filter. */
export const chipVariants=cva('inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium no-underline transition-colors '+focusRing,{variants:{selected:{
  true:'border-transparent bg-sg-text text-sg-bg',
  false:'border-sg-border bg-transparent text-sg-muted hover:border-sg-strong hover:text-sg-text',
}},defaultVariants:{selected:false}});

// Cards: radius 10px, a 1px border and no heavy shadow. `flush` puts the title on its own row above
// edge-to-edge content (a table); the shadcn parts below compose a card by hand.
export const cardClass='min-w-0 rounded-[10px] border border-sg-border bg-sg-surface p-5';
export function Card({title,aside,children,className='',id,as:Tag='section',flush=false}:{title?:ReactNode;aside?:ReactNode;children:ReactNode;className?:string;id?:string;as?:'section'|'article'|'div'|'li';flush?:boolean}) {
  return <Tag className={cn(cardClass,flush&&'overflow-hidden p-0',className)} id={id}>
    {title&&<div className={cn('mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1',flush&&'mb-0 border-b border-sg-line-2 px-5 py-3.5')}><h2 className="m-0 text-[14px] font-semibold tracking-[-0.005em] text-sg-text">{title}</h2>{aside&&<div className="text-[12.5px] text-sg-muted">{aside}</div>}</div>}
    {children}
  </Tag>;
}
export function CardHeader({className,...props}:ComponentProps<'div'>) { return <div className={cn('grid gap-1 border-b border-sg-line-2 px-5 py-3.5',className)} {...props}/>; }
export function CardTitle({className,...props}:ComponentProps<'h2'>) { return <h2 className={cn('m-0 text-[14px] font-semibold text-sg-text',className)} {...props}/>; }
export function CardDescription({className,...props}:ComponentProps<'p'>) { return <p className={cn('m-0 text-[13px] text-sg-muted',className)} {...props}/>; }
export function CardContent({className,...props}:ComponentProps<'div'>) { return <div className={cn('px-5 py-4',className)} {...props}/>; }
export function CardFooter({className,...props}:ComponentProps<'div'>) { return <div className={cn('flex items-center justify-end gap-2 border-t border-sg-line-2 px-5 py-3',className)} {...props}/>; }

export function Skeleton({className}:{className?:string}) {
  return <span aria-hidden="true" className={cn('block animate-pulse rounded-md bg-sg-hover',className)}/>;
}
/** A loading placeholder that still says what is being read. */
export function Loading({label,rows=3}:{label:string;rows?:number}) {
  return <div role="status" className="grid gap-2.5"><span className="sr-only">{label}</span>{Array.from({length:rows},(_,index)=><Skeleton key={index} className={cn('h-4',index===rows-1?'w-2/5':'w-full')}/>)}</div>;
}

/** Hover and keyboard-focus tooltip (Radix): the trigger is the child itself, the text its description. */
export function Tooltip({content,children,side='top'}:{content:ReactNode;children:ReactElement;side?:'top'|'bottom'|'left'|'right'}) {
  return <TooltipPrimitive.Provider delayDuration={250}><TooltipPrimitive.Root>
    <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
    <TooltipPrimitive.Portal><TooltipPrimitive.Content side={side} sideOffset={6} collisionPadding={8}
      className="z-50 max-w-64 rounded-md bg-sg-ink px-2.5 py-1.5 text-xs font-medium leading-snug text-sg-side-text shadow-sg data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0">{content}</TooltipPrimitive.Content></TooltipPrimitive.Portal>
  </TooltipPrimitive.Root></TooltipPrimitive.Provider>;
}
export function Kbd({children}:{children:ReactNode}) {
  return <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-sg-border bg-sg-surface-2 px-1 font-sans text-[11px] font-semibold text-sg-muted">{children}</kbd>;
}

/** Empty state: dashed frame, one sentence and at most one action. `badge` says why (e.g. not connected). */
export function EmptyState({title,text,action,icon,badge,className}:{title:ReactNode;text?:ReactNode;action?:ReactNode;icon?:ReactNode;badge?:ReactNode;className?:string}) {
  return <div role="status" className={cn('grid justify-items-center rounded-[10px] border border-dashed border-sg-strong px-6 py-9 text-center',className)}>
    <span aria-hidden="true" className="mb-3 grid size-10 place-items-center rounded-full bg-sg-surface-2 text-sg-faint [&_svg]:size-[18px]">{icon??<Inbox/>}</span>
    {badge&&<div className="mb-2">{badge}</div>}
    <h3 className="m-0 text-[14px] font-semibold text-sg-text">{title}</h3>
    {text&&<p className="mb-0 mt-1 max-w-[56ch] text-[13px] text-sg-muted">{text}</p>}
    {action&&<div className="mt-4 flex justify-center">{action}</div>}
  </div>;
}

/** A number with its label; `hint` says where it comes from or what it means. */
export function Stat({label,value,hint,icon,tone=''}:{label:ReactNode;value:ReactNode;hint?:ReactNode;icon?:ReactNode;tone?:Tone}) {
  return <div className={cn(cardClass,'grid gap-1 p-4')}>
    <div className="flex items-center justify-between gap-2 text-[12.5px] font-medium text-sg-muted"><span>{label}</span>{icon&&<span className={cn('grid size-7 place-items-center rounded-lg [&_svg]:size-4',tone?toneClasses[tone]:'bg-sg-surface-2 text-sg-muted')} aria-hidden="true">{icon}</span>}</div>
    <div className="font-display text-[26px] font-semibold leading-tight tracking-[-0.02em] text-sg-text tabular-nums">{typeof value==='number'?formatNumber(value):value}</div>
    {hint&&<div className="text-xs text-sg-faint">{hint}</div>}
  </div>;
}

/** Swedish number formatting (1 234, 2,5) for counts and amounts shown in Admin. */
export function formatNumber(value:number,options?:Intl.NumberFormatOptions) { return value.toLocaleString('sv-SE',options); }

/** Plain-language plural: plural(1,'miljö','miljöer') → "1 miljö". */
export function plural(count:number,one:string,many:string) { return `${formatNumber(count)} ${count===1?one:many}`; }

/** A short Swedish date: "28 okt. 2026". */
export function formatDate(value:string|number|Date) { return new Date(value).toLocaleDateString('sv-SE',{day:'numeric',month:'short',year:'numeric'}); }

/** A quiet note under a card's content: what the numbers mean or where something else is changed. Write
 * it as words or real links, never as "A → B" or "X › Y" paths. `className` moves it (e.g. above the content). */
export function Footnote({children,className}:{children:ReactNode;className?:string}) {
  return <p className={cn('mb-0 mt-3 text-[12.5px] text-sg-muted',className)}>{children}</p>;
}
/** A link inside running text and footnotes. */
export const textLinkClass='rounded font-semibold text-sg-accent-text underline decoration-sg-faint underline-offset-2 hover:decoration-current '+focusRing;

/** Folded section at the bottom of a page: technical identities (`items`) or a short secondary action
 * (`children`). The chevron replaces the browser's marker and turns when the section opens. */
export function TechnicalDetails({items=[],title='Tekniska detaljer',children,className}:{items?:[string,ReactNode][];title?:ReactNode;children?:ReactNode;className?:string}) {
  if(!items.length&&!children)return null;
  return <details className={cn('group mt-8 text-[12.5px] text-sg-muted',className)}>
    <summary className={cn('inline-flex cursor-pointer select-none list-none items-center gap-1.5 rounded font-medium text-sg-muted hover:text-sg-text [&::-webkit-details-marker]:hidden',focusRing)}><ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-sg-faint transition-transform duration-150 group-open:rotate-90 motion-reduce:transition-none"/>{title}</summary>
    {items.length>0&&<dl className="mb-0 ml-5 mt-3 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-6 gap-y-1.5">{items.map(([key,value])=><div key={key} className="contents"><dt>{key}</dt><dd className="m-0 min-w-0 break-all font-mono text-xs text-sg-text">{value}</dd></div>)}</dl>}
    {children&&<div className="ml-5 mt-3 grid gap-2">{children}</div>}
  </details>;
}
