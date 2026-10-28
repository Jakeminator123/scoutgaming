'use client';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {MoreHorizontal} from 'lucide-react';
import type {ReactNode} from 'react';
import {buttonVariants,cn} from './kit';

export type MenuAction={id:string;label:string;tone?:'danger'|'';disabled?:string;onSelect:()=>void;icon?:ReactNode};
/** The ⋯ menu per object (Radix: menu roles, arrow keys, typeahead, Esc). A disabled entry says why.
 *  Confirmation and consequence belong to the caller's ConfirmDialog. */
export function ActionMenu({name,actions,small=false}:{name:string;actions:MenuAction[];small?:boolean}) {
  return <DropdownMenu.Root modal={false}>
    <DropdownMenu.Trigger className={buttonVariants({variant:'secondary',size:small?'icon-sm':'icon'})} aria-label={'Åtgärder för '+name} title={'Åtgärder för '+name}><MoreHorizontal aria-hidden="true"/></DropdownMenu.Trigger>
    <DropdownMenu.Portal>
      <DropdownMenu.Content align="end" sideOffset={6} collisionPadding={12}
        className="z-50 min-w-[220px] max-w-[320px] rounded-xl border border-sg-border bg-sg-surface p-1.5 text-sg-text shadow-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-1">
        {actions.map(action=><DropdownMenu.Item key={action.id} disabled={Boolean(action.disabled)} title={action.disabled} onSelect={()=>action.onSelect()}
          className={cn('flex cursor-pointer select-none flex-col items-start gap-0.5 rounded-lg px-2.5 py-2 text-[13px] font-medium outline-none data-[disabled]:cursor-not-allowed data-[highlighted]:bg-sg-hover data-[disabled]:opacity-60',action.tone==='danger'&&'text-sg-danger')}>
          <span className="flex items-center gap-2 [&_svg]:size-4">{action.icon}{action.label}</span>
          {action.disabled&&<span className="text-xs font-normal text-sg-faint">{action.disabled}</span>}
        </DropdownMenu.Item>)}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>;
}
