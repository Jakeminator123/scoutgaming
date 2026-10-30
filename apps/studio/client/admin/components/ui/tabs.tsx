'use client';
import type {ComponentProps} from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import {cn,focusRing} from './kit';

// Tabs: Radix for tabs inside a page (state in the component), and the same look for the address-bound
// tab row in hub.tsx (links with aria-current). The selected tab's edge is --sg-mark (≥3:1 in both modes).
export const tabsListClass='mb-6 flex gap-1 overflow-x-auto border-b border-sg-border';
export const tabsTriggerClass='-mb-px inline-flex items-center gap-1.5 whitespace-nowrap rounded-t-md border-0 border-b-2 border-solid border-transparent bg-transparent px-3 py-2.5 text-[13.5px] font-medium text-sg-muted no-underline transition-colors hover:text-sg-text aria-[current=page]:border-sg-mark aria-[current=page]:font-semibold aria-[current=page]:text-sg-text data-[state=active]:border-sg-mark data-[state=active]:font-semibold data-[state=active]:text-sg-text '+focusRing;
export const tabsCountClass='rounded-full bg-sg-surface-2 px-1.5 font-mono text-[11px] font-medium tabular-nums text-sg-muted';

export const Tabs=TabsPrimitive.Root;
export function TabsList({className,...props}:ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn(tabsListClass,className)} {...props}/>;
}
export function TabsTrigger({className,...props}:ComponentProps<typeof TabsPrimitive.Trigger>) {
  return <TabsPrimitive.Trigger className={cn(tabsTriggerClass,'cursor-pointer',className)} {...props}/>;
}
export function TabsContent({className,...props}:ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn('min-w-0 rounded-md',focusRing,className)} {...props}/>;
}
