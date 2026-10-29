import type {ComponentProps} from 'react';
import {cn} from './kit';

// Dense tables (13px): a hairline between rows, numbers right-aligned in mono with tabular figures.
// DataTable (data-table.tsx) adds sorting and a filter on top of these parts.
/** Put on a Table inside a flush Card, so the first and last cells line up with the card's title. */
export const insetTableClass='[&_:is(th,td):first-child]:pl-5 [&_:is(th,td):last-child]:pr-5';
export function Table({className,label,...props}:ComponentProps<'table'>&{label?:string}) {
  return <div className="relative w-full min-w-0 overflow-x-auto"><table aria-label={label} className={cn('w-full border-collapse text-[13px] leading-5 text-sg-text',className)} {...props}/></div>;
}
export function TableHeader({className,...props}:ComponentProps<'thead'>) { return <thead className={cn('[&_tr]:border-b [&_tr]:border-sg-border [&_tr:hover]:bg-transparent',className)} {...props}/>; }
export function TableBody({className,...props}:ComponentProps<'tbody'>) { return <tbody className={cn('[&_tr:last-child]:border-0',className)} {...props}/>; }
export function TableRow({className,...props}:ComponentProps<'tr'>) {
  return <tr className={cn('border-0 border-b border-solid border-sg-line-2 transition-colors hover:bg-sg-hover data-[state=selected]:bg-sg-surface-2',className)} {...props}/>;
}
export function TableHead({className,numeric,...props}:ComponentProps<'th'>&{numeric?:boolean}) {
  return <th scope="col" className={cn('h-9 whitespace-nowrap px-3 text-left align-middle text-xs font-medium text-sg-muted',numeric&&'text-right',className)} {...props}/>;
}
export function TableCell({className,numeric,...props}:ComponentProps<'td'>&{numeric?:boolean}) {
  return <td className={cn('px-3 py-2.5 align-middle',numeric&&'text-right font-mono text-[12.5px] tabular-nums',className)} {...props}/>;
}
export function TableCaption({className,...props}:ComponentProps<'caption'>) { return <caption className={cn('mt-3 caption-bottom text-[12.5px] text-sg-muted',className)} {...props}/>; }
