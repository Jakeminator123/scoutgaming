'use client';
import {MoreHorizontal} from 'lucide-react';
import type {ReactNode} from 'react';
import {buttonVariants,cn} from './kit';
import {DropdownMenu,DropdownMenuContent,DropdownMenuItem,DropdownMenuTrigger} from './dropdown-menu';

export type MenuAction={id:string;label:string;tone?:'danger'|'';disabled?:string;onSelect:()=>void;icon?:ReactNode};
/** The ⋯ menu per object (Radix: menu roles, arrow keys, typeahead, Esc). A disabled entry says why.
 *  Confirmation and consequence belong to the caller's ConfirmDialog. */
export function ActionMenu({name,actions,small=false}:{name:string;actions:MenuAction[];small?:boolean}) {
  return <DropdownMenu modal={false}>
    <DropdownMenuTrigger className={buttonVariants({variant:'ghost',size:small?'icon-sm':'icon'})} aria-label={'Åtgärder för '+name} title={'Åtgärder för '+name}><MoreHorizontal aria-hidden="true"/></DropdownMenuTrigger>
    <DropdownMenuContent>
      {actions.map(action=><DropdownMenuItem key={action.id} tone={action.tone} disabled={Boolean(action.disabled)} title={action.disabled} onSelect={()=>action.onSelect()}
        className={cn(action.disabled&&'flex-col items-start gap-0.5')}>
        <span className="flex items-center gap-2">{action.icon}{action.label}</span>
        {action.disabled&&<span className="text-xs font-normal text-sg-faint">{action.disabled}</span>}
      </DropdownMenuItem>)}
    </DropdownMenuContent>
  </DropdownMenu>;
}
