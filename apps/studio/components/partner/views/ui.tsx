// Partnerportalens primitiver med samma namn och props som Admins kit (client/admin/components/ui:
// kit.tsx, hub.tsx, menu.tsx, dialog.tsx), så att en senare flytt in i Admin-klienten blir mekanisk.
// Samma bibliotek (Radix, cva, lucide, recharts), stylade av partner-portal.css med --sg-* ur
// packages/ui/tokens.css. Inga data och inga anrop här; komponenterna laddas bara bakom skalets
// 'use client'.
import React, { type ReactNode } from 'react';
import { cva } from 'class-variance-authority';
import { clsx } from 'clsx';
import * as Tooltip from '@radix-ui/react-tooltip';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import * as Dialog from '@radix-ui/react-dialog';
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts';
import { ChevronRight, MoreHorizontal } from 'lucide-react';

type Language = 'sv' | 'en' | string;
export type Tone = '' | 'ok' | 'warn' | 'danger' | 'info' | 'accent' | 'ink';

// Radix-portaler hamnar i portalens rot så att tokens och tema följer med (skalet sätter den).
export const PortalRoot = React.createContext<HTMLElement | null>(null);
const usePortal = () => React.useContext(PortalRoot) ?? undefined;

export function Page({ eyebrow, title, intro, actions, children }: { eyebrow?: ReactNode; title: ReactNode; intro?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return <div className="page">
    <div className="page-head">
      <div className="page-title">{eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}<h1>{title}</h1>{intro ? <p className="intro">{intro}</p> : null}</div>
      {actions ? <div className="actions">{actions}</div> : null}
    </div>
    {children}
  </div>;
}
// Brödsmulor: "Spelbord / Privé". Sista ledet är sidan själv.
export function Crumbs({ items }: { items: { label: ReactNode; href?: string }[] }) {
  return <nav aria-label="Brödsmulor" className="crumbs">{items.map((item, index) => <React.Fragment key={index}>
    {index ? <ChevronRight aria-hidden="true" size={13} /> : null}
    {item.href ? <a href={item.href}>{item.label}</a> : <span aria-current="page">{item.label}</span>}
  </React.Fragment>)}</nav>;
}
export function Card({ title, aside, icon, className = '', children, ...rest }: { title?: ReactNode; aside?: ReactNode; icon?: ReactNode; className?: string; children?: ReactNode } & Omit<React.HTMLAttributes<HTMLElement>, 'title'>) {
  return <section className={clsx('card', className)} {...rest}>
    {title ? <div className="card-head"><h2>{icon ? <span className="card-icon" aria-hidden="true">{icon}</span> : null}{title}</h2>{aside ? <div className="aside">{aside}</div> : null}</div> : null}
    {children}
  </section>;
}
export function Badge({ tone = '', dot = false, children, title, className }: { tone?: Tone; dot?: boolean; children: ReactNode; title?: string; className?: string }) {
  return <span className={clsx('chip', tone, className)} title={title}>{dot ? <span className="dot" aria-hidden="true" /> : null}{children}</span>;
}
/** Admins hub exporterar samma märke under namnet Chip. */
export const Chip = Badge;
// Knappens varianter i ett ställe (samma mönster som Admin-klientens buttonVariants).
const buttonClass = cva('btn', {
  variants: { tone: { default: '', primary: 'primary', ghost: 'ghost', ink: 'ink', danger: 'danger' }, small: { true: 'small', false: '' }, icon: { true: 'icon', false: '' } },
  defaultVariants: { tone: 'default', small: false, icon: false },
});
type BtnTone = 'default' | 'primary' | 'ghost' | 'ink' | 'danger' | '';
export function Btn({ href, tone = 'default', small = false, icon = false, disabled = false, onClick, type = 'button', children, title, target, rel, ...rest }:
  { href?: string; tone?: BtnTone; small?: boolean; icon?: boolean; disabled?: boolean; onClick?: () => void; type?: 'button' | 'submit' | 'reset'; children?: ReactNode; title?: string; target?: string; rel?: string } & Record<`aria-${string}` | `data-${string}`, string | undefined>) {
  const className = buttonClass({ tone: tone || 'default', small, icon });
  if (href && !disabled) return <a href={href} className={className} title={title} target={target} rel={rel} {...rest}>{children}</a>;
  return <button type={type} className={className} disabled={disabled} aria-disabled={disabled ? 'true' : undefined} title={title} onClick={onClick} {...rest}>{children}</button>;
}
export function Row({ chip, title, text, href, action }: { chip?: ReactNode; title: ReactNode; text?: ReactNode; href?: string; action?: ReactNode }) {
  const body = <><div>{chip}</div><div><div className="title">{title}</div>{text ? <div className="text">{text}</div> : null}</div><div>{action ?? null}</div></>;
  return href ? <a href={href} className="row link">{body}</a> : <div className="row">{body}</div>;
}
export function Rows({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('rows', className)}>{children}</div>;
}
/** Ärligt tomläge. Standardmärket säger att ytan inte är ansluten; `chip={null}` ger ett vanligt "inget här". */
export function Empty({ title, text, action, chip = 'Inte anslutet', icon }: { title: ReactNode; text?: ReactNode; action?: ReactNode; chip?: ReactNode | null; icon?: ReactNode }) {
  return <div className="empty">{icon ? <div className="empty-icon" aria-hidden="true">{icon}</div> : null}{chip ? <Badge tone="warn">{chip}</Badge> : null}<h3>{title}</h3>{text ? <p className="small">{text}</p> : null}{action ? <div className="mt">{action}</div> : null}</div>;
}
export function KV({ items }: { items: [ReactNode, ReactNode][] }) {
  return <dl className="kv">{items.map(([key, value], index) => <React.Fragment key={index}><dt>{key}</dt><dd>{value}</dd></React.Fragment>)}</dl>;
}
export function Note({ tone = '', children, className, role }: { tone?: '' | 'warn' | 'accent' | 'danger'; children: ReactNode; className?: string; role?: 'status' | 'alert' }) {
  return <div className={clsx('note', tone, className)} role={role}>{children}</div>;
}
/** Ett tal med sin etikett; `hint` säger var det kommer ifrån eller vad det betyder. */
export function Stat({ label, value, hint, icon }: { label: ReactNode; value: ReactNode; hint?: ReactNode; icon?: ReactNode }) {
  return <div className="stat">{icon ? <span className="stat-icon" aria-hidden="true">{icon}</span> : null}<span className="v">{value}</span><span className="l">{label}</span>{hint ?? null}</div>;
}
/** Hopfälld sektion: tekniska identiteter (`items`) eller en kort sekundär del (`children`). */
export function TechnicalDetails({ items = [], title = 'Tekniska detaljer', children, className }: { items?: [string, ReactNode][]; title?: ReactNode; children?: ReactNode; className?: string }) {
  if (!items.length && !children) return null;
  return <details className={clsx('tech', className)}><summary>{title}</summary>
    {items.length ? <KV items={items} /> : null}
    {children}
  </details>;
}

// Verktygstips (Radix): förklaringar och id:n utan att de syns i texten.
export function Tip({ content, children, side = 'top' }: { content?: ReactNode; children: React.ReactElement; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  const container = usePortal();
  if (!content) return children;
  // Each tip carries its own provider, so a view also works outside the shell (tests, server markup).
  return <Tooltip.Provider delayDuration={250}><Tooltip.Root>
    <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
    <Tooltip.Portal container={container}><Tooltip.Content className="tip" side={side} sideOffset={6}>{content}<Tooltip.Arrow className="tip-arrow" /></Tooltip.Content></Tooltip.Portal>
  </Tooltip.Root></Tooltip.Provider>;
}

// Spelbordets små staplar per dag och större diagram (recharts). Tomma dagar syns som stubbar.
export function Bars({ values, label, height = 36 }: { values: number[]; label: string; height?: number }) {
  const max = Math.max(1, ...values);
  const data = values.map((value, index) => ({ index, value, stub: value ? 0 : max * 0.08 }));
  return <div className="bars" style={{ height }} role="img" aria-label={label}>
    <ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }} barCategoryGap={2}>
      <YAxis hide domain={[0, max]} />
      <Bar dataKey="value" stackId="day" fill="var(--sg-chart-1)" radius={[2, 2, 0, 0]} isAnimationActive={false} />
      <Bar dataKey="stub" stackId="day" fill="var(--sg-border)" isAnimationActive={false} />
    </BarChart></ResponsiveContainer>
  </div>;
}
type Series = { key: string; label: string; color?: string; format?: (value: number, axis?: boolean) => string };
// Rundor (staplar) och netto (linje, egen axel) per dag över perioden, med verktygstips.
export function TrendChart({ data, bars, line, height = 240, label }: { data: Record<string, unknown>[]; bars: Series; line?: Series; height?: number; label: string }) {
  const axis = { tickLine: false, axisLine: false, tick: { fill: 'var(--sg-faint)', fontSize: 11 } };
  const names: Record<string, Series> = { [bars.key]: bars, ...(line ? { [line.key]: line } : {}) };
  return <div className="chart" style={{ height }} role="img" aria-label={label}>
    <ResponsiveContainer width="100%" height="100%"><ComposedChart data={data} margin={{ top: 8, right: line ? 0 : 4, bottom: 0, left: -12 }} barCategoryGap="24%">
      <CartesianGrid vertical={false} stroke="var(--sg-line-2)" />
      <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={16} />
      <YAxis yAxisId="bars" {...axis} allowDecimals={false} width={40} />
      {line ? <YAxis yAxisId="line" orientation="right" {...axis} width={56} tickFormatter={value => line.format ? line.format(value, true) : value} /> : null}
      <ChartTooltip cursor={{ fill: 'var(--sg-surface-2)' }} contentStyle={{ background: 'var(--sg-surface)', border: '1px solid var(--sg-border)', borderRadius: 8, color: 'var(--sg-text)', fontSize: 12, boxShadow: 'var(--sg-shadow)' }} labelStyle={{ color: 'var(--sg-muted)', marginBottom: 4 }}
        formatter={(value, name) => [names[name]?.format ? names[name].format(Number(value)) : value, names[name]?.label ?? name]} />
      <Bar yAxisId="bars" dataKey={bars.key} fill={bars.color ?? 'var(--sg-chart-1)'} radius={[3, 3, 0, 0]} isAnimationActive={false} />
      {line ? <Line yAxisId="line" type="monotone" dataKey={line.key} stroke={line.color ?? 'var(--sg-chart-2)'} strokeWidth={2} dot={false} isAnimationActive={false} /> : null}
    </ComposedChart></ResponsiveContainer>
  </div>;
}

/** En åtgärd i ⋯-menyn. `disabled` är skälet i ord; bekräftelsen hör till anroparens ConfirmDialog. */
export type MenuAction = { id: string; label: ReactNode; tone?: 'danger' | ''; disabled?: string; onSelect: () => void; icon?: ReactNode };
// Åtgärdsmeny (⋯) per objekt (Radix DropdownMenu). Menyn gör inget själv; onSelect gör anropet
// eller öppnar anroparens ConfirmDialog. `label` ersätter "Åtgärder för <name>" i andra språk;
// `disabled` låser hela menyn medan något sparas.
export function ActionMenu({ name, actions, label, id, disabled = false, small = true }: { name: string; actions: MenuAction[]; label?: string; id?: string; disabled?: boolean; small?: boolean }) {
  const container = usePortal();
  const text = label ?? `Åtgärder för ${name}`;
  return <Dropdown.Root modal={false}>
    <Dropdown.Trigger asChild><button type="button" id={id} className={clsx('btn icon', small && 'small')} aria-label={text} disabled={disabled || !actions.length}><MoreHorizontal size={16} aria-hidden="true" /></button></Dropdown.Trigger>
    <Dropdown.Portal container={container}><Dropdown.Content className="menu-content" align="end" sideOffset={4} aria-label={text}>
      {actions.map(action => <Dropdown.Item key={action.id} className={clsx('menu-item', action.tone)} disabled={Boolean(action.disabled)} title={action.disabled || undefined} onSelect={() => action.onSelect()}>{action.icon ? <span aria-hidden="true" className="menu-icon">{action.icon}</span> : null}{action.label}</Dropdown.Item>)}
    </Dropdown.Content></Dropdown.Portal>
  </Dropdown.Root>;
}

export type ConfirmDialogProps = {
  open: boolean; title: string;
  /** En kort mening som säger konsekvensen. */
  description?: ReactNode;
  /** Konkreta konsekvenser, en rad var. */
  consequences?: ReactNode[];
  children?: ReactNode;
  /** Utan etikett informerar dialogen bara och erbjuder avbryt. */
  confirmLabel?: string; confirmDisabled?: boolean; cancelLabel?: string;
  /** Destruktiv stil på huvudknappen. Standard på, som i Admin. */
  danger?: boolean;
  onConfirm: () => void; onCancel: () => void;
};
/** Bekräftelse med konsekvensrader (Radix Dialog i portalens rot). */
export function ConfirmDialog({ open, title, description, consequences = [], children, confirmLabel, confirmDisabled = false, cancelLabel = 'Avbryt', danger = true, onConfirm, onCancel }: ConfirmDialogProps) {
  const container = usePortal();
  const id = React.useId();
  const described = description || consequences.length ? `${id}-body` : undefined;
  return <Dialog.Root open={open} onOpenChange={next => { if (!next) onCancel(); }}>
    <Dialog.Portal container={container}><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="dialog-content" aria-describedby={described}>
      <Dialog.Title>{title}</Dialog.Title>
      {described ? <div id={described}>{description ? <p>{description}</p> : null}{consequences.length ? <ul>{consequences.map((row, index) => <li key={index}>{row}</li>)}</ul> : null}</div> : null}
      {children}
      <div className="actions end"><Dialog.Close asChild><button type="button" className="btn">{cancelLabel}</button></Dialog.Close>
        {confirmLabel ? <button type="button" className={clsx('btn', danger ? 'danger-solid' : 'primary')} disabled={confirmDisabled} onClick={onConfirm}>{confirmLabel}</button> : null}</div>
    </Dialog.Content></Dialog.Portal>
  </Dialog.Root>;
}

// Böjning: "1 dealer", "2 dealers"; "1 scenmall", "2 scenmallar".
export function count(value: number, one: string, many: string) { return `${value} ${value === 1 ? one : many}`; }

export const locale = (language?: Language) => language === 'en' ? 'en-GB' : 'sv-SE';
export const fmtInt = (value: unknown, language?: Language) => typeof value === 'number' && Number.isFinite(value) ? new Intl.NumberFormat(locale(language)).format(value) : '—';
export function fmtDate(ms: number, language?: Language) {
  if (!Number.isFinite(ms)) return '—';
  return new Date(ms).toLocaleDateString(locale(language), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
