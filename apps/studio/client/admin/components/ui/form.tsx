'use client';
import {cloneElement,isValidElement,useId,type ComponentProps,type ReactElement,type ReactNode} from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import {Check,ChevronDown} from 'lucide-react';
import {cn,focusRing} from './kit';

// Form controls: Input, Textarea, Select (Radix, with a hidden native select for forms), Checkbox,
// Switch, Label and Field (label, hint and error wired to the control). Borders that carry the state
// (checkbox, switch) use --sg-faint, which keeps 3:1 against the surfaces in both modes.
export const fieldClass='h-9 w-full min-w-0 rounded-lg border border-sg-field-line bg-sg-field px-3 text-[13.5px] text-sg-text placeholder:text-sg-faint transition-colors hover:border-sg-strong disabled:cursor-not-allowed disabled:bg-sg-disabled-bg disabled:text-sg-disabled-text aria-[invalid=true]:border-sg-danger-line '+focusRing;

export function Label({className,...props}:ComponentProps<'label'>) {
  return <label className={cn('text-[13px] font-medium text-sg-text',className)} {...props}/>;
}
export function Input({className,type='text',...props}:ComponentProps<'input'>) {
  return <input type={type} className={cn(fieldClass,className)} {...props}/>;
}
export function Textarea({className,...props}:ComponentProps<'textarea'>) {
  return <textarea className={cn(fieldClass,'h-auto min-h-20 py-2 leading-normal',className)} {...props}/>;
}

/** A labelled control: the hint and the error are the control's description, and an error marks it invalid. */
export function Field({label,hint,error,children,className}:{label:ReactNode;hint?:ReactNode;error?:ReactNode;children:ReactElement<{id?:string;'aria-describedby'?:string;'aria-invalid'?:boolean}>;className?:string}) {
  const base=useId(),id=(isValidElement(children)&&children.props.id)||base+'-control';
  const described=[hint?base+'-hint':'',error?base+'-error':''].filter(Boolean).join(' ')||undefined;
  return <div className={cn('grid gap-1.5',className)}>
    <Label htmlFor={id}>{label}</Label>
    {isValidElement(children)?cloneElement(children,{id,'aria-describedby':described,...(error?{'aria-invalid':true}:{})}):children}
    {hint&&<p id={base+'-hint'} className="m-0 text-[12.5px] text-sg-muted">{hint}</p>}
    {error&&<p id={base+'-error'} role="alert" className="m-0 text-[12.5px] text-sg-danger">{error}</p>}
  </div>;
}

export const Select=SelectPrimitive.Root;
export const SelectGroup=SelectPrimitive.Group;
export const SelectValue=SelectPrimitive.Value;
export function SelectTrigger({className,children,...props}:ComponentProps<typeof SelectPrimitive.Trigger>) {
  return <SelectPrimitive.Trigger className={cn(fieldClass,'flex cursor-pointer items-center justify-between gap-2 text-left data-[placeholder]:text-sg-faint [&>span]:truncate',className)} {...props}>
    {children}<SelectPrimitive.Icon asChild><ChevronDown className="size-4 shrink-0 text-sg-faint" aria-hidden="true"/></SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>;
}
export function SelectContent({className,children,position='popper',...props}:ComponentProps<typeof SelectPrimitive.Content>) {
  return <SelectPrimitive.Portal><SelectPrimitive.Content position={position} sideOffset={4} collisionPadding={12}
    className={cn('z-50 max-h-80 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-sg-border bg-sg-surface text-sg-text shadow-sg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',className)} {...props}>
    <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
  </SelectPrimitive.Content></SelectPrimitive.Portal>;
}
export function SelectItem({className,children,...props}:ComponentProps<typeof SelectPrimitive.Item>) {
  return <SelectPrimitive.Item className={cn('relative flex w-full cursor-pointer select-none items-center rounded-md py-1.5 pl-8 pr-2 text-[13px] outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-sg-hover data-[disabled]:opacity-50',className)} {...props}>
    <span className="absolute left-2 grid size-4 place-items-center"><SelectPrimitive.ItemIndicator><Check className="size-4 text-sg-accent-text" aria-hidden="true"/></SelectPrimitive.ItemIndicator></span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>;
}

export function Checkbox({className,...props}:ComponentProps<typeof CheckboxPrimitive.Root>) {
  return <CheckboxPrimitive.Root className={cn('peer grid size-4 shrink-0 cursor-pointer place-items-center rounded border border-sg-faint bg-sg-field p-0 text-sg-on-accent transition-colors data-[state=checked]:border-transparent data-[state=checked]:bg-sg-lime disabled:cursor-not-allowed disabled:opacity-50',focusRing,className)} {...props}>
    <CheckboxPrimitive.Indicator><Check className="size-3.5" strokeWidth={3} aria-hidden="true"/></CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>;
}
export function Switch({className,...props}:ComponentProps<typeof SwitchPrimitive.Root>) {
  return <SwitchPrimitive.Root className={cn('peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-sg-faint bg-sg-surface-2 p-0.5 transition-colors data-[state=checked]:border-transparent data-[state=checked]:bg-sg-lime disabled:cursor-not-allowed disabled:opacity-50',focusRing,className)} {...props}>
    <SwitchPrimitive.Thumb className="pointer-events-none block size-3.5 rounded-full bg-sg-text transition-transform data-[state=checked]:translate-x-4 data-[state=checked]:bg-sg-on-accent motion-reduce:transition-none"/>
  </SwitchPrimitive.Root>;
}
