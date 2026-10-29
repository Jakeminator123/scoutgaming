'use client';
import type {ComponentProps} from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import {cn} from './kit';

// shadcn-style dropdown menu on Radix: menu roles, arrow keys, typeahead and Esc. ActionMenu (menu.tsx)
// is the ⋯ menu per object built from these parts.
export const DropdownMenu=DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger=DropdownMenuPrimitive.Trigger;
export const DropdownMenuGroup=DropdownMenuPrimitive.Group;
export function DropdownMenuContent({className,sideOffset=6,align='end',...props}:ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return <DropdownMenuPrimitive.Portal><DropdownMenuPrimitive.Content sideOffset={sideOffset} align={align} collisionPadding={12}
    className={cn('z-50 min-w-[220px] max-w-[320px] rounded-[10px] border border-sg-border bg-sg-surface p-1 text-sg-text shadow-sg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-1',className)} {...props}/></DropdownMenuPrimitive.Portal>;
}
export function DropdownMenuItem({className,tone,...props}:ComponentProps<typeof DropdownMenuPrimitive.Item>&{tone?:'danger'|''}) {
  return <DropdownMenuPrimitive.Item className={cn('flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] font-medium outline-none data-[disabled]:cursor-not-allowed data-[highlighted]:bg-sg-hover data-[disabled]:opacity-60 [&_svg]:size-4',tone==='danger'&&'text-sg-danger data-[highlighted]:bg-sg-danger-bg',className)} {...props}/>;
}
export function DropdownMenuLabel({className,...props}:ComponentProps<typeof DropdownMenuPrimitive.Label>) {
  return <DropdownMenuPrimitive.Label className={cn('px-2.5 pb-1 pt-1.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-sg-faint',className)} {...props}/>;
}
export function DropdownMenuSeparator({className,...props}:ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return <DropdownMenuPrimitive.Separator className={cn('-mx-1 my-1 h-px bg-sg-line-2',className)} {...props}/>;
}
